import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
}

export async function POST(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to update salary.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the GMD can approve a staff salary change.' }, { status: 403 });

  try {
    const { employeeId } = await params;
    const body = await request.json();
    const changeType = body.changeType === 'ADDITION' || body.changeType === 'DEDUCTION' ? body.changeType : null;
    const amount = Number(body.amount);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!changeType) return NextResponse.json({ error: 'Choose an addition or deduction.' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return NextResponse.json({ error: 'Enter a valid positive amount.' }, { status: 400 });
    if (reason.length < 5 || reason.length > 1000) return NextResponse.json({ error: 'Enter a reason of at least 5 characters.' }, { status: 400 });
    const deltaMinor = BigInt(Math.round(amount * 100));
    const now = new Date();

    const result = await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true, legalName: true, status: true } });
      if (!employee) throw new Error('Staff member not found.');
      if (employee.status !== 'ACTIVE') throw new Error('Salary can only be changed for active staff.');

      const agreement = await tx.employmentAgreement.findFirst({
        where: { employeeId, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        include: {
          compensations: { orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }], take: 1 }
        }
      });
      if (!agreement) throw new Error('This staff member has no active employment agreement.');
      const latest = agreement.compensations[0];
      if (!latest) throw new Error('This staff member has no salary record to adjust.');

      const effectiveSalary = await tx.compensationAgreement.findFirst({
        where: {
          employmentAgreementId: agreement.id,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
      });
      const current = effectiveSalary || latest;
      const newGrossMinor = changeType === 'ADDITION' ? current.grossMinor + deltaMinor : current.grossMinor - deltaMinor;
      if (newGrossMinor <= BigInt(0)) throw new Error('A deduction cannot reduce salary to zero or below.');

      const prior = await tx.compensationAgreement.findMany({ where: { employmentAgreementId: agreement.id }, select: { version: true } });
      const nextVersion = Math.max(0, ...prior.map(compensation => compensation.version)) + 1;
      if (effectiveSalary) {
        await tx.compensationAgreement.update({ where: { id: effectiveSalary.id }, data: { effectiveTo: new Date(now.getTime() - 1) } });
      }
      const compensation = await tx.compensationAgreement.create({
        data: {
          employmentAgreementId: agreement.id,
          grossMinor: newGrossMinor,
          currency: current.currency,
          recurrence: current.recurrence,
          effectiveFrom: now,
          version: nextVersion,
          approvedBy: actor.id,
          changeType,
          changeReason: reason
        }
      });

      const verb = changeType === 'ADDITION' ? 'increased' : 'decreased';
      const amountLabel = formatNaira(deltaMinor);
      await tx.systemNotification.create({
        data: {
          employeeId,
          kind: 'PAYROLL_SALARY_CHANGED',
          title: 'Your salary has been updated',
          body: `Your gross salary was ${verb} by ${amountLabel}, from ${formatNaira(current.grossMinor)} to ${formatNaira(newGrossMinor)}. Reason: ${reason}`,
          linkUrl: '/payroll'
        }
      });

      const organization = await tx.organization.findUnique({ where: { id: agreement.employerEntityId }, select: { id: true, parentGroupId: true } });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: organization?.parentGroupId || organization?.id || agreement.employerEntityId,
          subsidiaryId: agreement.employerEntityId,
          targetType: 'PAYROLL',
          targetId: employeeId,
          action: 'SALARY_CHANGED',
          correlationId: `CORR-SALARY-${randomUUID()}`,
          metadata: JSON.stringify({ employeeName: employee.legalName, compensationId: compensation.id, changeType, changeAmountMinor: deltaMinor.toString(), previousGrossMinor: current.grossMinor.toString(), newGrossMinor: newGrossMinor.toString(), reason }),
        },
      });

      return { compensation, previousGrossMinor: current.grossMinor, newGrossMinor };
    });

    return NextResponse.json({
      message: 'Salary updated. The staff member has been notified.',
      previousGrossFormatted: formatNaira(result.previousGrossMinor),
      newGrossFormatted: formatNaira(result.newGrossMinor),
      effectiveFrom: result.compensation.effectiveFrom,
      version: result.compensation.version
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update salary.';
    const status = message === 'Staff member not found.' ? 404 : message.startsWith('This staff') || message.startsWith('Salary can') || message.startsWith('A deduction') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
