import {processWalletTransfer} from './worker';
import {updateWalletWorkerStatus} from './runtime-state';
const scope=globalThis as typeof globalThis & {bemsWalletTimer?:ReturnType<typeof setInterval>;bemsWalletTickBusy?:boolean};
export function walletRuntimeEnabled(){
  if (process.env.BEMS_WALLET_ENABLED === 'false' || process.env.BEMS_WALLET_WORKER_ENABLED === 'false' || process.env.BEMS_WALLET_TRANSFERS_ENABLED === 'false') return false;
  return Boolean(process.env.MONNIFY_API_KEY && process.env.MONNIFY_SECRET_KEY);
}
export async function tickWalletWorker(){
 if(process.env.NEXT_PHASE==='phase-production-build'||!walletRuntimeEnabled()||scope.bemsWalletTickBusy)return;
 scope.bemsWalletTickBusy=true;updateWalletWorkerStatus({lastTickAt:new Date().toISOString()});
 try{for(let i=0;i<4;i++){const result=await processWalletTransfer();if(!result.processed)break;}updateWalletWorkerStatus({lastError:null});}
 catch(error){const code=error&&typeof error==='object'&&'code' in error?String(error.code):'WALLET_WORKER_FAILED';updateWalletWorkerStatus({lastError:code});console.error('[wallet-worker]',code);}
 finally{scope.bemsWalletTickBusy=false;}
}
export function startWalletWorker(){
 if(process.env.NEXT_PHASE==='phase-production-build'||!walletRuntimeEnabled()||scope.bemsWalletTimer)return;
 updateWalletWorkerStatus({startedAt:new Date().toISOString()});
 scope.bemsWalletTimer=setInterval(()=>{void tickWalletWorker();},10000);scope.bemsWalletTimer.unref?.();
 void tickWalletWorker();
}
