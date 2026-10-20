import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hashPassword, publicEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const VALID_ROLES = [
  'SYSTEM_ADMIN',
  'GMD',
  'COO',
  'HEAD_OF_ADMIN',
  'FINANCE',
  'VERIFIER',
  'DEPT_HEAD',
  'HR',
  'STAFF',
];

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor || !['SYSTEM_ADMIN', 'GMD', 'HR'].includes(actor.role)) {
      return NextResponse.json({ error: 'Administrative or HR authorization is required to onboard roles.' }, { status: 403 });
    }

    const body = await request.json();
    const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
    const workEmail = typeof body.workEmail === 'string' ? body.workEmail.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId ? body.subsidiaryId : null;
    const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null;
    const positionName = typeof body.positionName === 'string' && body.positionName.trim() ? body.positionName.trim() : role;

    if (!legalName || legalName.length < 2) {
      return NextResponse.json({ error: 'Legal full name is required.' }, { status: 400 });
    }

    if (!workEmail || !/^\S+@\S+\.\S+$/.test(workEmail)) {
      return NextResponse.json({ error: 'Valid work email is required.' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role selected. Allowed roles: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    if (!password || password.length < 10) {
      return NextResponse.json({ error: 'Initial password must be at least 10 characters long.' }, { status: 400 });
    }

    const existing = await prisma.employee.findUnique({
      where: { workEmail },
      select: { id: true, legalName: true },
    });

    if (existing) {
      return NextResponse.json({ error: `An account already exists for ${workEmail}.` }, { status: 409 });
    }

    const rolePrefix = role.replace(/_/g, '').slice(0, 3).toUpperCase();
    const employeeNumber = `BEMS-${rolePrefix}-${Date.now().toString().slice(-4)}`;
    const passwordHash = await hashPassword(password);

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          employeeNumber,
          legalName,
          workEmail,
          phone,
          role,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          passwordHash,
        },
      });

      if (subsidiaryId) {
        await tx.employeeAssignment.create({
          data: {
            employeeId: created.id,
            subsidiaryId,
            departmentId: departmentId || null,
            positionName,
            isPrimary: true,
          },
        });
      }

      await tx.systemNotification.create({
        data: {
          employeeId: created.id,
          kind: 'ACCOUNT_ONBOARDED',
          title: 'Account Provisioned',
          body: `Your ${role} profile has been initialized by System Administrator ${actor.legalName}.`,
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully onboarded ${employee.legalName} as ${employee.role}.`,
      employee: {
        ...publicEmployee(employee),
        employeeNumber: employee.employeeNumber,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Role onboarding error:', error);
    return NextResponse.json({ error: error.message || 'Failed to onboard account.' }, { status: 500 });
  }
}
