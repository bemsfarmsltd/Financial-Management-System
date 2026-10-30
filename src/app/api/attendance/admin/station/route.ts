import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let station = await prisma.attendanceStation.findFirst({
      where: { status: 'ACTIVE' },
      include: { organization: { select: { legalName: true } } },
    });

    if (!station) {
      const org = await prisma.organization.findFirst();
      if (!org) {
        return NextResponse.json({ error: 'No organization found' }, { status: 404 });
      }

      station = await prisma.attendanceStation.create({
        data: {
          organizationId: org.id,
          name: 'BEMS Group Corporate Headquarters',
          code: 'BEMS-HQ-MAIN',
          latitude: 6.4281,
          longitude: 3.4219,
          radiusMeters: 100,
          activeSecret: crypto.randomBytes(32).toString('hex'),
          status: 'ACTIVE',
        },
        include: { organization: { select: { legalName: true } } },
      });
    }

    return NextResponse.json({ station });
  } catch (error: any) {
    console.error('Error fetching company station:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, latitude, longitude, radiusMeters } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Latitude and Longitude are required for office location calibration' },
        { status: 400 }
      );
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    const radiusNum = parseInt(radiusMeters ?? 100, 10);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json({ error: 'Coordinates must be valid numbers' }, { status: 400 });
    }

    let station = await prisma.attendanceStation.findFirst({
      where: { status: 'ACTIVE' },
    });

    const org = await prisma.organization.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    if (!station) {
      station = await prisma.attendanceStation.create({
        data: {
          organizationId: org.id,
          name: name?.trim() || 'BEMS Group Corporate Headquarters',
          code: 'BEMS-HQ-MAIN',
          latitude: latNum,
          longitude: lngNum,
          radiusMeters: radiusNum > 0 ? radiusNum : 100,
          activeSecret: crypto.randomBytes(32).toString('hex'),
          status: 'ACTIVE',
        },
      });
    } else {
      station = await prisma.attendanceStation.update({
        where: { id: station.id },
        data: {
          name: name?.trim() || station.name,
          latitude: latNum,
          longitude: lngNum,
          radiusMeters: radiusNum > 0 ? radiusNum : station.radiusMeters,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Company office location successfully calibrated to [${latNum.toFixed(6)}, ${lngNum.toFixed(6)}] with a ${station.radiusMeters}m perimeter!`,
      station,
    });
  } catch (error: any) {
    console.error('Error updating company station coordinates:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
