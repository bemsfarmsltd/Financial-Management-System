import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Executive authority required for financial analytics.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dataset = searchParams.get('dataset') || 'requests';
    const orgId = searchParams.get('organization_id');

    // Aggregate real metrics based on dataset
    const [requests, disbursements, budgets, cases] = await Promise.all([
      prisma.expenditureRequest.findMany({
        where: orgId ? { organizationId: orgId } : undefined,
        select: { id: true, amountMinor: true, approvalStatus: true, category: true, createdAt: true },
      }),
      prisma.disbursement.findMany({
        where: orgId ? { payerOrgId: orgId } : undefined,
        select: { id: true, amountMinor: true, status: true, paidAt: true },
      }),
      prisma.budget.findMany({
        where: orgId ? { organizationId: orgId } : undefined,
        include: { lines: true },
      }),
      prisma.accountabilityCase.findMany({
        where: orgId ? { request: { organizationId: orgId } } : undefined,
        select: { id: true, status: true, dueAt: true },
      }),
    ]);

    const totalRequestsSum = requests.reduce((s, r) => s + Number(r.amountMinor) / 100, 0);
    const totalDisbursedSum = disbursements.reduce((s, d) => s + Number(d.amountMinor) / 100, 0);
    const totalBudgetSum = budgets.reduce((s, b) => s + Number(b.totalAmount), 0);

    // Grouping
    const groupedByCategory = requests.reduce((acc: Record<string, number>, r) => {
      const cat = r.category || 'General';
      acc[cat] = (acc[cat] || 0) + Number(r.amountMinor) / 100;
      return acc;
    }, {});

    // Anomaly flags
    const anomalies: any[] = [];
    const openOverdueCases = cases.filter(c => c.status !== 'CLOSED' && new Date(c.dueAt) < new Date());
    if (openOverdueCases.length > 0) {
      anomalies.push({
        type: 'OVERDUE_ACCOUNTABILITY',
        severity: 'MEDIUM',
        message: `${openOverdueCases.length} cash advance cases have exceeded their retiral window.`,
      });
    }

    return NextResponse.json({
      ok: true,
      dataset,
      totals: {
        requests_sum: totalRequestsSum,
        requests_count: requests.length,
        disbursed_sum: totalDisbursedSum,
        disbursed_count: disbursements.length,
        budget_allocated: totalBudgetSum,
      },
      grouped: groupedByCategory,
      variance_vs_budget: totalBudgetSum > 0 ? ((totalDisbursedSum / totalBudgetSum) * 100).toFixed(1) + '%' : '0%',
      anomalies,
      as_of: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
