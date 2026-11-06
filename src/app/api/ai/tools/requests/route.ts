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
  if (errorResponse || !actor) return errorResponse!;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const isRecurring = searchParams.get('recurring') === 'true' ? true : undefined;
  const subsidiary = searchParams.get('subsidiary') || undefined;

  const where: any = {};
  if (!actor.isExecutive) {
    where.requestedById = actor.id;
  }
  if (status) where.approvalStatus = status.toUpperCase();
  if (isRecurring !== undefined) where.isRecurring = isRecurring;
  if (subsidiary) {
    where.subsidiary = {
      OR: [
        { id: subsidiary },
        { code: { equals: subsidiary, mode: 'insensitive' } },
        { legalName: { contains: subsidiary, mode: 'insensitive' } },
      ],
    };
  }

  const requests = await prisma.expenditureRequest.findMany({
    where,
    include: {
      subsidiary: { select: { id: true, code: true, legalName: true } },
      requester: { select: { id: true, legalName: true, role: true } },
      vendor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    count: requests.length,
    requests: requests.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      title: r.title,
      category: r.category,
      amount: Number(r.amountMinor) / 100,
      currency: r.currency,
      approvalStatus: r.approvalStatus,
      paymentStatus: r.paymentStatus,
      accountabilityStatus: r.accountabilityStatus,
      isRecurring: r.isRecurring,
      recurringInterval: r.recurringInterval,
      subsidiary: r.subsidiary,
      requester: r.requester,
      vendor: r.vendor,
      createdAt: r.createdAt,
    })),
  });
}

/**
 * POST /api/ai/tools/requests
 * Stage creation of a new Fund / Expenditure Request (or Recurring Commitment).
 */
export async function POST(request: NextRequest) {
  try {
    const { actor, errorResponse } = await authenticateAiToolRequest(request);
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
      subAction === 'DELETE_REQUEST'
    ) {
      const reqLookup = String(body.requestId || body.requestNumber || body.id || '').trim();
      if (!reqLookup) {
        return NextResponse.json({ ok: false, error: 'requestId or requestNumber is required.' }, { status: 400 });
      }
      const reqItem = await prisma.expenditureRequest.findFirst({
        where: { OR: [{ id: reqLookup }, { requestNumber: reqLookup }] },
      });
      if (!reqItem) {
        return NextResponse.json({ ok: false, error: `Request "${reqLookup}" not found.` }, { status: 404 });
      }

      const message = String(body.message || body.text || body.reason || 'Please provide additional clarification.').trim();
      const summary =
        subAction === 'DELETE_REQUEST'
          ? `Delete Unpaid Fund Request ${reqItem.requestNumber} (${reqItem.title})`
          : subAction === 'SEND_MESSAGE'
          ? `Post Message on Request ${reqItem.requestNumber}: "${message.slice(0, 50)}"`
          : `Request Clarification on ${reqItem.requestNumber}: "${message.slice(0, 50)}"`;

      const staged = await stageAction({
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

    const subsidiaryLookup = String(body.subsidiaryId || body.subsidiary_id || body.subsidiary || '').trim();
    const org = subsidiaryLookup
      ? await prisma.organization.findFirst({
          where: {
            OR: [
              { id: subsidiaryLookup },
              { code: { equals: subsidiaryLookup, mode: 'insensitive' } },
              { legalName: { contains: subsidiaryLookup, mode: 'insensitive' } },
            ],
          },
        })
      : (await prisma.organization.findFirst({ where: { type: 'SUBSIDIARY' } })) ||
        (await prisma.organization.findFirst());

    if (!org) {
      return NextResponse.json({ ok: false, error: 'Subsidiary organization not found.' }, { status: 404 });
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'request_creation',
      targetSubsidiaryId: org.id,
      summary: `Create ${isRecurring ? `Recurring (${recurringInterval}) ` : ''}Fund Request: "${title}" (₦${amount.toLocaleString()}) under ${org.legalName}`,
      materialPayload: {
        title,
        amount,
        currency,
        category,
        justification,
        deliverable,
        subsidiaryId: org.id,
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

