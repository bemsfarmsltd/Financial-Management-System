import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let actor = await getAuthenticatedEmployee(request);
  if (!actor) {
    const fallbackEmpId = request.headers.get('x-employee-id');
    if (fallbackEmpId) {
      const emp = await prisma.employee.findUnique({
        where: { id: fallbackEmpId },
        select: { id: true, employeeNumber: true, legalName: true, workEmail: true, phone: true, role: true, avatarUrl: true, status: true, approvalStatus: true },
      });
      if (emp && emp.status === 'ACTIVE' && emp.approvalStatus === 'APPROVED') {
        actor = emp;
      }
    }
  }
  if (!actor) return NextResponse.json({ error: 'Sign in to view accountability cases.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'HR', 'STAFF', 'COO', 'FINANCE', 'DIRECTOR', 'HEAD_OF_ADMIN', 'AI_ANALYST', 'FINANCE_CONTROLLER'])) {
    return NextResponse.json({ error: 'Accountability access is required.' }, { status: 403 });
  }

  // Staff can see and submit proof only for requests they own or requested.
  const ownCasesOnly = actor.role === 'STAFF';

  const cases = await prisma.accountabilityCase.findMany({
    where: ownCasesOnly
      ? { OR: [{ ownerUserId: actor.id }, { request: { requestedById: actor.id } }] }
      : undefined,
    include: {
      owner: { select: { id: true, legalName: true, workEmail: true } },
      request: { include: {
        subsidiary: { select: { id: true, legalName: true } },
        requester: { select: { id: true, legalName: true, workEmail: true } },
        disbursements: { include: { receipt: { select: { id: true, fileName: true, fileUrl: true, uploadedAt: true } } }, orderBy: { paidAt: 'desc' } },
      } },
      tasks: { include: { assignee: { select: { id: true, legalName: true, role: true } } }, orderBy: { dueAt: 'asc' } },
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
  });
  const attachments = await prisma.attachment.findMany({ where: { ownerType: 'ACCOUNTABILITY' }, select: { id: true, ownerId: true, fileName: true, contentType: true, uploadedAt: true, notes: true }, orderBy: { uploadedAt: 'desc' } });
  const attachmentMap = new Map<string, typeof attachments>();
  for (const attachment of attachments) if (attachment.ownerId) attachmentMap.set(attachment.ownerId, [...(attachmentMap.get(attachment.ownerId) || []), attachment]);
  const safeCases = cases.map(c => {
    const naira = Number(c.request.amountMinor) / 100;
    return {
      ...c,
      amount: naira,
      amountNaira: naira,
      requestNumber: c.request.requestNumber,
      title: c.request.title,
      request: {
        ...c.request,
        amount: naira,
        amountNaira: naira,
        systemId: toSystemRequestId(c.request.id),
        amountMinor: Number(c.request.amountMinor),
        disbursements: c.request.disbursements.map(d => ({
          ...d,
          amount: Number(d.amountMinor) / 100,
          amountNaira: Number(d.amountMinor) / 100,
          amountMinor: Number(d.amountMinor)
        }))
      },
      attachments: (attachmentMap.get(c.id) || []).map(a => ({ ...a, url: `/api/accountability/evidence/${a.id}` }))
    };
  });
  return NextResponse.json({ cases: safeCases });
}

// Idempotently initialize accountability cases for historical payments recorded before the case workflow existed.
export async function POST() {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to initialize accountability cases.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'HR'])) return NextResponse.json({ error: 'Admin or HR access is required.' }, { status: 403 });
  const legacyRequests = await prisma.expenditureRequest.findMany({ where: { disbursements: { some: {} }, accountabilityCase: { is: null } }, include: { disbursements: { orderBy: { paidAt: 'asc' }, take: 1 } } });
  let createdCount = 0;
  for (const request of legacyRequests) {
    const firstPayment = request.disbursements[0];
    if (!firstPayment) continue;
    const dueAt = new Date(firstPayment.paidAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    try {
      await prisma.$transaction(async tx => {
        const accCase = await tx.accountabilityCase.create({ data: { requestId: request.id, ownerUserId: request.requestedById, requiredDeliverables: request.deliverable, dueAt, status: request.accountabilityStatus === 'EVIDENCE_SUBMITTED' ? 'EVIDENCE_SUBMITTED' : 'OPEN' } });
        await tx.followupTask.create({ data: { accountabilityCaseId: accCase.id, assigneeId: request.requestedById, description: 'Submit post-payment deliverables for ' + request.requestNumber, dueAt } });
        await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: request.groupId, subsidiaryId: request.subsidiaryId, targetType: 'REQUEST', targetId: request.id, action: 'ACCOUNTABILITY_CASE_OPENED', correlationId: `CORR-CASE-${accCase.id}`, metadata: JSON.stringify({ caseId: accCase.id, backfilled: true }) } });
      });
      createdCount++;
    } catch (error) {
      // The request may have been initialized by another page load at the same time.
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error;
    }
  }
  return NextResponse.json({ createdCount });
}
