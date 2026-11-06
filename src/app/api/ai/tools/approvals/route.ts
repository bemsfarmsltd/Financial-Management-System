import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { generateDisbursementLinks } from '@/lib/bank-utils';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor || !actor.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Executive access is required to view approval queues and disbursement links.' },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') || 'PENDING';
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
      { ok: false, error_code: 'FORBIDDEN', message: 'Only GMD or Super Admin can stage or execute approvals.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const identifier: string = (body.requestId || body.requestNumber || body.id || '').trim();
  const decision: string = (body.decision || 'APPROVE').toUpperCase().trim();
  const comment: string = (body.comment || body.reason || body.note || 'Authorized via BEMS AI Automation').trim();

  if (!identifier) {
    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: 'requestId or requestNumber is required.' },
      { status: 400 }
    );
  }

  if (
    ![
      'APPROVE',
      'APPROVED',
      'REJECT',
      'REJECTED',
      'DECLINE',
      'DECLINED',
      'REQUEST_CLARIFICATION',
      'CLARIFICATION_REQUESTED',
      'NEEDS_CLARIFICATION',
    ].includes(decision)
  ) {
    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: 'decision must be APPROVE, REJECT, or REQUEST_CLARIFICATION.' },
      { status: 400 }
    );
  }

  const canonicalDecision =
    decision === 'APPROVE' || decision === 'APPROVED'
      ? 'APPROVE'
      : decision === 'REQUEST_CLARIFICATION' || decision === 'CLARIFICATION_REQUESTED' || decision === 'NEEDS_CLARIFICATION'
      ? 'REQUEST_CLARIFICATION'
      : 'DECLINE';

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
      threeWayMatch: true,
      approvalSteps: { orderBy: { stageIndex: 'asc' } },
    },
  });

  if (!expReq) {
    return NextResponse.json(
      { ok: false, error_code: 'NOT_FOUND', message: `Fund request "${identifier}" not found.` },
      { status: 404 }
    );
  }

  if (!['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(expReq.approvalStatus)) {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'ALREADY_DECIDED',
        message: `Fund request ${expReq.requestNumber} is already ${expReq.approvalStatus} and cannot be decided again.`,
      },
      { status: 409 }
    );
  }

  if (canonicalDecision === 'APPROVE' && expReq.requestedById === actor.id && actor.role !== 'GMD') {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'SEPARATION_OF_DUTIES',
        message: `Separation of duties policy: You cannot approve your own request ${expReq.requestNumber}.`,
      },
      { status: 403 }
    );
  }

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

  // -------------------------------------------------------------
  // GOVERNANCE PROTOCOL: THE AI NEVER APPROVES DIRECTLY — IT ONLY STAGES.
  // The backend creates a cryptographic staged action with a button
  // for the GMD to click "Authorize & Execute Action".
  // -------------------------------------------------------------
  const staged = await stageAction({
    userId: actor.id,
    actionType: 'approval_decision',
    targetSubsidiaryId: expReq.subsidiaryId,
    materialPayload: {
      request_id: expReq.id,
      request_number: expReq.requestNumber,
      decision: canonicalDecision,
      reason: comment,
      amount_minor: Number(expReq.amountMinor),
      expected_version: expReq.requestVersion,
    },
    summary: `${
      canonicalDecision === 'APPROVE'
        ? 'Authorize disbursement for'
        : canonicalDecision === 'REQUEST_CLARIFICATION'
        ? 'Request clarification for'
        : 'Decline'
    } ${expReq.requestNumber} (${expReq.title}) — ₦${amountNaira.toLocaleString()}`,
    preview: {
      request_number: expReq.requestNumber,
      title: expReq.title,
      amount: `₦${amountNaira.toLocaleString()}`,
      requester: expReq.requester.legalName,
      subsidiary: expReq.subsidiary?.legalName || 'BEMS Group',
      decision_to_apply: canonicalDecision,
      reason: comment,
      beneficiary_name: beneficiary.name,
      beneficiary_bank: beneficiary.bankName,
      beneficiary_account: beneficiary.accountNumber,
      quick_pay_link: disbursementPayload?.quickPayUrl || `${baseUrl}/pay/${expReq.requestNumber}`,
    },
  });

  // Always return the staged action preview and require explicit human confirmation button click
  return NextResponse.json({
    ok: true,
    status: 'AWAITING_CONFIRMATION',
    requires_gmd_action: true,
    message: `Approval action for ${expReq.requestNumber} has been staged. In accordance with BEMS security governance, the AI cannot approve directly — the GMD must click the confirmation button to execute.`,
    staged_action_id: staged.staged_action_id,
    confirmation_hash: staged.confirmation_hash,
    confirmation_button: {
      label: 'Authorize & Execute Approval (GMD)',
      action_type: 'CONFIRM_STAGED_ACTION',
      endpoint: `/api/ai/staged-actions/${staged.staged_action_id}/confirm`,
      confirm_url: `${baseUrl}/api/ai/staged-actions/${staged.staged_action_id}/confirm`,
      method: 'POST',
      payload: {
        confirmed_by: actor.legalName,
        confirmation_hash: staged.confirmation_hash,
      },
    },
    staged_action: staged.staged_action,
    request: {
      id: expReq.id,
      requestNumber: expReq.requestNumber,
      title: expReq.title,
      amount: amountNaira,
      formattedAmount: `₦${amountNaira.toLocaleString()}`,
      status: expReq.approvalStatus,
      subsidiary: expReq.subsidiary?.legalName || 'BEMS Group',
      requester: expReq.requester.legalName,
    },
    beneficiary,
    disbursement: disbursementPayload,
    threeWayMatch: expReq.threeWayMatch
      ? {
          status: expReq.threeWayMatch.status,
          varianceMinor: Number(expReq.threeWayMatch.varianceMinor),
          matchedAt: expReq.threeWayMatch.matchedAt.toISOString(),
        }
      : null,
    gmdActionLink: disbursementPayload?.quickPayUrl || `${baseUrl}/pay/${expReq.requestNumber}`,
  });
}
