import { NextResponse } from 'next/server';
import { createEmployeeSession, publicEmployee, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return NextResponse.json({ error: 'Enter your work email and password.' }, { status: 400 });

    const employee = await prisma.employee.findUnique({
      where: { workEmail: email },
      include: {
        assignments: {
          include: {
            subsidiary: true,
            department: true,
          },
        },
      },
    });
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
    const primaryAssignment = employee.assignments?.[0];

    const fullUser = {
      ...publicEmployee(employee),
      employeeNumber: employee.employeeNumber || '',
      phone: employee.phone || '',
      gender: employee.gender || '',
      dateOfBirth: employee.dateOfBirth || '',
      residentialAddress: employee.residentialAddress || '',
      cityState: employee.cityState || '',
      subsidiary: primaryAssignment?.subsidiary?.legalName || primaryAssignment?.subsidiary?.code || '',
      department: primaryAssignment?.department?.name || '',
      jobTitle: employee.jobTitle || primaryAssignment?.positionName || '',
      employmentType: employee.employmentType || '',
      resumptionDate: employee.resumptionDate ? employee.resumptionDate.toISOString().split('T')[0] : '',
      workLocation: employee.workLocation || '',
      staffGrade: employee.staffGrade || '',
      bankName: employee.bankName || '',
      accountNumber: employee.accountNumber || '',
      accountName: employee.accountName || employee.legalName,
      salaryBankName: employee.salaryBankName || employee.bankName || '',
      salaryAccountNumber: employee.salaryAccountNumber || employee.accountNumber || '',
      salaryAccountName: employee.salaryAccountName || employee.accountName || employee.legalName,
      nextOfKinName: employee.nextOfKinName || '',
      nextOfKinPhone: employee.nextOfKinPhone || '',
      nextOfKinRelationship: employee.nextOfKinRelationship || '',
      nextOfKinAddress: employee.nextOfKinAddress || '',
      maritalStatus: employee.maritalStatus || '',
      stateOfOrigin: employee.stateOfOrigin || '',
      lga: employee.lga || '',
      ninMask: employee.nin ? `${employee.nin.slice(0, 4)}••••${employee.nin.slice(-2)}` : '',
      bvnMask: employee.bvn ? `${employee.bvn.slice(0, 4)}••••${employee.bvn.slice(-2)}` : '',
    };

    const res = NextResponse.json({ 
      user: fullUser,
      token: session.token,
    });
    res.cookies.set('bems_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      expires: session.expiresAt,
    });
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Could not sign in.' }, { status: 500 });
  }
}
