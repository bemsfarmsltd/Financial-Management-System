import { canAccessEmployeePortal } from '@/lib/portal-access';
import { NextResponse } from 'next/server';
import { createEmployeeSession, publicEmployee, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return NextResponse.json({ error: 'Enter your work email and password.' }, { status: 400 });

    // Brute-force & credential stuffing defense (Max 5 attempts per 5 mins with 15 min lockout)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'direct';
    const rateLimitKey = `login:${email}`;
    const rateLimit = await checkRateLimit(rateLimitKey, {
      windowMs: 5 * 60 * 1000,
      maxAttempts: 5,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      const waitMin = Math.ceil((rateLimit.retryAfterSeconds || 60) / 60);
      return NextResponse.json(
        { error: `Too many failed login attempts. Access temporarily restricted for ${waitMin} minutes to protect your account.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) } }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { workEmail: email },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
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

    // Reset rate limit key on successful authentication
    await resetRateLimit(rateLimitKey);

    if (employee.approvalStatus === 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Your account is waiting for System Admin approval.', pendingApproval: true }, { status: 403 });
    }
    if (!canAccessEmployeePortal(employee)) {
      return NextResponse.json({ error: 'This account is not active. Contact your System Admin.' }, { status: 403 });
    }

    if (!['STAFF', 'GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(employee.role)) return NextResponse.json({ error: 'This account has an unsupported role. Contact a Super Admin.' }, { status: 403 });
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
