import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Executive authorization required.' }, { status: 403 });
    }

    const { employeeId } = await params;
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body.isAttendanceExempt !== 'boolean') {
      return NextResponse.json(
        { error: 'Field "isAttendanceExempt" must be a boolean.' },
        { status: 400 }
      );
    }

    const isAttendanceExempt = body.isAttendanceExempt;

    const targetEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, legalName: true, role: true, workEmail: true },
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee account not found.' }, { status: 404 });
    }

    // Update employee model
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { isAttendanceExempt },
      select: { id: true, legalName: true, isAttendanceExempt: true },
    });

    // Also sync with staffWorkSchedule
    await prisma.staffWorkSchedule.upsert({
      where: { employeeId },
      update: { isExempt: isAttendanceExempt },
      create: {
        employeeId,
        weeklyOffDays: '0,6',
        isExempt: isAttendanceExempt,
      },
    }).catch((err) => console.warn('Sync to staffWorkSchedule non-fatal error:', err));

    const statusLabel = isAttendanceExempt
      ? 'exempted from attendance signing (omitted from daily attendance rosters)'
      : 'restored to active attendance tracking (required to mark attendance daily)';

    return NextResponse.json({
      success: true,
      message: `${targetEmployee.legalName} has been ${statusLabel}.`,
      employee: updated,
    });
  } catch (error: any) {
    console.error('Error in PATCH attendance-exemption:', error);
    return NextResponse.json({ error: error.message || 'Failed to update attendance exemption.' }, { status: 500 });
  }
}

