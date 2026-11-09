import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { WalletActor, WalletError, fundingState, hash, journal, liveWalletActor, minorUnits, requireWallet, requireCommitments, walletJson, walletTransaction } from './core';
import { SecurityProof, challengePayload, consumeWalletChallenge, verifyWalletPassword } from './security';
import { verifyMonnifyDestination } from './provider';
function normalizedName(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
export async function saveVerifiedWalletBank(actor:WalletActor,input:{accountNumber:string;bankCode:string;password:unknown}) {
  await verifyWalletPassword(actor,input.password);
  const bank=await verifyMonnifyDestination(String(input.accountNumber),String(input.bankCode));
  return walletTransaction(async tx=>{
    const employee=await liveWalletActor(tx,actor);
    if(employee.role!=='STAFF')throw new WalletError('OWNER_REQUIRED','Staff wallets can only be configured by their owner.',403);
    if(normalizedName(bank.accountName)!==normalizedName(employee.legalName))throw new WalletError('ACCOUNT_NAME_MISMATCH','The bank account name must match your verified staff identity. Ask support to resolve your identity details before withdrawing.',409);
    const fingerprint=hash(bank); const id=randomUUID();
    await tx.$executeRaw`UPDATE "WalletBankAccount" SET "active"=false WHERE "employeeId"=${actor.id} AND "active"`;
    const [old]=await tx.$queryRaw<any[]>`SELECT "id" FROM "WalletBankAccount" WHERE "employeeId"=${actor.id} AND "fingerprint"=${fingerprint}`;
    if(old)await tx.$executeRaw`UPDATE "WalletBankAccount" SET "active"=true,"verifiedAt"=now() WHERE "id"=${old.id}`;
    else await tx.$executeRaw`INSERT INTO "WalletBankAccount" ("id","employeeId","accountNumber","bankCode","accountName","fingerprint") VALUES (${id},${actor.id},${bank.accountNumber},${bank.bankCode},${bank.accountName},${fingerprint})`;
    await tx.$executeRaw`UPDATE "WalletChallenge" SET "usedAt"=now() WHERE "actorId"=${actor.id} AND "purpose"='WITHDRAWAL' AND "usedAt" IS NULL`;
    await tx.systemNotification.create({data:{employeeId:actor.id,kind:'WALLET_BANK_CHANGED',title:'Wallet bank account verified',body:'Your withdrawal account was verified. If you did not make this change, contact support immediately.',linkUrl:'/wallet'}});
    return {id:old?.id||id,bankCode:bank.bankCode,lastFour:bank.accountNumber.slice(-4),accountName:bank.accountName};
  });
}
export async function requestWalletWithdrawal(actor:WalletActor,input:any,proof?:SecurityProof) {
  requireWallet();
  if(process.env.BEMS_WALLET_TRANSFERS_ENABLED==='false')throw new WalletError('WITHDRAWALS_NOT_ACTIVATED','Secure withdrawals have not been enabled for this environment.',503);
  requireCommitments();
  await (await import('./monnify-balance')).ensureWalletFundingFresh(actor,true);
  const intent=challengePayload('WITHDRAWAL',input) as {amountMinor:string;bankAccountId:string;idempotencyKey:string;creditAllocations:Array<{creditLotId:string;amountMinor:string}>};
  const amount=minorUnits(intent.amountMinor),feeLimit=minorUnits(process.env.BEMS_WALLET_MAX_TRANSFER_FEE_MINOR || '4500');
  const maximum=minorUnits(process.env.BEMS_WALLET_DAILY_LIMIT_MINOR||'2500000000');
  const minimum=minorUnits(process.env.BEMS_WALLET_MIN_WITHDRAWAL_MINOR||'10000');
  if(amount<minimum||amount>maximum)throw new WalletError('WITHDRAWAL_LIMIT','The amount is outside the configured withdrawal limits.');
  return walletTransaction(async tx=>{
    const employee=await liveWalletActor(tx,actor);
    if(employee.role!=='STAFF')throw new WalletError('OWNER_REQUIRED','Only staff can withdraw their own approved funds.',403);
    const [old]=await tx.$queryRaw<any[]>`SELECT "id","intentHash","status","reference" FROM "WalletWithdrawal" WHERE "employeeId"=${actor.id} AND "idempotencyKey"=${intent.idempotencyKey}`;
    if(old){if(old.intentHash!==hash(intent))throw new WalletError('IDEMPOTENCY_CONFLICT','This withdrawal key belongs to a different transaction.',409);return {id:old.id,status:old.status,reference:old.reference,alreadyExecuted:true};}
    await consumeWalletChallenge(tx,actor,'WITHDRAWAL',intent,proof);
    const [bank]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletBankAccount" WHERE "id"=${intent.bankAccountId} AND "employeeId"=${actor.id} AND "active"`;
    if(!bank||normalizedName(bank.accountName)!==normalizedName(employee.legalName))throw new WalletError('BANK_VERIFICATION_REQUIRED','Verify your own withdrawal bank account first.',409);
    const [limits]=await tx.$queryRaw<any[]>`SELECT COALESCE(sum("amountMinor"),0)::bigint AS "total",count(*)::integer AS "count" FROM "WalletWithdrawal" WHERE "employeeId"=${actor.id} AND "createdAt">=now()-interval '24 hours' AND "status" NOT IN ('FAILED','CANCELED','REVERSED')`;
    if(limits.total+amount>maximum||limits.count>=10)throw new WalletError('WITHDRAWAL_LIMIT','Your rolling 24-hour withdrawal limit has been reached.',409);
    const state=await fundingState(tx,true);
    const [fees]=await tx.$queryRaw<any[]>`SELECT COALESCE(sum("feeLimitMinor"),0)::bigint AS "reserved" FROM "WalletWithdrawal" WHERE "status" IN ('HELD','SUBMITTING','PENDING','UNKNOWN')`;
    if(state.feeReserveMinor<fees.reserved+feeLimit)throw new WalletError('FEE_RESERVE_INSUFFICIENT','The company must replenish its transfer-fee reserve. Your approved principal is unchanged.',409);
    for(const allocation of intent.creditAllocations){
      const [lot]=await tx.$queryRaw<any[]>`SELECT c.*,p."status" AS "approvalStatus",p."approvedById" FROM "WalletCreditLot" c JOIN "WalletReleaseProposal" p ON p."id"=c."proposalId" WHERE c."id"=${allocation.creditLotId} AND c."employeeId"=${actor.id} FOR UPDATE OF c`;
      if(!lot||lot.approvalStatus!=='EXECUTED'||!lot.approvedById||lot.frozen||lot.availableMinor<BigInt(allocation.amountMinor))throw new WalletError('NO_APPROVED_FUNDS','Each withdrawal must use your own available GMD-approved credit lots.',409);
      await tx.$executeRaw`UPDATE "WalletCreditLot" SET "availableMinor"="availableMinor"-${BigInt(allocation.amountMinor)},"heldMinor"="heldMinor"+${BigInt(allocation.amountMinor)} WHERE "id"=${lot.id}`;
    }
    const id=randomUUID(),reference='BEMS-W-'+id;
    const monnifyEnv = process.env.MONNIFY_ENVIRONMENT || process.env.MONNIFY_ENV || 'live';
    const sourceAcc = process.env.MONNIFY_SOURCE_ACCOUNT || process.env.MONNIFY_WALLET_ACCOUNT_NUMBER || '';
    await tx.$executeRaw`INSERT INTO "WalletWithdrawal" ("id","employeeId","amountMinor","feeLimitMinor","reference","idempotencyKey","intentHash","environment","sourceAccount","bankAccountId","bankCode","accountNumber","accountName") VALUES (${id},${actor.id},${amount},${feeLimit},${reference},${intent.idempotencyKey},${hash(intent)},${monnifyEnv},${sourceAcc},${bank.id},${bank.bankCode},${bank.accountNumber},${bank.accountName})`;
    for(const a of intent.creditAllocations)await tx.$executeRaw`INSERT INTO "WalletWithdrawalAllocation" ("id","withdrawalId","creditLotId","amountMinor") VALUES (${randomUUID()},${id},${a.creditLotId},${BigInt(a.amountMinor)})`;
    await journal(tx,actor.id,'WITHDRAWAL_HELD',id,'STAFF:'+actor.id,'HELD:'+id,amount);
    return {id,reference,status:'HELD',amountMinor:amount.toString(),alreadyExecuted:false,message:'Withdrawal reserved and queued. No second GMD approval is required.'};
  });
}
export async function recordWalletIssue(tx:Prisma.TransactionClient,code:string,detail:string,reference:string|null=null){
  await tx.$executeRaw`INSERT INTO "WalletReconciliationIssue" ("id","code","detail","reference") SELECT ${randomUUID()},${code},${detail},${reference} WHERE NOT EXISTS (SELECT 1 FROM "WalletReconciliationIssue" WHERE "code"=${code} AND "reference" IS NOT DISTINCT FROM ${reference} AND "resolvedAt" IS NULL)`;
  await tx.$executeRaw`UPDATE "WalletFundingPool" SET "paused"=true WHERE "id"='MONNIFY_NGN'`;
}
export async function cancelQueuedWithdrawal(actor:WalletActor,id:string){
 return walletTransaction(async tx=>{
  await liveWalletActor(tx,actor);
  const[w]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawal" WHERE "id"=${id} AND "employeeId"=${actor.id} FOR UPDATE`;
  if(!w)throw new WalletError('NOT_FOUND','Withdrawal not found.',404);
  if(w.status==='CANCELED')return {id,status:'CANCELED'};
  if(w.status!=='HELD'||w.submittedAt)throw new WalletError('TRANSFER_ALREADY_SUBMITTED','This withdrawal may already have reached Monnify. It cannot safely be canceled.',409);
  const allocations=await tx.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawalAllocation" WHERE "withdrawalId"=${id}`;
  for(const a of allocations){const n=await tx.$executeRaw`UPDATE "WalletCreditLot" SET "heldMinor"="heldMinor"-${a.amountMinor},"availableMinor"="availableMinor"+${a.amountMinor} WHERE "id"=${a.creditLotId} AND "employeeId"=${actor.id} AND "heldMinor">=${a.amountMinor}`;if(n!==1)throw new WalletError('RECONCILIATION_REQUIRED','The withdrawal must be reconciled before canceling.',409);}
  await journal(tx,actor.id,'WITHDRAWAL_RELEASED',id+':CANCELED','HELD:'+id,'STAFF:'+actor.id,w.amountMinor);
  await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "status"='CANCELED',"nextAttemptAt"=now()+interval '100 years',"updatedAt"=now() WHERE "id"=${id}`;
  return {id,status:'CANCELED'};
 });
}
export async function planWalletWithdrawal(actor:WalletActor,input:{amountMinor:string;bankAccountId:string;idempotencyKey:string}){
 const amount=minorUnits(input.amountMinor);
 return walletTransaction(async tx=>{
  await liveWalletActor(tx,actor);if(actor.role!=='STAFF')throw new WalletError('OWNER_REQUIRED','Only staff can plan their own withdrawal.',403);
  const rows=await tx.$queryRaw<any[]>`SELECT c."id",c."availableMinor",c."category" FROM "WalletCreditLot" c JOIN "WalletReleaseProposal" p ON p."id"=c."proposalId" WHERE c."employeeId"=${actor.id} AND c."availableMinor">0 AND NOT c."frozen" AND p."status"='EXECUTED' ORDER BY c."createdAt",c."id" LIMIT 1000`;
  let remaining=amount;const creditAllocations=[];
  for(const c of rows){if(remaining===BigInt(0))break;const part=remaining<c.availableMinor?remaining:c.availableMinor;creditAllocations.push({creditLotId:c.id,amountMinor:part.toString()});remaining-=part;}
  if(remaining>BigInt(0))throw new WalletError('INSUFFICIENT_WALLET_BALANCE','Your available approved sources cannot cover this withdrawal.',409);
  return {intent:challengePayload('WITHDRAWAL',{...input,creditAllocations}),allocationPreview:creditAllocations.map(a=>({...a,category:rows.find(r=>r.id===a.creditLotId).category}))};
 });
}
