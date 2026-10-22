import { NextResponse } from 'next/server';
import { createEmployeeSession, publicEmployee, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return NextResponse.json({ error: 'Enter your work email and password.' }, { status: 400 });

    const employee = await prisma.employee.findUnique({ where: { workEmail: email } });
    if (!employee || !(await verifyPassword(password, employee.passwordHash))) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    if (employee.approvalStatus === 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Your account is waiting for System Admin approval.', pendingApproval: true }, { status: 403 });
    }
    if (employee.approvalStatus !== 'APPROVED' || employee.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This account is not active. Contact your System Admin.' }, { status: 403 });
    }

    const session = await createEmployeeSession(employee.id);
    const res = NextResponse.json({ user: publicEmployee(employee) });
    res.cookies.set('bems_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: session.expiresAt,
    });
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Could not sign in.' }, { status: 500 });
  }
}
