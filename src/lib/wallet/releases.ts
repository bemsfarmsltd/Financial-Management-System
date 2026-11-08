import {requiredFeeReserve} from './fees';
import {prisma} from '@/lib/prisma';
import {verifiedVendorDestination} from './vendor-bank';
import {computeThreeWayMatchFromLoadedRequest} from '@/lib/services/three-way-match';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { WalletActor, WalletError, fundingState, hash, journal, liveWalletActor, requireCommitments, walletJson, walletTransaction } from './core';
import { consumeWalletChallenge, SecurityProof } from './security';
import { accountabilityDeadline } from '@/lib/services/accountability-deadline';
type Item={sourceType:string;sourceId:string;employeeId:string|null;vendorId?:string;bankSnapshot?:any;organizationId:string;amountMinor:bigint;category:string;employeeName:string;employeeNumber:string;title:string;sourceKey:string};
type Input={sourceType:string;sourceId:string;envelopeId?:string;envelopesByOrganization?:Record<string,string>};
type Context={allowedOrganizationIds?:string[];conversationId?:string|null;workspaceId?:string|null};
async function sourceItems(tx:Prisma.TransactionClient,type:string,id:string):Promise<{items:Item[];sourceHash:string}> {
  if (type==='REQUEST') {
    const source=await tx.expenditureRequest.findUnique({where:{id},include:{requester:true,vendor:true,invoices:{orderBy:{createdAt:'desc'}},goodsReceipts:{orderBy:{receivedAt:'desc'}},disbursements:{select:{id:true}}}});
    if (!source || !['SUBMITTED','IN_REVIEW','APPROVED'].includes(source.approvalStatus) || !['UNPAID','MONNIFY_FAILED','MONNIFY_REVERSED'].includes(source.paymentStatus) || source.disbursements.length) throw new WalletError('SOURCE_NOT_ELIGIBLE','Select an unpaid staff request. Vendor payments cannot be diverted into staff wallets.');
    if (source.currency!=='NGN' || source.amountMinor<=BigInt(0)) throw new WalletError('CURRENCY_NOT_SUPPORTED','A positive NGN source is required.');
    if(source.vendorId){
      if(!computeThreeWayMatchFromLoadedRequest(source).summary.canDisburse)throw new WalletError('MATCH_REQUIRED','Vendor invoice and goods receipt must pass three-way matching.');
      const[v]=await tx.$queryRaw<any[]>`SELECT * FROM "Vendor" WHERE "id"=${source.vendorId}`;
      if(!v?.verifiedBankAt||!v.bankCode||!v.accountNumber)throw new WalletError('VENDOR_BANK_VERIFICATION_REQUIRED','Verify the vendor bank before staging payment.');
      const bankSnapshot={accountNumber:v.accountNumber,bankCode:v.bankCode,accountName:v.accountName};
      if(v.bankFingerprint!==hash(bankSnapshot))throw new WalletError('VENDOR_BANK_CHANGED','Reverify the changed vendor destination.');
      return {sourceHash:hash({source,vendorBank:bankSnapshot}),items:[{sourceType:'REQUEST',sourceId:id,sourceKey:'REQUEST:'+id,employeeId:null,vendorId:source.vendorId,bankSnapshot,organizationId:source.subsidiaryId,amountMinor:source.amountMinor,category:'VENDOR',employeeName:v.name,employeeNumber:'Vendor',title:source.title}]};
    }
    const category=source.requestType==='REIMBURSEMENT'?'REIMBURSEMENT':/ALLOWANCE/.test(source.category)?'ALLOWANCE':source.requestType==='ADVANCE'?'PROJECT':'REQUEST';
    return {sourceHash:hash({...source,requester:{id:source.requester.id,role:source.requester.role,status:source.requester.status,approvalStatus:source.requester.approvalStatus,legalName:source.requester.legalName,workEmail:source.requester.workEmail,employeeNumber:source.requester.employeeNumber}}),items:[{sourceType:'REQUEST',sourceId:id,sourceKey:'REQUEST:'+id,employeeId:source.requestedById,organizationId:source.subsidiaryId,amountMinor:source.amountMinor,category,employeeName:source.requester.legalName,employeeNumber:source.requester.employeeNumber,title:source.title}]};
  }
  if (type!=='PAYROLL_BATCH') throw new WalletError('SOURCE_NOT_SUPPORTED','Choose a staff request or a whole payroll batch.');
  const batch=await tx.payrollBatch.findUnique({where:{id},include:{period:true,items:{include:{employee:true,disbursement:true,allocations:true},orderBy:{id:'asc'}}}});
  if (!batch || !['SUBMITTED','APPROVED'].includes(batch.status) || !batch.items.length || batch.bulkFundedAt || (batch.bulkFundedAmountMinor && batch.bulkFundedAmountMinor>BigInt(0))) throw new WalletError('SOURCE_NOT_ELIGIBLE','Choose an unpaid submitted payroll batch without legacy clearing-account funding.');
  if(new Set(batch.items.map(i=>i.employeeId)).size!==batch.items.length)throw new WalletError('DUPLICATE_PAYROLL_EMPLOYEE','A batch must contain one net-pay item per employee.');
  if(batch.items.reduce((n,i)=>n+i.grossMinor,BigInt(0))!==batch.totalGrossMinor)throw new WalletError('PAYROLL_TOTAL_MISMATCH','Gross payroll total does not reconcile.');
  const items:Item[]=[];
  let net=BigInt(0);
  for (const item of batch.items) {
    if (item.currency!=='NGN' || item.netMinor<=BigInt(0) || item.employeeDeductionsMinor<BigInt(0) || item.employerCostMinor<BigInt(0) || item.grossMinor-item.employeeDeductionsMinor!==item.netMinor || item.disbursement || item.status==='WALLET_CREDITED') throw new WalletError('SOURCE_NOT_ELIGIBLE','Every payroll item must be an unpaid positive NGN net salary.');
    net+=item.netMinor;
    const allocations=[...item.allocations].sort((a,b)=>a.subsidiaryId.localeCompare(b.subsidiaryId));
    const weight=allocations.reduce((n,a)=>n+a.allocableCostMinor,BigInt(0));
    if (!allocations.length || allocations.some(a=>a.allocableCostMinor<=BigInt(0)||!Number.isFinite(a.percentage)||a.percentage<0||a.percentage>100) || weight!==item.grossMinor || weight<=BigInt(0)) throw new WalletError('INVALID_PAYROLL_ALLOCATIONS','Payroll allocation weights must reconcile to gross pay.');
    let assigned=BigInt(0);
    for(let i=0;i<allocations.length;i++) {
      const a=allocations[i]; const amount=i===allocations.length-1?item.netMinor-assigned:item.netMinor*a.allocableCostMinor/weight;assigned+=amount;
      if(amount>BigInt(0))items.push({sourceType:'PAYROLL_ITEM',sourceId:item.id,sourceKey:batch.payrollType==='REGULAR'?'SALARY:'+batch.period.year+':'+batch.period.month+':'+item.employeeId:'SUPPLEMENTAL:'+batch.id+':'+item.employeeId,employeeId:item.employeeId,organizationId:a.subsidiaryId,amountMinor:amount,category:'SALARY',employeeName:item.employee.legalName,employeeNumber:item.employee.employeeNumber,title:`Salary ${batch.period.year}-${String(batch.period.month).padStart(2,'0')}`});
    }
  }
  if (net!==batch.totalNetMinor) throw new WalletError('PAYROLL_TOTAL_MISMATCH','Batch net total does not equal its employee items.');
  return {items,sourceHash:hash({...batch,items:batch.items.map(i=>({...i,employee:{id:i.employee.id,role:i.employee.role,status:i.employee.status,approvalStatus:i.employee.approvalStatus,legalName:i.employee.legalName,workEmail:i.employee.workEmail,employeeNumber:i.employee.employeeNumber}}))})};
}
export async function stageWalletRelease(actor:WalletActor,input:Input,context:Context={}) {
  await prisma.$transaction(tx=>liveWalletActor(tx,actor));
  if(!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))throw new WalletError('NOT_PERMITTED','Executive preparation authority is required.',403);
  if(input.sourceType==='REQUEST'){
    const request=await prisma.expenditureRequest.findUnique({where:{id:input.sourceId},select:{vendorId:true,subsidiaryId:true}});
    if(request&&context.allowedOrganizationIds&&!context.allowedOrganizationIds.includes(request.subsidiaryId))throw new WalletError('WORKSPACE_FORBIDDEN','Payment is outside the signed workspace.',403);
    if(request?.vendorId)await verifiedVendorDestination(request.vendorId);
  }
  return walletTransaction(async tx=>{
    await liveWalletActor(tx,actor);
    if(!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))throw new WalletError('NOT_PERMITTED','Executive preparation authority is required.',403);
    const source=await sourceItems(tx,input.sourceType,input.sourceId),id=randomUUID(),expiresAt=new Date(Date.now()+600000);
    const items=[];
    for(const item of source.items) {
      if(context.allowedOrganizationIds && !context.allowedOrganizationIds.includes(item.organizationId))throw new WalletError('WORKSPACE_FORBIDDEN','The payment is outside the signed workspace.',403);
      const employee=item.employeeId?await tx.employee.findUnique({where:{id:item.employeeId}}):null;
      if(!item.vendorId&&(!employee || employee.role!=='STAFF'||employee.approvalStatus!=='APPROVED'||!['ACTIVE','ON_LEAVE'].includes(employee.status)))throw new WalletError('INVALID_BENEFICIARY','All recipients must be approved staff with portal access.');
      const envelopeId=input.envelopesByOrganization?.[item.organizationId]||input.envelopeId;
      const [envelope]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletBudgetEnvelope" WHERE "id"=${envelopeId||''} AND "status"='ACTIVE'`;
      if(!envelope || envelope.organizationId!==item.organizationId)throw new WalletError('BUDGET_SCOPE_MISMATCH','Select one funded budget for each source subsidiary.');
      items.push({...item,id:randomUUID(),envelopeId:envelope.id});
    }
    const amount=items.reduce((n,i)=>n+i.amountMinor,BigInt(0)),confirmationHash=hash({version:2,id,type:input.sourceType,sourceId:input.sourceId,items,sourceHash:source.sourceHash,expiresAt});
    await tx.$executeRaw`INSERT INTO "WalletReleaseProposal" ("id","createdById","sourceType","sourceId","amountMinor","category","sourceHash","confirmationHash","expiresAt","conversationId","workspaceId") VALUES (${id},${actor.id},${input.sourceType},${input.sourceId},${amount},${input.sourceType==='PAYROLL_BATCH'?'SALARY':items[0].category},${source.sourceHash},${confirmationHash},${expiresAt},${context.conversationId||null},${context.workspaceId||null})`;
    for(const i of items)await tx.$executeRaw`INSERT INTO "WalletReleaseItem" ("id","proposalId","sourceType","sourceId","employeeId","organizationId","envelopeId","amountMinor","category","vendorId","bankSnapshot") VALUES (${i.id},${id},${i.sourceType},${i.sourceId},${i.employeeId},${i.organizationId},${i.envelopeId},${i.amountMinor},${i.category},${i.vendorId||null},${i.bankSnapshot?JSON.stringify(i.bankSnapshot):null})`;
    return walletJson({id,confirmationHash,expiresAt,sourceType:input.sourceType,sourceId:input.sourceId,amountMinor:amount,currency:'NGN',items,requiredApprover:'GMD',conversationId:context.conversationId||null,message:'Preview only. GMD must securely confirm this exact release.'});
  });
}
export async function approveWalletRelease(actor:WalletActor,id:string,confirmationHash:string,proof?:SecurityProof) {
  requireCommitments();
  if(actor.role!=='GMD')throw new WalletError('GMD_REQUIRED','Only the designated GMD can release funds.',403);
  await (await import('./monnify-balance')).ensureWalletFundingFresh(actor);
  return walletTransaction(async tx=>{
    await liveWalletActor(tx,actor,true);
    const [p]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletReleaseProposal" WHERE "id"=${id} FOR UPDATE`;
    if(!p)throw new WalletError('NOT_FOUND','Release proposal not found.',404);
    if(!/^[a-f0-9]{64}$/.test(String(confirmationHash))||!timingSafeEqual(Buffer.from(p.confirmationHash),Buffer.from(confirmationHash)))throw new WalletError('HASH_MISMATCH','Approve the exact stored preview.',409);
    if(p.status==='EXECUTED'){const[w]=await tx.$queryRaw<any[]>`SELECT "status","reference" FROM "WalletWithdrawal" WHERE "proposalId"=${p.id} AND "targetType"='VENDOR'`;return {id:p.id,status:w?.status||'WALLET_CREDITED',reference:w?.reference,alreadyExecuted:true};}
    if(p.status!=='PENDING'||p.expiresAt<=new Date())throw new WalletError('PROPOSAL_EXPIRED','Prepare a fresh preview.',409);
    await consumeWalletChallenge(tx,actor,'RELEASE',{id,confirmationHash},proof);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'target:'+p.sourceId},0))`;
    if(p.sourceType==='REQUEST')await tx.$queryRaw`SELECT "id" FROM "ExpenditureRequest" WHERE "id"=${p.sourceId} FOR UPDATE`;
    else {await tx.$queryRaw`SELECT "id" FROM "PayrollBatch" WHERE "id"=${p.sourceId} FOR UPDATE`;await tx.$queryRaw`SELECT "id" FROM "PayrollItem" WHERE "batchId"=${p.sourceId} ORDER BY "id" FOR UPDATE`;}
    const source=await sourceItems(tx,p.sourceType,p.sourceId);
    if(source.sourceHash!==p.sourceHash)throw new WalletError('SOURCE_CHANGED','The source changed. Prepare a fresh preview.',409);
    const items=await tx.$queryRaw<any[]>`SELECT * FROM "WalletReleaseItem" WHERE "proposalId"=${id} ORDER BY "envelopeId","id"`;
    if(!items.length||hash(items.map(i=>[i.sourceType,i.sourceId,i.employeeId,i.organizationId,i.amountMinor]).sort())!==hash(source.items.map(i=>[i.sourceType,i.sourceId,i.employeeId,i.organizationId,i.amountMinor]).sort()))throw new WalletError('SOURCE_CHANGED','The payment allocation changed.',409);
    for(const key of new Set(source.items.map(i=>i.sourceKey))) {
      const [paid]=await tx.$queryRaw<any[]>`SELECT "key" FROM "WalletPaidSource" WHERE "key"=${key}`;
      if(paid){
        const[previous]=await tx.$queryRaw<any[]>`SELECT w."status" FROM "WalletWithdrawal" w JOIN "WalletPaidSource" s ON s."proposalId"=w."proposalId" WHERE s."key"=${key} AND w."targetType"='VENDOR' ORDER BY w."createdAt" DESC LIMIT 1`;
        if(!source.items[0].vendorId||!previous||!['FAILED','REVERSED'].includes(previous.status))throw new WalletError('SOURCE_ALREADY_PAID','This business entitlement was already released.',409);
        await tx.$executeRaw`DELETE FROM "WalletPaidSource" WHERE "key"=${key}`;
      }
      await tx.$executeRaw`INSERT INTO "WalletPaidSource" ("key","proposalId") VALUES (${key},${id})`;
    }
    const currentFunding=await fundingState(tx,true);
    const extraDirectFee=source.items.some(i=>i.vendorId)?BigInt(process.env.BEMS_WALLET_MAX_TRANSFER_FEE_MINOR||'0'):BigInt(0);
    const fees=await requiredFeeReserve(tx,source.items,extraDirectFee);
    if(fees>currentFunding.feeReserveMinor){const increase=fees-currentFunding.feeReserveMinor;if(increase>currentFunding.freeMinor)throw new WalletError('FEE_RESERVE_INSUFFICIENT','Fund company fees as well as staff/vendor principal before approval.',409);await tx.$executeRaw`UPDATE "WalletFundingPool" SET "feeReserveMinor"=${fees} WHERE "id"='MONNIFY_NGN'`;}
    await tx.$executeRaw`UPDATE "WalletReleaseProposal" SET "status"='EXECUTED',"approvedById"=${actor.id},"approvedAt"=now() WHERE "id"=${id}`;
    for(const i of items) {
      const count=await tx.$executeRaw`UPDATE "WalletBudgetEnvelope" SET "remainingMinor"="remainingMinor"-${i.amountMinor},"version"="version"+1 WHERE "id"=${i.envelopeId} AND "organizationId"=${i.organizationId} AND "status"='ACTIVE' AND "remainingMinor">=${i.amountMinor}`;
      if(count!==1)throw new WalletError('BUDGET_EXCEEDED','A funded subsidiary budget cannot cover this release.',409);
      if(i.vendorId){
        if(process.env.BEMS_WALLET_TRANSFERS_ENABLED!=='true')throw new WalletError('WITHDRAWALS_NOT_ACTIVATED','Vendor transfers are not enabled for this environment.',503);
        const bank=JSON.parse(i.bankSnapshot);const withdrawalId=randomUUID();const fee=BigInt(process.env.BEMS_WALLET_MAX_TRANSFER_FEE_MINOR||'0');
        const[reserved]=await tx.$queryRaw<any[]>`SELECT COALESCE(sum("feeLimitMinor"),0)::bigint AS "amount" FROM "WalletWithdrawal" WHERE "status" IN ('HELD','SUBMITTING','PENDING','UNKNOWN')`;
        const state=await fundingState(tx,true);
        if(fee<=BigInt(0)||state.feeReserveMinor<reserved.amount+fee)throw new WalletError('FEE_RESERVE_INSUFFICIENT','Company transfer fee funding is required.',409);
        await tx.$executeRaw`INSERT INTO "WalletWithdrawal" ("id","employeeId","targetType","vendorId","requestId","proposalId","amountMinor","feeLimitMinor","reference","idempotencyKey","intentHash","environment","sourceAccount","bankCode","accountNumber","accountName") VALUES (${withdrawalId},${actor.id},'VENDOR',${i.vendorId},${i.sourceId},${id},${i.amountMinor},${fee},${'BEMS-V-'+withdrawalId},${'vendor:'+id},${hash({id,bank,amount:i.amountMinor})},${process.env.MONNIFY_ENVIRONMENT!},${process.env.MONNIFY_SOURCE_ACCOUNT!},${bank.bankCode},${bank.accountNumber},${bank.accountName})`;
        await journal(tx,actor.id,'VENDOR_PAYMENT_HELD',i.id,'ENVELOPE:'+i.envelopeId,'VENDOR_HELD:'+withdrawalId,i.amountMinor);
        const org=await tx.organization.findUniqueOrThrow({where:{id:i.organizationId}});
        await tx.auditEvent.create({data:{actorId:actor.id,actorName:actor.legalName,actorRole:'GMD',groupId:org.parentGroupId||org.id,subsidiaryId:org.id,targetType:'VENDOR_PAYMENT',targetId:withdrawalId,action:'GMD_VENDOR_PAYMENT_APPROVED',correlationId:id,metadata:JSON.stringify({vendorId:i.vendorId,requestId:i.sourceId,amountMinor:i.amountMinor.toString(),bankLastFour:bank.accountNumber.slice(-4),confirmationHash})}});
        await tx.systemNotification.create({data:{employeeId:actor.id,kind:'VENDOR_PAYMENT_QUEUED',title:'Vendor payment approved and queued',body:'The exact verified supplier transfer was reserved. Its bank outcome will be reconciled separately.',linkUrl:'/wallet/funding'}});
        continue;
      }
      const creditId=randomUUID();
      await tx.$executeRaw`INSERT INTO "WalletCreditLot" ("id","proposalId","releaseItemId","sourceType","sourceId","employeeId","organizationId","category","amountMinor","availableMinor","requestId","payrollItemId") VALUES (${creditId},${id},${i.id},${i.sourceType},${i.sourceId},${i.employeeId},${i.organizationId},${i.category},${i.amountMinor},${i.amountMinor},${i.sourceType==='REQUEST'?i.sourceId:null},${i.sourceType==='PAYROLL_ITEM'?i.sourceId:null})`;
      await journal(tx,actor.id,'WALLET_CREDITED',i.id,'ENVELOPE:'+i.envelopeId,'STAFF:'+i.employeeId+':'+i.category,i.amountMinor);
      const org=await tx.organization.findUniqueOrThrow({where:{id:i.organizationId}});
      await tx.auditEvent.create({data:{actorId:actor.id,actorName:actor.legalName,actorRole:'GMD',groupId:org.parentGroupId||org.id,subsidiaryId:org.id,targetType:'WALLET_CREDIT',targetId:creditId,action:'GMD_WALLET_RELEASED',correlationId:id,metadata:JSON.stringify({amountMinor:i.amountMinor.toString(),sourceId:i.sourceId,envelopeId:i.envelopeId,confirmationHash})}});
      await tx.systemNotification.create({data:{employeeId:i.employeeId,kind:'WALLET_CREDITED',title:'Approved funds added to your wallet',body:'GMD approved your payment. View the source and available funds in your wallet.',linkUrl:'/wallet'}});
    }
    if(p.sourceType==='REQUEST') {
      await tx.expenditureRequest.update({where:{id:p.sourceId},data:{approvalStatus:'APPROVED',paymentStatus:items[0].vendorId?'MONNIFY_PENDING':'WALLET_CREDITED',requestVersion:{increment:1}}});
      await tx.approvalStep.updateMany({where:{requestId:p.sourceId,status:'PENDING'},data:{status:'APPROVED',approverId:actor.id,approverName:actor.legalName,decidedAt:new Date()}});
      const request=await tx.expenditureRequest.findUniqueOrThrow({where:{id:p.sourceId}});
      if(!request.vendorId&&request.requestType!=='REIMBURSEMENT')await tx.accountabilityCase.upsert({where:{requestId:request.id},update:{},create:{requestId:request.id,ownerUserId:request.requestedById,requiredDeliverables:request.deliverable,dueAt:await accountabilityDeadline(request.subsidiaryId,request.requestType==='EMERGENCY',new Date(),tx)}});
    } else {
      await tx.payrollBatch.update({where:{id:p.sourceId},data:{status:'WALLET_CREDITED',approvedAt:new Date(),snapshotHash:p.sourceHash}});
      await tx.payrollItem.updateMany({where:{batchId:p.sourceId},data:{status:'WALLET_CREDITED'}});
    }
    return {id,status:items[0].vendorId?'MONNIFY_PENDING':'WALLET_CREDITED',amountMinor:p.amountMinor.toString(),creditCount:items.length,alreadyExecuted:false};
  });
}
