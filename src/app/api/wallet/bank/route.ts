import { walletHttp } from '@/lib/wallet/http';
import { saveVerifiedWalletBank } from '@/lib/wallet/withdrawals';
export async function POST(request:Request){return walletHttp(request,async actor=>saveVerifiedWalletBank(actor,await request.json()));}
