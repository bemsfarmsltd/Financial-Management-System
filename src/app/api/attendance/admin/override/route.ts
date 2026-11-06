import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLagosTime, serializeAttendanceRecord } from '@/lib/attendance/token';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user || !hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized: Executive access required' }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, workDate, status = 'PRESENT', reason, adminEmployeeId } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, legalName: true, employeeNumber: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const { workDate: todayStr } = getLagosTime();
    const targetDate = workDate || todayStr;

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'A valid audit reason (minimum 5 characters) is required' },
        { status: 400 }
      );
    }

    const normalizedStatus = String(status || 'PRESENT').toUpperCase().trim();
    if (!['PRESENT', 'LATE', 'HALF_DAY', 'EXCUSED', 'ABSENT', 'ON_LEAVE'].includes(normalizedStatus)) {
      return NextResponse.json({ error: `Invalid attendance status "${normalizedStatus}".` }, { status: 400 });
    }

    const empDetails = await prisma.employee.findUnique({
      where: { id: employee.id },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
          take: 1,
        },
        employmentAgreements: {
          where: { status: 'ACTIVE' },
          include: {
            compensations: {
              where: { effectiveTo: null },
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
            },
          },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
    });
    const subId = empDetails?.assignments[0]?.subsidiaryId || empDetails?.employmentAgreements[0]?.employerEntityId || null;
    const policy =
      (subId ? await prisma.attendancePolicy.findUnique({ where: { organizationId: subId } }) : null) ||
      (await prisma.attendancePolicy.findFirst({ where: { organization: { type: 'GROUP' } } })) ||
      (await prisma.attendancePolicy.findFirst());

    let deductionPercent = 0.0;
    if (body.deductionPercent !== undefined && body.deductionPercent !== null && body.deductionPercent !== '') {
      deductionPercent = Number(body.deductionPercent);
    } else if (normalizedStatus === 'LATE') {
      deductionPercent = Number(policy?.latenessDeductionPercent ?? 5.0);
    } else if (normalizedStatus === 'HALF_DAY') {
      deductionPercent = 50.0;
    } else if (normalizedStatus === 'ABSENT') {
      deductionPercent = Number(policy?.absenceDeductionPercent ?? 100.0);
    }

    const monthlyGrossMinor = Number(empDetails?.employmentAgreements[0]?.compensations[0]?.grossMinor ?? 0);
    const dailyWageMinor = monthlyGrossMinor > 0 ? Math.round(monthlyGrossMinor / 22) : 0;
    const deductionMinor = BigInt(Math.round(dailyWageMinor * (deductionPercent / 100)));
    const hasClockEvent = normalizedStatus === 'PRESENT' || normalizedStatus === 'LATE' || normalizedStatus === 'HALF_DAY';

    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate: targetDate,
        },
      },
      update: {
        status: normalizedStatus,
        isManualOverride: true,
        overrideReason: reason.trim(),
        overrideById: adminEmployeeId || user.id || 'SYSTEM_ADMIN',
        isDeductionApplied: deductionPercent > 0,
        deductionPercent,
        deductionMinor,
        excuseStatus: normalizedStatus === 'EXCUSED' || deductionPercent === 0 ? 'APPROVED' : 'NONE',
      },
      create: {
        employeeId: employee.id,
        workDate: targetDate,
        status: normalizedStatus,
        checkInTime: hasClockEvent ? new Date(`${targetDate}T08:00:00Z`) : null,
        isManualOverride: true,
        overrideReason: reason.trim(),
        overrideById: adminEmployeeId || user.id || 'SYSTEM_ADMIN',
        isDeductionApplied: deductionPercent > 0,
        deductionPercent,
        deductionMinor,
        excuseStatus: normalizedStatus === 'EXCUSED' || deductionPercent === 0 ? 'APPROVED' : 'NONE',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully marked ${employee.legalName} (${employee.employeeNumber}) as ${record.status} for ${targetDate}.`,
      record: serializeAttendanceRecord(record),
    });
  } catch (error: any) {
    console.error('Error applying manual attendance override:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
