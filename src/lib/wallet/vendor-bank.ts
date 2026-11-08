import {prisma} from '@/lib/prisma';
import {WalletActor,WalletError,hash,liveWalletActor,walletTransaction} from './core';
import {verifyWalletPassword} from './security';
import {verifyMonnifyDestination} from './provider';
export function sameBankIdentity(a:string,b:string){const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');return normalize(a)===normalize(b);}
export async function verifyVendorBank(actor:WalletActor,vendorId:string,input:{accountNumber:string;bankCode:string;password:unknown}){
 await verifyWalletPassword(actor,input.password);
 if(!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))throw new WalletError('NOT_PERMITTED','Executive registry authority is required.',403);
 const vendor=await prisma.vendor.findUnique({where:{id:vendorId}});if(!vendor)throw new WalletError('NOT_FOUND','Vendor not found.',404);
 const bank=await verifyMonnifyDestination(String(input.accountNumber),String(input.bankCode));
 if(!sameBankIdentity(bank.accountName,vendor.accountName||vendor.name))throw new WalletError('ACCOUNT_NAME_MISMATCH','Provider bank name does not match the verified vendor account identity.',409);
 return walletTransaction(async tx=>{await liveWalletActor(tx,actor);const current=await tx.vendor.findUniqueOrThrow({where:{id:vendorId}});if(!sameBankIdentity(bank.accountName,current.accountName||current.name))throw new WalletError('VENDOR_CHANGED','Vendor identity changed during verification.',409);
 await tx.$executeRaw`UPDATE "Vendor" SET "accountNumber"=${bank.accountNumber},"accountName"=${bank.accountName},"bankCode"=${bank.bankCode},"bankFingerprint"=${hash(bank)},"verifiedBankAt"=now() WHERE "id"=${vendorId}`;
 return {id:vendorId,lastFour:bank.accountNumber.slice(-4),bankCode:bank.bankCode,accountName:bank.accountName,verified:true};});
}
export async function verifiedVendorDestination(vendorId:string){
 const[v]=await prisma.$queryRaw<any[]>`SELECT * FROM "Vendor" WHERE "id"=${vendorId}`;
 if(!v?.verifiedBankAt||!v.bankCode||!v.accountNumber||v.bankFingerprint!==hash({accountNumber:v.accountNumber,bankCode:v.bankCode,accountName:v.accountName}))throw new WalletError('VENDOR_BANK_VERIFICATION_REQUIRED','Verify the vendor bank account in the funding dashboard before preparing payment.',409);
 const bank=await verifyMonnifyDestination(v.accountNumber,v.bankCode);
 if(!sameBankIdentity(bank.accountName,v.accountName))throw new WalletError('VENDOR_BANK_CHANGED','Provider vendor identity no longer matches its registered account.',409);
 return bank;
}
