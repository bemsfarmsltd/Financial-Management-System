import { executeDashboardCommand } from '@/lib/staged-actions';
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

// Strict 3-Role Architecture & Onboarding Channel Separation:
// Executive Email Invitations (POST /api/staff/invite) are strictly reserved for Super admin (SYSTEM_ADMIN / SUPER_ADMIN) and GMD.
const ALLOWED_INVITE_ROLES = [
  'SYSTEM_ADMIN',
  'SUPER_ADMIN',
  'GMD',
] as const;

const ALLOWED_TOKEN_COMPLETION_ROLES = [
  'SYSTEM_ADMIN',
  'SUPER_ADMIN',
  'GMD',
  'STAFF',
] as const;

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

      if (invitation.status === 'COMPLETED' || invitation.status === 'ACCEPTED') {
        return NextResponse.json({ valid: false, error: 'This invitation has already been completed. Please proceed to sign in.' }, { status: 400 });
      }

      if (invitation.status === 'REVOKED') {
        return NextResponse.json({ valid: false, error: 'This invitation has been revoked by an administrator.' }, { status: 403 });
      }

      if (new Date() > invitation.expiresAt) {
        return NextResponse.json({ valid: false, error: 'This invitation link expired after 7 days. Please request a new invite.' }, { status: 410 });
      }

      if (!ALLOWED_TOKEN_COMPLETION_ROLES.includes(invitation.role as any)) {
        return NextResponse.json({ valid: false, error: 'This invitation specifies an unrecognized role and is no longer valid.' }, { status: 403 });
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

    // 2. Otherwise, this is an authenticated executive fetching the pending invitations list
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Administrative access required to list invitations.' }, { status: 403 });
    }

    const invitations = await prisma.adminInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        workEmail: true,
        role: true,
        subsidiaryId: true,
        departmentId: true,
        positionName: true,
        invitedById: true,
        status: true,
        expiresAt: true,
        createdAt: true,
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
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Executive access required.' }, { status: 401 });
    const body = await request.json();
    const invitation = await executeDashboardCommand(actor, 'admin_onboarding', {
      sub_action: 'CREATE_INVITE', workEmail: String(body.workEmail || '').trim().toLowerCase(),
      role: body.role, subsidiaryId: body.subsidiaryId, departmentId: body.departmentId, positionName: body.positionName,
    });
    return NextResponse.json({ success: true, invitation, invitationId: invitation.id, emailSent: false, deliveryStatus: 'QUEUED', message: 'Executive invitation created; email delivery is queued.' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Executive access required.' }, { status: 401 });
    const invitation = await executeDashboardCommand(actor, 'admin_onboarding', { sub_action: 'REVOKE_INVITE', invitationId: new URL(request.url).searchParams.get('id') });
    return NextResponse.json({ success: true, invitation });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
