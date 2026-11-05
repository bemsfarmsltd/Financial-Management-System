import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { sendAdminInvitationEmail } from '@/lib/email';
import { randomBytes } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Only GMD or Super Admin can onboard an executive admin.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
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

  // Check if user already exists
  const existingEmployee = await prisma.employee.findFirst({
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
  const allSubs = await prisma.organization.findMany({ where: { status: 'ACTIVE' }, take: 10 });
  const targetSub = (subsidiaryId ? allSubs.find((s) => s.id === subsidiaryId) : null) ||
    allSubs.find((s) => s.type === 'GROUP' || s.code === 'BEMS-GROUP') ||
    allSubs[0];

  const orgId = targetSub?.id || 'bems-group-hq';
  const orgCode = targetSub?.code || 'BEMS';

  // Generate employee number
  const count = await prisma.employee.count();
  const year = new Date().getFullYear();
  const employeeNumber = `${orgCode}-ADM-${year}-${String(count + 1).padStart(4, '0')}`;

  // Generate invite token
  const inviteToken = randomBytes(24).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const baseUrl = req.nextUrl.origin || 'https://bemserp.work';
  const acceptUrl = `${baseUrl}/onboard?token=${inviteToken}&email=${encodeURIComponent(workEmail)}`;

  // Create Employee with ACTIVE status and APPROVED status
  const newAdmin = await prisma.employee.create({
    data: {
      legalName,
      workEmail,
      phone: phone || null,
      employeeNumber,
      role: canonicalRole,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      isOfflineStaff: false,
      jobTitle: canonicalRole === 'GMD' ? 'The Group Managing Director' : 'Super Admin',
      assignments: {
        create: {
          subsidiaryId: orgId,
          positionName: canonicalRole === 'GMD' ? 'The Group Managing Director' : 'Super Admin',
          isPrimary: true,
        },
      },
      workSchedule: {
        create: {
          weeklyOffDays: '0,6',
          customShiftIn: '08:00',
          customShiftOut: '17:00',
        },
      },
    },
  });

  // Create AdminInvitation record
  try {
    await prisma.adminInvitation.create({
      data: {
        workEmail,
        role: canonicalRole,
        token: inviteToken,
        expiresAt: tokenExpiresAt,
        subsidiaryId: orgId,
        positionName: canonicalRole === 'GMD' ? 'The Group Managing Director' : 'Super Admin',
        invitedById: actor.id,
      },
    });
  } catch (e) {
    console.warn('Could not save AdminInvitation record:', e);
  }

  // Attempt email delivery
  let emailSent = false;
  try {
    await sendAdminInvitationEmail({
      to: workEmail,
      role: canonicalRole === 'GMD' ? 'The Group Managing Director' : 'Super Admin',
      subsidiaryName: targetSub?.legalName || 'BEMS Group',
      inviteToken,
    });
    emailSent = true;
  } catch (e) {
    console.warn('Executive invite email notification dispatch failed:', e);
  }

  // Audit event
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: orgId,
        subsidiaryId: orgId,
        targetType: 'POLICY',
        targetId: newAdmin.id,
        action: 'EXECUTIVE_ADMIN_ONBOARDED',
        correlationId: `ai_admin_${Date.now()}`,
        metadata: JSON.stringify({
          legalName,
          workEmail,
          role: canonicalRole,
          employeeNumber,
          via: 'AI_AGENT_TOOL',
        }),
      },
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    message: `Executive Admin "${legalName}" onboarded successfully as ${canonicalRole}.`,
    employee: {
      id: newAdmin.id,
      legalName: newAdmin.legalName,
      workEmail: newAdmin.workEmail,
      employeeNumber: newAdmin.employeeNumber,
      role: newAdmin.role,
      jobTitle: newAdmin.jobTitle,
      subsidiary: targetSub?.legalName || 'BEMS Group',
    },
    onboarding: {
      invitationUrl: acceptUrl,
      emailDelivered: emailSent,
      expiresAt: tokenExpiresAt.toISOString(),
    },
  });
}
