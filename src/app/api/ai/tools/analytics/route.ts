import { NextRequest, NextResponse } from 'next/server';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { prisma } from '@/lib/prisma';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { AuthenticatedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function handleAnalytics(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor) {
    return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
  }

  try {
    let orgId = 'ALL';
    let dataset = 'all';

    const url = new URL(req.url);
    orgId = url.searchParams.get('organization_id') || url.searchParams.get('subsidiaryId') || orgId;
    dataset = url.searchParams.get('dataset') || dataset;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.organization_id) orgId = String(body.organization_id);
        if (body?.subsidiaryId) orgId = String(body.subsidiaryId);
        if (body?.dataset) dataset = String(body.dataset);
      } catch {
        // Body is optional for POST
      }
    }

    if (actor.scopedOrganizationId) {
      orgId = actor.scopedOrganizationId;
    }

    const authEmp: AuthenticatedEmployee = {
      id: actor.id,
      legalName: actor.legalName,
      role: actor.role,
      workEmail: actor.workEmail,
      employeeNumber: 'AI-EXEC',
      phone: actor.phone || null,
      avatarUrl: null,
    };

    const scope = await resolveAuthorizedOrganizationScope(authEmp, orgId);
    if (scope.organizationIds.length === 0) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Outside authorized organization scope.' },
        { status: 403 }
      );
    }

    const subFilter = !scope.isGroup ? { subsidiaryId: { in: scope.organizationIds } } : {};
    const payerFilter = !scope.isGroup ? { payerOrgId: { in: scope.organizationIds } } : {};
    const orgFilter = !scope.isGroup ? { organizationId: { in: scope.organizationIds } } : {};

    const [requests, disbursements, budgets, cases] = await Promise.all([
      prisma.expenditureRequest.findMany({
        where: subFilter,
        select: { id: true, amountMinor: true, approvalStatus: true, category: true, createdAt: true },
      }),
      prisma.disbursement.findMany({
        where: payerFilter,
        select: { id: true, amountMinor: true, status: true, paidAt: true },
      }),
      prisma.budget.findMany({
        where: orgFilter,
        include: { lines: true },
      }),
      prisma.accountabilityCase.findMany({
        where: !scope.isGroup ? { request: { subsidiaryId: { in: scope.organizationIds } } } : undefined,
        select: { id: true, status: true, dueAt: true },
      }),
    ]);

    const totalRequestsSum = requests.reduce((s, r) => s + Number(r.amountMinor) / 100, 0);
    const totalDisbursedSum = disbursements.reduce((s, d) => s + Number(d.amountMinor) / 100, 0);
    const totalBudgetSum = budgets.reduce((s, b) => s + Number(b.totalAmount), 0);

    const groupedByCategory = requests.reduce((acc: Record<string, number>, r) => {
      const cat = r.category || 'General';
      acc[cat] = (acc[cat] || 0) + Number(r.amountMinor) / 100;
      return acc;
    }, {});

    const anomalies: any[] = [];
    const openOverdueCases = cases.filter((c) => c.status !== 'CLOSED' && new Date(c.dueAt) < new Date());
    if (openOverdueCases.length > 0) {
      anomalies.push({
        type: 'OVERDUE_ACCOUNTABILITY',
        severity: 'MEDIUM',
        message: `${openOverdueCases.length} cash advance cases have exceeded their retiral window.`,
      });
    }

    return NextResponse.json({
      ok: true,
      tool: 'get_financial_analytics',
      dataset,
      scope: {
        isGroup: scope.isGroup,
        targetOrganizationId: orgId,
        authorizedCount: scope.organizationIds.length,
      },
      totals: {
        requests_sum: totalRequestsSum,
        requests_count: requests.length,
        disbursed_sum: totalDisbursedSum,
        disbursed_count: disbursements.length,
        budget_allocated: totalBudgetSum,
      },
      grouped: groupedByCategory,
      variance_vs_budget:
        totalBudgetSum > 0 ? ((totalDisbursedSum / totalBudgetSum) * 100).toFixed(1) + '%' : '0%',
      anomalies,
      as_of: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleAnalytics(req);
}

export async function POST(req: NextRequest) {
  return handleAnalytics(req);
}
