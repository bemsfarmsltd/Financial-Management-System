import {walletHttp} from '@/lib/wallet/http';
import {reconcileWalletFunding} from '@/lib/wallet/reconciliation';
export const maxDuration=120;
export async function POST(r:Request){return walletHttp(r,actor=>reconcileWalletFunding(actor));}
