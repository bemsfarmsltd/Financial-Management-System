import { NextRequest,NextResponse } from 'next/server';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {checkRateLimit} from '@/lib/rate-limiter';
import {stageAction} from '@/lib/staged-actions';
import {WalletError,minorUnits,requireWallet,walletJson} from '@/lib/wallet/core';
import {stageWalletRelease} from '@/lib/wallet/releases';
export const dynamic='force-dynamic';
async function handle(request:NextRequest,write:boolean){try{
 const {actor,errorResponse}=await authenticateAiToolRequest(request,{scope:'wallet',mode:write?'write':'read'});if(errorResponse)return errorResponse;if(!actor)return NextResponse.json({error:'Authentication required.'},{status:401});requireWallet();
 const limit=await checkRateLimit('wallet-ai:'+actor.id+':'+write,{windowMs:60000,maxAttempts:write?20:60});if(!limit.allowed)return NextResponse.json({error:'Wallet tool rate limit reached.'},{status:429});
 const scope=await resolveAuthorizedOrganizationScope(actor as any,actor.scopedOrganizationId||'ALL');
 if(write){if(!actor.isExecutive)return NextResponse.json({error:'AI can stage releases only for an authorized executive.'},{status:403});const b=await request.json();
 if(['ALLOCATE_BUDGET','ADJUST_BUDGET'].includes(b.action)){
   let organizationId=String(b.organizationId||''),existing:any=null;
   if(b.action==='ADJUST_BUDGET'){[existing]=await prisma.$queryRaw<any[]>`SELECT * FROM "WalletBudgetEnvelope" WHERE "id"=${String(b.envelopeId||'')}`;if(!existing)throw new WalletError('NOT_FOUND','Funded budget was not found.',404);organizationId=existing.organizationId;}
   if(!scope.organizationIds.includes(organizationId))throw new WalletError('WORKSPACE_FORBIDDEN','Budget is outside the signed workspace.',403);
   for(const target of [b.parentId,b.targetEnvelopeId].filter(Boolean)){
     const [row]=await prisma.$queryRaw<any[]>`SELECT "organizationId" FROM "WalletBudgetEnvelope" WHERE "id"=${String(target)}`;
     if(!row||!scope.organizationIds.includes(row.organizationId))throw new WalletError('WORKSPACE_FORBIDDEN','Related budget is outside the signed workspace.',403);
   }
   const amount=b.operation==='CLOSE'?existing.remainingMinor:minorUnits(b.amountMinor);
   const material={wallet_operation:b.action==='ALLOCATE_BUDGET'?'ALLOCATE':'ADJUST',mode:b.action==='ALLOCATE_BUDGET'?'create':'update',organization_id:organizationId,label:String(b.label||''),amountMinor:amount.toString(),parentId:b.parentId||undefined,budget_id:existing?.id,operation:b.operation,targetEnvelopeId:b.targetEnvelopeId,expectedVersion:existing?.version};
   const proposal=await stageAction({userId:actor.id,actorContext:actor,actionType:'budget',targetSubsidiaryId:organizationId,conversationId:actor.conversationId||undefined,summary:`Funded budget ${b.action==='ALLOCATE_BUDGET'?'allocation':b.operation}: NGN ${(amount/BigInt(100)).toString()}.${(amount%BigInt(100)).toString().padStart(2,'0')}`,materialPayload:material,preview:{...material,amountExactNaira:(amount/BigInt(100)).toString()+'.'+(amount%BigInt(100)).toString().padStart(2,'0'),notice:'Funded budget movement only; no staff disbursement is approved.'}});
   return NextResponse.json({ok:true,staged_action:proposal,actionCard:{...proposal,type:'wallet_budget'},message:'Exact funded-budget proposal prepared for secure human confirmation.'});
 }
 const preview=await stageWalletRelease(actor,{sourceType:b.sourceType,sourceId:b.sourceId,envelopeId:b.envelopeId,envelopesByOrganization:b.envelopesByOrganization},{allowedOrganizationIds:scope.organizationIds,conversationId:actor.conversationId||null,workspaceId:actor.scopedOrganizationId||null});return NextResponse.json({ok:true,actionCard:{type:'wallet_release',id:preview.id,confirmationHash:preview.confirmationHash,preview},message:'Preview prepared. Only an authorized financial approver can approve through the secure human confirmation card.'});}
 const ids=scope.organizationIds;
 if(!ids.length)return NextResponse.json({ok:true,credits:[],envelopes:[]});
 const envelopes=actor.isExecutive?await prisma.$queryRaw`SELECT "id","organizationId","label","remainingMinor","status","version" FROM "WalletBudgetEnvelope" WHERE "organizationId" IN (${Prisma.join(ids)}) ORDER BY "createdAt" DESC LIMIT 100`:[];
 const credits=await prisma.$queryRaw`SELECT "id","sourceType","sourceId","employeeId","organizationId","category","availableMinor","heldMinor","settledMinor" FROM "WalletCreditLot" WHERE "organizationId" IN (${Prisma.join(ids)}) ${actor.isExecutive?Prisma.empty:Prisma.sql`AND "employeeId"=${actor.id}`} ORDER BY "createdAt" DESC LIMIT 100`;
 return NextResponse.json(walletJson({ok:true,currency:'NGN',scope:ids,envelopes,credits,notice:'AI cannot approve a release, withdraw funds or collect passwords/OTP codes.'}));
 }catch(e){return NextResponse.json({error:e instanceof WalletError?e.message:'Wallet tool failed.',code:e instanceof WalletError?e.code:'WALLET_TOOL_FAILED'},{status:e instanceof WalletError?e.status:500});}}
export async function GET(r:NextRequest){return handle(r,false);}
export async function POST(r:NextRequest){return handle(r,true);}
