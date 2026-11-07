import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Executive authority required for cash forecasting.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const horizonDays = Math.min(365, Math.max(1, Number(searchParams.get('horizon_days')) || 30));
    const orgId = searchParams.get('organization_id') || searchParams.get('subsidiaryId') || 'ALL';

    const scope = await resolveAuthorizedOrganizationScope(actor, orgId);
    if (scope.organizationIds.length === 0) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Outside authorized organization scope.' }, { status: 403 });
    }

    const subFilter = !scope.isGroup ? { subsidiaryId: { in: scope.organizationIds } } : {};

    // 1. Approved but unpaid requests from live PostgreSQL ledger
    const approvedUnpaid = await prisma.expenditureRequest.findMany({
      where: {
        approvalStatus: 'APPROVED',
        disbursements: { none: {} },
        ...subFilter,
      },
      select: { id: true, requestNumber: true, title: true, amountMinor: true, currency: true },
    });

    const approvedUnpaidTotal = approvedUnpaid.reduce((s, r) => s + Number(r.amountMinor) / 100, 0);

    // 2. Live recurring obligations from ExpenditureRequest (isRecurring: true)
    const recurringCommitments = await prisma.expenditureRequest.findMany({
      where: {
        isRecurring: true,
        approvalStatus: { not: 'REJECTED' },
        ...subFilter,
      },
      select: { id: true, title: true, amountMinor: true, recurringInterval: true },
    });
    const recurringTotal = recurringCommitments.reduce((s, t) => s + Number(t.amountMinor) / 100, 0);

    // 3. Live active payroll obligations from CompensationAgreement / EmploymentAgreement
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
      source: 'LIVE_LEDGER',
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
          count: recurringCommitments.length,
          total: recurringTotal,
          summary: recurringCommitments.length > 0
            ? recurringCommitments.map(t => t.title).slice(0, 5).join(', ')
            : 'No active recurring commitments configured in ledger',
        },
        payroll_obligations: {
          headcount: activeAgreements.length,
          estimated_total: configuredMonthlyPayroll,
        },
        total_cash_required: totalCashRequired,
      },
      assumptions: [
        'All approved unpaid requests are sourced from live ExpenditureRequest records.',
        'Payroll obligations are aggregated from active EmploymentAgreement and CompensationAgreement records.',
        'Recurring commitments are aggregated from live ExpenditureRequest (isRecurring: true) records.',
      ],
      as_of: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
