import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);

    if (!actor) {
      return NextResponse.json({ unreadCount: 0, latestMessage: null });
    }

    const isAdmin = actor.role === 'GMD' || actor.role === 'SYSTEM_ADMIN' || actor.role === 'SUPER_ADMIN';

    if (isAdmin) {
      const [unreadCount, latest] = await Promise.all([
        prisma.staffAdminMessage.count({
          where: {
            isReadByAdmin: false,
            senderRole: 'STAFF',
          },
        }),
        prisma.staffAdminMessage.findFirst({
          where: {
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

      return NextResponse.json({
        isAdmin: true,
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
    } else {
      // Staff perspective
      const [unreadCount, latest] = await Promise.all([
        prisma.staffAdminMessage.count({
          where: {
            employeeId: actor.id,
            isReadByStaff: false,
            senderRole: { not: 'STAFF' },
          },
        }),
        prisma.staffAdminMessage.findFirst({
          where: {
            employeeId: actor.id,
            isReadByStaff: false,
            senderRole: { not: 'STAFF' },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return NextResponse.json({
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
    }
  } catch (error) {
    console.error('Error fetching unread chat messages:', error);
    return NextResponse.json({ unreadCount: 0, latestMessage: null }, { status: 500 });
  }
}

