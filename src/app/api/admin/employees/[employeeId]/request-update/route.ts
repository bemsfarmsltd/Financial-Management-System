import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage staff.' }, { status: 401 });
    const { employeeId } = await params;
    const body = await request.json().catch(() => ({}));

    const result = await executeDashboardCommand(actor, 'staff_management', { sub_action: 'REQUEST_UPDATE', employeeId, requestedFields: body.requestedFields, instructions: body.instructions });
    return NextResponse.json({ success: true, employee: result, request: result, message: result.message || 'Staff change recorded.' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
