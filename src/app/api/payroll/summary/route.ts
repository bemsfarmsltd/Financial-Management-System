import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Not permitted.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organization_id');

    const now = new Date();
    const [activeStaffCount, batches, orgs, activeCompAgreements] = await Promise.all([
      prisma.employee.count({ where: { status: 'ACTIVE', role: { not: 'SYSTEM_ADMIN' } } }),
      prisma.payrollBatch.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.findMany({ where: { status: 'ACTIVE' } }),
      prisma.compensationAgreement.findMany({
        where: {
          employmentAgreement: {
            status: 'ACTIVE',
            employee: { status: 'ACTIVE', role: { not: 'SYSTEM_ADMIN' } },
          },
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        select: {
          grossMinor: true,
          costAllocations: {
            select: { subsidiaryId: true, percentage: true },
          },
          employmentAgreement: {
            select: {
              employerEntityId: true,
              employee: {
                select: {
                  assignments: {
                    where: { status: 'ACTIVE' },
                    orderBy: { isPrimary: 'desc' },
                    take: 1,
                    select: { subsidiaryId: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const latestBatch = batches[0];
    const totalContractSalaries = activeCompAgreements.reduce((sum, c) => sum + Number(c.grossMinor) / 100, 0);
    const totalMonthlyRunRate = latestBatch
      ? Number(latestBatch.totalGrossMinor) / 100
      : totalContractSalaries;

    // Calculate real subsidiary allocation breakdown based on cost allocations and employee assignments
    const subCostMap = new Map<string, number>();
    orgs.forEach(o => subCostMap.set(o.id, 0));

    let totalAllocatedMinor = 0;
    for (const c of activeCompAgreements) {
      const gross = Number(c.grossMinor);
      if (c.costAllocations && c.costAllocations.length > 0) {
        for (const alloc of c.costAllocations) {
          const portion = gross * (alloc.percentage / 100);
          subCostMap.set(alloc.subsidiaryId, (subCostMap.get(alloc.subsidiaryId) || 0) + portion);
          totalAllocatedMinor += portion;
        }
      } else {
        const fallbackSubId = c.employmentAgreement?.employee?.assignments?.[0]?.subsidiaryId || c.employmentAgreement?.employerEntityId;
        if (fallbackSubId) {
          subCostMap.set(fallbackSubId, (subCostMap.get(fallbackSubId) || 0) + gross);
          totalAllocatedMinor += gross;
        }
      }
    }

    const subsidiaryAllocations = orgs.map(o => {
      const orgMinor = subCostMap.get(o.id) || 0;
      const pct = totalAllocatedMinor > 0 ? Math.round((orgMinor / totalAllocatedMinor) * 100) : 0;
      return {
        subsidiary: o.legalName,
        code: o.code,
        share_percent: `${pct}%`,
        allocated_amount: orgMinor / 100,
        allocated_amount_formatted: `₦${(orgMinor / 100).toLocaleString()}`,
      };
    });

    return NextResponse.json({
      ok: true,
      summary: {
        total_monthly_run_rate: totalMonthlyRunRate,
        total_monthly_formatted: `₦${totalMonthlyRunRate.toLocaleString()}`,
        active_headcount: activeStaffCount,
        latest_batch_period: latestBatch ? 'Current Cycle' : (totalContractSalaries > 0 ? 'Active Contracts Sum' : 'No Batch Prepared'),
        payment_status: latestBatch ? latestBatch.status : (totalContractSalaries > 0 ? 'SCHEDULED' : 'PENDING_REGISTRATION'),
        upcoming_deadlines: '25th of the month (Statutory Tax & Pension Remittance)',
        subsidiary_allocations: subsidiaryAllocations,
        issues: [],
      },
      as_of: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
