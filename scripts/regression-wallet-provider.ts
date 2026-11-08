import assert from 'node:assert/strict';
import {exactTransferBody,submitMonnifyTransfer,queryMonnifyTransfer,MonnifySubmissionRejected} from '../src/lib/wallet/provider';
async function main(){
 process.env.BEMS_WALLET_ENABLED='true';process.env.MONNIFY_ENVIRONMENT='sandbox';process.env.BEMS_WALLET_TRANSFERS_ENABLED='true';process.env.MONNIFY_API_KEY='test-key';process.env.MONNIFY_SECRET_KEY='test-secret';process.env.MONNIFY_SOURCE_ACCOUNT='9999999999';
 const intent={reference:'isolated-reference',amountMinor:BigInt('123456789012301'),environment:'sandbox',sourceAccount:'9999999999',bankCode:'058',accountNumber:'1234567890',accountName:'Test Staff'};
 assert.match(exactTransferBody(intent),/"amount":1234567890123\.01/);
 let status='SUCCESS',rejectCode:string|null=null;const original=global.fetch;
 global.fetch=(async(url:any,options:any)=>{
  assert.ok(String(url).startsWith('https://sandbox.monnify.com/'));
  if(String(url).endsWith('/auth/login'))return Response.json({requestSuccessful:true,responseBody:{accessToken:'test-token'}});
  assert.equal(options.headers.Authorization,'Bearer test-token');
  if(String(url).endsWith('/single'))return rejectCode?Response.json({requestSuccessful:false,responseCode:rejectCode}):Response.json({requestSuccessful:true,responseBody:{reference:intent.reference,status:'PENDING_AUTHORIZATION'}});
  return Response.json({requestSuccessful:true,responseBody:{reference:intent.reference,amount:'1234567890123.01',fee:'5.00',currency:'NGN',destinationBankCode:intent.bankCode,destinationAccountNumber:intent.accountNumber,status,transactionReference:'provider-reference'}});
 }) as typeof fetch;
 try{
  const accepted=await submitMonnifyTransfer(intent);assert.equal(accepted.status,'PENDING_AUTHORIZATION');
  const final=await queryMonnifyTransfer(intent.reference);assert.equal(final.amountMinor,intent.amountMinor);assert.equal(final.feeMinor,BigInt(500));
  rejectCode='D03';await assert.rejects(submitMonnifyTransfer(intent),e=>e instanceof MonnifySubmissionRejected&&e.providerCode==='D03');
  rejectCode='D05';await assert.rejects(submitMonnifyTransfer(intent),e=>!(e instanceof MonnifySubmissionRejected));
  console.log('PASS Monnify adapter uses exact decimal request bytes, bearer authentication, authoritative summary evidence and conservative duplicate handling');
 }finally{global.fetch=original;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
