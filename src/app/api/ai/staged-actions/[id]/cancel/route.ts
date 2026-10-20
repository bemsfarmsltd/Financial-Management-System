import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Not permitted.' }, { status: 403 });
    }

    const { id } = await params;
    const action = await prisma.stagedAction.findUnique({ where: { id } });

    if (!action) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Staged action ${id} not found.` }, { status: 404 });
    }

    if (action.userId !== actor.id) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Cannot cancel an action staged by another executive.' }, { status: 403 });
    }

    await prisma.stagedAction.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

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
