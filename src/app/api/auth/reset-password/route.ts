import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid work email address.' }, { status: 400 });
    }

    if (!code || code.length < 4) {
      return NextResponse.json({ error: 'Please enter the verification code sent to your email.' }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters long.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { workEmail: email },
    });

    if (!employee) {
      return NextResponse.json({ error: 'No employee account found with this email address.' }, { status: 404 });
    }

    if (employee.approvalStatus !== 'APPROVED' || employee.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This account is not active. Contact your System Admin.' }, { status: 403 });
    }

    // Hash the new password and update employee
    const passwordHash = await hashPassword(newPassword);
    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset. You may now sign in.',
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 500 });
  }
}
