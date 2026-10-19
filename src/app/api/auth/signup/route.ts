import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10) {
      return NextResponse.json({ error: 'Enter your name and work email, and choose a password with at least 10 characters.' }, { status: 400 });
    }
    if (await prisma.employee.findUnique({ where: { workEmail: email }, select: { id: true } })) {
      return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: `PENDING-${randomUUID().slice(0, 8).toUpperCase()}`,
        legalName: fullName,
        workEmail: email,
        phone: phone || null,
        role: 'STAFF',
        status: 'ACTIVE',
        approvalStatus: 'PENDING_APPROVAL',
        passwordHash: await hashPassword(password),
      },
    });
    const admins = await prisma.employee.findMany({ where: { role: 'SYSTEM_ADMIN', status: 'ACTIVE', approvalStatus: 'APPROVED' }, select: { id: true } });
    if (admins.length) {
      await prisma.systemNotification.createMany({
        data: admins.map(({ id }) => ({ employeeId: id, kind: 'SIGNUP_APPROVAL', title: 'Staff account needs approval', body: `${fullName} (${email}) requested access. Review the signup queue. Current signup ID: ${employee.id}.` })),
      });
    }
    return NextResponse.json({ pendingApproval: true, message: 'Your signup is waiting for System Admin approval.' }, { status: 202 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 });
  }
}
