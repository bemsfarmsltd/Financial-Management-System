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
  if (errorResponse || !actor) return errorResponse!;
  if (!actor.isExecutive) {
    return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const channel = (searchParams.get('channel') || 'GMD').toUpperCase();
  const employeeId = searchParams.get('employeeId') || undefined;

  const messages = await prisma.staffAdminMessage.findMany({
    where: {
      channel,
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
    if (errorResponse || !actor) return errorResponse!;
    if (!actor.isExecutive) {
      return NextResponse.json({ ok: false, error: 'Executive access required to message staff.' }, { status: 403 });
    }

    const body = await req.json();
    const lookup = String(body.employeeId || body.employee_id || body.employeeName || body.workEmail || '').trim();
    const messageText = String(body.message || body.text || body.body || body.content || '').trim();
    const channel = String(body.channel || (actor.role === 'GMD' ? 'GMD' : 'HR')).toUpperCase();

    if (!lookup || !messageText) {
      return NextResponse.json(
        { ok: false, error: 'employeeId/employeeName and message are required.' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findFirst({
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
      actorId: actor.id,
      actionType: 'staff_message',
      summary: `Send ${channel} Helpdesk Message to ${employee.legalName}: "${messageText.slice(0, 60)}"`,
      materialPayload: {
        employeeId: employee.id,
        channel,
        message: messageText,
      },
      preview: {
        operation: `Send ${channel} Direct Message`,
        recipient: `${employee.legalName} (${employee.employeeNumber})`,
        channel,
        message: messageText,
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

