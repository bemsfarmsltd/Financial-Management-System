import {walletWorkerStatus} from './runtime-state';
import { canApproveWalletRelease, financialApproverLabel } from '@/lib/gmd-access';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type WalletActor = { id: string; role: string; legalName: string };
export {WalletError} from './errors';
import {WalletError} from './errors';
export function walletEnabled() { return process.env.BEMS_WALLET_ENABLED === 'true'; }
export function requireWallet() {
  if (!walletEnabled()) throw new WalletError('WALLET_NOT_ENABLED', 'Wallets are not enabled for this environment.', 503);
}
export function requireCommitments() {
  requireWallet();
  if (!['sandbox','live'].includes(process.env.MONNIFY_ENVIRONMENT || '') || (process.env.MONNIFY_ENVIRONMENT === 'live' && (process.env.BEMS_WALLET_LIVE_ENABLED !== 'true' || process.env.BEMS_WALLET_OPENING_RECONCILED !== 'true' || process.env.BEMS_WALLET_TRANSFERS_ENABLED !== 'true'))) throw new WalletError('LIVE_WALLET_NOT_ACTIVATED', 'Live wallet commitments are not activated. Complete sandbox acceptance and reviewed opening reconciliation first.', 503);
}
export function minorUnits(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/.test(value)) throw new WalletError('INVALID_AMOUNT', 'Use a positive integer amount in kobo.');
  return BigInt(value);
}
export function walletJson(value: unknown) { return JSON.parse(JSON.stringify(value, (_, x) => typeof x === 'bigint' ? x.toString() : x)); }
export function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value, (_, x) => typeof x === 'bigint' ? x.toString() : x)).digest('hex'); }
function sameHash(a: string, b: string) {
  return /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
type Tx = Prisma.TransactionClient;
export async function liveWalletActor(tx: Tx, actor: WalletActor, gmdOnly = false) {
  const employee = await tx.employee.findUnique({ where: { id: actor.id } });
  if (!employee || employee.role !== actor.role || employee.approvalStatus !== 'APPROVED' ||
      !(employee.status === 'ACTIVE' || (!gmdOnly && employee.role === 'STAFF' && employee.status === 'ON_LEAVE'))) {
    throw new WalletError('ACCOUNT_NOT_AUTHORIZED', 'Your account is no longer authorized.', 403);
  }
  if (!['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'STAFF'].includes(employee.role)) throw new WalletError('ACCOUNT_NOT_AUTHORIZED', 'Account role is not supported.', 403);
  if (gmdOnly && (!canApproveWalletRelease(employee))) {
    throw new WalletError('GMD_REQUIRED', 'Only an authorized financial approver can release funds.', 403);
  }
  return employee;
}
export async function walletTransaction<T>(work: (tx: Tx) => Promise<T>) {
  requireWallet();
  // All funding commitments serialize before taking snapshots; READ COMMITTED
  // sees a preceding committer after acquiring this transaction advisory lock.
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('bems-wallet-pool-v1', 0))`;
    return work(tx);
  }, { timeout: 60000 });
}
type Pool = { id: string; environment: string; sourceAccount: string; availableMinor: bigint; feeReserveMinor: bigint; observedAt: Date; observationId: string; paused: boolean; version: number };
export async function fundingCommitments(tx: Tx) {
  const [totals] = await tx.$queryRaw<Array<{ envelopeMinor: bigint; liabilityMinor: bigint }>>`
    SELECT (SELECT COALESCE(sum("remainingMinor"),0)::bigint FROM "WalletBudgetEnvelope" WHERE "status" = 'ACTIVE') AS "envelopeMinor",
      (SELECT COALESCE(sum("availableMinor" + "heldMinor"),0)::bigint FROM "WalletCreditLot") + (SELECT COALESCE(sum("amountMinor"),0)::bigint FROM "WalletWithdrawal" WHERE "targetType"='VENDOR' AND "status" IN ('HELD','SUBMITTING','PENDING','UNKNOWN')) AS "liabilityMinor"`;
  return totals;
}
export async function fundingState(tx: Tx, enforce = false) {
  const [pool] = await tx.$queryRaw<Pool[]>`SELECT * FROM "WalletFundingPool" WHERE "id" = 'MONNIFY_NGN'`;
  if (!pool) throw new WalletError('FUNDING_NOT_CONFIGURED', 'Monnify funding has not been configured.', 503);
  const totals = await fundingCommitments(tx);
  const freeMinor = pool.availableMinor - pool.feeReserveMinor - totals.envelopeMinor - totals.liabilityMinor;
  const age = Date.now() - pool.observedAt.getTime();
  const fresh = age >= -5000 && age <= 30000;
  const configured = pool.environment === process.env.MONNIFY_ENVIRONMENT && pool.sourceAccount === process.env.MONNIFY_SOURCE_ACCOUNT;
  if (enforce) {
    if (!configured) throw new WalletError('FUNDING_NOT_CONFIGURED', 'Funding source/environment does not match server configuration.', 503);
    if (pool.paused) throw new WalletError('WALLET_PAUSED', 'Wallet commitments are paused.', 409);
    if (!fresh) throw new WalletError('BALANCE_STALE', 'Refresh the verified Monnify funding balance before committing funds.', 409);
    const [events]=await tx.$queryRaw<any[]>`SELECT count(*)::integer AS "count" FROM "WalletProviderInbox" WHERE "processedAt" IS NULL`;
    if(events.count)throw new WalletError('FUNDING_RECONCILIATION_REQUIRED','Provider events are awaiting authenticated transfer reconciliation.',409);
    if (freeMinor < BigInt(0)) throw new WalletError('FUNDING_RECONCILIATION_REQUIRED', 'Credited staff funds exceed verified Monnify balance. Top up the Monnify funding account before new releases.', 409);
  }
  return { currency: 'NGN', environment:pool.environment,sourceLastFour:pool.sourceAccount.slice(-4), availableMinor: pool.availableMinor, feeReserveMinor: pool.feeReserveMinor, ...totals, freeMinor, observedAt: pool.observedAt, fresh, paused: pool.paused, configured, basis: 'CONSERVATIVE_PROVIDER_AVAILABLE_MINUS_ALL_UNSETTLED_COMMITMENTS' };
}
export async function journal(tx: Tx, actorId: string, kind: string, reference: string, from: string, to: string, amount: bigint) {
  const id = randomUUID();
  await tx.$executeRaw`INSERT INTO "WalletJournal" ("id","kind","reference","actorId") VALUES (${id},${kind},${reference},${actorId})`;
  await tx.$executeRaw`INSERT INTO "WalletJournalEntry" ("id","journalId","accountKey","amountMinor") VALUES
    (${randomUUID()},${id},${from},${-amount}), (${randomUUID()},${id},${to},${amount})`;
}
export type EnvelopeInput = { organizationId: string; label: string; amountMinor: string; idempotencyKey: string; parentId?: string };
export async function createFundedEnvelope(actor:WalletActor,input:EnvelopeInput) {
  requireCommitments();
  await (await import('./monnify-balance')).ensureWalletFundingFresh(actor);
  return walletTransaction(tx=>createFundedEnvelopeTx(tx,actor,input));
}
export async function createFundedEnvelopeTx(tx:Tx,actor:WalletActor,input:EnvelopeInput) {
  requireCommitments();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('bems-wallet-pool-v1',0))`;
  const amount = minorUnits(input.amountMinor);
  const label = String(input.label || '').trim();
  if (!label || label.length > 160 || !input.idempotencyKey || input.idempotencyKey.length > 128) throw new WalletError('INVALID_ENVELOPE', 'A label and valid idempotency key are required.');

    await liveWalletActor(tx, actor);
    if (!['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role)) throw new WalletError('NOT_PERMITTED', 'Budget administration requires executive authority.', 403);
    const [old] = await tx.$queryRaw<any[]>`SELECT * FROM "WalletBudgetEnvelope" WHERE "idempotencyKey" = ${input.idempotencyKey}`;
    if (old) {
      if (old.createdById !== actor.id || old.organizationId !== input.organizationId || old.label !== label || old.allocatedMinor !== amount || (old.parentId||null)!==(input.parentId||null)) throw new WalletError('IDEMPOTENCY_CONFLICT', 'This key was used for another budget allocation.', 409);
      return walletJson(old);
    }
    if (!await tx.organization.findFirst({ where: { id: input.organizationId, status: 'ACTIVE', defaultCurrency: 'NGN' } })) throw new WalletError('INVALID_ORGANIZATION', 'Choose an active NGN organization.');
    const state = await fundingState(tx, true);
    if (input.parentId) {
      const [parent]=await tx.$queryRaw<any[]>`SELECT e.*,o."type" AS "organizationType" FROM "WalletBudgetEnvelope" e JOIN "Organization" o ON o."id"=e."organizationId" WHERE e."id"=${input.parentId} AND e."status"='ACTIVE' FOR UPDATE OF e`;
      if(!parent||parent.remainingMinor<amount||(parent.organizationId!==input.organizationId&&parent.organizationType!=='GROUP'))throw new WalletError('BUDGET_SCOPE_MISMATCH','The parent budget cannot cover this subdivision.',409);
      await tx.$executeRaw`UPDATE "WalletBudgetEnvelope" SET "remainingMinor"="remainingMinor"-${amount},"version"="version"+1 WHERE "id"=${input.parentId}`;
    } else if (amount > state.freeMinor) {
      throw new WalletError('INSUFFICIENT_FUNDED_CAPACITY', 'Subsidiary budget cannot exceed the available Monnify balance.', 409);
    }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "WalletBudgetEnvelope" ("id","organizationId","label","allocatedMinor","remainingMinor","createdById","idempotencyKey","parentId") VALUES (${id},${input.organizationId},${label},${amount},${amount},${actor.id},${input.idempotencyKey},${input.parentId||null})`;
    await journal(tx, actor.id, 'BUDGET_ALLOCATED', id, input.parentId?'ENVELOPE:'+input.parentId:'UNALLOCATED:NGN', 'ENVELOPE:' + id, amount);
    return { id, organizationId: input.organizationId, label, allocatedMinor: amount.toString(), remainingMinor: amount.toString() };
}
export async function readOwnWallet(actor: WalletActor) {
  // Read-only review stays available while monetary execution is disabled.
  return prisma.$transaction(async tx => {
    await liveWalletActor(tx, actor);
    if(actor.role!=='STAFF')throw new WalletError('STAFF_WALLET_REQUIRED','Use the executive funding dashboard for company payments.',403);
    const credits = await tx.$queryRaw<any[]>`SELECT "id","sourceType","sourceId","organizationId","category","amountMinor","availableMinor","heldMinor","settledMinor","returnedMinor","frozen","createdAt" FROM "WalletCreditLot" WHERE "employeeId" = ${actor.id} ORDER BY "createdAt" DESC LIMIT 100`;
    const [totals] = await tx.$queryRaw<any[]>`SELECT COALESCE(sum("availableMinor"),0)::bigint AS "availableMinor", COALESCE(sum("heldMinor"),0)::bigint AS "heldMinor", COALESCE(sum("settledMinor"),0)::bigint AS "settledMinor" FROM "WalletCreditLot" WHERE "employeeId" = ${actor.id}`;
    const banks = await tx.$queryRaw<any[]>`SELECT "id","bankCode",right("accountNumber",4) AS "lastFour","accountName","verifiedAt" FROM "WalletBankAccount" WHERE "employeeId" = ${actor.id} AND "active"`;
    const withdrawals = await tx.$queryRaw<any[]>`SELECT "id","amountMinor","feeMinor","reference","status","providerStatus",right("accountNumber",4) AS "lastFour","createdAt" FROM "WalletWithdrawal" WHERE "employeeId" = ${actor.id} ORDER BY "createdAt" DESC LIMIT 100`;
    return walletJson({ walletMode:walletEnabled(), currency: 'NGN', environment:process.env.MONNIFY_ENVIRONMENT, ...totals, credits, banks, withdrawals, withdrawalsEnabled: walletEnabled() && process.env.BEMS_WALLET_TRANSFERS_ENABLED === 'true', withdrawalMessage: 'Withdraw only your approved available funds to your verified bank account. The company pays transfer fees.' });
  }, { maxWait: 10000, timeout: 30000, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function readFundingDashboard(actor: WalletActor) {
  if(walletEnabled() && ['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))await(await import('./monnify-balance')).ensureWalletFundingFresh(actor);
  // Current-account/role checks below also apply in read-only review mode.
  return prisma.$transaction(async tx => {
    await liveWalletActor(tx, actor);
    if (!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role)) throw new WalletError('NOT_PERMITTED', 'Executive financial visibility is required.', 403);
    const envelopes = await tx.$queryRaw<any[]>`SELECT e.*, o."legalName" AS "organizationName" FROM "WalletBudgetEnvelope" e JOIN "Organization" o ON o."id" = e."organizationId" ORDER BY e."createdAt" DESC LIMIT 100`;
    let funding;
    try { funding = await fundingState(tx); } catch (error) { if (error instanceof WalletError && error.code === 'FUNDING_NOT_CONFIGURED') funding = null; else throw error; }
    const proposals = await tx.$queryRaw<any[]>`SELECT p."id",p."sourceType",p."sourceId",p."amountMinor",p."category",p."confirmationHash",p."expiresAt",p."conversationId" FROM "WalletReleaseProposal" p WHERE p."status"='PENDING' AND p."expiresAt">now() ORDER BY p."createdAt" DESC LIMIT 100`;
    for (const p of proposals) p.items = await tx.$queryRaw<any[]>`SELECT i.*, COALESCE(e."legalName",v."name") AS "employeeName",COALESCE(e."employeeNumber",'Vendor') AS "employeeNumber", o."legalName" AS "organizationName" FROM "WalletReleaseItem" i LEFT JOIN "Employee" e ON e."id"=i."employeeId" LEFT JOIN "Vendor" v ON v."id"=i."vendorId" JOIN "Organization" o ON o."id"=i."organizationId" WHERE i."proposalId"=${p.id} ORDER BY e."legalName",i."organizationId"`;
    for(const p of proposals){const r=p.sourceType==='REQUEST'?await tx.expenditureRequest.findUnique({where:{id:p.sourceId},select:{title:true,justification:true,requestNumber:true}}):null;const b=p.sourceType==='PAYROLL_BATCH'?await tx.payrollBatch.findUnique({where:{id:p.sourceId},select:{period:{select:{year:true,month:true}}}}):null;p.title=r?.title||(b?`Salary ${b.period.year}-${b.period.month}`:'Payment release');p.purpose=r?.justification||'Approved net salary';p.requestNumber=r?.requestNumber;}
    const payrollBatches = await tx.payrollBatch.findMany({ where: { status: { in: ['SUBMITTED','APPROVED'] }, bulkFundedAt: null }, select: { id:true,totalNetMinor:true,version:true,period:{select:{year:true,month:true}},items:{select:{employeeId:true,netMinor:true,allocations:{select:{subsidiaryId:true}},employee:{select:{legalName:true}}}} }, take:50 });
    const issues = await tx.$queryRaw<any[]>`SELECT "id","reference","code","detail","createdAt" FROM "WalletReconciliationIssue" WHERE "resolvedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 100`;
    const requests = await tx.expenditureRequest.findMany({ where: { currency: 'NGN', paymentStatus: {in:['UNPAID','MONNIFY_FAILED','MONNIFY_REVERSED']}, approvalStatus: { in: ['SUBMITTED','IN_REVIEW','APPROVED'] }, disbursements: { none: {} }, OR:[{vendorId:{not:null}},{requester: { role: 'STAFF', approvalStatus: 'APPROVED', status: { in: ['ACTIVE','ON_LEAVE'] } }}] }, select: { id: true, title: true, subsidiaryId: true, amountMinor: true, vendor:{select:{id:true,name:true}}, requester: { select: { legalName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    const transfers=await tx.$queryRaw<any[]>`SELECT w."id",w."reference",w."targetType",w."amountMinor",w."feeMinor",w."status",w."providerStatus",w."providerReference",w."createdAt",right(w."accountNumber",4) AS "lastFour",COALESCE(v."name",e."legalName") AS "beneficiaryName" FROM "WalletWithdrawal" w JOIN "Employee" e ON e."id"=w."employeeId" LEFT JOIN "Vendor" v ON v."id"=w."vendorId" ORDER BY w."createdAt" DESC LIMIT 100`;
    const vendors=await tx.$queryRaw<any[]>`SELECT "id","name","accountName",right(COALESCE("accountNumber",''),4) AS "lastFour","bankCode","verifiedBankAt" FROM "Vendor" ORDER BY "name" LIMIT 200`;
    const organizations = await tx.organization.findMany({ where: { status: 'ACTIVE', defaultCurrency: 'NGN' }, select: { id: true, code: true, legalName: true, type: true } });
    const staffWallets = await tx.$queryRaw<any[]>`SELECT e."id", e."legalName", e."employeeNumber", e."role", COALESCE(a."subsidiaryId", '') AS "subsidiaryId", COALESCE(o."legalName", 'Unassigned') AS "organizationName", COALESCE(sum(c."availableMinor"),0)::bigint AS "availableMinor", COALESCE(sum(c."heldMinor"),0)::bigint AS "heldMinor", COALESCE(sum(c."settledMinor"),0)::bigint AS "settledMinor" FROM "Employee" e LEFT JOIN "EmployeeAssignment" a ON a."employeeId"=e."id" AND a."status"='ACTIVE' AND a."isPrimary"=true LEFT JOIN "Organization" o ON o."id"=a."subsidiaryId" LEFT JOIN "WalletCreditLot" c ON c."employeeId"=e."id" WHERE e."role" = 'STAFF' AND e."approvalStatus"='APPROVED' AND e."status" IN ('ACTIVE','ON_LEAVE') GROUP BY e."id", e."legalName", e."employeeNumber", e."role", a."subsidiaryId", o."legalName" ORDER BY "availableMinor" DESC, e."legalName" ASC LIMIT 100`;
    const journals = await tx.$queryRaw<any[]>`SELECT j."id", j."kind", j."reference", j."createdAt", j."actorId", COALESCE(json_agg(json_build_object('id', je."id", 'accountKey', je."accountKey", 'amountMinor', je."amountMinor"::text)) FILTER (WHERE je."id" IS NOT NULL), '[]'::json) AS "entries" FROM "WalletJournal" j LEFT JOIN "WalletJournalEntry" je ON je."journalId"=j."id" GROUP BY j."id", j."kind", j."reference", j."createdAt", j."actorId" ORDER BY j."createdAt" DESC LIMIT 50`;
    return walletJson({ walletMode:walletEnabled(), processing:walletWorkerStatus(), funding, envelopes, proposals, requests, organizations, vendors, transfers, payrollBatches, issues, staffWallets, journals, approvalLabel: financialApproverLabel(), canApprove: walletEnabled() && canApproveWalletRelease(actor) });
  }, { maxWait: 10000, timeout: 30000, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
