import { NextRequest, NextResponse } from 'next/server';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { prisma } from '@/lib/prisma';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { AuthenticatedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function handleForecast(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor) {
    return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
  }

  try {
    let orgId = 'ALL';
    let horizonDays = 30;

    const url = new URL(req.url);
    orgId = url.searchParams.get('organization_id') || url.searchParams.get('subsidiaryId') || orgId;
    if (url.searchParams.has('horizon_days')) {
      horizonDays = Math.min(365, Math.max(1, Number(url.searchParams.get('horizon_days')) || 30));
    }

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.organization_id) orgId = String(body.organization_id);
        if (body?.subsidiaryId) orgId = String(body.subsidiaryId);
        if (body?.horizon_days) {
          horizonDays = Math.min(365, Math.max(1, Number(body.horizon_days) || 30));
        }
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

    // 1. Approved but unpaid requests from live ledger
    const approvedUnpaid = await prisma.expenditureRequest.findMany({
      where: {
        approvalStatus: 'APPROVED',
        disbursements: { none: {} },
        ...subFilter,
      },
      select: { id: true, requestNumber: true, title: true, amountMinor: true, currency: true },
    });
    const approvedUnpaidTotal = approvedUnpaid.reduce((s, r) => s + Number(r.amountMinor) / 100, 0);

    // 2. Live recurring obligations from ExpenditureRequest
    const recurringCommitments = await prisma.expenditureRequest.findMany({
      where: {
        isRecurring: true,
        approvalStatus: { not: 'REJECTED' },
        ...subFilter,
      },
      select: { id: true, title: true, amountMinor: true, recurringInterval: true },
    });
    const recurringTotal = recurringCommitments.reduce((s, t) => s + Number(t.amountMinor) / 100, 0);

    // 3. Live active payroll obligations from EmploymentAgreement
    const activeAgreements = await prisma.employmentAgreement.findMany({
      where: {
        status: 'ACTIVE',
        employee: { status: 'ACTIVE', role: 'STAFF' },
        ...(!scope.isGroup ? { employerEntityId: { in: scope.organizationIds } } : {}),
      },
      include: {
        compensations: {
          orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
          take: 1,
        },
      },
    });

    const configuredMonthlyPayroll = activeAgreements.reduce((sum, ag) => {
      const latestComp = ag.compensations[0];
      return sum + (latestComp ? Number(latestComp.grossMinor) / 100 : 0);
    }, 0);

    const totalCashRequired = approvedUnpaidTotal + recurringTotal + configuredMonthlyPayroll;

    return NextResponse.json({
      ok: true,
      tool: 'get_cash_forecast',
      source: 'LIVE_LEDGER',
      horizon_days: horizonDays,
      scope: {
        isGroup: scope.isGroup,
        targetOrganizationId: orgId,
        authorizedCount: scope.organizationIds.length,
      },
      forecast: {
        approved_unpaid_requests: {
          count: approvedUnpaid.length,
          total: approvedUnpaidTotal,
          items: approvedUnpaid.slice(0, 10).map((r) => ({
            number: r.requestNumber,
            title: r.title,
            amount: Number(r.amountMinor) / 100,
            currency: r.currency,
          })),
        },
        recurring_commitments: {
          count: recurringCommitments.length,
          total: recurringTotal,
          items: recurringCommitments.slice(0, 10).map((c) => ({
            title: c.title,
            amount: Number(c.amountMinor) / 100,
            interval: c.recurringInterval,
          })),
        },
        payroll_obligations: {
          headcount: activeAgreements.length,
          estimated_total: configuredMonthlyPayroll,
        },
        total_cash_required: totalCashRequired,
      },
      as_of: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleForecast(req);
}

export async function POST(req: NextRequest) {
  return handleForecast(req);
}
