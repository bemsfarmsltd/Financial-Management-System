import {prisma} from '../src/lib/prisma';
async function main(){
 const gmdId=process.env.BEMS_FINANCIAL_GMD_ID;
 const gmd=gmdId?await prisma.employee.findUnique({where:{id:gmdId},select:{role:true,status:true,approvalStatus:true,passwordHash:true}}):null;
 const legacyUnpaid=await prisma.expenditureRequest.count({where:{approvalStatus:'APPROVED',paymentStatus:'UNPAID'}});
 const legacyPayroll=await prisma.payrollBatch.count({where:{status:'APPROVED'}});
 const pools=await prisma.$queryRaw<any[]>`SELECT "environment","availableMinor","feeReserveMinor","paused","observedAt" FROM "WalletFundingPool"`;
 const issues=await prisma.$queryRaw<any[]>`SELECT "code",count(*)::integer AS "count" FROM "WalletReconciliationIssue" WHERE "resolvedAt" IS NULL GROUP BY "code"`;
 console.log(JSON.stringify({gmdDesignationValid:!!gmd&&gmd.role==='GMD'&&gmd.status==='ACTIVE'&&gmd.approvalStatus==='APPROVED'&&!!gmd.passwordHash,legacyApprovedUnpaidRequestsRequiringReview:legacyUnpaid,legacyApprovedPayrollRequiringReview:legacyPayroll,pools,unresolvedIssueCounts:issues,notice:'Read-only report. No credit, transfer, migration or activation was performed.'},(_,v)=>typeof v==='bigint'?v.toString():v,2));
}
main().catch(()=>{console.error('Wallet preflight failed. Verify the intended database and deployed migrations.');process.exitCode=1;}).finally(()=>prisma.$disconnect());
