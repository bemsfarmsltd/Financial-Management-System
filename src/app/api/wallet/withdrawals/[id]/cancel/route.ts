import {walletHttp} from '@/lib/wallet/http';
import {cancelQueuedWithdrawal} from '@/lib/wallet/withdrawals';
export async function POST(r:Request,{params}:{params:Promise<{id:string}>}){return walletHttp(r,async actor=>cancelQueuedWithdrawal(actor,(await params).id));}
