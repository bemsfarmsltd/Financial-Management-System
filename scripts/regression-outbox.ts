// @ts-nocheck -- Provider substitution deliberately prevents real email during database regressions.
import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
if (!process.env.DATABASE_URL?.includes('/bems_corrections_test')) throw new Error('Isolated test database required.');
let deliver = false;
let calls = 0;
const load = Module._load;
Module._load = function(name, ...args) {
  if (name === '@/lib/email') return { sendAdminInvitationEmail: async () => { calls++; return { success: deliver }; }, sendChatMessageEmail: async () => { calls++; return { success: deliver }; } };
  return load.call(this, name, ...args);
};
const { queueDelivery, processDeliveryOutbox } = require('../src/lib/services/delivery-outbox');
async function main() {
  const command = randomUUID();
  await assert.rejects(prisma.$transaction(async tx => { await queueDelivery(tx, command, 'ADMIN_INVITATION', { to: 'nobody@example.invalid' }); throw new Error('rollback'); }));
  const rows = await prisma.$queryRaw`SELECT * FROM "DeliveryOutbox" WHERE "commandId" = ${command}`;
  assert.equal(rows.length, 0);
  console.log('PASS failed business transactions cannot enqueue an email');
  await prisma.$transaction(tx => queueDelivery(tx, command, 'ADMIN_INVITATION', { to: 'nobody@example.invalid' }));
  await processDeliveryOutbox(command);
  let status = await prisma.$queryRaw`SELECT "status" FROM "DeliveryOutbox" WHERE "commandId" = ${command}`;
  assert.equal(status[0].status, 'PENDING');
  console.log('PASS provider failure stays queued instead of being marked sent');
  deliver = true; calls = 0;
  await prisma.$executeRaw`UPDATE "DeliveryOutbox" SET "nextAttemptAt" = CURRENT_TIMESTAMP WHERE "commandId" = ${command}`;
  await Promise.all([processDeliveryOutbox(command), processDeliveryOutbox(command)]);
  status = await prisma.$queryRaw`SELECT "status", "payload" FROM "DeliveryOutbox" WHERE "commandId" = ${command}`;
  assert.equal(calls, 1); assert.equal(status[0].status, 'SENT'); assert.equal(status[0].payload, '{}');
  console.log('PASS concurrent delivery workers claim a message once and erase its private payload after sending');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
