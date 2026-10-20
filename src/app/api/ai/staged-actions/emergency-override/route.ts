import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only the Group Managing Director can execute an emergency override.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { request_id, justification } = body;

    if (!request_id) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'request_id is required.' }, { status: 400 });
    }

    const reqItem = await prisma.expenditureRequest.findFirst({
      where: { OR: [{ id: request_id }, { requestNumber: request_id }] },
      include: { requester: true, organization: true },
    });

    if (!reqItem) return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request ${request_id} not found.` }, { status: 404 });

    const amountFormatted = `₦${(Number(reqItem.amountMinor) / 100).toLocaleString()}`;

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'emergency_override',
      materialPayload: {
        request_id: reqItem.id,
        request_number: reqItem.requestNumber,
        justification: justification || 'GMD Operational Continuity Emergency Override',
        amount: Number(reqItem.amountMinor) / 100,
      },
      summary: `GMD Emergency Override: Authorize immediate payout for ${reqItem.requestNumber} (${amountFormatted})`,
      preview: {
        request_number: reqItem.requestNumber,
        title: reqItem.title,
        amount: amountFormatted,
        requester: reqItem.requester?.legalName || 'Staff',
        subsidiary: reqItem.organization?.legalName || 'BEMS Group',
        justification: justification || 'Emergency operational continuity',
        action: 'BYPASS_INTERMEDIATE_APPROVALS',
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
