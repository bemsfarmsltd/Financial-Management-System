import { getAiReadClient } from '@/lib/platform/scoped-database';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/tools/messages
 * List recent Staff-Admin helpdesk threads and messages.
 */
export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  const db = actor ? await getAiReadClient(actor) : prisma;
  if (errorResponse || !actor) return errorResponse!;
  if (!actor.isExecutive) {
    return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const authorizedScope = await resolveAuthorizedOrganizationScope(actor as any, searchParams.get('subsidiary_id') || searchParams.get('subsidiary') || searchParams.get('organization_id') || 'ALL');
  const channel = (searchParams.get('channel') || (actor.role === 'GMD' ? 'GMD' : 'HR')).toUpperCase();
  if (channel === 'GMD' && !actor.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN_CHANNEL', error: 'Confidential GMD Executive Line can only be read by the Group Managing Director.' },
      { status: 403 }
    );
  }
  const employeeId = searchParams.get('employeeId') || undefined;

  const messages = await db.staffAdminMessage.findMany({
    where: {
      channel,
      employee: { assignments: { some: { subsidiaryId: { in: authorizedScope.organizationIds }, status: 'ACTIVE' } } },
      ...(employeeId ? { employeeId } : {}),
    },
    include: {
      employee: { select: { id: true, legalName: true, employeeNumber: true, workEmail: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    channel,
    count: messages.length,
    messages,
  });
}

/**
 * POST /api/ai/tools/messages
 * Stage sending a direct executive (GMD) or HR message to a staff member.
 */
export async function POST(req: NextRequest) {
  try {
    const { actor, errorResponse } = await authenticateAiToolRequest(req);
  const db = actor ? await getAiReadClient(actor) : prisma;
    if (errorResponse || !actor) return errorResponse!;

    const body = await req.json();
    const subAction = String(body.action || body.sub_action || 'SEND_MESSAGE').toUpperCase();

    if (subAction === 'MARK_NOTIFICATIONS_READ' || subAction === 'CLEAR_NOTIFICATIONS') {
      const notificationIds: string[] = Array.isArray(body.notificationIds) ? body.notificationIds : [];
      const proposal = await stageAction({ actorContext: actor, userId: actor.id, actionType: 'notification_read', materialPayload: { notificationIds }, summary: 'Mark selected notifications read', preview: { notificationIds } });
      return NextResponse.json({ ok: true, staged: true, ...proposal });
    }

    if (!actor.isExecutive) {
      return NextResponse.json({ ok: false, error: 'Executive access required to message staff.' }, { status: 403 });
    }

    const lookup = String(body.employeeId || body.employee_id || body.employeeName || body.workEmail || '').trim();
    const messageText = String(body.message || body.text || body.body || body.content || '').trim();
    const channel = String(body.channel || (actor.role === 'GMD' ? 'GMD' : 'HR')).toUpperCase();
    if (channel === 'GMD' && !actor.isExecutive) {
      return NextResponse.json(
        { ok: false, error_code: 'FORBIDDEN_CHANNEL', error: 'Only the Group Managing Director can send messages on the GMD Executive Line.' },
        { status: 403 }
      );
    }
    const attachmentIds: string[] = Array.isArray(body.attachmentIds || body.attachment_ids)
      ? body.attachmentIds || body.attachment_ids
      : body.attachmentId
      ? [String(body.attachmentId)]
      : [];

    if (!lookup || !messageText) {
      return NextResponse.json(
        { ok: false, error: 'employeeId/employeeName and message are required.' },
        { status: 400 }
      );
    }

    const employee = await db.employee.findFirst({
      where: {
        OR: [
          { id: lookup },
          { employeeNumber: { equals: lookup, mode: 'insensitive' } },
          { workEmail: { equals: lookup, mode: 'insensitive' } },
          { legalName: { contains: lookup, mode: 'insensitive' } },
        ],
      },
    });
    if (!employee) {
      return NextResponse.json({ ok: false, error: `Staff member "${lookup}" not found.` }, { status: 404 });
    }

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'staff_message',
      attachmentIds,
      summary: `Send ${channel} Helpdesk Message to ${employee.legalName}: "${messageText.slice(0, 60)}"`,
      materialPayload: {
        employeeId: employee.id,
        channel,
        message: messageText,
        attachmentIds,
      },
      preview: {
        operation: `Send ${channel} Direct Message`,
        recipient: `${employee.legalName} (${employee.employeeNumber})`,
        channel,
        message: messageText,
        ...(attachmentIds.length > 0 ? { attachments_count: attachmentIds.length } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      status: 'AWAITING_CONFIRMATION',
      message: `Direct message to ${employee.legalName} has been staged. Click Confirm to dispatch.`,
      ...staged,
    });
  } catch (error: any) {
    console.error('[AI Tool Messages POST Error]:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Failed to stage message.' }, { status: 500 });
  }
}

