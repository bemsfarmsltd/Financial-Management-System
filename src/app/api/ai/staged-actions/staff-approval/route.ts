import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or System Admin can stage staff approvals.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { employee_id } = body;

    if (!employee_id) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'employee_id is required.' }, { status: 400 });
    }

    const emp = await prisma.employee.findUnique({
      where: { id: employee_id },
      include: { assignments: { include: { subsidiary: true, department: true } } },
    });

    if (!emp) return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Employee ${employee_id} not found.` }, { status: 404 });

    if (emp.role !== 'STAFF') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'INVALID_TARGET_ROLE',
          message: `Cannot use staff self-service approval for executive role (${emp.role}). Executive onboarding uses email invitations.`,
        },
        { status: 409 }
      );
    }

    if (emp.approvalStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'NOT_PENDING_APPROVAL',
          message: `Employee ${emp.legalName} (${emp.employeeNumber}) is already ${emp.approvalStatus} (status: ${emp.status}).`,
        },
        { status: 409 }
      );
    }

    const sub = emp.assignments?.[0]?.subsidiary;
    const dept = emp.assignments?.[0]?.department;

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'staff_approval',
      targetEmployeeId: emp.id,
      targetSubsidiaryId: emp.assignments?.[0]?.subsidiaryId,
      materialPayload: {
        employee_id: emp.id,
        employee_number: emp.employeeNumber,
        name: emp.legalName,
        expected_approval_status: emp.approvalStatus,
      },
      summary: `Authorize corporate onboarding for ${emp.legalName} (${emp.employeeNumber})`,
      preview: {
        staff_id: emp.employeeNumber,
        full_name: emp.legalName,
        work_email: emp.workEmail,
        role: emp.role,
        current_status: emp.approvalStatus,
        subsidiary: sub?.legalName || 'BEMS Group',
        department: dept?.name || 'General Operations',
        disbursement_bank: `${emp.bankName || 'Recorded'} · ${emp.accountNumber || 'Verified'}`,
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
