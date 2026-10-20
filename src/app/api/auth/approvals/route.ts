import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const actor = await getAuthenticatedEmployee();
  if (!actor || !['SYSTEM_ADMIN', 'GMD'].includes(actor.role)) {
    return NextResponse.json({ error: 'Executive or System Admin access required.' }, { status: 403 });
  }

  const [employees, organizations, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { approvalStatus: 'PENDING_APPROVAL' },
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
          }
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
  ]);

  return NextResponse.json({ employees, organizations, departments });
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor || !['SYSTEM_ADMIN', 'GMD'].includes(actor.role)) {
    return NextResponse.json({ error: 'Executive or System Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const decision = body.decision;
    const candidateRole = typeof body.role === 'string' && body.role ? body.role : 'STAFF';
    const allowedRoles = ['GMD', 'HR', 'SYSTEM_ADMIN', 'STAFF'];
    const assignedRole = allowedRoles.includes(candidateRole) ? candidateRole : 'STAFF';
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId ? body.subsidiaryId : null;
    const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null;

    if (!employeeId || !['APPROVE', 'REJECT'].includes(decision)) {
      return NextResponse.json({ error: 'Choose an account and approve or reject it.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.approvalStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Pending signup not found.' }, { status: 404 });
    }

    const approved = decision === 'APPROVE';
    const officialEmpNum = employee.employeeNumber.startsWith('PENDING-')
      ? (approved ? `BEMS-${assignedRole.slice(0, 3)}-${Date.now().toString().slice(-4)}` : employee.employeeNumber)
      : employee.employeeNumber;

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          employeeNumber: officialEmpNum,
          role: assignedRole,
          approvalStatus: approved ? 'APPROVED' : 'REJECTED',
          status: approved ? 'ACTIVE' : 'TERMINATED',
        },
      });

      if (approved && subsidiaryId) {
        await tx.employeeAssignment.create({
          data: {
            employeeId: employee.id,
            subsidiaryId,
            departmentId: departmentId || null,
            positionName: assignedRole,
            isPrimary: true,
          },
        });
      }

      await tx.systemNotification.create({
        data: {
          employeeId: employee.id,
          kind: approved ? 'SIGNUP_APPROVED' : 'SIGNUP_REJECTED',
          title: approved ? 'Account Approved' : 'Signup Declined',
          body: approved
            ? `Your account has been approved with role ${assignedRole}. You can now sign in.`
            : 'Your signup was declined by the System Administrator.',
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: approved ? `Account for ${employee.legalName} approved as ${assignedRole}.` : 'Signup declined.',
    });
  } catch (error: any) {
    console.error('Signup approval error:', error);
    return NextResponse.json({ error: error.message || 'Could not update this signup.' }, { status: 500 });
  }
}
