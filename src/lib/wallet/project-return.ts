import {randomUUID} from 'node:crypto';
import {WalletActor,WalletError,hash,journal,liveWalletActor,walletTransaction} from './core';
import {SecurityProof,challengePayload,consumeWalletChallenge} from './security';
export async function returnProjectFunds(actor:WalletActor,raw:any,proof?:SecurityProof){
 const input=challengePayload('RETURN_PROJECT',raw) as {creditLotId:string;amountMinor:string;reason:string;idempotencyKey:string};
 return walletTransaction(async tx=>{
  await liveWalletActor(tx,actor);
  const[old]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletProjectReturn" WHERE "employeeId"=${actor.id} AND "idempotencyKey"=${input.idempotencyKey}`;
  if(old){if(old.intentHash!==hash(input))throw new WalletError('IDEMPOTENCY_CONFLICT','This return key belongs to another transaction.',409);return {id:old.id,amountMinor:old.amountMinor.toString(),alreadyExecuted:true};}
  await consumeWalletChallenge(tx,actor,'RETURN_PROJECT',input,proof);
  const[c]=await tx.$queryRaw<any[]>`SELECT c.*,COALESCE(i."envelopeId",p."envelopeId") AS "envelopeId" FROM "WalletCreditLot" c JOIN "WalletReleaseProposal" p ON p."id"=c."proposalId" LEFT JOIN "WalletReleaseItem" i ON i."id"=c."releaseItemId" WHERE c."id"=${input.creditLotId} AND c."employeeId"=${actor.id} AND p."status"='EXECUTED' FOR UPDATE OF c`;
  const amount=BigInt(input.amountMinor);
  if(!c||!['PROJECT','REQUEST'].includes(c.category)||c.availableMinor<amount)throw new WalletError('RETURN_NOT_ALLOWED','Only your unused project/request funds can be returned. Salary and reimbursement cannot be clawed back.',409);
  await tx.$executeRaw`UPDATE "WalletCreditLot" SET "availableMinor"="availableMinor"-${amount},"returnedMinor"="returnedMinor"+${amount} WHERE "id"=${c.id}`;
  let destination='UNALLOCATED:NGN';
  if(c.envelopeId){const n=await tx.$executeRaw`UPDATE "WalletBudgetEnvelope" SET "remainingMinor"="remainingMinor"+${amount},"version"="version"+1 WHERE "id"=${c.envelopeId} AND "status"='ACTIVE'`;if(n)destination='ENVELOPE:'+c.envelopeId;}
  const id=randomUUID();
  await tx.$executeRaw`INSERT INTO "WalletProjectReturn" ("id","employeeId","creditLotId","amountMinor","reason","idempotencyKey","intentHash") VALUES (${id},${actor.id},${c.id},${amount},${input.reason},${input.idempotencyKey},${hash(input)})`;
  await journal(tx,actor.id,'PROJECT_FUNDS_RETURNED',id,'STAFF:'+actor.id,destination,amount);
  await tx.systemNotification.create({data:{employeeId:actor.id,kind:'PROJECT_FUNDS_RETURNED',title:'Unused project funds returned',body:'Your unused project entitlement was returned to company funding. No bank transfer was required.',linkUrl:'/wallet'}});
  return {id,amountMinor:amount.toString(),alreadyExecuted:false};
 });
}
