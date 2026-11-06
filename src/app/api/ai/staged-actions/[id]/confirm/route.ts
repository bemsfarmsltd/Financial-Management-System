import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { executeStagedAction } from '@/lib/staged-actions';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Reject automation service credentials (x-api-key or service bearer token) — only human sessions can confirm
    if (req.headers.get('x-api-key')) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'SERVICE_CREDENTIALS_FORBIDDEN',
          message: 'Automation service credentials cannot confirm staged actions. An authenticated human executive must click the Approve button.',
        },
        { status: 403 }
      );
    }

    const actor = await getAuthenticatedEmployee(req, { disallowServiceToken: true });
    if (!actor) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Human session authentication required to confirm staged actions.' },
        { status: 401 }
      );
    }
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Executive authority (GMD or Super Admin) is required to confirm staged actions.' },
        { status: 403 }
      );
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
