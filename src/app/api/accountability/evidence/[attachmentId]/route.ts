import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to open this evidence file.' }, { status: 401 });
  const { attachmentId } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { request: { include: { approvalSteps: true } } } });
  if (!attachment || attachment.ownerType !== 'ACCOUNTABILITY' || !attachment.fileData) return NextResponse.json({ error: 'Evidence file not found.' }, { status: 404 });
  const allowed = hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'HR']) || attachment.uploadedById === actor.id || attachment.request?.requestedById === actor.id || !!attachment.request?.approvalSteps.some(step => step.approverId === actor.id);
  if (!allowed) return NextResponse.json({ error: 'You are not allowed to open this evidence file.' }, { status: 403 });
  const safeName = attachment.fileName.replace(/[\r\n"\\]/g, '_');
  return new Response(attachment.fileData, { headers: { 'Content-Type': attachment.contentType, 'Content-Disposition': `inline; filename="${safeName}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
