import {accountabilityDeadline} from '@/lib/services/accountability-deadline';
import { randomUUID } from 'node:crypto';
import { WalletError, fundingState, journal, requireCommitments, walletTransaction } from './core';
import { queryMonnifyTransfer, submitMonnifyTransfer, TransferEvidence, TransferIntent, MonnifySubmissionRejected } from './provider';
import { recordWalletIssue } from './withdrawals';
export type WalletTransferProvider={submit:(intent:TransferIntent)=>Promise<unknown>;query:(reference:string)=>Promise<TransferEvidence>};
const realProvider:WalletTransferProvider={submit:submitMonnifyTransfer,query:queryMonnifyTransfer};
export async function processWalletTransfer(provider:WalletTransferProvider=realProvider) {
  requireCommitments();
  if(process.env.BEMS_WALLET_TRANSFERS_ENABLED!=='true')throw new WalletError('WITHDRAWALS_NOT_ACTIVATED','Transfer worker is disabled.',503);
  const {prisma}=await import('@/lib/prisma');
  const [next]=await prisma.$queryRaw<any[]>`SELECT "employeeId","status" FROM "WalletWithdrawal" WHERE "status" IN ('HELD','SUBMITTING','PENDING','UNKNOWN','SUCCEEDED','FAILED') AND "nextAttemptAt"<=now() AND ("leaseUntil" IS NULL OR "leaseUntil"<now()) ORDER BY CASE WHEN "status"='HELD' THEN 1 ELSE 0 END,"nextAttemptAt" LIMIT 1`;
  if(next?.status==='HELD'){const employee=await prisma.employee.findUnique({where:{id:next.employeeId}});if(employee&&['STAFF','GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(employee.role)&&['ACTIVE','ON_LEAVE'].includes(employee.status))await(await import('./monnify-balance')).ensureWalletFundingFresh(employee,true);}
  const job=await walletTransaction(async tx=>{
    const [w]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawal" WHERE "nextAttemptAt"<=now() AND ("leaseUntil" IS NULL OR "leaseUntil"<now()) AND "status" IN ('HELD','SUBMITTING','PENDING','UNKNOWN','SUCCEEDED','FAILED') ORDER BY CASE WHEN "status"='HELD' THEN 1 ELSE 0 END,"nextAttemptAt","id" LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if(!w)return null;
    if(w.environment!==process.env.MONNIFY_ENVIRONMENT||w.sourceAccount!==process.env.MONNIFY_SOURCE_ACCOUNT){await recordWalletIssue(tx,'SOURCE_MISMATCH','A queued transfer belongs to a different source or environment.',w.reference);return null;}
    const submit=w.status==='HELD'&&!w.submittedAt;
    if(submit) {
      await fundingState(tx,true);
      const owner=await tx.employee.findUnique({where:{id:w.employeeId}});
      const vendorIntent=w.targetType==='VENDOR';
      const [authorization]=vendorIntent?await tx.$queryRaw<any[]>`SELECT "status" FROM "WalletReleaseProposal" WHERE "id"=${w.proposalId}`:[];
      if(vendorIntent?authorization?.status!=='EXECUTED':!owner||owner.approvalStatus!=='APPROVED'||!['ACTIVE','ON_LEAVE'].includes(owner.status)||owner.role!=='STAFF'){
        await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "nextAttemptAt"=now()+interval '1 hour',"lastError"='OWNER_REQUIRES_REVIEW' WHERE "id"=${w.id}`;
        return null;
      }
    }
    const leaseToken=randomUUID();
    await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "status"=${submit?'SUBMITTING':w.status},"submittedAt"=CASE WHEN ${submit} THEN now() ELSE "submittedAt" END,"leaseToken"=${leaseToken},"leaseUntil"=now()+interval '90 seconds',"attempts"="attempts"+1,"updatedAt"=now() WHERE "id"=${w.id}`;
    return {...w,leaseToken,submit};
  });
  if(!job)return {processed:false};
  try {
    if(job.submit) {
      // Persisted submittedAt is written BEFORE the network call. A crashed or
      // expired worker can only query this stable reference, never blindly send again.
      const submitted:any=await provider.submit(job);
      await walletTransaction(async tx=>{
        await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "status"='PENDING',"providerStatus"=${typeof submitted?.status==='string'?submitted.status.slice(0,80):null},"leaseUntil"=NULL,"leaseToken"=NULL,"nextAttemptAt"=now(),"lastError"=NULL WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken}`;
      });
      return {processed:true,id:job.id,status:'PENDING'};
    }
    const queryStartedAt=new Date();
    const evidence=await provider.query(job.reference);
    return await applyWalletEvidence(job.id,job.leaseToken,evidence,queryStartedAt);
  }catch(error){
    if(job.submit && error instanceof MonnifySubmissionRejected){
      const result=await applyWalletEvidence(job.id,job.leaseToken,{reference:job.reference,amountMinor:job.amountMinor,currency:'NGN',bankCode:job.bankCode,accountNumber:job.accountNumber,status:'FAILED',feeMinor:BigInt(0),providerReference:null});
      if(['D04','D06'].includes(error.providerCode))await walletTransaction(tx=>recordWalletIssue(tx,'PROVIDER_SETUP_'+error.providerCode,'Provider funding or static-IP configuration rejected a transfer. Correct setup before resuming.',job.reference));
      return result;
    }
    await walletTransaction(async tx=>{
      if(error instanceof WalletError && error.code==='WITHDRAWAL_ALLOCATION_MISMATCH')await recordWalletIssue(tx,error.code,'Wallet projection failed validation; preserve all transfer evidence.',job.reference);
      await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "status"=CASE WHEN "status" IN ('SUCCEEDED','FAILED') THEN "status" ELSE 'UNKNOWN' END,"leaseUntil"=NULL,"leaseToken"=NULL,"nextAttemptAt"=now()+interval '60 seconds',"lastError"='PROVIDER_OUTCOME_UNCONFIRMED',"updatedAt"=now() WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken}`;
    });
    return {processed:true,id:job.id,status:'UNCONFIRMED'};
  }
}
export async function applyWalletEvidence(id:string,leaseToken:string,e:TransferEvidence,queryStartedAt:Date=new Date()){
  return walletTransaction(async tx=>{
    const [w]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawal" WHERE "id"=${id} FOR UPDATE`;
    if(!w||w.leaseToken!==leaseToken)return {processed:false,status:'LEASE_CHANGED'};
    if(e.reference!==w.reference||e.amountMinor!==w.amountMinor||e.currency!=='NGN'||e.bankCode!==w.bankCode||e.accountNumber!==w.accountNumber||e.feeMinor<BigInt(0)){
      await recordWalletIssue(tx,'PROVIDER_EVIDENCE_MISMATCH','Provider evidence differs from the immutable withdrawal intent.',w.reference);
      await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "leaseUntil"=NULL,"leaseToken"=NULL,"nextAttemptAt"=now()+interval '1 hour',"lastError"='PROVIDER_EVIDENCE_MISMATCH' WHERE "id"=${id}`;
      return {processed:true,status:'REVIEW_REQUIRED'};
    }
    await tx.$executeRaw`UPDATE "WalletReconciliationIssue" SET "resolvedAt"=now() WHERE "reference"=${w.reference} AND "code"='PROVIDER_EVIDENCE_MISMATCH' AND "resolvedAt" IS NULL`;
    const outcome=['SUCCESS','COMPLETED'].includes(e.status)?'SUCCEEDED':['FAILED','EXPIRED'].includes(e.status)?'FAILED':e.status==='REVERSED'?'REVERSED':'PENDING';
    if((w.status==='SUCCEEDED'&&outcome==='FAILED')||(w.status==='FAILED'&&outcome==='SUCCEEDED')){
      await recordWalletIssue(tx,'CONTRADICTORY_PROVIDER_STATUS','A definitive transfer status contradicted an earlier settlement. Do not release or repeat money.',w.reference);
      await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "leaseUntil"=NULL,"leaseToken"=NULL,"nextAttemptAt"=now()+interval '1 day' WHERE "id"=${id}`;
      return {processed:true,status:'REVIEW_REQUIRED'};
    }
    const terminal=['SUCCEEDED','FAILED','REVERSED','CANCELED'].includes(w.status);
    let status=terminal?w.status:outcome;
    if(w.status==='SUCCEEDED'&&outcome==='REVERSED')status='REVERSED';
    const transition=(!terminal&&['SUCCEEDED','FAILED','REVERSED'].includes(status))||(w.status==='SUCCEEDED'&&status==='REVERSED');
    if(transition) {
      if(w.targetType==='VENDOR'){
        let to='VENDOR_BANK_SETTLED:'+id;
        if(status!=='SUCCEEDED'){
          const[item]=await tx.$queryRaw<any[]>`SELECT "envelopeId" FROM "WalletReleaseItem" WHERE "proposalId"=${w.proposalId} AND "vendorId"=${w.vendorId}`;
          to='UNALLOCATED:NGN';
          if(item){const n=await tx.$executeRaw`UPDATE "WalletBudgetEnvelope" SET "remainingMinor"="remainingMinor"+${w.amountMinor},"version"="version"+1 WHERE "id"=${item.envelopeId} AND "status"='ACTIVE'`;if(n)to='ENVELOPE:'+item.envelopeId;}
        }
        await journal(tx,w.employeeId,status==='SUCCEEDED'?'WITHDRAWAL_SETTLED':status==='REVERSED'?'WITHDRAWAL_REVERSED':'WITHDRAWAL_RELEASED',id+':'+status,w.status==='SUCCEEDED'?'VENDOR_BANK_SETTLED:'+id:'VENDOR_HELD:'+id,to,w.amountMinor);
        await tx.expenditureRequest.update({where:{id:w.requestId},data:{paymentStatus:'MONNIFY_'+status}});
        if(status==='SUCCEEDED'){const r=await tx.expenditureRequest.findUniqueOrThrow({where:{id:w.requestId}});await tx.accountabilityCase.upsert({where:{requestId:r.id},update:{status:'OPEN',verifiedAt:null},create:{requestId:r.id,ownerUserId:r.requestedById,requiredDeliverables:r.deliverable,dueAt:await accountabilityDeadline(r.subsidiaryId,false,new Date(),tx)}});await tx.expenditureRequest.update({where:{id:r.id},data:{accountabilityStatus:'PENDING'}});}
      }else{
      const allocations=await tx.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawalAllocation" WHERE "withdrawalId"=${id} ORDER BY "creditLotId"`;
      if(allocations.reduce((n,a)=>n+a.amountMinor,BigInt(0))!==w.amountMinor)throw new WalletError('WITHDRAWAL_ALLOCATION_MISMATCH','Withdrawal allocations do not reconcile.',409);
      for(const a of allocations){
        const count=status==='SUCCEEDED'
          ?await tx.$executeRaw`UPDATE "WalletCreditLot" SET "heldMinor"="heldMinor"-${a.amountMinor},"settledMinor"="settledMinor"+${a.amountMinor} WHERE "id"=${a.creditLotId} AND "heldMinor">=${a.amountMinor}`
          :w.status==='SUCCEEDED'
            ?await tx.$executeRaw`UPDATE "WalletCreditLot" SET "settledMinor"="settledMinor"-${a.amountMinor},"availableMinor"="availableMinor"+${a.amountMinor} WHERE "id"=${a.creditLotId} AND "settledMinor">=${a.amountMinor}`
            :await tx.$executeRaw`UPDATE "WalletCreditLot" SET "heldMinor"="heldMinor"-${a.amountMinor},"availableMinor"="availableMinor"+${a.amountMinor} WHERE "id"=${a.creditLotId} AND "heldMinor">=${a.amountMinor}`;
        if(count!==1)throw new WalletError('WITHDRAWAL_ALLOCATION_MISMATCH','Wallet projection needs reconciliation.',409);
        if(status==='REVERSED'){const[c]=await tx.$queryRaw<any[]>`SELECT "sourceType","sourceId" FROM "WalletCreditLot" WHERE "id"=${a.creditLotId}`;if(c?.sourceType==='REQUEST'){await tx.accountabilityCase.updateMany({where:{requestId:c.sourceId,status:'CLOSED'},data:{status:'OPEN',verifiedAt:null}});await tx.expenditureRequest.update({where:{id:c.sourceId},data:{accountabilityStatus:'PENDING'}});}}
      }
      await journal(tx,w.employeeId,status==='SUCCEEDED'?'WITHDRAWAL_SETTLED':status==='REVERSED'?'WITHDRAWAL_REVERSED':'WITHDRAWAL_RELEASED',id+':'+status,w.status==='SUCCEEDED'?'BANK_SETTLED:'+id:'HELD:'+id,status==='SUCCEEDED'?'BANK_SETTLED:'+id:'STAFF:'+w.employeeId,w.amountMinor);
      }
      // Force a new authenticated provider balance observation after a terminal
      // movement; never pretend a cached pre-transfer balance is still current.
      await tx.$executeRaw`UPDATE "WalletFundingPool" SET "observedAt"=to_timestamp(0) WHERE "id"='MONNIFY_NGN'`;
      await tx.systemNotification.create({data:{employeeId:w.employeeId,kind:'WALLET_WITHDRAWAL_'+status,title:status==='SUCCEEDED'?'Bank transfer completed':status==='REVERSED'?'Bank transfer reversed':'Withdrawal failed',body:w.targetType==='VENDOR'?'Vendor payment status: '+status+'. Review its source request and provider reference.':status==='SUCCEEDED'?'Monnify confirmed your bank transfer. Company fees did not reduce your principal.':'Your approved principal is available again. Review the withdrawal history before retrying.',linkUrl:'/wallet'}});
    }
      const feeDelta=e.feeMinor-w.feeMinor;
      if(feeDelta>BigInt(0)){
        await journal(tx,w.employeeId,'TRANSFER_FEE',id+':FEE:'+e.feeMinor.toString(),'CASH:NGN','COMPANY_TRANSFER_EXPENSE',feeDelta);
        await tx.$executeRaw`UPDATE "WalletFundingPool" SET "feeReserveMinor"=GREATEST(0,"feeReserveMinor"-${feeDelta}) WHERE "id"='MONNIFY_NGN'`;
      }
      if(e.feeMinor>w.feeLimitMinor)await recordWalletIssue(tx,'FEE_LIMIT_EXCEEDED','An actual company transfer fee exceeded its reserved limit.',w.reference);
    if(['SUCCEEDED','FAILED','REVERSED'].includes(status))await tx.$executeRaw`UPDATE "WalletProviderInbox" SET "processedAt"=now() WHERE "reference"=${w.reference} AND "receivedAt"<=${queryStartedAt} AND "processedAt" IS NULL`;
    const [pendingEvents]=await tx.$queryRaw<any[]>`SELECT count(*)::integer AS "count" FROM "WalletProviderInbox" WHERE "reference"=${w.reference} AND "processedAt" IS NULL`;
    await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "status"=${status},"providerStatus"=${e.status},"providerReference"=COALESCE(${e.providerReference},"providerReference"),"feeMinor"=GREATEST("feeMinor",${e.feeMinor}),"leaseUntil"=NULL,"leaseToken"=NULL,"nextAttemptAt"=CASE WHEN ${pendingEvents.count>0} THEN now() WHEN ${status==='SUCCEEDED'} THEN now()+interval '1 hour' WHEN ${['FAILED','REVERSED','CANCELED'].includes(status)} THEN now()+interval '100 years' ELSE now()+interval '30 seconds' END,"lastError"=NULL,"updatedAt"=now() WHERE "id"=${id}`;
    return {processed:true,id,status};
  });
}
