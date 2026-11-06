import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { disallowServiceToken: true });
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

    const { searchParams } = new URL(req.url);
    const rawIds = searchParams.get('ids') || '';
    const ids = Array.from(
      new Set(
        rawIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).slice(0, 50);

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, actions: {} });
    }

    const actorRoleUpper = (actor.role || '').toUpperCase();
    const isGmd = actorRoleUpper === 'GMD';

    const rows = await prisma.stagedAction.findMany({
      where: {
        id: { in: ids },
        ...(isGmd ? {} : { userId: actor.id }),
      },
    });

    const now = new Date();
    const expiredIds: string[] = [];
    const actionsMap: Record<string, any> = {};

    for (const row of rows) {
      let currentStatus = row.status;
      if (currentStatus === 'PENDING' && now > row.expiresAt) {
        currentStatus = 'EXPIRED';
        expiredIds.push(row.id);
      }

      let preview: Record<string, any> = {};
      try {
        preview = JSON.parse(row.previewJson || '{}');
      } catch {
        preview = {};
      }

      let executionResult: Record<string, any> | null = null;
      if (row.resultJson) {
        try {
          executionResult = JSON.parse(row.resultJson);
        } catch {
          executionResult = null;
        }
      }

      let parsedAttachmentIds: string[] = [];
      if (row.attachmentIds) {
        try {
          parsedAttachmentIds = JSON.parse(row.attachmentIds);
        } catch {
          parsedAttachmentIds = [];
        }
      }

      actionsMap[row.id] = {
        id: row.id,
        staged_action_id: row.id,
        confirmation_hash: row.confirmationHash,
        action_type: row.actionType,
        command_version: row.commandVersion,
        conversation_id: row.conversationId,
        target_subsidiary_id: row.targetSubsidiaryId,
        target_entity_type: row.targetEntityType,
        target_entity_id: row.targetEntityId,
        expected_version: row.expectedVersion,
        eligible_approver_roles: row.eligibleApproverRoles,
        attachment_ids: parsedAttachmentIds,
        side_effect_status: row.sideEffectStatus,
        summary: row.summary,
        status: currentStatus,
        expires_at: row.expiresAt.toISOString(),
        executed_at: row.executedAt ? row.executedAt.toISOString() : null,
        audit_event_id: row.auditEventId || executionResult?.audit_event_id || null,
        payload_preview: preview,
        execution_result: executionResult,
      };
    }

    if (expiredIds.length > 0) {
      await prisma.stagedAction.updateMany({
        where: { id: { in: expiredIds }, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      actions: actionsMap,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: err.message },
      { status: 500 }
    );
  }
}

