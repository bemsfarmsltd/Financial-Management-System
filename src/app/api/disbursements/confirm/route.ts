import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actor = await getAuthenticatedEmployee(request);

    if (!actor) return NextResponse.json({ error: 'Sign in to confirm receipt.' }, { status: 401 });
    const disbursementId = typeof body.disbursementId === 'string' ? body.disbursementId : '';
    const decision = body.decision;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    if (!disbursementId || !['RECEIVED', 'NOT_RECEIVED', 'AMOUNT_MISMATCH'].includes(decision)) {
      return NextResponse.json({ error: 'Choose a payment and tell us whether the funds arrived.' }, { status: 400 });
    }
    if (decision !== 'RECEIVED' && !note) {
      return NextResponse.json({ error: 'Add a short note so Finance can investigate the issue.' }, { status: 400 });
    }

    const disbursement = await prisma.disbursement.findUnique({
      where: { id: disbursementId },
      include: { request: { include: { channel: true } }, payrollItem: { include: { employee: true, batch: { include: { period: true } } } }, recipientConfirmation: true },
    });
    if (!disbursement || (!disbursement.request && !disbursement.payrollItem)) return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
    const isPayrollPayment = !!disbursement.payrollItem;
    const recipientId = isPayrollPayment ? disbursement.beneficiaryEmployeeId : disbursement.request?.requestedById;
    if (recipientId !== actor.id) return NextResponse.json({ error: 'Only the employee receiving this payment can confirm receipt.' }, { status: 403 });
    if (!['AWAITING_RECIPIENT_CONFIRMATION', 'PENDING_VERIFICATION'].includes(disbursement.status) || disbursement.recipientConfirmation) {
      return NextResponse.json({ error: 'This payment has already been confirmed or flagged.' }, { status: 409 });
    }

    const received = decision === 'RECEIVED';
    const nextStatus = received ? 'RECIPIENT_CONFIRMED' : 'RECIPIENT_REPORTED_ISSUE';
    const paymentStatus = received ? 'RECIPIENT_CONFIRMED' : 'RECIPIENT_REPORTED_ISSUE';
    const admins = received ? [] : await prisma.employee.findMany({
      where: { role: { in: ['SYSTEM_ADMIN', 'GMD', 'FINANCE'] }, status: 'ACTIVE', approvalStatus: 'APPROVED' },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.recipientPaymentConfirmation.create({ data: { disbursementId, employeeId: actor.id, decision, note: note || null } });
      await tx.disbursement.update({ where: { id: disbursementId }, data: { status: nextStatus } });
      if (!isPayrollPayment && disbursement.requestId) await tx.expenditureRequest.update({ where: { id: disbursement.requestId }, data: { paymentStatus } });

      if (received && disbursement.requestId && disbursement.request) {
        await tx.accountabilityCase.upsert({
          where: { requestId: disbursement.requestId! },
          create: {
            requestId: disbursement.requestId!,
            ownerUserId: actor.id,
            requiredDeliverables: disbursement.request!.deliverable,
            dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'OPEN',
          },
          update: {},
        });
      }

      if (!isPayrollPayment && disbursement.request?.channel) {
        await tx.channelMessage.create({ data: {
          channelId: disbursement.request!.channel!.id,
          authorId: actor.id,
          authorName: actor.legalName,
          authorRole: actor.role,
          messageType: 'AUDIT_EVENT',
          body: received
            ? `${actor.legalName} confirmed receiving the funds. Accountability evidence is now due.`
            : `${actor.legalName} reported a payment issue (${decision === 'NOT_RECEIVED' ? 'funds not received' : 'amount mismatch'}): ${note}`,
        } });
      }

      await tx.auditEvent.create({ data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: disbursement.request?.groupId || disbursement.payerOrgId,
        subsidiaryId: disbursement.request?.subsidiaryId || undefined,
        targetType: 'DISBURSEMENT',
        targetId: disbursementId,
        action: received ? 'RECIPIENT_CONFIRMED' : 'RECIPIENT_REPORTED_ISSUE',
        correlationId: `CORR-RECIPIENT-${disbursementId}`,
        metadata: JSON.stringify({ requestNumber: disbursement.request?.requestNumber || null, payrollItemId: disbursement.payrollItemId || null, decision, note }),
      } });

      await tx.systemNotification.create({
        data: {
          employeeId: disbursement.recordedById,
          kind: received ? 'PAYMENT_RECEIPT_CONFIRMED' : 'PAYMENT_RECEIPT_ISSUE',
          title: received ? 'Staff confirmed payment receipt' : 'Staff reported a payment issue',
          body: `${actor.legalName} ${received ? 'confirmed receiving' : 'reported an issue with'} ${isPayrollPayment ? 'their payroll transfer' : `the payment for ${disbursement.request!.requestNumber}`}.${note ? ` ${note}` : ''}`,
          linkUrl: isPayrollPayment ? '/payroll' : `/requests/${disbursement.request!.requestNumber}`,
        },
      });

      if (!received && admins.length) {
        const requestNumber = disbursement.request?.requestNumber || `payroll ${disbursement.payrollItem?.batch.period.year}-${String(disbursement.payrollItem?.batch.period.month).padStart(2, '0')}`;
        await tx.systemNotification.createMany({ data: admins.map(({ id }) => ({
          employeeId: id,
          kind: 'PAYMENT_RECEIPT_ISSUE',
          title: 'Staff reported a payment issue',
          body: `${actor.legalName} reported an issue with payment for ${requestNumber}: ${note}`,
          linkUrl: isPayrollPayment ? '/payroll' : `/requests/${requestNumber}`,
        })) });
      }
      if (isPayrollPayment && received && disbursement.payrollItem) {
        const batchItems = await tx.payrollItem.findMany({ where: { batchId: disbursement.payrollItem.batchId }, include: { disbursement: true } });
        if (batchItems.every(item => item.disbursement?.id === disbursementId || item.disbursement?.status === 'RECIPIENT_CONFIRMED')) {
          await tx.payrollBatch.update({ where: { id: disbursement.payrollItem.batchId }, data: { status: 'DISBURSED' } });
        }
      }
    });

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error) {
    console.error('Recipient payment confirmation error:', error);
    return NextResponse.json({ error: 'Could not save the receipt confirmation.' }, { status: 500 });
  }
}
