import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to update a task.' }, { status: 401 });
  const { taskId } = await params;
  const task = await prisma.followupTask.findUnique({ where: { id: taskId }, include: { accountabilityCase: { include: { request: { include: { channel: true } } } }, channel: { include: { request: true } } } });
  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  const canManage = hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'COO', 'FINANCE', 'VERIFIER']);
  if (!canManage && task.assigneeId !== actor.id) return NextResponse.json({ error: 'Only the assignee or an authorized manager can update this task.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.status !== 'COMPLETED' && body.status !== 'PENDING') return NextResponse.json({ error: 'Choose a supported task status.' }, { status: 400 });
  const completedAt = body.status === 'COMPLETED' ? new Date() : null;
  const responseNotes = typeof body.responseNotes === 'string' ? body.responseNotes.trim().slice(0, 1000) : null;
  const updated = await prisma.$transaction(async tx => {
    const saved = await tx.followupTask.update({ where: { id: task.id }, data: { status: body.status, completedAt, responseNotes } });
    const requestRecord = task.accountabilityCase?.request || task.channel?.request;
    const linkedChannel = task.accountabilityCase?.request.channel || task.channel;
    if (linkedChannel) await tx.channelMessage.create({ data: { channelId: linkedChannel.id, authorId: actor.id, authorName: actor.legalName, authorRole: actor.role, body: body.status === 'COMPLETED' ? `Follow-up completed: ${task.description}${responseNotes ? ` — ${responseNotes}` : ''}` : `Follow-up reopened: ${task.description}`, messageType: 'AUDIT_EVENT' } });
    if (requestRecord) await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: requestRecord.groupId, subsidiaryId: requestRecord.subsidiaryId, targetType: 'REQUEST', targetId: requestRecord.id, action: body.status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_REOPENED', correlationId: `CORR-TASK-${randomUUID()}`, metadata: JSON.stringify({ taskId: task.id, description: task.description, responseNotes }) } });
    return saved;
  });
  return NextResponse.json({ task: updated });
}
