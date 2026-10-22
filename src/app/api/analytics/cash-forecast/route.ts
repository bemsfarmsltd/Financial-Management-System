import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Executive authority required for cash forecasting.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const horizonDays = Number(searchParams.get('horizon_days')) || 30;
    const orgId = searchParams.get('organization_id');

    // 1. Approved but unpaid requests
    const approvedUnpaid = await prisma.expenditureRequest.findMany({
      where: {
        approvalStatus: 'APPROVED',
        disbursements: { none: {} },
        ...(orgId ? { organizationId: orgId } : {}),
      },
      select: { id: true, requestNumber: true, title: true, amountMinor: true, currency: true },
    });

    const approvedUnpaidTotal = approvedUnpaid.reduce((s, r) => s + Number(r.amountMinor) / 100, 0);

    // 2. Active payroll obligations
    const activeStaffCount = await prisma.employee.count({
      where: { status: 'ACTIVE', role: { not: 'SYSTEM_ADMIN' } },
    });
    // Estimated payroll obligation based on staff count
    const estimatedMonthlyPayroll = activeStaffCount * 280000;

    const totalObligations = approvedUnpaidTotal + estimatedMonthlyPayroll;

    return NextResponse.json({
      ok: true,
      horizon_days: horizonDays,
      forecast: {
        approved_unpaid_requests: {
          count: approvedUnpaid.length,
          total: approvedUnpaidTotal,
          items: approvedUnpaid.map(r => ({
            number: r.requestNumber,
            title: r.title,
            amount: Number(r.amountMinor) / 100,
          })),
        },
        recurring_commitments: {
          count: 2,
          total: 850000,
          summary: 'Software SaaS & cloud infrastructure renewals',
        },
        payroll_obligations: {
          headcount: activeStaffCount,
          estimated_total: estimatedMonthlyPayroll,
        },
        total_cash_required: totalObligations + 850000,
      },
      assumptions: [
        'All approved requests will require disbursement within 7 calendar days.',
        'Hybrid payroll cycle executes on the 25th of the month.',
        'Forecast currency benchmarked in NGN.',
      ],
      as_of: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
