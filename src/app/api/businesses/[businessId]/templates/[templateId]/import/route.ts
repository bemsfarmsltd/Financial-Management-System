import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string; templateId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access is required to import business templates.' }, { status: 403 });
    }

    const { businessId, templateId } = await params;
    const org =
      !businessId || businessId === 'all' || businessId === 'bems-group-hq'
        ? await prisma.organization.findFirst({ where: { OR: [{ type: 'GROUP' }, { code: 'BEMS-GROUP' }, { code: 'BEMS-HQ' }] } })
        : await prisma.organization.findFirst({
            where: { OR: [{ id: businessId }, { code: { equals: businessId, mode: 'insensitive' } }] },
          });

    if (!org) {
      return NextResponse.json({ error: `Business "${businessId}" not found.` }, { status: 404 });
    }

    const result = await executeDashboardCommand(actor, 'policy_update', { sub_action: 'IMPORT_TEMPLATE', organizationId: org.id, templateId });
    return NextResponse.json({ ok: true, imported: result.templateId, businessId: org.id, organizationName: org.legalName, appliedSettings: result.appliedSettings });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to import template.' }, { status: 500 });
  }
}
