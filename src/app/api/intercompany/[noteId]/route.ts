import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';
export async function PATCH(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to reconcile notes.' }, { status: 401 });
    const { noteId } = await params;
    const body = await request.json();
    if (body.status !== 'RECONCILED') return NextResponse.json({ error: 'Only reconciliation is supported.' }, { status: 400 });
    await executeDashboardCommand(actor, 'intercompany_note', { sub_action: 'SETTLE', mode: 'SETTLE', targetNoteIds: [noteId], settlementReference: body.settlementReference });
    const note = await prisma.intercompanyNote.findUniqueOrThrow({ where: { id: noteId } });
    return NextResponse.json({ note: { ...note, totalAmountMinor: note.totalAmountMinor.toString() } });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
