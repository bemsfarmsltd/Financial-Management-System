import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole, invalidateSessionCache } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  LifecycleAuthorizationError,
  transitionEmployeeStatus,
} from '@/lib/employee-lifecycle';

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
    const { status, reason } = body;

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'TERMINATED'] as const;
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await transitionEmployeeStatus({
      actor,
      targetEmployeeId: employeeId,
      nextStatus: status,
      reason: typeof reason === 'string' ? reason : null,
      requireStaffRoleOnly: false,
    });

    if (status !== 'ACTIVE') {
      await prisma.authSession.deleteMany({ where: { employeeId } }).catch(() => {});
    }
    invalidateSessionCache();

    const actionLabel = status === 'ACTIVE' ? 'reactivated' : status === 'TERMINATED' ? 'terminated' : 'suspended';

    return NextResponse.json({
      success: true,
      message: `Account for ${updated.legalName} (${updated.workEmail}) has been successfully ${actionLabel}.`,
      employee: {
        id: updated.id,
        legalName: updated.legalName,
        workEmail: updated.workEmail,
        role: updated.role,
        status: updated.status,
      },
    });
  } catch (error: any) {
    if (error instanceof LifecycleAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error in PATCH /api/admin/employees/[employeeId]/status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update account status.' }, { status: 500 });
  }
}
