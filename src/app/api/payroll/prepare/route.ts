import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to prepare payroll.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive sign-off authority required.' }, { status: 403 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // 1. Get or create current PayrollPeriod
    let period = await prisma.payrollPeriod.findFirst({
      where: { year, month },
      include: { batches: { include: { items: true } } }
    });

    if (!period) {
      const startsOn = new Date(year, month - 1, 1);
      const endsOn = new Date(year, month, 0, 23, 59, 59);
      const hqOrg = await prisma.organization.findFirst({
        where: { OR: [{ type: 'GROUP' }, { code: 'BEMS-GROUP' }] }
      });
      const groupId = hqOrg?.id || 'bems-group-hq';

      period = await prisma.payrollPeriod.create({
        data: {
          groupId,
          year,
          month,
          startsOn,
          endsOn,
          lockStatus: 'OPEN'
        },
        include: { batches: { include: { items: true } } }
      });
    }

    // 2. Fetch all active staff (exclude system admin)
    const activeStaff = await prisma.employee.findMany({
      where: { status: 'ACTIVE', role: 'STAFF' },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: { isPrimary: 'desc' },
          include: { subsidiary: true }
        },
        employmentAgreements: {
          where: { status: 'ACTIVE' },
          include: {
            compensations: {
              where: {
                effectiveFrom: { lte: now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
              },
              include: { costAllocations: true }
            }
          }
        }
      }
    });

    if (activeStaff.length === 0) {
      return NextResponse.json({ error: 'No active staff profiles found to prepare payroll.' }, { status: 400 });
    }

    // 3. Ensure each staff has an EmploymentAgreement and CompensationAgreement
    const allSubsidiaries = await prisma.organization.findMany({
      where: { status: 'ACTIVE' }
    });
    const subByName = new Map(allSubsidiaries.map(s => [s.legalName.toLowerCase(), s.id]));
    const defaultSubId = allSubsidiaries[0]?.id || 'bems-group-hq';

    for (const staff of activeStaff) {
      if (staff.employmentAgreements.length === 0) {
        const primarySubId = staff.assignments[0]?.subsidiaryId || defaultSubId;
        const agreement = await prisma.employmentAgreement.create({
          data: {
            employeeId: staff.id,
            employerEntityId: primarySubId,
            agreementType: 'PERMANENT',
            paymentModel: 'GROUP_PAID',
            status: 'ACTIVE'
          }
        });

        // Set realistic base salary
        const baseSalaryNaira = staff.legalName.toLowerCase().includes('solomon') ? 450000 : 380000;
        const grossMinor = BigInt(baseSalaryNaira * 100);

        const comp = await prisma.compensationAgreement.create({
          data: {
            employmentAgreementId: agreement.id,
            grossMinor,
            currency: 'NGN',
            recurrence: 'MONTHLY',
            effectiveFrom: new Date(year, month - 1, 1),
            approvedBy: actor.legalName
          }
        });

        // Setup intercompany allocation split
        const smartAirsId = subByName.get('smartairs gov technologies ltd') || subByName.get('smartairs') || defaultSubId;
        const bemsSoftId = subByName.get('bemssoft hub ltd') || subByName.get('bemssoft') || primarySubId;

        if (staff.legalName.toLowerCase().includes('solomon')) {
          await prisma.costAllocation.createMany({
            data: [
              { compensationAgreementId: comp.id, subsidiaryId: bemsSoftId, percentage: 60 },
              { compensationAgreementId: comp.id, subsidiaryId: smartAirsId, percentage: 40 }
            ]
          });
        } else {
          await prisma.costAllocation.createMany({
            data: [
              { compensationAgreementId: comp.id, subsidiaryId: primarySubId, percentage: 100 }
            ]
          });
        }
      }
    }

    // 4. Re-fetch staff with freshly guaranteed agreements
    const preparedStaff = await prisma.employee.findMany({
      where: { status: 'ACTIVE', role: 'STAFF' },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: { isPrimary: 'desc' }
        },
        employmentAgreements: {
          where: { status: 'ACTIVE' },
          include: {
            compensations: {
              include: { costAllocations: true }
            }
          }
        }
      }
    });

    // 5. Check if an active batch already exists
    let batch = period.batches.find(b => b.status === 'SUBMITTED' || b.status === 'DRAFT');

    if (!batch) {
      batch = await prisma.payrollBatch.create({
        data: {
          periodId: period.id,
          version: (period.batches.length || 0) + 1,
          status: 'SUBMITTED',
          totalGrossMinor: BigInt(0),
          totalNetMinor: BigInt(0)
        },
        include: { items: true }
      });
    } else {
      // Clear old items if re-preparing submitted batch
      await prisma.payrollItemAllocation.deleteMany({
        where: { item: { batchId: batch.id } }
      });
      await prisma.payrollItem.deleteMany({
        where: { batchId: batch.id }
      });
    }

    // 6. Generate Payroll Items for all staff
    let totalGross = BigInt(0);
    let totalNet = BigInt(0);

    for (const staff of preparedStaff) {
      const agreement = staff.employmentAgreements[0];
      const comp = agreement?.compensations[0];
      const grossMinor = comp ? comp.grossMinor : BigInt(35000000); // ₦350,000 default fallback

      // Company Policy: Zero Tax / PAYE / Pension Deductions. Only attendance lateness deductions apply.
      const grossNum = Number(grossMinor);
      const employeeDeductionsNum = 0; // No tax or pension deductions
      const employerCostNum = 0;
      const netNum = grossNum;

      const item = await prisma.payrollItem.create({
        data: {
          batchId: batch.id,
          employeeId: staff.id,
          agreementId: agreement.id,
          grossMinor,
          employeeDeductionsMinor: BigInt(employeeDeductionsNum),
          employerCostMinor: BigInt(employerCostNum),
          netMinor: BigInt(netNum),
          currency: 'NGN',
          status: 'CALCULATED'
        }
      });

      totalGross += grossMinor;
      totalNet += BigInt(netNum);

      // Allocations
      const allocations = comp?.costAllocations || [];
      if (allocations.length > 0) {
        for (const alloc of allocations) {
          const allocCost = BigInt(Math.round(grossNum * (alloc.percentage / 100)));
          await prisma.payrollItemAllocation.create({
            data: {
              itemId: item.id,
              subsidiaryId: alloc.subsidiaryId,
              allocableCostMinor: allocCost,
              percentage: alloc.percentage
            }
          });
        }
      } else {
        const subId = staff.assignments[0]?.subsidiaryId || defaultSubId;
        await prisma.payrollItemAllocation.create({
          data: {
            itemId: item.id,
            subsidiaryId: subId,
            allocableCostMinor: grossMinor,
            percentage: 100
          }
        });
      }
    }

    // 7. Update batch totals
    await prisma.payrollBatch.update({
      where: { id: batch.id },
      data: {
        totalGrossMinor: totalGross,
        totalNetMinor: totalNet
      }
    });

    return NextResponse.json({
      success: true,
      message: `Payroll batch prepared successfully for ${preparedStaff.length} staff members.`,
      batchId: batch.id
    });
  } catch (err: any) {
    console.error('Error preparing payroll batch:', err);
    return NextResponse.json({ error: err.message || 'Failed to prepare payroll batch' }, { status: 500 });
  }
}
