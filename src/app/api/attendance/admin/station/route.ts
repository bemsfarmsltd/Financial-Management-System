import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, getHrAuthorizationScope, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { executeDashboardCommand } from '@/lib/staged-actions';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to view stations.' }, { status: 401 });
  const scope = await getHrAuthorizationScope(actor);
  if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']) && !scope.authorized) return NextResponse.json({ error: 'Administrative access required.' }, { status: 403 });
  const organizationId = new URL(request.url).searchParams.get('organizationId');
  const stations = await prisma.attendanceStation.findMany({ where: { status: 'ACTIVE', ...(scope.isGlobal ? {} : { organizationId: { in: scope.subsidiaryIds } }), ...(organizationId ? { AND: [{ organizationId }] } : {}) }, include: { organization: { select: { legalName: true } } } });
  return NextResponse.json({ station: stations.length === 1 ? stations[0] : null, stations, requiresSelection: stations.length > 1 });
}
export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to calibrate a station.' }, { status: 401 });
    const body = await request.json();
    const scope = await getHrAuthorizationScope(actor);
    let organizationId = body.organizationId;
    let stationId = body.stationId;
    if (!organizationId) {
      const stations = await prisma.attendanceStation.findMany({ where: { status: 'ACTIVE', ...(scope.isGlobal ? {} : { organizationId: { in: scope.subsidiaryIds } }) }, take: 2 });
      if (stations.length === 1) { organizationId = stations[0].organizationId; stationId ||= stations[0].id; }
      else if (stations.length === 0) { const groups = await prisma.organization.findMany({ where: { type: 'GROUP', status: 'ACTIVE' }, take: 2 }); if (scope.isGlobal && groups.length === 1) organizationId = groups[0].id; }
    }
    const station = await executeDashboardCommand(actor, 'attendance_override', { action_type: 'CALIBRATE_STATION', organizationId, stationId, name: body.name, latitude: body.latitude, longitude: body.longitude, radiusMeters: body.radiusMeters });
    return NextResponse.json({ success: true, station });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
