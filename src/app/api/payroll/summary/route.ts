import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'FINANCE_CONTROLLER', 'ACCOUNTANT'])) {
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
        select: { grossMinor: true },
      }),
    ]);

    const latestBatch = batches[0];
    const totalContractSalaries = activeCompAgreements.reduce((sum, c) => sum + Number(c.grossMinor) / 100, 0);
    const totalMonthlyRunRate = latestBatch
      ? Number(latestBatch.totalGrossMinor) / 100
      : totalContractSalaries;

    return NextResponse.json({
      ok: true,
      summary: {
        total_monthly_run_rate: totalMonthlyRunRate,
        total_monthly_formatted: `₦${totalMonthlyRunRate.toLocaleString()}`,
        active_headcount: activeStaffCount,
        latest_batch_period: latestBatch ? 'Current Cycle' : (totalContractSalaries > 0 ? 'Active Contracts Sum' : 'No Batch Prepared'),
        payment_status: latestBatch ? latestBatch.status : (totalContractSalaries > 0 ? 'SCHEDULED' : 'PENDING_REGISTRATION'),
        upcoming_deadlines: '25th of the month (Statutory Tax & Pension Remittance)',
        subsidiary_allocations: orgs.map(o => ({
          subsidiary: o.legalName,
          code: o.code,
          share_percent: `${Math.round(100 / (orgs.length || 1))}%`,
        })),
        issues: [],
      },
      as_of: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
