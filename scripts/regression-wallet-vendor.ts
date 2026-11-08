import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/prisma';
import {resetRateLimit} from '../src/lib/rate-limiter';
import {readOwnWallet,fundingState,walletTransaction} from '../src/lib/wallet/core';
import {stageWalletRelease} from '../src/lib/wallet/releases';
import {verifyVendorBank} from '../src/lib/wallet/vendor-bank';
import {processWalletTransfer,WalletTransferProvider} from '../src/lib/wallet/worker';
export async function runVendorRegressions(f:any){
 const {gmd,staff,org,envelope,secureApprove,password}=f;
 const vendor=await prisma.vendor.create({data:{name:'Verified Vendor Limited',accountName:'Verified Vendor Limited',bankName:'Test Bank',code:'V-'+randomUUID(),category:'GENERAL'}});
 const request=await prisma.expenditureRequest.create({data:{requestNumber:'VENDOR-'+randomUUID(),groupId:org.id,subsidiaryId:org.id,requestedById:staff.id,vendorId:vendor.id,amountMinor:BigInt(20000),title:'Verified vendor delivery',justification:'Direct vendor payment regression',deliverable:'Supplier invoice and accepted delivery',neededBy:new Date(),category:'PROCUREMENT'}});
 await prisma.vendorInvoice.create({data:{vendorId:vendor.id,requestId:request.id,invoiceNumber:'INV-'+randomUUID(),amountMinor:request.amountMinor}});
 await prisma.goodsReceiptNote.create({data:{requestId:request.id,grnNumber:'GRN-'+randomUUID(),receivedById:staff.id,status:'ACCEPTED'}});
 const oldFetch=global.fetch;
 global.fetch=(async(url:any)=>String(url).endsWith('/auth/login')?Response.json({requestSuccessful:true,responseBody:{accessToken:'vendor-test-token'}}):Response.json({requestSuccessful:true,responseBody:{accountNumber:new URL(String(url)).searchParams.get('accountNumber'),accountName:vendor.accountName}})) as typeof fetch;
 let proposal;
 try{await resetRateLimit('wallet-password:'+gmd.id);await verifyVendorBank(gmd,vendor.id,{accountNumber:'1111111111',bankCode:'058',password});proposal=await stageWalletRelease(gmd,{sourceType:'REQUEST',sourceId:request.id,envelopeId:envelope.id});}finally{global.fetch=oldFetch;}
 const before=(await readOwnWallet(staff)).availableMinor;
 await secureApprove(proposal);
 assert.equal((await readOwnWallet(staff)).availableMinor,before,'Vendor approval must not credit the staff requester.');
 const[w]=await prisma.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawal" WHERE "requestId"=${request.id}`;
 assert.equal(w.targetType,'VENDOR');assert.equal(w.accountNumber,'1111111111');assert.equal(w.bankAccountId,null);
 const state=await walletTransaction(tx=>fundingState(tx));assert.ok(state.liabilityMinor>=BigInt(before)+request.amountMinor);
 let submitted:any;
 const provider:WalletTransferProvider={submit:async i=>{submitted=i;return {status:'PENDING'};},query:async()=>({reference:submitted.reference,amountMinor:submitted.amountMinor,currency:'NGN',bankCode:submitted.bankCode,accountNumber:submitted.accountNumber,status:'SUCCESS',feeMinor:BigInt(300),providerReference:'vendor-provider-reference'})};
 await processWalletTransfer(provider);await processWalletTransfer(provider);
 assert.equal((await prisma.expenditureRequest.findUniqueOrThrow({where:{id:request.id}})).paymentStatus,'MONNIFY_SUCCEEDED');
 assert.equal((await readOwnWallet(staff)).availableMinor,before);
 const[settledEnvelope]=await prisma.$queryRaw<any[]>`SELECT "remainingMinor" FROM "WalletBudgetEnvelope" WHERE "id"=${envelope.id}`;
 await prisma.$executeRaw`UPDATE "WalletWithdrawal" SET "nextAttemptAt"=now() WHERE "id"=${w.id}`;
 await processWalletTransfer({...provider,query:async()=>({reference:w.reference,amountMinor:w.amountMinor,currency:'NGN',bankCode:w.bankCode,accountNumber:w.accountNumber,status:'REVERSED',feeMinor:BigInt(300),providerReference:'vendor-provider-reference'})});
 assert.equal((await prisma.expenditureRequest.findUniqueOrThrow({where:{id:request.id}})).paymentStatus,'MONNIFY_REVERSED');
 const[reversedEnvelope]=await prisma.$queryRaw<any[]>`SELECT "remainingMinor" FROM "WalletBudgetEnvelope" WHERE "id"=${envelope.id}`;
 assert.equal(reversedEnvelope.remainingMinor,settledEnvelope.remainingMinor+request.amountMinor,'Vendor reversal restores only the original principal envelope.');
 global.fetch=(async(url:any)=>String(url).endsWith('/auth/login')?Response.json({requestSuccessful:true,responseBody:{accessToken:'vendor-test-token'}}):Response.json({requestSuccessful:true,responseBody:{accountNumber:new URL(String(url)).searchParams.get('accountNumber'),accountName:vendor.accountName}})) as typeof fetch;
 let retry;
 try{retry=await stageWalletRelease(gmd,{sourceType:'REQUEST',sourceId:request.id,envelopeId:envelope.id});}finally{global.fetch=oldFetch;}
 await assert.rejects(secureApprove(retry),{code:'BALANCE_STALE'},'Reversal invalidates cached funding before a new approval.');
 // The provider is mocked; record a fresh isolated fixture observation before retry.
 await prisma.$executeRaw`UPDATE "WalletFundingPool" SET "observedAt"=now() WHERE "id"='MONNIFY_NGN'`;
 await resetRateLimit('wallet-password:'+gmd.id);await secureApprove(retry);
 const[retryIntent]=await prisma.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawal" WHERE "requestId"=${request.id} AND "id"<>${w.id}`;
 assert.ok(retryIntent);assert.notEqual(retryIntent.reference,w.reference,'A retry needs a new GMD-approved durable intent.');
 const failed:WalletTransferProvider={submit:async()=>({status:'PENDING'}),query:async()=>({reference:retryIntent.reference,amountMinor:retryIntent.amountMinor,currency:'NGN',bankCode:retryIntent.bankCode,accountNumber:retryIntent.accountNumber,status:'FAILED',feeMinor:BigInt(0),providerReference:'vendor-failed-reference'})};
 await processWalletTransfer(failed);await processWalletTransfer(failed);
 assert.equal((await prisma.expenditureRequest.findUniqueOrThrow({where:{id:request.id}})).paymentStatus,'MONNIFY_FAILED');
 const[failedEnvelope]=await prisma.$queryRaw<any[]>`SELECT "remainingMinor" FROM "WalletBudgetEnvelope" WHERE "id"=${envelope.id}`;
 assert.equal(failedEnvelope.remainingMinor,reversedEnvelope.remainingMinor);
 assert.equal((await readOwnWallet(staff)).availableMinor,before);
 console.log('PASS vendor reversal restores the envelope, fresh GMD approval permits retry, and confirmed retry failure restores principal without staff credit');
 console.log('PASS GMD vendor approval reserves funds and pays only the verified supplier account, with no staff wallet credit');
}
