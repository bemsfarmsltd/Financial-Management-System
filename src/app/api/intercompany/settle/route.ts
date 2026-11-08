import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to settle intercompany notes.' }, { status: 401 });
    const body = await req.json();
    const result = await executeDashboardCommand(actor, 'intercompany_note', { sub_action: 'SETTLE', mode: 'SETTLE', targetNoteIds: body.noteIds, settlementReference: body.settlementReference });
    return NextResponse.json({ ok: true, message: 'Selected notes reconciled.', result });
  } catch (error: any) { return NextResponse.json({ ok: false, error: error.message }, { status: 400 }); }
}
