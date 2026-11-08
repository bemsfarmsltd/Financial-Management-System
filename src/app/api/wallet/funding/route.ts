import { readFundingDashboard } from '@/lib/wallet/core';
import { walletHttp } from '@/lib/wallet/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return walletHttp(request, actor => readFundingDashboard(actor)); }
