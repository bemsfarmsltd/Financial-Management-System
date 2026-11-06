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

  const budgets = await prisma.budget.findMany({
    where: whereClause,
    include: {
      organization: { select: { id: true, legalName: true, code: true } },
      lines: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    ok: true,
    total: budgets.length,
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
    action = 'create', // create | update | reallocate | delete
    budget_id,
    organization_id,
    subsidiary_name,
    period,
    total_amount,
    allocations = [],
    reason,
  } = body;

  // Resolve organization ID if name was provided
  let targetOrgId = organization_id;
  if (!targetOrgId && subsidiary_name) {
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { legalName: { contains: subsidiary_name, mode: 'insensitive' } },
          { code: { contains: subsidiary_name, mode: 'insensitive' } },
        ],
      },
    });
    if (org) targetOrgId = org.id;
  }

  const orgRecord = targetOrgId
    ? await prisma.organization.findUnique({ where: { id: targetOrgId }, select: { legalName: true } })
    : null;
  const orgName = orgRecord?.legalName || 'BEMS Subsidiary';

  const mode = action.toLowerCase();
  let summary = '';
  if (mode === 'delete' || mode === 'remove') {
    summary = `Deactivate/Remove fiscal budget for ${orgName} (${period || 'Current'})`;
  } else if (mode === 'reallocate' || mode === 'update') {
    summary = `Reallocate ${orgName} budget into ${allocations.length} line(s) totaling ₦${Number(total_amount || 0).toLocaleString()} for ${period || 'Current Period'}`;
  } else {
    summary = `Create new ${period || 'Monthly'} budget for ${orgName} totaling ₦${Number(total_amount || 0).toLocaleString()}`;
  }

  // Stage action for executive confirmation using unified contract
  const staged = await stageAction({
    userId: actor.id,
    actionType: 'budget',
    summary,
    targetSubsidiaryId: targetOrgId,
    materialPayload: {
      mode,
      budget_id,
      organization_id: targetOrgId,
      period,
      total_amount,
      allocations,
      reason,
    },
    preview: {
      business_name: orgName,
      organization_name: orgName,
      period: period || 'Current Period',
      total_amount: `₦${Number(total_amount || 0).toLocaleString()}`,
      allocations: allocations.map((a: any) => ({
        department: a.department || a.departmentName || 'Operations',
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

