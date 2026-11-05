import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { generateDisbursementLinks } from '@/lib/bank-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') || 'PENDING'; // PENDING | APPROVED | ALL
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

  const whereClause: any = {};
  if (statusFilter === 'PENDING') {
    whereClause.approvalStatus = { in: ['SUBMITTED', 'IN_REVIEW'] };
  } else if (statusFilter === 'APPROVED') {
    whereClause.approvalStatus = 'APPROVED';
  }

  const requests = await prisma.expenditureRequest.findMany({
    where: whereClause,
    include: {
      requester: {
        select: {
          id: true,
          legalName: true,
          employeeNumber: true,
          workEmail: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
        },
      },
      subsidiary: {
        select: { id: true, legalName: true, code: true },
      },
      vendor: {
        select: { id: true, name: true, bankName: true, accountNumber: true, accountName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const baseUrl = req.nextUrl.origin || 'https://bemserp.work';

  return NextResponse.json({
    ok: true,
    count: requests.length,
    requests: requests.map((r) => {
      const amountNaira = Number(r.amountMinor) / 100;
      const accountHolder = r.vendor
        ? {
            name: r.vendor.accountName || r.vendor.name,
            bankName: r.vendor.bankName || 'Not Set',
            accountNumber: r.vendor.accountNumber || 'Not Set',
            type: 'VENDOR',
          }
        : {
            name: r.requester.accountName || r.requester.legalName,
            bankName: r.requester.bankName || 'Not Set',
            accountNumber: r.requester.accountNumber || 'Not Set',
            type: 'STAFF',
          };

      const links = accountHolder.accountNumber !== 'Not Set'
        ? generateDisbursementLinks({
            amountNaira,
            accountNumber: accountHolder.accountNumber,
            accountName: accountHolder.name,
            bankName: accountHolder.bankName,
            reference: r.requestNumber,
            baseUrl,
          })
        : null;

      return {
        id: r.id,
        requestNumber: r.requestNumber,
        title: r.title,
        amount: amountNaira,
        formattedAmount: `₦${amountNaira.toLocaleString()}`,
        status: r.approvalStatus,
        category: r.category,
        requestType: r.requestType,
        subsidiary: r.subsidiary?.legalName || 'BEMS Group',
        requester: r.requester.legalName,
        createdAt: r.createdAt,
        accountDetails: accountHolder,
        disbursement: links,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Only GMD or Super Admin can record approval decisions.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const identifier: string = (body.requestId || body.requestNumber || body.id || '').trim();
  const decision: string = (body.decision || 'APPROVE').toUpperCase().trim();
  const comment: string = (body.comment || body.reason || body.note || 'Approved via AI Copilot Automation').trim();

  if (!identifier) {
    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: 'requestId or requestNumber is required.' },
      { status: 400 }
    );
  }

  if (!['APPROVE', 'APPROVED', 'REJECT', 'REJECTED', 'DECLINE', 'DECLINED'].includes(decision)) {
    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: 'decision must be APPROVE or REJECT.' },
      { status: 400 }
    );
  }

  const isApprove = decision === 'APPROVE' || decision === 'APPROVED';

  // Find expenditure request
  const expReq = await prisma.expenditureRequest.findFirst({
    where: {
      OR: [{ id: identifier }, { requestNumber: identifier }],
    },
    include: {
      requester: {
        select: {
          id: true,
          legalName: true,
          employeeNumber: true,
          workEmail: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
        },
      },
      subsidiary: {
        select: { id: true, legalName: true, code: true },
      },
      vendor: {
        select: { id: true, name: true, bankName: true, accountNumber: true, accountName: true },
      },
      approvalSteps: { orderBy: { stageIndex: 'asc' } },
    },
  });

  if (!expReq) {
    return NextResponse.json(
      { ok: false, error_code: 'NOT_FOUND', message: `Fund request "${identifier}" not found.` },
      { status: 404 }
    );
  }

  const newStatus = isApprove ? 'APPROVED' : 'REJECTED';
  const timestamp = new Date();

  // Update request status
  await prisma.expenditureRequest.update({
    where: { id: expReq.id },
    data: {
      approvalStatus: newStatus,
      updatedAt: timestamp,
    },
  });

  // Update pending approval step
  const pendingStep = expReq.approvalSteps.find((s) => s.status === 'PENDING');
  if (pendingStep) {
    await prisma.approvalStep.update({
      where: { id: pendingStep.id },
      data: {
        status: newStatus,
        decidedAt: timestamp,
        decisionReason: comment,
        approverId: actor.id,
        approverName: actor.legalName,
      },
    });
  }

  // Create audit event
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: expReq.subsidiaryId,
        subsidiaryId: expReq.subsidiaryId,
        targetType: 'REQUEST',
        targetId: expReq.id,
        action: newStatus,
        correlationId: `ai_approval_${Date.now()}`,
        metadata: JSON.stringify({
          requestNumber: expReq.requestNumber,
          decision: newStatus,
          comment,
          amountMinor: Number(expReq.amountMinor),
          via: 'AI_AGENT_TOOL',
        }),
      },
    });
  } catch {}

  const amountNaira = Number(expReq.amountMinor) / 100;
  const baseUrl = req.nextUrl.origin || 'https://bemserp.work';

  // Resolve beneficiary banking details
  const beneficiary = expReq.vendor
    ? {
        name: expReq.vendor.accountName || expReq.vendor.name,
        bankName: expReq.vendor.bankName || 'Not Registered',
        accountNumber: expReq.vendor.accountNumber || 'Not Registered',
        type: 'VENDOR',
      }
    : {
        name: expReq.requester.accountName || expReq.requester.legalName,
        bankName: expReq.requester.bankName || 'Not Registered',
        accountNumber: expReq.requester.accountNumber || 'Not Registered',
        type: 'STAFF',
      };

  const disbursementPayload = beneficiary.accountNumber !== 'Not Registered'
    ? generateDisbursementLinks({
        amountNaira,
        accountNumber: beneficiary.accountNumber,
        accountName: beneficiary.name,
        bankName: beneficiary.bankName,
        reference: expReq.requestNumber,
        baseUrl,
      })
    : null;

  return NextResponse.json({
    ok: true,
    decision: newStatus,
    message: `Request ${expReq.requestNumber} has been ${newStatus.toLowerCase()} successfully.`,
    request: {
      id: expReq.id,
      requestNumber: expReq.requestNumber,
      title: expReq.title,
      amount: amountNaira,
      formattedAmount: `₦${amountNaira.toLocaleString()}`,
      status: newStatus,
      subsidiary: expReq.subsidiary?.legalName || 'BEMS Group',
      requester: expReq.requester.legalName,
    },
    beneficiary,
    disbursement: disbursementPayload,
    gmdActionLink: disbursementPayload?.quickPayUrl || `${baseUrl}/requests/${expReq.requestNumber}`,
  });
}
