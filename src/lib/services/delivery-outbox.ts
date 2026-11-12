import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendAdminInvitationEmail, sendChatMessageEmail, sendSalaryWalletCreditedEmail } from '@/lib/email';

type DeliveryKind = 'ADMIN_INVITATION' | 'CHAT_MESSAGE' | 'SALARY_WALLET_CREDITED';
export async function queueDelivery(tx: Prisma.TransactionClient, commandId: string, kind: DeliveryKind, payload: Record<string, unknown>) {
  const id = randomUUID();
  await tx.$executeRaw`INSERT INTO "DeliveryOutbox" ("id", "commandId", "kind", "payload") VALUES (${id}, ${commandId}, ${kind}, ${JSON.stringify(payload)})`;
  return id;
}

/** Delivery happens after commit; a lease prevents concurrent workers from claiming the same message. */
export async function processDeliveryOutbox(commandId?: string, limit = 20) {
  const rows = await prisma.$queryRaw<Array<{ id: string; kind: DeliveryKind; payload: string; attempts: number }>>`
    UPDATE "DeliveryOutbox" SET "status" = 'PROCESSING', "lockedUntil" = CURRENT_TIMESTAMP + interval '5 minutes', "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "DeliveryOutbox"
      WHERE ("status" = 'PENDING' OR ("status" = 'PROCESSING' AND "lockedUntil" < CURRENT_TIMESTAMP))
        AND "nextAttemptAt" <= CURRENT_TIMESTAMP AND (${commandId || null}::text IS NULL OR "commandId" = ${commandId || null})
      ORDER BY "createdAt" LIMIT ${Math.max(1, Math.min(limit, 100))} FOR UPDATE SKIP LOCKED
    ) RETURNING "id", "kind", "payload", "attempts"
  `;
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload);
      const result = row.kind === 'ADMIN_INVITATION'
        ? await sendAdminInvitationEmail(payload)
        : row.kind === 'CHAT_MESSAGE'
        ? await sendChatMessageEmail(payload)
        : row.kind === 'SALARY_WALLET_CREDITED'
        ? await sendSalaryWalletCreditedEmail(payload)
        : null;
      if (!result?.success || result.simulated) throw new Error('Provider did not acknowledge delivery.');
      await prisma.$executeRaw`UPDATE "DeliveryOutbox" SET "status" = 'SENT', "payload" = '{}', "lockedUntil" = NULL, "sentAt" = CURRENT_TIMESTAMP, "lastError" = NULL WHERE "id" = ${row.id}`;
    } catch {
      const retrySeconds = Math.min(3600, 30 * 2 ** Math.min(row.attempts, 7));
      await prisma.$executeRaw`UPDATE "DeliveryOutbox" SET "status" = 'PENDING', "lockedUntil" = NULL, "nextAttemptAt" = CURRENT_TIMESTAMP + (${retrySeconds} * interval '1 second'), "lastError" = 'Provider delivery failed; retry queued.' WHERE "id" = ${row.id}`;
    }
  }
  return { processed: rows.length };
}
