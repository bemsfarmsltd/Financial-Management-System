import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access is required to read business audit logs.' }, { status: 403 });
    }

    const { businessId } = await params;

    const scopeCheck = await resolveAuthorizedOrganizationScope(actor, businessId);
    if (scopeCheck.organizationIds.length === 0) {
      return NextResponse.json({ error: 'Forbidden: Outside authorized subsidiary scope.' }, { status: 403 });
    }

    const isGroupWide =
      !businessId ||
      businessId === 'all' ||
      businessId === 'bems-group-hq' ||
      scopeCheck.isGroup;

    const logs = await prisma.auditEvent.findMany({
      where: isGroupWide
        ? {}
        : {
            OR: [
              { subsidiaryId: businessId },
              { subsidiaryId: { in: scopeCheck.organizationIds } },
            ],
          },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    const formatted = logs.map((l) => ({
      id: l.id,
      actorName: l.actorName,
      category: l.targetType || 'COMPLIANCE',
      message: `${l.action.replaceAll('_', ' ')} (${l.targetId || l.id})`,
      createdAt: l.createdAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to load business audit logs.' }, { status: 500 });
  }
}
