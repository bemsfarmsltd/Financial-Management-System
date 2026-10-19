import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to reconcile intercompany notes.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE'])) return NextResponse.json({ error: 'Finance or executive access is required.' }, { status: 403 });
  const { noteId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.status !== 'RECONCILED') return NextResponse.json({ error: 'Only reconciliation can be recorded here.' }, { status: 400 });
  const note = await prisma.intercompanyNote.findUnique({ where: { id: noteId }, include: { sourceEntity: true } });
  if (!note) return NextResponse.json({ error: 'Intercompany note not found.' }, { status: 404 });
  if (note.status === 'RECONCILED') return NextResponse.json({ error: 'This note has already been reconciled.' }, { status: 409 });
  const updated = await prisma.$transaction(async tx => {
    const saved = await tx.intercompanyNote.update({ where: { id: note.id }, data: { status: 'RECONCILED' } });
    await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: note.sourceEntity.parentGroupId || note.sourceEntity.id, subsidiaryId: note.sourceEntityId, targetType: 'POLICY', targetId: note.id, action: 'INTERCOMPANY_NOTE_RECONCILED', correlationId: `CORR-ICN-${randomUUID()}`, metadata: JSON.stringify({ noteNumber: note.noteNumber }) } });
    return saved;
  });
  return NextResponse.json({ note: { ...updated, totalAmountMinor: Number(updated.totalAmountMinor) } });
}
