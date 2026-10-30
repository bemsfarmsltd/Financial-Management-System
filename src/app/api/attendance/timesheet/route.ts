import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLagosTime, serializeAttendanceRecord } from '@/lib/attendance/token';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const dateParam = searchParams.get('date'); // YYYY-MM-DD
    const monthParam = searchParams.get('month'); // 1-12
    const yearParam = searchParams.get('year'); // e.g. 2026

    const now = new Date();
    const { workDate: todayStr } = getLagosTime(now);
    const targetDate = dateParam || todayStr;

    // Mode 1: Individual Employee Timesheet (Month-wise)
    if (employeeId && monthParam && yearParam) {
      const monthNum = parseInt(monthParam, 10);
      const yearNum = parseInt(yearParam, 10);

      const monthPrefix = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

      const [employee, records] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: employeeId },
          include: { workSchedule: true },
        }),
        prisma.attendanceRecord.findMany({
          where: {
            employeeId,
            workDate: { startsWith: monthPrefix },
          },
          orderBy: { workDate: 'asc' },
          include: { station: { select: { name: true, code: true } } },
        }),
      ]);

      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      const totalDaysPresent = records.filter(r => r.status === 'PRESENT').length;
      const totalDaysLate = records.filter(r => r.status === 'LATE').length;
      const totalHalfDays = records.filter(r => r.status === 'HALF_DAY').length;
      const totalExcused = records.filter(r => r.status === 'EXCUSED').length;

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
          present: totalDaysPresent,
          late: totalDaysLate,
          halfDay: totalHalfDays,
          excused: totalExcused,
          totalPunches: records.length,
        },
        records: records.map(serializeAttendanceRecord),
      });
    }

    // Mode 2: Admin Live Daily Dashboard
    const [employees, todayRecords, policy] = await Promise.all([
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          legalName: true,
          employeeNumber: true,
          role: true,
          workLocation: true,
          avatarUrl: true,
          workSchedule: true,
          assignments: {
            include: { subsidiary: { select: { legalName: true, code: true } } },
            take: 1,
          },
        },
        orderBy: { legalName: 'asc' },
      }),
      prisma.attendanceRecord.findMany({
        where: { workDate: targetDate },
        include: { station: { select: { name: true, code: true } } },
      }),
      prisma.attendancePolicy.findFirst(),
    ]);

    // Map each employee to their status today
    const attendanceMap = new Map(todayRecords.map(r => [r.employeeId, r]));

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

    return NextResponse.json({
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
  } catch (error: any) {
    console.error('Error fetching attendance timesheet:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
