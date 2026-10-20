import { NextResponse } from 'next/server';
import { createEmployeeSession, publicEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const roleOptions = [
  { role: 'GMD', label: 'GMD (Executive Command)', employeeNumber: 'LOCAL-DEMO-GMD', legalName: 'GMD Executive', workEmail: 'gmd@bemsgroup.com' },
  { role: 'SYSTEM_ADMIN', label: 'System Admin (Shared Command)', employeeNumber: 'LOCAL-DEMO-SYSTEM-ADMIN', legalName: 'Bems system Admin', workEmail: 'bemssofthubltd@gmail.com' },
  { role: 'STAFF', label: 'Staff Member (Self-Registered)', employeeNumber: 'LOCAL-DEMO-STAFF', legalName: 'Chioma Adebayo', workEmail: 'chioma.staff@bemsfarms.com' },
];

export async function GET() {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ enabled: false }, { status: 404 });
  return NextResponse.json({ enabled: true, roles: roleOptions.map(({ role, label }) => ({ role, label })) });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Local role access is not available.' }, { status: 404 });
  try {
    const body = await request.json();
    const role = typeof body.role === 'string' ? body.role : '';
    const option = roleOptions.find(item => item.role === role);
    if (!option) return NextResponse.json({ error: 'Choose GMD, System Admin, or Staff.' }, { status: 400 });
    let employee = await prisma.employee.findFirst({
      where: { role, status: 'ACTIVE', approvalStatus: 'APPROVED' },
      orderBy: { employeeNumber: 'asc' },
    });
    if (!employee) {
      employee = await prisma.employee.upsert({
        where: { workEmail: option.workEmail },
        update: { role, status: 'ACTIVE', approvalStatus: 'APPROVED' },
        create: {
          employeeNumber: option.employeeNumber,
          legalName: option.legalName,
          workEmail: option.workEmail,
          role,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
        },
      });
    }
    await createEmployeeSession(employee.id);
    return NextResponse.json({ user: publicEmployee(employee) });
  } catch (error) {
    console.error('Local role access error:', error);
    return NextResponse.json({ error: 'Could not open that role.' }, { status: 500 });
  }
}
