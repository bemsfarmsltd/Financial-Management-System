import assert from 'node:assert/strict';
import { walletApi } from '../src/lib/wallet/client';
async function main(){
 const original=globalThis.fetch;const calls:Array<{url:string;init:RequestInit}> = [];
 try{
  globalThis.fetch=(async(url:any,init:any)=>{calls.push({url:String(url),init});return new Response(JSON.stringify({ok:true}),{status:200});}) as typeof fetch;
  for(const path of ['funding','banks','releases/review-id','me'])await walletApi(path);
  assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.body===undefined&&c.init.cache==='no-store'&&c.init.credentials==='same-origin'));
  assert.equal(calls[3].url,'/api/wallet/me');
  await walletApi('challenges',{purpose:'RELEASE'});assert.equal(calls.at(-1)!.init.method,'POST');
  await walletApi('funding/refresh',{});assert.equal(calls.at(-1)!.init.method,'POST');
  await walletApi('envelopes/id',{operation:'CLOSE'},'PATCH','test-key');assert.equal(calls.at(-1)!.init.method,'PATCH');assert.equal((calls.at(-1)!.init.headers as Record<string,string>)['idempotency-key'],'test-key');
  globalThis.fetch=(async()=>new Response(null,{status:405})) as typeof fetch;
  await assert.rejects(walletApi('funding'),/HTTP 405/);
  globalThis.fetch=(async()=>new Response(JSON.stringify({error:'Wallet execution is disabled.'}),{status:503})) as typeof fetch;
  await assert.rejects(walletApi('funding'),/Wallet execution is disabled/);
  globalThis.fetch=(async()=>new Response('<html>Login</html>',{status:200})) as typeof fetch;
  await assert.rejects(walletApi('funding'),/unexpected response/);
  globalThis.fetch=(async()=>{throw new TypeError('Failed to fetch')}) as typeof fetch;
  await assert.rejects(walletApi('funding'),/Unable to reach/);
  console.log('PASS wallet reads use GET; mutations retain methods and idempotency; HTTP, provider, network and invalid-response errors are explained');
 }finally{globalThis.fetch=original}
}
main().catch(e=>{console.error(e);process.exitCode=1});
