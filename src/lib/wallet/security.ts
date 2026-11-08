import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyPassword,hashToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { WalletActor, WalletError, hash, liveWalletActor, minorUnits, requireWallet } from './core';
export type SecurityProof = { id: string; token: string; sessionHash: string };
export async function sessionBinding(request:Request,actorId:string){
 const bearer=request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
 const rawCookie=request.headers.get('cookie')?.match(/(?:^|;\s*)bems_session=([^;]+)/)?.[1];
 const cookie=rawCookie?decodeURIComponent(rawCookie):null;
 for(const candidate of [bearer,cookie].filter(Boolean) as string[]){
  const session=await prisma.authSession.findUnique({where:{tokenHash:hashToken(candidate)},select:{employeeId:true,expiresAt:true}});
  if(session?.employeeId===actorId&&session.expiresAt>new Date())return hash('wallet-session:'+hashToken(candidate));
 }
 throw new WalletError('HUMAN_SESSION_REQUIRED','A current authenticated session is required for transaction confirmation.',401);
}
export function challengePayload(purpose: string, input: any) {
  if (purpose === 'RELEASE') {
    if (typeof input?.id !== 'string' || !/^[a-f0-9]{64}$/.test(input?.confirmationHash)) throw new WalletError('INVALID_CHALLENGE','An exact stored release is required.');
    return { id: input.id, confirmationHash: input.confirmationHash };
  }
  if (purpose === 'POOL_CONTROL') {
    if(input?.operation==='ACKNOWLEDGE_ISSUE'){if(typeof input.issueId!=='string'||typeof input.note!=='string'||input.note.trim().length<10||input.note.length>1000)throw new WalletError('INVALID_CHALLENGE','Identify the issue and explain its verified correction.');return {operation:input.operation,issueId:input.issueId,note:input.note.trim()};}
    if (!['PAUSE','ACTIVATE'].includes(input?.operation)) throw new WalletError('INVALID_CHALLENGE','Choose a funding control operation.');
    return { operation: input.operation };
  }
  if(purpose==='RETURN_PROJECT'){if(typeof input?.creditLotId!=='string'||typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>1000||typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<8||input.idempotencyKey.length>128)throw new WalletError('INVALID_RETURN','Select unused project funds and explain the return.');return {creditLotId:input.creditLotId,amountMinor:minorUnits(input.amountMinor).toString(),reason:input.reason.trim(),idempotencyKey:input.idempotencyKey};}
  if (purpose !== 'WITHDRAWAL') throw new WalletError('INVALID_CHALLENGE','Unsupported transaction purpose.');
  const amountMinor = minorUnits(input?.amountMinor).toString();
  if (typeof input.bankAccountId !== 'string' || typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 128 || !Array.isArray(input.creditAllocations) || !input.creditAllocations.length || input.creditAllocations.length > 1000) throw new WalletError('INVALID_WITHDRAWAL','Select approved credit lots and a verified account.');
  const allocations = input.creditAllocations.map((a: any) => {
    if (typeof a?.creditLotId !== 'string') throw new WalletError('INVALID_WITHDRAWAL','A credit lot is required.');
    return { creditLotId: a.creditLotId, amountMinor: minorUnits(a.amountMinor).toString() };
  }).sort((a: any,b: any) => a.creditLotId.localeCompare(b.creditLotId));
  if (new Set(allocations.map((a: any) => a.creditLotId)).size !== allocations.length || allocations.reduce((n:bigint,a:any)=>n+BigInt(a.amountMinor),BigInt(0)) !== BigInt(amountMinor)) throw new WalletError('INVALID_WITHDRAWAL','Credit allocations must equal the withdrawal amount without duplicate lots.');
  return { amountMinor, bankAccountId: input.bankAccountId, idempotencyKey: input.idempotencyKey, creditAllocations: allocations };
}
export async function verifyWalletPassword(actor: WalletActor, password: unknown, gmdOnly = false) {
  requireWallet();
  const rate = await checkRateLimit('wallet-password:'+actor.id,{windowMs:60000,maxAttempts:5});
  if (!rate.allowed) throw new WalletError('RATE_LIMITED','Too many security attempts. Try again shortly.',429);
  const employee = await prisma.$transaction(tx=>liveWalletActor(tx,actor,gmdOnly));
  if (typeof password !== 'string' || password.length > 256 || !await verifyPassword(password,employee.passwordHash)) throw new WalletError('PASSWORD_REQUIRED','Your current account password is required to confirm this transaction.',403);
  return hash(employee.passwordHash);
}
export async function issueWalletChallenge(actor: WalletActor, input: {purpose:string;payload:unknown;password:unknown;sessionHash:string}) {
  const payload = challengePayload(input.purpose,input.payload);
  const credentialHash = await verifyWalletPassword(actor,input.password,input.purpose === 'RELEASE' || (input.purpose === 'POOL_CONTROL' && (payload as any).operation !== 'PAUSE'));
  if(input.purpose==='POOL_CONTROL'&&!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))throw new WalletError('NOT_PERMITTED','Executive security authority is required.',403);
  const id=randomUUID(),token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+120000);
  await prisma.$executeRaw`INSERT INTO "WalletChallenge" ("id","actorId","purpose","payloadHash","tokenHash","sessionHash","credentialHash","expiresAt") VALUES (${id},${actor.id},${input.purpose},${hash(payload)},${hash(token)},${input.sessionHash},${credentialHash},${expiresAt})`;
  return {id,token,expiresAt};
}
export async function consumeWalletChallenge(tx:Prisma.TransactionClient,actor:WalletActor,purpose:string,payload:unknown,proof?:SecurityProof) {
  if (!proof || typeof proof.token !== 'string') throw new WalletError('TRANSACTION_AUTH_REQUIRED','Confirm this exact transaction using your current password.',403);
  const [challenge]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletChallenge" WHERE "id"=${proof.id} FOR UPDATE`;
  const employee=await liveWalletActor(tx,actor,purpose === 'RELEASE' || (purpose === 'POOL_CONTROL' && (payload as any)?.operation !== 'PAUSE'));
  const tokenHash=hash(proof.token);
  if (!challenge || challenge.actorId!==actor.id || challenge.purpose!==purpose || challenge.usedAt || challenge.expiresAt<=new Date() || challenge.payloadHash!==hash(challengePayload(purpose,payload)) || challenge.sessionHash!==proof.sessionHash || challenge.credentialHash!==hash(employee.passwordHash) || challenge.tokenHash.length!==tokenHash.length || !timingSafeEqual(Buffer.from(tokenHash),Buffer.from(challenge.tokenHash))) throw new WalletError('CHALLENGE_INVALID','The transaction confirmation is invalid, expired or already used.',403);
  await tx.$executeRaw`UPDATE "WalletChallenge" SET "usedAt"=now() WHERE "id"=${proof.id}`;
}
