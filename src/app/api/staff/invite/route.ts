import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendAdminInvitationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const ALLOWED_INVITE_ROLES = [
  'SYSTEM_ADMIN',
  'SUPER_ADMIN',
  'GMD',
  'STAFF',
];

// GET: Validate an invitation token OR list pending invitations for administrators
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // 1. If token is provided, this is the public validation check during invitee landing
    if (token) {
      const invitation = await prisma.adminInvitation.findUnique({
        where: { token },
        include: {
          subsidiary: { select: { id: true, legalName: true, code: true } },
        },
      });

      if (!invitation) {
        return NextResponse.json({ valid: false, error: 'Invitation link was not found or has expired.' }, { status: 404 });
      }

      if (invitation.status === 'COMPLETED') {
        return NextResponse.json({ valid: false, error: 'This invitation has already been completed. Please proceed to sign in.' }, { status: 400 });
      }

      if (invitation.status === 'REVOKED') {
        return NextResponse.json({ valid: false, error: 'This invitation has been revoked by an administrator.' }, { status: 403 });
      }

      if (new Date() > invitation.expiresAt) {
        return NextResponse.json({ valid: false, error: 'This invitation link expired after 7 days. Please request a new invite.' }, { status: 410 });
      }

      let departmentName = '';
      if (invitation.departmentId) {
        const dept = await prisma.department.findUnique({
          where: { id: invitation.departmentId },
          select: { name: true },
        });
        departmentName = dept?.name || '';
      }

      return NextResponse.json({
        valid: true,
        invitation: {
          id: invitation.id,
          workEmail: invitation.workEmail,
          role: invitation.role,
          subsidiaryId: invitation.subsidiaryId,
          subsidiaryName: invitation.subsidiary.legalName,
          departmentId: invitation.departmentId,
          departmentName,
          positionName: invitation.positionName,
          expiresAt: invitation.expiresAt,
        },
      });
    }

    // 2. Otherwise, this is an authenticated admin fetching the pending invitations list
    const actor = await getAuthenticatedEmployee();
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Administrative access required to list invitations.' }, { status: 403 });
    }

    const invitations = await prisma.adminInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        subsidiary: { select: { id: true, legalName: true } },
      },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error in GET /api/staff/invite:', error);
    return NextResponse.json({ error: 'Could not process invitation request.' }, { status: 500 });
  }
}

// POST: Create and dispatch an Executive / Admin invitation email
export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Administrative authorization is required to send role invitations.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const workEmail = typeof body.workEmail === 'string' ? body.workEmail.trim().toLowerCase() : '';
    const role = typeof body.role === 'string' ? body.role.trim().toUpperCase() : '';
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId ? body.subsidiaryId : null;
    const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null;
    const positionName = typeof body.positionName === 'string' && body.positionName.trim() ? body.positionName.trim() : role;

    if (!workEmail || !/^\S+@\S+\.\S+$/.test(workEmail)) {
      return NextResponse.json({ error: 'A valid corporate work email address is required.' }, { status: 400 });
    }

    if (!ALLOWED_INVITE_ROLES.includes(role)) {
      return NextResponse.json({
        error: `Invalid role selected for executive invitation. Allowed roles: ${ALLOWED_INVITE_ROLES.join(', ')}`,
      }, { status: 400 });
    }

    if (!subsidiaryId) {
      return NextResponse.json({ error: 'A subsidiary entity must be selected.' }, { status: 400 });
    }

    // Single active GMD enforcement
    if (role === 'GMD') {
      const existingGmd = await prisma.employee.findFirst({
        where: { role: 'GMD', status: 'ACTIVE', approvalStatus: 'APPROVED' },
        select: { id: true, legalName: true, workEmail: true },
      });
      if (existingGmd) {
        return NextResponse.json({
          error: `The system only permits one Group Managing Director (GMD). An active GMD already exists: ${existingGmd.legalName} (${existingGmd.workEmail}).`,
        }, { status: 409 });
      }
    }

    // Check if an active account already exists with this email
    const existingEmployee = await prisma.employee.findUnique({
      where: { workEmail },
      select: { id: true, legalName: true, employeeNumber: true, role: true },
    });

    if (existingEmployee) {
      return NextResponse.json({
        error: `An active account already exists for ${workEmail} (${existingEmployee.legalName} · ${existingEmployee.role}).`,
      }, { status: 409 });
    }

    // Retrieve subsidiary metadata
    const subsidiary = await prisma.organization.findUnique({
      where: { id: subsidiaryId },
      select: { id: true, legalName: true },
    });

    if (!subsidiary) {
      return NextResponse.json({ error: 'Selected subsidiary entity was not found.' }, { status: 404 });
    }

    let departmentName = '';
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { name: true },
      });
      departmentName = dept?.name || '';
    }

    // Generate secure cryptographic invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Revoke any previous pending invitations for this email to prevent collisions
    await prisma.adminInvitation.updateMany({
      where: { workEmail, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });

    // Save invitation record
    const invitation = await prisma.adminInvitation.create({
      data: {
        workEmail,
        role,
        subsidiaryId,
        departmentId: departmentId || null,
        positionName,
        token,
        invitedById: actor.id,
        status: 'PENDING',
        expiresAt,
      },
    });

    // Dispatch formal invitation email
    try {
      await sendAdminInvitationEmail({
        to: workEmail,
        role,
        subsidiaryName: subsidiary.legalName,
        departmentName: departmentName || undefined,
        positionName,
        inviteToken: token,
        expiresInDays: 7,
      });
    } catch (mailError) {
      console.error('Email dispatch warning (invitation record was saved):', mailError);
    }

    return NextResponse.json({
      success: true,
      message: `Executive invitation dispatched to ${workEmail} as ${role}.`,
      invitation: {
        id: invitation.id,
        workEmail: invitation.workEmail,
        role: invitation.role,
        subsidiaryName: subsidiary.legalName,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/staff/invite:', error);
    return NextResponse.json({ error: 'Could not send executive invitation. Please try again.' }, { status: 500 });
  }
}

// DELETE: Revoke a pending invitation
export async function DELETE(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor || !['SYSTEM_ADMIN', 'GMD', 'COO', 'HEAD_OF_ADMIN', 'HR', 'DIRECTOR'].includes(actor.role)) {
      return NextResponse.json({ error: 'Administrative authorization is required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
    }

    await prisma.adminInvitation.update({
      where: { id },
      data: { status: 'REVOKED' },
    });

    return NextResponse.json({ success: true, message: 'Invitation has been revoked.' });
  } catch (error) {
    console.error('Error in DELETE /api/staff/invite:', error);
    return NextResponse.json({ error: 'Could not revoke invitation.' }, { status: 500 });
  }
}
