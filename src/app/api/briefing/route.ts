import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { enforceMobileVersionGate } from '@/lib/mobile-gate';
import { loadAuthorizedExecutiveBriefing } from '@/lib/services/briefing-read';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const gateBlock = await enforceMobileVersionGate(request);
    if (gateBlock) return gateBlock;

    const actor = await getAuthenticatedEmployee(request);
    const { searchParams } = new URL(request.url);
    const requestedOrgId =
      searchParams.get('subsidiary') ||
      searchParams.get('organization_id') ||
      searchParams.get('organizationId') ||
      'ALL';

    const result = await loadAuthorizedExecutiveBriefing(actor, requestedOrgId);
    if (!result.authorized) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
