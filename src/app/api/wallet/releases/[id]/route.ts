import { walletHttp } from '@/lib/wallet/http';
import { walletProposal } from '@/lib/wallet/proposals';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return walletHttp(request,async actor=>walletProposal(actor,(await params).id));}
