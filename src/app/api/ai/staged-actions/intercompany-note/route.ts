import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or System Admin can stage intercompany notes.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { source_entity_id, target_entity_id, amount, note_type, description } = body;

    if (!source_entity_id || !target_entity_id || !amount) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'source_entity_id, target_entity_id, and amount are required.' }, { status: 400 });
    }

    const [source, target] = await Promise.all([
      prisma.organization.findUnique({ where: { id: source_entity_id } }),
      prisma.organization.findUnique({ where: { id: target_entity_id } }),
    ]);

    if (!source) return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Source organization ${source_entity_id} not found.` }, { status: 404 });
    if (!target) return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Target organization ${target_entity_id} not found.` }, { status: 404 });

    const noteTypeFormatted = note_type === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : 'DEBIT_NOTE';
    const amountFormatted = `₦${Number(amount).toLocaleString()}`;

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'intercompany_note',
      materialPayload: {
        source_entity_id,
        target_entity_id,
        amount: Number(amount),
        note_type: noteTypeFormatted,
        description: description || `Intercompany billing note between ${source.legalName} and ${target.legalName}`,
      },
      summary: `Issue ${noteTypeFormatted.replace('_', ' ')}: ${source.legalName} ➔ ${target.legalName} (${amountFormatted})`,
      preview: {
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
