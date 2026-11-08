import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
export async function GET(req: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor || !hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) return NextResponse.json({ error: 'Executive access required.' }, { status: 403 });
  const { businessId } = await params;
  const org = ['all', 'bems-group-hq'].includes(businessId) ? await prisma.organization.findFirst({ where: { type: 'GROUP' } }) : await prisma.organization.findFirst({ where: { OR: [{ id: businessId }, { code: { equals: businessId, mode: 'insensitive' } }] } });
  if (!org) return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
  const setting = await prisma.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId: org.id, key: 'governance.template' } } });
  return NextResponse.json({ imported: setting ? JSON.parse(setting.value).imported || [] : [], updates: [] });
}
