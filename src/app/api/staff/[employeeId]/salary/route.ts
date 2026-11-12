import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import {
  applyCanonicalCompensationChange,
  CompensationChangeType,
} from '@/lib/services/compensation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to update salary.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return NextResponse.json({ error: 'Only the GMD or Super Admin can update staff salary.' }, { status: 403 });
  }

  try {
    const { employeeId } = await params;
    const body = await request.json();
    const changeType: CompensationChangeType | null =
      body.changeType === 'ADDITION' ||
      body.changeType === 'DEDUCTION' ||
      body.changeType === 'SET_EXACT' ||
      body.changeType === 'INITIAL_SALARY' ||
      body.changeType === 'REMOVE_FROM_PAYROLL'
        ? body.changeType
        : 'SET_EXACT';
    const amount = Number(body.amount);
    const rawReason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const reason =
      rawReason.length >= 5
        ? rawReason.slice(0, 1000)
        : rawReason.length > 0
        ? `${rawReason} — Executive salary adjustment`
        : 'Executive salary review and update';

    if (!changeType) {
      return NextResponse.json(
        { error: 'Choose an adjustment type (Set Exact, Addition, Deduction, or Remove from Payroll).' },
        { status: 400 }
      );
    }
    if (changeType !== 'REMOVE_FROM_PAYROLL') {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
        return NextResponse.json({ error: 'Enter a valid positive amount.' }, { status: 400 });
      }
    }
    if (reason.length < 5 || reason.length > 1000) {
      return NextResponse.json({ error: 'Enter a reason of at least 5 characters.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const compResult = await applyCanonicalCompensationChange(tx, {
        employeeId,
        changeType,
        amountNaira: changeType === 'REMOVE_FROM_PAYROLL' ? 0 : amount,
        isTargetGross: false,
        effectiveFrom: body.effectiveFrom || body.effectiveDate || new Date(),
        reason,
        actorId: actor.id,
      });

      await tx.systemNotification.create({
        data: {
          employeeId,
          kind: 'PAYROLL_SALARY_CHANGED',
          title: 'Your salary has been updated',
          body: compResult.notificationBody,
          linkUrl: '/payroll',
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: compResult.subsidiaryId || 'BEMS-GROUP',
          subsidiaryId: compResult.subsidiaryId,
          targetType: 'PAYROLL',
          targetId: employeeId,
          action: 'SALARY_CHANGED',
          correlationId: `SALARY-${compResult.compensation.id}`,
          metadata: JSON.stringify({
            employeeName: compResult.employee.legalName,
            compensationId: compResult.compensation.id,
            changeType: compResult.compensation.changeType,
            targetAmountMinor: compResult.targetDeltaMinor.toString(),
            previousGrossMinor: compResult.previousGrossMinor.toString(),
            newGrossMinor: compResult.newGrossMinor.toString(),
            affectedOpenPeriods: compResult.affectedOpenPeriods,
            reason,
          }),
        },
      });

      return compResult;
    });

    return NextResponse.json({
      success: true,
      message: 'Salary updated. The staff member has been notified.',
      previousGrossFormatted: result.previousGrossFormatted,
      newGrossFormatted: result.newGrossFormatted,
      effectiveFrom: result.compensation.effectiveFrom,
      version: result.compensation.version,
      affectedOpenPeriods: result.affectedOpenPeriods,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update salary.';
    const status =
      message === 'Staff member not found.'
        ? 404
        : message.includes('only applicable') ||
          message.includes('active staff') ||
          message.includes('cannot be zero') ||
          message.includes('does not have an active')
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
