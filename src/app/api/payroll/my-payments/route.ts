import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
}

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to review your payroll payments.' }, { status: 401 });
  const payments = await prisma.disbursement.findMany({
    where: { beneficiaryEmployeeId: actor.id, payrollItemId: { not: null } },
    include: { receipt: { select: { fileName: true, fileUrl: true } }, recipientConfirmation: true, payrollItem: { include: { batch: { include: { period: true } } } } },
    orderBy: { paidAt: 'desc' },
  });
  return NextResponse.json({ payments: payments.map(payment => ({
    id: payment.id,
    amountFormatted: formatNaira(payment.amountMinor),
    bankName: payment.bankName,
    reference: payment.externalReference,
    paidAt: payment.paidAt,
    status: payment.status,
    receipt: payment.receipt ? { fileName: payment.receipt.fileName, url: payment.receipt.fileUrl } : null,
    confirmation: payment.recipientConfirmation ? { decision: payment.recipientConfirmation.decision, note: payment.recipientConfirmation.note, confirmedAt: payment.recipientConfirmation.confirmedAt } : null,
    periodName: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(payment.payrollItem!.batch.period.year, payment.payrollItem!.batch.period.month - 1, 1))} ${payment.payrollItem!.batch.period.year}`,
  })) });
}
