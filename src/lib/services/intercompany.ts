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
