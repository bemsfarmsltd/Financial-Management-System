import { walletHttp } from '@/lib/wallet/http';
import { requestWalletWithdrawal } from '@/lib/wallet/withdrawals';
import { sessionBinding } from '@/lib/wallet/security';
export const dynamic='force-dynamic';
export async function POST(request:Request){return walletHttp(request,async actor=>{const b=await request.json();if(process.env.BEMS_WALLET_TRANSFERS_ENABLED!=='true')return requestWalletWithdrawal(actor,b.intent);return requestWalletWithdrawal(actor,b.intent,{id:b.challengeId,token:b.challengeToken,sessionHash:await sessionBinding(request,actor.id)});});}
