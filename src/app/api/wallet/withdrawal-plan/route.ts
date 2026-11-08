import {walletHttp} from '@/lib/wallet/http';
import {planWalletWithdrawal} from '@/lib/wallet/withdrawals';
export async function POST(r:Request){return walletHttp(r,async actor=>planWalletWithdrawal(actor,await r.json()));}
