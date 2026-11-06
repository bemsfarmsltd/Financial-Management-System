import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedEmployee,
  hasAnyRole,
  hashPassword,
  invalidateSessionCache,
  verifyPassword,
} from '@/lib/auth';
import { recordEmployeeAuditEvent } from '@/lib/employee-lifecycle';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Sign in to change password.' }, { status: 401 });
    }

    const { employeeId } = await params;
    const isOwner = actor.id === employeeId;
    const isExecutive = hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);

    if (!isOwner && !isExecutive) {
      return NextResponse.json({ error: 'Forbidden. You can only change your own password.' }, { status: 403 });
    }

    const body = await request.json();

    const oldPassword = typeof body.oldPassword === 'string' ? body.oldPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters long.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    // Prevent non-Super Admin from resetting a Super Admin's password
    const isTargetSuperAdmin = ['SYSTEM_ADMIN', 'SUPER_ADMIN'].includes((employee.role || '').toUpperCase());
    const isActorSuperAdmin = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN']);
    if (!isOwner && isTargetSuperAdmin && !isActorSuperAdmin) {
      return NextResponse.json(
        { error: 'Only a Super Admin can reset another Super Admin password.' },
        { status: 403 }
      );
    }

    // Owner changing their own password MUST provide their valid current password
    if (isOwner && employee.passwordHash) {
      if (!oldPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change your password.' },
          { status: 400 }
        );
      }
      const match = await verifyPassword(oldPassword, employee.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
      }
    }

    const newHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: { passwordHash: newHash },
      });

      // Revoke sessions on password reset by another admin
      if (!isOwner) {
        await tx.authSession.deleteMany({
          where: { employeeId },
        });
      }
    });

    invalidateSessionCache();

    await recordEmployeeAuditEvent({
      actor,
      targetId: employeeId,
      action: isOwner ? 'PASSWORD_CHANGED_SELF' : 'PASSWORD_RESET_BY_ADMIN',
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('Failed to change password:', error);
    return NextResponse.json({ error: 'Could not change password.' }, { status: 500 });
  }
}
