import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requestIdentifierWhere, toSystemRequestId } from '@/lib/request-id';
import { enforceMobileVersionGate } from '@/lib/mobile-gate';
import { sendChatMessageEmail, sendApprovalDecisionEmail } from '@/lib/email';

const messageSelect = {
  id: true,
  authorId: true,
  authorName: true,
  authorRole: true,
  body: true,
  visibility: true,
  recipientId: true,
  attachmentUrl: true,
  attachmentName: true,
  createdAt: true,
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestNumber: string }> },
) {
  const gateBlock = await enforceMobileVersionGate(_request);
  if (gateBlock) return gateBlock;

  const actor = await getAuthenticatedEmployee(_request);
  if (!actor) return NextResponse.json({ error: 'Sign in to open request chat.' }, { status: 401 });

  const { requestNumber } = await params;
  const request = await prisma.expenditureRequest.findUnique({
    where: requestIdentifierWhere(requestNumber),
    include: { requester: true, approvalSteps: { include: { approver: true } }, channel: true },
  });
  if (!request?.channel) return NextResponse.json({ error: 'Request channel not found.' }, { status: 404 });

  const roleApprovers = await prisma.employee.findMany({
    where: { role: { in: request.approvalSteps.map((step) => step.assignedRole) }, status: 'ACTIVE', approvalStatus: 'APPROVED' },
    select: { id: true, legalName: true, role: true },
  });
  const activeExecutives = await prisma.employee.findMany({
    where: { role: { in: ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE', approvalStatus: 'APPROVED' },
    select: { id: true, legalName: true, role: true },
  });
  const participantMap = new Map<string, { id: string; name: string; role: string }>();
  participantMap.set(request.requester.id, { id: request.requester.id, name: request.requester.legalName, role: request.requester.role });
  for (const step of request.approvalSteps) {
    if (step.approver) participantMap.set(step.approver.id, { id: step.approver.id, name: step.approver.legalName, role: step.approver.role });
  }
  for (const employee of roleApprovers) participantMap.set(employee.id, { id: employee.id, name: employee.legalName, role: employee.role });
  for (const exec of activeExecutives) participantMap.set(exec.id, { id: exec.id, name: exec.legalName, role: exec.role });

  const participants = [...participantMap.values()];
  const isPrivileged = hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
  if (!isPrivileged && !participantMap.has(actor.id)) return NextResponse.json({ error: 'You are not part of this request.' }, { status: 403 });

  const messages = await prisma.channelMessage.findMany({
    where: {
      channelId: request.channel.id,
      OR: [
        { visibility: 'GROUP' },
        { visibility: 'PRIVATE', authorId: actor.id },
        { visibility: 'PRIVATE', recipientId: actor.id },
      ],
    },
    select: messageSelect,
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  return NextResponse.json({
    request: { systemId: toSystemRequestId(request.id), requestNumber: request.requestNumber, title: request.title },
    actor: { id: actor.id, name: actor.legalName, role: actor.role },
    participants,
    messages,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestNumber: string }> },
) {
  try {
    const gateBlock = await enforceMobileVersionGate(request);
    if (gateBlock) return gateBlock;

    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });

    const { requestNumber } = await params;
    const body = await request.json();
    const { action, text, decisionReason } = body;
    const req = await prisma.expenditureRequest.findUnique({
      where: requestIdentifierWhere(requestNumber),
      include: { channel: true, requester: true, approvalSteps: { include: { approver: true } } },
    });
    if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });

    const assignedEmployees = await prisma.employee.findMany({
      where: { role: { in: req.approvalSteps.map((step) => step.assignedRole) }, status: 'ACTIVE', approvalStatus: 'APPROVED' },
      select: { id: true, legalName: true, role: true },
    });
    const activeExecutives = await prisma.employee.findMany({
      where: { role: { in: ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE', approvalStatus: 'APPROVED' },
      select: { id: true, legalName: true, role: true },
    });
    const participantMap = new Map<string, { id: string; name: string; role: string }>();
    participantMap.set(req.requester.id, { id: req.requester.id, name: req.requester.legalName, role: req.requester.role });
    for (const step of req.approvalSteps) {
      if (step.approver) participantMap.set(step.approver.id, { id: step.approver.id, name: step.approver.legalName, role: step.approver.role });
    }
    for (const employee of assignedEmployees) participantMap.set(employee.id, { id: employee.id, name: employee.legalName, role: employee.role });
    for (const exec of activeExecutives) participantMap.set(exec.id, { id: exec.id, name: exec.legalName, role: exec.role });

    const privileged = hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
    if (!privileged && !participantMap.has(actor.id)) return NextResponse.json({ error: 'You are not part of this request.' }, { status: 403 });

    if (action === 'SEND_MESSAGE') {
      if (!req.channel) return NextResponse.json({ error: 'Request channel not found.' }, { status: 404 });
      const attachmentUrl = typeof body.attachmentUrl === 'string' && body.attachmentUrl.trim() ? body.attachmentUrl.trim() : null;
      const attachmentName = typeof body.attachmentName === 'string' && body.attachmentName.trim() ? body.attachmentName.trim() : null;
      const messageText = typeof text === 'string' ? text.trim() : (attachmentName ? `Attached: ${attachmentName}` : '');
      if ((!messageText && !attachmentUrl) || messageText.length > 4000) {
        return NextResponse.json({ error: 'Message must be between 1 and 4,000 characters or include an attachment.' }, { status: 400 });
      }
      const visibility = body.visibility === 'PRIVATE' ? 'PRIVATE' : 'GROUP';
      const recipientId = typeof body.recipientId === 'string' ? body.recipientId : null;
      if (visibility === 'PRIVATE') {
        if (!recipientId || recipientId === actor.id || !participantMap.has(recipientId)) {
          return NextResponse.json({ error: 'Choose one other person involved in this request.' }, { status: 400 });
        }
      }
      const message = await prisma.channelMessage.create({
        data: {
          channelId: req.channel.id,
          authorId: actor.id,
          authorName: actor.legalName,
          authorRole: actor.role,
          body: messageText || (attachmentName ? `Attached: ${attachmentName}` : 'File attached'),
          visibility,
          recipientId: visibility === 'PRIVATE' ? recipientId : null,
          attachmentUrl,
          attachmentName,
          messageType: 'USER',
        },
        select: messageSelect,
      });

      // Dispatch in-app notifications and real-time emails to all active conversation counterparts
      (async () => {
        try {
          const targetIds: string[] = [];
          if (visibility === 'PRIVATE' && recipientId) {
            targetIds.push(recipientId);
          } else {
            for (const p of participantMap.values()) {
              if (p.id !== actor.id) {
                targetIds.push(p.id);
              }
            }
          }

          if (targetIds.length > 0) {
            // 1. In-app notifications
            await prisma.systemNotification.createMany({
              data: targetIds.map((tid) => ({
                employeeId: tid,
                kind: 'CHAT',
                title: `New message on ${req.requestNumber} from ${actor.legalName}`,
                body: messageText.length > 120 ? `${messageText.slice(0, 120)}...` : messageText,
                linkUrl: `/requests/${req.requestNumber}`,
              })),
            });

            // 2. Immediate corporate email notifications
            const targetEmployees = await prisma.employee.findMany({
              where: { id: { in: targetIds } },
              select: { id: true, legalName: true, workEmail: true },
            });

            for (let i = 0; i < targetEmployees.length; i++) {
              const emp = targetEmployees[i];
              if (emp.workEmail) {
                if (i > 0) {
                  await new Promise((r) => setTimeout(r, 600));
                }
                await sendChatMessageEmail({
                  to: emp.workEmail,
                  recipientName: emp.legalName,
                  senderName: actor.legalName,
                  senderRole: actor.role,
                  messageText,
                  attachmentName,
                  requestNumber: req.requestNumber,
                  contextTitle: `Requisition: ${req.title} (${req.requestNumber})`,
                  actionUrl: `https://bemserp.work/requests/${req.requestNumber}`,
                }).catch((err) => console.error(`Failed to email chat recipient ${emp.workEmail}:`, err));
              }
            }
          }
        } catch (notifErr) {
          console.error('Chat notification dispatch error:', notifErr);
        }
      })();

      return NextResponse.json({ success: true, message });
    }

    const pendingStep = req.approvalSteps.find((step) => step.status === 'PENDING');
    if (!pendingStep) return NextResponse.json({ error: 'There is no pending approval decision.' }, { status: 409 });
    const canApprove = hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']) || actor.role === pendingStep.assignedRole;
    if (!canApprove) {
      return NextResponse.json({ error: 'This decision is assigned to another approver.' }, { status: 403 });
    }

    if (action === 'APPROVE' || action === 'REQUEST_CLARIFICATION' || action === 'REJECT') {
      if ((action === 'REQUEST_CLARIFICATION' || action === 'REJECT') && (typeof text !== 'string' || !text.trim())) {
        return NextResponse.json({ error: 'Add a reason before submitting this decision.' }, { status: 400 });
      }
      const approvalStatus = action === 'APPROVE'
        ? (req.approvalSteps.some((step) => step.stageIndex > pendingStep.stageIndex && step.status === 'PENDING') ? 'IN_REVIEW' : 'APPROVED')
        : action === 'REJECT' ? 'REJECTED' : 'CLARIFICATION_REQUESTED';
      await prisma.$transaction(async (tx) => {
        await tx.expenditureRequest.update({ where: { id: req.id }, data: { approvalStatus } });
        await tx.approvalStep.update({
          where: { id: pendingStep.id },
          data: {
            status: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'PENDING',
            approverId: actor.id,
            approverName: actor.legalName,
            decidedAt: new Date(),
            decisionReason: decisionReason || text || 'Approved by authorized reviewer.',
          },
        });
        if (req.channel) {
          await tx.channelMessage.create({
            data: {
              channelId: req.channel.id,
              authorId: actor.id,
              authorName: actor.legalName,
              authorRole: actor.role,
              messageType: action === 'REQUEST_CLARIFICATION' ? 'CLARIFICATION' : 'AUDIT_EVENT',
              body: action === 'APPROVE'
                ? `Request approved by ${actor.legalName}.${approvalStatus === 'IN_REVIEW' ? ' Routed to the next approval stage.' : ' Ready for Finance disbursement recording.'} ${decisionReason || ''}`.trim()
                : action === 'REJECT'
                  ? `Request declined by ${actor.legalName}: ${text}`
                  : `Clarification requested by ${actor.legalName}: ${text}`,
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            actorName: actor.legalName,
            actorRole: actor.role,
            groupId: req.groupId,
            subsidiaryId: req.subsidiaryId,
            targetType: 'REQUEST',
            targetId: req.id,
            action: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'CLARIFICATION_REQUESTED',
            correlationId: `CORR-${Date.now()}`,
            metadata: JSON.stringify({ requestNumber, decisionReason: decisionReason || text || null }),
          },
        });
      });

      // Dispatch decision email to the staff requester
      if (req.requester?.workEmail) {
        sendApprovalDecisionEmail({
          to: req.requester.workEmail,
          recipientName: req.requester.legalName,
          decision: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'CLARIFICATION_REQUESTED',
          decidedBy: actor.legalName,
          decidedByRole: actor.role,
          requestNumber: req.requestNumber,
          title: req.title,
          amountMinor: Number(req.amountMinor),
          reason: decisionReason || text || null,
        }).catch((err) => console.error('Failed to send decision email to requester:', err));
      }

      const requesterDisbursementAccount = action === 'APPROVE' ? {
        bankName: req.requester?.bankName || req.requester?.salaryBankName || null,
        accountNumber: req.requester?.accountNumber || req.requester?.salaryAccountNumber || null,
        accountName: req.requester?.accountName || req.requester?.salaryAccountName || req.requester?.legalName || '',
        requesterName: req.requester?.legalName || 'Requester',
        amountNaira: Number(req.amountMinor) / 100,
        amountMinor: req.amountMinor.toString(),
        currency: req.currency || 'NGN',
        title: req.title,
        requestNumber: req.requestNumber,
      } : null;

      return NextResponse.json({ success: true, approvalStatus, requesterDisbursementAccount });
    }
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('Action error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
