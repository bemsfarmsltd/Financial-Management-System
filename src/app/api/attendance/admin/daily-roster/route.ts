import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLagosTime, serializeAttendanceRecord } from '@/lib/attendance/token';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user || !hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'HR', 'COO', 'FINANCE_CONTROLLER', 'HEAD_OF_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized: Executive or HR access required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const subsidiaryId = searchParams.get('subsidiaryId');
    const departmentId = searchParams.get('departmentId');
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    const { workDate: todayStr, currentTimeStr } = getLagosTime();
    const targetDate = dateParam || todayStr;

    // Parse day of week for off-day calculation
    const [tYear, tMonth, tDay] = targetDate.split('-').map(Number);
    const targetDateObj = new Date(tYear, tMonth - 1, tDay);
    const targetDayOfWeek = targetDateObj.getDay(); // 0 = Sun, 6 = Sat

    // Fetch employees, policy, and attendance records in parallel
    const [employees, records, rawPolicy, rawSubsidiaries] = await Promise.all([
      prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          ...(subsidiaryId && subsidiaryId !== 'ALL'
            ? { assignments: { some: { subsidiaryId } } }
            : {}),
          ...(departmentId && departmentId !== 'ALL'
            ? { assignments: { some: { departmentId } } }
            : {}),
        },
        include: {
          assignments: {
            include: {
              subsidiary: { select: { id: true, legalName: true, code: true } },
              department: { select: { id: true, name: true } },
            },
            take: 1,
          },
          workSchedule: true,
        },
        orderBy: [{ legalName: 'asc' }],
      }),
      prisma.attendanceRecord.findMany({
        where: { workDate: targetDate },
        include: { station: { select: { name: true, code: true } } },
      }),
      prisma.attendancePolicy.findFirst(),
      prisma.organization.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, legalName: true, code: true },
        orderBy: { legalName: 'asc' },
      }),
    ]);

    const policy = rawPolicy || {
      earliestCheckInTime: '07:00',
      resumptionTime: '08:00',
      closingTime: '17:00',
      gracePeriodMinutes: 15,
      latenessDeductionPercent: 5.0,
      absenceDeductionPercent: 100.0,
    };

    const subsidiaries = rawSubsidiaries.map(s => ({
      id: s.id,
      legalName: s.legalName,
      shortCode: s.code,
    }));

    // Map records by employeeId
    const recordMap = new Map<string, any>();
    records.forEach(r => recordMap.set(r.employeeId, serializeAttendanceRecord(r)));

    // Time calculations
    const [rHour, rMin] = (policy.resumptionTime || '08:00').split(':').map(Number);
    const graceMinutes = policy.gracePeriodMinutes ?? 15;
    const graceThreshold = rHour * 60 + rMin + graceMinutes; // e.g. 8:15 = 495 mins
    const [cHour, cMin] = (policy.closingTime || '17:00').split(':').map(Number);
    const closingThreshold = cHour * 60 + cMin; // e.g. 17:00 = 1020 mins

    let onTimeCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let checkedOutCount = 0;
    let offDayCount = 0;

    const isTargetToday = targetDate === todayStr;
    const isTargetPast = targetDate < todayStr;

    // Filter employees by text search if provided
    const filteredEmployees = employees.filter(emp => {
      if (!search) return true;
      const subName = emp.assignments[0]?.subsidiary?.legalName || '';
      const deptName = emp.assignments[0]?.department?.name || '';
      const text = `${emp.legalName} ${emp.employeeNumber} ${emp.workEmail} ${subName} ${deptName}`.toLowerCase();
      return text.includes(search);
    });

    const roster = filteredEmployees.map(emp => {
      const rec = recordMap.get(emp.id) || null;
      const primaryAssignment = emp.assignments[0];
      const subsidiaryName = primaryAssignment?.subsidiary?.legalName || 'BEMS Group';
      const subsidiaryCode = primaryAssignment?.subsidiary?.code || 'BEMS';
      const departmentName = primaryAssignment?.department?.name || 'General Operations';

      const offDayIndices = (emp.workSchedule?.weeklyOffDays || '0,6')
        .split(',')
        .map((s: string) => parseInt(s.trim(), 10))
        .filter((n: number) => !isNaN(n));
      const isOffDay = offDayIndices.includes(targetDayOfWeek);

      let morningStatus: 'ON_TIME' | 'LATE' | 'ABSENT' | 'OFF_DAY' | 'EXCUSED' | 'NOT_YET' = 'NOT_YET';
      let eveningStatus: 'COMPLETED' | 'EARLY_DEPARTURE' | 'STILL_WORKING' | 'NOT_CHECKED_OUT' | 'OFF_DAY' | 'N/A' = 'N/A';
      let hoursWorkedText = '—';

      const formatTimeToHHMM = (d: any): string | null => {
        if (!d) return null;
        const dateObj = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return null;
        return dateObj.toLocaleTimeString('en-US', {
          timeZone: 'Africa/Lagos',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      };

      const formatTimeToDisplay = (d: any): string | null => {
        if (!d) return null;
        const dateObj = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return null;
        return dateObj.toLocaleTimeString('en-US', {
          timeZone: 'Africa/Lagos',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      };

      const inHHMM = formatTimeToHHMM(rec?.checkInTime);
      const outHHMM = formatTimeToHHMM(rec?.checkOutTime);
      const checkInDisplay = formatTimeToDisplay(rec?.checkInTime);
      const checkOutDisplay = formatTimeToDisplay(rec?.checkOutTime);

      if (isOffDay && !rec) {
        morningStatus = 'OFF_DAY';
        eveningStatus = 'OFF_DAY';
        offDayCount++;
      } else if (rec) {
        // Morning Status
        if (rec.status === 'EXCUSED') {
          morningStatus = 'EXCUSED';
        } else if (rec.status === 'LATE') {
          morningStatus = 'LATE';
          lateCount++;
        } else {
          morningStatus = 'ON_TIME';
          onTimeCount++;
        }

        // Evening Status
        if (outHHMM) {
          checkedOutCount++;
          const [outH, outM] = outHHMM.split(':').map(Number);
          const outMinutes = outH * 60 + outM;
          if (outMinutes < closingThreshold) {
            eveningStatus = 'EARLY_DEPARTURE';
          } else {
            eveningStatus = 'COMPLETED';
          }

          // Calculate total hours worked
          if (inHHMM) {
            const [inH, inM] = inHHMM.split(':').map(Number);
            const diffMin = outMinutes - (inH * 60 + inM);
            if (diffMin > 0) {
              const h = Math.floor(diffMin / 60);
              const m = diffMin % 60;
              hoursWorkedText = `${h}h ${m}m`;
            }
          }
        } else {
          eveningStatus = isTargetToday ? 'STILL_WORKING' : 'NOT_CHECKED_OUT';
          if (inHHMM && isTargetToday) {
            const [inH, inM] = inHHMM.split(':').map(Number);
            const [curH, curM] = currentTimeStr.split(':').map(Number);
            const diffMin = (curH * 60 + curM) - (inH * 60 + inM);
            if (diffMin > 0) {
              const h = Math.floor(diffMin / 60);
              const m = diffMin % 60;
              hoursWorkedText = `${h}h ${m}m (Active)`;
            }
          }
        }
      } else {
        // No record
        if (isTargetPast || (isTargetToday && currentTimeStr > (policy.closingTime || '17:00'))) {
          morningStatus = 'ABSENT';
          absentCount++;
        } else {
          morningStatus = 'NOT_YET';
        }
      }

      const deductionPercent = rec?.deductionPercent
        ? rec.deductionPercent
        : morningStatus === 'LATE'
        ? (policy.latenessDeductionPercent ?? 5.0)
        : morningStatus === 'ABSENT'
        ? 100.0
        : 0;

      return {
        employeeId: emp.id,
        legalName: emp.legalName,
        employeeNumber: emp.employeeNumber,
        role: emp.role,
        workEmail: emp.workEmail,
        avatarUrl: emp.avatarUrl,
        subsidiary: {
          id: primaryAssignment?.subsidiary?.id || '',
          legalName: subsidiaryName,
          shortCode: subsidiaryCode,
        },
        department: {
          id: primaryAssignment?.department?.id || '',
          name: departmentName,
        },
        workDate: targetDate,
        isOffDay,
        hasPunched: !!rec,
        recordId: rec?.id || null,
        scheduledShift: `${emp.workSchedule?.customShiftIn || policy.resumptionTime} - ${emp.workSchedule?.customShiftOut || policy.closingTime}`,
        checkInTimeStr: checkInDisplay || null,
        morningStatus,
        checkOutTimeStr: checkOutDisplay || null,
        eveningStatus,
        hoursWorkedText,
        starlinkIp: rec?.clientIp || null,
        stationName: rec?.station?.name || 'Office Station',
        deductionPercent,
        notes: rec?.notes || null,
        totalDeductionMinor: rec?.deductionMinor ? Number(rec.deductionMinor) : 0,
      };
    });

    return NextResponse.json({
      targetDate,
      isToday: isTargetToday,
      policy: {
        earliestCheckInTime: policy.earliestCheckInTime,
        resumptionTime: policy.resumptionTime,
        closingTime: policy.closingTime,
        gracePeriodMinutes: policy.gracePeriodMinutes,
        latenessDeductionPercent: policy.latenessDeductionPercent,
      },
      subsidiaries,
      counts: {
        total: filteredEmployees.length,
        onTime: onTimeCount,
        late: lateCount,
        absent: absentCount,
        checkedOut: checkedOutCount,
        offDay: offDayCount,
      },
      summary: {
        totalStaff: filteredEmployees.length,
        onTimeMorning: onTimeCount,
        lateMorning: lateCount,
        absent: absentCount,
        checkedOutEvening: checkedOutCount,
        offDays: offDayCount,
        attendanceRate: filteredEmployees.length > 0
          ? Math.round(((onTimeCount + lateCount) / Math.max(filteredEmployees.length - offDayCount, 1)) * 100)
          : 0,
      },
      roster,
    });
  } catch (error: any) {
    console.error('Error fetching daily attendance roster:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
