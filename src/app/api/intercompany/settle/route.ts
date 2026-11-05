import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { reconcileIntercompanyNotes } from '@/lib/services/intercompany';

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ ok: false, error: 'Executive authority required for intercompany settlement.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const noteIds: string[] = Array.isArray(body.noteIds) ? body.noteIds : [];
    const settlementReference: string = (body.settlementReference || `GMD_NETTING_${Date.now()}`).trim();

    if (!noteIds.length) {
      return NextResponse.json(
        { ok: false, error: 'Select at least one intercompany note to reconcile and settle.' },
        { status: 400 }
      );
    }

    const result = await reconcileIntercompanyNotes({
      noteIds,
      settlementReference,
      actor: {
        id: actor.id,
        legalName: actor.legalName,
        role: actor.role,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Successfully reconciled and settled ${result.reconciledCount} intercompany note(s).`,
      result,
    });
  } catch (error: any) {
    console.error('Error settling intercompany notes:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

