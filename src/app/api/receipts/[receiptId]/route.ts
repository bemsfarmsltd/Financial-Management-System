import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to view this receipt.' }, { status: 401 });
  const { receiptId } = await params;
  const receipt = await prisma.paymentReceipt.findUnique({
    where: { id: receiptId },
    include: { disbursement: { include: { request: { include: { approvalSteps: true } }, payrollItem: true } } },
  });
  if (!receipt) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
  const request = receipt.disbursement.request;
  const canViewByRole = hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE']);
  const isRequester = request?.requestedById === actor.id;
  const isApprover = request?.approvalSteps.some((step) => step.approverId === actor.id) || false;
  const isPayrollRecipient = receipt.disbursement.beneficiaryEmployeeId === actor.id && !!receipt.disbursement.payrollItemId;
  if (!canViewByRole && !isRequester && !isApprover && !isPayrollRecipient) return NextResponse.json({ error: 'You are not allowed to view this receipt.' }, { status: 403 });
  if (!receipt.fileData) return NextResponse.json({ error: 'The uploaded receipt file is unavailable.' }, { status: 404 });

  const safeName = receipt.fileName.replace(/[\r\n"\\]/g, '_');
  return new Response(receipt.fileData, {
    headers: {
      'Content-Type': receipt.mimeType,
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
