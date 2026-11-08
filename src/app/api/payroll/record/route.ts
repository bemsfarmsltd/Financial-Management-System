import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { recordTransfer } from '@/lib/services/payment';

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee(request, { disallowServiceToken: true });
  if (!actor) return NextResponse.json({ error: 'Sign in to record payroll.' }, { status: 401 });
  if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) return NextResponse.json({ error: 'Executive access required.' }, { status: 403 });
  try {
    const form = await request.formData();
    const receipt = form.get('receipt');
    if (!(receipt instanceof File)) return NextResponse.json({ error: 'Attach the actual bank receipt.' }, { status: 400 });
    const bytes = Buffer.from(await receipt.arrayBuffer());
    const itemId = String(form.get('payrollItemId') || '');
    const reference = String(form.get('externalReference') || '').trim();
    const payment = await prisma.$transaction(async tx => {
      const item = await tx.payrollItem.findUnique({ where: { id: itemId } });
      if (!item || item.batchId !== String(form.get('batchId') || '')) throw new Error('Payroll item not found in this batch.');
      return recordTransfer(tx, {
        actor, payrollItemId: itemId, payerAccountId: String(form.get('payerAccountId') || '') || undefined,
        bankName: String(form.get('bankName') || ''), amountMinor: item.netMinor, reference,
        beneficiaryBank: String(form.get('beneficiaryBank') || ''), beneficiaryAccount: String(form.get('beneficiaryAccount') || ''),
        receipt: { name: receipt.name, type: receipt.type, bytes }, idempotencyKey: 'PAYROLL-' + itemId + '-' + reference,
      });
    });
    return NextResponse.json({ success: true, paymentId: payment.id, message: 'Payment recorded with intercompany allocations. The recipient must confirm receipt.' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payroll payment failed.' }, { status: 409 });
  }
}
