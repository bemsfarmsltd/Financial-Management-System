import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or System Admin can stage corporate treasury accounts.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { bank_name, account_number, account_name, balance, subsidiary_id, subsidiary_name } = body;

    if (!bank_name || !account_number) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'bank_name and account_number are required.' }, { status: 400 });
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'treasury_account',
      materialPayload: {
        bank_name,
        account_number,
        account_name: account_name || 'BEMS Group Operations',
        balance: Number(balance) || 0,
        subsidiary_id: subsidiary_id || 'bems-group-hq',
        subsidiary_name: subsidiary_name || 'BEMS Group Holding HQ',
      },
      summary: `Register new corporate account: ${bank_name} (${account_number}) for ${subsidiary_name || 'BEMS Group'}`,
      preview: {
        bank_name,
        account_number,
        account_name: account_name || 'BEMS Group Operations',
        opening_balance: `₦${(Number(balance) || 0).toLocaleString()}`,
        assigned_subsidiary: subsidiary_name || 'BEMS Group Holding HQ',
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
