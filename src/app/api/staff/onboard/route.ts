import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  getAuthenticatedEmployee,
  getHrAuthorizationScope,
  hasAnyRole,
} from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendAdminInvitationEmail } from '@/lib/email';
import { recordEmployeeAuditEvent } from '@/lib/employee-lifecycle';

export const dynamic = 'force-dynamic';

// Strict 3-Role Architecture & Onboarding Channel Separation:
// Direct onboarding via /api/staff/onboard is strictly reserved for STAFF profiles.
// Executive accounts (GMD, SUPER_ADMIN / SYSTEM_ADMIN) MUST use the Executive Email Invitation flow (/api/staff/invite -> /api/staff/onboard/complete).
const VALID_ROLES = ['STAFF'] as const;
const INVITATION_EXPIRY_DAYS = 7;

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const isExecutive = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
    const hrScope = await getHrAuthorizationScope(actor);

    if (!isExecutive && !hrScope.authorized) {
      return NextResponse.json(
        { error: 'Executive or authorized HR capability is required to onboard staff.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
    const workEmail = typeof body.workEmail === 'string' ? body.workEmail.trim().toLowerCase() : '';
    const requestedRole = typeof body.role === 'string' ? body.role.trim().toUpperCase() : 'STAFF';
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId ? body.subsidiaryId : null;
    const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null;
    const positionName = typeof body.positionName === 'string' && body.positionName.trim() ? body.positionName.trim() : 'Staff';

    if (body.password !== undefined && body.password !== null && String(body.password).trim() !== '') {
      return NextResponse.json(
        {
          error:
            'Caller-supplied initial passwords are not accepted. Onboarding issues an expiring single-use invitation link so the recipient sets their own password securely.',
        },
        { status: 400 }
      );
    }

    if (!legalName || legalName.length < 2) {
      return NextResponse.json({ error: 'Legal full name is required.' }, { status: 400 });
    }

    if (!workEmail || !/^\S+@\S+\.\S+$/.test(workEmail)) {
      return NextResponse.json({ error: 'Valid work email is required.' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(requestedRole as any)) {
      return NextResponse.json(
        {
          error:
            'Direct onboarding is strictly reserved for STAFF. Executive roles (GMD and Super Admin) must be onboarded via Executive Email Invitations (/api/staff/invite).',
        },
        { status: 400 }
      );
    }

    if (!subsidiaryId) {
      return NextResponse.json({ error: 'A subsidiary entity is required for staff onboarding.' }, { status: 400 });
    }

    if (!isExecutive && !hrScope.isGlobal && !hrScope.subsidiaryIds.includes(subsidiaryId)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only onboard staff into your authorized subsidiary.' },
        { status: 403 }
      );
    }

    const existing = await prisma.employee.findUnique({
      where: { workEmail },
      select: { id: true, legalName: true },
    });

    if (existing) {
      return NextResponse.json({ error: `An account already exists for ${workEmail}.` }, { status: 409 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: subsidiaryId },
      select: { id: true, legalName: true, status: true },
    });
    if (!org || org.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Selected subsidiary was not found or is inactive.' }, { status: 404 });
    }

    let departmentName: string | undefined;
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, name: true, organizationId: true },
      });
      if (!dept || dept.organizationId !== subsidiaryId) {
        return NextResponse.json(
          { error: 'Selected department does not belong to the target subsidiary.' },
          { status: 400 }
        );
      }
      departmentName = dept.name;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await prisma.$transaction(async (tx) => {
      await tx.adminInvitation.updateMany({
        where: { workEmail, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });

      return tx.adminInvitation.create({
        data: {
          workEmail,
          role: 'STAFF',
          subsidiaryId,
          departmentId: departmentId || null,
          positionName,
          token,
          invitedById: actor.id,
          status: 'PENDING',
          expiresAt,
        },
      });
    });

    await recordEmployeeAuditEvent({
      actor,
      targetId: invitation.id,
      action: 'STAFF_ONBOARDING_INVITE_ISSUED',
      subsidiaryId,
      metadata: {
        workEmail,
        legalName,
        positionName,
        departmentId,
        expiresAt: expiresAt.toISOString(),
      },
    });

    try {
      await sendAdminInvitationEmail({
        to: workEmail,
        role: 'STAFF',
        subsidiaryName: org.legalName,
        departmentName,
        positionName,
        inviteToken: token,
        expiresInDays: INVITATION_EXPIRY_DAYS,
      });
    } catch (emailErr) {
      console.error('Failed to dispatch single-use staff onboarding invitation email:', emailErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Expiring single-use onboarding invitation dispatched to ${workEmail}. ${legalName} will set their own password via the secure onboarding link.`,
        invitation: {
          id: invitation.id,
          workEmail: invitation.workEmail,
          role: invitation.role,
          subsidiaryId: invitation.subsidiaryId,
          departmentId: invitation.departmentId,
          positionName: invitation.positionName,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Role onboarding error:', error);
    return NextResponse.json({ error: error.message || 'Failed to issue onboarding invitation.' }, { status: 500 });
  }
}
