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

    const [activeStaffCount, batches, orgs] = await Promise.all([
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.payrollBatch.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.findMany({ where: { status: 'ACTIVE' } }),
    ]);

    const latestBatch = batches[0];
    const estimatedRunRate = activeStaffCount * 280000;

    return NextResponse.json({
      ok: true,
      summary: {
        total_monthly_run_rate: latestBatch ? Number(latestBatch.totalGrossMinor) / 100 : estimatedRunRate,
        total_monthly_formatted: `₦${(latestBatch ? Number(latestBatch.totalGrossMinor) / 100 : estimatedRunRate).toLocaleString()}`,
        active_headcount: activeStaffCount,
        latest_batch_period: latestBatch ? 'Current Cycle' : 'Open Registration',
        payment_status: latestBatch ? latestBatch.status : 'SCHEDULED',
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
