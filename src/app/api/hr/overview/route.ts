import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, getHrAuthorizationScope } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const hrScope = await getHrAuthorizationScope(actor);
    if (!hrScope.authorized) {
      return NextResponse.json({ error: 'Forbidden. HR workspace access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const requestedSubId = searchParams.get('subsidiaryId') || '';

    // Today in Africa/Lagos
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const allowedSubIds = requestedSubId
      ? hrScope.isGlobal || hrScope.subsidiaryIds.includes(requestedSubId)
        ? [requestedSubId]
        : []
      : hrScope.subsidiaryIds;

    const useSubFilter = Boolean(requestedSubId) || !hrScope.isGlobal;

    const staffSubFilter = useSubFilter
      ? {
          assignments: {
            some: {
              subsidiaryId: { in: allowedSubIds },
              status: 'ACTIVE',
            },
          },
        }
      : {};

    const employeeRelationSubFilter = useSubFilter
      ? {
          employee: {
            role: 'STAFF',
            assignments: {
              some: {
                subsidiaryId: { in: allowedSubIds },
                status: 'ACTIVE',
              },
            },
          },
        }
      : {};

    // Build last 14 dates (oldest -> today) in Africa/Lagos
    const last14Dates: { dateStr: string; dayLabel: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
      const dayLabel = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
      }).format(d);
      last14Dates.push({ dateStr, dayLabel });
    }
    const oldestDateStr = last14Dates[0].dateStr;

    const [
      totalStaff,
      pendingOnboarding,
      pendingProfileUpdates,
      pendingLeaves,
      pendingExcuseRequests,
      onLeaveToday,
      todayRecords,
      last14Records,
      latestPayrollBatch,
      subsidiaries,
      activeStaffList,
      leaveTypeGroups,
    ] = await Promise.all([
      prisma.employee.count({
        where: {
          role: 'STAFF',
          status: 'ACTIVE',
          ...staffSubFilter,
        },
      }),

      prisma.employee.count({
        where: {
          role: 'STAFF',
          approvalStatus: 'PENDING_APPROVAL',
          ...staffSubFilter,
        },
      }),

      prisma.staffProfileUpdateRequest.count({
        where: {
          status: 'PENDING',
          ...employeeRelationSubFilter,
        },
      }),

      prisma.leaveRequest.count({
        where: {
          status: 'PENDING',
          ...employeeRelationSubFilter,
        },
      }),

      prisma.attendanceRecord.count({
        where: {
          excuseStatus: 'PENDING_GMD_APPROVAL',
          ...employeeRelationSubFilter,
        },
      }),

      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: todayStr },
          endDate: { gte: todayStr },
          ...employeeRelationSubFilter,
        },
      }),

      prisma.attendanceRecord.findMany({
        where: {
          workDate: todayStr,
          ...employeeRelationSubFilter,
        },
        select: {
          status: true,
          checkInTime: true,
          isManualOverride: true,
          excuseStatus: true,
        },
      }),

      prisma.attendanceRecord.findMany({
        where: {
          workDate: { gte: oldestDateStr, lte: todayStr },
          ...employeeRelationSubFilter,
        },
        select: {
          workDate: true,
          status: true,
        },
      }),

      prisma.payrollBatch.findFirst({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          version: true,
          payrollType: true,
          status: true,
          totalGrossMinor: true,
          totalNetMinor: true,
          createdAt: true,
          period: {
            select: { year: true, month: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),

      prisma.organization.findMany({
        where: {
          status: 'ACTIVE',
          ...(hrScope.isGlobal ? {} : { id: { in: hrScope.subsidiaryIds } }),
        },
        select: {
          id: true,
          legalName: true,
          code: true,
          type: true,
          logoUrl: true,
          brandColor: true,
          _count: {
            select: { employeeAssignments: true },
          },
        },
      }),

      prisma.employee.findMany({
        where: {
          role: 'STAFF',
          status: 'ACTIVE',
          ...staffSubFilter,
        },
        select: {
          employmentType: true,
          assignments: {
            where: { status: 'ACTIVE' },
            select: {
              department: { select: { name: true } },
            },
            take: 1,
          },
        },
      }),

      prisma.leaveRequest.groupBy({
        by: ['leaveType'],
        where: {
          status: { in: ['PENDING', 'APPROVED'] },
          ...employeeRelationSubFilter,
        },
        _count: { _all: true },
      }),
    ]);

    let presentToday = 0;
    let lateToday = 0;
    let excusedToday = 0;

    for (const r of todayRecords) {
      if (r.status === 'PRESENT') presentToday++;
      else if (r.status === 'LATE') lateToday++;
      else if (r.status === 'EXCUSED') excusedToday++;
    }

    const absentToday = Math.max(0, totalStaff - (presentToday + lateToday + excusedToday + onLeaveToday));

    const trendMap = new Map<string, { present: number; late: number }>();
    for (const d of last14Dates) {
      trendMap.set(d.dateStr, { present: 0, late: 0 });
    }
    for (const rec of last14Records) {
      const bucket = trendMap.get(rec.workDate);
      if (!bucket) continue;
      if (rec.status === 'PRESENT' || rec.status === 'EXCUSED') bucket.present++;
      else if (rec.status === 'LATE') bucket.late++;
    }

    const attendance14DayTrend = last14Dates.map((d) => {
      const b = trendMap.get(d.dateStr) || { present: 0, late: 0 };
      const presentTotal = b.present + b.late;
      const absent = Math.max(0, totalStaff - presentTotal);
      return {
        date: d.dateStr,
        dayLabel: d.dayLabel,
        present: presentTotal,
        late: b.late,
        absent,
      };
    });
    const attendance7DayTrend = attendance14DayTrend.slice(-7);

    // Employment Type & Department analytics
    const empTypeCounts = new Map<string, number>();
    const deptCounts = new Map<string, number>();
    for (const emp of activeStaffList) {
      const empType = (emp.employmentType || 'FULL_TIME').toUpperCase();
      empTypeCounts.set(empType, (empTypeCounts.get(empType) || 0) + 1);
      const deptName = emp.assignments[0]?.department?.name || 'General Operations';
      deptCounts.set(deptName, (deptCounts.get(deptName) || 0) + 1);
    }

    const employmentBreakdown = Array.from(empTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const departmentBreakdown = Array.from(deptCounts.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const leaveBreakdown = leaveTypeGroups
      .map((g) => ({ type: g.leaveType, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      todayStr,
      actor: {
        id: actor.id,
        legalName: actor.legalName,
        role: actor.role,
      },
      metrics: {
        totalStaff,
        presentToday,
        lateToday,
        absentToday,
        onLeaveToday,
        excusedToday,
        pendingOnboarding,
        pendingProfileUpdates,
        pendingLeaves,
        pendingExcuseRequests,
      },
      attendance7DayTrend,
      attendance14DayTrend,
      employmentBreakdown,
      departmentBreakdown,
      leaveBreakdown,
      latestPayrollBatch: latestPayrollBatch
        ? {
            id: latestPayrollBatch.id,
            version: latestPayrollBatch.version,
            status: latestPayrollBatch.status,
            yearMonth: `${latestPayrollBatch.period.year}-${String(latestPayrollBatch.period.month).padStart(2, '0')}`,
            totalHeadcount: latestPayrollBatch._count.items,
            totalGrossMinor: latestPayrollBatch.totalGrossMinor.toString(),
            totalNetMinor: latestPayrollBatch.totalNetMinor.toString(),
            createdAt: latestPayrollBatch.createdAt,
          }
        : null,
      subsidiaries: subsidiaries.map((sub) => ({
        id: sub.id,
        name: sub.legalName,
        code: sub.code,
        type: sub.type,
        logoUrl: sub.logoUrl,
        brandColor: sub.brandColor,
        staffCount: sub._count.employeeAssignments,
      })),
    });
  } catch (error) {
    console.error('HR Overview API Error:', error);
    return NextResponse.json({ error: 'Failed to load HR overview data' }, { status: 500 });
  }
}
