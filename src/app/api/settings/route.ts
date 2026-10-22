import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
const editableKeys = new Set(['approval.controls', 'notifications.preferences', 'data.retention', 'ai.access']);

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to view workspace settings.' }, { status: 401 });
  const organizationId = new URL(request.url).searchParams.get('organizationId');
  if (!organizationId) return NextResponse.json({ error: 'organizationId is required.' }, { status: 400 });
  if (!await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  const rows = await prisma.workspaceSetting.findMany({ where: { organizationId } });
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = null; }
  }
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to change workspace settings.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the GMD or System Admin can change workspace settings.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const { organizationId, key, value } = body;
  if (typeof organizationId !== 'string' || typeof key !== 'string' || !editableKeys.has(key) || !value || typeof value !== 'object' || Array.isArray(value)) return NextResponse.json({ error: 'Provide a company and a supported settings section.' }, { status: 400 });
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  const json = JSON.stringify(value);
  if (json.length > 8000) return NextResponse.json({ error: 'Settings are too large.' }, { status: 400 });
  const saved = await prisma.$transaction(async tx => {
    const row = await tx.workspaceSetting.upsert({ where: { organizationId_key: { organizationId, key } }, create: { organizationId, key, value: json, updatedById: actor.id }, update: { value: json, updatedById: actor.id } });
    await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: organization.parentGroupId || organization.id, subsidiaryId: organization.id, targetType: 'POLICY', targetId: row.id, action: 'WORKSPACE_SETTINGS_UPDATED', correlationId: `CORR-SET-${randomUUID()}`, metadata: JSON.stringify({ key, value }) } });
    return row;
  });
  return NextResponse.json({ key: saved.key, value: JSON.parse(saved.value), updatedAt: saved.updatedAt });
}
