import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD', 'HR_ADMIN'])) {
      return NextResponse.json({ error: 'HR Admin or Executive access required.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
    const clearingBankName = typeof body.clearingBankName === 'string' ? body.clearingBankName.trim() : '';
    const clearingAccountNumber = typeof body.clearingAccountNumber === 'string' ? body.clearingAccountNumber.trim() : '';
    const clearingAccountName = typeof body.clearingAccountName === 'string' ? body.clearingAccountName.trim() : '';
    const submissionNote = typeof body.submissionNote === 'string' ? body.submissionNote.trim() : '';

    if (!batchId) {
      return NextResponse.json({ error: 'Payroll batch ID is required.' }, { status: 400 });
    }
    if (!clearingBankName || !clearingAccountNumber || !clearingAccountName) {
      return NextResponse.json(
        { error: 'Please provide the Bank Name, 10-Digit Account Number, and Account Holder Name for the single bulk disbursement account.' },
        { status: 400 }
      );
    }

    const batch = await prisma.payrollBatch.findUnique({
      where: { id: batchId },
      include: { period: true },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Payroll batch not found.' }, { status: 404 });
    }

    const updated = await prisma.payrollBatch.update({
      where: { id: batch.id },
      data: {
        clearingBankName,
        clearingAccountNumber,
        clearingAccountName,
        submittedById: actor.id,
        submittedByName: actor.legalName,
        submissionNote: submissionNote || null,
        disbursementAssigneeId: batch.disbursementAssigneeId || actor.id,
      },
    });

    const executives = await prisma.employee.findMany({
      where: { role: { in: ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
      select: { id: true },
    });

    const periodLabel = `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(batch.period.year, batch.period.month - 1, 1))} ${batch.period.year}`;

    for (const exec of executives) {
      if (exec.id === actor.id) continue;
      await prisma.systemNotification.create({
        data: {
          employeeId: exec.id,
          kind: 'PAYROLL_BATCH_SUBMITTED',
          title: `Payroll Batch & Disbursement Account Submitted (${periodLabel})`,
          body: `${actor.legalName} submitted the ${periodLabel} payroll batch (${formatNaira(batch.totalNetMinor)} net) with designated bulk clearing account: ${clearingBankName} · ${clearingAccountNumber} (${clearingAccountName}).`,
          linkUrl: '/finance?tab=Hybrid+payroll',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Single bulk disbursement account (${clearingBankName} · ${clearingAccountNumber}) saved and submitted to the GMD for lump-sum funding.`,
      batch: {
        id: updated.id,
        clearingBankName: updated.clearingBankName,
        clearingAccountNumber: updated.clearingAccountNumber,
        clearingAccountName: updated.clearingAccountName,
        submittedByName: updated.submittedByName,
        submissionNote: updated.submissionNote,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/payroll/clearing-account:', error);
    return NextResponse.json({ error: error.message || 'Could not save clearing account.' }, { status: 500 });
  }
}

