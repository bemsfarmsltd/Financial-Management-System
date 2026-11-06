import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/staged-actions/deadline-extension
 * Canonical staged proposal endpoint for accountability retirement deadline extensions.
 */
export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor || !actor.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Executive authority required to extend accountability deadlines.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const lookup = String(body.case_id || body.caseId || body.request_id || body.requestId || body.requestNumber || '').trim();
  const extensionHours = Number(body.extension_hours ?? body.extensionHours ?? 72);
  const reason = String(body.reason || `Extended by ${extensionHours}h via BEMI`).trim();

  if (!lookup) {
    return NextResponse.json(
      { ok: false, error_code: 'MISSING_CASE_ID', message: 'case_id or requestNumber is required.' },
      { status: 400 }
    );
  }

  const targetCase = await prisma.accountabilityCase.findFirst({
    where: {
      OR: [
        { id: lookup },
        { requestId: lookup },
        { request: { requestNumber: { equals: lookup, mode: 'insensitive' } } },
      ],
    },
    include: { request: true, owner: true },
  });

  if (!targetCase) {
    return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Accountability case "${lookup}" not found.` }, { status: 404 });
  }
  if (targetCase.status === 'CLOSED') {
    return NextResponse.json({ ok: false, error_code: 'CASE_CLOSED', message: 'Cannot extend deadline of a CLOSED accountability case.' }, { status: 409 });
  }

  const newDueAt = body.new_due_at || body.newDueAt
    ? new Date(body.new_due_at || body.newDueAt)
    : new Date(Math.max(Date.now(), new Date(targetCase.dueAt).getTime()) + extensionHours * 3600_000);

  const staged = await stageAction({
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
      reason,
    },
    preview: {
      operation: 'Extend Accountability Deadline',
      request_number: targetCase.request.requestNumber,
      staff_member: targetCase.owner.legalName,
      current_deadline: targetCase.dueAt.toISOString().split('T')[0],
      new_deadline: newDueAt.toISOString().split('T')[0],
      reason,
    },
  });

  return NextResponse.json({
    ok: true,
    staged: true,
    status: 'AWAITING_CONFIRMATION',
    ...staged,
  });
}

