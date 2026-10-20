import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Not permitted.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const recordType = searchParams.get('record_type');
    const recordId = searchParams.get('record_id');
    const stagedActionId = searchParams.get('staged_action_id');

    let exists = false;
    let record: any = null;

    if (stagedActionId) {
      const action = await prisma.stagedAction.findUnique({ where: { id: stagedActionId } });
      if (action && action.status === 'EXECUTED') {
        exists = true;
        record = action.resultJson ? JSON.parse(action.resultJson) : { id: action.id, status: action.status };
      }
    } else if (recordType === 'fund_request' && recordId) {
      const item = await prisma.expenditureRequest.findFirst({
        where: { OR: [{ id: recordId }, { requestNumber: recordId }] },
      });
      if (item) {
        exists = true;
        record = JSON.parse(JSON.stringify(item, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
      }
    } else if (recordType === 'budget' && recordId) {
      const item = await prisma.budget.findUnique({ where: { id: recordId }, include: { lines: true } });
      if (item) {
        exists = true;
        record = JSON.parse(JSON.stringify(item, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
      }
    } else if (recordType === 'disbursement' && recordId) {
      const item = await prisma.disbursement.findUnique({ where: { id: recordId } });
      if (item) {
        exists = true;
        record = JSON.parse(JSON.stringify(item, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
      }
    }

    return NextResponse.json({
      ok: true,
      exists,
      record,
      notification_delivery_status: exists ? 'DELIVERED' : 'PENDING',
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
