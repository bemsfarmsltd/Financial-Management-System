import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hashPassword, verifyPassword } from '@/lib/auth';

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
    const isPrivileged = actor.role === 'GMD' || actor.role === 'SYSTEM_ADMIN';
    if (!isOwner && !isPrivileged) {
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

    if (employee.passwordHash && oldPassword) {
      const match = await verifyPassword(oldPassword, employee.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
      }
    }

    const newHash = await hashPassword(newPassword);
    await prisma.employee.update({
      where: { id: employeeId },
      data: { passwordHash: newHash },
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
