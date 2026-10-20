import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or System Admin can stage accountability clearance.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { case_id, clearance_notes } = body;

    if (!case_id) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'case_id is required.' }, { status: 400 });
    }

    const accCase = await prisma.accountabilityCase.findFirst({
      where: { OR: [{ id: case_id }, { request: { requestNumber: case_id } }] },
      include: { request: true, owner: true },
    });

    if (!accCase) return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Case ${case_id} not found.` }, { status: 404 });

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'accountability_clearance',
      materialPayload: {
        case_id: accCase.id,
        request_number: accCase.request?.requestNumber,
        clearance_notes: clearance_notes || 'Receipts verified & cleared via Executive AI',
      },
      summary: `Grant final retiral clearance for case ${accCase.request?.requestNumber || 'ADV'} (${accCase.owner?.legalName})`,
      preview: {
        request_number: accCase.request?.requestNumber,
        requester: accCase.owner?.legalName,
        current_status: accCase.status,
        new_status: 'RECONCILED',
        clearance_notes: clearance_notes || 'Receipts verified & cleared',
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
