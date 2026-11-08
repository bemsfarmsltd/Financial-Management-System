import { createHmac,randomUUID,timingSafeEqual } from 'node:crypto';
import { WalletError, hash, walletTransaction } from './core';
export async function receiveMonnifyEvent(raw:string,signature:string|null) {
  if(Buffer.byteLength(raw)>65536)throw new WalletError('PAYLOAD_TOO_LARGE','Webhook exceeds the accepted size.',413);
  const secret=process.env.MONNIFY_SECRET_KEY;
  const live=process.env.MONNIFY_ENVIRONMENT==='live';
  if(!secret)throw new WalletError('PROVIDER_NOT_CONFIGURED','Webhook verification is not configured.',503);
  if(live||signature){
    if(process.env.MONNIFY_WEBHOOK_SIGNATURE_MODE!=='HMAC_SHA512')throw new WalletError('SIGNATURE_CONFIGURATION_REQUIRED','Confirm the merchant webhook signature protocol before activation.',503);
    const expected=createHmac('sha512',secret).update(raw).digest('hex');
    if(!signature||!/^[a-f0-9]{128}$/i.test(signature)||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))throw new WalletError('INVALID_SIGNATURE','Webhook authentication failed.',401);
  }else if(process.env.MONNIFY_ENVIRONMENT!=='sandbox')throw new WalletError('INVALID_SIGNATURE','Webhook authentication failed.',401);
  let body;try{body=JSON.parse(raw);}catch{throw new WalletError('INVALID_EVENT','Invalid event body.');}
  const reference=body?.eventData?.reference;
  // Completion callbacks never create credits or settle withdrawals directly.
  // Even sandbox notifications can only wake a query of an existing reference.
  if(typeof reference!=='string'||typeof body.eventType!=='string')return {received:true,ignored:true};
  return walletTransaction(async tx=>{
    const [withdrawal]=await tx.$queryRaw<any[]>`SELECT "id","environment" FROM "WalletWithdrawal" WHERE "reference"=${reference}`;
    if(!withdrawal||withdrawal.environment!==process.env.MONNIFY_ENVIRONMENT)return {received:true,ignored:true};
    const n=await tx.$executeRaw`INSERT INTO "WalletProviderInbox" ("id","bodyHash","reference","eventType") VALUES (${randomUUID()},${hash(raw)},${reference},${body.eventType.slice(0,100)}) ON CONFLICT ("bodyHash") DO NOTHING`;
    if(n)await tx.$executeRaw`UPDATE "WalletWithdrawal" SET "nextAttemptAt"=now() WHERE "id"=${withdrawal.id}`;
    return {received:true,duplicate:n===0};
  });
}
export async function validateMonnifyIntent(body:any,signature:string|null,timestamp:string|null){
  if(process.env.BEMS_MONNIFY_VALIDATION_ENABLED!=='true')throw new WalletError('VALIDATION_NOT_CONFIGURED','Transaction validation is disabled.',503);
  const secret=process.env.MONNIFY_SECRET_KEY,merchant=process.env.MONNIFY_MERCHANT_CODE;
  const reference=body?.type==='SINGLE'?body?.data?.reference:body?.data?.batchReference;
  if(!secret||!merchant||typeof reference!=='string')return {decision:'REJECT'};
  const expected=createHmac('sha256',secret).update(merchant+':'+body.type+':'+reference).digest('hex');
  const time=timestamp&&/^\d+$/.test(timestamp)?Number(timestamp)*(timestamp.length<=10?1000:1):Date.parse(timestamp||'');
  if(!signature||!/^[a-f0-9]{64}$/i.test(signature)||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex'))||!Number.isFinite(time)||Math.abs(Date.now()-time)>300000)throw new WalletError('INVALID_SIGNATURE','Transaction validation authentication failed.',401);
  if(body.type!=='SINGLE')return {decision:'REJECT'};
  return walletTransaction(async tx=>{
    const [w]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawal" WHERE "reference"=${reference}`;
    if(!w||!['SUBMITTING','PENDING','UNKNOWN'].includes(w.status)||w.environment!==process.env.MONNIFY_ENVIRONMENT||w.sourceAccount!==body.data.sourceAccountNumber||w.bankCode!==body.data.destinationBankCode||w.accountNumber!==body.data.destinationAccountNumber||body.data.currency!=='NGN')return {decision:'REJECT'};
    const {providerAmountMinor}=await import('./monnify-balance');
    if(providerAmountMinor(body.data.amount)!==w.amountMinor)return {decision:'REJECT'};
    const [s]=await tx.$queryRaw<any[]>`SELECT count(*)::integer AS "count" FROM "WalletWithdrawalAllocation" a JOIN "WalletCreditLot" c ON c."id"=a."creditLotId" JOIN "WalletReleaseProposal" p ON p."id"=c."proposalId" WHERE a."withdrawalId"=${w.id} AND (p."status"<>'EXECUTED' OR p."approvedById" IS NULL OR c."employeeId"<>${w.employeeId})`;
    return {decision:s.count===0?'APPROVE':'REJECT'};
  });
}
