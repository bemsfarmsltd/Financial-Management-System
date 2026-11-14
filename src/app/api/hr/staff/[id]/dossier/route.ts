import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, getHrAuthorizationScope } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function safeJson<T>(val: T): T {
  return JSON.parse(
    JSON.stringify(val, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hrScope = await getHrAuthorizationScope(actor);
    if (!hrScope.authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: employeeId } = await context.params;
    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employee id' }, { status: 400 });
    }

    const [
      attendanceRecords,
      leaveRequests,
      payrollItems,
      deductions,
      loans,
      evaluations,
      pips,
      documents,
      requests,
      profileUpdates,
      disciplinaryCases,
      grievances,
      trainings,
      policyRow,
    ] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { employeeId },
        orderBy: { workDate: 'desc' },
        take: 20,
        include: { station: { select: { name: true, code: true } } },
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.payrollItem.findMany({
        where: { employeeId },
        orderBy: { batch: { createdAt: 'desc' } },
        take: 12,
        include: {
          batch: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              period: { select: { year: true, month: true } },
            },
          },
        },
      }),
      prisma.payrollDeductionAdjustment.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.employeeLoan.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.performanceEvaluation.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { cycle: { select: { title: true, status: true } } },
      }),
      prisma.performanceImprovementPlan.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.employeeDocument.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.hrRequestTicket.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.staffProfileUpdateRequest.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.disciplinaryCase.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.employeeGrievanceCase.findMany({
        where: { OR: [{ reporterId: employeeId }, { againstEmployeeId: employeeId }] },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.employeeTrainingAssignment.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { course: { select: { title: true, category: true, durationHours: true, isMandatory: true } } },
      }),
      prisma.workspaceSetting.findFirst({
        where: { key: 'HR_STATUTORY_POLICY' },
      }),
    ]);

    const parsedPolicy = policyRow?.value ? JSON.parse(policyRow.value) : {};
    const statutoryPolicy = {
      pensionEmployerRate: Number(parsedPolicy.pensionEmployerRate ?? parsedPolicy.employerPensionRatePct ?? 10),
      pensionEmployeeRate: Number(parsedPolicy.pensionEmployeeRate ?? parsedPolicy.employeePensionRatePct ?? 8),
      nhfRate: Number(parsedPolicy.nhfRate ?? 2.5),
    };

    return NextResponse.json(
      safeJson({
        success: true,
        dossier: {
          attendanceRecords,
          leaveRequests,
          payrollItems,
          deductions,
          loans,
          evaluations,
          pips,
          documents,
          requests,
          profileUpdates,
          disciplinaryCases,
          grievances,
          trainings,
          statutoryPolicy,
        },
      })
    );
  } catch (err) {
    console.error('[HR_STAFF_DOSSIER_GET]', err);
    return NextResponse.json({ error: 'Failed to load employee dossier' }, { status: 500 });
  }
}

