import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user || !hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized: Executive access required' }, { status: 401 });
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
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage rosters.' }, { status: 401 });
    const body = await request.json();
    const schedule = await executeDashboardCommand(actor, 'attendance_override', { ...body, action_type: 'UPDATE_ROSTER' });
    return NextResponse.json({ success: true, schedule });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
