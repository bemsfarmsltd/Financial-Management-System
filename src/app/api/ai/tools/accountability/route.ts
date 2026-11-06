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
  if (errorResponse || !actor) return errorResponse!;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;

  const cases = await prisma.accountabilityCase.findMany({
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
          subsidiary: { select: { id: true, code: true, legalName: true } },
        },
      },
      owner: { select: { id: true, legalName: true, employeeNumber: true, workEmail: true } },
    },
    orderBy: { dueAt: 'asc' },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    count: cases.length,
    cases: cases.map((c) => ({
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
    if (errorResponse || !actor) return errorResponse!;
    if (!actor.isExecutive) {
      return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
    }

    const body = await req.json();
    const subAction = String(body.action || body.sub_action || 'CLEAR_CASE').toUpperCase();
    const lookup = String(body.caseId || body.case_id || body.requestId || body.requestNumber || '').trim();

    const targetCase = lookup
      ? await prisma.accountabilityCase.findFirst({
          where: {
            OR: [
              { id: lookup },
              { requestId: lookup },
              { request: { requestNumber: { equals: lookup, mode: 'insensitive' } } },
            ],
          },
          include: { request: true, owner: true },
        })
      : await prisma.accountabilityCase.findFirst({
          where: { status: { not: 'CLOSED' } },
          include: { request: true, owner: true },
          orderBy: { dueAt: 'asc' },
        });

    if (!targetCase) {
      return NextResponse.json({ ok: false, error: 'Matching accountability case not found.' }, { status: 404 });
    }

    if (subAction === 'EXTEND_DEADLINE' || subAction === 'DEADLINE_EXTENSION') {
      const extensionHours = Number(body.extensionHours || body.hours || 72);
      const newDueAt = body.newDueAt
        ? new Date(body.newDueAt)
        : new Date(Math.max(Date.now(), new Date(targetCase.dueAt).getTime()) + extensionHours * 3600_000);

      const staged = await stageAction({
        actorId: actor.id,
        actionType: 'deadline_extension',
        summary: `Extend Accountability Retiral Deadline for ${targetCase.request.requestNumber} (${targetCase.owner.legalName}) to ${newDueAt.toISOString().split('T')[0]}`,
        materialPayload: {
          case_id: targetCase.id,
          request_id: targetCase.requestId,
          new_due_at: newDueAt.toISOString(),
          reason: body.reason || `Extended by ${extensionHours}h via BEMI`,
        },
        preview: {
          operation: 'Extend Accountability Deadline',
          request_number: targetCase.request.requestNumber,
          staff_member: targetCase.owner.legalName,
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
      actorId: actor.id,
      actionType: 'accountability_clearance',
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

