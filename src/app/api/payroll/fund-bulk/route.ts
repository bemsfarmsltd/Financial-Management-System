import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only the GMD or Super Admin can approve and fund the bulk payroll clearing account.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
    const bulkFundingBankName = typeof body.bulkFundingBankName === 'string' ? body.bulkFundingBankName.trim() : '';
    const bulkFundingReference = typeof body.bulkFundingReference === 'string' ? body.bulkFundingReference.trim() : '';
    const bulkFundingReceiptUrl = typeof body.bulkFundingReceiptUrl === 'string' && body.bulkFundingReceiptUrl.trim() ? body.bulkFundingReceiptUrl.trim() : null;
    const customAmountNaira = Number(body.bulkFundedAmountNaira || 0);

    if (!batchId) {
      return NextResponse.json({ error: 'Payroll batch ID is required.' }, { status: 400 });
    }
    if (!bulkFundingBankName || !bulkFundingReference) {
      return NextResponse.json(
        { error: 'Please enter the Source Bank Name and Transfer Reference for the lump-sum transfer to HR.' },
        { status: 400 }
      );
    }

    const batch = await prisma.payrollBatch.findUnique({
      where: { id: batchId },
      include: {
        period: true,
        items: { include: { allocations: true } },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Payroll batch not found.' }, { status: 404 });
    }

    const defaultOrg = batch.paymentEntityId || (await prisma.organization.findFirst({ orderBy: { type: 'asc' } }))?.id || null;

    // Find HR Admin or submittedById to assign individual staff disbursements
    const hrAssignee = batch.submittedById
      ? await prisma.employee.findUnique({ where: { id: batch.submittedById }, select: { id: true, legalName: true } })
      : await prisma.employee.findFirst({ where: { role: 'HR_ADMIN', status: 'ACTIVE' }, select: { id: true, legalName: true } });

    const assigneeId = hrAssignee?.id || batch.disbursementAssigneeId || actor.id;
    const fundedMinor = customAmountNaira > 0 ? BigInt(Math.round(customAmountNaira * 100)) : batch.totalNetMinor;
    const now = new Date();

    const snapshot = JSON.stringify(
      batch.items.map((item) => ({
        employeeId: item.employeeId,
        grossMinor: item.grossMinor.toString(),
        deductionsMinor: item.employeeDeductionsMinor.toString(),
        netMinor: item.netMinor.toString(),
      }))
    );
    const snapshotHash = batch.snapshotHash || createHash('sha256').update(snapshot).digest('hex');

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.payrollBatch.update({
        where: { id: batch.id },
        data: {
          status: 'APPROVED',
          approvedAt: batch.approvedAt || now,
          snapshotHash,
          paymentEntityId: defaultOrg,
          disbursementAssigneeId: assigneeId,
          bulkFundedAt: now,
          bulkFundedAmountMinor: fundedMinor,
          bulkFundingBankName,
          bulkFundingReference,
          bulkFundingReceiptUrl,
        },
      });

      await tx.payrollPeriod.update({
        where: { id: batch.periodId },
        data: { lockStatus: 'LOCKED' },
      });

      if (assigneeId && assigneeId !== actor.id) {
        await tx.systemNotification.create({
          data: {
            employeeId: assigneeId,
            kind: 'PAYROLL_BULK_FUNDED',
            title: `Lump-Sum Payroll Funded (${formatNaira(fundedMinor)})`,
            body: `${actor.legalName} approved the payroll batch and transferred ${formatNaira(fundedMinor)} (Ref: ${bulkFundingReference}) to the designated clearing account (${batch.clearingBankName || 'Clearing Account'} · ${batch.clearingAccountNumber || ''}). Please disburse to individual staff and upload receipts.`,
            linkUrl: '/finance?tab=Hybrid+payroll',
          },
        });
      }

      return b;
    });

    return NextResponse.json({
      success: true,
      message: `Approved batch & recorded lump-sum transfer of ${formatNaira(fundedMinor)} (Ref: ${bulkFundingReference}) to ${batch.clearingAccountName || 'HR Clearing Account'}.`,
      batch: {
        id: updated.id,
        status: updated.status,
        bulkFundedAt: updated.bulkFundedAt,
        bulkFundedAmountMinor: Number(updated.bulkFundedAmountMinor || 0),
        bulkFundedFormatted: formatNaira(updated.bulkFundedAmountMinor || 0),
        bulkFundingBankName: updated.bulkFundingBankName,
        bulkFundingReference: updated.bulkFundingReference,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/payroll/fund-bulk:', error);
    return NextResponse.json({ error: error.message || 'Could not record bulk payroll funding.' }, { status: 500 });
  }
}

