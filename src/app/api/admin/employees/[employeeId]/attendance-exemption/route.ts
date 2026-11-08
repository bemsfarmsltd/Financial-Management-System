import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
export const dynamic = 'force-dynamic';
export async function PATCH(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage staff.' }, { status: 401 });
    const { employeeId } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.isAttendanceExempt !== 'boolean') return NextResponse.json({ error: 'Choose an explicit exemption value.' }, { status: 400 });
    const result = await executeDashboardCommand(actor, 'staff_management', { sub_action: 'TOGGLE_ATTENDANCE_EXEMPT', employeeId, isAttendanceExempt: body.isAttendanceExempt });
    return NextResponse.json({ success: true, employee: result, request: result, message: result.message || 'Staff change recorded.' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
