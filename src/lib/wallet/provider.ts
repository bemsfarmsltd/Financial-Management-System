import {requireCommitments} from './core';
import {WalletError} from './errors';
import { providerAmountMinor } from './monnify-balance';
export type TransferIntent={reference:string;amountMinor:bigint;sourceAccount:string;bankCode:string;accountNumber:string;accountName:string;environment:string};
export type TransferEvidence={reference:string;amountMinor:bigint;currency:string;bankCode:string;accountNumber:string;status:string;feeMinor:bigint;providerReference:string|null};
function configuration() {
  const environment=process.env.MONNIFY_ENVIRONMENT || process.env.MONNIFY_ENV || 'live';
  if(!['sandbox','live'].includes(environment||'')||!process.env.MONNIFY_API_KEY||!process.env.MONNIFY_SECRET_KEY)throw new WalletError('PROVIDER_NOT_CONFIGURED','Monnify credentials and environment are required.',503);
  return {environment,base:environment==='sandbox'?'https://sandbox.monnify.com':'https://api.monnify.com'};
}
export class MonnifySubmissionRejected extends WalletError {constructor(public providerCode:string){super('PROVIDER_SUBMISSION_REJECTED','Monnify definitively rejected this transfer before processing.',409);}}
async function request(path:string,init:RequestInit={},token?:string) {
  const {base}=configuration();
  const response=await fetch(base+path,{...init,cache:'no-store',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...init.headers},signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(path==='/api/v2/disbursements/single'&&data?.requestSuccessful===false&&['D03','D04','D06'].includes(String(data.responseCode)))throw new MonnifySubmissionRejected(String(data.responseCode));
  if(!response.ok)throw new WalletError('PROVIDER_UNAVAILABLE','Provider outcome could not be verified. Funds remain protected.',503);
  if(data?.requestSuccessful!==true||!data.responseBody)throw new WalletError('PROVIDER_UNAVAILABLE','Provider outcome could not be verified. Funds remain protected.',503);
  return data.responseBody;
}
async function token() {
  const data=await request('/api/v1/auth/login',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.MONNIFY_API_KEY+':'+process.env.MONNIFY_SECRET_KEY).toString('base64')}});
  if(typeof data.accessToken!=='string'||!data.accessToken)throw new WalletError('PROVIDER_UNAVAILABLE','Provider authentication failed.',503);
  return data.accessToken as string;
}
export function exactTransferBody(intent:TransferIntent) {
  const decimal=(intent.amountMinor/BigInt(100)).toString()+'.'+(intent.amountMinor%BigInt(100)).toString().padStart(2,'0');
  return JSON.stringify({amount:'EXACT_AMOUNT',reference:intent.reference,narration:'BEMS approved staff withdrawal',destinationBankCode:intent.bankCode,destinationAccountNumber:intent.accountNumber,destinationAccountName:intent.accountName,currency:'NGN',sourceAccountNumber:intent.sourceAccount,async:true}).replace('"amount":"EXACT_AMOUNT"','"amount":'+decimal);
}
export async function submitMonnifyTransfer(intent:TransferIntent) {
  requireCommitments();
  if(process.env.BEMS_WALLET_TRANSFERS_ENABLED==='false')throw new WalletError('WITHDRAWALS_NOT_ACTIVATED','Transfers are not enabled.',503);
  const curEnv = process.env.MONNIFY_ENVIRONMENT || process.env.MONNIFY_ENV || 'live';
  const curSource = process.env.MONNIFY_SOURCE_ACCOUNT || process.env.MONNIFY_WALLET_ACCOUNT_NUMBER || '';
  if(intent.environment!==curEnv||(curSource && intent.sourceAccount!==curSource))throw new WalletError('PROVIDER_SOURCE_MISMATCH','Transfer source does not match the current environment.',409);
  return request('/api/v2/disbursements/single',{method:'POST',body:exactTransferBody(intent)},await token());
}
export async function queryMonnifyTransfer(reference:string):Promise<TransferEvidence> {
  const d=await request('/api/v2/disbursements/single/summary?reference='+encodeURIComponent(reference),{},await token());
  if(typeof d.reference!=='string'||typeof d.destinationBankCode!=='string'||typeof d.destinationAccountNumber!=='string'||typeof d.currency!=='string'||typeof d.status!=='string')throw new WalletError('INVALID_PROVIDER_RESULT','Incomplete provider transfer evidence.',502);
  if(d.fee==null&&d.totalFee==null)throw new WalletError('INVALID_PROVIDER_RESULT','Provider fee evidence is missing; the transfer remains under reconciliation.',502);
  return {reference:d.reference,amountMinor:providerAmountMinor(d.amount),currency:d.currency,bankCode:d.destinationBankCode,accountNumber:d.destinationAccountNumber,status:d.status,feeMinor:providerAmountMinor(d.fee??d.totalFee),providerReference:typeof d.transactionReference==='string'?d.transactionReference:null};
}
export async function verifyMonnifyDestination(accountNumber:string,bankCode:string) {
  if(!/^\d{10}$/.test(accountNumber)||!/^\d{3,6}$/.test(bankCode))throw new WalletError('INVALID_BANK','Choose a supported bank code and ten-digit account number.');
  const d=await request('/api/v2/disbursements/account/validate?accountNumber='+accountNumber+'&bankCode='+bankCode,{},await token());
  if(d.accountNumber!==accountNumber||typeof d.accountName!=='string'||!d.accountName.trim())throw new WalletError('BANK_VERIFICATION_FAILED','Monnify did not confirm this account.',409);
  return {accountNumber,bankCode,accountName:d.accountName.trim()};
}
export async function listMonnifyTransfers(page=0) {
  const d=await request('/api/v2/disbursements/single/transactions?pageNo='+page+'&pageSize=100',{},await token());
  if(!Array.isArray(d.content))throw new WalletError('INVALID_PROVIDER_RESULT','Provider transfer list cannot be reconciled.',502);
  return {transfers:d.content as any[],last:d.last===true};
}

export async function listMonnifyBanks(){const d=await request('/api/v1/banks',{},await token());if(!Array.isArray(d))throw new WalletError('INVALID_PROVIDER_RESULT','Supported bank list is unavailable.',502);return d.filter((b:any)=>typeof b.code==='string'&&typeof b.name==='string').map((b:any)=>({code:b.code,name:b.name}));}
