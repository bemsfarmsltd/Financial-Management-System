import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { inspectEmployeeCompensationContext } from '@/lib/services/compensation';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only authorized executives can stage compensation changes.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const employee_id = body.employee_id || body.employeeId || body.id || body.staff_id || body.staffId;
    const rawChangeType = String(body.change_type || body.changeType || '').toUpperCase().trim();
    const effective_date = body.effective_date || body.effectiveDate;
    const reason = String(body.reason || body.notes || body.justification || 'Executive compensation review').trim();

    if (!employee_id) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'employee_id is required.' }, { status: 400 });
    }
    if (reason.length < 5) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'A reason of at least 5 characters is required.' }, { status: 400 });
    }

    let parsedEffectiveDate = new Date();
    if (effective_date) {
      const d = new Date(effective_date);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error_code: 'INVALID_DATE', message: 'effective_date must be a valid date.' }, { status: 400 });
      }
      parsedEffectiveDate = d;
    }

    let ctx;
    try {
      ctx = await inspectEmployeeCompensationContext(String(employee_id));
    } catch (err: any) {
      const msg = err?.message || 'Failed to resolve employee compensation context.';
      const status = msg.includes('not found') ? 404 : 409;
      return NextResponse.json({ ok: false, error_code: status === 404 ? 'NOT_FOUND' : 'PRECONDITION_FAILED', message: msg }, { status });
    }

    const currentGross = ctx.currentGrossNaira;

    const explicitNewGross =
      body.new_base_salary ??
      body.newBaseSalary ??
      body.new_salary ??
      body.newSalary ??
      body.new_base_gross ??
      body.newBaseGross ??
      body.target_salary ??
      body.targetSalary;
    const deltaAmount = body.delta ?? body.increase_amount ?? body.deduction_amount;
    const percentage = body.percentage ?? body.percent;
    const rawAmount = body.amount;

    let targetGross = currentGross;

    if (rawChangeType === 'REMOVE_FROM_PAYROLL') {
      targetGross = 0;
    } else if (explicitNewGross !== undefined && explicitNewGross !== null) {
      targetGross = Number(explicitNewGross);
    } else if (percentage !== undefined && percentage !== null) {
      const delta = (currentGross * Number(percentage)) / 100;
      targetGross =
        rawChangeType === 'DEDUCTION' || rawChangeType === 'SUBTRACTION'
          ? currentGross - delta
          : currentGross + delta;
    } else if (deltaAmount !== undefined && deltaAmount !== null) {
      const delta = Number(deltaAmount);
      targetGross =
        rawChangeType === 'DEDUCTION' || body.deduction_amount !== undefined
          ? currentGross - delta
          : currentGross + delta;
    } else if (rawAmount !== undefined && rawAmount !== null) {
      const num = Number(rawAmount);
      if (rawChangeType === 'DEDUCTION' || rawChangeType === 'SUBTRACTION') {
        targetGross = currentGross - num;
      } else if (rawChangeType === 'ADDITION' || rawChangeType === 'INCREASE') {
        targetGross = currentGross + num;
      } else {
        targetGross = num;
      }
    }

    if (rawChangeType !== 'REMOVE_FROM_PAYROLL') {
      if (!Number.isFinite(targetGross) || targetGross <= 0 || targetGross > 1_000_000_000) {
        return NextResponse.json(
          { ok: false, error_code: 'INVALID_AMOUNT', message: 'Resulting salary must be a positive amount.' },
          { status: 400 }
        );
      }
    }

    const deltaVal = targetGross - currentGross;
    const deltaFormatted =
      deltaVal > 0
        ? `+₦${deltaVal.toLocaleString()}`
        : deltaVal < 0
        ? `-₦${Math.abs(deltaVal).toLocaleString()}`
        : '₦0';

    const resolvedChangeType =
      rawChangeType === 'REMOVE_FROM_PAYROLL'
        ? 'REMOVE_FROM_PAYROLL'
        : currentGross === 0
        ? 'INITIAL_SALARY'
        : deltaVal < 0
        ? 'DEDUCTION'
        : deltaVal > 0
        ? 'ADDITION'
        : 'SET_EXACT';

    const materialPayload = {
      employee_id: ctx.employee.id,
      subsidiary_id: ctx.subsidiaryId,
      change_type: resolvedChangeType,
      amount: targetGross,
      new_base_salary: targetGross,
      prior_base_salary: currentGross,
      effective_date: parsedEffectiveDate.toISOString(),
      reason,
      expected_comp_version: ctx.currentCompVersion,
    };

    const summary =
      resolvedChangeType === 'REMOVE_FROM_PAYROLL'
        ? `Remove ${ctx.employee.legalName} (${ctx.employee.employeeNumber}) from salary payroll`
        : `Adjust base salary for ${ctx.employee.legalName} (${ctx.employee.employeeNumber}) from ₦${currentGross.toLocaleString()} to ₦${targetGross.toLocaleString()}`;

    const preview = {
      employee_name: ctx.employee.legalName,
      employee_number: ctx.employee.employeeNumber,
      subsidiary: ctx.subsidiaryName,
      prior_base_gross: `₦${currentGross.toLocaleString()}`,
      new_base_gross: `₦${targetGross.toLocaleString()}`,
      delta: deltaFormatted,
      effective_date: parsedEffectiveDate.toISOString().split('T')[0],
      affected_open_periods:
        ctx.affectedOpenPeriods.length > 0 ? ctx.affectedOpenPeriods.join(', ') : 'Next payroll cycle',
      reason,
      notified_party: `${ctx.employee.legalName} (${ctx.employee.workEmail})`,
    };

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'salary_change',
      targetEmployeeId: ctx.employee.id,
      targetSubsidiaryId: ctx.subsidiaryId,
      materialPayload,
      summary,
      preview,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
