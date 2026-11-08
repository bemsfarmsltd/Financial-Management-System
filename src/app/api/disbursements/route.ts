import { recordTransfer } from '@/lib/services/payment';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requestIdentifierWhere, toSystemRequestId } from '@/lib/request-id';
import crypto from 'crypto';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number): string {
  const naira = Number(minor) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(naira);
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view disbursements.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive or Super admin access is required.' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const subsidiary = searchParams.get('subsidiary') || 'ALL';

    const scopedOrgIds = await resolveOrganizationScope(subsidiary);
    const orgFilter = !scopedOrgIds.isGroup && scopedOrgIds.organizationIds.length > 0 ? { subsidiaryId: { in: scopedOrgIds.organizationIds } } : {};
    const payerOrgFilter = !scopedOrgIds.isGroup && scopedOrgIds.organizationIds.length > 0 ? { payerOrgId: { in: scopedOrgIds.organizationIds } } : {};

    // 1. Ready for Transfer (Approved, UNPAID)
    const approvedRequests = await prisma.expenditureRequest.findMany({
      where: {
        approvalStatus: 'APPROVED',
        paymentStatus: { in: ['UNPAID', 'RECIPIENT_REPORTED_ISSUE'] },
        ...orgFilter
      },
      include: {
        subsidiary: { select: { id: true, legalName: true, code: true } },
        requester: { select: { id: true, legalName: true, workEmail: true, role: true, employeeNumber: true, bankName: true, accountNumber: true, accountName: true, salaryBankName: true, salaryAccountNumber: true, salaryAccountName: true } },
        disbursementAssignee: { select: { id: true, legalName: true, role: true } },
        vendor: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Payments awaiting confirmation from the requesting staff member.
    const awaitingChecker = await prisma.disbursement.findMany({
      where: {
        status: { in: ['AWAITING_RECIPIENT_CONFIRMATION', 'RECIPIENT_REPORTED_ISSUE', 'PENDING_VERIFICATION'] },
        ...payerOrgFilter
      },
      include: {
        payerOrg: { select: { id: true, legalName: true, code: true } },
        recordedBy: { select: { id: true, legalName: true, workEmail: true } },
        receipt: { select: { id: true, fileName: true, fileUrl: true, sha256: true, mimeType: true, uploadedAt: true } },
        recipientConfirmation: { include: { employee: { select: { id: true, legalName: true } } } },
        request: {
          include: {
            requester: { select: { id: true, legalName: true, role: true } },
            vendor: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Payments whose receipt has been confirmed by the requesting staff member.
    const verifiedDisbursements = await prisma.disbursement.findMany({
      where: {
        status: 'RECIPIENT_CONFIRMED',
        ...(subsidiary !== 'ALL' ? { payerOrgId: subsidiary } : {})
      },
      include: {
        payerOrg: { select: { id: true, legalName: true, code: true } },
        recordedBy: { select: { id: true, legalName: true } },
        receipt: { select: { id: true, fileName: true, fileUrl: true, sha256: true, mimeType: true, uploadedAt: true } },
        recipientConfirmation: { include: { employee: { select: { id: true, legalName: true, role: true } } } },
        request: {
          include: {
            requester: { select: { id: true, legalName: true } },
            vendor: true
          }
        }
      },
      orderBy: { paidAt: 'desc' }
    });

    const pendingPayoutTotal = approvedRequests.reduce((acc, r) => acc + Number(r.amountMinor), 0);
    const awaitingCheckerTotal = awaitingChecker.reduce((acc, d) => acc + Number(d.amountMinor), 0);
    const totalDisbursed = verifiedDisbursements.reduce((acc, d) => acc + Number(d.amountMinor), 0);

    const safeApproved = approvedRequests.map(r => ({
      ...r,
      amount: Number(r.amountMinor) / 100,
      amountNaira: Number(r.amountMinor) / 100,
      amountMinor: Number(r.amountMinor),
      amountFormatted: formatNaira(r.amountMinor),
      canRecord: !r.disbursementAssigneeId || r.disbursementAssigneeId === actor.id || actor.role === 'SYSTEM_ADMIN'
    }));

    const safeAwaiting = awaitingChecker.map(d => ({
      ...d,
      amount: Number(d.amountMinor) / 100,
      amountNaira: Number(d.amountMinor) / 100,
      amountMinor: Number(d.amountMinor),
      amountFormatted: formatNaira(d.amountMinor),
      request: d.request ? {
        ...d.request,
        amount: Number(d.request.amountMinor) / 100,
        amountNaira: Number(d.request.amountMinor) / 100,
        systemId: toSystemRequestId(d.request.id),
        amountMinor: Number(d.request.amountMinor),
        amountFormatted: formatNaira(d.request.amountMinor)
      } : null
    }));

    const safeVerified = verifiedDisbursements.map(d => ({
      ...d,
      amount: Number(d.amountMinor) / 100,
      amountNaira: Number(d.amountMinor) / 100,
      amountMinor: Number(d.amountMinor),
      amountFormatted: formatNaira(d.amountMinor),
      request: d.request ? {
        ...d.request,
        amount: Number(d.request.amountMinor) / 100,
        amountNaira: Number(d.request.amountMinor) / 100,
        systemId: toSystemRequestId(d.request.id),
        amountMinor: Number(d.request.amountMinor),
        amountFormatted: formatNaira(d.request.amountMinor)
      } : null
    }));

    const response = NextResponse.json({
      readyForTransfer: safeApproved,
      awaitingChecker: safeAwaiting,
      verifiedDisbursements: safeVerified,
      summary: {
        pendingPayoutTotalFormatted: formatNaira(pendingPayoutTotal),
        awaitingCheckerTotalFormatted: formatNaira(awaitingCheckerTotal),
        totalDisbursedFormatted: formatNaira(totalDisbursed),
        pendingCount: approvedRequests.length,
        awaitingCount: awaitingChecker.length,
        verifiedCount: verifiedDisbursements.length
      }
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
  } catch (error: any) {
    console.error('Error fetching disbursements:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch disbursements' }, { status: 500 });
  }
}

// Finance/GMD/System Admin records an off-platform bank transfer and notifies its requester.
export async function POST(req: NextRequest) {
  const actor = await getAuthenticatedEmployee(req, { disallowServiceToken: true });
  if (!actor) return NextResponse.json({ error: 'Sign in to record payment.' }, { status: 401 });
  if (!hasAnyRole(actor, ['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'])) return NextResponse.json({ error: 'Executive access required.' }, { status: 403 });
  try {
    const body = await req.formData();
    const receipt = body.get('receipt');
    if (!(receipt instanceof File)) return NextResponse.json({ error: 'Upload the actual bank receipt.' }, { status: 400 });
    const amount = String(body.get('amountMinor') || '');
    if (!/^\d+$/.test(amount)) return NextResponse.json({ error: 'A positive amount in kobo is required.' }, { status: 400 });
    const reference = String(body.get('externalReference') || '').trim();
    const receiptBytes = Buffer.from(await receipt.arrayBuffer());
    const payment = await prisma.$transaction(tx => recordTransfer(tx, {
      actor, requestId: String(body.get('requestId') || ''), payerOrgId: String(body.get('payerOrgId') || ''),
      payerAccountId: String(body.get('payerAccountId') || '') || undefined, bankName: String(body.get('bankName') || ''),
      amountMinor: BigInt(amount), reference, beneficiaryName: String(body.get('beneficiaryName') || ''),
      beneficiaryBank: String(body.get('beneficiaryBank') || ''), beneficiaryAccount: String(body.get('beneficiaryAccount') || ''),
      receipt: { name: receipt.name, type: receipt.type, bytes: receiptBytes },
      idempotencyKey: 'TRANSFER-' + reference,
    }));
    return NextResponse.json({ success: true, disbursement: { ...payment, amountMinor: payment.amountMinor.toString() } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment could not be recorded.' }, { status: 409 });
  }
}

export async function PATCH() {
  return NextResponse.json({ error: 'The recipient must confirm receipt.' }, { status: 410 });
}
