import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { executeStagedAction } from '@/lib/staged-actions';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Reject automation service credentials and scoped delegation tokens — only human sessions can confirm
    if (
      req.headers.get('x-api-key') ||
      req.headers.get('x-bems-delegation-token') ||
      req.headers.get('x-delegation-token')
    ) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'SERVICE_CREDENTIALS_FORBIDDEN',
          message: 'Automation service or delegation credentials cannot confirm staged actions. An authenticated human executive must click the Approve button.',
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
      const conflictCodes = new Set([
        'ALREADY_EXECUTED',
        'CANCELLED',
        'STAGED_ACTION_EXPIRED',
        'TARGET_CHANGED',
        'HASH_MISMATCH',
      ]);
      const statusCode =
        result.errorCode === 'NOT_PERMITTED' || result.errorCode === 'AI_SCOPE_DISABLED'
          ? 403
          : result.errorCode === 'NOT_FOUND'
          ? 404
          : result.errorCode && conflictCodes.has(result.errorCode)
          ? 409
          : 400;
      return NextResponse.json(
        {
          ok: false,
          error_code: result.errorCode,
          status: result.status,
          message: result.message,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status || 'EXECUTED',
      record_type: result.record_type,
      record_id: result.record_id,
      url: result.url,
      record: result.record,
      notification_intent: result.notification_intent || [],
      notifications_sent: result.notifications_sent || [],
      notification_delivery_status: result.notification_delivery_status || 'NOT_APPLICABLE',
      audit_event_id: result.audit_event_id,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
