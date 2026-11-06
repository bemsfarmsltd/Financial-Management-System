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

    if (subAction === 'UPDATE_MOBILE_GATE' || subAction === 'MOBILE_GATE') {
      const appId = String(body.appId || 'GMD_APP').toUpperCase();
      if (!['GMD_APP', 'STAFF_APP'].includes(appId)) {
        return NextResponse.json({ ok: false, error: 'appId must be GMD_APP or STAFF_APP.' }, { status: 400 });
      }
      const minimumAllowedVersion = String(body.minimumAllowedVersion || '1.0.0').trim();
      const latestVersionAvailable = String(body.latestVersionAvailable || minimumAllowedVersion).trim();
      const forceUpdate = body.forceUpdate !== undefined ? Boolean(body.forceUpdate) : true;
      const directDownloadUrl = String(
        body.directDownloadUrl || (appId === 'GMD_APP' ? 'https://bemserp.work/download/gmd-app.apk' : 'https://bemserp.work/download/staff-app.apk')
      ).trim();

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'policy_update',
        summary: `Update Mobile Gate Rules for ${appId} (Min: v${minimumAllowedVersion}, Latest: v${latestVersionAvailable})`,
        materialPayload: {
          sub_action: 'UPDATE_MOBILE_GATE',
          appId,
          minimumAllowedVersion,
          latestVersionAvailable,
          forceUpdate,
          directDownloadUrl,
          upgradePromptNotes: body.upgradePromptNotes || '',
        },
        preview: {
          operation: 'Update Mobile App Gate',
          app_id: appId,
          minimum_allowed_version: minimumAllowedVersion,
          latest_version_available: latestVersionAvailable,
          force_update: forceUpdate,
          direct_download_url: directDownloadUrl,
        },
      });
      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: `Mobile gate update for ${appId} has been staged.`,
        ...staged,
      });
    }

    if (subAction === 'ACTIVATE_MOBILE_APK' || subAction === 'UPLOAD_APK') {
      const appId = String(body.appId || 'GMD_APP').toUpperCase();
      const version = String(body.version || '').trim();
      const attachmentIds: string[] = Array.isArray(body.attachmentIds || body.attachment_ids)
        ? body.attachmentIds || body.attachment_ids
        : body.attachmentId
        ? [String(body.attachmentId)]
        : [];
      if (!['GMD_APP', 'STAFF_APP'].includes(appId) || !version) {
        return NextResponse.json({ ok: false, error: 'appId (GMD_APP | STAFF_APP) and version are required.' }, { status: 400 });
      }

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'policy_update',
        attachmentIds,
        summary: `Activate Verified Mobile APK Release v${version} for ${appId}`,
        materialPayload: {
          sub_action: 'ACTIVATE_MOBILE_APK',
          appId,
          version,
          fileName: body.fileName || `${appId.toLowerCase()}-v${version}.apk`,
          fileSize: body.fileSize || '58.0 MB',
          downloadUrl: body.downloadUrl || (appId === 'GMD_APP' ? '/download/gmd-app.apk' : '/download/staff-app.apk'),
          notes: body.notes || `Activated v${version} via BEMI`,
          attachmentIds,
        },
        preview: {
          operation: 'Activate Mobile APK Release',
          app_id: appId,
          version,
          download_url: body.downloadUrl || (appId === 'GMD_APP' ? '/download/gmd-app.apk' : '/download/staff-app.apk'),
        },
      });
      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: `Mobile APK release v${version} for ${appId} has been staged.`,
        ...staged,
      });
    }

    if (subAction === 'CONFIGURE_CHANNEL' || subAction === 'IMPORT_TEMPLATE') {
      const orgLookup = String(body.organizationId || body.subsidiaryId || body.businessId || '').trim();
      if (!orgLookup) {
        return NextResponse.json({ ok: false, error: 'organizationId or businessId is required.' }, { status: 400 });
      }
      const org = await prisma.organization.findFirst({
        where: {
          OR: [{ id: orgLookup }, { code: { equals: orgLookup, mode: 'insensitive' } }, { legalName: { contains: orgLookup, mode: 'insensitive' } }],
        },
      });
      if (!org) {
        return NextResponse.json({ ok: false, error: `Organization "${orgLookup}" not found.` }, { status: 404 });
      }

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'policy_update',
        targetSubsidiaryId: org.id,
        summary:
          subAction === 'IMPORT_TEMPLATE'
            ? `Import Governance Template "${body.templateId || 'STANDARD_CORPORATE'}" into ${org.legalName}`
            : `Configure Notification Channel "${body.channelName || body.name || 'WhatsApp Bot Bridge'}" for ${org.legalName}`,
        materialPayload: {
          sub_action: subAction,
          organizationId: org.id,
          templateId: body.templateId || 'STANDARD_CORPORATE',
          channel: body.channel || {
            name: body.channelName || body.name || 'WhatsApp Bot Bridge',
            address: body.address || '+234 800 BEMS BOT',
            status: body.status || 'Live',
            workflow: body.workflow || 'High-priority notifications',
          },
        },
        preview: {
          operation: subAction === 'IMPORT_TEMPLATE' ? 'Import Business Template' : 'Configure Notification Channel',
          organization: `${org.legalName} (${org.code})`,
          ...(subAction === 'IMPORT_TEMPLATE' ? { template_id: body.templateId || 'STANDARD_CORPORATE' } : { channel_name: body.channelName || body.name }),
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        ...staged,
      });
    }

    if (subAction === 'UPDATE_WORKSPACE_SETTINGS' || subAction === 'UPDATE_SETTINGS') {
      const orgLookup = String(body.organizationId || body.subsidiaryId || body.subsidiary || '').trim();
      const isGroupScope = String(body.scope || '').toUpperCase() === 'GROUP' || orgLookup.toUpperCase() === 'GROUP' || orgLookup.toUpperCase() === 'BEMS-GROUP';
      if (!orgLookup && !isGroupScope) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'MISSING_ORGANIZATION',
            error: 'An explicit organizationId, subsidiary code, or scope="GROUP" is required to update workspace settings.',
          },
          { status: 400 }
        );
      }
      const org = isGroupScope
        ? await prisma.organization.findFirst({ where: { OR: [{ type: 'GROUP' }, { code: 'BEMS-GROUP' }, { code: 'BEMS-HQ' }] } })
        : await prisma.organization.findFirst({
            where: {
              OR: [
                { id: orgLookup },
                { code: { equals: orgLookup, mode: 'insensitive' } },
                { legalName: { contains: orgLookup, mode: 'insensitive' } },
              ],
            },
          });

      if (!org) {
        return NextResponse.json({ ok: false, error: 'Organization not found.' }, { status: 404 });
      }

      const key = String(body.key || 'approval.controls').trim();
      const value = body.value || {};

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'policy_update',
        targetSubsidiaryId: org.id,
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
      userId: actor.id,
      actionType: 'policy_update',
      targetSubsidiaryId: body.scopeSubsidiaryId || undefined,
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

