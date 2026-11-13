import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
import { dispatchNotificationBridge, resolveGmdNotificationTarget } from '@/lib/notifications/bridge';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to prepare payroll.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const result = await executeDashboardCommand(actor, 'payroll_action', { sub_action: 'PREPARE', year: body.year, month: body.month, organization_id: body.organizationId || body.subsidiaryId });
    resolveGmdNotificationTarget()
      .then((gmdTarget) => {
        if (!gmdTarget.phone) return;
        return dispatchNotificationBridge({
          channel: 'WHATSAPP',
          recipient: gmdTarget.phone,
          eventType: 'PAYROLL_SUBMITTED',
          title: `Payroll Batch Ready for GMD Sign-Off`,
          summary: `${actor.legalName} prepared the payroll batch (${body.month || ''}/${body.year || ''}) for GMD review and disbursement approval.`,
          correlationId: `payroll_prep_${Date.now()}`,
          metadata: {
            rawText: `💳 *BEMS Payroll Approval Needed*\nPrepared by: *${actor.legalName}*\nPeriod: *${body.month || 'Current'}/${body.year || ''}*\n\n🔗 Review & Approve: https://bemserp.work`,
          },
        });
      })
      .catch((err) => console.error('Failed to dispatch WhatsApp payroll alert:', err));
    return NextResponse.json({ success: true, ...result, message: 'Payroll prepared for review.' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
