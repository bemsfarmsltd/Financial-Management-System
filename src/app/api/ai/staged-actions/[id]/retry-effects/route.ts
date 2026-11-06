import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { retryStagedActionSideEffects } from '@/lib/staged-actions';

/**
 * POST /api/ai/staged-actions/[id]/retry-effects
 * Retries pending or failed notification/external side-effects for an already EXECUTED
 * staged action without repeating the underlying business write (Audit Item 05 Pillar 5).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (
      req.headers.get('x-api-key') ||
      req.headers.get('x-bems-delegation-token') ||
      req.headers.get('x-delegation-token')
    ) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'SERVICE_CREDENTIALS_FORBIDDEN',
          message: 'Human session required to retry staged action side-effects.',
        },
        { status: 403 }
      );
    }

    const actor = await getAuthenticatedEmployee(req, { disallowServiceToken: true });
    if (!actor) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' },
        { status: 401 }
      );
    }
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Executive access required.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const result = await retryStagedActionSideEffects({
      actionId: id,
      actor: {
        id: actor.id,
        legalName: actor.legalName,
        role: actor.role,
      },
    });

    if (!result.ok) {
      const status =
        result.errorCode === 'NOT_FOUND'
          ? 404
          : result.errorCode === 'NOT_PERMITTED'
          ? 403
          : 409;
      return NextResponse.json(
        {
          ok: false,
          error_code: result.errorCode,
          message: result.message,
        },
        { status }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: err.message },
      { status: 500 }
    );
  }
}

