import { executeDashboardCommand } from '@/lib/staged-actions';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';
const taskManagers = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'];

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to view follow-up tasks.' }, { status: 401 });
  if (!hasAnyRole(actor, [...taskManagers, 'STAFF'])) return NextResponse.json({ error: 'You are not allowed to view these tasks.' }, { status: 403 });
  const tasks = await prisma.followupTask.findMany({
    where: hasAnyRole(actor, taskManagers) ? undefined : { assigneeId: actor.id },
    include: { assignee: { select: { id: true, legalName: true, role: true } }, accountabilityCase: { include: { request: { select: { id: true, requestNumber: true, title: true } } } }, channel: { include: { request: { select: { id: true, requestNumber: true, title: true } } } } },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
  });
  return NextResponse.json({ tasks: tasks.map(task => ({ ...task, accountabilityCase: task.accountabilityCase ? { ...task.accountabilityCase, request: { ...task.accountabilityCase.request, systemId: toSystemRequestId(task.accountabilityCase.request.id) } } : null, channel: task.channel ? { ...task.channel, request: { ...task.channel.request, systemId: toSystemRequestId(task.channel.request.id) } } : null })) });
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to assign a task.' }, { status: 401 });
    const body = await request.json();
    const task = await executeDashboardCommand(actor, 'task_action', { ...body, sub_action: 'CREATE_TASK' });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
