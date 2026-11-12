import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getStaffNotificationPreferences, updateStaffNotificationPreferences } from '@/lib/notifications/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const subsidiary = searchParams.get('subsidiary') || searchParams.get('orgId');
  const category = searchParams.get('category') || undefined;
  const priority = searchParams.get('priority') || undefined;
  const status = searchParams.get('status') || undefined; // 'UNREAD' | 'READ' | 'ALL'
  const search = (searchParams.get('search') || '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
  const skip = (page - 1) * limit;

  // Base scope: current employee
  let whereClause: any = { employeeId: actor.id };

  // Status filter
  if (status === 'UNREAD') {
    whereClause.readAt = null;
  } else if (status === 'READ') {
    whereClause.readAt = { not: null };
  }

  // Category filter
  if (category && category !== 'ALL') {
    whereClause.category = category.toUpperCase();
  }

  // Priority filter
  if (priority && priority !== 'ALL') {
    whereClause.priority = priority.toUpperCase();
  }

  // Search keyword across title and body
  if (search) {
    whereClause.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { body: { contains: search, mode: 'insensitive' } },
      { kind: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Subsidiary filter
  if (subsidiary && subsidiary !== 'ALL') {
    const { resolveOrganizationScope } = await import('@/lib/organizations');
    const scope = await resolveOrganizationScope(subsidiary);
    if (!scope.isGroup) {
      whereClause.subsidiaryId = { in: scope.organizationIds };
    }
  }

  const [notifications, unreadCount, totalCount, preferences] = await Promise.all([
    prisma.systemNotification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        subsidiary: {
          select: { id: true, legalName: true, code: true, brandColor: true },
        },
        employee: {
          select: { legalName: true, role: true, employeeNumber: true },
        },
      },
    }),
    prisma.systemNotification.count({ where: { employeeId: actor.id, readAt: null } }),
    prisma.systemNotification.count({ where: whereClause }),
    getStaffNotificationPreferences(actor.id),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return NextResponse.json(
    {
      notifications,
      unreadCount,
      totalCount,
      page,
      limit,
      totalPages,
      preferences,
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
  );
}

export async function PATCH(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to update notifications.' }, { status: 401 });
  try {
    const body = await request.json();
    const notificationId = typeof body.notificationId === 'string' ? body.notificationId : '';
    const now = new Date();

    if (body.markAllRead === true) {
      await prisma.systemNotification.updateMany({
        where: { employeeId: actor.id, readAt: null },
        data: { readAt: now },
      });
      return NextResponse.json({ success: true, message: 'All notifications marked as read.' });
    }

    if (notificationId) {
      await prisma.systemNotification.updateMany({
        where: { id: notificationId, employeeId: actor.id, readAt: null },
        data: { readAt: now },
      });
      return NextResponse.json({ success: true, message: 'Notification marked as read.' });
    }

    // Toggle preferences
    if (body.preferences) {
      const updatedPrefs = await updateStaffNotificationPreferences(actor.id, body.preferences);
      return NextResponse.json({ success: true, preferences: updatedPrefs });
    }

    return NextResponse.json({ error: 'Choose a notification to mark as read or provide preferences.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not update notifications.' }, { status: 500 });
  }
}
