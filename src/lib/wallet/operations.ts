import { randomUUID } from 'node:crypto';
import { WalletActor, WalletError, fundingState, journal, liveWalletActor, minorUnits, requireCommitments, walletJson, walletTransaction } from './core';
import { consumeWalletChallenge, SecurityProof } from './security';
export async function controlWalletPool(actor:WalletActor,operation:string,proof?:SecurityProof){
  requireCommitments();
  if(operation==='ACTIVATE')await(await import('./monnify-balance')).ensureWalletFundingFresh(actor);
  return walletTransaction(async tx=>{
    await liveWalletActor(tx,actor,operation!=='PAUSE');
    if(!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))throw new WalletError('NOT_PERMITTED','Executive security authority is required.',403);
    await consumeWalletChallenge(tx,actor,'POOL_CONTROL',{operation},proof);
    if(operation==='ACTIVATE'){
      const s=await fundingState(tx);
      const [issues]=await tx.$queryRaw<any[]>`SELECT count(*)::integer AS "count" FROM "WalletReconciliationIssue" WHERE "resolvedAt" IS NULL`;
      const [queued]=await tx.$queryRaw<any[]>`SELECT count(*)::integer AS "count" FROM "WalletWithdrawal" WHERE "status" IN ('SUBMITTING','PENDING','UNKNOWN','SUCCEEDED','FAILED') AND "nextAttemptAt"<=now()`;
      if(queued.count)throw new WalletError('FUNDING_RECONCILIATION_REQUIRED','Run the transfer reconciliation worker before restoring processing.',409);
      if(!s.fresh||!s.configured||s.freeMinor<BigInt(0)||issues.count)throw new WalletError('FUNDING_RECONCILIATION_REQUIRED','Fresh matching funding and resolved reconciliation exceptions are required.',409);
      if(process.env.BEMS_WALLET_OPENING_RECONCILED==='false')throw new WalletError('OPENING_RECONCILIATION_REQUIRED','Complete the reviewed opening reconciliation.',409);
    }else if(operation!=='PAUSE')throw new WalletError('INVALID_OPERATION','Choose PAUSE or ACTIVATE.');
    await tx.$executeRaw`UPDATE "WalletFundingPool" SET "paused"=${operation==='PAUSE'},"version"="version"+1 WHERE "id"='MONNIFY_NGN'`;
    return {operation,paused:operation==='PAUSE'};
  });
}
export type EnvelopeAdjustment={operation:string;amountMinor?:string;targetEnvelopeId?:string;expectedVersion:number};
export async function adjustFundedEnvelope(actor:WalletActor,id:string,input:EnvelopeAdjustment){
 requireCommitments();await(await import('./monnify-balance')).ensureWalletFundingFresh(actor);
 return walletTransaction(tx=>adjustFundedEnvelopeTx(tx,actor,id,input));
}
export async function adjustFundedEnvelopeTx(tx:import('@prisma/client').Prisma.TransactionClient,actor:WalletActor,id:string,input:EnvelopeAdjustment){
 requireCommitments();await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('bems-wallet-pool-v1',0))`;

    await liveWalletActor(tx,actor);
    if(!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))throw new WalletError('NOT_PERMITTED','Executive budget authority is required.',403);
    const [e]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletBudgetEnvelope" WHERE "id"=${id} FOR UPDATE`;
    if(!e||e.status!=='ACTIVE'||e.version!==input.expectedVersion)throw new WalletError('BUDGET_CHANGED','Refresh the current funded budget version.',409);
    const state=await fundingState(tx,true);const operation=input.operation;
    const amount=operation==='CLOSE'?e.remainingMinor:minorUnits(input.amountMinor);
    if(operation==='INCREASE'){
      if(amount>state.freeMinor)throw new WalletError('INSUFFICIENT_FUNDED_CAPACITY','Subsidiary budget cannot exceed the available Monnify balance.',409);
      await tx.$executeRaw`UPDATE "WalletBudgetEnvelope" SET "allocatedMinor"="allocatedMinor"+${amount},"remainingMinor"="remainingMinor"+${amount},"version"="version"+1 WHERE "id"=${id}`;
    }else if(['REDUCE','CLOSE','REALLOCATE'].includes(operation)){
      if(amount>e.remainingMinor)throw new WalletError('BUDGET_COMMITTED','Approved or subdivided funds cannot be removed.',409);
      if(operation==='REALLOCATE'){
        if(!input.targetEnvelopeId||input.targetEnvelopeId===id)throw new WalletError('INVALID_TARGET','Choose a different funded budget.');
        const n=await tx.$executeRaw`UPDATE "WalletBudgetEnvelope" SET "allocatedMinor"="allocatedMinor"+${amount},"remainingMinor"="remainingMinor"+${amount},"version"="version"+1 WHERE "id"=${input.targetEnvelopeId} AND "status"='ACTIVE'`;
        if(n!==1)throw new WalletError('INVALID_TARGET','Target budget is not active.');
      }
      await tx.$executeRaw`UPDATE "WalletBudgetEnvelope" SET "remainingMinor"="remainingMinor"-${amount},"status"=${operation==='CLOSE'?'CLOSED':'ACTIVE'},"version"="version"+1 WHERE "id"=${id}`;
    }else throw new WalletError('INVALID_OPERATION','Choose INCREASE, REDUCE, REALLOCATE or CLOSE.');
    if(amount>BigInt(0))await journal(tx,actor.id,'BUDGET_ADJUSTED',randomUUID(),operation==='INCREASE'?'UNALLOCATED:NGN':'ENVELOPE:'+id,operation==='REALLOCATE'?'ENVELOPE:'+input.targetEnvelopeId:operation==='INCREASE'?'ENVELOPE:'+id:'UNALLOCATED:NGN',amount);
    return walletJson({id,operation,amountMinor:amount});
}
export async function acknowledgeWalletIssue(actor:WalletActor,input:{issueId:string;note:string},proof?:SecurityProof){
 await(await import('./monnify-balance')).ensureWalletFundingFresh(actor);
 return walletTransaction(async tx=>{
  await liveWalletActor(tx,actor,true);
  await consumeWalletChallenge(tx,actor,'POOL_CONTROL',{operation:'ACKNOWLEDGE_ISSUE',issueId:input.issueId,note:input.note},proof);
  const[i]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletReconciliationIssue" WHERE "id"=${input.issueId} FOR UPDATE`;
  if(!i||i.resolvedAt)throw new WalletError('NOT_FOUND','Unresolved issue not found.',404);
  if(!['PROVIDER_SETUP_D04','PROVIDER_SETUP_D06','FEE_LIMIT_EXCEEDED'].includes(i.code))throw new WalletError('FORENSIC_REVIEW_REQUIRED','This discrepancy cannot be waived. Reconcile its actual provider evidence and ledger first.',409);
  const state=await fundingState(tx);
  if(!state.fresh||!state.configured||state.freeMinor<BigInt(0))throw new WalletError('FUNDING_RECONCILIATION_REQUIRED','Fresh fully backed funding is required before acknowledging the correction.',409);
  if(i.code==='FEE_LIMIT_EXCEEDED'){
   const[w]=await tx.$queryRaw<any[]>`SELECT "feeMinor" FROM "WalletWithdrawal" WHERE "reference"=${i.reference}`;
   if(!w||BigInt(process.env.BEMS_WALLET_MAX_TRANSFER_FEE_MINOR||'4500')<w.feeMinor)throw new WalletError('FEE_POLICY_REQUIRED','Update the verified fee policy and replenish company backing first.',409);
  }
  await tx.$executeRaw`UPDATE "WalletReconciliationIssue" SET "resolvedAt"=now(),"resolvedById"=${actor.id},"detail"="detail"||${' | GMD correction acknowledgment: '+input.note} WHERE "id"=${input.issueId}`;
  return {id:input.issueId,resolved:true,paused:true,message:'Correction acknowledged. Pool remains paused until GMD reviews activation.'};
 });
}
