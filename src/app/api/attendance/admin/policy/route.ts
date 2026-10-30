import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractClientIp } from '@/lib/attendance/token';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user || !hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'HR', 'COO', 'FINANCE_CONTROLLER'])) {
      return NextResponse.json({ error: 'Unauthorized: Executive or HR access required' }, { status: 401 });
    }

    let policy = await prisma.attendancePolicy.findFirst();
    if (!policy) {
      const org = await prisma.organization.findFirst();
      if (org) {
        policy = await prisma.attendancePolicy.create({
          data: {
            organizationId: org.id,
            earliestCheckInTime: '07:00',
            resumptionTime: '08:00',
            closingTime: '17:00',
            gracePeriodMinutes: 15,
            latenessDeductionPercent: 5.0,
            absenceDeductionPercent: 100.0,
            requireStarlinkIp: true,
            starlinkIpAddresses: '',
            starlinkPowerOutageMode: false,
          },
        });
      }
    }

    const callerIp = extractClientIp(request);

    return NextResponse.json({ policy, callerIp });
  } catch (error: any) {
    console.error('Error fetching attendance policy:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user || !hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'HR', 'COO', 'FINANCE_CONTROLLER'])) {
      return NextResponse.json({ error: 'Unauthorized: Executive or HR access required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      earliestCheckInTime,
      resumptionTime,
      closingTime,
      gracePeriodMinutes,
      latenessDeductionPercent,
      absenceDeductionPercent,
      requireGeofence,
      requireQrScan,
      requireStarlinkIp,
      starlinkIpAddresses,
      starlinkPowerOutageMode,
      togglePowerOutage,
    } = body;

    const org = await prisma.organization.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Quick Action: 1-Click Power Outage Toggle
    if (togglePowerOutage) {
      const current = await prisma.attendancePolicy.findFirst({
        where: { organizationId: org.id },
      });
      const newOutageState = !(current?.starlinkPowerOutageMode ?? false);
      const updated = await prisma.attendancePolicy.upsert({
        where: { organizationId: org.id },
        update: { starlinkPowerOutageMode: newOutageState },
        create: {
          organizationId: org.id,
          starlinkPowerOutageMode: newOutageState,
        },
      });

      return NextResponse.json({
        success: true,
        starlinkPowerOutageMode: updated.starlinkPowerOutageMode,
        message: updated.starlinkPowerOutageMode
          ? '⚡ Power Outage Mode ACTIVATED: Starlink Wi-Fi verification is temporarily bypassed. Staff can clock in using GPS Location & Kiosk QR code.'
          : '🟢 Normal Power Restored: Strict 3-Way Starlink Wi-Fi verification is re-enforced.',
        policy: updated,
      });
    }

    const policy = await prisma.attendancePolicy.upsert({
      where: { organizationId: org.id },
      update: {
        earliestCheckInTime: earliestCheckInTime || '07:00',
        resumptionTime: resumptionTime || '08:00',
        closingTime: closingTime || '17:00',
        gracePeriodMinutes: Number(gracePeriodMinutes ?? 15),
        latenessDeductionPercent: Number(latenessDeductionPercent ?? 5.0),
        absenceDeductionPercent: Number(absenceDeductionPercent ?? 100.0),
        requireGeofence: requireGeofence !== undefined ? Boolean(requireGeofence) : true,
        requireQrScan: requireQrScan !== undefined ? Boolean(requireQrScan) : true,
        requireStarlinkIp: requireStarlinkIp !== undefined ? Boolean(requireStarlinkIp) : true,
        starlinkIpAddresses: starlinkIpAddresses !== undefined ? String(starlinkIpAddresses).trim() : undefined,
        starlinkPowerOutageMode: starlinkPowerOutageMode !== undefined ? Boolean(starlinkPowerOutageMode) : undefined,
      },
      create: {
        organizationId: org.id,
        earliestCheckInTime: earliestCheckInTime || '07:00',
        resumptionTime: resumptionTime || '08:00',
        closingTime: closingTime || '17:00',
        gracePeriodMinutes: Number(gracePeriodMinutes ?? 15),
        latenessDeductionPercent: Number(latenessDeductionPercent ?? 5.0),
        absenceDeductionPercent: Number(absenceDeductionPercent ?? 100.0),
        requireGeofence: requireGeofence !== undefined ? Boolean(requireGeofence) : true,
        requireQrScan: requireQrScan !== undefined ? Boolean(requireQrScan) : true,
        requireStarlinkIp: requireStarlinkIp !== undefined ? Boolean(requireStarlinkIp) : true,
        starlinkIpAddresses: starlinkIpAddresses ? String(starlinkIpAddresses).trim() : '',
        starlinkPowerOutageMode: starlinkPowerOutageMode ? Boolean(starlinkPowerOutageMode) : false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance policy, Starlink Wi-Fi parameters, and shift windows updated successfully.',
      policy,
    });
  } catch (error: any) {
    console.error('Error updating attendance policy:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
