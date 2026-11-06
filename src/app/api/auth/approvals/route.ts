import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendStaffLoginReadyEmail } from '@/lib/email';
import {
  approveEmployeeOnboarding,
  LifecycleAuthorizationError,
  rejectEmployeeOnboarding,
} from '@/lib/employee-lifecycle';

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return NextResponse.json({ error: 'Executive or System Admin access required.' }, { status: 403 });
  }

  const [employees, organizations, departments, activeGmd] = await Promise.all([
    prisma.employee.findMany({
      where: { approvalStatus: 'PENDING_APPROVAL', role: 'STAFF' },
      select: {
        id: true,
        employeeNumber: true,
        legalName: true,
        workEmail: true,
        phone: true,
        role: true,
        gender: true,
        dateOfBirth: true,
        residentialAddress: true,
        cityState: true,
        jobTitle: true,
        employmentType: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        nextOfKinName: true,
        nextOfKinPhone: true,
        nextOfKinRelationship: true,
        assignments: {
          select: {
            subsidiaryId: true,
            departmentId: true,
            positionName: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.organization.findMany({
      select: { id: true, legalName: true, code: true, type: true },
      orderBy: { type: 'asc' },
    }),
    prisma.department.findMany({
      select: { id: true, name: true, code: true, organizationId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.employee.findFirst({
      where: { role: 'GMD', status: 'ACTIVE', approvalStatus: 'APPROVED' },
      select: { id: true, legalName: true, workEmail: true, employeeNumber: true },
    }),
  ]);

  return NextResponse.json({ employees, organizations, departments, activeGmd });
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return NextResponse.json({ error: 'Executive or System Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const decision = body.decision;
    const candidateRole = typeof body.role === 'string' && body.role ? body.role.toUpperCase() : 'STAFF';
    const allowedRoles = ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN', 'STAFF'];
    const assignedRole = allowedRoles.includes(candidateRole) ? candidateRole : 'STAFF';
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId ? body.subsidiaryId : null;
    const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null;

    if (!employeeId || !['APPROVE', 'REJECT'].includes(decision)) {
      return NextResponse.json({ error: 'Choose an account and approve or reject it.' }, { status: 400 });
    }

    if (decision === 'APPROVE') {
      const updated = await approveEmployeeOnboarding({
        actor,
        targetEmployeeId: employeeId,
        assignedRole,
        subsidiaryId,
        departmentId,
        positionName: body.positionName || null,
      });

      try {
        let subName = 'BEMS Group Holdings';
        if (subsidiaryId) {
          const org = await prisma.organization.findUnique({ where: { id: subsidiaryId }, select: { legalName: true } });
          if (org?.legalName) subName = org.legalName;
        }
        await sendStaffLoginReadyEmail({
          to: updated.workEmail,
          staffName: updated.legalName,
          employeeNumber: updated.employeeNumber,
          roleTitle: updated.jobTitle || assignedRole,
          subsidiaryName: subName,
        });
      } catch (emailErr) {
        console.error('Failed to dispatch staff login ready email:', emailErr);
      }

      return NextResponse.json({
        success: true,
        message: `Account for ${updated.legalName} approved as ${updated.role}.`,
        employee: updated,
      });
    } else {
      const updated = await rejectEmployeeOnboarding({
        actor,
        targetEmployeeId: employeeId,
        rejectionReason: typeof body.reason === 'string' ? body.reason : null,
      });

      return NextResponse.json({
        success: true,
        message: 'Signup declined.',
        employee: updated,
      });
    }
  } catch (error: any) {
    if (error instanceof LifecycleAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Signup approval error:', error);
    return NextResponse.json({ error: error.message || 'Could not update this signup.' }, { status: 500 });
  }
}
