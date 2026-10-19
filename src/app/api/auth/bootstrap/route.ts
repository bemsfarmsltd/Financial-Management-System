import { NextResponse } from 'next/server';
import { createEmployeeSession, hashPassword, publicEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_FALLBACK_SECRET = 'bemsgroup11223355!';

function getBootstrapSecret(): string {
  return process.env.BEMS_BOOTSTRAP_SECRET || DEFAULT_FALLBACK_SECRET;
}

export async function POST(request: Request) {
  const bootstrapSecret = getBootstrapSecret();
  try {
    const body = await request.json();
    if (typeof body.bootstrapSecret !== 'string' || body.bootstrapSecret.trim() !== bootstrapSecret) {
      return NextResponse.json({ error: 'Setup key is invalid. Enter the master bootstrap secret.' }, { status: 401 });
    }

    const adminExists = await prisma.employee.findFirst({
      where: { role: 'SYSTEM_ADMIN' },
      select: { id: true },
    });

    if (adminExists) {
      return NextResponse.json({ error: 'Initial System Admin setup has already been completed.' }, { status: 409 });
    }

    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10) {
      return NextResponse.json({ error: 'Provide a valid name, work email, and password with at least 10 characters.' }, { status: 400 });
    }

    if (await prisma.employee.findUnique({ where: { workEmail: email }, select: { id: true } })) {
      return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: `ADM-${Date.now().toString().slice(-4)}`,
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
    return NextResponse.json({ error: 'Could not create the initial System Admin account.' }, { status: 500 });
  }
}

export async function GET() {
  const exists = await prisma.employee.findFirst({
    where: { role: 'SYSTEM_ADMIN' },
    select: { id: true },
  });
  return NextResponse.json({
    available: !exists,
    configured: true,
    adminExists: Boolean(exists),
  });
}
