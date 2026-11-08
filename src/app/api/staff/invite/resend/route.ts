import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Executive access required.' }, { status: 401 });
    const body = await request.json();
    const invitation = await executeDashboardCommand(actor, 'admin_onboarding', { sub_action: 'RESEND_INVITE', invitationId: body.id });
    return NextResponse.json({ success: true, invitation, emailSent: false, deliveryStatus: 'QUEUED' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
