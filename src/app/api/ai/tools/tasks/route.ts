import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/tools/tasks
 * List follow-up tasks.
 */
export async function GET(request: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(request);
  if (errorResponse || !actor) return errorResponse!;

  const tasks = await prisma.followupTask.findMany({
    where: actor.isExecutive ? undefined : { assigneeId: actor.id },
    include: {
      assignee: { select: { id: true, legalName: true, role: true } },
      accountabilityCase: { include: { request: { select: { id: true, requestNumber: true, title: true } } } },
      channel: { include: { request: { select: { id: true, requestNumber: true, title: true } } } },
    },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    count: tasks.length,
    tasks,
  });
}

/**
 * POST /api/ai/tools/tasks
 * Stage follow-up task assignment or completion.
 */
export async function POST(request: NextRequest) {
  try {
    const { actor, errorResponse } = await authenticateAiToolRequest(request);
    if (errorResponse || !actor) return errorResponse!;

    const body = await request.json();
    const subAction = String(body.action || body.sub_action || (body.taskId || body.id ? 'COMPLETE_TASK' : 'CREATE_TASK')).toUpperCase();

    if (subAction === 'COMPLETE_TASK' || subAction === 'REOPEN_TASK') {
      const taskId = String(body.taskId || body.id || '').trim();
      if (!taskId) {
        return NextResponse.json({ ok: false, error: 'taskId is required to update a task.' }, { status: 400 });
      }
      const existing = await prisma.followupTask.findUnique({
        where: { id: taskId },
        include: { assignee: { select: { legalName: true } } },
      });
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 });
      }

      const staged = await stageAction({
        actorId: actor.id,
        actionType: 'task_action',
        summary: `${subAction === 'REOPEN_TASK' ? 'Reopen' : 'Complete'} Follow-up Task: "${existing.description}"`,
        materialPayload: {
          sub_action: subAction,
          taskId: existing.id,
          responseNotes: body.responseNotes || null,
        },
        preview: {
          operation: subAction === 'REOPEN_TASK' ? 'Reopen Follow-up Task' : 'Complete Follow-up Task',
          task: existing.description,
          assignee: existing.assignee.legalName,
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: `Task update staged. Click Confirm to commit.`,
        ...staged,
      });
    }

    if (!actor.isExecutive) {
      return NextResponse.json({ ok: false, error: 'Executive access required to assign follow-up tasks.' }, { status: 403 });
    }

    const description = String(body.description || body.task || '').trim();
    const assigneeLookup = String(body.assigneeId || body.assigneeName || body.assignee || '').trim();
    if (!description || !assigneeLookup) {
      return NextResponse.json({ ok: false, error: 'description and assigneeId/assigneeName are required.' }, { status: 400 });
    }

    const assignee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: assigneeLookup },
          { employeeNumber: { equals: assigneeLookup, mode: 'insensitive' } },
          { legalName: { contains: assigneeLookup, mode: 'insensitive' } },
          { workEmail: { equals: assigneeLookup, mode: 'insensitive' } },
        ],
      },
    });

    if (!assignee) {
      return NextResponse.json({ ok: false, error: `Assignee "${assigneeLookup}" not found.` }, { status: 404 });
    }

    const dueAt = body.dueAt || new Date(Date.now() + 3 * 86400_000).toISOString();

    const staged = await stageAction({
      actorId: actor.id,
      actionType: 'task_action',
      summary: `Assign Follow-up Task to ${assignee.legalName}: "${description}"`,
      materialPayload: {
        sub_action: 'CREATE_TASK',
        assigneeId: assignee.id,
        description,
        dueAt,
        requestId: body.requestId || body.requestNumber || null,
        accountabilityCaseId: body.accountabilityCaseId || null,
        channelId: body.channelId || null,
      },
      preview: {
        operation: 'Assign Follow-up Task',
        assignee: `${assignee.legalName} (${assignee.employeeNumber})`,
        description,
        due_date: new Date(dueAt).toISOString().split('T')[0],
      },
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      status: 'AWAITING_CONFIRMATION',
      message: `Follow-up task for ${assignee.legalName} has been staged. Click Confirm to assign.`,
      ...staged,
    });
  } catch (error: any) {
    console.error('[AI Tool Tasks POST Error]:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Failed to stage task action.' }, { status: 500 });
  }
}

