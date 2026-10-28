import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const subsidiary = searchParams.get('subsidiary') || searchParams.get('orgId');

  let whereClause: any = { employeeId: actor.id };

  if (subsidiary && subsidiary !== 'ALL') {
    const { resolveOrganizationScope } = await import('@/lib/organizations');
    const scope = await resolveOrganizationScope(subsidiary);
    if (!scope.isGroup) {
      // Find staff in this subsidiary to capture notifications for this subsidiary's staff/operations
      const subOrg = await prisma.organization.findFirst({
        where: { id: { in: scope.organizationIds } },
        select: { legalName: true, code: true }
      });
      const orgName = subOrg?.legalName || '';
      const orgCode = subOrg?.code || '';

      whereClause = {
        AND: [
          {
            OR: [
              { employeeId: actor.id },
              {
                employee: {
                  assignments: {
                    some: { subsidiaryId: { in: scope.organizationIds } }
                  }
                }
              }
            ]
          },
          ...(orgName ? [
            {
              OR: [
                { employee: { assignments: { some: { subsidiaryId: { in: scope.organizationIds } } } } },
                { title: { contains: orgCode, mode: 'insensitive' } },
                { body: { contains: orgName, mode: 'insensitive' } },
                { body: { contains: orgCode, mode: 'insensitive' } }
              ]
            }
          ] : [])
        ]
      };
    }
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.systemNotification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        employee: {
          select: { legalName: true, role: true, employeeNumber: true }
        }
      }
    }),
    prisma.systemNotification.count({ where: { ...whereClause, readAt: null } }),
  ]);

  return NextResponse.json(
    { notifications, unreadCount },
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
