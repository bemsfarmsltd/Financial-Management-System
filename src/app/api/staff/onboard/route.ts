import { NextResponse } from 'next/server';
import {
  getAuthenticatedEmployee,
  getHrAuthorizationScope,
  hasAnyRole,
  hashPassword,
  publicEmployee,
} from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendStaffLoginReadyEmail } from '@/lib/email';
import { recordEmployeeAuditEvent } from '@/lib/employee-lifecycle';

export const dynamic = 'force-dynamic';

// Strict 3-Role Architecture & Onboarding Channel Separation:
// Direct onboarding via /api/staff/onboard is strictly reserved for STAFF profiles.
// Executive accounts (GMD, SUPER_ADMIN / SYSTEM_ADMIN) MUST use the Executive Email Invitation flow (/api/staff/invite -> /api/staff/onboard/complete).
const VALID_ROLES = ['STAFF'] as const;

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const isExecutive = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
    const hrScope = await getHrAuthorizationScope(actor);

    if (!isExecutive && !hrScope.authorized) {
      return NextResponse.json(
        { error: 'Executive or authorized HR capability is required to onboard staff.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
    const workEmail = typeof body.workEmail === 'string' ? body.workEmail.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    const requestedRole = typeof body.role === 'string' ? body.role.trim().toUpperCase() : 'STAFF';
    const password = typeof body.password === 'string' ? body.password : '';
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId ? body.subsidiaryId : null;
    const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null;
    const positionName = typeof body.positionName === 'string' && body.positionName.trim() ? body.positionName.trim() : 'Staff';

    if (!legalName || legalName.length < 2) {
      return NextResponse.json({ error: 'Legal full name is required.' }, { status: 400 });
    }

    if (!workEmail || !/^\S+@\S+\.\S+$/.test(workEmail)) {
      return NextResponse.json({ error: 'Valid work email is required.' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(requestedRole as any)) {
      return NextResponse.json(
        {
          error:
            'Direct onboarding is strictly reserved for STAFF. Executive roles (GMD and Super Admin) must be onboarded via Executive Email Invitations (/api/staff/invite).',
        },
        { status: 400 }
      );
    }

    if (!subsidiaryId) {
      return NextResponse.json({ error: 'A subsidiary entity is required for staff onboarding.' }, { status: 400 });
    }

    if (!isExecutive && !hrScope.isGlobal && !hrScope.subsidiaryIds.includes(subsidiaryId)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only onboard staff into your authorized subsidiary.' },
        { status: 403 }
      );
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

    const employeeNumber = `BEMS-STA-${Date.now().toString().slice(-4)}`;
    const passwordHash = await hashPassword(password);

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          employeeNumber,
          legalName,
          workEmail,
          phone,
          role: 'STAFF',
          jobTitle: positionName,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          passwordHash,
        },
      });

      await tx.employeeAssignment.create({
        data: {
          employeeId: created.id,
          subsidiaryId,
          departmentId: departmentId || null,
          positionName,
          isPrimary: true,
          status: 'ACTIVE',
        },
      });

      await tx.systemNotification.create({
        data: {
          employeeId: created.id,
          kind: 'ACCOUNT_ONBOARDED',
          title: 'Account Provisioned',
          body: `Your STAFF profile has been initialized by ${actor.legalName}.`,
        },
      });

      return created;
    });

    await recordEmployeeAuditEvent({
      actor,
      targetId: employee.id,
      action: 'STAFF_ONBOARDED',
      subsidiaryId,
      metadata: { workEmail, employeeNumber, positionName },
    });

    // Security rule: Never email reusable plaintext account passwords.
    try {
      const org = await prisma.organization.findUnique({
        where: { id: subsidiaryId },
        select: { legalName: true },
      });
      const subName = org?.legalName || 'BEMS Group Holdings';

      await sendStaffLoginReadyEmail({
        to: employee.workEmail,
        staffName: employee.legalName,
        employeeNumber: employee.employeeNumber,
        roleTitle: positionName,
        subsidiaryName: subName,
      });
    } catch (emailErr) {
      console.error('Failed to dispatch staff login ready email:', emailErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully onboarded ${employee.legalName} as STAFF. Activation notice dispatched to ${employee.workEmail}.`,
        employee: {
          ...publicEmployee(employee),
          employeeNumber: employee.employeeNumber,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Role onboarding error:', error);
    return NextResponse.json({ error: error.message || 'Failed to onboard account.' }, { status: 500 });
  }
}
