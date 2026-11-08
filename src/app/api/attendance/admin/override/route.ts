import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to override attendance.' }, { status: 401 });
    const body = await request.json();
    if (String(body.reason || '').trim().length < 5) return NextResponse.json({ error: 'Explain the attendance change.' }, { status: 400 });
    const record = await executeDashboardCommand(actor, 'attendance_override', { action_type: 'EXCUSE_OVERRIDE', employee_id: body.employeeId, work_date: body.workDate, override_status: body.status || 'PRESENT', reason: body.reason, deduction_percent: body.deductionPercent });
    return NextResponse.json({ success: true, record });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
