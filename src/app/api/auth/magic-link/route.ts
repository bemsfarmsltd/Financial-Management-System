import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendStaffLoginReadyEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid work email address.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { workEmail: email },
      include: {
        assignments: {
          include: { subsidiary: true },
          take: 1,
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'No employee account found with this email address.' }, { status: 404 });
    }

    if (employee.approvalStatus !== 'APPROVED') {
      return NextResponse.json({
        error: `Account ${employee.employeeNumber} is currently pending executive verification. You will receive an automated email as soon as it is approved.`,
      }, { status: 403 });
    }

    const subsidiaryName = employee.assignments[0]?.subsidiary?.legalName || 'BEMS Group Holdings';

    // Dispatch official login email
    await sendStaffLoginReadyEmail({
      to: employee.workEmail,
      staffName: employee.legalName,
      employeeNumber: employee.employeeNumber,
      roleTitle: employee.jobTitle || employee.role,
      subsidiaryName,
    });

    return NextResponse.json({
      success: true,
      message: `Sign-in instructions and official portal link have been dispatched to ${employee.workEmail}.`,
    });
  } catch (error) {
    console.error('Magic link dispatch error:', error);
    return NextResponse.json({ error: 'Could not send sign-in email. Please try again.' }, { status: 500 });
  }
}
