// @ts-nocheck -- Substitute only provider job execution; no database or network effects.
import assert from 'node:assert/strict';
import Module from 'node:module';
let calls=0,finish;
const pending=new Promise(resolve=>{finish=resolve;});
const load=Module._load;
Module._load=function(name,parent,...rest){if(name==='./worker'&&parent?.filename.endsWith('/wallet/runtime-worker.ts'))return {processWalletTransfer:async()=>{calls++;await pending;return {processed:false};}};return load.call(this,name,parent,...rest);};
async function main(){
 const {startWalletWorker,tickWalletWorker}=require('../src/lib/wallet/runtime-worker');
 for(const k of ['BEMS_WALLET_ENABLED','BEMS_WALLET_TRANSFERS_ENABLED','BEMS_WALLET_LIVE_ENABLED','BEMS_WALLET_OPENING_RECONCILED'])process.env[k]='true';
 process.env.MONNIFY_ENVIRONMENT='live';process.env.NEXT_PHASE='phase-production-build';
 startWalletWorker();await tickWalletWorker();assert.equal(calls,0);assert.equal(globalThis.bemsWalletTimer,undefined,'Builds must never start monetary processing.');
 delete process.env.NEXT_PHASE;
 const first=tickWalletWorker();await tickWalletWorker();assert.equal(calls,1,'A server process must not overlap its own worker ticks.');finish();await first;
 process.env.BEMS_WALLET_TRANSFERS_ENABLED='false';await tickWalletWorker();assert.equal(calls,1,'Disabled transfer configuration must stop new processing.');
 console.log('PASS runtime wallet processing is disabled in builds and inactive environments, and ticks cannot overlap');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
