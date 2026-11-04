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
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return NextResponse.json({ error: 'Only the GMD or Super Admin can update staff salary.' }, { status: 403 });
  }

  try {
    const { employeeId } = await params;
    const body = await request.json();
    const changeType = body.changeType === 'ADDITION' || body.changeType === 'DEDUCTION' || body.changeType === 'SET_EXACT' || body.changeType === 'INITIAL_SALARY' || body.changeType === 'REMOVE_FROM_PAYROLL' ? body.changeType : null;
    const amount = Number(body.amount);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!changeType) return NextResponse.json({ error: 'Choose an adjustment type (Set Exact, Addition, Deduction, or Remove from Payroll).' }, { status: 400 });
    if (changeType !== 'REMOVE_FROM_PAYROLL') {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return NextResponse.json({ error: 'Enter a valid positive amount.' }, { status: 400 });
    }
    if (reason.length < 5 || reason.length > 1000) return NextResponse.json({ error: 'Enter a reason of at least 5 characters.' }, { status: 400 });
    const targetMinor = changeType === 'REMOVE_FROM_PAYROLL' ? BigInt(0) : BigInt(Math.round(amount * 100));
    const now = new Date();

    const result = await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, legalName: true, status: true, role: true, assignments: { select: { subsidiaryId: true, departmentId: true }, take: 1 } }
      });
      if (!employee) throw new Error('Staff member not found.');
      if (employee.role !== 'STAFF') throw new Error('Staff salary adjustments are only applicable to staff members.');
      if (employee.status !== 'ACTIVE') throw new Error('Salary can only be changed for active staff.');

      const defaultOrg = employee.assignments[0]?.subsidiaryId || (await tx.organization.findFirst({ select: { id: true } }))?.id || '';

      let agreement = await tx.employmentAgreement.findFirst({
        where: { employeeId, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        include: {
          compensations: { orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }], take: 1 },
        }
      });

      if (!agreement) {
        agreement = await tx.employmentAgreement.create({
          data: {
            employeeId,
            employerEntityId: defaultOrg,
            agreementType: 'PERMANENT',
            paymentModel: 'GROUP_PAID',
            status: 'ACTIVE',
            startDate: now
          },
          include: {
            compensations: true,
          }
        });
      }

      const latest = agreement.compensations[0];

      const effectiveSalary = await tx.compensationAgreement.findFirst({
        where: {
          employmentAgreementId: agreement.id,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
      });
      const current = effectiveSalary || latest;
      let newGrossMinor: bigint;
      let prevGrossMinor: bigint = current ? current.grossMinor : BigInt(0);

      if (changeType === 'SET_EXACT' || changeType === 'INITIAL_SALARY') {
        newGrossMinor = targetMinor;
      } else if (changeType === 'REMOVE_FROM_PAYROLL') {
        newGrossMinor = BigInt(0);
      } else if (changeType === 'ADDITION') {
        newGrossMinor = prevGrossMinor + targetMinor;
      } else {
        newGrossMinor = prevGrossMinor - targetMinor;
      }

      if (changeType !== 'REMOVE_FROM_PAYROLL' && newGrossMinor <= BigInt(0)) {
        throw new Error('Salary cannot be zero or negative.');
      }

      const prior = await tx.compensationAgreement.findMany({ where: { employmentAgreementId: agreement.id }, select: { version: true } });
      const nextVersion = Math.max(0, ...prior.map(compensation => compensation.version)) + 1;
      if (effectiveSalary) {
        await tx.compensationAgreement.update({ where: { id: effectiveSalary.id }, data: { effectiveTo: new Date(now.getTime() - 1) } });
      }
      const compensation = await tx.compensationAgreement.create({
        data: {
          employmentAgreementId: agreement.id,
          grossMinor: newGrossMinor,
          currency: current?.currency || 'NGN',
          recurrence: current?.recurrence || 'MONTHLY',
          effectiveFrom: now,
          version: nextVersion,
          approvedBy: actor.id,
          changeType,
          changeReason: reason
        }
      });

      await tx.costAllocation.create({
        data: {
          compensationAgreementId: compensation.id,
          subsidiaryId: defaultOrg,
          percentage: 100,
          effectiveFrom: now,
        }
      });

      const bodyText = changeType === 'REMOVE_FROM_PAYROLL'
        ? `You have been removed from salary payroll. Reason: ${reason}`
        : changeType === 'SET_EXACT' || changeType === 'INITIAL_SALARY'
        ? `Your monthly gross salary is set to ${formatNaira(newGrossMinor)}. Reason: ${reason}`
        : `Your gross salary was ${changeType === 'ADDITION' ? 'increased' : 'decreased'} by ${formatNaira(targetMinor)}, from ${formatNaira(prevGrossMinor)} to ${formatNaira(newGrossMinor)}. Reason: ${reason}`;

      // If removed from payroll, also clean up any unpaid payroll items in active batches
      if (changeType === 'REMOVE_FROM_PAYROLL') {
        const activeItems = await tx.payrollItem.findMany({
          where: {
            employeeId,
            disbursement: null,
          },
          include: {
            batch: true,
          }
        });

        for (const it of activeItems) {
          await tx.payrollItemAllocation.deleteMany({ where: { itemId: it.id } });
          await tx.payrollItem.delete({ where: { id: it.id } });

          // Recalculate batch totals
          const remainingItems = await tx.payrollItem.findMany({
            where: { batchId: it.batchId },
            select: { grossMinor: true, netMinor: true }
          });
          let totalG = BigInt(0);
          let totalN = BigInt(0);
          for (const rem of remainingItems) {
            totalG += rem.grossMinor;
            totalN += rem.netMinor;
          }
          await tx.payrollBatch.update({
            where: { id: it.batchId },
            data: { totalGrossMinor: totalG, totalNetMinor: totalN }
          });
        }
      }

      await tx.systemNotification.create({
        data: {
          employeeId,
          kind: 'PAYROLL_SALARY_CHANGED',
          title: 'Your salary has been updated',
          body: bodyText,
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
          metadata: JSON.stringify({ employeeName: employee.legalName, compensationId: compensation.id, changeType, targetAmountMinor: targetMinor.toString(), previousGrossMinor: prevGrossMinor.toString(), newGrossMinor: newGrossMinor.toString(), reason }),
        },
      });

      return { compensation, previousGrossMinor: prevGrossMinor, newGrossMinor };
    });

    return NextResponse.json({
      success: true,
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
