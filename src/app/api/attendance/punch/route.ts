import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  calculateHaversineDistance,
  verifyStationQrToken,
  getLagosTime,
  serializeAttendanceRecord,
  extractClientIp,
  isStarlinkIpAllowed,
  validateCheckInTimeWindow,
} from '@/lib/attendance/token';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, qrToken, latitude, longitude, type = 'CHECK_IN' } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    if (!qrToken) {
      return NextResponse.json({ error: 'Office QR Code scan is required' }, { status: 400 });
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Device GPS coordinates are required' }, { status: 400 });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json({ error: 'Coordinates must be valid numbers' }, { status: 400 });
    }

    // 1. Verify Employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        assignments: {
          include: { subsidiary: true },
          take: 1,
        },
        workSchedule: true,
      },
    });

    if (!employee || employee.status === 'TERMINATED') {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
    }

    // 2. Parse and Validate Station & Dynamic QR Token
    const parts = qrToken.split(':');
    if (parts.length !== 4 || parts[0] !== 'BEMSQR') {
      return NextResponse.json(
        { error: 'Invalid QR code. Please scan the dynamic QR code displayed on the office kiosk screen.' },
        { status: 400 }
      );
    }

    const stationCode = parts[1];
    const station = await prisma.attendanceStation.findUnique({
      where: { code: stationCode },
    });

    if (!station || station.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Attendance station ${stationCode} is inactive or invalid` },
        { status: 400 }
      );
    }

    // 3. Dual-Factor Check 1: Geofence Verification
    const distanceMeters = calculateHaversineDistance(latNum, lngNum, station.latitude, station.longitude);
    if (distanceMeters > station.radiusMeters) {
      return NextResponse.json(
        {
          error: `Geofence check failed: You are ${distanceMeters}m away from ${station.name}. You must be physically within ${station.radiusMeters}m to clock in.`,
          distanceMeters,
          allowedRadiusMeters: station.radiusMeters,
        },
        { status: 403 }
      );
    }

    // 4. Dual-Factor Check 2: Dynamic QR Cryptographic HMAC & Timestamp Verification
    const isQrValid = verifyStationQrToken(qrToken, station.code, station.activeSecret);
    if (!isQrValid) {
      return NextResponse.json(
        {
          error: 'QR code expired or invalid. Please point your camera at the active office kiosk screen.',
        },
        { status: 400 }
      );
    }

    // 5. Time & Shift Evaluation (Africa/Lagos)
    const now = new Date();
    const { workDate, currentTimeStr, dayOfWeek, hours, minutes } = getLagosTime(now);

    // Get Organization Policy
    const orgId = employee.assignments[0]?.subsidiaryId;
    let policy = null;
    if (orgId) {
      policy = await prisma.attendancePolicy.findUnique({
        where: { organizationId: orgId },
      });
    }
    if (!policy) {
      policy = await prisma.attendancePolicy.findFirst();
    }

    const earliestCheckInTime = policy?.earliestCheckInTime || '07:00';
    const resumptionTime = policy?.resumptionTime || '08:00';
    const closingTime = policy?.closingTime || '17:00';
    const graceMinutes = policy?.gracePeriodMinutes ?? 15;
    const latenessDeductionPercent = policy?.latenessDeductionPercent ?? 5.0;
    const requireStarlink = policy?.requireStarlinkIp ?? true;
    const powerOutageMode = policy?.starlinkPowerOutageMode ?? false;
    const starlinkIps = policy?.starlinkIpAddresses ?? '';

    // Gate 1: Starlink Wi-Fi Connection (or Power Outage Bypassed)
    const clientIp = extractClientIp(request);
    const starlinkCheck = isStarlinkIpAllowed(
      clientIp,
      starlinkIps,
      powerOutageMode,
      requireStarlink
    );

    if (!starlinkCheck.allowed) {
      return NextResponse.json(
        { error: starlinkCheck.reason },
        { status: 403 }
      );
    }

    // Check Weekly Off-Days
    const schedule = employee.workSchedule;
    const offDayIndices = (schedule?.weeklyOffDays || '0,6')
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));
    const isTodayOffDay = offDayIndices.includes(dayOfWeek);

    // Existing record for today
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
    });

    const isCheckIn = type.toUpperCase() === 'CHECK_IN';

    if (isCheckIn) {
      // Gate 2: Morning Arrival Window Check (No check-in before 07:00 AM)
      const windowCheck = validateCheckInTimeWindow(currentTimeStr, earliestCheckInTime);
      if (!windowCheck.allowed) {
        return NextResponse.json(
          { error: windowCheck.reason },
          { status: 400 }
        );
      }

      // Calculate Lateness: 8:00 AM + 15 min grace = 8:15 AM
      const [rHour, rMin] = resumptionTime.split(':').map(Number);
      const graceThresholdMinutes = rHour * 60 + rMin + graceMinutes;
      const currentMinutes = hours * 60 + minutes;

      let status = 'PRESENT';
      let deductionPercent = 0.0;

      if (currentMinutes > graceThresholdMinutes) {
        status = 'LATE';
        deductionPercent = latenessDeductionPercent;
      }

      // Upsert record
      const record = await prisma.attendanceRecord.upsert({
        where: {
          employeeId_workDate: {
            employeeId: employee.id,
            workDate,
          },
        },
        update: {
          stationId: station.id,
          checkInTime: existing?.checkInTime || now,
          checkInLat: latNum,
          checkInLng: lngNum,
          checkInDistanceM: distanceMeters,
          clientIp,
          status: existing?.isManualOverride ? existing.status : status,
          deductionPercent: existing?.isManualOverride ? existing.deductionPercent : deductionPercent,
        },
        create: {
          employeeId: employee.id,
          stationId: station.id,
          workDate,
          checkInTime: now,
          checkInLat: latNum,
          checkInLng: lngNum,
          checkInDistanceM: distanceMeters,
          clientIp,
          status,
          deductionPercent,
        },
      });

      return NextResponse.json({
        success: true,
        type: 'CHECK_IN',
        employeeName: employee.legalName,
        employeeNumber: employee.employeeNumber,
        workDate,
        time: currentTimeStr,
        status: record.status,
        distanceMeters,
        stationName: station.name,
        deductionPercent: record.deductionPercent,
        message:
          record.status === 'LATE'
            ? `Checked in at ${currentTimeStr} (LATE - Resumption was ${resumptionTime} with ${graceMinutes}m grace). Flagged for ${deductionPercent}% lateness deduction.`
            : `Checked in successfully at ${currentTimeStr} (ON TIME). Have a productive workday!`,
        record: serializeAttendanceRecord(record),
      });
    } else {
      // CHECK OUT
      const [cHour, cMin] = closingTime.split(':').map(Number);
      const closingMinutes = cHour * 60 + cMin;
      const currentMinutes = hours * 60 + minutes;
      const isEarly = currentMinutes < closingMinutes;

      const record = await prisma.attendanceRecord.upsert({
        where: {
          employeeId_workDate: {
            employeeId: employee.id,
            workDate,
          },
        },
        update: {
          stationId: station.id,
          checkOutTime: now,
          checkOutLat: latNum,
          checkOutLng: lngNum,
          checkOutDistanceM: distanceMeters,
          clientIp,
        },
        create: {
          employeeId: employee.id,
          stationId: station.id,
          workDate,
          checkOutTime: now,
          checkOutLat: latNum,
          checkOutLng: lngNum,
          checkOutDistanceM: distanceMeters,
          clientIp,
          status: isEarly ? 'HALF_DAY' : 'PRESENT',
        },
      });

      return NextResponse.json({
        success: true,
        type: 'CHECK_OUT',
        employeeName: employee.legalName,
        employeeNumber: employee.employeeNumber,
        workDate,
        time: currentTimeStr,
        status: record.status,
        distanceMeters,
        stationName: station.name,
        message: isEarly
          ? `Checked out at ${currentTimeStr} (Closing time is ${closingTime}). Have a good evening!`
          : `Checked out successfully at ${currentTimeStr}. Workday completed!`,
        record: serializeAttendanceRecord(record),
      });
    }
  } catch (error: any) {
    console.error('Error recording attendance punch:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
