import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import {
  getIntercompanyMatrix,
  generateOperationalIntercompanyNotes,
  reconcileIntercompanyNotes,
} from '@/lib/services/intercompany';
import { stageAction } from '@/lib/staged-actions';

/**
 * AI & n8n Automation Tool: Automated Intercompany Debit/Credit Ledger
 *
 * GET  /api/ai/tools/intercompany
 * POST /api/ai/tools/intercompany
 * Payload:
 *   - Action 'CREATE_NOTE': Creates paired Debit and Credit notes
 *   - Action 'STAGE_SETTLEMENT': Stages a netting settlement for GMD confirmation
 */
export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor) {
    return NextResponse.json({ ok: false, error_code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }
  const isExecutive = actor.isExecutive;

  const matrix = await getIntercompanyMatrix();
  const notes = await prisma.intercompanyNote.findMany({
    where: { status: 'ISSUED' },
    include: {
      sourceEntity: { select: { id: true, legalName: true, code: true } },
      targetEntity: { select: { id: true, legalName: true, code: true } },
    },
    orderBy: { generatedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    service: 'BEMS AI Intercompany Clearing Ledger',
    matrixSummary: {
      totalEntities: matrix.length,
      matrix,
    },
    activeNotesCount: notes.length,
    activeNotes: notes.map((n) => ({
      id: n.id,
      noteNumber: n.noteNumber,
      noteType: n.noteType,
      source: n.sourceEntity.legalName,
      target: n.targetEntity.legalName,
      amount: Number(n.totalAmountMinor) / 100,
      currency: n.currency,
      description: n.description,
      status: n.status,
      generatedAt: n.generatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor) {
    return NextResponse.json({ ok: false, error_code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }
  const isExecutive = actor.isExecutive;

  if (!isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Intercompany ledger operations require GMD or SUPER_ADMIN authority.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action: string = (body.action || 'CREATE_NOTE').toUpperCase().trim();

  // -------------------------------------------------------------
  // ACTION 1: CREATE_NOTE (Paired Debit/Credit Notes)
  // -------------------------------------------------------------
  if (action === 'CREATE_NOTE' || action === 'GENERATE') {
    const sourceQuery: string = (body.source || body.sourceEntityId || body.fromSubsidiary || '').trim();
    const targetQuery: string = (body.target || body.targetEntityId || body.toSubsidiary || '').trim();
    const amount: number = Number(body.amount || (body.amountMinor ? Number(body.amountMinor) / 100 : 0));
    const description: string = (body.description || body.reason || '').trim();

    const missing: string[] = [];
    if (!sourceQuery) missing.push('source (Paying/Funding Subsidiary code or name, e.g. "BEMS-GROUP")');
    if (!targetQuery) missing.push('target (Beneficiary Subsidiary code or name, e.g. "ACS")');
    if (!amount || amount <= 0) missing.push('amount (Gross transfer/expense value in Naira, e.g. 500000)');
    if (!description || description.length < 5) missing.push('description (Operational purpose of recharge, e.g. "Cloud Hosting Subscription")');

    if (missing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'INCOMPLETE_PARAMETERS',
          message: 'All parameters are mandatory to generate an intercompany debit/credit note.',
          missing_fields: missing,
          required_fields: [
            { field: 'source', label: 'Funding Entity', example: 'BEMS Holdings HQ' },
            { field: 'target', label: 'Beneficiary Entity', example: 'Studio Arella Ltd' },
            { field: 'amount', label: 'Recharge Amount (NGN)', example: 350000 },
            { field: 'description', label: 'Operational Purpose', example: 'Q4 Starlink Equipment Allocation' },
          ],
          conversational_prompt: `To generate this intercompany note, please ask the GMD for:\n` +
            missing.map((m, i) => `${i + 1}. **${m}**`).join('\n'),
        },
        { status: 400 }
      );
    }

    // Resolve organizations
    const [sourceOrg, targetOrg] = await Promise.all([
      prisma.organization.findFirst({
        where: {
          OR: [{ id: sourceQuery }, { code: sourceQuery.toUpperCase() }, { legalName: { contains: sourceQuery, mode: 'insensitive' } }],
        },
      }),
      prisma.organization.findFirst({
        where: {
          OR: [{ id: targetQuery }, { code: targetQuery.toUpperCase() }, { legalName: { contains: targetQuery, mode: 'insensitive' } }],
        },
      }),
    ]);

    if (!sourceOrg) {
      return NextResponse.json({ ok: false, error_code: 'SOURCE_NOT_FOUND', message: `Funding subsidiary "${sourceQuery}" not found.` }, { status: 404 });
    }
    if (!targetOrg) {
      return NextResponse.json({ ok: false, error_code: 'TARGET_NOT_FOUND', message: `Beneficiary subsidiary "${targetQuery}" not found.` }, { status: 404 });
    }
    if (sourceOrg.id === targetOrg.id) {
      return NextResponse.json({ ok: false, error_code: 'SAME_ENTITY', message: 'Intercompany notes cannot be issued between the same entity.' }, { status: 400 });
    }

    const amountMinor = Math.round(amount * 100);
    const formattedAmount = amount.toLocaleString('en-NG', { style: 'currency', currency: sourceOrg.defaultCurrency || 'NGN' });

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'intercompany_note',
      summary: `Generate paired Intercompany Debit & Credit Notes (${formattedAmount}) from ${sourceOrg.legalName} to ${targetOrg.legalName}`,
      materialPayload: {
        mode: 'CREATE_NOTE',
        sourceEntityId: sourceOrg.id,
        targetEntityId: targetOrg.id,
        amountMinor,
        amount,
        currency: sourceOrg.defaultCurrency || 'NGN',
        description,
      },
      preview: {
        action: 'CREATE_NOTE',
        source: sourceOrg.legalName,
        target: targetOrg.legalName,
        amount: formattedAmount,
        description,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `Paired Intercompany Debit/Credit Note generation (${formattedAmount}) between ${sourceOrg.legalName} and ${targetOrg.legalName} has been staged. Click the confirmation button to issue the notes.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 2: STAGE_SETTLEMENT (Stage GMD Netting Settlement)
  // -------------------------------------------------------------
  if (action === 'STAGE_SETTLEMENT' || action === 'SETTLE') {
    const noteIds: string[] = Array.isArray(body.noteIds) ? body.noteIds : [];
    if (!noteIds.length) {
      return NextResponse.json(
        { ok: false, error_code: 'MISSING_NOTE_IDS', message: 'Array of noteIds is required to stage an intercompany netting settlement.' },
        { status: 400 }
      );
    }

    const targetNotes = await prisma.intercompanyNote.findMany({
      where: { id: { in: noteIds }, status: 'ISSUED' },
      include: {
        sourceEntity: { select: { legalName: true } },
        targetEntity: { select: { legalName: true } },
      },
    });

    if (!targetNotes.length) {
      return NextResponse.json(
        { ok: false, error_code: 'NO_ACTIVE_NOTES', message: 'No active ISSUED notes found matching the provided IDs.' },
        { status: 404 }
      );
    }

    const totalSettlementMinor = targetNotes.reduce((acc, n) => acc + Number(n.totalAmountMinor), 0);
    const totalNaira = (totalSettlementMinor / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });

    // Staged Action Governance: AI never directly closes financial ledgers without explicit physical GMD confirmation
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'intercompany_note',
      summary: `Netting & Settlement of ${targetNotes.length} intercompany note(s) totaling ${totalNaira}`,
      materialPayload: {
        targetNoteIds: targetNotes.map((n) => n.id),
        noteNumbers: targetNotes.map((n) => n.noteNumber),
        totalSettlementMinor,
      },
      preview: {
        notesCount: targetNotes.length,
        notes: targetNotes.map((n) => n.noteNumber),
        totalAmountNaira: totalNaira,
      },
    });

    const origin = req.nextUrl.origin || 'https://bemserp.work';
    const confirmationEndpoint = `${origin}/api/ai/staged-actions/${staged.staged_action_id}/confirm`;

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      message: `Intercompany settlement of ${targetNotes.length} note(s) (${totalNaira}) has been staged. Awaiting GMD authorization.`,
      settlementDossier: {
        notesCount: targetNotes.length,
        notes: targetNotes.map((n) => ({
          noteNumber: n.noteNumber,
          source: n.sourceEntity.legalName,
          target: n.targetEntity.legalName,
          amount: Number(n.totalAmountMinor) / 100,
        })),
        totalAmountNaira: totalNaira,
      },
      stagedAction: {
        id: staged.staged_action_id,
        summary: staged.summary,
        confirmationEndpoint,
        status: 'PENDING',
        expiresAt: staged.expires_at,
      },
      interactiveCard: {
        type: 'SETTLEMENT_STAGED_CARD',
        title: 'Intercompany Netting Settlement Staged',
        amount: totalNaira,
        confirmButtonUrl: confirmationEndpoint,
        confirmButtonText: 'Authorize & Execute Intercompany Settlement',
      },
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_ACTION', message: `Unknown action "${action}". Allowed: CREATE_NOTE, STAGE_SETTLEMENT.` },
    { status: 400 }
  );
}

