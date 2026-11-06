import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

async function resolveOrg(query: string) {
  const q = String(query || '').trim();
  if (!q) return null;
  const exact = await prisma.organization.findFirst({
    where: {
      OR: [
        { id: q },
        { code: { equals: q, mode: 'insensitive' } },
        { legalName: { equals: q, mode: 'insensitive' } },
      ],
    },
  });
  if (exact) return exact;
  const partial = await prisma.organization.findMany({
    where: {
      OR: [
        { legalName: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ],
    },
  });
  return partial.length === 1 ? partial[0] : null;
}

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or Super Admin can stage intercompany notes.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const rawMode = String(
      body.mode ||
        body.action ||
        (Array.isArray(body.targetNoteIds) || Array.isArray(body.noteIds) || Array.isArray(body.note_ids)
          ? 'SETTLE'
          : 'CREATE_NOTE')
    )
      .toUpperCase()
      .trim();

    if (
      rawMode === 'SETTLE' ||
      rawMode === 'STAGE_SETTLEMENT' ||
      rawMode === 'RECONCILE_SETTLEMENT' ||
      rawMode === 'RECONCILE'
    ) {
      const requestedIds: string[] = Array.from(
        new Set(
          (body.targetNoteIds || body.noteIds || body.note_ids || [])
            .map((id: any) => String(id).trim())
            .filter(Boolean)
        )
      );

      if (!requestedIds.length) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'MISSING_NOTE_IDS',
            message: 'At least one intercompany note ID (targetNoteIds or noteIds) is required to stage a settlement.',
          },
          { status: 400 }
        );
      }

      const foundNotes = await prisma.intercompanyNote.findMany({
        where: {
          OR: [{ id: { in: requestedIds } }, { noteNumber: { in: requestedIds } }],
        },
        include: {
          sourceEntity: { select: { id: true, legalName: true } },
          targetEntity: { select: { id: true, legalName: true } },
        },
      });

      if (foundNotes.length !== requestedIds.length) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'NOTE_NOT_FOUND',
            message: `One or more selected intercompany notes were not found (requested ${requestedIds.length}, found ${foundNotes.length}).`,
          },
          { status: 404 }
        );
      }

      const ineligible = foundNotes.filter((n) => n.status !== 'ISSUED');
      if (ineligible.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'NOTE_NOT_ISSUED',
            message: `Intercompany note(s) ${ineligible.map((n) => n.noteNumber).join(', ')} are already ${ineligible[0].status} and cannot be settled.`,
          },
          { status: 409 }
        );
      }

      const totalSettlementMinor = foundNotes.reduce((sum, n) => sum + Number(n.totalAmountMinor), 0);
      const totalFormatted = `₦${(totalSettlementMinor / 100).toLocaleString()}`;
      const settlementReference = String(body.settlementReference || body.settlement_reference || 'GMD_NETTING_SETTLEMENT').trim();

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'intercompany_note',
        targetSubsidiaryId: foundNotes[0].sourceEntityId,
        materialPayload: {
          mode: 'SETTLE',
          targetNoteIds: foundNotes.map((n) => n.id),
          noteNumbers: foundNotes.map((n) => n.noteNumber),
          totalSettlementMinor,
          settlementReference,
        },
        summary: `Reconcile & settle ${foundNotes.length} intercompany note(s) totaling ${totalFormatted}`,
        preview: {
          mode: 'SETTLE',
          notes_count: foundNotes.length,
          note_numbers: foundNotes.map((n) => n.noteNumber).join(', '),
          total_amount: totalFormatted,
          settlement_reference: settlementReference,
        },
      });

      return NextResponse.json(staged);
    }

    const source_entity_id = body.source_entity_id || body.sourceEntityId || body.source;
    const target_entity_id = body.target_entity_id || body.targetEntityId || body.target;
    const amount = body.amount !== undefined ? Number(body.amount) : body.amountMinor ? Number(body.amountMinor) / 100 : NaN;
    const { note_type, description } = body;

    if (!source_entity_id || !target_entity_id || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'source_entity_id, target_entity_id, and a positive amount are required.' },
        { status: 400 }
      );
    }

    const [source, target] = await Promise.all([
      resolveOrg(String(source_entity_id)),
      resolveOrg(String(target_entity_id)),
    ]);

    if (!source) return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Source organization "${source_entity_id}" not found.` }, { status: 404 });
    if (!target) return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Target organization "${target_entity_id}" not found.` }, { status: 404 });
    if (source.id === target.id) {
      return NextResponse.json({ ok: false, error_code: 'SAME_ENTITY', message: 'Intercompany notes cannot be issued between the same entity.' }, { status: 400 });
    }

    const noteTypeFormatted = note_type === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : 'DEBIT_NOTE';
    const amountMinor = Math.round(amount * 100);
    const amountFormatted = `₦${amount.toLocaleString()}`;

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'intercompany_note',
      targetSubsidiaryId: source.id,
      materialPayload: {
        mode: 'CREATE_NOTE',
        source_entity_id: source.id,
        target_entity_id: target.id,
        amount,
        amountMinor,
        note_type: noteTypeFormatted,
        description: description || `Intercompany billing note between ${source.legalName} and ${target.legalName}`,
      },
      summary: `Issue paired intercompany notes: ${source.legalName} ➔ ${target.legalName} (${amountFormatted})`,
      preview: {
        mode: 'CREATE_NOTE',
        note_type: noteTypeFormatted,
        source_entity: source.legalName,
        target_entity: target.legalName,
        amount: amountFormatted,
        description: description || 'Inter-subsidiary billing reconciliation',
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
