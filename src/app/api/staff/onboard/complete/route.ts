import { NextResponse } from 'next/server';
import { createEmployeeSession, hashPassword, publicEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    const password = typeof body.password === 'string' ? body.password : '';
    const bankName = typeof body.bankName === 'string' ? body.bankName.trim() : null;
    const accountNumber = typeof body.accountNumber === 'string' ? body.accountNumber.trim() : null;
    const accountName = typeof body.accountName === 'string' ? body.accountName.trim() : null;
    const residentialAddress = typeof body.residentialAddress === 'string' ? body.residentialAddress.trim() : null;
    const cityState = typeof body.cityState === 'string' ? body.cityState.trim() : null;
    const gender = typeof body.gender === 'string' ? body.gender.trim() : null;

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is missing.' }, { status: 400 });
    }

    if (!legalName || legalName.length < 2) {
      return NextResponse.json({ error: 'Please enter your full legal name.' }, { status: 400 });
    }

    if (!password || password.length < 10) {
      return NextResponse.json({ error: 'Password must be at least 10 characters long.' }, { status: 400 });
    }

    // 1. Verify invitation token
    const invitation = await prisma.adminInvitation.findUnique({
      where: { token },
      include: {
        subsidiary: { select: { id: true, legalName: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation link was not found or has expired.' }, { status: 404 });
    }

    if (invitation.status === 'COMPLETED') {
      return NextResponse.json({ error: 'This invitation has already been completed. Please sign in directly.' }, { status: 400 });
    }

    if (invitation.status === 'REVOKED') {
      return NextResponse.json({ error: 'This invitation has been revoked by an administrator.' }, { status: 403 });
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'This invitation has expired after 7 days. Please request a new invite.' }, { status: 410 });
    }

    // 2. Prevent duplicate account creation
    const existing = await prisma.employee.findUnique({
      where: { workEmail: invitation.workEmail },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: `An account already exists for ${invitation.workEmail}.` }, { status: 409 });
    }

    // 3. Single GMD enforcement
    if (invitation.role === 'GMD') {
      const existingGmd = await prisma.employee.findFirst({
        where: { role: 'GMD', status: 'ACTIVE', approvalStatus: 'APPROVED' },
        select: { id: true, legalName: true },
      });
      if (existingGmd) {
        return NextResponse.json({
          error: `An active Group Managing Director (GMD) already exists (${existingGmd.legalName}).`,
        }, { status: 409 });
      }
    }

    // 4. Create Employee and Assignment in a transaction
    const rolePrefix = invitation.role.replace(/_/g, '').slice(0, 3).toUpperCase();
    const employeeNumber = `BEMS-${rolePrefix}-${Date.now().toString().slice(-4)}`;
    const passwordHash = await hashPassword(password);

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          employeeNumber,
          legalName,
          workEmail: invitation.workEmail,
          phone,
          role: invitation.role,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          passwordHash,
          jobTitle: invitation.positionName || invitation.role,
          bankName,
          accountNumber,
          accountName: accountName || legalName,
          residentialAddress,
          cityState,
          gender,
        },
      });

      await tx.employeeAssignment.create({
        data: {
          employeeId: created.id,
          subsidiaryId: invitation.subsidiaryId,
          departmentId: invitation.departmentId || null,
          positionName: invitation.positionName || invitation.role,
          isPrimary: true,
        },
      });

      await tx.adminInvitation.update({
        where: { id: invitation.id },
        data: { status: 'COMPLETED' },
      });

      return created;
    });

    // 5. Establish authenticated session and direct login
    const session = await createEmployeeSession(employee.id);
    const res = NextResponse.json({
      success: true,
      user: publicEmployee(employee),
      message: `Welcome to BEMS Group, ${employee.legalName}. Your executive profile is active.`,
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
    console.error('Error in POST /api/staff/onboard/complete:', error);
    return NextResponse.json({ error: 'Could not complete onboarding. Please try again.' }, { status: 500 });
  }
}
