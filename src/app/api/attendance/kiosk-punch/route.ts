import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLagosTime, serializeAttendanceRecord } from '@/lib/attendance/token';
import { notifyGmdStaffClockIn } from '@/lib/notifications/attendance';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const staffIdentifier = typeof body.staffIdentifier === 'string' ? body.staffIdentifier.trim() : '';
    const kioskPin = typeof body.kioskPin === 'string' ? body.kioskPin.trim() : '';
    const action = body.action === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN';

    if (!staffIdentifier || !kioskPin) {
      return NextResponse.json(
        { error: 'Please enter both your Staff ID (or Name) and your 4-Digit Kiosk PIN.' },
        { status: 400 }
      );
    }

    const candidates = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        kioskPin,
      },
      select: {
        id: true,
        employeeNumber: true,
        legalName: true,
        workEmail: true,
        role: true,
        isOfflineStaff: true,
        kioskPin: true,
        assignments: {
          include: { subsidiary: true, department: true },
          take: 1,
        },
      },
    });

    const q = staffIdentifier.toLowerCase();
    const matched = candidates.find(
      (c) =>
        c.employeeNumber.toLowerCase() === q ||
        c.employeeNumber.toLowerCase().endsWith(q) ||
        c.legalName.toLowerCase().includes(q)
    );

    if (!matched) {
      return NextResponse.json(
        { error: 'Invalid Staff ID / Name or 4-Digit Kiosk PIN. Please verify with HR.' },
        { status: 401 }
      );
    }

    const now = new Date();
    const { workDate, currentTimeStr, hours, minutes } = getLagosTime(now);
    const minutesSinceMidnight = hours * 60 + minutes;

    const [station, policy] = await Promise.all([
      prisma.attendanceStation.findFirst({ where: { status: 'ACTIVE' } }),
      prisma.attendancePolicy.findFirst(),
    ]);

    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: matched.id,
          workDate,
        },
      },
    });

    if (action === 'CHECK_OUT') {
      if (!existing || !existing.checkInTime) {
        return NextResponse.json(
          { error: `${matched.legalName} has not checked in yet today (${workDate}).` },
          { status: 400 }
        );
      }

      const updated = await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          checkOutTime: now,
        },
      });

      return NextResponse.json({
        success: true,
        action: 'CHECK_OUT',
        employeeName: matched.legalName,
        employeeNumber: matched.employeeNumber,
        timeStr: currentTimeStr,
        message: `Goodbye ${matched.legalName}! Checked out at ${currentTimeStr}.`,
        record: serializeAttendanceRecord(updated),
      });
    }

    if (existing && existing.checkInTime) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        employeeName: matched.legalName,
        employeeNumber: matched.employeeNumber,
        timeStr: currentTimeStr,
        message: `${matched.legalName} (${matched.employeeNumber}) is already checked in for today (${workDate}).`,
        record: serializeAttendanceRecord(existing),
      });
    }

    const resumptionTime = policy?.resumptionTime || '08:00';
    const graceMinutes = policy?.gracePeriodMinutes ?? 15;
    const [rH, rM] = resumptionTime.split(':').map(Number);
    const cutoffMinutes = rH * 60 + rM + graceMinutes;

    const isLate = minutesSinceMidnight > cutoffMinutes;
    const status = isLate ? 'LATE' : 'PRESENT';
    const deductionPercent = isLate ? (policy?.latenessDeductionPercent ?? 5.0) : 0.0;

    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_workDate: {
          employeeId: matched.id,
          workDate,
        },
      },
      update: {
        checkInTime: now,
        status,
        deductionPercent,
        stationId: station?.id || null,
      },
      create: {
        employeeId: matched.id,
        workDate,
        checkInTime: now,
        status,
        deductionPercent,
        stationId: station?.id || null,
      },
    });

    // Dispatch async notification to GMD & Super Admin
    const subsidiaryName = matched.assignments?.[0]?.subsidiary?.legalName || 'BEMS Group';
    const departmentName = matched.assignments?.[0]?.department?.name;

    notifyGmdStaffClockIn({
      employee: {
        id: matched.id,
        legalName: matched.legalName,
        employeeNumber: matched.employeeNumber,
        workEmail: matched.workEmail,
      },
      subsidiaryName,
      departmentName,
      stationName: station?.name || 'Office Attendance Kiosk',
      workDate,
      timeStr: currentTimeStr,
      status: record.status,
      deductionPercent: record.deductionPercent,
      method: 'KIOSK_PIN',
    }).catch((err) => console.error('[Kiosk Punch Route] Clock-in notification error:', err));

    return NextResponse.json({
      success: true,
      action: 'CHECK_IN',
      employeeName: matched.legalName,
      employeeNumber: matched.employeeNumber,
      status,
      timeStr: currentTimeStr,
      message: isLate
        ? `Checked in ${matched.legalName} at ${currentTimeStr} (Marked LATE — after ${resumptionTime} + ${graceMinutes}m grace).`
        : `Welcome ${matched.legalName}! Checked in on time at ${currentTimeStr}.`,
      record: serializeAttendanceRecord(record),
    });
  } catch (error: any) {
    console.error('Error in POST /api/attendance/kiosk-punch:', error);
    return NextResponse.json({ error: error.message || 'Kiosk check-in failed.' }, { status: 500 });
  }
}

