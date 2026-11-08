import { walletHttp } from '@/lib/wallet/http';
import { controlWalletPool } from '@/lib/wallet/operations';
import { sessionBinding } from '@/lib/wallet/security';
export async function POST(request:Request){return walletHttp(request,async actor=>{const b=await request.json();return controlWalletPool(actor,b.operation,{id:b.challengeId,token:b.challengeToken,sessionHash:await sessionBinding(request,actor.id)});});}
