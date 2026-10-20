import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only authorized executives can stage payment recordings.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { request_id, amount, currency, payer_account_id, beneficiary_name, beneficiary_bank, beneficiary_account, transfer_reference, payment_date } = body;

    if (!request_id || !amount || !transfer_reference) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'request_id, amount, and transfer_reference are mandatory.' }, { status: 400 });
    }

    const reqItem = await prisma.expenditureRequest.findFirst({
      where: { OR: [{ id: request_id }, { requestNumber: request_id }] },
      include: { disbursements: true, organization: true },
    });

    if (!reqItem) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Fund request ${request_id} not found.` }, { status: 404 });
    }

    if (reqItem.approvalStatus !== 'APPROVED') {
      return NextResponse.json({
        ok: false,
        error_code: 'POLICY_BLOCKED',
        message: `Request ${reqItem.requestNumber} is in status ${reqItem.approvalStatus}. Only APPROVED requests can be recorded as paid.`,
      }, { status: 400 });
    }

    if (reqItem.disbursements.length > 0) {
      return NextResponse.json({
        ok: false,
        error_code: 'DUPLICATE',
        message: `A disbursement record has already been committed for request ${reqItem.requestNumber}.`,
      }, { status: 400 });
    }

    const materialPayload = {
      request_id: reqItem.id,
      request_number: reqItem.requestNumber,
      amount: Number(amount),
      currency: currency || reqItem.currency || 'NGN',
      payer_account_id: payer_account_id || 'DEFAULT_CORP',
      beneficiary_name: beneficiary_name || 'Designated Beneficiary',
      beneficiary_bank: beneficiary_bank || 'Commercial Bank',
      beneficiary_account: beneficiary_account || 'N/A',
      transfer_reference,
      payment_date: payment_date || new Date().toISOString(),
    };

    const summary = `Record external bank payout of ₦${Number(amount).toLocaleString()} for ${reqItem.requestNumber} (Ref: ${transfer_reference})`;

    const preview = {
      request_number: reqItem.requestNumber,
      title: reqItem.title,
      amount: `₦${Number(amount).toLocaleString()}`,
      currency: currency || reqItem.currency || 'NGN',
      transfer_reference,
      beneficiary: beneficiary_name ? `${beneficiary_name} (${beneficiary_bank} · ${beneficiary_account})` : 'Vendor Account',
      payment_date: payment_date || new Date().toLocaleDateString(),
    };

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'payment_record',
      materialPayload,
      summary,
      preview,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
