import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { executeStagedAction } from '@/lib/staged-actions';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Executive authority is required to confirm staged financial actions.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const confirmationHash = body.confirmation_hash;

    if (!confirmationHash) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'confirmation_hash is required.' }, { status: 400 });
    }

    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('x-correlation-id') || undefined;

    const result = await executeStagedAction({
      actionId: id,
      confirmationHash,
      actor: {
        id: actor.id,
        legalName: actor.legalName,
        role: actor.role,
        employeeNumber: actor.employeeNumber,
      },
      idempotencyKey,
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'NOT_PERMITTED' ? 403 : result.errorCode === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json({
        ok: false,
        error_code: result.errorCode,
        message: result.message,
      }, { status: statusCode });
    }

    return NextResponse.json({
      ok: true,
      record_type: result.record_type,
      record_id: result.record_id,
      url: result.url,
      record: result.record,
      notifications_sent: result.notifications_sent || [],
      audit_event_id: result.audit_event_id,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
