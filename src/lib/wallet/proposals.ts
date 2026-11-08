import { hasGmdFeatureAccess, canApproveWalletRelease, financialApproverLabel } from '@/lib/gmd-access';
import { prisma } from '@/lib/prisma';
import { WalletActor,WalletError,liveWalletActor,requireWallet,walletJson } from './core';
export async function walletProposal(actor:WalletActor,id:string,context?:{conversationId?:string|null;workspaceId?:string|null;allowedOrganizationIds?:string[]}){
 requireWallet();return prisma.$transaction(async tx=>{
  await liveWalletActor(tx,actor);if(!['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role))throw new WalletError('NOT_PERMITTED','Executive review authority is required.',403);
  const[p]=await tx.$queryRaw<any[]>`SELECT "id","createdById","sourceType","sourceId","amountMinor","category","confirmationHash","expiresAt","status","conversationId","workspaceId" FROM "WalletReleaseProposal" WHERE "id"=${id}`;
  if(!p)throw new WalletError('NOT_FOUND','Release proposal not found.',404);
  if(context&&(p.conversationId!==context.conversationId||p.workspaceId!==context.workspaceId||(p.createdById!==actor.id&&!hasGmdFeatureAccess(actor.role))))throw new WalletError('WORKSPACE_FORBIDDEN','Proposal does not belong to this conversation and workspace.',403);
  const items=await tx.$queryRaw<any[]>`SELECT i.*,COALESCE(e."legalName",v."name") AS "employeeName",COALESCE(e."employeeNumber",'Vendor') AS "employeeNumber",o."legalName" AS "organizationName" FROM "WalletReleaseItem" i LEFT JOIN "Employee" e ON e."id"=i."employeeId" LEFT JOIN "Vendor" v ON v."id"=i."vendorId" JOIN "Organization" o ON o."id"=i."organizationId" WHERE i."proposalId"=${id}`;
  if(context?.allowedOrganizationIds&&items.some(i=>!context.allowedOrganizationIds!.includes(i.organizationId)))throw new WalletError('WORKSPACE_FORBIDDEN','A payment allocation is outside the authorized workspace.',403);
  const source=p.sourceType==='REQUEST'?await tx.expenditureRequest.findUnique({where:{id:p.sourceId},select:{title:true,justification:true,requestNumber:true}}):null;
  const batch=p.sourceType==='PAYROLL_BATCH'?await tx.payrollBatch.findUnique({where:{id:p.sourceId},select:{period:{select:{year:true,month:true}}}}):null;
  return walletJson({...p,title:source?.title||(batch?`Salary ${batch.period.year}-${batch.period.month}`:'Payment release'),purpose:source?.justification||'Approved net salary',requestNumber:source?.requestNumber,items,type:'wallet_release',approvalLabel:financialApproverLabel(),canApprove:canApproveWalletRelease(actor)});
 });
}
