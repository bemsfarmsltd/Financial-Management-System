import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/tools/policies
 * Inspect approval matrix policies and workspace governance settings.
 */
export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse || !actor) return errorResponse!;
  if (!actor.isExecutive) {
    return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
  }

  const [policies, settings] = await Promise.all([
    prisma.approvalPolicy.findMany({ orderBy: [{ priority: 'asc' }, { minAmountMinor: 'asc' }] }),
    prisma.workspaceSetting.findMany({ take: 100 }),
  ]);

  return NextResponse.json({
    ok: true,
    approvalPolicies: policies.map((p) => ({
      id: p.id,
      category: p.category,
      minAmount: Number(p.minAmountMinor) / 100,
      maxAmount: p.maxAmountMinor ? Number(p.maxAmountMinor) / 100 : null,
      requiredRole: p.requiredRole,
      priority: p.priority,
      scopeSubsidiaryId: p.scopeSubsidiaryId,
      active: p.active,
    })),
    workspaceSettings: settings,
  });
}

/**
 * POST /api/ai/tools/policies
 * Stage updates to approval matrix policies or workspace governance settings.
 */
export async function POST(req: NextRequest) {
  try {
    const { actor, errorResponse } = await authenticateAiToolRequest(req);
    if (errorResponse || !actor) return errorResponse!;
    if (!actor.isExecutive) {
      return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
    }

    const body = await req.json();
    const subAction = String(
      body.action || body.sub_action || (body.key && body.value ? 'UPDATE_WORKSPACE_SETTINGS' : 'UPDATE_APPROVAL_POLICY')
    ).toUpperCase();

    if (subAction === 'UPDATE_WORKSPACE_SETTINGS' || subAction === 'UPDATE_SETTINGS') {
      const orgLookup = String(body.organizationId || body.subsidiaryId || body.subsidiary || '').trim();
      const org = orgLookup
        ? await prisma.organization.findFirst({
            where: {
              OR: [
                { id: orgLookup },
                { code: { equals: orgLookup, mode: 'insensitive' } },
                { legalName: { contains: orgLookup, mode: 'insensitive' } },
              ],
            },
          })
        : await prisma.organization.findFirst({ orderBy: { type: 'asc' } });

      if (!org) {
        return NextResponse.json({ ok: false, error: 'Organization not found.' }, { status: 404 });
      }

      const key = String(body.key || 'approval.controls').trim();
      const value = body.value || {};

      const staged = await stageAction({
        actorId: actor.id,
        actionType: 'policy_update',
        summary: `Update Workspace Governance Setting "${key}" for ${org.legalName}`,
        materialPayload: {
          sub_action: 'UPDATE_WORKSPACE_SETTINGS',
          organizationId: org.id,
          key,
          value,
        },
        preview: {
          operation: 'Update Workspace Setting',
          organization: `${org.legalName} (${org.code})`,
          setting_key: key,
          new_value: JSON.stringify(value),
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: `Workspace setting update "${key}" for ${org.legalName} has been staged.`,
        ...staged,
      });
    }

    const minAmount = Number(body.minAmount ?? 0);
    const maxAmount = body.maxAmount !== undefined && body.maxAmount !== null ? Number(body.maxAmount) : null;
    const category = body.category ? String(body.category).toUpperCase() : null;
    const requiredRole = String(body.requiredRole || 'GMD').toUpperCase();
    const priority = Number(body.priority || 1);

    const staged = await stageAction({
      actorId: actor.id,
      actionType: 'policy_update',
      summary: `${body.id ? 'Update' : 'Create'} Approval Policy Band (${category || 'GENERAL_OPEX'}: ₦${minAmount.toLocaleString()} – ${maxAmount ? `₦${maxAmount.toLocaleString()}` : 'Unlimited'})`,
      materialPayload: {
        sub_action: 'UPDATE_APPROVAL_POLICY',
        id: body.id || null,
        scopeSubsidiaryId: body.scopeSubsidiaryId || null,
        category,
        minAmount,
        maxAmount,
        requiredRole,
        priority,
        active: body.active !== undefined ? Boolean(body.active) : true,
      },
      preview: {
        operation: body.id ? 'Update Approval Policy Band' : 'Create Approval Policy Band',
        category: category || 'GENERAL_OPEX',
        threshold_range: `₦${minAmount.toLocaleString()} – ${maxAmount ? `₦${maxAmount.toLocaleString()}` : 'Unlimited'}`,
        required_role: requiredRole,
        priority,
      },
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      status: 'AWAITING_CONFIRMATION',
      message: `Approval policy band update has been staged. Click Confirm to commit.`,
      ...staged,
    });
  } catch (error: any) {
    console.error('[AI Tool Policies POST Error]:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Failed to stage policy update.' }, { status: 500 });
  }
}

