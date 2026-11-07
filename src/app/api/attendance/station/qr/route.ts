import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateStationQrToken } from '@/lib/attendance/token';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`station-qr:${clientIp}`, {
      maxAttempts: 60,
      windowMs: 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many station QR refresh requests. Please wait before retrying.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stationCode = searchParams.get('stationCode')?.trim();
    const providedSecret =
      request.headers.get('x-station-secret')?.trim() ||
      searchParams.get('stationSecret')?.trim();

    let station = null;
    if (stationCode) {
      station = await prisma.attendanceStation.findFirst({
        where: { code: stationCode, status: 'ACTIVE' },
        include: { organization: { select: { legalName: true } } },
      });
      if (!station) {
        return NextResponse.json(
          { error: `Active attendance station "${stationCode}" not found.` },
          { status: 404 }
        );
      }
    } else {
      station = await prisma.attendanceStation.findFirst({
        where: { status: 'ACTIVE' },
        include: { organization: { select: { legalName: true } } },
      });
    }

    if (!station) {
      return NextResponse.json({ error: 'No active attendance station configured' }, { status: 404 });
    }

    if (providedSecret && providedSecret !== station.activeSecret) {
      return NextResponse.json({ error: 'Invalid attendance station secret.' }, { status: 403 });
    }

    const { token, expiresInSeconds } = generateStationQrToken(station.code, station.activeSecret);

    const policy = await prisma.attendancePolicy.findFirst({
      where: { organizationId: station.organizationId },
    }) || await prisma.attendancePolicy.findFirst();

    // Pre-generate both DataURL and vector SVG on the server
    const [qrDataUrl, qrSvg] = await Promise.all([
      QRCode.toDataURL(token, {
        width: 360,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }),
      QRCode.toString(token, {
        type: 'svg',
        width: 360,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }),
    ]);

    return NextResponse.json({
      stationCode: station.code,
      stationName: station.name,
      organizationName: station.organization.legalName,
      latitude: station.latitude,
      longitude: station.longitude,
      radiusMeters: station.radiusMeters,
      qrToken: token,
      qrDataUrl,
      qrSvg,
      expiresInSeconds,
      powerOutageMode: policy?.starlinkPowerOutageMode ?? false,
      requireStarlinkIp: policy?.requireStarlinkIp ?? true,
      requireGeofence: policy?.requireGeofence ?? true,
      earliestCheckInTime: policy?.earliestCheckInTime || '07:00',
      resumptionTime: policy?.resumptionTime || '08:00',
      gracePeriodMinutes: policy?.gracePeriodMinutes || 15,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    });
  } catch (error: any) {
    console.error('Error generating station QR token:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
