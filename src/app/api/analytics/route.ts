import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

const pendingStatuses = ['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'];
const unpaidStatuses = ['UNPAID'];

function periodBounds(period: string, now: Date) {
  const end = new Date(now);
  const start = new Date(now);
  if (period === '30d') start.setUTCDate(start.getUTCDate() - 29);
  else if (period === '90d') start.setUTCDate(start.getUTCDate() - 89);
  else if (period === 'ytd') { start.setUTCMonth(0, 1); start.setUTCHours(0, 0, 0, 0); }
  else { start.setUTCMonth(start.getUTCMonth() - 11, 1); start.setUTCHours(0, 0, 0, 0); }
  const duration = end.getTime() - start.getTime();
  return { start, end, previousStart: new Date(start.getTime() - duration), previousEnd: start };
}

function bucketKey(date: Date, granularity: 'day' | 'week' | 'month') {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (granularity === 'month') return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
  if (granularity === 'week') {
    const day = (value.getUTCDay() + 6) % 7;
    value.setUTCDate(value.getUTCDate() - day);
  }
  return value.toISOString().slice(0, 10);
}

function bucketLabel(key: string, granularity: 'day' | 'week' | 'month') {
  const date = new Date(`${key}${granularity === 'month' ? '-01' : ''}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-NG', granularity === 'month' ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
}

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to view group analytics.' }, { status: 401 });
  const isStaff = actor.role === 'STAFF';

  const { searchParams } = new URL(request.url);
  const period = ['30d', '90d', '12m', 'ytd'].includes(searchParams.get('period') || '') ? searchParams.get('period')! : '12m';
  const rawSubsidiary = searchParams.get('subsidiaryId') || searchParams.get('subsidiary') || 'ALL';
  const category = searchParams.get('category') || 'ALL';
  const status = searchParams.get('status') || 'ALL';
  const now = new Date();
  const { start, end, previousStart, previousEnd } = periodBounds(period, now);

  const { resolveOrganizationScope } = await import('@/lib/organizations');
  const scope = await resolveOrganizationScope(rawSubsidiary);
  const subsidiaryFilter = scope.isGroup ? {} : { subsidiaryId: { in: scope.organizationIds } };
  const staffFilter = isStaff ? { requestedById: actor.id } : {};
  const requestFilters = { ...subsidiaryFilter, ...staffFilter, ...(category === 'ALL' ? {} : { category }), ...(status === 'ALL' ? {} : { approvalStatus: status }) };
  const requestWhere = (from: Date, to: Date) => ({ ...requestFilters, createdAt: { gte: from, lt: to } });
  const paymentWhere = (from: Date, to: Date) => ({
    requestId: { not: null },
    paidAt: { gte: from, lt: to },
    request: {
      ...subsidiaryFilter,
      ...staffFilter,
      ...(category === 'ALL' ? {} : { category }),
      ...(status === 'ALL' ? {} : { approvalStatus: status })
    }
  });

  const [requests, previousRequests, disbursements, previousDisbursements, upcomingUnpaid, recentPayments, availableSubsidiaries, availableCategories] = await Promise.all([
    prisma.expenditureRequest.findMany({
      where: requestWhere(start, end),
      select: {
        id: true, requestNumber: true, title: true, amountMinor: true, currency: true, category: true,
        approvalStatus: true, paymentStatus: true, accountabilityStatus: true, createdAt: true, neededBy: true,
        subsidiary: { select: { id: true, legalName: true } },
        vendor: { select: { id: true, name: true } },
        approvalSteps: { select: { status: true, createdAt: true, decidedAt: true } },
        accountabilityCase: { select: { status: true, dueAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expenditureRequest.findMany({ where: requestWhere(previousStart, previousEnd), select: { amountMinor: true, approvalStatus: true } }),
    prisma.disbursement.findMany({ where: paymentWhere(start, end), select: { amountMinor: true, status: true, paidAt: true } }),
    prisma.disbursement.findMany({ where: paymentWhere(previousStart, previousEnd), select: { amountMinor: true } }),
    prisma.expenditureRequest.findMany({
      where: { ...subsidiaryFilter, ...(category === 'ALL' ? {} : { category }), ...(status === 'ALL' || status === 'APPROVED' ? { approvalStatus: 'APPROVED' } : { id: { in: [] } }), paymentStatus: { in: unpaidStatuses }, neededBy: { gte: now, lt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
      select: { id: true, amountMinor: true },
    }),
    prisma.disbursement.findMany({
      where: {
        requestId: { not: null },
        paidAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1)), lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) },
        request: {
          ...subsidiaryFilter,
          ...staffFilter,
          ...(category === 'ALL' ? {} : { category }),
          ...(status === 'ALL' ? {} : { approvalStatus: status })
        }
      },
      select: { amountMinor: true },
    }),
    prisma.organization.findMany({ where: { type: 'SUBSIDIARY', status: 'ACTIVE' }, select: { id: true, legalName: true }, orderBy: { legalName: 'asc' } }),
    prisma.expenditureRequest.findMany({ where: subsidiaryFilter, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
  ]);

  const sum = (rows: { amountMinor: bigint }[]) => rows.reduce((total, row) => total + Number(row.amountMinor), 0);
  const requestedMinor = sum(requests);
  const previousRequestedMinor = sum(previousRequests);
  const paidMinor = sum(disbursements);
  const previousPaidMinor = sum(previousDisbursements);
  const pending = requests.filter(row => pendingStatuses.includes(row.approvalStatus));
  const approved = requests.filter(row => row.approvalStatus === 'APPROVED');
  const approvedUnpaid = approved.filter(row => row.paymentStatus === 'UNPAID');
  const completedSteps = requests.flatMap(row => row.approvalSteps.filter(step => step.status === 'APPROVED' && step.decidedAt).map(step => ({ from: step.createdAt, to: step.decidedAt! })));
  const averageApprovalHours = completedSteps.length ? completedSteps.reduce((total, step) => total + Math.max(0, step.to.getTime() - step.from.getTime()) / 3_600_000, 0) / completedSteps.length : null;
  const openCases = requests.filter(row => row.accountabilityCase && row.accountabilityCase.status !== 'CLOSED');
  const overdueCases = openCases.filter(row => row.accountabilityCase!.dueAt < now);

  const granularity: 'day' | 'week' | 'month' = period === '30d' ? 'day' : period === '90d' ? 'week' : 'month';
  const series = new Map<string, { key: string; label: string; requestCount: number; requestedMinor: number; paidMinor: number }>();
  const cursor = new Date(start);
  if (granularity === 'month') cursor.setUTCDate(1);
  else if (granularity === 'week') { const day = (cursor.getUTCDay() + 6) % 7; cursor.setUTCDate(cursor.getUTCDate() - day); }
  while (cursor < end) {
    const key = bucketKey(cursor, granularity);
    series.set(key, { key, label: bucketLabel(key, granularity), requestCount: 0, requestedMinor: 0, paidMinor: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + (granularity === 'day' ? 1 : granularity === 'week' ? 7 : 0));
    if (granularity === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const row of requests) {
    const bucket = series.get(bucketKey(row.createdAt, granularity));
    if (bucket) { bucket.requestCount++; bucket.requestedMinor += Number(row.amountMinor); }
  }
  for (const row of disbursements) {
    const bucket = series.get(bucketKey(row.paidAt, granularity));
    if (bucket) bucket.paidMinor += Number(row.amountMinor);
  }

  const categoryMap = new Map<string, { label: string; count: number; amountMinor: number }>();
  const statusMap = new Map<string, number>();
  const subsidiaryMap = new Map<string, { id: string; label: string; count: number; amountMinor: number }>();
  const vendorMap = new Map<string, { id: string; label: string; count: number; amountMinor: number }>();
  for (const row of requests) {
    const categoryLabel = row.category.replaceAll('_', ' ');
    const category = categoryMap.get(categoryLabel) || { label: categoryLabel, count: 0, amountMinor: 0 };
    category.count++; category.amountMinor += Number(row.amountMinor); categoryMap.set(categoryLabel, category);
    statusMap.set(row.approvalStatus, (statusMap.get(row.approvalStatus) || 0) + 1);
    const subsidiary = subsidiaryMap.get(row.subsidiary.id) || { id: row.subsidiary.id, label: row.subsidiary.legalName, count: 0, amountMinor: 0 };
    subsidiary.count++; subsidiary.amountMinor += Number(row.amountMinor); subsidiaryMap.set(row.subsidiary.id, subsidiary);
    const vendorId = row.vendor?.id || 'unassigned';
    const vendor = vendorMap.get(vendorId) || { id: vendorId, label: row.vendor?.name || 'No vendor recorded', count: 0, amountMinor: 0 };
    vendor.count++; vendor.amountMinor += Number(row.amountMinor); vendorMap.set(vendorId, vendor);
  }
  const stageRows = [
    { label: 'Awaiting decision', rows: pending },
    { label: 'Approved, unpaid', rows: approvedUnpaid },
    { label: 'Payment recorded', rows: requests.filter(row => row.paymentStatus !== 'UNPAID') },
    { label: 'Declined', rows: requests.filter(row => row.approvalStatus === 'REJECTED') },
  ];
  const decisionQueue = pending.map(row => ({
    id: row.id, systemId: toSystemRequestId(row.id), requestNumber: row.requestNumber, title: row.title, subsidiary: row.subsidiary.legalName,
    category: row.category.replaceAll('_', ' '), amountMinor: Number(row.amountMinor), status: row.approvalStatus,
    ageDays: Math.max(0, Math.floor((now.getTime() - row.createdAt.getTime()) / 86_400_000)),
    neededBy: row.neededBy.toISOString(), createdAt: row.createdAt.toISOString(),
  })).sort((a, b) => b.ageDays - a.ageDays);
  const approvedDueNext30Days = sum(upcomingUnpaid);
  const trailingMonthlyPaidAverage = sum(recentPayments) / 3;

  return NextResponse.json({
    asOf: now.toISOString(), period, range: { from: start.toISOString(), to: end.toISOString() },
    filters: { category, status },
    availableSubsidiaries: availableSubsidiaries.map(row => ({ id: row.id, name: row.legalName })),
    availableCategories: availableCategories.map(row => row.category),
    summary: {
      requestCount: requests.length, pendingCount: pending.length, approvedCount: approved.length,
      paidCount: disbursements.length, disbursementsCount: disbursements.length,
      approvedRate: requests.length ? approved.length / requests.length : 0,
      requestedMinor, previousRequestedMinor, paidMinor, previousPaidMinor,
      awaitingConfirmationCount: disbursements.filter(row => row.status === 'AWAITING_RECIPIENT_CONFIRMATION').length,
      awaitingConfirmationMinor: sum(disbursements.filter(row => row.status === 'AWAITING_RECIPIENT_CONFIRMATION')),
      pendingApprovalMinor: sum(pending), approvedUnpaidMinor: sum(approvedUnpaid),
      approvedUnpaidCount: approvedUnpaid.length, approvedDueNext30Days, approvedDueNext30DaysCount: upcomingUnpaid.length,
      trailingMonthlyPaidAverage, averageApprovalHours,
      openCases: openCases.length, closedCases: requests.filter(row => row.accountabilityCase?.status === 'CLOSED').length,
      overdueCases: overdueCases.length,
    },
    previous: { requestCount: previousRequests.length, pendingCount: previousRequests.filter(row => pendingStatuses.includes(row.approvalStatus)).length },
    series: [...series.values()],
    categories: [...categoryMap.values()].sort((a, b) => b.amountMinor - a.amountMinor),
    subsidiaries: [...subsidiaryMap.values()].sort((a, b) => b.amountMinor - a.amountMinor),
    vendors: [...vendorMap.values()].sort((a, b) => b.amountMinor - a.amountMinor),
    pipelineStages: stageRows.map(stage => ({ label: stage.label, count: stage.rows.length, amountMinor: sum(stage.rows) })),
    statuses: [...statusMap.entries()].map(([label, count]) => ({ label: label.replaceAll('_', ' '), count })).sort((a, b) => b.count - a.count),
    decisionQueue,
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
  });
}
