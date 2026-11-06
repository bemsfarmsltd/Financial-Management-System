import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/tools/hr-leave
 * List leave requests across the group or for the authenticated employee.
 */
export async function GET(request: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(request);
  if (errorResponse || !actor) return errorResponse!;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;

  const where: any = {};
  if (!actor.isExecutive) {
    where.employeeId = actor.id;
  }
  if (status) where.status = status.toUpperCase();

  const leaveRequests = await prisma.leaveRequest.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          legalName: true,
          jobTitle: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    count: leaveRequests.length,
    leaveRequests,
  });
}

/**
 * POST /api/ai/tools/hr-leave
 * Stage leave request creation, approval, or rejection.
 */
export async function POST(request: NextRequest) {
  try {
    const { actor, errorResponse } = await authenticateAiToolRequest(request);
    if (errorResponse || !actor) return errorResponse!;

    const body = await request.json();
    const subAction = String(body.action || body.sub_action || (body.leaveId || body.id ? 'APPROVE_LEAVE' : 'CREATE_LEAVE')).toUpperCase();

    if (subAction === 'CREATE_LEAVE') {
      const startDate = body.startDate || body.start_date;
      const endDate = body.endDate || body.end_date;
      const leaveType = String(body.leaveType || body.leave_type || 'ANNUAL').toUpperCase();
      const reason = String(body.reason || 'Personal leave request').trim();

      if (!startDate || !endDate) {
        return NextResponse.json({ ok: false, error: 'startDate and endDate are required to stage a leave request.' }, { status: 400 });
      }

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'leave_action',
        summary: `Submit ${leaveType} Leave Request (${startDate} to ${endDate})`,
        materialPayload: {
          sub_action: 'CREATE_LEAVE',
          employeeId: body.employeeId || actor.id,
          leaveType,
          startDate,
          endDate,
          reason,
          reliefOfficerName: body.reliefOfficerName || null,
        },
        preview: {
          operation: 'Submit Leave Request',
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: 'Leave request has been staged. Click Confirm to submit.',
        ...staged,
      });
    }

    if (!actor.isExecutive) {
      return NextResponse.json({ ok: false, error: 'Only GMD or Super Admin can approve or reject leave requests.' }, { status: 403 });
    }

    let leaveRecord = null;
    if (body.leaveId || body.id) {
      leaveRecord = await prisma.leaveRequest.findUnique({
        where: { id: String(body.leaveId || body.id) },
        include: { employee: true },
      });
    } else if (body.employeeName || body.employeeId) {
      const lookup = String(body.employeeName || body.employeeId).trim();
      leaveRecord = await prisma.leaveRequest.findFirst({
        where: {
          status: 'PENDING',
          employee: {
            OR: [
              { id: lookup },
              { legalName: { contains: lookup, mode: 'insensitive' } },
              { employeeNumber: { equals: lookup, mode: 'insensitive' } },
            ],
          },
        },
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!leaveRecord) {
      return NextResponse.json({ ok: false, error: 'Matching leave request not found.' }, { status: 404 });
    }

    const decision = subAction.includes('REJECT') || body.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'leave_action',
      summary: `${decision === 'APPROVED' ? 'Approve' : 'Reject'} ${leaveRecord.leaveType} Leave (${leaveRecord.startDate} to ${leaveRecord.endDate}) for ${leaveRecord.employee.legalName}`,
      materialPayload: {
        sub_action: decision === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
        leaveId: leaveRecord.id,
        decision,
        rejectionReason: body.rejectionReason || body.reason || null,
      },
      preview: {
        operation: `${decision === 'APPROVED' ? 'Approve' : 'Reject'} Leave Request`,
        staff_member: `${leaveRecord.employee.legalName} (${leaveRecord.employee.employeeNumber})`,
        leave_type: leaveRecord.leaveType,
        period: `${leaveRecord.startDate} to ${leaveRecord.endDate}`,
        decision,
      },
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      status: 'AWAITING_CONFIRMATION',
      message: `Leave ${decision.toLowerCase()} for ${leaveRecord.employee.legalName} has been staged. Click Confirm to commit.`,
      ...staged,
    });
  } catch (error: any) {
    console.error('[AI Tool HR Leave POST Error]:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Failed to stage leave action.' }, { status: 500 });
  }
}

