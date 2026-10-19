import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to search receipt records.' }, { status: 401 });
  const privileged = hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE', 'VERIFIER', 'AUDITOR']);
  const receipts = await prisma.paymentReceipt.findMany({
    where: privileged ? undefined : { disbursement: { OR: [{ request: { requestedById: actor.id } }, { beneficiaryEmployeeId: actor.id }, { request: { approvalSteps: { some: { approverId: actor.id } } } }] } },
    select: { id: true, fileName: true, fileUrl: true, sha256: true, mimeType: true, uploadedAt: true, disbursement: { select: { amountMinor: true, currency: true, externalReference: true, bankName: true, paidAt: true, recordedBy: { select: { legalName: true } }, request: { select: { id: true, requestNumber: true, title: true, subsidiary: { select: { legalName: true } }, requester: { select: { legalName: true } } } }, payrollItem: { select: { employee: { select: { legalName: true } }, batch: { select: { period: { select: { year: true, month: true } } } } } } } } },
    orderBy: { uploadedAt: 'desc' },
    take: Math.min(Number(new URL(request.url).searchParams.get('limit')) || 300, 500),
  });
  return NextResponse.json({ receipts: receipts.map(r => ({ ...r, fileAvailable: r.fileUrl === `/api/receipts/${r.id}`, disbursement: { ...r.disbursement, amountMinor: Number(r.disbursement.amountMinor), request: r.disbursement.request ? { ...r.disbursement.request, systemId: toSystemRequestId(r.disbursement.request.id) } : null } })) });
}
