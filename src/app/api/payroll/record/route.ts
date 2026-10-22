import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { generatePayrollIntercompanyNotes } from '@/lib/services/intercompany';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to record payroll payment.' }, { status: 401 });
    const body = await request.formData();
    const batchId = String(body.get('batchId') || '');
    const payrollItemId = String(body.get('payrollItemId') || '');
    const externalReference = String(body.get('externalReference') || '').trim();
    const bankName = String(body.get('bankName') || '').trim();
    const beneficiaryBank = String(body.get('beneficiaryBank') || '').trim();
    const beneficiaryAccount = String(body.get('beneficiaryAccount') || '').trim();
    const receiptFile = body.get('receipt');
    if (!batchId || !payrollItemId || !externalReference || !bankName || !beneficiaryBank || !beneficiaryAccount || !(receiptFile instanceof File)) {
      return NextResponse.json({ error: 'Enter the transfer and beneficiary details and attach the actual bank receipt.' }, { status: 400 });
    }
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(receiptFile.type) || receiptFile.size < 1 || receiptFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Attach a PDF, PNG, or JPG receipt up to 10 MB.' }, { status: 400 });
    }
    const batch = await prisma.payrollBatch.findUnique({ where: { id: batchId }, include: { period: true } });
    if (!batch || batch.status !== 'APPROVED') return NextResponse.json({ error: 'Only an approved payroll batch can be paid.' }, { status: 409 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD']) && batch.disbursementAssigneeId !== actor.id) {
      return NextResponse.json({ error: 'This payroll payment recording is assigned to another executive.' }, { status: 403 });
    }
    if (!batch.paymentEntityId) return NextResponse.json({ error: 'Set the payroll paying entity before recording a transfer.' }, { status: 409 });
    const item = await prisma.payrollItem.findFirst({ where: { id: payrollItemId, batchId }, include: { employee: true, disbursement: true } });
    if (!item) return NextResponse.json({ error: 'Payroll staff record not found.' }, { status: 404 });
    if (item.disbursement) return NextResponse.json({ error: 'A payment is already recorded for this staff member.' }, { status: 409 });
    if (!/^\d+$/.test(String(item.netMinor)) || Number(item.netMinor) <= 0) return NextResponse.json({ error: 'This staff record has no payable net amount.' }, { status: 409 });
    const existingRef = await prisma.disbursement.findFirst({ where: { externalReference } });
    if (existingRef) return NextResponse.json({ error: 'That bank transfer reference has already been used.' }, { status: 409 });
    const bytes = Buffer.from(await receiptFile.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (await prisma.paymentReceipt.findFirst({ where: { sha256 } })) return NextResponse.json({ error: 'This receipt file has already been attached.' }, { status: 409 });
    const receiptId = randomUUID();
    const created = await prisma.$transaction(async tx => {
      const payment = await tx.disbursement.create({ data: {
        payrollItemId: item.id,
        beneficiaryEmployeeId: item.employeeId,
        payerOrgId: batch.paymentEntityId!,
        beneficiaryName: item.employee.legalName,
        beneficiaryBank,
        beneficiaryAccount,
        amountMinor: item.netMinor,
        currency: item.currency,
        externalReference,
        bankName,
        recordedById: actor.id,
        status: 'AWAITING_RECIPIENT_CONFIRMATION',
        idempotencyKey: `PAY-${item.id}-${Date.now()}`
      } });
      await tx.paymentReceipt.create({ data: {
        id: receiptId,
        disbursementId: payment.id,
        fileName: receiptFile.name.replace(/[\\/]/g, '_').slice(0, 180),
        fileUrl: `/api/receipts/${receiptId}`,
        sha256,
        mimeType: receiptFile.type,
        fileData: bytes,
        uploadedById: actor.id
      } });
      await tx.systemNotification.create({ data: {
        employeeId: item.employeeId,
        kind: 'PAYROLL_PAYMENT_CONFIRMATION_REQUIRED',
        title: 'Confirm payroll payment received',
        body: `A payroll transfer for ${batch.period.year}-${String(batch.period.month).padStart(2, '0')} was recorded. Review the receipt and confirm whether the salary reached your account.`,
        linkUrl: '/payroll'
      } });
      await tx.auditEvent.create({ data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: batch.paymentEntityId!,
        targetType: 'DISBURSEMENT',
        targetId: payment.id,
        action: 'CREATED',
        correlationId: `CORR-PAYROLL-DISB-${payment.id}`,
        metadata: JSON.stringify({ batchId, payrollItemId, externalReference, bankName, amountMinor: item.netMinor.toString(), receiptHash: sha256 })
      } });
      return payment;
    });

    // Automatically trigger intercompany debit/credit note generation for cross-entity cost allocations
    let intercompanyNotesCreated = 0;
    try {
      const icResult = await generatePayrollIntercompanyNotes({
        payrollItemId: item.id,
        payingEntityId: batch.paymentEntityId!,
        periodId: batch.periodId,
        actor: { id: actor.id, legalName: actor.legalName, role: actor.role },
      });
      intercompanyNotesCreated = icResult.generatedCount;
    } catch (icErr) {
      console.error('Automated intercompany generation error:', icErr);
    }

    return NextResponse.json({
      success: true,
      paymentId: created.id,
      intercompanyNotesCreated,
      message: `Payment recorded. ${item.employee.legalName} has been asked to confirm receipt.${intercompanyNotesCreated > 0 ? ` Automatically generated ${intercompanyNotesCreated} intercompany recharge note(s).` : ''}`
    });
  } catch (error) {
    console.error('Payroll payment record error:', error);
    return NextResponse.json({ error: 'Could not record this payroll payment.' }, { status: 500 });
  }
}
