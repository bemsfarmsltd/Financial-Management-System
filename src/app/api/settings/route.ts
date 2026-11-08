import { executeDashboardCommand } from '@/lib/staged-actions';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { getAiAccessMatrix, normalizeAiAccessMatrix } from '@/lib/ai-access-control';

export const dynamic = 'force-dynamic';
const editableKeys = new Set(['approval.controls', 'notifications.preferences', 'data.retention', 'ai.access']);

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to view workspace settings.' }, { status: 401 });
  const organizationId = new URL(request.url).searchParams.get('organizationId');
  if (!organizationId) return NextResponse.json({ error: 'organizationId is required.' }, { status: 400 });
  if (!(await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  }
  const scope = await resolveAuthorizedOrganizationScope(actor, organizationId);
  if (scope.organizationIds.length === 0 || (!scope.isGroup && !scope.organizationIds.includes(organizationId))) {
    return NextResponse.json({ error: 'Forbidden: You do not have access to this company\'s workspace settings.' }, { status: 403 });
  }
  const rows = await prisma.workspaceSetting.findMany({ where: { organizationId } });
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = null;
    }
  }
  // Ensure `ai.access` always returns the full normalized 24-scope Read & Write matrix
  settings['ai.access'] = await getAiAccessMatrix(organizationId);
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to change workspace settings.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return NextResponse.json({ error: 'Only the GMD or Super Admin can change workspace settings.' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const { organizationId, key, value } = body;
  if (
    typeof organizationId !== 'string' ||
    typeof key !== 'string' ||
    !editableKeys.has(key) ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return NextResponse.json({ error: 'Provide a company and a supported settings section.' }, { status: 400 });
  }
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  const normalizedValue = key === 'ai.access' ? normalizeAiAccessMatrix(value as Record<string, unknown>) : value;
  const json = JSON.stringify(normalizedValue);
  if (json.length > 16000) return NextResponse.json({ error: 'Settings are too large.' }, { status: 400 });

  const saved = await executeDashboardCommand(actor, 'policy_update', { sub_action: 'UPDATE_WORKSPACE_SETTINGS', organizationId, key, value: normalizedValue });

  return NextResponse.json({ key: saved.key, value: JSON.parse(saved.value), updatedAt: saved.updatedAt });
}
