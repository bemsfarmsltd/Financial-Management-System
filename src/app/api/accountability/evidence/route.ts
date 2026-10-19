import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to submit accountability evidence.' }, { status: 401 });
  const form = await request.formData();
  const caseId = String(form.get('caseId') || '');
  const notes = String(form.get('notes') || '').trim().slice(0, 1000);
  const file = form.get('file');
  if (!caseId || !(file instanceof File)) return NextResponse.json({ error: 'Choose a case and attach an evidence file.' }, { status: 400 });
  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Attach a PDF, PNG, JPG, or WebP file up to 10 MB.' }, { status: 400 });

  const accCase = await prisma.accountabilityCase.findUnique({ where: { id: caseId }, include: { request: { include: { channel: true, disbursements: true } }, owner: true } });
  if (!accCase) return NextResponse.json({ error: 'Accountability case not found.' }, { status: 404 });
  const isAuthorized = hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'VERIFIER']) || actor.id === accCase.ownerUserId || actor.id === accCase.request.requestedById;
  if (!isAuthorized) return NextResponse.json({ error: 'Only the requester, case owner, or an authorized verifier can submit evidence.' }, { status: 403 });
  if (!accCase.request.disbursements.length) return NextResponse.json({ error: 'Evidence can only be submitted for a request with a recorded payment.' }, { status: 409 });
  if (accCase.status === 'CLOSED') return NextResponse.json({ error: 'This accountability case is already closed.' }, { status: 409 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const safeName = file.name.replace(/[\\/\r\n]/g, '_').slice(0, 180);
  const attachment = await prisma.$transaction(async tx => {
    const record = await tx.attachment.create({ data: { ownerType: 'ACCOUNTABILITY', ownerId: accCase.id, requestId: accCase.requestId, fileName: safeName, fileUrl: '', checksum, contentType: file.type, fileData: bytes, notes: notes || null, uploadedById: actor.id } });
    await tx.attachment.update({ where: { id: record.id }, data: { fileUrl: `/api/accountability/evidence/${record.id}` } });
    await tx.accountabilityCase.update({ where: { id: accCase.id }, data: { status: 'EVIDENCE_SUBMITTED' } });
    await tx.expenditureRequest.update({ where: { id: accCase.requestId }, data: { accountabilityStatus: 'EVIDENCE_SUBMITTED' } });
    if (accCase.request.channel) await tx.channelMessage.create({ data: { channelId: accCase.request.channel.id, authorId: actor.id, authorName: actor.legalName, authorRole: actor.role, body: `Accountability evidence uploaded: ${safeName}${notes ? ` — ${notes}` : ''}`, messageType: 'AUDIT_EVENT' } });
    await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: accCase.request.groupId, subsidiaryId: accCase.request.subsidiaryId, targetType: 'REQUEST', targetId: accCase.requestId, action: 'EVIDENCE_SUBMITTED', correlationId: `CORR-EVIDENCE-${randomUUID()}`, metadata: JSON.stringify({ caseId, fileName: safeName, contentType: file.type, checksum, size: bytes.length }) } });
    return record;
  });

  const setting = await prisma.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId: accCase.request.subsidiaryId, key: 'notifications.preferences' } }, select: { value: true } });
  let notifyReviewers = true;
  try { if (setting?.value && JSON.parse(setting.value).reviewEvidenceAlerts === false) notifyReviewers = false; } catch { /* Keep mandatory review alerts on when settings cannot be read. */ }
  const reviewers = notifyReviewers ? await prisma.employee.findMany({ where: { role: { in: ['GMD', 'SYSTEM_ADMIN', 'VERIFIER'] }, status: 'ACTIVE', approvalStatus: 'APPROVED', id: { not: actor.id } }, select: { id: true } }) : [];
  if (reviewers.length) await prisma.systemNotification.createMany({ data: reviewers.map(reviewer => ({ employeeId: reviewer.id, kind: 'ACCOUNTABILITY_EVIDENCE_SUBMITTED', title: 'Evidence ready for review', body: `${accCase.request.requestNumber} has new post-payment evidence from ${actor.legalName}.`, linkUrl: '/' })) });
  return NextResponse.json({ success: true, attachment: { id: attachment.id, fileName: attachment.fileName, url: attachment.fileUrl } }, { status: 201 });
}
