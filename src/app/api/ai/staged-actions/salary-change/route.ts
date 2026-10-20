import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only authorized executives can stage compensation changes.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { employee_id, change_type, amount, percentage, effective_date, reason } = body;

    if (!employee_id) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'employee_id is required.' }, { status: 400 });
    }

    const emp = await prisma.employee.findUnique({
      where: { id: employee_id },
      include: {
        employmentAgreements: {
          include: { compensations: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
        },
      },
    });

    if (!emp) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Employee ${employee_id} not found.` }, { status: 404 });
    }

    const currentComp = emp.employmentAgreements?.[0]?.compensations?.[0];
    const currentGross = currentComp ? Number(currentComp.baseGrossSalaryMinor) / 100 : 0;

    let targetGross = Number(amount) || currentGross;
    if (percentage) {
      const delta = (currentGross * Number(percentage)) / 100;
      targetGross = change_type === 'DEDUCTION' ? currentGross - delta : currentGross + delta;
    }

    const materialPayload = {
      employee_id: emp.id,
      change_type: change_type || 'ADDITION',
      amount: targetGross,
      effective_date: effective_date || new Date().toISOString(),
      reason: reason || 'Executive compensation review',
    };

    const summary = `Adjust base salary for ${emp.legalName} (${emp.employeeNumber}) to ₦${targetGross.toLocaleString()}`;

    const preview = {
      employee_name: emp.legalName,
      employee_number: emp.employeeNumber,
      prior_base_gross: `₦${currentGross.toLocaleString()}`,
      new_base_gross: `₦${targetGross.toLocaleString()}`,
      delta: `₦${(targetGross - currentGross).toLocaleString()}`,
      effective_date: effective_date || new Date().toLocaleDateString(),
      reason: reason || 'Executive salary modification',
      notified_party: `${emp.legalName} (${emp.workEmail})`,
    };

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'salary_change',
      materialPayload,
      summary,
      preview,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
