import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLagosTime, serializeAttendanceRecord } from '@/lib/attendance/token';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user || !hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN', 'HR', 'COO'])) {
      return NextResponse.json({ error: 'Unauthorized: Executive or HR access required' }, { status: 401 });
    }
    const isExecutive = hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);

    const body = await request.json();
    const { employeeId, workDate, status = 'PRESENT', reason, adminEmployeeId, excuseDecision } = body;

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

    // Executive decision on a pending HR Excuse Request
    if (excuseDecision === 'APPROVE' || excuseDecision === 'REJECT') {
      if (!isExecutive) {
        return NextResponse.json({ error: 'Only the GMD or Super Admin can approve or reject attendance deduction waivers.' }, { status: 403 });
      }
      const existing = await prisma.attendanceRecord.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: targetDate } },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
      }
      const updated = await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: excuseDecision === 'APPROVE'
          ? {
              status: 'EXCUSED',
              deductionPercent: 0.0,
              deductionMinor: BigInt(0),
              excuseStatus: 'APPROVED',
              isManualOverride: true,
              overrideById: user.id,
              overrideReason: existing.excuseRequestNote || 'Approved by GMD',
            }
          : {
              excuseStatus: 'REJECTED',
            },
      });
      return NextResponse.json({
        success: true,
        message: excuseDecision === 'APPROVE'
          ? `Approved excuse for ${employee.legalName} on ${targetDate}. Deduction waived (0%).`
          : `Declined excuse request for ${employee.legalName} on ${targetDate}. Statutory deduction remains in effect.`,
        record: serializeAttendanceRecord(updated),
      });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'A valid audit reason (minimum 5 characters) is required' },
        { status: 400 }
      );
    }

    // If actor is HR_ADMIN, HR cannot directly waive deductions — submit an Excuse Request for GMD approval
    if (!isExecutive) {
      const existing = await prisma.attendanceRecord.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: targetDate } },
      });

      const record = await prisma.attendanceRecord.upsert({
        where: {
          employeeId_workDate: {
            employeeId: employee.id,
            workDate: targetDate,
          },
        },
        update: {
          excuseStatus: 'PENDING_GMD_APPROVAL',
          excuseRequestNote: reason.trim(),
          excuseRequestedByName: user.legalName,
        },
        create: {
          employeeId: employee.id,
          workDate: targetDate,
          status: existing?.status || 'LATE',
          deductionPercent: existing?.deductionPercent ?? 5.0,
          excuseStatus: 'PENDING_GMD_APPROVAL',
          excuseRequestNote: reason.trim(),
          excuseRequestedByName: user.legalName,
        },
      });

      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: `Excuse request submitted for ${employee.legalName} (${targetDate}). Deductions remain active until approved by the GMD or Super Admin.`,
        record: serializeAttendanceRecord(record),
      });
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
