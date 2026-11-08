import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { randomUUID, createHash } from 'node:crypto';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GET as exportAudit } from '@/app/api/audit/route';

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee(request, { disallowServiceToken: true });
  if (!actor || !hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) return NextResponse.json({ error: 'Executive access required.' }, { status: 403 });
  try {
    const input = await request.json();
    return NextResponse.json(await executeDashboardCommand(actor, 'policy_update', { ...input, sub_action: 'EXPORT_REPORT' }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Report generation failed.' }, { status: 400 }); }
}

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request, { disallowServiceToken: true });
  if (!actor) return NextResponse.json({ error: 'Sign in to download your report.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  const file = await prisma.attachment.findUnique({ where: { id } });
  if (!file || file.ownerType !== 'REPORT_EXPORT' || file.ownerId !== actor.id) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  const metadata = JSON.parse(file.notes || '{}');
  if (!Number.isFinite(Date.parse(metadata.expiresAt)) || Date.parse(metadata.expiresAt) <= Date.now()) return NextResponse.json({ error: 'This report has expired. Generate a new export.' }, { status: 410 });
  return new NextResponse(file.fileData ? new Uint8Array(file.fileData) : null, { headers: { 'Content-Type': file.contentType, 'Content-Disposition': 'attachment; filename="' + file.fileName + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
