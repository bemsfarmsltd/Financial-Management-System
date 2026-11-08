import { hasGmdFeatureAccess } from '@/lib/gmd-access';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req, { disallowServiceToken: true });
    if (actor && !hasGmdFeatureAccess(actor.role)) return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access requires GMD or an authorized Super Admin.'},{status:403});
    if (!actor) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' },
        { status: 401 }
      );
    }
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Executive access required.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const action = await prisma.stagedAction.findUnique({ where: { id } });
    if (!action) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Staged action ${id} not found.` },
        { status: 404 }
      );
    }

    const actorRoleUpper = (actor.role || '').toUpperCase();
    if (action.userId !== actor.id && actorRoleUpper !== 'GMD' && actorRoleUpper !== 'SUPER_ADMIN' && actorRoleUpper !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Not permitted.' },
        { status: 403 }
      );
    }

    let currentStatus = action.status;
    if (currentStatus === 'PENDING' && new Date() > action.expiresAt) {
      currentStatus = 'EXPIRED';
      await prisma.stagedAction.updateMany({
        where: { id: action.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      }).catch(() => {});
    }

    let preview: Record<string, any> = {};
    try {
      preview = JSON.parse(action.previewJson || '{}');
    } catch {
      preview = {};
    }

    let executionResult: Record<string, any> | null = null;
    if (action.resultJson) {
      try {
        executionResult = JSON.parse(action.resultJson);
      } catch {
        executionResult = null;
      }
    }

    let parsedAttachmentIds: string[] = [];
    if (action.attachmentIds) {
      try {
        parsedAttachmentIds = JSON.parse(action.attachmentIds);
      } catch {
        parsedAttachmentIds = [];
      }
    }

    return NextResponse.json({
      ok: true,
      staged_action: {
        id: action.id,
        staged_action_id: action.id,
        confirmation_hash: action.confirmationHash,
        action_type: action.actionType,
        command_version: action.commandVersion,
        conversation_id: action.conversationId,
        target_subsidiary_id: action.targetSubsidiaryId,
        target_entity_type: action.targetEntityType,
        target_entity_id: action.targetEntityId,
        expected_version: action.expectedVersion,
        eligible_approver_roles: action.eligibleApproverRoles,
        attachment_ids: parsedAttachmentIds,
        side_effect_status: action.sideEffectStatus,
        type: action.actionType,
        cardType: 'STAGED_ACTION',
        summary: action.summary,
        status: currentStatus,
        expires_at: action.expiresAt.toISOString(),
        executed_at: action.executedAt ? action.executedAt.toISOString() : null,
        audit_event_id: action.auditEventId || executionResult?.audit_event_id || null,
        payload_preview: preview,
        execution_result: executionResult,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: err.message },
      { status: 500 }
    );
  }
}

