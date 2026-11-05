import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractClientIp } from '@/lib/attendance/token';
import { getAuthenticatedEmployee, hasAnyRole, isHrAuthorizedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    const isHr = await isHrAuthorizedEmployee(user);
    const isExecutive = hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
    if (!user || (!isExecutive && !isHr)) {
      return NextResponse.json({ error: 'Unauthorized: Administrative access required' }, { status: 401 });
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
    const isHr = await isHrAuthorizedEmployee(user);
    const isExecutive = hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
    if (!user || (!isExecutive && !isHr)) {
      return NextResponse.json({ error: 'Unauthorized: Administrative access required' }, { status: 401 });
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
      toggleStarlink,
      toggleGeofence,
      radiusMeters,
    } = body;

    const org = await prisma.organization.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Quick Action 1: Instant 1-Click Starlink Wi-Fi Bypass Toggle
    if (toggleStarlink !== undefined || (requireStarlinkIp !== undefined && Object.keys(body).length <= 2)) {
      const current = await prisma.attendancePolicy.findFirst({
        where: { organizationId: org.id },
      });
      const newStarlinkState = requireStarlinkIp !== undefined
        ? Boolean(requireStarlinkIp)
        : !(current?.requireStarlinkIp ?? true);

      const updated = await prisma.attendancePolicy.upsert({
        where: { organizationId: org.id },
        update: {
          requireStarlinkIp: newStarlinkState,
          // When bypassing Starlink lock, ensure outage mode is also set so all gateways allow scans
          ...(newStarlinkState === false ? { starlinkPowerOutageMode: true } : { starlinkPowerOutageMode: false }),
        },
        create: {
          organizationId: org.id,
          requireStarlinkIp: newStarlinkState,
          starlinkPowerOutageMode: newStarlinkState === false,
        },
      });

      return NextResponse.json({
        success: true,
        requireStarlinkIp: updated.requireStarlinkIp,
        starlinkPowerOutageMode: updated.starlinkPowerOutageMode,
        message: updated.requireStarlinkIp
          ? '🟢 Strict Starlink Wi-Fi Network Lock ENFORCED.'
          : '⚡ Starlink Network Lock BYPASSED: Staff can now scan and clock in using any network / mobile data.',
        policy: updated,
      });
    }

    // Quick Action 2: 1-Click Power Outage Toggle
    if (togglePowerOutage) {
      const current = await prisma.attendancePolicy.findFirst({
        where: { organizationId: org.id },
      });
      const newOutageState = !(current?.starlinkPowerOutageMode ?? false);
      const updated = await prisma.attendancePolicy.upsert({
        where: { organizationId: org.id },
        update: {
          starlinkPowerOutageMode: newOutageState,
          // If turning outage mode on, also disable requireStarlinkIp to guarantee zero friction
          ...(newOutageState === true ? { requireStarlinkIp: false } : { requireStarlinkIp: true }),
        },
        create: {
          organizationId: org.id,
          starlinkPowerOutageMode: newOutageState,
          requireStarlinkIp: !newOutageState,
        },
      });

      return NextResponse.json({
        success: true,
        starlinkPowerOutageMode: updated.starlinkPowerOutageMode,
        requireStarlinkIp: updated.requireStarlinkIp,
        message: updated.starlinkPowerOutageMode
          ? '⚡ Power Outage Mode ACTIVATED: Starlink Wi-Fi requirement is disabled. Staff can clock in using any network connection.'
          : '🟢 Normal Starlink Wi-Fi Restored: Strict Starlink security is re-enforced.',
        policy: updated,
      });
    }

    // Quick Action 3: 1-Click GPS Geofence Bypass Toggle
    if (toggleGeofence !== undefined || (requireGeofence !== undefined && Object.keys(body).length <= 2)) {
      const current = await prisma.attendancePolicy.findFirst({
        where: { organizationId: org.id },
      });
      const newGeofenceState = requireGeofence !== undefined
        ? Boolean(requireGeofence)
        : !(current?.requireGeofence ?? true);

      const updated = await prisma.attendancePolicy.upsert({
        where: { organizationId: org.id },
        update: { requireGeofence: newGeofenceState },
        create: {
          organizationId: org.id,
          requireGeofence: newGeofenceState,
        },
      });

      return NextResponse.json({
        success: true,
        requireGeofence: updated.requireGeofence,
        message: updated.requireGeofence
          ? '📍 Strict GPS Geofencing ENFORCED.'
          : '🌐 GPS Geofence BYPASSED: Staff can scan from any location.',
        policy: updated,
      });
    }

    // Update station perimeter radius buffer if provided
    if (radiusMeters !== undefined && Number(radiusMeters) > 0) {
      await prisma.attendanceStation.updateMany({
        where: { organizationId: org.id },
        data: { radiusMeters: Number(radiusMeters) },
      });
    }

    // For changing payroll deduction percentages, enforce executive role
    if (!isExecutive && (latenessDeductionPercent !== undefined || absenceDeductionPercent !== undefined)) {
      return NextResponse.json(
        { error: 'Deduction rules and attendance policy percentages are strictly controlled by the GMD / Super Admin.' },
        { status: 403 }
      );
    }

    // Update all subsidiary attendance policies in conglomerate to keep policies synchronized
    await prisma.attendancePolicy.updateMany({
      data: {
        earliestCheckInTime: earliestCheckInTime || '07:00',
        resumptionTime: resumptionTime || '08:00',
        closingTime: closingTime || '17:00',
        gracePeriodMinutes: Number(gracePeriodMinutes ?? 15),
        ...(isExecutive && latenessDeductionPercent !== undefined ? { latenessDeductionPercent: Number(latenessDeductionPercent) } : {}),
        ...(isExecutive && absenceDeductionPercent !== undefined ? { absenceDeductionPercent: Number(absenceDeductionPercent) } : {}),
        requireGeofence: requireGeofence !== undefined ? Boolean(requireGeofence) : true,
        requireQrScan: requireQrScan !== undefined ? Boolean(requireQrScan) : true,
        requireStarlinkIp: requireStarlinkIp !== undefined ? Boolean(requireStarlinkIp) : true,
        starlinkIpAddresses: starlinkIpAddresses !== undefined ? String(starlinkIpAddresses).trim() : undefined,
        starlinkPowerOutageMode: starlinkPowerOutageMode !== undefined ? Boolean(starlinkPowerOutageMode) : undefined,
      },
    });

    const policy = await prisma.attendancePolicy.upsert({
      where: { organizationId: org.id },
      update: {
        earliestCheckInTime: earliestCheckInTime || '07:00',
        resumptionTime: resumptionTime || '08:00',
        closingTime: closingTime || '17:00',
        gracePeriodMinutes: Number(gracePeriodMinutes ?? 15),
        ...(isExecutive && latenessDeductionPercent !== undefined ? { latenessDeductionPercent: Number(latenessDeductionPercent) } : {}),
        ...(isExecutive && absenceDeductionPercent !== undefined ? { absenceDeductionPercent: Number(absenceDeductionPercent) } : {}),
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

    // Retroactively update today's non-overridden late records if lateness deduction percent changed
    if (latenessDeductionPercent !== undefined) {
      const { getLagosTime } = await import('@/lib/attendance/token');
      const { workDate: todayStr } = getLagosTime();
      await prisma.attendanceRecord.updateMany({
        where: {
          workDate: todayStr,
          status: 'LATE',
          isManualOverride: false,
        },
        data: {
          deductionPercent: Number(latenessDeductionPercent),
        },
      });
    }

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
