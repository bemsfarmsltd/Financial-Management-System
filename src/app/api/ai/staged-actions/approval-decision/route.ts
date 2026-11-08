import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (actor && actor.role !== 'GMD') return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access is exclusively for the GMD.'},{status:403});
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only authorized executives can stage approval decisions.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { request_id, decision } = body;
    const rawReason = (body.comment || body.reason || '').trim();

    if (!request_id || !decision) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'request_id and decision are required.' }, { status: 400 });
    }

    const norm = String(decision).toUpperCase().trim();
    let canonicalDecision = '';
    if (norm === 'APPROVE' || norm === 'APPROVED') {
      canonicalDecision = 'APPROVE';
    } else if (norm === 'DECLINE' || norm === 'DECLINED' || norm === 'REJECT' || norm === 'REJECTED') {
      canonicalDecision = 'DECLINE';
    } else if (norm === 'REQUEST_CLARIFICATION' || norm === 'NEEDS_CLARIFICATION' || norm === 'CLARIFICATION') {
      canonicalDecision = 'REQUEST_CLARIFICATION';
    } else {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'Decision must be APPROVED, DECLINED, or NEEDS_CLARIFICATION.' }, { status: 400 });
    }

    const reason = rawReason || (canonicalDecision !== 'APPROVE' ? 'Executive review action' : '');

    const item = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: request_id }, { requestNumber: request_id }],
      },
      include: {
        requester: true,
        subsidiary: true,
        vendor: true,
        approvalSteps: { orderBy: { stageIndex: 'asc' } },
      },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Fund request ${request_id} not found.` }, { status: 404 });
    }

    if (!['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(item.approvalStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'ALREADY_DECIDED',
          message: `Request ${item.requestNumber} is already ${item.approvalStatus} and cannot be decided again.`,
        },
        { status: 409 }
      );
    }

    if (canonicalDecision === 'APPROVE' && item.requestedById === actor.id && actor.role !== 'GMD') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'SEPARATION_OF_DUTIES',
          message: `Separation of duties policy: You cannot approve your own request ${item.requestNumber}.`,
        },
        { status: 403 }
      );
    }

    if (canonicalDecision !== 'APPROVE' && !rawReason) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'REASON_REQUIRED',
          message: 'A reason is required when declining or requesting clarification.',
        },
        { status: 400 }
      );
    }

    const amountFormatted = `₦${(Number(item.amountMinor) / 100).toLocaleString()}`;
    const materialPayload = {
      request_id: item.id,
      request_number: item.requestNumber,
      decision: canonicalDecision,
      reason: reason || null,
      amount_minor: Number(item.amountMinor),
      expected_version: item.requestVersion,
    };

    const actionText = canonicalDecision === 'APPROVE' ? 'Approve' : canonicalDecision === 'DECLINE' ? 'Decline' : 'Request clarification for';
    const summary = `${actionText} ${item.requestNumber} (${item.title}) — ${amountFormatted}`;

    const preview = {
      request_number: item.requestNumber,
      title: item.title,
      amount: amountFormatted,
      requester: item.requester?.legalName || 'Staff',
      subsidiary: item.subsidiary?.legalName || 'BEMS Group',
      vendor: item.vendor?.name || 'Direct / Internal',
      current_status: item.approvalStatus,
      decision_to_apply: canonicalDecision,
      reason: reason || 'Approved via Executive AI Copilot',
      history_steps: item.approvalSteps.length,
    };

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'approval_decision',
      targetSubsidiaryId: item.subsidiaryId,
      materialPayload,
      summary,
      preview,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
