import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, isHrAuthorizedEmployee } from '@/lib/auth';
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

    const isHr = await isHrAuthorizedEmployee(actor);
    const isGmd = actor.role === 'GMD';
    const isSuperAdmin = actor.role === 'SYSTEM_ADMIN' || actor.role === 'SUPER_ADMIN';
    const isAdmin = isGmd || isSuperAdmin || isHr;

    if (isAdmin) {
      const channel = isHr ? 'HR' : (channelParam === 'HR' ? 'HR' : 'GMD');

      const [unreadCount, latest] = await Promise.all([
        prisma.staffAdminMessage.count({
          where: {
            channel,
            isReadByAdmin: false,
            senderRole: 'STAFF',
          },
        }),
        prisma.staffAdminMessage.findFirst({
          where: {
            channel,
            isReadByAdmin: false,
            senderRole: 'STAFF',
          },
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
    console.error('Error fetching unread chat messages:', error);
    return NextResponse.json({ unreadCount: 0, latestMessage: null }, { status: 500 });
  }
}
