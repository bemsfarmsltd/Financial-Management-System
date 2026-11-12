import { getAiReadClient } from '@/lib/platform/scoped-database';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/tools/accountability
 * List accountability retiral cases across the conglomerate.
 */
export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  const db = actor ? await getAiReadClient(actor) : prisma;
  if (errorResponse || !actor) return errorResponse!;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;

  const cases = await db.accountabilityCase.findMany({
    where: {
      ...(actor.isExecutive ? {} : { ownerUserId: actor.id }),
      ...(status ? { status: status.toUpperCase() } : {}),
    },
    include: {
      request: {
        select: {
          id: true,
          requestNumber: true,
          title: true,
          amountMinor: true,
          currency: true,
          paymentStatus: true,
          accountabilityStatus: true,
          subsidiary: { select: { id: true, code: true, legalName: true } },
        },
      },
      owner: { select: { id: true, legalName: true, employeeNumber: true, workEmail: true } },
    },
    orderBy: { dueAt: 'asc' },
    take: 50,
  });

  const caseRequestIds = cases.map((c) => c.request.id);
  const lots = caseRequestIds.length
    ? await prisma.$queryRaw<
        Array<{
          requestId: string;
          amountMinor: bigint;
          availableMinor: bigint;
          heldMinor: bigint;
          settledMinor: bigint;
        }>
      >`
        SELECT "requestId", "amountMinor", "availableMinor", "heldMinor", "settledMinor"
        FROM "WalletCreditLot"
        WHERE "requestId" = ANY(${caseRequestIds}::text[])
      `
    : [];

  const activeCases = cases.filter((c) => {
    const reqLots = lots.filter((l) => l.requestId === c.request.id);
    if (reqLots.length > 0 && c.status !== 'CLOSED') {
      const totalSettled = reqLots.reduce((s, l) => s + BigInt(l.settledMinor || 0), BigInt(0));
      const totalAvailable = reqLots.reduce((s, l) => s + BigInt(l.availableMinor || 0), BigInt(0));
      const totalHeld = reqLots.reduce((s, l) => s + BigInt(l.heldMinor || 0), BigInt(0));
      const isCompletelyWithdrawn = totalSettled > BigInt(0) && totalAvailable === BigInt(0) && totalHeld === BigInt(0);
      if (!isCompletelyWithdrawn) {
        return false; // Accountability does not start until money is completely withdrawn to personal bank
      }
    }
    return true;
  });

  return NextResponse.json({
    ok: true,
    count: activeCases.length,
    policyNote:
      'Accountability only begins AFTER a staff member has completely withdrawn the funds from their BEMS Wallet to their personal bank account.',
    cases: activeCases.map((c) => ({
      id: c.id,
      status: c.status,
      dueAt: c.dueAt,
      requiredDeliverables: c.requiredDeliverables,
      owner: c.owner,
      request: {
        ...c.request,
        amount: Number(c.request.amountMinor) / 100,
        amountMinor: c.request.amountMinor.toString(),
      },
    })),
  });
}

/**
 * POST /api/ai/tools/accountability
 * Stage accountability retiral clearance (`CLEAR_CASE`) or 72h SLA deadline extension (`EXTEND_DEADLINE`).
 */
export async function POST(req: NextRequest) {
  try {
    const { actor, errorResponse } = await authenticateAiToolRequest(req);
  const db = actor ? await getAiReadClient(actor) : prisma;
    if (errorResponse || !actor) return errorResponse!;

    const body = await req.json();
    const subAction = String(body.action || body.sub_action || 'CLEAR_CASE').toUpperCase();

    if (subAction === 'INITIALIZE_LEGACY_CASES' || subAction === 'INITIALIZE_CASES') {
      if (!actor.isExecutive) {
        return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
      }
      const legacyRequests = await db.expenditureRequest.findMany({
        where: { disbursements: { some: {} }, accountabilityCase: { is: null } },
        select: { id: true, requestNumber: true },
      });

      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'accountability_clearance',
        summary: `Initialize ${legacyRequests.length} historical accountability case(s) for disbursed requests`,
        materialPayload: {
          sub_action: 'INITIALIZE_LEGACY_CASES',
          eligible_count: legacyRequests.length,
        },
        preview: {
          operation: 'Initialize Legacy Accountability Cases',
          eligible_requests_count: legacyRequests.length,
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: `Staged initialization of ${legacyRequests.length} historical accountability case(s).`,
        ...staged,
      });
    }

    const lookup = String(body.caseId || body.case_id || body.requestId || body.requestNumber || '').trim();

    const targetCase = lookup
      ? await db.accountabilityCase.findFirst({
          where: {
            OR: [
              { id: lookup },
              { requestId: lookup },
              { request: { requestNumber: { equals: lookup, mode: 'insensitive' } } },
            ],
          },
          include: { request: true, owner: true },
        })
      : await db.accountabilityCase.findFirst({
          where: { status: { not: 'CLOSED' }, ...(actor.isExecutive ? {} : { ownerUserId: actor.id }) },
          include: { request: true, owner: true },
          orderBy: { dueAt: 'asc' },
        });

    if (!targetCase) {
      return NextResponse.json({ ok: false, error: 'Matching accountability case not found.' }, { status: 404 });
    }

    if (subAction === 'SUBMIT_EVIDENCE' || subAction === 'UPLOAD_EVIDENCE') {
      const isAuthorized =
        actor.isExecutive ||
        actor.id === targetCase.ownerUserId ||
        actor.id === targetCase.request.requestedById;
      if (!isAuthorized) {
        return NextResponse.json({ ok: false, error: 'Only the requester, case owner, or an executive can submit evidence.' }, { status: 403 });
      }
      const attachmentIds: string[] = Array.isArray(body.attachmentIds || body.attachment_ids)
        ? body.attachmentIds || body.attachment_ids
        : body.attachmentId
        ? [String(body.attachmentId)]
        : [];
      const notes = String(body.notes || body.description || 'Post-payment evidence submitted via BEMI').trim();

      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'accountability_clearance',
        targetSubsidiaryId: targetCase.request.subsidiaryId,
        attachmentIds,
        summary: `Submit Accountability Evidence for ${targetCase.request.requestNumber} (${targetCase.request.title})`,
        materialPayload: {
          sub_action: 'SUBMIT_EVIDENCE',
          case_id: targetCase.id,
          request_id: targetCase.requestId,
          request_number: targetCase.request.requestNumber,
          attachment_ids: attachmentIds,
          notes,
        },
        preview: {
          operation: 'Submit Accountability Evidence',
          request_number: targetCase.request.requestNumber,
          attachments_count: attachmentIds.length,
          notes,
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: `Accountability evidence submission for ${targetCase.request.requestNumber} has been staged.`,
        ...staged,
      });
    }

    if (!actor.isExecutive) {
      return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
    }

    if (subAction === 'REVIEW_CASE') {
      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'accountability_clearance',
        targetSubsidiaryId: targetCase.request.subsidiaryId,
        summary: `Review Accountability Evidence for ${targetCase.request.requestNumber} (${targetCase.owner.legalName})`,
        materialPayload: {
          sub_action: 'REVIEW_CASE',
          case_id: targetCase.id,
          request_number: targetCase.request.requestNumber,
          clearance_notes: body.notes || body.reason || 'Evidence reviewed by executive',
        },
        preview: {
          operation: 'Review Accountability Evidence',
          request_number: targetCase.request.requestNumber,
          staff_member: targetCase.owner.legalName,
          notes: body.notes || body.reason || 'Evidence reviewed by executive',
        },
      });
      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        ...staged,
      });
    }

    if (subAction === 'EXTEND_DEADLINE' || subAction === 'DEADLINE_EXTENSION') {
      const extensionHours = Number(body.extensionHours || body.hours || 72);
      const newDueAt = body.newDueAt
        ? new Date(body.newDueAt)
        : new Date(Math.max(Date.now(), new Date(targetCase.dueAt).getTime()) + extensionHours * 3600_000);

      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'deadline_extension',
        targetSubsidiaryId: targetCase.request.subsidiaryId,
        summary: `Extend Accountability Retiral Deadline for ${targetCase.request.requestNumber} (${targetCase.owner.legalName}) to ${newDueAt.toISOString().split('T')[0]}`,
        materialPayload: {
          case_id: targetCase.id,
          request_id: targetCase.requestId,
          extension_hours: extensionHours,
          new_due_at: newDueAt.toISOString(),
          expected_due_at: targetCase.dueAt.toISOString(),
          reason: body.reason || `Extended by ${extensionHours}h via BEMI`,
        },
        preview: {
          operation: 'Extend Accountability Deadline',
          request_number: targetCase.request.requestNumber,
          staff_member: targetCase.owner.legalName,
          current_deadline: targetCase.dueAt.toISOString().split('T')[0],
          new_deadline: newDueAt.toISOString().split('T')[0],
          reason: body.reason || `Extended by ${extensionHours}h`,
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        status: 'AWAITING_CONFIRMATION',
        message: `Accountability deadline extension for ${targetCase.request.requestNumber} has been staged.`,
        ...staged,
      });
    }

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'accountability_clearance',
      targetSubsidiaryId: targetCase.request.subsidiaryId,
      summary: `Grant Final Retiral Clearance for ${targetCase.request.requestNumber} (${targetCase.owner.legalName})`,
      materialPayload: {
        case_id: targetCase.id,
        request_number: targetCase.request.requestNumber,
        clearance_notes: body.notes || body.reason || 'Receipts verified and cleared via BEMI',
      },
      preview: {
        operation: 'Grant 72h Retiral Clearance',
        request_number: targetCase.request.requestNumber,
        staff_member: targetCase.owner.legalName,
        reconciled_action: 'CLOSED & RECONCILED',
      },
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      status: 'AWAITING_CONFIRMATION',
      message: `Retiral clearance for ${targetCase.request.requestNumber} has been staged. Click Confirm to close case.`,
      ...staged,
    });
  } catch (error: any) {
    console.error('[AI Tool Accountability POST Error]:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Failed to stage accountability action.' }, { status: 500 });
  }
}

