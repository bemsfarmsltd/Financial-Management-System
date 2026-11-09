import {requiredFeeReserve,backedFeeReserve} from './fees';
import { randomUUID } from 'node:crypto';
import { WalletActor, WalletError, fundingState, fundingCommitments, liveWalletActor, requireWallet, walletJson, walletTransaction } from './core';

export function providerAmountMinor(value: unknown): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') throw new WalletError('INVALID_PROVIDER_BALANCE', 'Monnify returned an invalid balance.', 502);
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e12)) throw new WalletError('INVALID_PROVIDER_BALANCE', 'Monnify balance exceeds supported precision.', 502);
  const match = /^(0|[1-9]\d{0,12})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new WalletError('INVALID_PROVIDER_BALANCE', 'Monnify returned an unsupported monetary amount.', 502);
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] || '').padEnd(2, '0'));
}
async function providerJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new WalletError('PROVIDER_UNAVAILABLE', 'Monnify could not verify funding. No new funds were committed.', 503);
  const body = await response.json();
  if (body?.requestSuccessful !== true || !body.responseBody) throw new WalletError('PROVIDER_UNAVAILABLE', 'Monnify could not verify funding. No new funds were committed.', 503);
  return body.responseBody;
}
// Monnify's live customer-wallet response can omit identity echoes. The
// authenticated request is bound to the configured NGN source; reject any
// identity fields when supplied that contradict that exact request.
export function verifiedMonnifyBalance(body: any, sourceAccount: string): bigint {
  if (!body || (body.accountNumber != null && String(body.accountNumber) !== sourceAccount) || (body.currency != null && body.currency !== 'NGN')) throw new WalletError('PROVIDER_SOURCE_MISMATCH','Provider funding evidence contradicts the configured NGN source.',502);
  return providerAmountMinor(body.availableBalance);
}
export async function refreshMonnifyFunding(actor: WalletActor, forOwnWithdrawal = false) {
  requireWallet();
  // Authorization happens before any provider call, and again at commit.
  await walletTransaction(async tx => {
    await liveWalletActor(tx, actor);
    if (!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role) && !(forOwnWithdrawal && actor.role==='STAFF')) throw new WalletError('NOT_PERMITTED', 'Executive authority is required to refresh company funding.', 403);
  });
  const environment = process.env.MONNIFY_ENVIRONMENT || process.env.MONNIFY_ENV || 'live';
  const sourceAccount = process.env.MONNIFY_SOURCE_ACCOUNT || process.env.MONNIFY_WALLET_ACCOUNT_NUMBER || '';
  const key = process.env.MONNIFY_API_KEY; const secret = process.env.MONNIFY_SECRET_KEY;
  const reserve = process.env.BEMS_WALLET_FEE_RESERVE_MINOR || '9000';
  if (!['sandbox','live'].includes(environment || '') || !/^\d{10}$/.test(sourceAccount) || !key || !secret || !/^\d{1,15}$/.test(reserve)) {
    throw new WalletError('FUNDING_NOT_CONFIGURED', 'Configure the Monnify environment, source account, and credentials.', 503);
  }
  const base = environment === 'sandbox' ? 'https://sandbox.monnify.com' : 'https://api.monnify.com';
  const observationStartedAt = new Date();
  const auth = await providerJson(base + '/api/v1/auth/login', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'), 'Content-Type': 'application/json' } });
  if (typeof auth.accessToken !== 'string' || !auth.accessToken) throw new WalletError('PROVIDER_UNAVAILABLE', 'Monnify authentication failed.', 503);
  const body = await providerJson(base + '/api/v2/disbursements/wallet-balance?accountNumber=' + encodeURIComponent(sourceAccount), { headers: { Authorization: 'Bearer ' + auth.accessToken } });
  const amount = verifiedMonnifyBalance(body,sourceAccount);
  const observedAt = observationStartedAt;
  return walletTransaction(async tx => {
    await liveWalletActor(tx, actor);
    const [existing] = await tx.$queryRaw<Array<{ environment: string; sourceAccount: string; observedAt: Date }>>`SELECT "environment","sourceAccount","observedAt" FROM "WalletFundingPool" WHERE "id" = 'MONNIFY_NGN'`;
    // Never switch accounts/environments over existing obligations via a refresh.
    if (existing && (existing.environment !== environment || existing.sourceAccount !== sourceAccount)) throw new WalletError('PROVIDER_SOURCE_MISMATCH', 'Changing the funding source requires a reviewed migration.', 409);
    if (!existing || existing.observedAt <= observedAt) {
      const requiredFees=await requiredFeeReserve(tx);
      const commitments=await fundingCommitments(tx);
      const feeReserve=backedFeeReserve(amount,commitments.envelopeMinor+commitments.liabilityMinor,BigInt(reserve),requiredFees);
      await tx.$executeRaw`INSERT INTO "WalletBalanceObservation" ("id","environment","sourceAccount","availableMinor","observedAt") VALUES (${randomUUID()},${environment!},${sourceAccount},${amount},${observedAt})`;
      await tx.$executeRaw`INSERT INTO "WalletFundingPool" ("id","environment","sourceAccount","availableMinor","feeReserveMinor","observedAt","observationId","paused")
        VALUES ('MONNIFY_NGN',${environment!},${sourceAccount},${amount},${feeReserve},${observedAt},${randomUUID()},true)
        ON CONFLICT ("id") DO UPDATE SET "availableMinor" = EXCLUDED."availableMinor", "feeReserveMinor" = EXCLUDED."feeReserveMinor", "observedAt" = EXCLUDED."observedAt", "observationId" = EXCLUDED."observationId", "version" = "WalletFundingPool"."version" + 1`;
    }
    return walletJson(await fundingState(tx));
  });
}

export async function ensureWalletFundingFresh(actor:WalletActor,forOwnWithdrawal=false){
  if(process.env.BEMS_WALLET_AUTO_REFRESH==='false' && process.env.MONNIFY_ENVIRONMENT==='sandbox')return;
  const {prisma}=await import('@/lib/prisma');
  const [p]=await prisma.$queryRaw<Array<{observedAt:Date}>>`SELECT "observedAt" FROM "WalletFundingPool" WHERE "id"='MONNIFY_NGN'`;
  if(!p || Date.now()-p.observedAt.getTime()>15000)await refreshMonnifyFunding(actor,forOwnWithdrawal);
}
