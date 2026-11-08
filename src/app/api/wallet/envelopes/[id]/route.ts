import { walletHttp } from '@/lib/wallet/http';
import { adjustFundedEnvelope } from '@/lib/wallet/operations';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){return walletHttp(request,async actor=>adjustFundedEnvelope(actor,(await params).id,await request.json()));}
