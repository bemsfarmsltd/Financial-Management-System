import {stageWalletRelease} from '@/lib/wallet/releases';
import { walletHttp } from '@/lib/wallet/http';
export const dynamic='force-dynamic';
export async function POST(request:Request){return walletHttp(request,async actor=>{const b=await request.json();return stageWalletRelease(actor,{sourceType:b.sourceType,sourceId:b.sourceId,envelopeId:b.envelopeId,envelopesByOrganization:b.envelopesByOrganization});});}
