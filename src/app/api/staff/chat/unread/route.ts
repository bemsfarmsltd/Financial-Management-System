import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, getHrAuthorizationScope } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);

    if (!actor) {
      return NextResponse.json({ unreadCount: 0, latestMessage: null });
    }

    const { searchParams } = new URL(req.url);
    const channelParam = (searchParams.get('channel') || '').toUpperCase();

    const isGmd = actor.role === 'GMD';
    const isSuperAdmin = actor.role === 'SYSTEM_ADMIN' || actor.role === 'SUPER_ADMIN';
    const isExecutive = isGmd || isSuperAdmin;
    const hrScope = await getHrAuthorizationScope(actor);
    const isHrOnly = !isExecutive && hrScope.authorized;
    const isAdmin = isExecutive || isHrOnly;

    if (isAdmin) {
      if (isHrOnly && channelParam === 'GMD') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Executive role takes precedence over HR; executives can inspect GMD (default) or HR when requested
      const channel = isExecutive ? (channelParam === 'HR' ? 'HR' : 'GMD') : 'HR';

      const whereClause: any = {
        channel,
        isReadByAdmin: false,
        senderRole: 'STAFF',
      };

      if (isHrOnly && !hrScope.isGlobal) {
        whereClause.employee = {
          role: 'STAFF',
          assignments: {
            some: {
              subsidiaryId: { in: hrScope.subsidiaryIds },
              status: 'ACTIVE',
            },
          },
        };
      }

      const [unreadCount, latest] = await Promise.all([
        prisma.staffAdminMessage.count({
          where: whereClause,
        }),
        prisma.staffAdminMessage.findFirst({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          include: {
            employee: {
              select: {
                id: true,
                legalName: true,
                employeeNumber: true,
                avatarUrl: true,
              },
            },
          },
        }),
      ]);

      const response = NextResponse.json({
        isAdmin: true,
        channel,
        unreadCount,
        latestMessage: latest
          ? {
              id: latest.id,
              employeeId: latest.employeeId,
              senderName: latest.senderName,
              employeeName: latest.employee?.legalName || latest.senderName,
              message: latest.message,
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
      });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return response;
    } else {
      // Staff perspective
      const channelFilter = channelParam === 'HR' ? { channel: 'HR' } : channelParam === 'GMD' ? { channel: 'GMD' } : {};

      const [unreadCount, latest] = await Promise.all([
        prisma.staffAdminMessage.count({
          where: {
            employeeId: actor.id,
            ...channelFilter,
            isReadByStaff: false,
            senderRole: { not: 'STAFF' },
          },
        }),
        prisma.staffAdminMessage.findFirst({
          where: {
            employeeId: actor.id,
            ...channelFilter,
            isReadByStaff: false,
            senderRole: { not: 'STAFF' },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const response = NextResponse.json({
        isAdmin: false,
        unreadCount,
        latestMessage: latest
          ? {
              id: latest.id,
              employeeId: latest.employeeId,
              senderName: latest.senderName,
              message: latest.message,
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
      });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return response;
    }
  } catch (error) {
    console.error('Error fetching unread chat count:', error);
    return NextResponse.json({ unreadCount: 0, latestMessage: null });
  }
}
