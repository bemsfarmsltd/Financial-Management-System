import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view audit history.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive audit access is required.' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 250));
    const subsidiary = searchParams.get('subsidiary') || searchParams.get('organization_id');

    let whereClause = {};
    if (subsidiary && subsidiary !== 'ALL') {
      const scope = await resolveOrganizationScope(subsidiary);
      if (!scope.isGroup) {
        whereClause = { subsidiaryId: { in: scope.organizationIds } };
      }
    }

    const auditLogs = await prisma.auditEvent.findMany({
      where: whereClause,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const safeLogs = JSON.parse(
      JSON.stringify(auditLogs, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
    );

    return NextResponse.json(
      { logs: safeLogs },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
