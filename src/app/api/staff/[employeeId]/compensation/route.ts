import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'node:crypto';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or System Admin can access staff compensation records.' }, { status: 403 });
    }

    const { employeeId } = await params;
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        employmentAgreements: {
          include: {
            compensations: {
              orderBy: { version: 'desc' },
            },
          },
        },
      },
    });

    if (!emp) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Employee ${employeeId} not found.` }, { status: 404 });
    }

    // MANDATORY AUDIT LOG: Read of compensation must be audited
    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: 'BEMS-GROUP',
        correlationId: `CORR-COMP-${Date.now()}`,
        targetType: 'STAFF_COMPENSATION',
        targetId: employeeId,
        action: 'STAFF_COMPENSATION_ACCESSED',
        metadata: JSON.stringify({
          employeeName: emp.legalName,
          employeeNumber: emp.employeeNumber,
          accessedBy: actor.legalName,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    const agreement = emp.employmentAgreements?.[0];
    const compensations = agreement?.compensations || [];
    const current = compensations[0];

    return NextResponse.json({
      ok: true,
      employee_id: emp.id,
      employee_number: emp.employeeNumber,
      employee_name: emp.legalName,
      current_compensation: {
        base_gross_minor: current ? Number(current.grossMinor) : 0,
        base_gross_formatted: current ? `₦${(Number(current.grossMinor) / 100).toLocaleString()}` : '₦0',
        effective_from: current?.effectiveFrom?.toISOString() || null,
        version: current?.version || 1,
      },
      history: compensations.map(c => ({
        version: c.version,
        amount_formatted: `₦${(Number(c.grossMinor) / 100).toLocaleString()}`,
        effective_from: c.effectiveFrom.toISOString(),
        change_reason: c.changeReason,
        approved_by_id: c.approvedBy,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
