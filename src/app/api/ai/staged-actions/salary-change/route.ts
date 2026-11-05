import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only authorized executives can stage compensation changes.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const employee_id = body.employee_id || body.employeeId || body.id || body.staff_id || body.staffId;
    const change_type = (body.change_type || body.changeType || '').toUpperCase();
    const effective_date = body.effective_date || body.effectiveDate;
    const reason = body.reason || body.notes || body.justification;

    if (!employee_id) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'employee_id is required.' }, { status: 400 });
    }

    const emp = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employee_id },
          { employeeNumber: employee_id },
          { workEmail: employee_id },
        ],
      },
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
    const currentGross = currentComp ? Number(currentComp.grossMinor) / 100 : 0;

    // Support both explicit new base salary fields and incremental delta/amount fields
    const explicitNewGross = body.new_base_salary ?? body.newBaseSalary ?? body.new_salary ?? body.newSalary ?? body.new_base_gross ?? body.newBaseGross ?? body.target_salary ?? body.targetSalary;
    const deltaAmount = body.delta ?? body.increase_amount ?? body.deduction_amount;
    const percentage = body.percentage ?? body.percent;
    const rawAmount = body.amount;

    let targetGross = currentGross;

    if (explicitNewGross !== undefined && explicitNewGross !== null) {
      targetGross = Number(explicitNewGross);
    } else if (percentage !== undefined && percentage !== null) {
      const delta = (currentGross * Number(percentage)) / 100;
      targetGross = (change_type === 'DEDUCTION' || change_type === 'SUBTRACTION') ? currentGross - delta : currentGross + delta;
    } else if (deltaAmount !== undefined && deltaAmount !== null) {
      const delta = Number(deltaAmount);
      targetGross = (change_type === 'DEDUCTION' || body.deduction_amount !== undefined) ? currentGross - delta : currentGross + delta;
    } else if (rawAmount !== undefined && rawAmount !== null) {
      const num = Number(rawAmount);
      if (change_type === 'DEDUCTION' || change_type === 'SUBTRACTION') {
        targetGross = currentGross - num;
      } else if (change_type === 'ADDITION' || change_type === 'INCREASE') {
        targetGross = currentGross + num;
      } else {
        // If change_type is SET, ABSOLUTE or unspecified, treat amount as absolute new base salary
        targetGross = num;
      }
    }

    const deltaVal = targetGross - currentGross;
    const deltaFormatted = deltaVal > 0 ? `+₦${deltaVal.toLocaleString()}` : deltaVal < 0 ? `-₦${Math.abs(deltaVal).toLocaleString()}` : '₦0';

    const materialPayload = {
      employee_id: emp.id,
      change_type: deltaVal < 0 ? 'DEDUCTION' : 'ADDITION',
      amount: targetGross,
      new_base_salary: targetGross,
      effective_date: effective_date || new Date().toISOString(),
      reason: reason || 'Executive compensation review',
    };

    const summary = `Adjust base salary for ${emp.legalName} (${emp.employeeNumber}) to ₦${targetGross.toLocaleString()}`;

    const preview = {
      employee_name: emp.legalName,
      employee_number: emp.employeeNumber,
      prior_base_gross: `₦${currentGross.toLocaleString()}`,
      new_base_gross: `₦${targetGross.toLocaleString()}`,
      delta: deltaFormatted,
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
