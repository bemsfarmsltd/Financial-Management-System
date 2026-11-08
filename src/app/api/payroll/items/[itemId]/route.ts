import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
export const dynamic = 'force-dynamic';
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to modify payroll.' }, { status: 401 });
    const { itemId } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await executeDashboardCommand(actor, 'payroll_action', { sub_action: 'REMOVE_ITEM', itemId, mode: body.mode, reason: body.reason });
    return NextResponse.json({ success: true, ...result, message: 'Payroll item removed; the batch requires fresh approval.' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
