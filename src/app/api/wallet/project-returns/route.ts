import {walletHttp} from '@/lib/wallet/http';
import {returnProjectFunds} from '@/lib/wallet/project-return';
import {sessionBinding} from '@/lib/wallet/security';
export async function POST(r:Request){return walletHttp(r,async actor=>{const b=await r.json();return returnProjectFunds(actor,b.intent,{id:b.challengeId,token:b.challengeToken,sessionHash:await sessionBinding(r,actor.id)});});}
