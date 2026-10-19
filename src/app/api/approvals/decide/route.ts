import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requestIdentifierWhere, toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to record an approval decision.' }, { status: 401 });
    const body = await request.json();
    const { requestId, requestIds, decision, note, disbursementAssigneeId } = body;
    const ids: string[] = Array.isArray(requestIds) && requestIds.length > 0 ? requestIds : requestId ? [requestId] : [];
    if (!ids.length) return NextResponse.json({ error: 'Choose at least one request.' }, { status: 400 });
    if (!['APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision type.' }, { status: 400 });
    }

    const results = [];
    for (const id of ids) {
      const expReq = await prisma.expenditureRequest.findUnique({
        where: requestIdentifierWhere(id),
        include: { approvalSteps: { orderBy: { stageIndex: 'asc' } }, channel: true },
      });
      if (!expReq) continue;
      const approvalSettings = await prisma.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId: expReq.subsidiaryId, key: 'approval.controls' } }, select: { value: true } });
      let policy: { requireDecisionReason?: boolean; requireAssignedDisbursementOwner?: boolean } = {};
      try { if (approvalSettings?.value) policy = JSON.parse(approvalSettings.value); } catch { policy = {}; }
      const requiresReason = policy.requireDecisionReason !== false;
      if (['REJECTED', 'CLARIFICATION_REQUESTED'].includes(decision) && requiresReason && (typeof note !== 'string' || !note.trim())) {
        return NextResponse.json({ error: 'Add a reason before rejecting or requesting clarification.' }, { status: 400 });
      }
      const pendingStep = expReq.approvalSteps.find((step) => step.status === 'PENDING');
      if (!pendingStep) return NextResponse.json({ error: `${expReq.requestNumber} has no pending approval step.` }, { status: 409 });
      if (actor.role !== 'SYSTEM_ADMIN' && actor.role !== pendingStep.assignedRole) {
        return NextResponse.json({ error: `${expReq.requestNumber} is assigned to another approver.` }, { status: 403 });
      }

      const timestamp = new Date();
      const nextStatus = decision === 'REJECTED'
        ? 'REJECTED'
        : decision === 'CLARIFICATION_REQUESTED'
          ? 'CLARIFICATION_REQUESTED'
          : expReq.approvalSteps.some((step) => step.stageIndex > pendingStep.stageIndex && step.status === 'PENDING')
            ? 'IN_REVIEW'
            : 'APPROVED';
      if (decision === 'APPROVED' && nextStatus === 'APPROVED' && policy.requireAssignedDisbursementOwner && !disbursementAssigneeId) {
        return NextResponse.json({ error: 'Assign an executive to record the payment before final approval.' }, { status: 400 });
      }
      let disbursementAssignee: { id: string; legalName: string } | null = null;
      if (decision === 'APPROVED' && disbursementAssigneeId) {
        if (ids.length !== 1 || nextStatus !== 'APPROVED') {
          return NextResponse.json({ error: 'A disbursement owner can only be assigned on the final approval of one request.' }, { status: 400 });
        }
        if (!['GMD', 'SYSTEM_ADMIN'].includes(actor.role)) {
          return NextResponse.json({ error: 'Only the GMD or System Admin can assign the disbursement owner.' }, { status: 403 });
        }
        disbursementAssignee = await prisma.employee.findFirst({
          where: {
            id: String(disbursementAssigneeId),
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            role: { in: ['SYSTEM_ADMIN', 'GMD', 'FINANCE'] },
          },
          select: { id: true, legalName: true },
        });
        if (!disbursementAssignee) return NextResponse.json({ error: 'Choose an active, approved executive who can record payments.' }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.approvalStep.update({
          where: { id: pendingStep.id },
          data: {
            status: decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING',
            approverId: actor.id,
            approverName: actor.legalName,
            decidedAt: timestamp,
            decisionReason: typeof note === 'string' && note.trim() ? note.trim() : 'Approved by authorized reviewer.',
          },
        });
        await tx.expenditureRequest.update({ where: { id: expReq.id }, data: {
          approvalStatus: nextStatus,
          updatedAt: timestamp,
          ...(disbursementAssignee ? { disbursementAssigneeId: disbursementAssignee.id } : {}),
        } });
        if (disbursementAssignee) {
          await tx.systemNotification.create({ data: {
            employeeId: disbursementAssignee.id,
            kind: 'DISBURSEMENT_ASSIGNED',
            title: 'Disbursement assigned to you',
            body: `${expReq.requestNumber} was approved and assigned to you to record the off-platform payment and upload its receipt.`,
            linkUrl: '/disbursements',
          } });
        }
        if (expReq.channel) {
          const actionText = decision === 'APPROVED'
            ? `Approved by ${actor.legalName}.${nextStatus === 'IN_REVIEW' ? ' Routed to the next approval stage.' : disbursementAssignee ? ` Disbursement recording and receipt upload assigned to ${disbursementAssignee.legalName}.` : ' Ready for Finance disbursement recording.'}`
            : decision === 'REJECTED'
              ? `Declined by ${actor.legalName}: ${note.trim()}`
              : `Clarification requested by ${actor.legalName}: ${note.trim()}`;
          await tx.channelMessage.create({
            data: { channelId: expReq.channel.id, authorId: actor.id, authorName: actor.legalName, authorRole: actor.role, body: actionText, messageType: decision === 'CLARIFICATION_REQUESTED' ? 'CLARIFICATION' : 'AUDIT_EVENT' },
          });
        }
        await tx.auditEvent.create({
          data: {
            actorId: actor.id, actorName: actor.legalName, actorRole: actor.role,
            groupId: expReq.groupId, subsidiaryId: expReq.subsidiaryId,
            targetType: 'REQUEST', targetId: expReq.id,
            action: decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'CLARIFICATION_REQUESTED',
            correlationId: `CORR-${Date.now()}`,
            metadata: JSON.stringify({ requestNumber: expReq.requestNumber, note: typeof note === 'string' ? note.trim() : null }),
          },
        });
      });
      results.push({ id: expReq.id, systemId: toSystemRequestId(expReq.id), requestNumber: expReq.requestNumber, status: nextStatus });
    }
    return NextResponse.json({ success: true, decision, processedCount: results.length, results });
  } catch (error) {
    console.error('Error recording approval decision:', error);
    return NextResponse.json({ error: 'Failed to process decision.' }, { status: 500 });
  }
}
