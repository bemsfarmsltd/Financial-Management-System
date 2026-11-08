import {processWalletTransfer} from '../src/lib/wallet/worker';
import {prisma} from '../src/lib/prisma';
async function main(){for(let i=0;i<20;i++){const r=await processWalletTransfer();if(!r.processed)break;console.log(JSON.stringify(r));}}
main().catch(e=>{console.error(e.code||'WALLET_WORKER_FAILED');process.exitCode=1;}).finally(()=>prisma.$disconnect());
