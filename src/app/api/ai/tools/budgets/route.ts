import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor || !actor.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Executive access is required to view budgets.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get('organization_id') || searchParams.get('subsidiary_id');
  const period = searchParams.get('period');
  const status = searchParams.get('status') || 'ACTIVE';

  const whereClause: any = {};
  if (organizationId) whereClause.organizationId = organizationId;
  if (status !== 'ALL') whereClause.status = status;
  if (period) whereClause.periodName = { contains: period, mode: 'insensitive' };

  const [budgets, recurringRequests] = await Promise.all([
    prisma.budget.findMany({
      where: whereClause,
      include: {
        organization: { select: { id: true, legalName: true, code: true } },
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expenditureRequest.findMany({
      where: {
        isRecurring: true,
        ...(organizationId && organizationId !== 'ALL' ? { subsidiaryId: organizationId } : {}),
      },
      select: {
        id: true,
        requestNumber: true,
        title: true,
        subsidiaryId: true,
        amountMinor: true,
        recurringInterval: true,
        approvalStatus: true,
        neededBy: true,
      },
    }),
  ]);

  let recurringAnnualRunRateMinor = 0;
  for (const r of recurringRequests) {
    if (r.approvalStatus === 'APPROVED') {
      const amt = Number(r.amountMinor);
      const mult = r.recurringInterval === 'WEEKLY' ? 52 : r.recurringInterval === 'QUARTERLY' ? 4 : r.recurringInterval === 'YEARLY' ? 1 : 12;
      recurringAnnualRunRateMinor += amt * mult;
    }
  }

  return NextResponse.json({
    ok: true,
    total: budgets.length,
    recurringCommitmentsSummary: {
      totalRecurringRequests: recurringRequests.length,
      approvedRecurringCount: recurringRequests.filter((r) => r.approvalStatus === 'APPROVED').length,
      annualRunRateNaira: recurringAnnualRunRateMinor / 100,
      formattedAnnualRunRate: `₦${(recurringAnnualRunRateMinor / 100).toLocaleString()}`,
    },
    budgets: budgets.map((b) => ({
      id: b.id,
      organizationId: b.organizationId,
      organizationName: b.organization.legalName,
      organizationCode: b.organization.code,
      period: b.periodName,
      fiscalPeriod: b.fiscalPeriod,
      totalAmount: b.totalAmount,
      committedAmount: b.committedAmount,
      spentAmount: b.spentAmount,
      headroom: b.totalAmount - b.committedAmount,
      status: b.status,
      linesCount: b.lines.length,
      lines: b.lines.map((l) => ({
        id: l.id,
        department: l.departmentName,
        category: l.category,
        allocatedAmount: l.allocatedAmount,
        committedAmount: l.committedAmount,
        spentAmount: l.spentAmount,
        remainingAmount: l.allocatedAmount - l.committedAmount,
      })),
      createdAt: b.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor || !actor.isExecutive) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden: Only executives (GMD or Super Admin) can manipulate fiscal budgets.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const {
    action = 'create', // create | update | reallocate | archive
    budget_id,
    organization_id,
    subsidiary_name,
    period,
    total_amount,
    allocations = [],
    reason,
  } = body;

  const rawMode = String(action || body.mode || 'create').toLowerCase().trim();
  const mode: 'create' | 'update' | 'reallocate' | 'archive' =
    rawMode === 'delete' || rawMode === 'remove' || rawMode === 'archive'
      ? 'archive'
      : rawMode === 'reallocate'
      ? 'reallocate'
      : rawMode === 'update'
      ? 'update'
      : 'create';

  // 1. Resolve organization ID strictly (no first-row fallback, no ambiguous match)
  let targetOrgId: string | undefined = organization_id || body.subsidiaryId;
  let orgRecord: { id: string; legalName: string; code: string } | null = null;

  if (budget_id) {
    const byId = await prisma.budget.findUnique({
      where: { id: String(budget_id) },
      include: { organization: { select: { id: true, legalName: true, code: true } }, lines: true },
    });
    if (!byId) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', error: `Budget "${budget_id}" not found.` },
        { status: 404 }
      );
    }
    targetOrgId = byId.organizationId;
    orgRecord = byId.organization;
  }

  if (!orgRecord) {
    const orgLookup = String(targetOrgId || subsidiary_name || '').trim();
    if (!orgLookup || orgLookup === 'ALL') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'MISSING_ORGANIZATION',
          error: 'An explicit organization_id or subsidiary_name is required to stage a budget command.',
        },
        { status: 400 }
      );
    }

    const exactOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: orgLookup },
          { code: { equals: orgLookup, mode: 'insensitive' } },
          { legalName: { equals: orgLookup, mode: 'insensitive' } },
        ],
      },
      select: { id: true, legalName: true, code: true },
    });

    if (exactOrg) {
      orgRecord = exactOrg;
      targetOrgId = exactOrg.id;
    } else {
      const partialMatches = await prisma.organization.findMany({
        where: {
          OR: [
            { legalName: { contains: orgLookup, mode: 'insensitive' } },
            { code: { contains: orgLookup, mode: 'insensitive' } },
          ],
        },
        select: { id: true, legalName: true, code: true },
      });
      if (partialMatches.length === 0) {
        return NextResponse.json(
          { ok: false, error_code: 'NOT_FOUND', error: `Organization "${orgLookup}" was not found.` },
          { status: 404 }
        );
      }
      if (partialMatches.length > 1) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'AMBIGUOUS_ORGANIZATION',
            error: `Multiple subsidiaries matched "${orgLookup}": ${partialMatches.map((o) => `${o.legalName} (${o.code})`).join(', ')}. Please specify the exact subsidiary code.`,
          },
          { status: 400 }
        );
      }
      orgRecord = partialMatches[0];
      targetOrgId = orgRecord.id;
    }
  }

  const orgName = orgRecord.legalName;
  const exactPeriod = String(period || body.periodName || '').trim();

  // 2. Resolve target budget for update / reallocate / archive, or check duplicate for create
  let resolvedBudgetId: string | undefined = budget_id ? String(budget_id) : undefined;
  let resolvedPeriodName = exactPeriod;
  let expectedUpdatedAt: string | undefined;

  if (mode === 'update' || mode === 'reallocate' || mode === 'archive') {
    let targetBudget = resolvedBudgetId
      ? await prisma.budget.findUnique({ where: { id: resolvedBudgetId }, include: { lines: true } })
      : null;

    if (!targetBudget) {
      if (!exactPeriod) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'MISSING_TARGET_BUDGET',
            error: `budget_id or exact period is required to ${mode} a budget for ${orgName}.`,
          },
          { status: 400 }
        );
      }
      const matches = await prisma.budget.findMany({
        where: {
          organizationId: targetOrgId,
          status: 'ACTIVE',
          OR: [
            { periodName: { equals: exactPeriod, mode: 'insensitive' } },
            { fiscalPeriod: { equals: exactPeriod, mode: 'insensitive' } },
          ],
        },
        include: { lines: true },
      });
      if (matches.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'BUDGET_NOT_FOUND',
            error: `No active budget found for ${orgName} with period "${exactPeriod}".`,
          },
          { status: 404 }
        );
      }
      if (matches.length > 1) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'AMBIGUOUS_BUDGET',
            error: `Multiple active budgets matched period "${exactPeriod}" for ${orgName}. Please provide the specific budget_id.`,
          },
          { status: 400 }
        );
      }
      targetBudget = matches[0];
    }

    if (targetBudget.organizationId !== targetOrgId) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'ORG_MISMATCH',
          error: `Budget ${targetBudget.id} does not belong to ${orgName}.`,
        },
        { status: 400 }
      );
    }
    if (targetBudget.status === 'CLOSED') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'BUDGET_CLOSED',
          error: `Budget "${targetBudget.periodName}" for ${orgName} is already closed/archived.`,
        },
        { status: 409 }
      );
    }

    resolvedBudgetId = targetBudget.id;
    resolvedPeriodName = targetBudget.periodName;
    expectedUpdatedAt = targetBudget.updatedAt.toISOString();
  } else {
    // mode === 'create'
    if (!resolvedPeriodName) {
      return NextResponse.json(
        { ok: false, error_code: 'MISSING_PERIOD', error: 'An explicit fiscal period (e.g. "2026-Q4" or "November 2026") is required to create a budget.' },
        { status: 400 }
      );
    }
    const numericTotal = Number(total_amount);
    if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
      return NextResponse.json(
        { ok: false, error_code: 'INVALID_AMOUNT', error: 'A positive total_amount is required to create a budget.' },
        { status: 400 }
      );
    }
    const existingDuplicate = await prisma.budget.findFirst({
      where: {
        organizationId: targetOrgId,
        periodName: { equals: resolvedPeriodName, mode: 'insensitive' },
        status: 'ACTIVE',
      },
    });
    if (existingDuplicate) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'BUDGET_ALREADY_EXISTS',
          error: `An active budget for ${orgName} (${existingDuplicate.periodName}) already exists. Use action="update" or action="reallocate" with budget_id="${existingDuplicate.id}".`,
        },
        { status: 409 }
      );
    }
  }

  const resolvedTotalAmount =
    total_amount !== undefined && total_amount !== null
      ? Number(total_amount)
      : Array.isArray(allocations) && allocations.length > 0
      ? allocations.reduce((sum: number, a: any) => sum + Number(a.amount ?? a.allocatedAmount ?? 0), 0)
      : 0;

  let summary = '';
  if (mode === 'archive') {
    summary = `Archive/Close fiscal budget for ${orgName} (${resolvedPeriodName})`;
  } else if (mode === 'reallocate' || mode === 'update') {
    summary = `${mode === 'reallocate' ? 'Reallocate' : 'Update'} ${orgName} budget (${resolvedPeriodName}) totaling ₦${resolvedTotalAmount.toLocaleString()}`;
  } else {
    summary = `Create new ${resolvedPeriodName} budget for ${orgName} totaling ₦${resolvedTotalAmount.toLocaleString()}`;
  }

  // Stage action for executive confirmation using unified contract
  const staged = await stageAction({
    userId: actor.id,
    actionType: 'budget',
    summary,
    targetSubsidiaryId: targetOrgId,
    materialPayload: {
      mode,
      budget_id: resolvedBudgetId || null,
      organization_id: targetOrgId,
      period: resolvedPeriodName,
      total_amount: resolvedTotalAmount,
      allocations,
      reason: reason || null,
      ...(expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {}),
    },
    preview: {
      business_name: orgName,
      organization_name: orgName,
      budget_id: resolvedBudgetId || 'NEW',
      period: resolvedPeriodName,
      total_amount: `₦${resolvedTotalAmount.toLocaleString()}`,
      allocations: allocations.map((a: any) => ({
        department: a.department || a.departmentName || 'Operations',
        category: a.line_name || a.category || a.categoryName || 'General',
        amount: `₦${Number(a.amount || a.allocatedAmount || 0).toLocaleString()}`,
      })),
      allocation_lines: allocations,
      action_mode: mode,
    },
  });

  return NextResponse.json({
    ok: true,
    action: mode,
    staged_action_id: staged.staged_action_id,
    confirmation_hash: staged.confirmation_hash,
    confirmation_button: staged.confirmation_button,
    summary: staged.summary,
    staged_action: staged.staged_action,
  });
}

