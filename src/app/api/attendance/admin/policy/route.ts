import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractClientIp } from '@/lib/attendance/token';
import { getAuthenticatedEmployee, getHrAuthorizationScope, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }
    const hrScope = await getHrAuthorizationScope(user);
    const isExecutive = hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
    if (!isExecutive && !hrScope.authorized) {
      return NextResponse.json({ error: 'Forbidden: Administrative access required' }, { status: 403 });
    }

    // Always prioritize the primary GROUP/Holding organization policy, or the most recently updated policy
    let policy = await prisma.attendancePolicy.findFirst({
      where: { organization: { type: 'GROUP' } },
    });
    if (!policy) {
      policy = await prisma.attendancePolicy.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!policy) {
      const org = (await prisma.organization.findFirst({
        where: { type: 'GROUP' },
      })) || (await prisma.organization.findFirst());

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
            requireGeofence: true,
            requireQrScan: true,
            requireStarlinkIp: true,
            starlinkIpAddresses: '',
            starlinkPowerOutageMode: false,
          },
        });
      }
    }

    const callerIp = extractClientIp(request);

    return NextResponse.json(
      { policy, callerIp },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    console.error('Error fetching attendance policy:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }
    const hrScope = await getHrAuthorizationScope(user);
    const isExecutive = hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
    if (!isExecutive && !hrScope.authorized) {
      return NextResponse.json({ error: 'Forbidden: Administrative access required' }, { status: 403 });
    }

    // Group-wide attendance policy mutations require either Executive or Group-level HR scope
    if (!isExecutive && !hrScope.isGlobal) {
      return NextResponse.json(
        { error: 'Forbidden: Group-wide attendance policy changes require Executive or Group HR authority.' },
        { status: 403 }
      );
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

    const allOrgs = await prisma.organization.findMany();
    if (allOrgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const holdingOrg = allOrgs.find((o) => o.type === 'GROUP') || allOrgs[0];

    // Quick Action 1: Instant 1-Click Starlink Wi-Fi Lock Toggle
    if (toggleStarlink !== undefined || (requireStarlinkIp !== undefined && Object.keys(body).length <= 2)) {
      const current =
        (await prisma.attendancePolicy.findFirst({
          where: { organization: { type: 'GROUP' } },
        })) || (await prisma.attendancePolicy.findFirst());

      const newStarlinkState =
        requireStarlinkIp !== undefined ? Boolean(requireStarlinkIp) : !(current?.requireStarlinkIp ?? true);

      // 1. Synchronize ALL existing policies in the conglomerate
      await prisma.attendancePolicy.updateMany({
        data: {
          requireStarlinkIp: newStarlinkState,
          starlinkPowerOutageMode: newStarlinkState === false,
        },
      });

      // 2. Ensure every organization has an AttendancePolicy row
      for (const o of allOrgs) {
        await prisma.attendancePolicy.upsert({
          where: { organizationId: o.id },
          update: {
            requireStarlinkIp: newStarlinkState,
            starlinkPowerOutageMode: newStarlinkState === false,
          },
          create: {
            organizationId: o.id,
            requireStarlinkIp: newStarlinkState,
            starlinkPowerOutageMode: newStarlinkState === false,
            requireGeofence: current?.requireGeofence ?? true,
          },
        });
      }

      const updated =
        (await prisma.attendancePolicy.findFirst({
          where: { organization: { type: 'GROUP' } },
        })) || (await prisma.attendancePolicy.findFirst());

      return NextResponse.json(
        {
          success: true,
          requireStarlinkIp: updated?.requireStarlinkIp ?? newStarlinkState,
          starlinkPowerOutageMode: updated?.starlinkPowerOutageMode ?? (newStarlinkState === false),
          message: newStarlinkState
            ? '🟢 Strict Starlink Wi-Fi Network Lock ENFORCED group-wide.'
            : '⚡ Starlink Network Lock BYPASSED group-wide: Staff can now scan and clock in using any network / mobile data.',
          policy: updated,
        },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      );
    }

    // Quick Action 2: 1-Click Power Outage Toggle
    if (togglePowerOutage) {
      const current =
        (await prisma.attendancePolicy.findFirst({
          where: { organization: { type: 'GROUP' } },
        })) || (await prisma.attendancePolicy.findFirst());

      const newOutageState = !(current?.starlinkPowerOutageMode ?? false);

      await prisma.attendancePolicy.updateMany({
        data: {
          starlinkPowerOutageMode: newOutageState,
          requireStarlinkIp: !newOutageState,
        },
      });

      for (const o of allOrgs) {
        await prisma.attendancePolicy.upsert({
          where: { organizationId: o.id },
          update: {
            starlinkPowerOutageMode: newOutageState,
            requireStarlinkIp: !newOutageState,
          },
          create: {
            organizationId: o.id,
            starlinkPowerOutageMode: newOutageState,
            requireStarlinkIp: !newOutageState,
            requireGeofence: current?.requireGeofence ?? true,
          },
        });
      }

      const updated =
        (await prisma.attendancePolicy.findFirst({
          where: { organization: { type: 'GROUP' } },
        })) || (await prisma.attendancePolicy.findFirst());

      return NextResponse.json(
        {
          success: true,
          starlinkPowerOutageMode: updated?.starlinkPowerOutageMode ?? newOutageState,
          requireStarlinkIp: updated?.requireStarlinkIp ?? !newOutageState,
          message: newOutageState
            ? '⚡ Power Outage Mode ACTIVATED: Starlink Wi-Fi requirement is disabled group-wide.'
            : '🟢 Normal Starlink Wi-Fi Restored: Strict Starlink security is re-enforced group-wide.',
          policy: updated,
        },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      );
    }

    // Quick Action 3: 1-Click GPS Geofence Bypass Toggle
    if (toggleGeofence !== undefined || (requireGeofence !== undefined && Object.keys(body).length <= 2)) {
      const current =
        (await prisma.attendancePolicy.findFirst({
          where: { organization: { type: 'GROUP' } },
        })) || (await prisma.attendancePolicy.findFirst());

      const newGeofenceState =
        requireGeofence !== undefined ? Boolean(requireGeofence) : !(current?.requireGeofence ?? true);

      await prisma.attendancePolicy.updateMany({
        data: {
          requireGeofence: newGeofenceState,
        },
      });

      for (const o of allOrgs) {
        await prisma.attendancePolicy.upsert({
          where: { organizationId: o.id },
          update: {
            requireGeofence: newGeofenceState,
          },
          create: {
            organizationId: o.id,
            requireGeofence: newGeofenceState,
            requireStarlinkIp: current?.requireStarlinkIp ?? true,
            starlinkPowerOutageMode: current?.starlinkPowerOutageMode ?? false,
          },
        });
      }

      const updated =
        (await prisma.attendancePolicy.findFirst({
          where: { organization: { type: 'GROUP' } },
        })) || (await prisma.attendancePolicy.findFirst());

      return NextResponse.json(
        {
          success: true,
          requireGeofence: updated?.requireGeofence ?? newGeofenceState,
          message: newGeofenceState
            ? '📍 Strict GPS Geofencing ENFORCED group-wide.'
            : '🌐 GPS Geofence BYPASSED group-wide: Staff can scan from any location.',
          policy: updated,
        },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      );
    }

    // Update station perimeter radius buffer if provided
    if (radiusMeters !== undefined && Number(radiusMeters) > 0) {
      await prisma.attendanceStation.updateMany({
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

    // Full form update: Update ALL subsidiary attendance policies in conglomerate to keep policies synchronized
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

    for (const o of allOrgs) {
      await prisma.attendancePolicy.upsert({
        where: { organizationId: o.id },
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
          organizationId: o.id,
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
    }

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

    const policy =
      (await prisma.attendancePolicy.findFirst({
        where: { organization: { type: 'GROUP' } },
      })) || (await prisma.attendancePolicy.findFirst());

    return NextResponse.json(
      {
        success: true,
        message: 'Attendance policy, Starlink Wi-Fi parameters, and shift windows updated successfully group-wide.',
        policy,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    console.error('Error updating attendance policy:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
