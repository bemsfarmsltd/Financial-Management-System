import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json({ ok: false, error_code: 'SERVICE_CREDENTIALS_FORBIDDEN', message: 'Human session required.' }, { status: 403 });
    }
    const actor = await getAuthenticatedEmployee(req, { disallowServiceToken: true });
    if (actor && actor.role !== 'GMD') return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access is exclusively for the GMD.'},{status:403});
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Not permitted.' }, { status: 403 });
    }

    const { id } = await params;
    const action = await prisma.stagedAction.findUnique({ where: { id } });

    if (!action) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Staged action ${id} not found.` },
        { status: 404 }
      );
    }

    const actorRoleUpper = (actor.role || '').toUpperCase();
    if (action.userId !== actor.id && actorRoleUpper !== 'GMD') {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_PERMITTED', message: 'Cannot cancel an action staged by another executive.' },
        { status: 403 }
      );
    }

    if (action.status === 'EXECUTED') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'ALREADY_EXECUTED',
          status: 'EXECUTED',
          message: 'Cannot cancel a staged action that has already been executed.',
        },
        { status: 409 }
      );
    }

    if (action.status === 'CANCELLED') {
      return NextResponse.json({
        ok: true,
        staged_action_id: id,
        status: 'CANCELLED',
        message: `Staged action ${id} is already cancelled.`,
      });
    }

    const now = new Date();
    if (action.status === 'EXPIRED' || now > action.expiresAt) {
      if (action.status === 'PENDING') {
        await prisma.stagedAction.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error_code: 'STAGED_ACTION_EXPIRED',
          status: 'EXPIRED',
          message: 'Staged action has already expired.',
        },
        { status: 409 }
      );
    }

    const claimed = await prisma.stagedAction.updateMany({
      where: {
        id,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      data: { status: 'CANCELLED' },
    });

    if (claimed.count === 0) {
      const latest = await prisma.stagedAction.findUnique({ where: { id } });
      if (latest?.status === 'EXECUTED') {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'ALREADY_EXECUTED',
            status: 'EXECUTED',
            message: 'Cannot cancel a staged action that has already been executed.',
          },
          { status: 409 }
        );
      }
      if (latest?.status === 'CANCELLED') {
        return NextResponse.json({
          ok: true,
          staged_action_id: id,
          status: 'CANCELLED',
          message: `Staged action ${id} cancelled.`,
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error_code: 'STAGED_ACTION_EXPIRED',
          status: latest?.status || 'EXPIRED',
          message: 'Staged action can no longer be cancelled.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      staged_action_id: id,
      status: 'CANCELLED',
      message: `Staged action ${id} cancelled.`,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
