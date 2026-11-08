import { normalizeOrganizationIdentifier } from '@/lib/organization-identity';
import { getAiReadClient } from '@/lib/platform/scoped-database';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  const db = actor ? await getAiReadClient(actor) : prisma;
  if (errorResponse) return errorResponse;
  if (!actor?.isExecutive) {
    return NextResponse.json({ ok: false, error_code: 'FORBIDDEN', message: 'Executive access required.' }, { status: 403 });
  }

  const invitations = await db.adminInvitation.findMany({
    include: { subsidiary: { select: { id: true, legalName: true, code: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    count: invitations.length,
    invitations: invitations.map((inv) => ({
      id: inv.id,
      workEmail: inv.workEmail,
      role: inv.role,
      positionName: inv.positionName,
      status: inv.status,
      subsidiary: inv.subsidiary,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  const db = actor ? await getAiReadClient(actor) : prisma;
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Only GMD or Super Admin can onboard an executive admin.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const subAction = String(body.action || body.sub_action || 'CREATE_INVITE').toUpperCase();

  if (subAction === 'RESEND_INVITE' || subAction === 'REVOKE_INVITE') {
    const lookup = String(body.invitationId || body.id || body.workEmail || body.email || '').trim();
    if (!lookup) {
      return NextResponse.json({ ok: false, error: 'invitationId or workEmail is required.' }, { status: 400 });
    }
    const invitation = await db.adminInvitation.findFirst({
      where: {
        OR: [{ id: lookup }, { workEmail: { equals: lookup, mode: 'insensitive' } }],
      },
      include: { subsidiary: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!invitation) {
      return NextResponse.json({ ok: false, error: `Invitation "${lookup}" not found.` }, { status: 404 });
    }

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'admin_onboarding',
      summary: `${subAction === 'REVOKE_INVITE' ? 'Revoke' : 'Resend'} Executive Invitation for ${invitation.workEmail} (${invitation.role})`,
      materialPayload: {
        sub_action: subAction,
        invitationId: invitation.id,
        workEmail: invitation.workEmail,
      },
      preview: {
        action: subAction,
        work_email: invitation.workEmail,
        role: invitation.role,
        subsidiary: invitation.subsidiary.legalName,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `Executive invitation ${subAction === 'REVOKE_INVITE' ? 'revocation' : 'resend'} for ${invitation.workEmail} has been staged.`,
      ...staged,
    });
  }
  const legalName: string = (body.legalName || body.name || '').trim();
  const workEmail: string = (body.workEmail || body.email || '').trim().toLowerCase();
  const phone: string = (body.phone || '').trim();
  const rawRole: string = (body.role || '').toUpperCase().trim();
  const subsidiaryId: string = (body.subsidiaryId || '').trim();

  // Validate required fields
  const missing: string[] = [];
  if (!legalName || legalName.length < 3) missing.push('legalName (Full Legal Name, min 3 characters)');
  if (!workEmail || !workEmail.includes('@')) missing.push('workEmail (Official corporate email address)');
  if (!phone) missing.push('phone (Mobile phone number for dual-factor verification)');
  if (!rawRole) missing.push('role ("SUPER_ADMIN" or "GMD" strictly)');

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'INCOMPLETE_PARAMETERS',
        message: 'To onboard an Executive Admin, all identity and governance parameters are mandatory.',
        missing_fields: missing,
        required_fields: [
          { field: 'legalName', label: 'Full Legal Name', example: 'Engr. Michael Adeyemi' },
          { field: 'workEmail', label: 'Corporate Work Email', example: 'adeyemi@bemsgroup.com' },
          { field: 'phone', label: 'Official Mobile Phone', example: '+2348030001122' },
          { field: 'role', label: 'Executive Role (SUPER_ADMIN or GMD)', example: 'SUPER_ADMIN' },
          { field: 'subsidiaryId', label: 'Assigned Subsidiary (Optional)', example: 'BEMS-GROUP' },
        ],
        conversational_prompt: `To onboard this Executive Admin, please ask the GMD for:\n` +
          missing.map((m, i) => `${i + 1}. **${m}**`).join('\n') +
          `\n\n*(Note: Staff accounts cannot be created here; staff must register directly on the mobile app).*`,
      },
      { status: 400 }
    );
  }

  // Strict 3-Role Enforcement: Only SUPER_ADMIN (or SYSTEM_ADMIN) and GMD
  let canonicalRole: 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'GMD' | null = null;
  if (rawRole === 'GMD' || rawRole === 'GROUP_MANAGING_DIRECTOR') {
    canonicalRole = 'GMD';
  } else if (rawRole === 'SUPER_ADMIN' || rawRole === 'SYSTEM_ADMIN' || rawRole === 'ADMIN') {
    canonicalRole = 'SUPER_ADMIN';
  } else {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'INVALID_ROLE',
        message: 'Strict 3-Role Architecture: Admin onboarding is strictly limited to "SUPER_ADMIN" or "GMD". Staff must use self-service portal.',
      },
      { status: 400 }
    );
  }

  // Role escalation check: Only a Super Admin can invite another Super Admin
  const isActorSuperAdmin = actor.role === 'SYSTEM_ADMIN' || actor.role === 'SUPER_ADMIN';
  if (canonicalRole === 'SUPER_ADMIN' && !isActorSuperAdmin) {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'FORBIDDEN_ESCALATION',
        message: 'Only a Super Admin can stage or issue a Super Admin executive invitation.',
      },
      { status: 403 }
    );
  }

  // Check if user already exists
  const existingEmployee = await db.employee.findFirst({
    where: {
      OR: [{ workEmail }, { phone: phone ? phone : undefined }],
    },
  });

  if (existingEmployee) {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'ALREADY_EXISTS',
        message: `An employee with email "${workEmail}" already exists (Role: ${existingEmployee.role}).`,
      },
      { status: 409 }
    );
  }

  // Resolve subsidiary
  const requestedOrganization = normalizeOrganizationIdentifier(subsidiaryId || 'BEMS-GROUP');
  const targetSub = await db.organization.findFirst({ where: { status: 'ACTIVE', OR: [{ id: requestedOrganization }, { code: requestedOrganization }] } });
  if (!targetSub) return NextResponse.json({ ok: false, error_code: 'ORGANIZATION_NOT_FOUND', message: 'The selected organization was not found or is outside your authorized scope.' }, { status: 404 });
  const orgId = targetSub.id;
  const orgName = targetSub.legalName;
  const positionName = canonicalRole === 'GMD' ? 'The Group Managing Director' : 'Super Admin';

  // Single active GMD check before staging
  if (canonicalRole === 'GMD') {
    const existingGmd = await db.employee.findFirst({
      where: { role: 'GMD', status: 'ACTIVE', approvalStatus: 'APPROVED' },
      select: { id: true, legalName: true, workEmail: true },
    });
    if (existingGmd) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'GMD_ALREADY_EXISTS',
          message: `The system only permits one Group Managing Director (GMD). An active GMD already exists: ${existingGmd.legalName} (${existingGmd.workEmail}).`,
        },
        { status: 409 }
      );
    }
  }

  // Stage canonical executive invitation proposal (requires human button click to dispatch invite)
  const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
    actionType: 'admin_onboarding',
    summary: `Send Executive Invitation to ${legalName} (${workEmail}) as ${canonicalRole} at ${orgName}`,
    materialPayload: {
      legalName,
      workEmail,
      phone,
      role: canonicalRole,
      subsidiaryId: orgId,
      positionName,
    },
    preview: {
      legalName,
      workEmail,
      phone,
      role: canonicalRole,
      positionName,
      subsidiary: orgName,
    },
  });

  return NextResponse.json({
    ok: true,
    status: 'AWAITING_CONFIRMATION',
    requires_gmd_action: true,
    message: `Executive invitation for "${legalName}" (${workEmail}) as ${canonicalRole} has been staged. Click the confirmation button to dispatch the invitation email.`,
    staged_action_id: staged.staged_action_id,
    confirmation_hash: staged.confirmation_hash,
    confirmation_button: staged.confirmation_button,
    staged_action: staged.staged_action,
  });
}
