import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLagosTime, serializeAttendanceRecord } from '@/lib/attendance/token';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const isKioskStream = searchParams.get('kiosk') === 'true';
    const dateParam = searchParams.get('date'); // YYYY-MM-DD
    const monthParam = searchParams.get('month'); // 1-12
    const yearParam = searchParams.get('year'); // e.g. 2026

    // Unauthenticated callers can ONLY access sanitized recent arrivals for the public kiosk screen
    if (!user && !isKioskStream) {
      return NextResponse.json({ error: 'Unauthorized: Executive or HR access required' }, { status: 401 });
    }

    const now = new Date();
    const { workDate: todayStr } = getLagosTime(now);
    const targetDate = dateParam || todayStr;

    const effectiveEmployeeId = (user?.role === 'STAFF') ? user.id : (employeeId || null);
    const effectiveMonth = monthParam ? parseInt(monthParam, 10) : (now.getMonth() + 1);
    const effectiveYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    // Mode 1: Individual Employee Timesheet (Month-wise Calendar View)
    if (effectiveEmployeeId && (monthParam || user?.role === 'STAFF')) {
      const monthNum = effectiveMonth;
      const yearNum = effectiveYear;

      const monthPrefix = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

      const [employee, records] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: effectiveEmployeeId },
          include: { workSchedule: true },
        }),
        prisma.attendanceRecord.findMany({
          where: {
            employeeId: effectiveEmployeeId,
            workDate: { startsWith: monthPrefix },
          },
          orderBy: { workDate: 'asc' },
          include: { station: { select: { name: true, code: true } } },
        }),
      ]);

      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      const totalDaysInMonth = new Date(yearNum, monthNum, 0).getDate();
      const offDayIndices = (employee.workSchedule?.weeklyOffDays || '0,6')
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n));

      // Map existing punches by workDate string (YYYY-MM-DD)
      const recordMap = new Map<string, any>();
      records.forEach(r => recordMap.set(r.workDate, serializeAttendanceRecord(r)));

      // Generate all calendar days of the month
      const days = [];
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let excusedCount = 0;
      let offDayCount = 0;
      let totalDeductionPercent = 0;
      let totalDeductionMinor = 0;

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(yearNum, monthNum - 1, day);
        const dayOfWeek = dayDate.getDay();
        const isOffDay = offDayIndices.includes(dayOfWeek);
        const isFuture = dateStr > todayStr;
        const record = recordMap.get(dateStr) || null;

        let status = 'UPCOMING';
        if (record) {
          status = record.status;
          if (status === 'PRESENT') presentCount++;
          else if (status === 'LATE') {
            lateCount++;
            totalDeductionPercent += record.deductionPercent || 5.0;
            totalDeductionMinor += record.deductionMinor || 0;
          } else if (status === 'EXCUSED') excusedCount++;
          else if (status === 'ABSENT') {
            absentCount++;
            totalDeductionPercent += 100.0;
          }
        } else if (isOffDay) {
          status = 'OFF_DAY';
          offDayCount++;
        } else if (dateStr < '2026-11-03') {
          // Pre-launch: System attendance tracking officially commenced on 2026-11-03
          status = 'EXCUSED';
          excusedCount++;
        } else if (isFuture) {
          status = 'UPCOMING';
        } else {
          status = 'ABSENT';
          absentCount++;
          totalDeductionPercent += 100.0;
        }

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

        const inDisplay = formatTimeToDisplay(record?.checkInTime);
        const outDisplay = formatTimeToDisplay(record?.checkOutTime);

        let hoursWorkedText = '—';
        if (record?.checkInTime && record?.checkOutTime) {
          const inD = new Date(record.checkInTime).getTime();
          const outD = new Date(record.checkOutTime).getTime();
          const diffMin = Math.floor((outD - inD) / (1000 * 60));
          if (diffMin > 0) {
            const h = Math.floor(diffMin / 60);
            const m = diffMin % 60;
            hoursWorkedText = `${h}h ${m}m`;
          }
        }

        days.push({
          day,
          dayNumber: day,
          workDate: dateStr,
          date: dateStr,
          dayName: dayNames[dayOfWeek],
          dayOfWeek,
          isOffDay,
          isFuture,
          status,
          scheduledShift: `${employee.workSchedule?.customShiftIn || '08:00'} - ${employee.workSchedule?.customShiftOut || '17:00'}`,
          checkInTime: inDisplay,
          checkOutTime: outDisplay,
          checkOutStatus: outDisplay ? 'Completed' : (inDisplay && dateStr === todayStr ? 'In Progress' : 'Pending'),
          hoursWorkedText,
          stationName: record?.station?.name || null,
          stationCode: record?.station?.code || null,
          deductionPercent: record?.deductionPercent ?? (status === 'ABSENT' ? 100.0 : 0.0),
          deductionMinor: record?.deductionMinor ?? 0,
          recordId: record?.id || null,
          notes: record?.overrideReason || null,
        });
      }

      const totalWorkDaysSoFar = presentCount + lateCount + absentCount;
      const punctualityScore = totalWorkDaysSoFar > 0
        ? Math.round((presentCount / totalWorkDaysSoFar) * 100)
        : 100;

      return NextResponse.json({
        employee: {
          id: employee.id,
          legalName: employee.legalName,
          employeeNumber: employee.employeeNumber,
          role: employee.role,
          workLocation: employee.workLocation,
          workSchedule: employee.workSchedule,
        },
        month: monthNum,
        year: yearNum,
        summary: {
          totalDaysInMonth,
          present: presentCount,
          presentDays: presentCount,
          late: lateCount,
          lateDays: lateCount,
          absent: absentCount,
          absentDays: absentCount,
          excused: excusedCount,
          excusedDays: excusedCount,
          offDays: offDayCount,
          totalPunches: records.length,
          totalDeductionPercent,
          totalDeductionMinor,
          punctualityScore,
        },
        days,
        records: records.map(serializeAttendanceRecord),
        today: recordMap.get(todayStr) || null,
        calendar: {
          today: recordMap.get(todayStr) || null,
          days,
        },
      });
    }

    // Mode 2: Admin Live Daily Dashboard OR Previous Month Roll-Up Radar
    const isMonthlyAggregation = Boolean(monthParam && !dateParam);
    const monthPrefix = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}`;

    const [employees, records, policy] = await Promise.all([
      prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          role: 'STAFF',
          isAttendanceExempt: false,
        },
        select: {
          id: true,
          legalName: true,
          employeeNumber: true,
          role: true,
          workLocation: true,
          avatarUrl: true,
          isOfflineStaff: true,
          kioskPin: true,
          workSchedule: true,
          assignments: {
            include: { subsidiary: { select: { legalName: true, code: true } } },
            take: 1,
          },
        },
        orderBy: { legalName: 'asc' },
      }),
      isMonthlyAggregation
        ? prisma.attendanceRecord.findMany({
            where: { workDate: { startsWith: monthPrefix } },
            include: { station: { select: { name: true, code: true } } },
          })
        : prisma.attendanceRecord.findMany({
            where: { workDate: targetDate },
            include: {
              station: { select: { name: true, code: true } },
              employee: {
                select: {
                  id: true,
                  legalName: true,
                  employeeNumber: true,
                  role: true,
                  workLocation: true,
                  avatarUrl: true,
                  assignments: {
                    include: {
                      department: { select: { name: true, code: true } },
                      subsidiary: { select: { legalName: true, code: true } },
                    },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { checkInTime: 'desc' },
          }),
      prisma.attendancePolicy.findFirst(),
    ]);

    if (isMonthlyAggregation) {
      // Group records by employeeId for monthly summary
      const recordsByEmp = new Map<string, typeof records>();
      for (const rec of records) {
        if (!recordsByEmp.has(rec.employeeId)) {
          recordsByEmp.set(rec.employeeId, []);
        }
        recordsByEmp.get(rec.employeeId)!.push(rec);
      }

      const monthlyRows = employees.map((emp) => {
        const empRecords = recordsByEmp.get(emp.id) || [];
        const presentCount = empRecords.filter((r) => r.status === 'PRESENT').length;
        const lateCount = empRecords.filter((r) => r.status === 'LATE').length;
        const excusedCount = empRecords.filter((r) => r.status === 'EXCUSED').length;
        const totalDeductionPercent = empRecords.reduce((sum, r) => sum + (r.deductionPercent || 0), 0);
        const lastRecord = empRecords[empRecords.length - 1];

        // Overall status badge for the month
        const status = empRecords.length === 0
          ? 'NO_RECORD'
          : lateCount > presentCount
          ? 'LATE'
          : 'PRESENT';

        return {
          employeeId: emp.id,
          legalName: emp.legalName,
          employeeNumber: emp.employeeNumber,
          role: emp.role,
          workLocation: emp.workLocation || 'HQ',
          organizationName: emp.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
          status,
          monthlyPunches: empRecords.length,
          presentDays: presentCount,
          lateDays: lateCount,
          excusedDays: excusedCount,
          totalDeductionPercent: Math.round(totalDeductionPercent * 10) / 10,
          checkInTime: lastRecord?.checkInTime,
          checkOutTime: lastRecord?.checkOutTime,
          stationName: lastRecord?.station?.name,
          isOfflineStaff: emp.isOfflineStaff,
        };
      });

      const totalPunches = records.length;
      const totalPresent = records.filter((r) => r.status === 'PRESENT').length;
      const totalLate = records.filter((r) => r.status === 'LATE').length;
      const totalExcused = records.filter((r) => r.status === 'EXCUSED').length;

      const monthName = new Date(effectiveYear, effectiveMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

      return NextResponse.json({
        date: monthPrefix,
        isMonthlyView: true,
        selectedMonth: effectiveMonth,
        selectedYear: effectiveYear,
        monthName,
        policy: {
          resumptionTime: policy?.resumptionTime || '08:00',
          closingTime: policy?.closingTime || '17:00',
          gracePeriodMinutes: policy?.gracePeriodMinutes || 15,
          latenessDeductionPercent: policy?.latenessDeductionPercent || 5.0,
        },
        counts: {
          total: employees.length,
          present: totalPresent,
          late: totalLate,
          excused: totalExcused,
          offDay: 0,
          absent: employees.filter((e) => (recordsByEmp.get(e.id)?.length || 0) === 0).length,
          totalPunches,
        },
        employees: monthlyRows,
      });
    }

    // Daily View
    const attendanceMap = new Map(records.map(r => [r.employeeId, r]));

    // Determine day of week to check off-days
    const targetDateObj = new Date(`${targetDate}T00:00:00Z`);
    const { dayOfWeek } = getLagosTime(targetDateObj);

    const rows = employees.map(emp => {
      const record = attendanceMap.get(emp.id);
      const offDays = (emp.workSchedule?.weeklyOffDays || '0,6')
        .split(',')
        .map(s => parseInt(s.trim(), 10));
      const isOffDay = offDays.includes(dayOfWeek);

      let status = 'ABSENT';
      if (record) {
        status = record.status;
      } else if (isOffDay) {
        status = 'OFF_DAY';
      }

      return {
        employeeId: emp.id,
        legalName: emp.legalName,
        employeeNumber: emp.employeeNumber,
        role: emp.role,
        workLocation: emp.workLocation || 'HQ',
        organizationName: emp.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
        status,
        checkInTime: record?.checkInTime,
        checkOutTime: record?.checkOutTime,
        distanceMeters: record?.checkInDistanceM,
        stationName: record?.station?.name,
        isManualOverride: record?.isManualOverride || false,
        overrideReason: record?.overrideReason,
        deductionPercent: record?.deductionPercent || 0,
        excuseStatus: record?.excuseStatus || 'NONE',
        excuseRequestNote: record?.excuseRequestNote || null,
        excuseRequestedByName: record?.excuseRequestedByName || null,
        isOfflineStaff: emp.isOfflineStaff,
        kioskPin: emp.kioskPin,
        recordId: record?.id,
      };
    });

    const counts = {
      total: employees.length,
      present: rows.filter(r => r.status === 'PRESENT').length,
      late: rows.filter(r => r.status === 'LATE').length,
      halfDay: rows.filter(r => r.status === 'HALF_DAY').length,
      offDay: rows.filter(r => r.status === 'OFF_DAY').length,
      absent: rows.filter(r => r.status === 'ABSENT').length,
      excused: rows.filter(r => r.status === 'EXCUSED').length,
    };

    if (isKioskStream) {
      // Return ALL staff members who marked attendance today, ordered by most recent check-in
      const allTodayAttendees = records
        .filter((r: any) => r.checkInTime)
        .map((r: any) => {
          const emp = r.employee || employees.find(e => e.id === r.employeeId);
          return {
            employeeId: r.employeeId,
            legalName: emp?.legalName || 'Staff Member',
            employeeNumber: emp?.employeeNumber || '',
            role: emp?.role || 'STAFF',
            workLocation: emp?.workLocation || 'HQ',
            department: emp?.assignments?.[0]?.department?.name || 'Operations',
            subsidiary: emp?.assignments?.[0]?.subsidiary?.legalName || 'BEMS Group',
            checkInTime: r.checkInTime,
            checkOutTime: r.checkOutTime,
            status: r.status,
            stationName: r.station?.name || 'Main Gate Kiosk',
          };
        });

      const response = NextResponse.json({
        totalPresent: allTodayAttendees.length,
        employees: allTodayAttendees,
      });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      response.headers.set('CDN-Cache-Control', 'no-store');
      response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    const response = NextResponse.json({
      date: targetDate,
      policy: {
        resumptionTime: policy?.resumptionTime || '08:00',
        closingTime: policy?.closingTime || '17:00',
        gracePeriodMinutes: policy?.gracePeriodMinutes || 15,
        latenessDeductionPercent: policy?.latenessDeductionPercent || 5.0,
      },
      counts,
      employees: rows,
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (error: any) {
    console.error('Error fetching attendance timesheet:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
