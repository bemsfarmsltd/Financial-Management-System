import {prisma} from '../src/lib/prisma';
import {reconcileWalletFunding} from '../src/lib/wallet/reconciliation';
async function main(){const id=process.env.BEMS_FINANCIAL_GMD_ID;if(!id)throw new Error('Configure the designated GMD.');const actor=await prisma.employee.findUniqueOrThrow({where:{id},select:{id:true,role:true,legalName:true}});console.log(JSON.stringify(await reconcileWalletFunding(actor)));}
main().catch(()=>{console.error('Wallet reconciliation failed; no balance correction was invented.');process.exitCode=1;}).finally(()=>prisma.$disconnect());
