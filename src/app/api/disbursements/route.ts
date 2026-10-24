import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requestIdentifierWhere, toSystemRequestId } from '@/lib/request-id';
import crypto from 'crypto';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number): string {
  const naira = Number(minor) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(naira);
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view disbursements.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE', 'VERIFIER'])) return NextResponse.json({ error: 'Finance access is required.' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const subsidiary = searchParams.get('subsidiary') || 'ALL';

    const scopedOrgIds = await resolveOrganizationScope(subsidiary);
    const orgFilter = !scopedOrgIds.isGroup && scopedOrgIds.organizationIds.length > 0 ? { subsidiaryId: { in: scopedOrgIds.organizationIds } } : {};
    const payerOrgFilter = !scopedOrgIds.isGroup && scopedOrgIds.organizationIds.length > 0 ? { payerOrgId: { in: scopedOrgIds.organizationIds } } : {};

    // 1. Ready for Transfer (Approved, UNPAID)
    const approvedRequests = await prisma.expenditureRequest.findMany({
      where: {
        approvalStatus: 'APPROVED',
        paymentStatus: { in: ['UNPAID', 'RECIPIENT_REPORTED_ISSUE'] },
        ...orgFilter
      },
      include: {
        subsidiary: { select: { id: true, legalName: true, code: true } },
        requester: { select: { id: true, legalName: true, workEmail: true, role: true } },
        disbursementAssignee: { select: { id: true, legalName: true, role: true } },
        vendor: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Payments awaiting confirmation from the requesting staff member.
    const awaitingChecker = await prisma.disbursement.findMany({
      where: {
        status: { in: ['AWAITING_RECIPIENT_CONFIRMATION', 'RECIPIENT_REPORTED_ISSUE', 'PENDING_VERIFICATION'] },
        ...payerOrgFilter
      },
      include: {
        payerOrg: { select: { id: true, legalName: true, code: true } },
        recordedBy: { select: { id: true, legalName: true, workEmail: true } },
        receipt: { select: { id: true, fileName: true, fileUrl: true, sha256: true, mimeType: true, uploadedAt: true } },
        recipientConfirmation: { include: { employee: { select: { id: true, legalName: true } } } },
        request: {
          include: {
            requester: { select: { id: true, legalName: true, role: true } },
            vendor: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Payments whose receipt has been confirmed by the requesting staff member.
    const verifiedDisbursements = await prisma.disbursement.findMany({
      where: {
        status: 'RECIPIENT_CONFIRMED',
        ...(subsidiary !== 'ALL' ? { payerOrgId: subsidiary } : {})
      },
      include: {
        payerOrg: { select: { id: true, legalName: true, code: true } },
        recordedBy: { select: { id: true, legalName: true } },
        receipt: { select: { id: true, fileName: true, fileUrl: true, sha256: true, mimeType: true, uploadedAt: true } },
        recipientConfirmation: { include: { employee: { select: { id: true, legalName: true, role: true } } } },
        request: {
          include: {
            requester: { select: { id: true, legalName: true } },
            vendor: true
          }
        }
      },
      orderBy: { paidAt: 'desc' }
    });

    const pendingPayoutTotal = approvedRequests.reduce((acc, r) => acc + Number(r.amountMinor), 0);
    const awaitingCheckerTotal = awaitingChecker.reduce((acc, d) => acc + Number(d.amountMinor), 0);
    const totalDisbursed = verifiedDisbursements.reduce((acc, d) => acc + Number(d.amountMinor), 0);

    const safeApproved = approvedRequests.map(r => ({
      ...r,
      amountMinor: Number(r.amountMinor),
      amountFormatted: formatNaira(r.amountMinor),
      canRecord: !r.disbursementAssigneeId || r.disbursementAssigneeId === actor.id || actor.role === 'SYSTEM_ADMIN'
    }));

    const safeAwaiting = awaitingChecker.map(d => ({
      ...d,
      amountMinor: Number(d.amountMinor),
      amountFormatted: formatNaira(d.amountMinor),
      request: d.request ? {
        ...d.request,
        systemId: toSystemRequestId(d.request.id),
        amountMinor: Number(d.request.amountMinor),
        amountFormatted: formatNaira(d.request.amountMinor)
      } : null
    }));

    const safeVerified = verifiedDisbursements.map(d => ({
      ...d,
      amountMinor: Number(d.amountMinor),
      amountFormatted: formatNaira(d.amountMinor),
      request: d.request ? {
        ...d.request,
        systemId: toSystemRequestId(d.request.id),
        amountMinor: Number(d.request.amountMinor),
        amountFormatted: formatNaira(d.request.amountMinor)
      } : null
    }));

    const response = NextResponse.json({
      readyForTransfer: safeApproved,
      awaitingChecker: safeAwaiting,
      verifiedDisbursements: safeVerified,
      summary: {
        pendingPayoutTotalFormatted: formatNaira(pendingPayoutTotal),
        awaitingCheckerTotalFormatted: formatNaira(awaitingCheckerTotal),
        totalDisbursedFormatted: formatNaira(totalDisbursed),
        pendingCount: approvedRequests.length,
        awaitingCount: awaitingChecker.length,
        verifiedCount: verifiedDisbursements.length
      }
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
  } catch (error: any) {
    console.error('Error fetching disbursements:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch disbursements' }, { status: 500 });
  }
}

// Finance/GMD/System Admin records an off-platform bank transfer and notifies its requester.
export async function POST(req: NextRequest) {
  try {
    const maker = await getAuthenticatedEmployee(req);
    if (!maker) return NextResponse.json({ error: 'Sign in to record a payment.' }, { status: 401 });
    if (!hasAnyRole(maker, ['SYSTEM_ADMIN', 'GMD', 'FINANCE'])) return NextResponse.json({ error: 'Finance or GMD access is required to record a payment.' }, { status: 403 });
    const body = await req.formData();
    const requestIdentifier = String(body.get('requestId') || '');
    const payerOrgId = String(body.get('payerOrgId') || '');
    const beneficiaryName = String(body.get('beneficiaryName') || '');
    const beneficiaryBank = String(body.get('beneficiaryBank') || '');
    const beneficiaryAccount = String(body.get('beneficiaryAccount') || '');
    const amountMinor = String(body.get('amountMinor') || '');
    const externalReference = String(body.get('externalReference') || '');
    const bankName = String(body.get('bankName') || '');
    const receiptFile = body.get('receipt');

    if (!requestIdentifier || !payerOrgId || !externalReference || !bankName || !(receiptFile instanceof File)) {
      return NextResponse.json({ error: 'Complete the payment details and attach the actual bank slip.' }, { status: 400 });
    }
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(receiptFile.type) || receiptFile.size > 10 * 1024 * 1024 || receiptFile.size === 0) {
      return NextResponse.json({ error: 'Attach a PDF, PNG, or JPG bank slip up to 10 MB.' }, { status: 400 });
    }
    if (!/^\d+$/.test(amountMinor) || !Number.isSafeInteger(Number(amountMinor))) return NextResponse.json({ error: 'Payment amount is invalid.' }, { status: 400 });
    const fileBytes = Buffer.from(await receiptFile.arrayBuffer());
    const receiptHash = crypto.createHash('sha256').update(fileBytes).digest('hex');

    const request = await prisma.expenditureRequest.findUnique({ where: requestIdentifierWhere(requestIdentifier) });
    if (!request) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    const requestId = request.id;
    if (request.approvalStatus !== 'APPROVED') return NextResponse.json({ error: 'Only approved requests can be paid.' }, { status: 409 });
    if (request.disbursementAssigneeId && request.disbursementAssigneeId !== maker.id && maker.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'This disbursement is assigned to another executive.' }, { status: 403 });
    }
    if (request.paymentStatus === 'RECIPIENT_CONFIRMED') return NextResponse.json({ error: 'The requester has already confirmed this payment.' }, { status: 409 });
    if (BigInt(amountMinor) > request.amountMinor) return NextResponse.json({ error: 'Payment exceeds the approved amount.' }, { status: 400 });

    const activePayment = await prisma.disbursement.findFirst({
      where: { requestId, status: 'AWAITING_RECIPIENT_CONFIRMATION' },
    });
    if (activePayment) return NextResponse.json({ error: 'This request already has a payment awaiting staff confirmation.' }, { status: 409 });

    const existingRef = await prisma.disbursement.findFirst({
      where: { externalReference }
    });
    if (existingRef) {
      return NextResponse.json({ error: `Bank Reference ${externalReference} already recorded in system.` }, { status: 409 });
    }
    const duplicateReceipt = await prisma.paymentReceipt.findFirst({ where: { sha256: receiptHash } });
    if (duplicateReceipt) return NextResponse.json({ error: 'This exact bank slip has already been attached to another payment.' }, { status: 409 });

    const disbursement = await prisma.$transaction(async (tx) => {
      const created = await tx.disbursement.create({
        data: {
          requestId,
          payerOrgId,
          beneficiaryName: beneficiaryName || 'Approved Beneficiary',
          beneficiaryBank: beneficiaryBank || 'Access Bank PLC',
          beneficiaryAccount: beneficiaryAccount || '0000000000',
          amountMinor: BigInt(amountMinor),
          currency: request.currency,
          externalReference,
          bankName,
          recordedById: maker.id,
          status: 'AWAITING_RECIPIENT_CONFIRMATION',
          idempotencyKey: `IDEMP-${requestId}-${Date.now()}`,
        }
      });
      const receiptId = crypto.randomUUID();
      await tx.paymentReceipt.create({ data: {
        id: receiptId,
        disbursementId: created.id,
        fileName: receiptFile.name.replace(/[\\/]/g, '_').slice(0, 180),
        fileUrl: `/api/receipts/${receiptId}`,
        sha256: receiptHash,
        mimeType: receiptFile.type,
        fileData: fileBytes,
        uploadedById: maker.id,
      } });
      await tx.expenditureRequest.update({ where: { id: requestId }, data: { paymentStatus: 'AWAITING_RECIPIENT_CONFIRMATION' } });
      let accountabilityCase = await tx.accountabilityCase.findUnique({ where: { requestId } });
      if (!accountabilityCase) {
        const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        accountabilityCase = await tx.accountabilityCase.create({ data: { requestId, ownerUserId: request.requestedById, requiredDeliverables: request.deliverable, dueAt, status: 'OPEN' } });
        await tx.followupTask.create({ data: { accountabilityCaseId: accountabilityCase.id, assigneeId: request.requestedById, description: `Submit post-payment deliverables for ${request.requestNumber}`, dueAt } });
      }
      return { ...created, accountabilityCaseId: accountabilityCase.id };
    });

    await prisma.auditEvent.create({
      data: {
        actorId: maker.id,
        actorName: maker.legalName,
        actorRole: maker.role,
        groupId: payerOrgId,
        subsidiaryId: payerOrgId,
        targetType: 'DISBURSEMENT',
        targetId: disbursement.id,
        action: 'CREATED',
        correlationId: `CORR-DISB-${disbursement.id}`,
        metadata: JSON.stringify({ externalReference, bankName, amountMinor, receiptHash, receiptName: receiptFile.name })
      }
    });

    await prisma.systemNotification.create({ data: {
      employeeId: request.requestedById,
      kind: 'PAYMENT_CONFIRMATION_REQUIRED',
      title: 'Confirm receipt of funds',
      body: `A payment of ${formatNaira(BigInt(amountMinor))} was recorded for ${request.requestNumber}. Review the receipt and confirm whether you received it.`,
      linkUrl: `/requests/${request.requestNumber}`,
    } });

    await prisma.systemNotification.create({ data: {
      employeeId: request.requestedById,
      kind: 'ACCOUNTABILITY_EVIDENCE_DUE',
      title: 'Submit proof for your fund request',
      body: `Upload the required post-payment deliverables for ${request.requestNumber} by ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NG')}. Required: ${request.deliverable}`,
      linkUrl: '/',
    } });

    const channel = await prisma.requestChannel.findUnique({ where: { requestId } });
    if (channel) await prisma.channelMessage.create({ data: {
      channelId: channel.id,
      authorId: maker.id,
      authorName: maker.legalName,
      authorRole: maker.role,
      messageType: 'AUDIT_EVENT',
      body: `Payment recorded by ${maker.legalName} (reference ${externalReference}). The requester has been asked to confirm receipt.`,
    } });

    return NextResponse.json({
      success: true,
      disbursementId: disbursement.id,
      requestSystemId: toSystemRequestId(request.id),
      requestNumber: request.requestNumber,
      accountabilityCaseId: disbursement.accountabilityCaseId,
      sha256: receiptHash,
      message: 'Payment recorded. The requester has been notified to confirm receipt.'
    });
  } catch (error: any) {
    console.error('Error recording disbursement:', error);
    return NextResponse.json({ error: error.message || 'Failed to record disbursement' }, { status: 500 });
  }
}

// Payment receipt is confirmed by the requesting staff member, not by a separate checker.
export async function PATCH(req: NextRequest) {
  return NextResponse.json({ error: 'The requesting staff member confirms receipt from the request page.' }, { status: 410 });
}
