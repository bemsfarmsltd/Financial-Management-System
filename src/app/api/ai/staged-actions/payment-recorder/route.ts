import { hasGmdFeatureAccess } from '@/lib/gmd-access';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (actor && !hasGmdFeatureAccess(actor.role)) return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access requires GMD or an authorized Super Admin.'},{status:403});
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only authorized executives can stage disbursement recorder assignments.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { request_id, assignee_user_id, note } = body;

    if (!request_id || !assignee_user_id) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'request_id and assignee_user_id are required.' }, { status: 400 });
    }

    const [reqItem, assignee] = await Promise.all([
      prisma.expenditureRequest.findFirst({ where: { OR: [{ id: request_id }, { requestNumber: request_id }] } }),
      prisma.employee.findUnique({ where: { id: assignee_user_id } }),
    ]);

    if (!reqItem) return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request ${request_id} not found.` }, { status: 404 });
    if (!assignee || assignee.status !== 'ACTIVE') {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Active assignee ${assignee_user_id} not found.` }, { status: 404 });
    }
    if (reqItem.approvalStatus !== 'APPROVED') {
      return NextResponse.json(
        { ok: false, error_code: 'PRECONDITION_FAILED', message: `Request ${reqItem.requestNumber} must be APPROVED before assigning a payment recorder.` },
        { status: 400 }
      );
    }

    const materialPayload = {
      request_id: reqItem.id,
      request_number: reqItem.requestNumber,
      assignee_user_id: assignee.id,
      assignee_name: assignee.legalName,
      note: note || '',
      expected_version: reqItem.requestVersion,
    };

    const summary = `Assign disbursement recording for ${reqItem.requestNumber} to ${assignee.legalName} (${assignee.role})`;

    const preview = {
      request_number: reqItem.requestNumber,
      title: reqItem.title,
      current_assignee: reqItem.disbursementAssigneeId || 'Unassigned',
      new_assignee: `${assignee.legalName} (${assignee.employeeNumber})`,
      assignee_role: assignee.role,
      note: note || 'Disbursement desk delegation',
    };

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'payment_recorder',
      targetSubsidiaryId: reqItem.subsidiaryId,
      materialPayload,
      summary,
      preview,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
