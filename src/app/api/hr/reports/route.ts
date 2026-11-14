import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveHrContext, serializeBigInt } from '@/lib/hrRouteHelper';

export async function GET(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { orgWhere, allowedSubIds, useSubFilter } = ctx;

    const empWhere = {
      role: 'STAFF',
      ...(useSubFilter
        ? { assignments: { some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' } } }
        : {}),
    };

    const [
      staffList,
      attendanceCount,
      leaveList,
      payrollBatches,
      evaluationCount,
      disciplinaryCount,
      trainingAssignments,
      requestCount,
    ] = await Promise.all([
      prisma.employee.findMany({
        where: empWhere,
        select: {
          id: true,
          employeeNumber: true,
          legalName: true,
          status: true,
          approvalStatus: true,
          employmentType: true,
          jobTitle: true,
          staffGrade: true,
          assignments: {
            where: { status: 'ACTIVE' },
            select: { subsidiary: { select: { legalName: true, code: true } }, department: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { legalName: 'asc' },
      }),
      prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: useSubFilter
          ? { employee: { assignments: { some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' } } } }
          : undefined,
        _count: { _all: true },
      }),
      prisma.leaveRequest.groupBy({
        by: ['status', 'leaveType'],
        where: useSubFilter
          ? { employee: { assignments: { some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' } } } }
          : undefined,
        _count: { _all: true },
      }),
      prisma.payrollBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { period: true, _count: { select: { items: true } } },
      }),
      prisma.performanceEvaluation.count({
        where: useSubFilter ? { cycle: { organizationId: { in: allowedSubIds } } } : undefined,
      }),
      prisma.disciplinaryCase.count({ where: orgWhere }),
      prisma.employeeTrainingAssignment.groupBy({
        by: ['status'],
        where: useSubFilter
          ? { employee: { assignments: { some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' } } } }
          : undefined,
        _count: { _all: true },
      }),
      prisma.hrRequestTicket.count({ where: orgWhere }),
    ]);

    return NextResponse.json(
      serializeBigInt({
        success: true,
        summary: {
          totalStaff: staffList.length,
          activeStaff: staffList.filter((s) => s.status === 'ACTIVE').length,
          pendingOnboarding: staffList.filter((s) => s.approvalStatus === 'PENDING_APPROVAL').length,
          evaluationCount,
          disciplinaryCount,
          requestCount,
        },
        staffDirectory: staffList.map((s) => ({
          employeeNumber: s.employeeNumber,
          legalName: s.legalName,
          status: s.status,
          approvalStatus: s.approvalStatus,
          employmentType: s.employmentType || 'FULL_TIME',
          jobTitle: s.jobTitle || '-',
          subsidiary: s.assignments[0]?.subsidiary?.legalName || 'Unassigned',
          department: s.assignments[0]?.department?.name || 'General',
        })),
        attendanceByStatus: attendanceCount.map((a) => ({ status: a.status, count: a._count._all })),
        leaveSummary: leaveList.map((l) => ({ status: l.status, leaveType: l.leaveType, count: l._count._all })),
        payrollBatches,
        trainingSummary: trainingAssignments.map((t) => ({ status: t.status, count: t._count._all })),
      })
    );
  } catch (error) {
    console.error('HR Reports GET error:', error);
    return NextResponse.json({ error: 'Failed to load HR reports' }, { status: 500 });
  }
}

