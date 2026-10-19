import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to update a company profile.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the GMD or System Admin can update a company profile.' }, { status: 403 });
  const { organizationId } = await params;
  const current = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!current) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : current.legalName;
  const defaultCurrency = typeof body.defaultCurrency === 'string' ? body.defaultCurrency : current.defaultCurrency;
  const timezone = typeof body.timezone === 'string' ? body.timezone : current.timezone;
  if (legalName.length < 2 || legalName.length > 180 || !['NGN', 'USD', 'GBP'].includes(defaultCurrency) || !['Africa/Lagos', 'UTC', 'Europe/London', 'America/New_York'].includes(timezone)) return NextResponse.json({ error: 'Enter a valid company name, supported currency, and timezone.' }, { status: 400 });
  const updated = await prisma.$transaction(async tx => {
    const org = await tx.organization.update({ where: { id: organizationId }, data: { legalName, defaultCurrency, timezone } });
    await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: current.parentGroupId || current.id, subsidiaryId: current.id, targetType: 'POLICY', targetId: current.id, action: 'ORGANIZATION_PROFILE_UPDATED', correlationId: `CORR-ORG-${randomUUID()}`, metadata: JSON.stringify({ before: { legalName: current.legalName, defaultCurrency: current.defaultCurrency, timezone: current.timezone }, after: { legalName, defaultCurrency, timezone } }) } });
    return org;
  });
  return NextResponse.json({ organization: updated });
}
