import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { broadcastCompanyAnnouncement } from '@/lib/notifications/events';
import { NotificationPriority } from '@/lib/notifications/service';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'GMD'];

/**
 * GET /api/announcements
 * Fetch active announcements for the current user's scope.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view announcements.' }, { status: 401 });

    const assignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: actor.id, status: 'ACTIVE' },
      select: { subsidiaryId: true },
      orderBy: { isPrimary: 'desc' },
    });
    const userSubId = assignment?.subsidiaryId;

    const announcements = await prisma.companyAnnouncement.findMany({
      where: {
        OR: [
          { subsidiaryId: null }, // Group-wide
          ...(userSubId ? [{ subsidiaryId: userSubId }] : []),
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      include: {
        author: { select: { legalName: true, role: true } },
        subsidiary: { select: { legalName: true, code: true } },
      },
    });

    return NextResponse.json({ announcements });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching announcements.' }, { status: 500 });
  }
}

/**
 * POST /api/announcements
 * Create & broadcast an announcement (Super Admin & GMD only).
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to broadcast.' }, { status: 401 });

    if (!hasAnyRole(actor, ADMIN_ROLES)) {
      return NextResponse.json({ error: 'Executive or Super Admin authority required to post announcements.' }, { status: 403 });
    }

    const body = await request.json();
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const category = String(body.category || 'COMPANY_WIDE').toUpperCase();
    const priority = (String(body.priority || 'INFORMATIONAL').toUpperCase()) as NotificationPriority;
    const subsidiaryId = body.subsidiaryId ? String(body.subsidiaryId) : null;
    const expiresDays = parseInt(body.expiresDays || '30', 10);
    const expiresAt = expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000) : null;

    if (!title || title.length < 5) {
      return NextResponse.json({ error: 'Announcement title must be at least 5 characters.' }, { status: 400 });
    }
    if (!content || content.length < 10) {
      return NextResponse.json({ error: 'Announcement content must be at least 10 characters.' }, { status: 400 });
    }

    const announcement = await prisma.companyAnnouncement.create({
      data: {
        title,
        content,
        category,
        priority,
        subsidiaryId,
        authorId: actor.id,
        expiresAt,
      },
      include: {
        subsidiary: { select: { legalName: true, code: true } },
        author: { select: { legalName: true, role: true } },
      },
    });

    // Broadcast system notifications to all staff in this scope
    const deliveredCount = await broadcastCompanyAnnouncement({
      announcementId: announcement.id,
      title,
      content,
      category,
      priority,
      subsidiaryId,
      authorName: actor.legalName,
    });

    return NextResponse.json({
      success: true,
      message: `Announcement broadcast successfully to ${deliveredCount} team members.`,
      announcement,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error posting announcement:', error);
    return NextResponse.json({ error: error.message || 'Failed to post announcement.' }, { status: 500 });
  }
}
