import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface IntercompanyNoteResult {
  generatedCount: number;
  notes: any[];
}

/**
 * Automatically generates intercompany debit notes when a parent or central entity
 * pays payroll costs that are allocated to subsidiaries.
 */
export async function generatePayrollIntercompanyNotes(params: {
  payrollItemId: string;
  payingEntityId: string;
  periodId: string;
  actor: { id: string; legalName: string; role: string };
}): Promise<IntercompanyNoteResult> {
  const { payrollItemId, payingEntityId, periodId, actor } = params;

  // Retrieve payroll item and its cost allocations
  const item = await prisma.payrollItem.findUnique({
    where: { id: payrollItemId },
    include: {
      employee: true,
      allocations: {
        include: { subsidiary: true },
      },
      batch: {
        include: { period: true },
      },
    },
  });

  if (!item || !item.allocations.length) {
    return { generatedCount: 0, notes: [] };
  }

  const payingOrg = await prisma.organization.findUnique({
    where: { id: payingEntityId },
  });

  if (!payingOrg) {
    throw new Error(`Paying organization ${payingEntityId} not found`);
  }

  const generatedNotes = [];

  for (const alloc of item.allocations) {
    // If the allocated subsidiary is different from the paying entity, an intercompany recharge is required
    if (alloc.subsidiaryId !== payingEntityId) {
      const now = new Date();
      const periodLabel = `${item.batch.period.year}-${String(item.batch.period.month).padStart(2, "0")}`;
      const noteNumber = `DN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`;

      const description = `Automated Payroll Cost Recharge: ${item.employee.legalName} (${alloc.percentage}% allocation for ${periodLabel})`;

      const note = await prisma.$transaction(async (tx) => {
        const created = await tx.intercompanyNote.create({
          data: {
            periodId,
            sourceEntityId: payingEntityId, // Paying entity holds the receivable
            targetEntityId: alloc.subsidiaryId, // Subsidiary owes the recharge
            noteType: "DEBIT_NOTE",
            noteNumber,
            totalAmountMinor: alloc.allocableCostMinor,
            currency: item.currency,
            description,
            status: "ISSUED",
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            actorName: actor.legalName,
            actorRole: actor.role,
            groupId: payingOrg.parentGroupId || payingOrg.id,
            subsidiaryId: alloc.subsidiaryId,
            targetType: "PAYROLL",
            targetId: created.id,
            action: "INTERCOMPANY_NOTE_CREATED",
            correlationId: `CORR-AUTO-ICN-${created.id}`,
            metadata: JSON.stringify({
              noteNumber,
              employeeName: item.employee.legalName,
              percentage: alloc.percentage,
              amountMinor: alloc.allocableCostMinor.toString(),
            }),
          },
        });

        return created;
      });

      generatedNotes.push(note);
    }
  }

  return {
    generatedCount: generatedNotes.length,
    notes: generatedNotes,
  };
}

/**
 * Calculates bilateral intercompany balances between all group entities.
 */
export async function getIntercompanyMatrix() {
  const [organizations, notes] = await Promise.all([
    prisma.organization.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, legalName: true, code: true, type: true },
    }),
    prisma.intercompanyNote.findMany({
      where: { status: "ISSUED" },
      include: {
        sourceEntity: { select: { id: true, legalName: true, code: true } },
        targetEntity: { select: { id: true, legalName: true, code: true } },
      },
    }),
  ]);

  // Map of entityId -> { receivablesMinor: bigint, payablesMinor: bigint, netMinor: bigint }
  const balanceMap = new Map<string, {
    org: typeof organizations[0];
    receivablesMinor: bigint;
    payablesMinor: bigint;
    netMinor: bigint;
    notesCount: number;
  }>();

  for (const org of organizations) {
    balanceMap.set(org.id, {
      org,
      receivablesMinor: BigInt(0),
      payablesMinor: BigInt(0),
      netMinor: BigInt(0),
      notesCount: 0,
    });
  }

  for (const note of notes) {
    const amount = note.totalAmountMinor;

    // Source entity is issuer: if DEBIT_NOTE, source has receivable from target
    const source = balanceMap.get(note.sourceEntityId);
    const target = balanceMap.get(note.targetEntityId);

    if (note.noteType === "DEBIT_NOTE") {
      if (source) {
        source.receivablesMinor += amount;
        source.notesCount++;
      }
      if (target) {
        target.payablesMinor += amount;
        target.notesCount++;
      }
    } else {
      // CREDIT_NOTE
      if (source) {
        source.payablesMinor += amount;
        source.notesCount++;
      }
      if (target) {
        target.receivablesMinor += amount;
        target.notesCount++;
      }
    }
  }

  const summary = [...balanceMap.values()].map((entry) => ({
    organizationId: entry.org.id,
    legalName: entry.org.legalName,
    code: entry.org.code,
    type: entry.org.type,
    receivables: Number(entry.receivablesMinor) / 100,
    payables: Number(entry.payablesMinor) / 100,
    netBalance: (Number(entry.receivablesMinor) - Number(entry.payablesMinor)) / 100,
    activeNotesCount: entry.notesCount,
  }));

  return summary;
}

/**
 * Automatically generates paired Debit and Credit notes when an operational expenditure
 * or vendor payment is made by one entity on behalf of another entity.
 */
export async function generateOperationalIntercompanyNotes(params: {
  requestId?: string;
  sourceEntityId: string; // The funding/paying entity (holds the receivable)
  targetEntityId: string; // The beneficiary entity (holds the liability/payable)
  amountMinor: number | bigint;
  currency?: string;
  description: string;
  actor: { id: string; legalName: string; role: string };
}) {
  const { sourceEntityId, targetEntityId, amountMinor, currency = 'NGN', description, actor } = params;

  if (sourceEntityId === targetEntityId) {
    throw new Error('Intercompany notes cannot be issued between the same entity.');
  }

  const [sourceOrg, targetOrg] = await Promise.all([
    prisma.organization.findUnique({ where: { id: sourceEntityId } }),
    prisma.organization.findUnique({ where: { id: targetEntityId } }),
  ]);

  if (!sourceOrg) throw new Error(`Source entity ${sourceEntityId} not found.`);
  if (!targetOrg) throw new Error(`Target entity ${targetEntityId} not found.`);

  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = randomUUID().slice(0, 6).toUpperCase();

  const debitNoteNumber = `DN-${yearMonth}-${randomSuffix}`;
  const creditNoteNumber = `CN-${yearMonth}-${randomSuffix}`;

  const bigAmount = BigInt(amountMinor);

  const [debitNote, creditNote] = await prisma.$transaction(async (tx) => {
    // 1. Debit Note: Issued by Source Org against Target Org (Source is Debiting Target = Target owes Source)
    const dn = await tx.intercompanyNote.create({
      data: {
        sourceEntityId,
        targetEntityId,
        noteType: 'DEBIT_NOTE',
        noteNumber: debitNoteNumber,
        totalAmountMinor: bigAmount,
        currency,
        description: `[DEBIT] ${description} (Cross-charge to ${targetOrg.legalName})`,
        status: 'ISSUED',
      },
    });

    // 2. Credit Note: Issued to acknowledge liability/recharge from Target Org perspective
    const cn = await tx.intercompanyNote.create({
      data: {
        sourceEntityId: targetEntityId,
        targetEntityId: sourceEntityId,
        noteType: 'CREDIT_NOTE',
        noteNumber: creditNoteNumber,
        totalAmountMinor: bigAmount,
        currency,
        description: `[CREDIT] ${description} (Funded by ${sourceOrg.legalName})`,
        status: 'ISSUED',
      },
    });

    // Audit Event
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: sourceOrg.parentGroupId || sourceOrg.id,
        subsidiaryId: targetEntityId,
        targetType: 'DISBURSEMENT',
        targetId: dn.id,
        action: 'INTERCOMPANY_NOTE_CREATED',
        correlationId: `CORR-OP-ICN-${dn.id}`,
        metadata: JSON.stringify({
          debitNoteNumber,
          creditNoteNumber,
          source: sourceOrg.legalName,
          target: targetOrg.legalName,
          amountMinor: bigAmount.toString(),
          description,
        }),
      },
    });

    return [dn, cn];
  });

  return {
    ok: true,
    debitNote: {
      id: debitNote.id,
      noteNumber: debitNote.noteNumber,
      source: sourceOrg.legalName,
      target: targetOrg.legalName,
      amountMinor: Number(debitNote.totalAmountMinor),
      status: debitNote.status,
    },
    creditNote: {
      id: creditNote.id,
      noteNumber: creditNote.noteNumber,
      source: targetOrg.legalName,
      target: sourceOrg.legalName,
      amountMinor: Number(creditNote.totalAmountMinor),
      status: creditNote.status,
    },
  };
}

/**
 * Reconciles / Clears Intercompany Notes upon GMD authorization
 */
export async function reconcileIntercompanyNotes(params: {
  noteIds: string[];
  settlementReference?: string;
  actor: { id: string; legalName: string; role: string };
}) {
  const { noteIds, settlementReference = 'GMD_NETTING_SETTLEMENT', actor } = params;

  if (!noteIds.length) {
    throw new Error('At least one intercompany note ID is required for reconciliation.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.intercompanyNote.updateMany({
      where: { id: { in: noteIds } },
      data: { status: 'RECONCILED' },
    });

    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: 'BEMS-HOLDINGS',
        targetType: 'DISBURSEMENT',
        targetId: noteIds[0],
        action: 'CLOSED',
        correlationId: `SETTLE-ICN-${Date.now()}`,
        metadata: JSON.stringify({
          reconciledCount: res.count,
          settlementReference,
          noteIds,
        }),
      },
    });

    return res;
  });

  return {
    ok: true,
    reconciledCount: updated.count,
    settlementReference,
  };
}
