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
    if (!actor || !hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'HR', 'COO', 'HEAD_OF_ADMIN'])) {
      return NextResponse.json({ error: 'Executive or HR authorization required.' }, { status: 403 });
    }

    const { employeeId } = await params;
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { status } = body;

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'TERMINATED'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const targetEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { assignments: { include: { subsidiary: true } } },
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee or Administrator account not found.' }, { status: 404 });
    }

    // Safety Safeguard: Cannot suspend yourself
    if (actor.id === targetEmployee.id || actor.workEmail.toLowerCase() === targetEmployee.workEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'Action denied: You cannot suspend or deactivate your own active account.' },
        { status: 400 }
      );
    }

    // Safety Safeguard: Only GMD or SYSTEM_ADMIN can suspend other executives/admins
    const isTargetExecutive = ['GMD', 'SYSTEM_ADMIN', 'COO', 'HEAD_OF_ADMIN'].includes(targetEmployee.role);
    if (isTargetExecutive && !['GMD', 'SYSTEM_ADMIN'].includes(actor.role)) {
      return NextResponse.json(
        { error: 'Only the Group Managing Director (GMD) or a System Administrator can suspend leadership accounts.' },
        { status: 403 }
      );
    }

    // Update the employee status
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    // If suspended or terminated, purge all active auth sessions so they are immediately logged out
    if (status === 'SUSPENDED' || status === 'TERMINATED') {
      await prisma.authSession.deleteMany({
        where: { employeeId },
      });
    }

    // Log an audit trail or notification if needed
    const actionLabel = status === 'ACTIVE' ? 'reactivated' : 'suspended';

    return NextResponse.json({
      success: true,
      message: `Account for ${targetEmployee.legalName} (${targetEmployee.workEmail}) has been successfully ${actionLabel}.`,
      employee: {
        id: updated.id,
        legalName: updated.legalName,
        workEmail: updated.workEmail,
        role: updated.role,
        status: updated.status,
      },
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/employees/[employeeId]/status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update account status.' }, { status: 500 });
  }
}
