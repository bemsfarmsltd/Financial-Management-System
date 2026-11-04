import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number): string {
  const naira = Number(minor) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(naira);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to modify payroll items.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access (GMD or Super Admin) required.' }, { status: 403 });
    }

    const { itemId } = await params;
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'PERMANENT' ? 'PERMANENT' : 'BATCH_ONLY';
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Removed from payroll run';

    const item = await prisma.payrollItem.findUnique({
      where: { id: itemId },
      include: {
        batch: {
          include: { period: true }
        },
        employee: {
          select: { id: true, legalName: true, workEmail: true }
        },
        disbursement: true,
      }
    });

    if (!item) {
      return NextResponse.json({ error: 'Payroll record not found.' }, { status: 404 });
    }

    // Guard: Cannot remove if payment has already been recorded
    if (item.disbursement && item.disbursement.status !== 'UNPAID') {
      return NextResponse.json({
        error: 'Cannot remove this staff member because salary disbursement has already been recorded for them.'
      }, { status: 409 });
    }

    const batchId = item.batchId;
    const employeeId = item.employeeId;
    const staffName = item.employee.legalName;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Delete disbursement record if exists and unpaid
      if (item.disbursement) {
        await tx.disbursement.delete({ where: { id: item.disbursement.id } });
      }

      // 2. Delete item cost allocations
      await tx.payrollItemAllocation.deleteMany({
        where: { itemId }
      });

      // 3. Delete the payroll item itself
      await tx.payrollItem.delete({
        where: { id: itemId }
      });

      // 4. If mode is PERMANENT, stop recurring salary (set grossMinor to 0)
      if (mode === 'PERMANENT') {
        const agreement = await tx.employmentAgreement.findFirst({
          where: { employeeId, status: 'ACTIVE' },
          orderBy: { startDate: 'desc' }
        });

        if (agreement) {
          const activeSalary = await tx.compensationAgreement.findFirst({
            where: {
              employmentAgreementId: agreement.id,
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
            },
            orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
          });

          if (activeSalary) {
            await tx.compensationAgreement.update({
              where: { id: activeSalary.id },
              data: { effectiveTo: new Date(now.getTime() - 1) }
            });
          }

          const prior = await tx.compensationAgreement.findMany({
            where: { employmentAgreementId: agreement.id },
            select: { version: true }
          });
          const nextVersion = Math.max(0, ...prior.map(c => c.version)) + 1;

          await tx.compensationAgreement.create({
            data: {
              employmentAgreementId: agreement.id,
              grossMinor: BigInt(0),
              currency: activeSalary?.currency || 'NGN',
              recurrence: activeSalary?.recurrence || 'MONTHLY',
              effectiveFrom: now,
              version: nextVersion,
              approvedBy: actor.id,
              changeType: 'REMOVED_FROM_PAYROLL',
              changeReason: reason,
            }
          });
        }

        // Cancel any pending proposals
        await tx.salaryChangeProposal.updateMany({
          where: { employeeId, status: 'PENDING_APPROVAL' },
          data: {
            status: 'CANCELLED',
            decisionNote: `Staff removed from salary payroll by ${actor.legalName}. Reason: ${reason}`,
            decidedById: actor.id,
            decidedByName: actor.legalName,
            decidedAt: now,
          }
        });
      }

      // 5. Recalculate batch totals
      const remainingItems = await tx.payrollItem.findMany({
        where: { batchId },
        select: { grossMinor: true, netMinor: true }
      });

      let newTotalGross = BigInt(0);
      let newTotalNet = BigInt(0);
      for (const r of remainingItems) {
        newTotalGross += r.grossMinor;
        newTotalNet += r.netMinor;
      }

      await tx.payrollBatch.update({
        where: { id: batchId },
        data: {
          totalGrossMinor: newTotalGross,
          totalNetMinor: newTotalNet,
        }
      });

      // 6. Audit Event
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: 'BEMS-GROUP',
          targetType: 'PAYROLL',
          targetId: itemId,
          action: 'STAFF_REMOVED_FROM_PAYROLL',
          correlationId: `CORR-REM-PAY-${randomUUID()}`,
          metadata: JSON.stringify({
            employeeId,
            staffName,
            batchId,
            mode,
            reason,
            itemGrossMinor: item.grossMinor.toString(),
            itemNetMinor: item.netMinor.toString(),
          })
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: mode === 'PERMANENT'
        ? `${staffName} was removed from this payroll run and their recurring salary was stopped.`
        : `${staffName} was removed from this payroll run.`,
      employeeId,
      batchId,
      mode
    });
  } catch (error: any) {
    console.error('Error removing payroll item:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove staff from payroll' }, { status: 500 });
  }
}
