import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or System Admin can stage vendor approvals.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, category, tin, bank_name, account_number, contact_person, contact_phone } = body;

    if (!name) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'Vendor name is required.' }, { status: 400 });
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'vendor_approval',
      materialPayload: {
        name,
        category: category || 'General Supplies',
        tin: tin || 'PENDING_TIN',
        bank_name: bank_name || 'Commercial Bank',
        account_number: account_number || '0000000000',
        contact_person: contact_person || name,
        contact_phone: contact_phone || null,
      },
      summary: `Approve and register supplier: ${name} (${category || 'General Supplies'})`,
      preview: {
        vendor_name: name,
        category: category || 'General Supplies',
        tax_id_tin: tin || 'PENDING_VERIFICATION',
        disbursement_bank: `${bank_name || 'Bank'} · ${account_number || 'Account'}`,
        status: 'ACTIVE_APPROVED',
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
