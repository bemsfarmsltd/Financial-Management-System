import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendAdminInvitationEmail } from '@/lib/email';
import {
  assertSingleActiveGmd,
  LifecycleAuthorizationError,
  recordEmployeeAuditEvent,
} from '@/lib/employee-lifecycle';

export const dynamic = 'force-dynamic';

const ALLOWED_INVITE_ROLES = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'] as const;

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access required to resend invitations.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
    }

    const invitation = await prisma.adminInvitation.findUnique({
      where: { id },
      include: {
        subsidiary: { select: { id: true, legalName: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    if (!ALLOWED_INVITE_ROLES.includes(invitation.role as any)) {
      return NextResponse.json(
        { error: 'This invitation specifies a non-executive role and cannot be resent.' },
        { status: 400 }
      );
    }

    const isActorSuperAdmin = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN']);
    if ((invitation.role === 'SYSTEM_ADMIN' || invitation.role === 'SUPER_ADMIN') && !isActorSuperAdmin) {
      return NextResponse.json(
        { error: 'Only a Super Admin can resend a Super Admin invitation.' },
        { status: 403 }
      );
    }

    if (invitation.status === 'COMPLETED' || invitation.status === 'ACCEPTED') {
      return NextResponse.json({
        error: `This invitation was already completed and the employee account is active. They can log in directly.`,
      }, { status: 400 });
    }

    if (invitation.status === 'REVOKED') {
      return NextResponse.json({
        error: 'This invitation was revoked. Please create a new invitation instead.',
      }, { status: 400 });
    }

    if (invitation.role === 'GMD') {
      await assertSingleActiveGmd();
    }

    // Refresh token and expiration date
    const newToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.adminInvitation.update({
      where: { id },
      data: {
        token: newToken,
        expiresAt,
        status: 'PENDING',
      },
    });

    await recordEmployeeAuditEvent({
      actor,
      targetId: updated.id,
      action: 'EXECUTIVE_INVITE_RESENT',
      subsidiaryId: invitation.subsidiaryId,
      metadata: { workEmail: updated.workEmail, role: updated.role },
    });

    let departmentName = '';
    if (invitation.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: invitation.departmentId },
        select: { name: true },
      });
      departmentName = dept?.name || '';
    }

    try {
      await sendAdminInvitationEmail({
        to: invitation.workEmail,
        role: invitation.role,
        subsidiaryName: invitation.subsidiary.legalName,
        departmentName: departmentName || undefined,
        positionName: invitation.positionName || undefined,
        inviteToken: newToken,
        expiresInDays: 7,
      });
    } catch (mailError) {
      console.error('Email dispatch error during resend:', mailError);
    }

    return NextResponse.json({
      success: true,
      message: `Invitation email resent to ${invitation.workEmail}.`,
      invitation: {
        id: updated.id,
        workEmail: updated.workEmail,
        role: updated.role,
        expiresAt: updated.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof LifecycleAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error in POST /api/staff/invite/resend:', error);
    return NextResponse.json({ error: 'Failed to resend invitation email.' }, { status: 500 });
  }
}
