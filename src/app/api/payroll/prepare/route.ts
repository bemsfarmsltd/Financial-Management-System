import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to prepare payroll.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const result = await executeDashboardCommand(actor, 'payroll_action', { sub_action: 'PREPARE', year: body.year, month: body.month, organization_id: body.organizationId || body.subsidiaryId });
    return NextResponse.json({ success: true, ...result, message: 'Payroll prepared for review.' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
