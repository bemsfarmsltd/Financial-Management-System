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

    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate: targetDate,
        },
      },
      update: {
        status: status.toUpperCase(),
        isManualOverride: true,
        overrideReason: reason.trim(),
        overrideById: adminEmployeeId || user.id || 'SYSTEM_ADMIN',
        deductionPercent: 0.0, // Manual executive override waives lateness deductions
        deductionMinor: BigInt(0),
        excuseStatus: 'APPROVED',
      },
      create: {
        employeeId: employee.id,
        workDate: targetDate,
        status: status.toUpperCase(),
        checkInTime: new Date(`${targetDate}T08:00:00Z`),
        isManualOverride: true,
        overrideReason: reason.trim(),
        overrideById: adminEmployeeId || user.id || 'SYSTEM_ADMIN',
        deductionPercent: 0.0,
        excuseStatus: 'APPROVED',
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
