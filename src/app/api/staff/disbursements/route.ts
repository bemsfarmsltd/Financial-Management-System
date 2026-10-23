import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number): string {
  const naira = Number(minor) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(naira);
}

export async function GET(request: Request) {
  try {
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
    if (!actor) {
      return NextResponse.json({ error: 'Sign in to view your disbursements.' }, { status: 401 });
    }

    const disbursements = await prisma.disbursement.findMany({
      where: {
        OR: [
          { beneficiaryEmployeeId: actor.id },
          { request: { requestedById: actor.id } },
        ],
      },
      include: {
        payerOrg: { select: { id: true, legalName: true, code: true } },
        recipientConfirmation: true,
        request: {
          select: {
            id: true,
            requestNumber: true,
            title: true,
            category: true,
            amountMinor: true,
            deliverable: true,
          },
        },
      },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });

    const safeDisbursements = disbursements.map((d) => ({
      id: d.id,
      amountMinor: Number(d.amountMinor),
      amountFormatted: formatNaira(d.amountMinor),
      bankName: d.bankName || d.beneficiaryBank,
      accountNumber: d.beneficiaryAccount,
      externalReference: d.externalReference,
      status: d.status,
      paidAt: d.paidAt.toISOString(),
      payerOrg: d.payerOrg,
      confirmed: !!d.recipientConfirmation,
      confirmationDecision: d.recipientConfirmation?.decision || null,
      request: d.request
        ? {
            id: d.request.id,
            requestNumber: d.request.requestNumber,
            title: d.request.title,
            category: d.request.category,
            amountMinor: Number(d.request.amountMinor),
            amountFormatted: formatNaira(d.request.amountMinor),
            deliverable: d.request.deliverable,
          }
        : null,
    }));

    const awaitingConfirmation = safeDisbursements.filter(
      (d) =>
        (d.status === 'AWAITING_RECIPIENT_CONFIRMATION' || d.status === 'PENDING_VERIFICATION') &&
        !d.confirmed
    );

    return NextResponse.json({
      awaitingConfirmation,
      recentDisbursements: safeDisbursements,
      summary: {
        awaitingCount: awaitingConfirmation.length,
        totalDisbursedMinor: safeDisbursements.reduce((acc, d) => acc + d.amountMinor, 0),
        totalDisbursedFormatted: formatNaira(
          safeDisbursements.reduce((acc, d) => acc + d.amountMinor, 0)
        ),
      },
    });
  } catch (error: any) {
    console.error('Error fetching staff disbursements:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch disbursements' }, { status: 500 });
  }
}
