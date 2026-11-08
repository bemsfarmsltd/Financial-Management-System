import { getAiReadClient } from '@/lib/platform/scoped-database';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';
import { checkAiScopeOrResponse } from '@/lib/ai-access-control';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/tools/staff
 * Read-only query of staff profiles, assignments, status, and attendance exemption flags.
 */
export async function GET(request: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(request);
  const db = actor ? await getAiReadClient(actor) : prisma;
  if (errorResponse || !actor) return errorResponse!;
  if (!actor.isExecutive) {
    return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const authorizedScope = await resolveAuthorizedOrganizationScope(actor as any, searchParams.get('subsidiary_id') || searchParams.get('subsidiary') || searchParams.get('organization_id') || 'ALL');
  const query = (searchParams.get('query') || searchParams.get('search') || '').trim();
  const subsidiaryId = searchParams.get('subsidiary_id') || searchParams.get('subsidiaryId') || undefined;
  const status = searchParams.get('status') || undefined;

  const where: any = { assignments: { some: { subsidiaryId: { in: authorizedScope.organizationIds }, status: 'ACTIVE' } } };
  if (status) where.status = status.toUpperCase();
  if (subsidiaryId) {
    where.assignments = { some: { subsidiaryId: { in: authorizedScope.organizationIds.filter(id => id === subsidiaryId) }, status: 'ACTIVE' } };
  }
  if (query) {
    where.OR = [
      { legalName: { contains: query, mode: 'insensitive' } },
      { workEmail: { contains: query, mode: 'insensitive' } },
      { employeeNumber: { contains: query, mode: 'insensitive' } },
      { jobTitle: { contains: query, mode: 'insensitive' } },
    ];
  }

  const staff = await db.employee.findMany({
    where,
    include: {
      assignments: {
        where: { subsidiaryId: { in: authorizedScope.organizationIds }, status: 'ACTIVE' },
        include: { subsidiary: { select: { id: true, code: true, legalName: true } }, department: { select: { id: true, name: true } } },
      },
    },
    orderBy: { legalName: 'asc' },
    take: 100,
  });

  return NextResponse.json({
    ok: true,
    count: staff.length,
    staff: staff.map((s) => ({
      id: s.id,
      employeeNumber: s.employeeNumber,
      legalName: s.legalName,
      workEmail: s.workEmail,
      phone: s.phone,
      role: s.role,
      status: s.status,
      approvalStatus: s.approvalStatus,
      jobTitle: s.jobTitle || s.assignments[0]?.positionName || 'Staff',
      staffGrade: s.staffGrade,
      isAttendanceExempt: s.isAttendanceExempt,
      isOfflineStaff: s.isOfflineStaff,
      subsidiary: s.assignments[0]?.subsidiary || null,
      department: s.assignments[0]?.department || null,
      bankName: s.salaryBankName || s.bankName,
      accountNumber: s.salaryAccountNumber || s.accountNumber,
    })),
  });
}

/**
 * POST /api/ai/tools/staff
 * Stage staff management mutations:
 * - EDIT_PROFILE
 * - TOGGLE_ATTENDANCE_EXEMPT
 * - CHANGE_STATUS (ACTIVE | SUSPENDED | TERMINATED)
 * - REGISTER_OFFLINE
 * - REQUEST_UPDATE
 * - DELETE_OR_DEACTIVATE
 */
export async function POST(request: NextRequest) {
  try {
    const { actor, errorResponse } = await authenticateAiToolRequest(request);
  const db = actor ? await getAiReadClient(actor) : prisma;
    if (errorResponse || !actor) return errorResponse!;
    if (!actor.isExecutive) {
      return NextResponse.json({ ok: false, error: 'Executive access required.' }, { status: 403 });
    }

    const body = await request.json();
    const subAction = String(body.action || body.sub_action || body.action_type || 'EDIT_PROFILE').toUpperCase();

    const targetScope =
      subAction === 'TOGGLE_ATTENDANCE_EXEMPT' ||
      subAction === 'CHANGE_STATUS' ||
      subAction === 'DELETE_OR_DEACTIVATE'
        ? 'staff_status'
        : 'staff_profiles';
    const scopeBlocked = await checkAiScopeOrResponse(targetScope, 'write');
    if (scopeBlocked) return scopeBlocked;

    if (subAction === 'REGISTER_OFFLINE') {
      const legalName = String(body.legalName || body.legal_name || '').trim();
      if (!legalName) {
        return NextResponse.json({ error: 'legalName is required to register offline staff.' }, { status: 400 });
      }
      const subsidiaryQuery = String(body.subsidiaryId || body.subsidiary_id || body.subsidiary || '').trim();
      const org = subsidiaryQuery
        ? await db.organization.findFirst({
            where: {
              OR: [
                { id: subsidiaryQuery },
                { code: { equals: subsidiaryQuery, mode: 'insensitive' } },
                { legalName: { contains: subsidiaryQuery, mode: 'insensitive' } },
              ],
            },
          })
        : await db.organization.findFirst({ orderBy: { type: 'asc' } });

      if (!org) {
        return NextResponse.json({ error: 'Target subsidiary organization not found.' }, { status: 404 });
      }

      const jobTitle = String(body.jobTitle || body.job_title || 'Field Staff').trim();
      const proposedSalary = Number(body.proposedSalary ?? body.proposed_salary ?? 0);

      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'staff_management',
        targetSubsidiaryId: org.id,
        summary: `Register Offline Staff: ${legalName} (${jobTitle} at ${org.legalName})`,
        materialPayload: {
          sub_action: 'REGISTER_OFFLINE',
          legalName,
          phone: body.phone || null,
          gender: body.gender || 'MALE',
          subsidiaryId: org.id,
          departmentId: body.departmentId || body.department_id || null,
          jobTitle,
          employmentType: body.employmentType || 'FULL_TIME',
          staffGrade: body.staffGrade || null,
          proposedSalary,
          bankName: body.bankName || null,
          accountNumber: body.accountNumber || null,
          accountName: body.accountName || legalName,
          kioskPin: body.kioskPin || null,
        },
        preview: {
          operation: 'Register Offline / Field Staff',
          staff_name: legalName,
          job_title: jobTitle,
          subsidiary: `${org.legalName} (${org.code})`,
          proposed_monthly_salary: proposedSalary > 0 ? `₦${proposedSalary.toLocaleString()}` : 'Not set',
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        message: `Staged offline staff registration for ${legalName}. Click Confirm to create the staff record.`,
        ...staged,
      });
    }

    const employeeLookup = String(
      body.employeeId || body.employee_id || body.employeeEmail || body.employeeName || body.query || ''
    ).trim();
    if (!employeeLookup) {
      return NextResponse.json(
        { error: 'employeeId, employeeEmail, or employeeName is required.' },
        { status: 400 }
      );
    }

    const emp = await db.employee.findFirst({
      where: {
        OR: [
          { id: employeeLookup },
          { employeeNumber: { equals: employeeLookup, mode: 'insensitive' } },
          { workEmail: { equals: employeeLookup, mode: 'insensitive' } },
          { legalName: { contains: employeeLookup, mode: 'insensitive' } },
        ],
      },
      include: {
        assignments: {
          where: { isPrimary: true },
          include: { subsidiary: true, department: true },
        },
      },
    });

    if (!emp) {
      return NextResponse.json({ error: `Staff member "${employeeLookup}" not found.` }, { status: 404 });
    }

    let targetSubsidiaryId = body.subsidiaryId || body.subsidiary_id;
    let targetSubsidiaryLabel: string | undefined;
    if (!targetSubsidiaryId && body.subsidiary) {
      const subOrg = await db.organization.findFirst({
        where: {
          OR: [
            { id: String(body.subsidiary) },
            { code: { equals: String(body.subsidiary), mode: 'insensitive' } },
            { legalName: { contains: String(body.subsidiary), mode: 'insensitive' } },
          ],
        },
      });
      if (subOrg) {
        targetSubsidiaryId = subOrg.id;
        targetSubsidiaryLabel = `${subOrg.legalName} (${subOrg.code})`;
      }
    }

    const materialPayload: Record<string, any> = {
      sub_action: subAction,
      employeeId: emp.id,
      legalName: body.legalName ?? body.legal_name,
      workEmail: body.workEmail ?? body.work_email,
      phone: body.phone,
      jobTitle: body.jobTitle ?? body.job_title,
      staffGrade: body.staffGrade ?? body.staff_grade,
      residentialAddress: body.residentialAddress ?? body.residential_address,
      subsidiaryId: targetSubsidiaryId,
      departmentId: body.departmentId ?? body.department_id,
      isAttendanceExempt: body.isAttendanceExempt ?? body.is_attendance_exempt,
      status: body.status,
      requestedFields: body.requestedFields ?? body.requested_fields,
      instructions: body.instructions,
    };

    const preview: Record<string, any> = {
      operation: subAction.replace(/_/g, ' '),
      staff_member: `${emp.legalName} (${emp.employeeNumber})`,
      current_email: emp.workEmail,
      current_role_title: emp.jobTitle || emp.assignments[0]?.positionName || 'Staff',
      current_subsidiary: emp.assignments[0]?.subsidiary?.legalName || 'Unassigned',
    };

    if (materialPayload.legalName) preview.new_legal_name = materialPayload.legalName;
    if (materialPayload.workEmail) preview.new_work_email = materialPayload.workEmail;
    if (materialPayload.phone !== undefined) preview.new_phone = materialPayload.phone;
    if (materialPayload.jobTitle !== undefined) preview.new_job_title = materialPayload.jobTitle;
    if (targetSubsidiaryLabel) preview.new_subsidiary = targetSubsidiaryLabel;
    if (materialPayload.isAttendanceExempt !== undefined) {
      preview.attendance_exempt = Boolean(materialPayload.isAttendanceExempt) ? 'EXEMPT (Bypass Clock-in)' : 'REQUIRED (Standard Clock-in)';
    }
    if (materialPayload.status) preview.new_status = String(materialPayload.status).toUpperCase();

    if (subAction === 'APPROVE_ONBOARDING' || subAction === 'REJECT_ONBOARDING') {
      const isReject = subAction === 'REJECT_ONBOARDING';
      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'staff_approval',
        targetEmployeeId: emp.id,
        targetSubsidiaryId: emp.assignments[0]?.subsidiaryId,
        summary: `${isReject ? 'Reject' : 'Approve'} Staff Onboarding for ${emp.legalName} (${emp.employeeNumber})`,
        materialPayload: {
          employee_id: emp.id,
          decision: isReject ? 'REJECT' : 'APPROVE',
          reason: body.reason || (isReject ? 'Onboarding declined by executive' : 'Onboarding approved by executive'),
        },
        preview: {
          operation: isReject ? 'Reject Staff Onboarding' : 'Approve Staff Onboarding',
          staff_member: `${emp.legalName} (${emp.employeeNumber})`,
          current_approval_status: emp.approvalStatus,
          decision: isReject ? 'REJECTED' : 'APPROVED',
        },
      });
      return NextResponse.json({
        ok: true,
        staged: true,
        message: `Staged onboarding ${isReject ? 'rejection' : 'approval'} for ${emp.legalName}.`,
        ...staged,
      });
    }

    if (subAction === 'SEND_PASSWORD_RESET_INVITE' || subAction === 'RESET_PASSWORD_INVITE') {
      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'staff_management',
        targetEmployeeId: emp.id,
        targetSubsidiaryId: emp.assignments[0]?.subsidiaryId,
        summary: `Send Authorized Password Reset Invitation to ${emp.legalName} (${emp.workEmail})`,
        materialPayload: {
          sub_action: 'SEND_PASSWORD_RESET_INVITE',
          employeeId: emp.id,
          workEmail: emp.workEmail,
          reason: body.reason || 'Executive-authorized password reset invitation',
        },
        preview: {
          operation: 'Send Password Reset Invitation',
          staff_member: `${emp.legalName} (${emp.employeeNumber})`,
          work_email: emp.workEmail,
          security_notice: 'Identity verification and secret entry remain on the dedicated secure password reset UI.',
        },
      });
      return NextResponse.json({
        ok: true,
        staged: true,
        message: `Staged authorized password-reset invitation for ${emp.legalName} (${emp.workEmail}).`,
        ...staged,
      });
    }

    if (subAction === 'CHANGE_ROLE' || subAction === 'ROLE_CHANGE') {
      const requestedRole = String(body.newRole || body.new_role || body.role || '').trim().toUpperCase();
      if (!['STAFF', 'GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(requestedRole)) {
        return NextResponse.json(
          { error: `Invalid role "${requestedRole}". Only STAFF, GMD, and SUPER_ADMIN exist in the 3-role architecture.` },
          { status: 400 }
        );
      }
      const canonicalRole = requestedRole === 'SYSTEM_ADMIN' ? 'SUPER_ADMIN' : requestedRole;
      const reason = String(body.reason || 'Executive role reassignment via BEMI').trim();

      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'role_change',
        targetEmployeeId: emp.id,
        targetSubsidiaryId: emp.assignments[0]?.subsidiaryId,
        summary: `Change System Role for ${emp.legalName} (${emp.employeeNumber}) from ${emp.role} to ${canonicalRole}`,
        materialPayload: {
          employee_id: emp.id,
          new_role: canonicalRole,
          expected_role: emp.role,
          reason,
        },
        preview: {
          operation: 'CHANGE SYSTEM ROLE',
          staff_member: `${emp.legalName} (${emp.employeeNumber})`,
          prior_role: emp.role,
          new_role: canonicalRole,
          reason,
        },
      });

      return NextResponse.json({
        ok: true,
        staged: true,
        message: `Staged role change for ${emp.legalName} (${emp.role} → ${canonicalRole}). Click Confirm in chat to commit.`,
        ...staged,
      });
    }

    const summary =
      subAction === 'TOGGLE_ATTENDANCE_EXEMPT'
        ? `Set Attendance Exemption (${Boolean(materialPayload.isAttendanceExempt ?? !emp.isAttendanceExempt) ? 'Exempt' : 'Required'}) for ${emp.legalName}`
        : subAction === 'CHANGE_STATUS'
        ? `Change Staff Status to ${String(materialPayload.status || 'ACTIVE').toUpperCase()} for ${emp.legalName}`
        : subAction === 'DELETE_OR_DEACTIVATE'
        ? `Deactivate / Remove Staff Account: ${emp.legalName} (${emp.employeeNumber})`
        : subAction === 'REQUEST_UPDATE'
        ? `Send Profile Update Request to ${emp.legalName}`
        : `Update Staff Profile: ${emp.legalName} (${emp.employeeNumber})`;

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'staff_management',
      targetEmployeeId: emp.id,
      targetSubsidiaryId: targetSubsidiaryId || emp.assignments[0]?.subsidiaryId,
      summary,
      materialPayload,
      preview,
    });

    return NextResponse.json({
      ok: true,
      staged: true,
      message: `Staged ${summary}. Click Confirm in chat to commit this change.`,
      ...staged,
    });
  } catch (error: any) {
    console.error('[AI Tool Staff POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to stage staff management action.' }, { status: 500 });
  }
}
