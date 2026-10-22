import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view intercompany records.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE', 'COO', 'DIRECTOR', 'HEAD_OF_ADMIN', 'AI_ANALYST', 'FINANCE_CONTROLLER', 'HR'])) {
      return NextResponse.json({ error: 'Finance or executive access is required.' }, { status: 403 });
    }
    const notes = await prisma.intercompanyNote.findMany({
      include: {
        sourceEntity: true,
        targetEntity: true,
      },
      orderBy: { generatedAt: 'desc' },
    });

    const safeNotes = JSON.parse(
      JSON.stringify(notes, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
    );

    return NextResponse.json({ notes: safeNotes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to create an intercompany note.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE'])) return NextResponse.json({ error: 'Finance or executive access is required to issue intercompany notes.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const sourceEntityId = typeof body.sourceEntityId === 'string' ? body.sourceEntityId : '';
  const targetEntityId = typeof body.targetEntityId === 'string' ? body.targetEntityId : '';
  const noteType = body.noteType === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : body.noteType === 'DEBIT_NOTE' ? 'DEBIT_NOTE' : null;
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amount = Number(body.amount);
  if (!sourceEntityId || !targetEntityId || sourceEntityId === targetEntityId || !noteType || description.length < 5 || description.length > 1000 || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return NextResponse.json({ error: 'Provide two different group companies, a note type, a clear reason, and a valid positive amount.' }, { status: 400 });
  const [source, target] = await Promise.all([prisma.organization.findUnique({ where: { id: sourceEntityId } }), prisma.organization.findUnique({ where: { id: targetEntityId } })]);
  if (!source || !target) return NextResponse.json({ error: 'One or both companies were not found.' }, { status: 404 });
  if (source.status !== 'ACTIVE' || target.status !== 'ACTIVE') return NextResponse.json({ error: 'Notes can only be issued between active group companies.' }, { status: 409 });
  const periodId = typeof body.periodId === 'string' ? body.periodId : null;
  if (periodId && !await prisma.payrollPeriod.findUnique({ where: { id: periodId } })) return NextResponse.json({ error: 'The selected accounting period was not found.' }, { status: 400 });
  const now = new Date();
  const prefix = noteType === 'DEBIT_NOTE' ? 'DN' : 'CN';
  const noteNumber = `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const note = await prisma.$transaction(async tx => {
    const created = await tx.intercompanyNote.create({ data: { periodId, sourceEntityId, targetEntityId, noteType, noteNumber, totalAmountMinor: BigInt(Math.round(amount * 100)), currency: source.defaultCurrency, description, status: 'ISSUED' } });
    await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: source.parentGroupId || source.id, subsidiaryId: source.id, targetType: 'POLICY', targetId: created.id, action: 'INTERCOMPANY_NOTE_CREATED', correlationId: `CORR-ICN-${randomUUID()}`, metadata: JSON.stringify({ noteNumber, targetEntityId, amount, currency: source.defaultCurrency, noteType }) } });
    return created;
  });
  return NextResponse.json({ note: { ...note, totalAmountMinor: Number(note.totalAmountMinor), sourceEntity: { id: source.id, legalName: source.legalName }, targetEntity: { id: target.id, legalName: target.legalName } } }, { status: 201 });
}
