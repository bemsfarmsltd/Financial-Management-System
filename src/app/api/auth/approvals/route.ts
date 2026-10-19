import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const actor = await getAuthenticatedEmployee();
  if (!actor || actor.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'System Admin access required.' }, { status: 403 });
  const employees = await prisma.employee.findMany({
    where: { approvalStatus: 'PENDING_APPROVAL' },
    select: { id: true, employeeNumber: true, legalName: true, workEmail: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ employees });
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee();
  if (!actor || actor.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'System Admin access required.' }, { status: 403 });
  try {
    const body = await request.json();
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const decision = body.decision;
    if (!employeeId || !['APPROVE', 'REJECT'].includes(decision)) return NextResponse.json({ error: 'Choose an account and approve or reject it.' }, { status: 400 });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.approvalStatus !== 'PENDING_APPROVAL') return NextResponse.json({ error: 'Pending signup not found.' }, { status: 404 });
    const approved = decision === 'APPROVE';
    await prisma.$transaction([
      prisma.employee.update({ where: { id: employee.id }, data: { approvalStatus: approved ? 'APPROVED' : 'REJECTED', status: approved ? 'ACTIVE' : 'TERMINATED' } }),
      prisma.systemNotification.create({ data: { employeeId: employee.id, kind: approved ? 'SIGNUP_APPROVED' : 'SIGNUP_REJECTED', title: approved ? 'Account approved' : 'Signup declined', body: approved ? 'Your account is approved. You can now sign in.' : 'Your signup was declined. Contact the System Admin if you have questions.' } }),
    ]);
    return NextResponse.json({ success: true, emailSent: false, message: approved ? 'Account approved. Email delivery is not configured yet.' : 'Signup declined.' });
  } catch (error) {
    console.error('Signup approval error:', error);
    return NextResponse.json({ error: 'Could not update this signup.' }, { status: 500 });
  }
}
