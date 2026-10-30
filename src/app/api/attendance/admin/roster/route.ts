import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user || !hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'HR', 'COO', 'FINANCE_CONTROLLER'])) {
      return NextResponse.json({ error: 'Unauthorized: Executive or HR access required' }, { status: 401 });
    }

    const employees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        role: 'STAFF',
      },
      select: {
        id: true,
        legalName: true,
        employeeNumber: true,
        role: true,
        workLocation: true,
        workSchedule: true,
        assignments: {
          include: { subsidiary: { select: { legalName: true } } },
          take: 1,
        },
      },
      orderBy: { legalName: 'asc' },
    });

    const roster = employees.map(emp => ({
      employeeId: emp.id,
      legalName: emp.legalName,
      employeeNumber: emp.employeeNumber,
      role: emp.role,
      workLocation: emp.workLocation || 'HQ',
      organizationName: emp.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
      weeklyOffDays: emp.workSchedule?.weeklyOffDays || '0,6',
      customShiftIn: emp.workSchedule?.customShiftIn || '08:00',
      customShiftOut: emp.workSchedule?.customShiftOut || '17:00',
      isExempt: emp.workSchedule?.isExempt || false,
      notes: emp.workSchedule?.notes || null,
    }));

    return NextResponse.json({ roster });
  } catch (error: any) {
    console.error('Error fetching staff roster:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user || !hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'HR', 'COO'])) {
      return NextResponse.json({ error: 'Unauthorized: Executive or HR access required' }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, weeklyOffDays, customShiftIn, customShiftOut, isExempt, notes } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    if (weeklyOffDays === undefined) {
      return NextResponse.json({ error: 'weeklyOffDays is required (e.g. "0,6" or "1,2")' }, { status: 400 });
    }

    const schedule = await prisma.staffWorkSchedule.upsert({
      where: { employeeId },
      update: {
        weeklyOffDays: String(weeklyOffDays),
        customShiftIn: customShiftIn || '08:00',
        customShiftOut: customShiftOut || '17:00',
        isExempt: Boolean(isExempt),
        notes: notes || null,
      },
      create: {
        employeeId,
        weeklyOffDays: String(weeklyOffDays),
        customShiftIn: customShiftIn || '08:00',
        customShiftOut: customShiftOut || '17:00',
        isExempt: Boolean(isExempt),
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Staff work schedule and weekly off-days updated successfully.',
      schedule,
    });
  } catch (error: any) {
    console.error('Error updating staff roster:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
