import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, getHrAuthorizationScope, hasAnyRole } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limiter';
import { executeDashboardCommand } from '@/lib/staged-actions';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to view attendance policy.' }, { status: 401 });
  const scope = await getHrAuthorizationScope(actor);
  if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']) && !scope.authorized) return NextResponse.json({ error: 'Administrative access required.' }, { status: 403 });
  const requested = new URL(request.url).searchParams.get('organizationId');
  if (requested && !scope.isGlobal && !scope.subsidiaryIds.includes(requested)) return NextResponse.json({ error: 'Forbidden workspace.' }, { status: 403 });
  const group = scope.isGlobal && !requested ? await prisma.organization.findFirst({ where: { type: 'GROUP', status: 'ACTIVE' }, select: { id: true } }) : null;
  const organizationId = requested || group?.id || (scope.subsidiaryIds.length === 1 ? scope.subsidiaryIds[0] : null);
  const policy = organizationId ? await prisma.attendancePolicy.findUnique({ where: { organizationId } }) : null;
  return NextResponse.json({ policy, configured: Boolean(policy), callerIp: getClientIp(request) });
}
export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to configure attendance.' }, { status: 401 });
    const body = await request.json();
    const action_type = body.toggleStarlink !== undefined ? 'TOGGLE_STARLINK_LOCK' : body.toggleGeofence !== undefined ? 'TOGGLE_GEOFENCE_LOCK' : body.togglePowerOutage !== undefined ? 'TOGGLE_POWER_OUTAGE' : 'UPDATE_POLICY';
    const organizationId = typeof body.organizationId === 'string' && body.organizationId.trim() ? body.organizationId.trim() : undefined;
    let resolvedScope = body.scope;
    if (!resolvedScope) {
      if (!organizationId) {
        resolvedScope = 'GROUP';
      } else {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { type: true },
        });
        resolvedScope = org?.type === 'GROUP' ? 'GROUP' : 'ENTITY';
      }
    }
    const result = await executeDashboardCommand(actor, 'attendance_override', { ...body, action_type, scope: resolvedScope });
    return NextResponse.json({ success: true, policy: result });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
