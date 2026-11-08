import { hasGmdFeatureAccess } from '@/lib/gmd-access';
import { getAiReadClient } from '@/lib/platform/scoped-database';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { generateDisbursementLinks } from '@/lib/bank-utils';
import { stageAction } from '@/lib/staged-actions';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { clampPagination, maskIdentifierPii } from '@/lib/platform/read-catalog';

export const dynamic = 'force-dynamic';

const ALLOWED_APPROVAL_STATUS_FILTERS = new Set([
  'PENDING',
  'SUBMITTED',
  'IN_REVIEW',
  'CLARIFICATION_REQUESTED',
  'APPROVED',
  'REJECTED',
  'ALL',
]);

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  const db = actor ? await getAiReadClient(actor) : prisma;
  if (errorResponse) return errorResponse;
  if (!actor || !actor.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Executive access is required to view approval queues and disbursement links.' },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const statusFilter = (url.searchParams.get('status') || 'PENDING').toUpperCase().trim();
  if (!ALLOWED_APPROVAL_STATUS_FILTERS.has(statusFilter)) {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'INVALID_STATUS_FILTER',
        message: `Invalid status filter "${statusFilter}". Allowed values: PENDING, SUBMITTED, IN_REVIEW, CLARIFICATION_REQUESTED, APPROVED, REJECTED, ALL.`,
      },
      { status: 400 }
    );
  }

  const requestedOrgId =
    url.searchParams.get('subsidiary') ||
    url.searchParams.get('organization_id') ||
    url.searchParams.get('subsidiary_id') ||
    actor.scopedOrganizationId ||
    'ALL';
  const scope = await resolveAuthorizedOrganizationScope(actor as any, requestedOrgId);
  if (scope.organizationIds.length === 0) {
    return NextResponse.json({
      ok: true,
      count: 0,
      scope: { isGroup: scope.isGroup, organizationIds: [] },
      requests: [],
    });
  }

  const { limit, offset } = clampPagination(
    url.searchParams.get('limit'),
    url.searchParams.get('offset'),
    50,
    20
  );
  const requestIdFilter = (url.searchParams.get('requestId') || url.searchParams.get('request_id') || '').trim();

  const whereClause: any = {
    subsidiaryId: { in: scope.organizationIds },
  };
  if (statusFilter === 'PENDING') {
    whereClause.approvalStatus = { in: ['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'] };
  } else if (statusFilter !== 'ALL') {
    whereClause.approvalStatus = statusFilter;
  }
  if (requestIdFilter) {
    whereClause.OR = [{ id: requestIdFilter }, { requestNumber: requestIdFilter }];
  }

  const requests = await db.expenditureRequest.findMany({
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
    skip: offset,
  });

  const baseUrl = req.nextUrl.origin || 'https://bemserp.work';

  return NextResponse.json({
    ok: true,
    count: requests.length,
    scope: {
      isGroup: scope.isGroup,
      organizationIds: scope.organizationIds,
    },
    requests: requests.map((r) => {
      const amountNaira = Number(r.amountMinor) / 100;
      const beneficiaryId = r.vendor ? r.vendor.id : r.requester.id;
      const beneficiaryType: 'VENDOR' | 'STAFF' = r.vendor ? 'VENDOR' : 'STAFF';
      const rawAccountNumber = r.vendor ? r.vendor.accountNumber : r.requester.accountNumber;
      const maskedAccountNumber = rawAccountNumber ? maskIdentifierPii(rawAccountNumber) || 'Not Set' : 'Not Set';

      const accountHolder = r.vendor
        ? {
            beneficiaryId: r.vendor.id,
            beneficiaryType: 'VENDOR' as const,
            name: r.vendor.accountName || r.vendor.name,
            bankName: r.vendor.bankName || 'Not Set',
            accountNumber: maskedAccountNumber,
            type: 'VENDOR' as const,
          }
        : {
            beneficiaryId: r.requester.id,
            beneficiaryType: 'STAFF' as const,
            name: r.requester.accountName || r.requester.legalName,
            bankName: r.requester.bankName || 'Not Set',
            accountNumber: maskedAccountNumber,
            type: 'STAFF' as const,
          };

      const links =
        requestIdFilter && rawAccountNumber
          ? generateDisbursementLinks({
              amountNaira,
              accountNumber: rawAccountNumber,
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
        subsidiaryId: r.subsidiaryId,
        subsidiary: r.subsidiary?.legalName || 'BEMS Group',
        requesterId: r.requester.id,
        requester: r.requester.legalName,
        beneficiaryId,
        beneficiaryType,
        createdAt: r.createdAt,
        accountDetails: accountHolder,
        ...(links ? { disbursement: links } : {}),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  const db = actor ? await getAiReadClient(actor) : prisma;
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Only GMD or Super Admin can stage or execute approvals.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const subAction = String(body.action || body.sub_action || '').toUpperCase().trim();
  const assigneeLookup = String(body.assignee_user_id || body.assigneeId || body.assignee || '').trim();

  // Support assigning a disbursement owner (payment_recorder)
  if (subAction === 'ASSIGN_DISBURSEMENT_OWNER' || subAction === 'ASSIGN_RECORDER' || assigneeLookup) {
    const reqIdLookup = String(body.requestId || body.requestNumber || body.request_id || body.id || '').trim();
    if (!reqIdLookup || !assigneeLookup) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'requestId and assignee_user_id are required to assign a disbursement owner.' },
        { status: 400 }
      );
    }

    const [targetReq, targetAssignee] = await Promise.all([
      db.expenditureRequest.findFirst({
        where: { OR: [{ id: reqIdLookup }, { requestNumber: reqIdLookup }] },
        include: { subsidiary: true },
      }),
      db.employee.findFirst({
        where: {
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          OR: [
            { id: assigneeLookup },
            { employeeNumber: { equals: assigneeLookup, mode: 'insensitive' } },
            { workEmail: { equals: assigneeLookup, mode: 'insensitive' } },
            { legalName: { equals: assigneeLookup, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    if (!targetReq) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Fund request "${reqIdLookup}" not found.` }, { status: 404 });
    }
    if (!targetAssignee) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Active employee "${assigneeLookup}" not found.` }, { status: 404 });
    }

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'payment_recorder',
      targetSubsidiaryId: targetReq.subsidiaryId,
      targetEmployeeId: targetAssignee.id,
      summary: `Assign ${targetAssignee.legalName} as Disbursement Recorder for ${targetReq.requestNumber} (${targetReq.title})`,
      materialPayload: {
        request_id: targetReq.id,
        request_number: targetReq.requestNumber,
        assignee_user_id: targetAssignee.id,
        note: String(body.note || body.reason || body.comment || 'Assigned via BEMI').trim(),
      },
      preview: {
        operation: 'Assign Disbursement Owner',
        request_number: targetReq.requestNumber,
        title: targetReq.title,
        assigned_recorder: `${targetAssignee.legalName} (${targetAssignee.employeeNumber})`,
        subsidiary: targetReq.subsidiary?.legalName || 'BEMS Group',
      },
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      status: 'AWAITING_CONFIRMATION',
      message: `Disbursement owner assignment for ${targetReq.requestNumber} has been staged.`,
      ...staged,
    });
  }

  // Support batch approval/decline/clarification when requestIds or requestNumbers array is provided
  const rawBatchList: string[] = Array.isArray(body.requestIds || body.request_ids || body.requestNumbers)
    ? (body.requestIds || body.request_ids || body.requestNumbers).map((x: any) => String(x || '').trim()).filter(Boolean)
    : [];

  const identifier: string = (body.requestId || body.requestNumber || body.id || rawBatchList[0] || '').trim();
  const decision: string = (body.decision || 'APPROVE').toUpperCase().trim();
  const comment: string = (body.comment || body.reason || body.note || 'Authorized via BEMS AI Automation').trim();

  if (!identifier && rawBatchList.length === 0) {
    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: 'requestId, requestNumber, or requestIds[] is required.' },
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

  if (rawBatchList.length > 1) {
    const batchReqs = await db.expenditureRequest.findMany({
      where: {
        OR: [{ id: { in: rawBatchList } }, { requestNumber: { in: rawBatchList } }],
      },
      include: {
        requester: { select: { id: true, legalName: true } },
        subsidiary: { select: { id: true, legalName: true, code: true } },
      },
    });
    if (batchReqs.length !== rawBatchList.length) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `One or more requests in the batch (${rawBatchList.join(', ')}) were not found.` },
        { status: 404 }
      );
    }
    for (const r of batchReqs) {
      if (!['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(r.approvalStatus)) {
        return NextResponse.json(
          { ok: false, error_code: 'ALREADY_DECIDED', message: `Request ${r.requestNumber} is already ${r.approvalStatus}.` },
          { status: 409 }
        );
      }
      if (canonicalDecision === 'APPROVE' && r.requestedById === actor.id && !hasGmdFeatureAccess(actor.role)) {
        return NextResponse.json(
          { ok: false, error_code: 'SEPARATION_OF_DUTIES', message: `You cannot approve your own request ${r.requestNumber}.` },
          { status: 403 }
        );
      }
    }

    const totalMinor = batchReqs.reduce((acc, r) => acc + r.amountMinor, BigInt(0));
    const totalNaira = Number(totalMinor) / 100;

    const stagedBatch = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'approval_decision',
      targetSubsidiaryId: batchReqs[0].subsidiaryId,
      summary: `Batch ${canonicalDecision} ${batchReqs.length} Fund Requests (${batchReqs.map((r) => r.requestNumber).join(', ')}) — Total ₦${totalNaira.toLocaleString()}`,
      materialPayload: {
        request_id: batchReqs[0].id,
        request_ids: batchReqs.map((r) => r.id),
        request_numbers: batchReqs.map((r) => r.requestNumber),
        expected_versions: Object.fromEntries(batchReqs.map((r) => [r.id, r.requestVersion])),
        decision: canonicalDecision,
        reason: comment,
        amount_minor: Number(totalMinor),
      },
      preview: {
        operation: `Batch ${canonicalDecision} (${batchReqs.length} Requests)`,
        requests: batchReqs.map((r) => `${r.requestNumber}: ${r.title} (₦${(Number(r.amountMinor) / 100).toLocaleString()})`),
        total_amount: `₦${totalNaira.toLocaleString()}`,
        decision_to_apply: canonicalDecision,
        reason: comment,
      },
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `Batch ${canonicalDecision.toLowerCase()} for ${batchReqs.length} requests has been staged.`,
      ...stagedBatch,
    });
  }

  // Find expenditure request
  const expReq = await db.expenditureRequest.findFirst({
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

  if (canonicalDecision === 'APPROVE' && expReq.requestedById === actor.id && !hasGmdFeatureAccess(actor.role)) {
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
          actorContext: actor,
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
