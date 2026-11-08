import { refreshMonnifyFunding } from '@/lib/wallet/monnify-balance';
import { walletHttp } from '@/lib/wallet/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return walletHttp(request, actor => refreshMonnifyFunding(actor)); }
