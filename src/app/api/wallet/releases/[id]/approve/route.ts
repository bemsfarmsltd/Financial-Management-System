import {approveWalletRelease} from '@/lib/wallet/releases';
import { walletHttp } from '@/lib/wallet/http';
import { sessionBinding } from '@/lib/wallet/security';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return walletHttp(request,async actor=>{const b=await request.json();return approveWalletRelease(actor,(await params).id,b.confirmationHash,{id:b.challengeId,token:b.challengeToken,sessionHash:await sessionBinding(request,actor.id)});});}
