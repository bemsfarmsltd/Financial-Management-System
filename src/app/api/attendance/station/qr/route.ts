import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateStationQrToken } from '@/lib/attendance/token';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stationCode = searchParams.get('stationCode');

    let station = null;
    if (stationCode) {
      station = await prisma.attendanceStation.findUnique({
        where: { code: stationCode },
        include: { organization: { select: { legalName: true } } },
      });
    }

    if (!station) {
      station = await prisma.attendanceStation.findFirst({
        where: { status: 'ACTIVE' },
        include: { organization: { select: { legalName: true } } },
      });
    }

    if (!station) {
      return NextResponse.json({ error: 'No active attendance station configured' }, { status: 404 });
    }

    const { token, expiresInSeconds } = generateStationQrToken(station.code, station.activeSecret);

    const policy = await prisma.attendancePolicy.findFirst({
      where: { organizationId: station.organizationId },
    }) || await prisma.attendancePolicy.findFirst();

    return NextResponse.json({
      stationCode: station.code,
      stationName: station.name,
      organizationName: station.organization.legalName,
      latitude: station.latitude,
      longitude: station.longitude,
      radiusMeters: station.radiusMeters,
      qrToken: token,
      expiresInSeconds,
      powerOutageMode: policy?.starlinkPowerOutageMode ?? false,
      requireStarlinkIp: policy?.requireStarlinkIp ?? true,
      earliestCheckInTime: policy?.earliestCheckInTime || '07:00',
      resumptionTime: policy?.resumptionTime || '08:00',
      gracePeriodMinutes: policy?.gracePeriodMinutes || 15,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating station QR token:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
