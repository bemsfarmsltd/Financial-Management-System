import { getAuthenticatedStation } from '@/lib/attendance/station-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateStationQrToken } from '@/lib/attendance/token';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(`station-qr:${clientIp}`, {
      maxAttempts: 60,
      windowMs: 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many station QR refresh requests. Please wait before retrying.' },
        { status: 429 }
      );
    }

    const station = await getAuthenticatedStation(request);
    if (!station) return NextResponse.json({ error: 'No active office attendance station configured.' }, { status: 404 });

    const { token, expiresInSeconds } = generateStationQrToken(station.code, station.activeSecret);

    const policy = await prisma.attendancePolicy.findFirst({
      where: { organizationId: station.organizationId },
    });

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
      stationSecret: station.activeSecret,
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
