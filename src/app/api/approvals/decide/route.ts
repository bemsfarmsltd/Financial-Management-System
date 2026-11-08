import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee(request, { disallowServiceToken: true });
  if (!actor) return NextResponse.json({ error: 'Sign in to record a decision.' }, { status: 401 });
  try {
    const body = await request.json();
    const ids = Array.isArray(body.requestIds) ? body.requestIds : body.requestId ? [body.requestId] : [];
    if (!ids.length) return NextResponse.json({ error: 'Choose at least one request.' }, { status: 400 });
    const result = await executeDashboardCommand(actor, 'approval_decision', {
      request_id: ids[0], request_ids: ids, decision: body.decision, reason: String(body.note || '').trim(),
      disbursementAssigneeId: body.disbursementAssigneeId,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Decision failed.' }, { status: 409 });
  }
}
