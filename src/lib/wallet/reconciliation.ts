import {prisma} from '@/lib/prisma';
import {WalletActor,WalletError,liveWalletActor,walletJson,walletTransaction,fundingState} from './core';
import {listMonnifyTransfers} from './provider';
import {refreshMonnifyFunding} from './monnify-balance';
import {recordWalletIssue} from './withdrawals';
export async function reconcileWalletFunding(actor:WalletActor){
 await walletTransaction(async tx=>{await liveWalletActor(tx,actor);if(!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))throw new WalletError('NOT_PERMITTED','Executive reconciliation access is required.',403);await tx.$executeRaw`UPDATE "WalletFundingPool" SET "paused"=true WHERE "id"='MONNIFY_NGN'`;});
 const cutoff=Date.parse(process.env.BEMS_WALLET_CUTOVER_AT || '2026-11-08T00:00:00.000Z');
 if(!Number.isFinite(cutoff))throw new WalletError('CUTOVER_REQUIRED','Configure the reviewed wallet cutover timestamp before reconciling provider history.',503);
 let scanned=0,last=false;const unmatched:string[]=[];const limit=Math.min(100,Math.max(1,Number(process.env.BEMS_WALLET_RECONCILE_MAX_PAGES)||20));
 for(let page=0;page<limit;page++){
  const data=await listMonnifyTransfers(page);scanned+=data.transfers.length;
  for(const t of data.transfers){
   const created=Date.parse(t.createdOn||t.dateCreated||'');
   if(!Number.isFinite(created))throw new WalletError('INVALID_PROVIDER_RESULT','Provider history contains an unverifiable transaction timestamp.',502);
   if(created<cutoff)continue;
   if(typeof t.reference!=='string')throw new WalletError('INVALID_PROVIDER_RESULT','Provider history is missing a merchant reference.',502);
   const curEnv = process.env.MONNIFY_ENVIRONMENT || process.env.MONNIFY_ENV || 'live';
   const[w]=await prisma.$queryRaw<any[]>`SELECT "id" FROM "WalletWithdrawal" WHERE "reference"=${t.reference} AND "environment"=${curEnv}`;
   if(!w)unmatched.push(t.reference);
   else await prisma.$executeRaw`UPDATE "WalletWithdrawal" SET "nextAttemptAt"=now() WHERE "id"=${w.id} AND "status" NOT IN ('CANCELED','REVERSED')`;
  }
  if(data.last){last=true;break;}
 }
 await refreshMonnifyFunding(actor);
 return walletTransaction(async tx=>{
  for(const reference of unmatched)await recordWalletIssue(tx,'UNMATCHED_PROVIDER_TRANSFER','A post-cutover provider transfer has no internal approved withdrawal intent.',reference);
  const [issues]=await tx.$queryRaw<any[]>`SELECT count(*)::integer AS "count" FROM "WalletReconciliationIssue" WHERE "resolvedAt" IS NULL`;
  return walletJson({scanned,historyComplete:last,unmatchedReferences:unmatched,unresolvedIssues:issues.count,funding:await fundingState(tx),message:last?'Provider history queued for authenticated transaction reconciliation.':'History page limit reached. Increase the configured page bound and rerun; this is not a complete reconciliation.'});
 });
}
