import { getAiReadClient } from '@/lib/platform/scoped-database';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';
import { checkAiScopeOrResponse } from '@/lib/ai-access-control';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/tools/requests
 * Query expenditure requests and recurring commitments.
 */
export async function GET(request: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(request);
  const db = actor ? await getAiReadClient(actor) : prisma;
  if (errorResponse || !actor) return errorResponse!;

  const { searchParams } = new URL(request.url);
  const authorizedScope = await resolveAuthorizedOrganizationScope(actor as any, searchParams.get('subsidiary_id') || searchParams.get('subsidiary') || searchParams.get('organization_id') || 'ALL');

  const mode = (searchParams.get('mode') || '').toLowerCase();
  const status = searchParams.get('status') || undefined;
  const isRecurring =
    mode === 'recurring_commitments' || mode === 'recurring'
      ? true
      : searchParams.get('recurring') === 'true'
      ? true
      : undefined;
  const subsidiary = searchParams.get('subsidiary') || searchParams.get('organization_id') || undefined;
  const lookup = (searchParams.get('requestId') || searchParams.get('requestNumber') || searchParams.get('id') || searchParams.get('query') || searchParams.get('search') || '').trim();

  const where: any = { subsidiaryId: { in: authorizedScope.organizationIds } };
  if (!actor.isExecutive) {
    where.requestedById = actor.id;
  }
  if (status) where.approvalStatus = status.toUpperCase();
  if (isRecurring !== undefined) where.isRecurring = isRecurring;
  if (lookup) {
    where.OR = [
      { id: lookup },
      { requestNumber: { equals: lookup, mode: 'insensitive' } },
      { title: { contains: lookup, mode: 'insensitive' } },
    ];
  }
  if (subsidiary && subsidiary !== 'ALL') {
    where.subsidiary = {
      OR: [
        { id: subsidiary },
        { code: { equals: subsidiary, mode: 'insensitive' } },
        { legalName: { contains: subsidiary, mode: 'insensitive' } },
      ],
    };
  }

  const requests = await db.expenditureRequest.findMany({
    where,
    include: {
      subsidiary: { select: { id: true, code: true, legalName: true } },
      requester: { select: { id: true, legalName: true, role: true, employeeNumber: true, workEmail: true } },
      vendor: { select: { id: true, name: true } },
      approvalSteps: {
        include: {
          approver: { select: { id: true, legalName: true, role: true } },
        },
        orderBy: { stageIndex: 'asc' },
      },
      disbursements: {
        select: { id: true, status: true, paidAt: true, externalReference: true },
        orderBy: { paidAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const requestIds = requests.map((r) => r.id);
  const creditLots = requestIds.length
    ? await prisma.$queryRaw<
        Array<{
          id: string;
          requestId: string;
          amountMinor: bigint;
          availableMinor: bigint;
          heldMinor: bigint;
          settledMinor: bigint;
          returnedMinor: bigint;
          createdAt: Date;
          approverId: string | null;
          approverName: string | null;
          approverRole: string | null;
          approvedAt: Date | null;
        }>
      >`
        SELECT
          c."id",
          c."requestId",
          c."amountMinor",
          c."availableMinor",
          c."heldMinor",
          c."settledMinor",
          c."returnedMinor",
          c."createdAt",
          p."approvedById" AS "approverId",
          e."legalName" AS "approverName",
          e."role" AS "approverRole",
          p."approvedAt"
        FROM "WalletCreditLot" c
        LEFT JOIN "WalletReleaseProposal" p ON p."id" = c."proposalId"
        LEFT JOIN "Employee" e ON e."id" = p."approvedById"
        WHERE c."requestId" = ANY(${requestIds}::text[])
      `
    : [];

  const creditLotIds = creditLots.map((c) => c.id);
  const withdrawalRows = creditLotIds.length
    ? await prisma.$queryRaw<
        Array<{
          creditLotId: string;
          withdrawalId: string;
          allocatedMinor: bigint;
          reference: string;
          status: string;
          bankCode: string;
          accountNumber: string;
          accountName: string;
          createdAt: Date;
          updatedAt: Date;
        }>
      >`
        SELECT
          wa."creditLotId",
          w."id" AS "withdrawalId",
          wa."amountMinor" AS "allocatedMinor",
          w."reference",
          w."status",
          w."bankCode",
          w."accountNumber",
          w."accountName",
          w."createdAt",
          w."updatedAt"
        FROM "WalletWithdrawalAllocation" wa
        JOIN "WalletWithdrawal" w ON w."id" = wa."withdrawalId"
        WHERE wa."creditLotId" = ANY(${creditLotIds}::text[])
        ORDER BY w."createdAt" DESC
      `
    : [];

  const audits = requestIds.length
    ? await prisma.auditEvent.findMany({
        where: {
          OR: [
            { targetId: { in: requestIds } },
            ...(creditLotIds.length ? [{ targetId: { in: creditLotIds } }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    : [];

  const formatNaira = (minor: bigint | number) =>
    `₦${(Number(minor) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

  const enrichRequest = (r: (typeof requests)[0]) => {
    const lots = creditLots.filter((c) => c.requestId === r.id);
    const totalCredited = lots.reduce((s, c) => s + BigInt(c.amountMinor || 0), BigInt(0));
    const totalAvailable = lots.reduce((s, c) => s + BigInt(c.availableMinor || 0), BigInt(0));
    const totalHeld = lots.reduce((s, c) => s + BigInt(c.heldMinor || 0), BigInt(0));
    const totalSettled = lots.reduce((s, c) => s + BigInt(c.settledMinor || 0), BigInt(0));
    const totalReturned = lots.reduce((s, c) => s + BigInt(c.returnedMinor || 0), BigInt(0));

    const lotIdSet = new Set(lots.map((c) => c.id));
    const withdrawals = withdrawalRows
      .filter((w) => lotIdSet.has(w.creditLotId))
      .map((w) => ({
        reference: w.reference,
        amount: Number(w.allocatedMinor) / 100,
        amountFormatted: formatNaira(w.allocatedMinor),
        status: w.status,
        bankCode: w.bankCode,
        accountNumberMasked: w.accountNumber ? `******${w.accountNumber.slice(-4)}` : 'Not Set',
        accountName: w.accountName,
        requestedAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));

    const isCreditedToWallet = lots.length > 0 || r.paymentStatus === 'WALLET_CREDITED';
    const isCompletelyWithdrawn =
      (lots.length > 0 && totalSettled > BigInt(0) && totalAvailable === BigInt(0) && totalHeld === BigInt(0)) ||
      r.disbursements.some((d) => ['PAID', 'SETTLED', 'RECIPIENT_CONFIRMED'].includes(d.status));
    const hasPartialWithdrawal = totalSettled > BigInt(0) && !isCompletelyWithdrawn;

    const effectiveAccountabilityStatus =
      r.requestType === 'REIMBURSEMENT'
        ? 'NOT_REQUIRED'
        : isCreditedToWallet && !isCompletelyWithdrawn
        ? 'AWAITING_WITHDRAWAL'
        : r.accountabilityStatus;

    const approvedStep = r.approvalSteps.find((s) => s.status === 'APPROVED');
    const lotApprover = lots.find((l) => l.approverName);
    const reqAudits = audits.filter(
      (a) =>
        a.targetId === r.id ||
        lotIdSet.has(a.targetId) ||
        (a.metadata && a.metadata.includes(r.requestNumber))
    );
    const approvalAudit = reqAudits.find((a) =>
      [
        'GMD_WALLET_RELEASED',
        'AI_STAGED_APPROVAL_DECISION_EXECUTED',
        'DASHBOARD_APPROVAL_DECISION_EXECUTED',
        'REQUEST_APPROVED',
      ].includes(a.action)
    );

    const approverName =
      approvedStep?.approver?.legalName ||
      approvedStep?.approverName ||
      lotApprover?.approverName ||
      approvalAudit?.actorName ||
      (r.approvalStatus === 'APPROVED' ? 'GMD / Executive Approver' : null);
    const approverRole =
      approvedStep?.approver?.role ||
      lotApprover?.approverRole ||
      approvalAudit?.actorRole ||
      (r.approvalStatus === 'APPROVED' ? 'GMD' : null);
    const approvedAt =
      approvedStep?.decidedAt ||
      lotApprover?.approvedAt ||
      approvalAudit?.createdAt ||
      null;

    const walletSummaryNote = !isCreditedToWallet
      ? r.disbursements.length > 0
        ? `Disbursed directly via bank transfer (${r.disbursements[0].status}).`
        : 'Not yet credited to staff BEMS Wallet.'
      : isCompletelyWithdrawn
      ? `${r.requester.legalName} has completely withdrawn ${formatNaira(totalSettled)} from his/her BEMS Wallet to personal bank account. Accountability is now active.`
      : hasPartialWithdrawal
      ? `${r.requester.legalName} was credited ${formatNaira(totalCredited || r.amountMinor)} to BEMS Wallet, has withdrawn ${formatNaira(totalSettled)} to personal bank so far, and still has ${formatNaira(totalAvailable)} in BEMS Wallet. Accountability starts only after the money is completely withdrawn.`
      : `${r.requester.legalName} was credited ${formatNaira(totalCredited || r.amountMinor)} to his/her BEMS Wallet, and has NOT withdrawn the money to his/her personal bank account yet (₦0 withdrawn; ${formatNaira(totalAvailable || r.amountMinor)} still sitting in BEMS Wallet). Accountability only begins after the money is completely withdrawn to personal bank.`;

    return {
      id: r.id,
      requestNumber: r.requestNumber,
      title: r.title,
      category: r.category,
      requestType: r.requestType,
      amount: Number(r.amountMinor) / 100,
      amountMinor: r.amountMinor.toString(),
      formattedAmount: formatNaira(r.amountMinor),
      currency: r.currency,
      approvalStatus: r.approvalStatus,
      paymentStatus: r.paymentStatus,
      accountabilityStatus: effectiveAccountabilityStatus,
      isRecurring: r.isRecurring,
      recurringInterval: r.recurringInterval,
      neededBy: r.neededBy,
      subsidiary: r.subsidiary,
      requester: r.requester,
      preparedBy: {
        id: r.requester.id,
        name: r.requester.legalName,
        role: r.requester.role,
        employeeNumber: r.requester.employeeNumber,
        createdAt: r.createdAt,
      },
      approvedBy: approverName
        ? {
            name: approverName,
            role: approverRole,
            approvedAt,
            decisionReason: approvedStep?.decisionReason || 'Approved by Executive',
          }
        : null,
      approvalSteps: r.approvalSteps.map((s) => ({
        stepOrder: s.stageIndex,
        requiredRole: s.assignedRole,
        status: s.status,
        approverName: s.approver?.legalName || s.approverName || null,
        approverRole: s.approver?.role || s.assignedRole,
        decidedAt: s.decidedAt,
        decisionReason: s.decisionReason,
      })),
      walletWithdrawalStatus: {
        isCreditedToBemsWallet: isCreditedToWallet,
        creditedToWalletFormatted: formatNaira(totalCredited || (isCreditedToWallet ? r.amountMinor : BigInt(0))),
        availableInBemsWalletFormatted: formatNaira(totalAvailable || (isCreditedToWallet && !isCompletelyWithdrawn ? r.amountMinor : BigInt(0))),
        heldInPendingTransferFormatted: formatNaira(totalHeld),
        withdrawnToPersonalBankFormatted: formatNaira(totalSettled),
        returnedToCompanyFormatted: formatNaira(totalReturned),
        hasWithdrawnToPersonalBank: totalSettled > BigInt(0),
        isCompletelyWithdrawnToPersonalBank: isCompletelyWithdrawn,
        personalBankWithdrawals: withdrawals,
        summaryNote: walletSummaryNote,
      },
      auditTrail: reqAudits.slice(0, 10).map((a) => ({
        action: a.action,
        actorName: a.actorName,
        actorRole: a.actorRole,
        createdAt: a.createdAt,
      })),
      vendor: r.vendor,
      createdAt: r.createdAt,
    };
  };

  if (mode === 'recurring_commitments' || mode === 'recurring') {
    const annualMultipliers: Record<string, bigint> = {
      MONTHLY: BigInt(12),
      QUARTERLY: BigInt(4),
      ANNUAL: BigInt(1),
    };
    const nonRejected = requests.filter((r) => r.approvalStatus !== 'REJECTED');
    const approved = nonRejected.filter((r) => r.approvalStatus === 'APPROVED');
    const nextDue = approved
      .filter((r) => r.neededBy && new Date(r.neededBy).getTime() >= Date.now())
      .sort((a, b) => new Date(a.neededBy).getTime() - new Date(b.neededBy).getTime())[0];
    const annualRunRateMinor = approved.reduce((total, r) => {
      const mult = r.recurringInterval ? annualMultipliers[r.recurringInterval] : undefined;
      return total + (mult ? r.amountMinor * mult : BigInt(0));
    }, BigInt(0));

    return NextResponse.json({
      ok: true,
      mode: 'recurring_commitments',
      summary: {
        approvedCount: approved.length,
        pendingCount: nonRejected.filter((r) =>
          ['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(r.approvalStatus)
        ).length,
        annualRunRateMinor: annualRunRateMinor.toString(),
        annualRunRateNaira: Number(annualRunRateMinor) / 100,
        nextDueRequestId: nextDue?.id ?? null,
      },
      count: nonRejected.length,
      requests: nonRejected.map(enrichRequest),
    });
  }

  return NextResponse.json({
    ok: true,
    count: requests.length,
    requests: requests.map(enrichRequest),
  });
}

/**
 * POST /api/ai/tools/requests
 * Stage creation of a new Fund / Expenditure Request (or Recurring Commitment).
 */
export async function POST(request: NextRequest) {
  try {
    const { actor, errorResponse } = await authenticateAiToolRequest(request);
  const db = actor ? await getAiReadClient(actor) : prisma;
    if (errorResponse || !actor) return errorResponse!;

    const body = await request.json();
    const subAction = String(body.action || body.sub_action || 'CREATE_REQUEST').toUpperCase();

    const targetScope =
      subAction === 'SEND_MESSAGE' || subAction === 'REQUEST_CLARIFICATION' || subAction === 'CLARIFY'
        ? 'request_messages'
        : 'requests';
    const scopeBlocked = await checkAiScopeOrResponse(targetScope, 'write');
    if (scopeBlocked) return scopeBlocked;

    if (
      subAction === 'SEND_MESSAGE' ||
      subAction === 'REQUEST_CLARIFICATION' ||
      subAction === 'CLARIFY' ||
      subAction === 'DELETE_REQUEST' ||
      subAction === 'UPDATE_RECURRING' ||
      subAction === 'PAUSE_RECURRING' ||
      subAction === 'CANCEL_RECURRING'
    ) {
      const reqLookup = String(body.requestId || body.requestNumber || body.id || '').trim();
      if (!reqLookup) {
        return NextResponse.json({ ok: false, error: 'requestId or requestNumber is required.' }, { status: 400 });
      }
      const authorizedScope = await resolveAuthorizedOrganizationScope(actor as any, actor.scopedOrganizationId || 'ALL');
      const reqItem = await db.expenditureRequest.findFirst({
        where: {
          OR: [{ id: reqLookup }, { requestNumber: reqLookup }],
          subsidiaryId: { in: authorizedScope.organizationIds },
        },
      });
      if (!reqItem) {
        return NextResponse.json({ ok: false, error: `Request "${reqLookup}" not found.` }, { status: 404 });
      }

      if (
        subAction === 'UPDATE_RECURRING' ||
        subAction === 'PAUSE_RECURRING' ||
        subAction === 'CANCEL_RECURRING'
      ) {
        const nextRecurring = subAction === 'CANCEL_RECURRING' || subAction === 'PAUSE_RECURRING' ? false : true;
        const nextInterval = nextRecurring
          ? String(body.recurringInterval || body.recurring_interval || reqItem.recurringInterval || 'MONTHLY').toUpperCase()
          : null;
        const nextNeededBy = body.neededBy ? new Date(body.neededBy).toISOString() : reqItem.neededBy.toISOString();

        const recSummary =
          subAction === 'UPDATE_RECURRING'
            ? `Update Recurring Schedule for ${reqItem.requestNumber} (${nextInterval})`
            : `Stop Recurring Schedule for ${reqItem.requestNumber} (${reqItem.title})`;

        const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
          actionType: 'request_creation',
          targetSubsidiaryId: reqItem.subsidiaryId || undefined,
          summary: recSummary,
          materialPayload: {
            sub_action: subAction,
            requestId: reqItem.id,
            requestNumber: reqItem.requestNumber,
            isRecurring: nextRecurring,
            recurringInterval: nextInterval,
            neededBy: nextNeededBy,
          },
          preview: {
            operation: recSummary,
            request_number: reqItem.requestNumber,
            title: reqItem.title,
            recurring_active: nextRecurring,
            recurring_interval: nextInterval || 'NONE',
            next_due_date: nextNeededBy.split('T')[0],
          },
        });

        return NextResponse.json({
          ok: true,
          staged: true,
          status: 'AWAITING_CONFIRMATION',
          message: `${recSummary} has been staged. Click Confirm to execute.`,
          ...staged,
        });
      }

      const message = String(body.message || body.text || body.reason || 'Please provide additional clarification.').trim();
      const summary =
        subAction === 'DELETE_REQUEST'
          ? `Delete Unpaid Fund Request ${reqItem.requestNumber} (${reqItem.title})`
          : subAction === 'SEND_MESSAGE'
          ? `Post Message on Request ${reqItem.requestNumber}: "${message.slice(0, 50)}"`
          : `Request Clarification on ${reqItem.requestNumber}: "${message.slice(0, 50)}"`;

      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'request_creation',
        targetSubsidiaryId: reqItem.subsidiaryId || undefined,
        summary,
        materialPayload: {
          sub_action: subAction,
          requestId: reqItem.id,
          requestNumber: reqItem.requestNumber,
          message,
        },
        preview: {
          operation: subAction.replace(/_/g, ' '),
          request_number: reqItem.requestNumber,
          title: reqItem.title,
          ...(subAction !== 'DELETE_REQUEST' ? { message } : {}),
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: `${summary} has been staged. Click Confirm to execute.`,
        ...staged,
      });
    }
    const title = String(body.title || '').trim();
    const amount = Number(body.amount ?? body.amountNaira ?? 0);
    const category = String(body.category || 'OPERATIONS').trim().toUpperCase();
    const justification = String(body.justification || title).trim();
    const deliverable = String(body.deliverable || 'Operational deliverable').trim();
    const currency = String(body.currency || 'NGN').trim().toUpperCase();
    const isRecurring = Boolean(body.isRecurring ?? body.is_recurring);
    const recurringInterval = isRecurring ? String(body.recurringInterval || body.recurring_interval || 'MONTHLY').toUpperCase() : null;

    if (!title || !(amount > 0)) {
      return NextResponse.json(
        { ok: false, error: 'title and a positive amount are required to stage a fund request.' },
        { status: 400 }
      );
    }

    // Resolve requester (either the authenticated actor or an explicit Staff member when staged by an executive on their behalf)
    const requesterLookup = String(
      body.requestedById || body.requesterId || body.onBehalfOfEmployeeId || body.requesterName || ''
    ).trim();
    let targetRequester = {
      id: actor.id,
      legalName: actor.legalName,
      role: actor.role,
      primarySubsidiaryId: null as string | null,
    };

    if (requesterLookup && requesterLookup !== actor.id) {
      if (!actor.isExecutive) {
        return NextResponse.json(
          { ok: false, error: 'Only an executive (GMD or Super Admin) can stage a fund request on behalf of another staff member.' },
          { status: 403 }
        );
      }
      const foundEmp = await db.employee.findFirst({
        where: {
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          OR: [
            { id: requesterLookup },
            { employeeNumber: { equals: requesterLookup, mode: 'insensitive' } },
            { workEmail: { equals: requesterLookup, mode: 'insensitive' } },
            { legalName: { equals: requesterLookup, mode: 'insensitive' } },
          ],
        },
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
            take: 1,
          },
        },
      });
      if (!foundEmp) {
        return NextResponse.json(
          { ok: false, error: `Active target requester "${requesterLookup}" not found.` },
          { status: 404 }
        );
      }
      targetRequester = {
        id: foundEmp.id,
        legalName: foundEmp.legalName,
        role: foundEmp.role,
        primarySubsidiaryId: foundEmp.assignments[0]?.subsidiaryId || null,
      };
    } else {
      const ownAssignment = await db.employeeAssignment.findFirst({
        where: { employeeId: actor.id, status: 'ACTIVE' },
        orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
      });
      targetRequester.primarySubsidiaryId = ownAssignment?.subsidiaryId || null;
    }

    const subsidiaryLookup = String(
      body.subsidiaryId || body.subsidiary_id || body.subsidiary || targetRequester.primarySubsidiaryId || ''
    ).trim();
    if (!subsidiaryLookup) {
      return NextResponse.json(
        { ok: false, error: 'An explicit subsidiaryId (or active requester subsidiary assignment) is required to stage a fund request.' },
        { status: 400 }
      );
    }

    const org = await db.organization.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [
          { id: subsidiaryLookup },
          { code: { equals: subsidiaryLookup, mode: 'insensitive' } },
          { legalName: { equals: subsidiaryLookup, mode: 'insensitive' } },
        ],
      },
    });

    if (!org) {
      return NextResponse.json({ ok: false, error: `Active subsidiary organization "${subsidiaryLookup}" not found.` }, { status: 404 });
    }

    const createScope = await resolveAuthorizedOrganizationScope(actor as any, actor.scopedOrganizationId || 'ALL');
    if (!createScope.organizationIds.includes(org.id)) {
      return NextResponse.json({ ok: false, error: 'Cannot stage requests outside your authorized subsidiary workspace.' }, { status: 403 });
    }

    const isStagedOnBehalf = targetRequester.id !== actor.id;

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'request_creation',
      targetSubsidiaryId: org.id,
      targetEmployeeId: targetRequester.id,
      summary: `Create ${isRecurring ? `Recurring (${recurringInterval}) ` : ''}Fund Request: "${title}" (₦${amount.toLocaleString()}) under ${org.legalName}${isStagedOnBehalf ? ` on behalf of ${targetRequester.legalName}` : ''}`,
      materialPayload: {
        title,
        amount,
        currency,
        category,
        justification,
        deliverable,
        subsidiaryId: org.id,
        requestedById: targetRequester.id,
        stagedById: actor.id,
        departmentId: body.departmentId || null,
        vendorId: body.vendorId || null,
        isRecurring,
        recurringInterval,
        neededBy: body.neededBy || null,
      },
      preview: {
        operation: isRecurring ? 'Create Recurring Commitment' : 'Create Expenditure Request',
        title,
        amount: `${currency} ${amount.toLocaleString()}`,
        category,
        subsidiary: `${org.legalName} (${org.code})`,
        requester: targetRequester.legalName,
        ...(isStagedOnBehalf ? { staged_by_executive: actor.legalName } : {}),
        justification,
        ...(isRecurring ? { recurring_interval: recurringInterval } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      status: 'AWAITING_CONFIRMATION',
      message: `Fund request "${title}" (${currency} ${amount.toLocaleString()}) has been staged. Click Confirm to submit the request.`,
      ...staged,
    });
  } catch (error: any) {
    console.error('[AI Tool Requests POST Error]:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Failed to stage fund request.' }, { status: 500 });
  }
}

