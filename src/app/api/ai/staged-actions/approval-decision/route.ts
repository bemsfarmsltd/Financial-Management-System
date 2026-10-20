import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only authorized executives can stage approval decisions.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { request_id, decision, reason } = body;

    if (!request_id || !decision) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'request_id and decision are required.' }, { status: 400 });
    }

    if (!['APPROVE', 'DECLINE', 'REQUEST_CLARIFICATION'].includes(decision)) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'Decision must be APPROVE, DECLINE, or REQUEST_CLARIFICATION.' }, { status: 400 });
    }

    if (['DECLINE', 'REQUEST_CLARIFICATION'].includes(decision) && (!reason || !reason.trim())) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'Reason is mandatory when declining or requesting clarification.' }, { status: 400 });
    }

    const item = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: request_id }, { requestNumber: request_id }],
      },
      include: {
        requester: true,
        organization: true,
        vendor: true,
        approvalSteps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Fund request ${request_id} not found.` }, { status: 404 });
    }

    const amountFormatted = `₦${(Number(item.amountMinor) / 100).toLocaleString()}`;
    const materialPayload = {
      request_id: item.id,
      request_number: item.requestNumber,
      decision,
      reason: reason || null,
      amount_minor: Number(item.amountMinor),
    };

    const actionText = decision === 'APPROVE' ? 'Approve' : decision === 'DECLINE' ? 'Decline' : 'Request clarification for';
    const summary = `${actionText} ${item.requestNumber} (${item.title}) — ${amountFormatted}`;

    const preview = {
      request_number: item.requestNumber,
      title: item.title,
      amount: amountFormatted,
      requester: item.requester?.legalName || 'Staff',
      subsidiary: item.organization?.legalName || 'BEMS Group',
      vendor: item.vendor?.name || 'Direct / Internal',
      current_status: item.approvalStatus,
      decision_to_apply: decision,
      reason: reason || 'Approved via Executive AI Copilot',
      history_steps: item.approvalSteps.length,
    };

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'approval_decision',
      materialPayload,
      summary,
      preview,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
