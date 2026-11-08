import { walletHttp } from '@/lib/wallet/http';
import { issueWalletChallenge,sessionBinding } from '@/lib/wallet/security';
export async function POST(request:Request){return walletHttp(request,async actor=>{const b=await request.json();return issueWalletChallenge(actor,{purpose:b.purpose,payload:b.payload,password:b.password,sessionHash:await sessionBinding(request,actor.id)});});}
