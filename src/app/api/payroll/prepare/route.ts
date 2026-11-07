import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, getHrAuthorizationScope, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to prepare payroll.' }, { status: 401 });
    const hrScope = await getHrAuthorizationScope(actor);
    const isAuthorized = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']) || hrScope.authorized;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'HR or Executive authority (GMD or Super Admin) required to prepare payroll.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const year = Number.isInteger(Number(body?.year)) && Number(body.year) >= 2020 ? Number(body.year) : now.getFullYear();
    const month = Number.isInteger(Number(body?.month)) && Number(body.month) >= 1 && Number(body.month) <= 12
      ? Number(body.month)
      : now.getMonth() + 1;

    // 1. Get or create target PayrollPeriod
    let period = await prisma.payrollPeriod.findFirst({
      where: { year, month },
      include: {
        batches: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          include: { items: { include: { disbursement: true } } },
        },
      },
    });

    const allSubsidiaries = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
    });
    const hqOrg = allSubsidiaries.find((o) => o.type === 'GROUP' || o.code === 'BEMS-GROUP') || allSubsidiaries[0];
    const defaultSubId = hqOrg?.id || 'bems-group-hq';

    if (!period) {
      const startsOn = new Date(year, month - 1, 1);
      const endsOn = new Date(year, month, 0, 23, 59, 59);

      period = await prisma.payrollPeriod.create({
        data: {
          groupId: defaultSubId,
          year,
          month,
          startsOn,
          endsOn,
          lockStatus: 'OPEN',
        },
        include: {
          batches: {
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
            include: { items: { include: { disbursement: true } } },
          },
        },
      });
    }

    // 2. Fetch all active approved staff with their latest compensation & cost allocations
    const activeStaff = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        role: 'STAFF',
      },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: { isPrimary: 'desc' },
        },
        employmentAgreements: {
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          include: {
            compensations: {
              orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
              include: { costAllocations: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (activeStaff.length === 0) {
      return NextResponse.json({ error: 'No active staff profiles found to prepare payroll.' }, { status: 400 });
    }

    // Filter to staff who have an active EmploymentAgreement & CompensationAgreement (> 0)
    const eligibleStaff = activeStaff.filter((s) => {
      const agreement = s.employmentAgreements[0];
      const comp = agreement?.compensations[0];
      return Boolean(agreement && comp && Number(comp.grossMinor) > 0);
    });
    const skippedCount = activeStaff.length - eligibleStaff.length;

    if (eligibleStaff.length === 0) {
      return NextResponse.json(
        { error: 'No active staff members have a configured salary yet. Configure staff compensation first.' },
        { status: 400 }
      );
    }

    // 3. Check if a batch already exists for this period
    const existingBatch = period.batches[0];
    const isRegeneration = Boolean(existingBatch);

    if (existingBatch) {
      const hasPaidItems = existingBatch.items.some((item) => Boolean(item.disbursement));
      if (hasPaidItems) {
        return NextResponse.json(
          { error: 'Cannot regenerate this payroll batch because salary disbursements have already been recorded for one or more staff.' },
          { status: 409 }
        );
      }
    }

    const periodId = period.id;
    const periodLockStatus = period.lockStatus;

    // 4. Atomically regenerate or create Payroll Batch, Items, and Intercompany Allocations inside a single transaction
    const { batchId, nextVersion } = await prisma.$transaction(async (tx) => {
      let targetBatchId: string;
      let targetVersion: number;
      let targetPaymentEntityId: string | null = null;

      if (existingBatch) {
        targetBatchId = existingBatch.id;
        targetVersion = existingBatch.version + 1;
        targetPaymentEntityId = existingBatch.paymentEntityId;

        await tx.payrollItemAllocation.deleteMany({
          where: { item: { batchId: targetBatchId } },
        });
        await tx.payrollItem.deleteMany({
          where: { batchId: targetBatchId },
        });

        if (periodLockStatus === 'LOCKED') {
          await tx.payrollPeriod.update({
            where: { id: periodId },
            data: { lockStatus: 'OPEN' },
          });
        }
      } else {
        const createdBatch = await tx.payrollBatch.create({
          data: {
            periodId,
            version: 1,
            status: 'SUBMITTED',
            totalGrossMinor: BigInt(0),
            totalNetMinor: BigInt(0),
          },
        });
        targetBatchId = createdBatch.id;
        targetVersion = 1;
      }

      let totalGross = BigInt(0);
      let totalNet = BigInt(0);

      for (const staff of eligibleStaff) {
        const agreement = staff.employmentAgreements[0];
        const comp = agreement.compensations[0];
        const grossMinor = comp.grossMinor;
        const grossNum = Number(grossMinor);

        const item = await tx.payrollItem.create({
          data: {
            batchId: targetBatchId,
            employeeId: staff.id,
            agreementId: agreement.id,
            grossMinor,
            employeeDeductionsMinor: BigInt(0),
            employerCostMinor: BigInt(0),
            netMinor: grossMinor,
            currency: comp.currency || 'NGN',
            status: 'CALCULATED',
          },
        });

        totalGross += grossMinor;
        totalNet += grossMinor;

        const allocations = comp.costAllocations || [];
        if (allocations.length > 0) {
          for (const alloc of allocations) {
            const allocCost = BigInt(Math.round(grossNum * (alloc.percentage / 100)));
            await tx.payrollItemAllocation.create({
              data: {
                itemId: item.id,
                subsidiaryId: alloc.subsidiaryId,
                allocableCostMinor: allocCost,
                percentage: alloc.percentage,
              },
            });
          }
        } else {
          const subId = staff.assignments[0]?.subsidiaryId || agreement.employerEntityId || defaultSubId;
          await tx.payrollItemAllocation.create({
            data: {
              itemId: item.id,
              subsidiaryId: subId,
              allocableCostMinor: grossMinor,
              percentage: 100,
            },
          });
        }
      }

      await tx.payrollBatch.update({
        where: { id: targetBatchId },
        data: {
          version: targetVersion,
          status: 'SUBMITTED',
          approvedAt: null,
          snapshotHash: null,
          paymentEntityId: targetPaymentEntityId || defaultSubId,
          submittedById: actor.id,
          submittedByName: actor.legalName,
          totalGrossMinor: totalGross,
          totalNetMinor: totalNet,
        },
      });

      return { batchId: targetBatchId, nextVersion: targetVersion };
    });

    const skippedNotice = skippedCount > 0 ? ` (${skippedCount} staff skipped with no salary set yet)` : '';
    return NextResponse.json({
      success: true,
      message: `Payroll batch (Version ${nextVersion}) ${isRegeneration ? 'regenerated' : 'prepared'} for ${eligibleStaff.length} staff members${skippedNotice}.`,
      batchId,
      version: nextVersion,
      employeeCount: eligibleStaff.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to prepare payroll batch';
    console.error('Error preparing payroll batch:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
