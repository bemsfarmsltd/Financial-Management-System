import {walletHttp} from '@/lib/wallet/http';
import {acknowledgeWalletIssue} from '@/lib/wallet/operations';
import {sessionBinding} from '@/lib/wallet/security';
export async function POST(r:Request,{params}:{params:Promise<{id:string}>}){return walletHttp(r,async actor=>{const b=await r.json();return acknowledgeWalletIssue(actor,{issueId:(await params).id,note:b.note},{id:b.challengeId,token:b.challengeToken,sessionHash:await sessionBinding(r,actor.id)});});}
