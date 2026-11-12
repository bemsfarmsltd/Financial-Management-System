import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dispatchNotification } from '@/lib/notifications/service';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'GMD'];

/**
 * GET /api/disputes/[id]
 * View full dispute details, linked record, and conversation timeline.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view dispute.' }, { status: 401 });

    const { id } = await params;
    const dispute = await prisma.staffDispute.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, legalName: true, employeeNumber: true, role: true, avatarUrl: true, workEmail: true },
        },
        subsidiary: {
          select: { id: true, legalName: true, code: true },
        },
        resolvedBy: {
          select: { id: true, legalName: true, role: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, legalName: true, role: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute record not found.' }, { status: 404 });
    }

    const isAdmin = hasAnyRole(actor, ADMIN_ROLES);
    if (!isAdmin && dispute.employeeId !== actor.id) {
      return NextResponse.json({ error: 'Forbidden: You can only view your own disputes.' }, { status: 403 });
    }

    // Optionally fetch linked record preview (AttendanceRecord or PayrollItem)
    let linkedRecord: any = null;
    if (dispute.targetRecordId) {
      if (['ATTENDANCE', 'LATENESS'].includes(dispute.category)) {
        linkedRecord = await prisma.attendanceRecord.findUnique({
          where: { id: dispute.targetRecordId },
          include: { station: { select: { name: true } } },
        });
      } else if (['DEDUCTION', 'PAYROLL'].includes(dispute.category)) {
        linkedRecord = await prisma.payrollItem.findUnique({
          where: { id: dispute.targetRecordId },
          include: { batch: { include: { period: true } } },
        });
      }
    }

    return NextResponse.json({ dispute, linkedRecord });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching dispute.' }, { status: 500 });
  }
}

/**
 * POST /api/disputes/[id]
 * Add a message/comment to the dispute thread.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to reply.' }, { status: 401 });

    const { id } = await params;
    const dispute = await prisma.staffDispute.findUnique({ where: { id } });
    if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });

    const isAdmin = hasAnyRole(actor, ADMIN_ROLES);
    if (!isAdmin && dispute.employeeId !== actor.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();
    const text = String(body.body || '').trim();
    if (!text) return NextResponse.json({ error: 'Message body cannot be empty.' }, { status: 400 });

    const msg = await prisma.staffDisputeMessage.create({
      data: {
        disputeId: id,
        senderId: actor.id,
        senderRole: actor.role,
        body: text,
      },
      include: {
        sender: { select: { id: true, legalName: true, role: true, avatarUrl: true } },
      },
    });

    // Notify the other party
    const targetRecipientId = isAdmin ? dispute.employeeId : (dispute.resolvedById || null);
    if (targetRecipientId && targetRecipientId !== actor.id) {
      await dispatchNotification({
        employeeId: targetRecipientId,
        subsidiaryId: dispute.subsidiaryId,
        category: 'ATTENDANCE',
        priority: 'IMPORTANT',
        kind: 'STAFF_DISPUTE_MESSAGE',
        title: `💬 New Message on Dispute ${dispute.disputeNumber}`,
        body: `${actor.legalName}: "${text.length > 120 ? text.slice(0, 117) + '...' : text}"`,
        actionLabel: 'Open Dispute',
        actionUrl: `/disputes?id=${dispute.id}`,
        linkUrl: `/disputes?id=${dispute.id}`,
      });
    }

    return NextResponse.json({ success: true, message: msg });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not post message.' }, { status: 500 });
  }
}

/**
 * PATCH /api/disputes/[id]
 * Decision / resolution by HR or Admin (APPROVE_CORRECTION, REJECT, UNDER_REVIEW, CLOSE).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to resolve dispute.' }, { status: 401 });

    if (!hasAnyRole(actor, ADMIN_ROLES)) {
      return NextResponse.json({ error: 'Executive or Super Admin authority required to resolve disputes.' }, { status: 403 });
    }

    const { id } = await params;
    const dispute = await prisma.staffDispute.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });

    const body = await request.json();
    const action = String(body.action || '').toUpperCase();
    const resolutionNotes = String(body.resolutionNotes || '').trim();

    if (!['APPROVE_CORRECTION', 'REJECT', 'UNDER_REVIEW', 'CLOSE'].includes(action)) {
      return NextResponse.json({ error: 'Action must be APPROVE_CORRECTION, REJECT, UNDER_REVIEW, or CLOSE.' }, { status: 400 });
    }

    if ((action === 'APPROVE_CORRECTION' || action === 'REJECT') && !resolutionNotes) {
      return NextResponse.json({ error: 'Please provide formal resolution notes explaining your decision.' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      let nextStatus = 'OPEN';
      if (action === 'APPROVE_CORRECTION') nextStatus = 'APPROVED';
      else if (action === 'REJECT') nextStatus = 'REJECTED';
      else if (action === 'UNDER_REVIEW') nextStatus = 'UNDER_REVIEW';
      else if (action === 'CLOSE') nextStatus = 'CLOSED';

      // 1. If APPROVE_CORRECTION for Attendance / Lateness, perform atomic record fix
      if (action === 'APPROVE_CORRECTION' && dispute.targetRecordId && ['ATTENDANCE', 'LATENESS'].includes(dispute.category)) {
        await tx.attendanceRecord.update({
          where: { id: dispute.targetRecordId },
          data: {
            status: 'EXCUSED',
            deductionPercent: 0,
            isManualOverride: true,
            overrideReason: `Dispute ${dispute.disputeNumber} approved by ${actor.legalName}: ${resolutionNotes}`,
            overrideById: actor.id,
          },
        });
      }

      // 2. Update Dispute
      const res = await tx.staffDispute.update({
        where: { id },
        data: {
          status: nextStatus,
          resolutionNotes: resolutionNotes || dispute.resolutionNotes,
          resolvedById: actor.id,
          resolvedAt: new Date(),
        },
      });

      // 3. Add formal resolution message to timeline
      await tx.staffDisputeMessage.create({
        data: {
          disputeId: id,
          senderId: actor.id,
          senderRole: actor.role,
          body: `Decision: ${action} by ${actor.legalName} (${actor.role}). Notes: ${resolutionNotes || 'Status updated.'}`,
        },
      });

      // 4. Audit Event
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: dispute.subsidiaryId,
          subsidiaryId: dispute.subsidiaryId,
          correlationId: dispute.disputeNumber,
          targetType: 'STAFF_DISPUTE',
          targetId: dispute.id,
          action: `STAFF_DISPUTE_${action}`,
          metadata: JSON.stringify({
            disputeNumber: dispute.disputeNumber,
            decision: action,
            resolutionNotes,
          }),
        },
      });

      return res;
    });

    // Notify employee of the decision
    const isApproved = action === 'APPROVE_CORRECTION';
    await dispatchNotification({
      employeeId: dispute.employeeId,
      subsidiaryId: dispute.subsidiaryId,
      category: 'ATTENDANCE',
      priority: isApproved ? 'IMPORTANT' : 'INFORMATIONAL',
      kind: isApproved ? 'STAFF_DISPUTE_APPROVED' : 'STAFF_DISPUTE_DECIDED',
      title: isApproved
        ? `✓ Dispute Approved: ${dispute.disputeNumber}`
        : `Dispute Update: ${dispute.disputeNumber} (${action})`,
      body: `${actor.legalName} (${actor.role}) updated your dispute: "${resolutionNotes || 'Review complete'}".`,
      actionLabel: 'View Dispute',
      actionUrl: `/disputes?id=${dispute.id}`,
      linkUrl: `/disputes?id=${dispute.id}`,
    });

    return NextResponse.json({
      success: true,
      message: `Dispute ${dispute.disputeNumber} marked as ${action}. Employee notified.`,
      dispute: updated,
    });
  } catch (error: any) {
    console.error('Error updating dispute:', error);
    return NextResponse.json({ error: error.message || 'Failed to update dispute.' }, { status: 500 });
  }
}
