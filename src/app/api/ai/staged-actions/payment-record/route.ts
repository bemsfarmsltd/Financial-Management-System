import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

const INVALID_PLACEHOLDERS = new Set([
  '0000000000',
  'n/a',
  'na',
  'payee',
  'designated beneficiary',
  'commercial bank',
  'default_corp',
  'unknown',
  'none',
]);

function isPlaceholder(val: unknown): boolean {
  const s = String(val || '').trim().toLowerCase();
  return !s || INVALID_PLACEHOLDERS.has(s);
}

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (actor && actor.role !== 'GMD') return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access is exclusively for the GMD.'},{status:403});
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only authorized executives can stage payment recordings.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const subAction = String(body.action || body.sub_action || 'RECORD_PAYMENT').toUpperCase().trim();
    const request_id = body.request_id || body.requestId || body.request_number;
    const disbursement_id = body.disbursement_id || body.disbursementId;

    // Support staging retry/issue resolution for a disbursement in RECIPIENT_REPORTED_ISSUE
    if (subAction === 'RESOLVE_PAYMENT_ISSUE' || subAction === 'RESOLVE_ISSUE' || subAction === 'RETRY_ISSUE_RESOLUTION') {
      const targetDisb = disbursement_id
        ? await prisma.disbursement.findUnique({
            where: { id: String(disbursement_id) },
            include: { request: true },
          })
        : request_id
        ? await prisma.disbursement.findFirst({
            where: {
              request: { OR: [{ id: String(request_id) }, { requestNumber: String(request_id) }] },
              status: 'RECIPIENT_REPORTED_ISSUE',
            },
            include: { request: true },
          })
        : null;

      if (!targetDisb) {
        return NextResponse.json(
          { ok: false, error_code: 'NOT_FOUND', message: 'Disbursement with reported issue not found.' },
          { status: 404 }
        );
      }

      const resolutionNote = String(body.note || body.reason || 'Bank transfer verified and reconciled; ready for recipient re-confirmation.').trim();
      const reqNum = targetDisb.request?.requestNumber || targetDisb.id;

      const stagedResolve = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'payment_record',
        targetSubsidiaryId: targetDisb.request?.subsidiaryId || targetDisb.payerOrgId,
        summary: `Resolve Reported Payment Issue for ${reqNum} (Ref: ${targetDisb.externalReference}) and Request Recipient Re-confirmation`,
        materialPayload: {
          sub_action: 'RESOLVE_PAYMENT_ISSUE',
          request_id: targetDisb.requestId || targetDisb.id,
          disbursement_id: targetDisb.id,
          amount: Number(targetDisb.amountMinor) / 100,
          payer_account_id: targetDisb.payerOrgId,
          transfer_reference: targetDisb.externalReference,
          resolution_note: resolutionNote,
        },
        preview: {
          operation: 'Resolve Reported Payment Issue',
          request_number: reqNum,
          disbursement_reference: targetDisb.externalReference,
          amount: `₦${(Number(targetDisb.amountMinor) / 100).toLocaleString()}`,
          resolution_note: resolutionNote,
          next_status: 'AWAITING_RECIPIENT_CONFIRMATION',
        },
      });

      return NextResponse.json(stagedResolve);
    }

    const amount = body.amount_paid !== undefined ? body.amount_paid : body.amount;
    const transfer_reference = String(body.reference || body.transfer_reference || body.externalReference || '').trim();
    const payer_account_id = body.bank_account_id || body.payer_account_id || body.payerAccountId;
    const payment_date = body.payment_date;
    const currency = body.currency;
    const attachmentIds: string[] = Array.isArray(body.attachment_ids || body.attachmentIds)
      ? body.attachment_ids || body.attachmentIds
      : body.attachment_id || body.attachmentId
      ? [String(body.attachment_id || body.attachmentId)]
      : [];

    if (!request_id || amount === undefined || !transfer_reference) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'request_id, amount (or amount_paid), and transfer_reference are mandatory.' },
        { status: 400 }
      );
    }

    const reqItem = await prisma.expenditureRequest.findFirst({
      where: { OR: [{ id: String(request_id) }, { requestNumber: String(request_id) }] },
      include: {
        disbursements: true,
        subsidiary: true,
        vendor: true,
        requester: true,
      },
    });

    if (!reqItem) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Fund request ${request_id} not found.` }, { status: 404 });
    }

    if (reqItem.approvalStatus !== 'APPROVED') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'POLICY_BLOCKED',
          message: `Request ${reqItem.requestNumber} is in status ${reqItem.approvalStatus}. Only APPROVED requests can be recorded as paid.`,
        },
        { status: 409 }
      );
    }

    if (reqItem.disbursementAssigneeId && reqItem.disbursementAssigneeId !== actor.id && !['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'].includes(actor.role)) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_ASSIGNED_RECORDER', message: 'This disbursement is assigned to another executive.' },
        { status: 403 }
      );
    }

    if (
      reqItem.paymentStatus === 'RECIPIENT_CONFIRMED' ||
      reqItem.paymentStatus === 'AWAITING_RECIPIENT_CONFIRMATION' ||
      reqItem.disbursements.some((d) => ['AWAITING_RECIPIENT_CONFIRMATION', 'RECIPIENT_CONFIRMED'].includes(d.status))
    ) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'DUPLICATE',
          message: `A disbursement record is already active or confirmed for request ${reqItem.requestNumber}.`,
        },
        { status: 409 }
      );
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json({ ok: false, error_code: 'INVALID_AMOUNT', message: 'Payment amount must be a positive number.' }, { status: 400 });
    }
    const amountMinor = BigInt(Math.round(numAmount * 100));
    if (amountMinor > reqItem.amountMinor) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'EXCEEDS_APPROVED_AMOUNT',
          message: `Payment amount (₦${numAmount.toLocaleString()}) exceeds approved request amount (₦${(Number(reqItem.amountMinor) / 100).toLocaleString()}).`,
        },
        { status: 400 }
      );
    }

    const dupRef = await prisma.disbursement.findFirst({ where: { externalReference: transfer_reference } });
    if (dupRef) {
      return NextResponse.json(
        { ok: false, error_code: 'DUPLICATE_REFERENCE', message: `Bank transfer reference "${transfer_reference}" has already been recorded.` },
        { status: 409 }
      );
    }

    // Resolve and verify corporate payer bank account (CompanyBankAccount)
    let payerAccount = null;
    if (payer_account_id && !isPlaceholder(payer_account_id)) {
      const q = String(payer_account_id).trim();
      payerAccount = await prisma.companyBankAccount.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [
            { id: q },
            { accountNumber: q },
            { bankName: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
    } else {
      const orgAccounts = await prisma.companyBankAccount.findMany({
        where: { organizationId: reqItem.subsidiaryId, status: 'ACTIVE' },
      });
      if (orgAccounts.length === 1) {
        payerAccount = orgAccounts[0];
      }
    }

    if (!payerAccount) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'PAYER_ACCOUNT_REQUIRED',
          message: `An active corporate treasury account (payer_account_id) is required to record payment for ${reqItem.requestNumber}.`,
        },
        { status: 400 }
      );
    }

    // Resolve and verify beneficiary banking details from request vendor/requester or explicit input
    const resolvedBeneficiaryName = !isPlaceholder(body.payee_name || body.beneficiary_name)
      ? String(body.payee_name || body.beneficiary_name).trim()
      : reqItem.vendor?.accountName || reqItem.vendor?.name || reqItem.requester?.accountName || reqItem.requester?.salaryAccountName || reqItem.requester?.legalName || '';

    const resolvedBeneficiaryBank = !isPlaceholder(body.beneficiary_bank)
      ? String(body.beneficiary_bank).trim()
      : reqItem.vendor?.bankName || reqItem.requester?.bankName || reqItem.requester?.salaryBankName || '';

    const rawBeneficiaryAccount = !isPlaceholder(body.beneficiary_account)
      ? String(body.beneficiary_account).trim()
      : reqItem.vendor?.accountNumber || reqItem.requester?.accountNumber || reqItem.requester?.salaryAccountNumber || '';
    const resolvedBeneficiaryAccount = rawBeneficiaryAccount.replace(/\D/g, '');

    if (
      isPlaceholder(resolvedBeneficiaryName) ||
      isPlaceholder(resolvedBeneficiaryBank) ||
      resolvedBeneficiaryAccount.length !== 10 ||
      resolvedBeneficiaryAccount === '0000000000'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'BENEFICIARY_BANK_INCOMPLETE',
          message: `Verified 10-digit NUBAN beneficiary account details (name, bank, account number) are required before recording payment for ${reqItem.requestNumber}.`,
        },
        { status: 400 }
      );
    }

    const materialPayload = {
      request_id: reqItem.id,
      request_number: reqItem.requestNumber,
      amount: numAmount,
      amount_minor: Number(amountMinor),
      currency: currency || reqItem.currency || 'NGN',
      payer_account_id: payerAccount.id,
      payer_bank_name: payerAccount.bankName,
      payer_account_number: payerAccount.accountNumber,
      beneficiary_name: resolvedBeneficiaryName,
      beneficiary_bank: resolvedBeneficiaryBank,
      beneficiary_account: resolvedBeneficiaryAccount,
      transfer_reference,
      payment_date: payment_date || new Date().toISOString(),
      expected_version: reqItem.requestVersion,
    };

    const summary = `Record external bank payout of ₦${numAmount.toLocaleString()} for ${reqItem.requestNumber} from ${payerAccount.bankName} (${payerAccount.accountNumber}) (Ref: ${transfer_reference})`;

    const preview = {
      request_number: reqItem.requestNumber,
      title: reqItem.title,
      amount: `₦${numAmount.toLocaleString()}`,
      currency: currency || reqItem.currency || 'NGN',
      payer_account: `${payerAccount.bankName} · ${payerAccount.accountNumber}`,
      transfer_reference,
      beneficiary: `${resolvedBeneficiaryName} (${resolvedBeneficiaryBank} · ${resolvedBeneficiaryAccount})`,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
    };

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'payment_record',
      targetSubsidiaryId: reqItem.subsidiaryId,
      attachmentIds,
      materialPayload,
      summary,
      preview,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
