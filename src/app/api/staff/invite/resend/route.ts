import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendAdminInvitationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor || !['SYSTEM_ADMIN', 'GMD', 'COO', 'HEAD_OF_ADMIN', 'HR', 'DIRECTOR'].includes(actor.role)) {
      return NextResponse.json({ error: 'Administrative access required to resend invitations.' }, { status: 403 });
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

    if (invitation.status === 'COMPLETED') {
      return NextResponse.json({
        error: `This invitation was already completed and the employee account is active. They can log in directly.`,
      }, { status: 400 });
    }

    if (invitation.status === 'REVOKED') {
      return NextResponse.json({
        error: 'This invitation was revoked. Please create a new invitation instead.',
      }, { status: 400 });
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
        token: updated.token,
        expiresAt: updated.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/staff/invite/resend:', error);
    return NextResponse.json({ error: 'Failed to resend invitation email.' }, { status: 500 });
  }
}
