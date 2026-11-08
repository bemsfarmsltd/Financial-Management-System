import { createFundedEnvelope } from '@/lib/wallet/core';
import { walletHttp } from '@/lib/wallet/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return walletHttp(request, async actor => {
    const body = await request.json();
    return createFundedEnvelope(actor, { organizationId: body.organizationId, label: body.label, parentId: body.parentId, amountMinor: body.amountMinor, idempotencyKey: request.headers.get('idempotency-key') || '' });
  });
}
