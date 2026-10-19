import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 });
  const [notifications, unreadCount] = await Promise.all([
    prisma.systemNotification.findMany({ where: { employeeId: actor.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.systemNotification.count({ where: { employeeId: actor.id, readAt: null } }),
  ]);
  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to update notifications.' }, { status: 401 });
  try {
    const body = await request.json();
    const notificationId = typeof body.notificationId === 'string' ? body.notificationId : '';
    const now = new Date();
    if (body.markAllRead === true) {
      await prisma.systemNotification.updateMany({ where: { employeeId: actor.id, readAt: null }, data: { readAt: now } });
    } else if (notificationId) {
      await prisma.systemNotification.updateMany({ where: { id: notificationId, employeeId: actor.id, readAt: null }, data: { readAt: now } });
    } else {
      return NextResponse.json({ error: 'Choose a notification to mark as read.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not update notifications.' }, { status: 500 });
  }
}
