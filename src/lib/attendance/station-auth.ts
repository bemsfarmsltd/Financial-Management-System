import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export async function getAuthenticatedStation(request: Request) {
  const url = new URL(request.url);
  const code = request.headers.get('x-station-code') || url.searchParams.get('stationCode');
  const secret = request.headers.get('x-station-secret');
  const actor = await getAuthenticatedEmployee(request, { disallowServiceToken: true });
  const executive = hasAnyRole(actor, ['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN']);
  if (!executive && (!code || !secret)) return null;
  const station = await prisma.attendanceStation.findFirst({
    where: { status: 'ACTIVE', ...(code ? { code } : {}) },
    include: { organization: { select: { legalName: true } } },
  });
  if (!station) return null;
  if (!executive) {
    const expected = Buffer.from(station.activeSecret);
    const supplied = Buffer.from(secret!);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  }
  return station;
}
