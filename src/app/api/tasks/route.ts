import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';
const taskManagers = ['SYSTEM_ADMIN', 'GMD', 'COO', 'FINANCE', 'VERIFIER'];

export async function GET() {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to view follow-up tasks.' }, { status: 401 });
  if (!hasAnyRole(actor, [...taskManagers, 'HR', 'STAFF', 'DEPT_HEAD', 'HEAD_OF_ADMIN'])) return NextResponse.json({ error: 'You are not allowed to view these tasks.' }, { status: 403 });
  const tasks = await prisma.followupTask.findMany({
    where: hasAnyRole(actor, taskManagers) ? undefined : { assigneeId: actor.id },
    include: { assignee: { select: { id: true, legalName: true, role: true } }, accountabilityCase: { include: { request: { select: { id: true, requestNumber: true, title: true } } } }, channel: { include: { request: { select: { id: true, requestNumber: true, title: true } } } } },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
  });
  return NextResponse.json({ tasks: tasks.map(task => ({ ...task, accountabilityCase: task.accountabilityCase ? { ...task.accountabilityCase, request: { ...task.accountabilityCase.request, systemId: toSystemRequestId(task.accountabilityCase.request.id) } } : null, channel: task.channel ? { ...task.channel, request: { ...task.channel.request, systemId: toSystemRequestId(task.channel.request.id) } } : null })) });
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to assign a task.' }, { status: 401 });
  if (!hasAnyRole(actor, taskManagers)) return NextResponse.json({ error: 'Manager access is required to assign follow-up tasks.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const assigneeId = typeof body.assigneeId === 'string' ? body.assigneeId : '';
  const dueAt = new Date(body.dueAt);
  const accountabilityCaseId = typeof body.accountabilityCaseId === 'string' ? body.accountabilityCaseId : null;
  const channelId = typeof body.channelId === 'string' ? body.channelId : null;
  if (description.length < 3 || description.length > 1000 || !assigneeId || Number.isNaN(dueAt.getTime()) || dueAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: 'Enter a task, a valid future due date, and an assignee.' }, { status: 400 });
  if (!accountabilityCaseId && !channelId) return NextResponse.json({ error: 'Link the task to an accountability case or request channel.' }, { status: 400 });
  const assignee = await prisma.employee.findFirst({ where: { id: assigneeId, status: 'ACTIVE', approvalStatus: 'APPROVED' }, select: { id: true, legalName: true } });
  if (!assignee) return NextResponse.json({ error: 'Choose an active approved employee.' }, { status: 400 });
  const [accCase, channel] = await Promise.all([accountabilityCaseId ? prisma.accountabilityCase.findUnique({ where: { id: accountabilityCaseId }, include: { request: { include: { channel: true } } } }) : null, channelId ? prisma.requestChannel.findUnique({ where: { id: channelId }, include: { request: true } }) : null]);
  if (accountabilityCaseId && !accCase || channelId && !channel) return NextResponse.json({ error: 'The linked accountability case or request channel was not found.' }, { status: 404 });
  const task = await prisma.$transaction(async tx => {
    const created = await tx.followupTask.create({ data: { accountabilityCaseId, channelId, assigneeId, description, dueAt } });
    const req = accCase?.request || channel?.request;
    const linkedChannel = accCase?.request.channel || channel;
    let sendAssignmentAlert = true;
    if (req) {
      const setting = await tx.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId: req.subsidiaryId, key: 'notifications.preferences' } }, select: { value: true } });
      try { if (setting?.value && JSON.parse(setting.value).taskAssignmentAlerts === false) sendAssignmentAlert = false; } catch { /* Keep mandatory in-app alerts enabled when stored settings cannot be read. */ }
    }
    if (sendAssignmentAlert) await tx.systemNotification.create({ data: { employeeId: assigneeId, kind: 'FOLLOWUP_TASK_ASSIGNED', title: 'A follow-up task was assigned to you', body: description, linkUrl: '/' } });
    if (linkedChannel) await tx.channelMessage.create({ data: { channelId: linkedChannel.id, authorId: actor.id, authorName: actor.legalName, authorRole: actor.role, body: `Follow-up task assigned to ${assignee.legalName}: ${description}`, messageType: 'AUDIT_EVENT' } });
    if (req) await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: req.groupId, subsidiaryId: req.subsidiaryId, targetType: 'REQUEST', targetId: req.id, action: 'TASK_ASSIGNED', correlationId: `CORR-TASK-${randomUUID()}`, metadata: JSON.stringify({ taskId: created.id, assigneeId, description, dueAt }) } });
    return created;
  });
  return NextResponse.json({ task }, { status: 201 });
}
