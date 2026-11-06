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

    // Today in Africa/Lagos
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const staffSubFilter = hrScope.isGlobal
      ? {}
      : {
          assignments: {
            some: {
              subsidiaryId: { in: hrScope.subsidiaryIds },
              status: 'ACTIVE',
            },
          },
        };

    const employeeRelationSubFilter = hrScope.isGlobal
      ? {}
      : {
          employee: {
            role: 'STAFF',
            assignments: {
              some: {
                subsidiaryId: { in: hrScope.subsidiaryIds },
                status: 'ACTIVE',
              },
            },
          },
        };

    const [
      totalStaff,
      pendingOnboarding,
      pendingProfileUpdates,
      pendingLeaves,
      pendingExcuseRequests,
      todayRecords,
      latestPayrollBatch,
      subsidiaries,
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
          brandColor: true,
          _count: {
            select: { employeeAssignments: true },
          },
        },
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

    const absentToday = Math.max(0, totalStaff - (presentToday + lateToday + excusedToday));

    return NextResponse.json({
      success: true,
      todayStr,
      metrics: {
        totalStaff,
        presentToday,
        lateToday,
        absentToday,
        excusedToday,
        pendingOnboarding,
        pendingProfileUpdates,
        pendingLeaves,
        pendingExcuseRequests,
      },
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
        brandColor: sub.brandColor,
        staffCount: sub._count.employeeAssignments,
      })),
    });
  } catch (error) {
    console.error('HR Overview API Error:', error);
    return NextResponse.json({ error: 'Failed to load HR overview data' }, { status: 500 });
  }
}
