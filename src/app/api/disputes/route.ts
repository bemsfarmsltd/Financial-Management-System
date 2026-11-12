import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dispatchNotification } from '@/lib/notifications/service';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'GMD'];

/**
 * GET /api/disputes
 * Staff: lists disputes filed by self.
 * Admin/GMD: lists all disputes across authorized scope.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Sign in to access disputes.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const subsidiary = searchParams.get('subsidiary') || 'ALL';

    const isAdmin = hasAnyRole(actor, ADMIN_ROLES);
    let where: any = {};

    if (!isAdmin) {
      // Staff can only view their own disputes
      where.employeeId = actor.id;
    } else if (subsidiary !== 'ALL') {
      const { resolveOrganizationScope } = await import('@/lib/organizations');
      const scope = await resolveOrganizationScope(subsidiary);
      if (!scope.isGroup) {
        where.subsidiaryId = { in: scope.organizationIds };
      }
    }

    if (status && status !== 'ALL') where.status = status.toUpperCase();
    if (category && category !== 'ALL') where.category = category.toUpperCase();

    const disputes = await prisma.staffDispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: { id: true, legalName: true, employeeNumber: true, role: true, avatarUrl: true },
        },
        subsidiary: {
          select: { id: true, legalName: true, code: true },
        },
        resolvedBy: {
          select: { id: true, legalName: true, role: true },
        },
        _count: { select: { messages: true } },
      },
    });

    const counts = {
      all: disputes.length,
      open: disputes.filter(d => d.status === 'OPEN').length,
      underReview: disputes.filter(d => d.status === 'UNDER_REVIEW').length,
      approved: disputes.filter(d => d.status === 'APPROVED').length,
      rejected: disputes.filter(d => d.status === 'REJECTED').length,
    };

    return NextResponse.json({ disputes, counts });
  } catch (error: any) {
    console.error('Error fetching staff disputes:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch disputes.' }, { status: 500 });
  }
}

/**
 * POST /api/disputes
 * File a new staff dispute or query.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Sign in to file a dispute.' }, { status: 401 });
    }

    const body = await request.json();
    const title = String(body.title || '').trim();
    const explanation = String(body.explanation || '').trim();
    const category = String(body.category || 'ATTENDANCE').toUpperCase();
    const targetRecordId = body.targetRecordId ? String(body.targetRecordId).trim() : null;
    const evidenceUrls = Array.isArray(body.evidenceUrls) ? body.evidenceUrls : [];

    if (!title || title.length < 5) {
      return NextResponse.json({ error: 'A descriptive dispute title (at least 5 characters) is required.' }, { status: 400 });
    }
    if (!explanation || explanation.length < 15) {
      return NextResponse.json({ error: 'Please provide a clear explanation (at least 15 characters) of the issue.' }, { status: 400 });
    }

    const validCategories = ['ATTENDANCE', 'LATENESS', 'DEDUCTION', 'PAYROLL', 'HR_DECISION'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: `Category must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    // Resolve staff primary subsidiary
    const assignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: actor.id, status: 'ACTIVE' },
      select: { subsidiaryId: true },
      orderBy: { isPrimary: 'desc' },
    });
    const subsidiaryId = assignment?.subsidiaryId;
    if (!subsidiaryId) {
      return NextResponse.json({ error: 'Your account is not assigned to an active subsidiary. Contact HR.' }, { status: 400 });
    }

    // Generate unique dispute number
    const count = await prisma.staffDispute.count();
    const year = new Date().getFullYear();
    const disputeNumber = `DSP-${year}-${String(count + 1).padStart(4, '0')}`;

    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.staffDispute.create({
        data: {
          disputeNumber,
          employeeId: actor.id,
          subsidiaryId,
          category,
          targetRecordId,
          title,
          explanation,
          evidenceUrls,
          status: 'OPEN',
        },
        include: {
          subsidiary: { select: { id: true, legalName: true, code: true } },
          employee: { select: { id: true, legalName: true, employeeNumber: true } },
        },
      });

      // Audit Log
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: subsidiaryId,
          subsidiaryId,
          correlationId: disputeNumber,
          targetType: 'STAFF_DISPUTE',
          targetId: created.id,
          action: 'STAFF_DISPUTE_FILED',
          metadata: JSON.stringify({
            disputeNumber,
            category,
            targetRecordId,
            title,
          }),
        },
      });

      return created;
    });

    // Notify HR / Admins of new dispute
    const admins = await prisma.employee.findMany({
      where: {
        role: { in: ADMIN_ROLES },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await dispatchNotification({
        employeeId: admin.id,
        subsidiaryId,
        category: 'ATTENDANCE',
        priority: 'IMPORTANT',
        kind: 'STAFF_DISPUTE_FILED',
        title: `⚠️ Dispute Filed: ${disputeNumber}`,
        body: `${actor.legalName} filed a dispute regarding ${category}: "${title}". Click to review explanation.`,
        actionLabel: 'Review Dispute',
        actionUrl: `/admin/disputes?id=${dispute.id}`,
        linkUrl: `/admin/disputes?id=${dispute.id}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Dispute ${disputeNumber} submitted successfully. HR and management have been notified.`,
      dispute,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error submitting staff dispute:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit dispute.' }, { status: 500 });
  }
}
