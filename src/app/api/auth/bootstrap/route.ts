import { NextResponse } from 'next/server';
import { createEmployeeSession, hashPassword, publicEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const bootstrapSecret = process.env.BEMS_BOOTSTRAP_SECRET;
  if (!bootstrapSecret) return NextResponse.json({ error: 'Initial account setup is not configured.' }, { status: 503 });
  try {
    const body = await request.json();
    if (typeof body.bootstrapSecret !== 'string' || body.bootstrapSecret !== bootstrapSecret) {
      return NextResponse.json({ error: 'Setup credentials are invalid.' }, { status: 401 });
    }
    if (await prisma.employee.findFirst({ where: { role: 'SYSTEM_ADMIN' }, select: { id: true } })) {
      return NextResponse.json({ error: 'Initial System Admin setup has already been completed.' }, { status: 409 });
    }
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
      return NextResponse.json({ error: 'Provide a name, valid email, and password with at least 12 characters.' }, { status: 400 });
    }
    if (await prisma.employee.findUnique({ where: { workEmail: email }, select: { id: true } })) {
      return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
    }
    const employee = await prisma.employee.create({
      data: {
        employeeNumber: `ADM-${Date.now()}`,
        legalName: fullName,
        workEmail: email,
        role: 'SYSTEM_ADMIN',
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        passwordHash: await hashPassword(password),
      },
    });
    await createEmployeeSession(employee.id);
    return NextResponse.json({ user: publicEmployee(employee), message: 'System Admin account created.' }, { status: 201 });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json({ error: 'Could not create the initial account.' }, { status: 500 });
  }
}

export async function GET() {
  const configured = Boolean(process.env.BEMS_BOOTSTRAP_SECRET);
  const exists = await prisma.employee.findFirst({ where: { role: 'SYSTEM_ADMIN' }, select: { id: true } });
  return NextResponse.json({ available: configured && !exists, configured, adminExists: Boolean(exists) });
}
