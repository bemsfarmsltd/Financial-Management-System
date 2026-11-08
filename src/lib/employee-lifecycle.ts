import { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import {
  type AuthenticatedEmployee,
  getHrAuthorizationScope,
  hasAnyRole,
  invalidateSessionCache,
} from '@/lib/auth';

export const SAFE_EMPLOYEE_SELECT = {
  id: true,
  employeeNumber: true,
  legalName: true,
  workEmail: true,
  phone: true,
  role: true,
  status: true,
  approvalStatus: true,
  avatarUrl: true,
  jobTitle: true,
  employmentType: true,
  resumptionDate: true,
  workLocation: true,
  staffGrade: true,
  gender: true,
  dateOfBirth: true,
  residentialAddress: true,
  cityState: true,
  maritalStatus: true,
  stateOfOrigin: true,
  lga: true,
  nin: true,
  bvn: true,
  highestEducation: true,
  isOfflineStaff: true,
  bankName: true,
  accountNumber: true,
  accountName: true,
  salaryBankName: true,
  salaryAccountNumber: true,
  salaryAccountName: true,
  nextOfKinName: true,
  nextOfKinPhone: true,
  nextOfKinRelationship: true,
  nextOfKinAddress: true,
  createdAt: true,
} as const;

export type SafeEmployeeProjection = {
  id: string;
  employeeNumber: string;
  legalName: string;
  workEmail: string;
  phone: string | null;
  role: string;
  status: string;
  approvalStatus: string;
};

export class LifecycleAuthorizationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'LifecycleAuthorizationError';
    this.statusCode = statusCode;
  }
}

export async function recordEmployeeAuditEvent(params: {
  actor: AuthenticatedEmployee; targetId: string; action: string;
  subsidiaryId?: string | null; metadata?: Record<string, unknown>;
}, client: Prisma.TransactionClient = prisma) {
  const organization = params.subsidiaryId
    ? await client.organization.findUnique({ where: { id: params.subsidiaryId }, select: { id: true, parentGroupId: true } })
    : await client.organization.findFirst({ where: { type: 'GROUP' }, select: { id: true, parentGroupId: true } });
  if (!organization) throw new Error('An actual organization is required for the employee audit.');
  await client.auditEvent.create({ data: {
    actorId: params.actor.id, actorName: params.actor.legalName, actorRole: params.actor.role,
    groupId: organization.parentGroupId || organization.id, subsidiaryId: params.subsidiaryId || null,
    targetType: 'EMPLOYEE', targetId: params.targetId, action: params.action,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null, correlationId: crypto.randomUUID(),
  } });
}

async function inLifecycleTransaction<T>(client: Prisma.TransactionClient | undefined, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return client ? work(client) : prisma.$transaction(work, { isolationLevel: 'Serializable' });
}

export async function assertSingleActiveGmd(excludeEmployeeId?: string, client: Prisma.TransactionClient = prisma) {
  const existingGmd = await client.employee.findFirst({
    where: {
      role: 'GMD',
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
    },
    select: { id: true, legalName: true, workEmail: true },
  });

  if (existingGmd) {
    throw new LifecycleAuthorizationError(
      `The system can only have one Group Managing Director (GMD). Active GMD is ${existingGmd.legalName} (${existingGmd.workEmail}).`,
      409
    );
  }
}

export async function verifyTargetEmployeeAccess(
  actor: AuthenticatedEmployee,
  targetEmployeeId: string,
  options?: { allowExecutiveTarget?: boolean },
  client: Prisma.TransactionClient = prisma
) {
  const isExecutive = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
  const hrScope = await getHrAuthorizationScope(actor);

  if (!isExecutive && !hrScope.authorized) {
    throw new LifecycleAuthorizationError('Executive or authorized HR access is required.', 403);
  }

  const target = await client.employee.findUnique({
    where: { id: targetEmployeeId },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        select: { id: true, subsidiaryId: true, departmentId: true, positionName: true, isPrimary: true },
      },
    },
  });

  if (!target) {
    throw new LifecycleAuthorizationError('Target employee record not found.', 404);
  }

  if(process.env.BEMS_WALLET_ENABLED==='true' && target.id===process.env.BEMS_FINANCIAL_GMD_ID && actor.id!==target.id) throw new LifecycleAuthorizationError('The designated GMD account requires its own authenticated owner. Use the controlled recovery procedure.',403);
  const isTargetExecutive = ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(
    (target.role || '').toUpperCase()
  );

  if (['SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(target.role) && !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN'])) throw new LifecycleAuthorizationError('Only a Super Admin can modify a Super Admin account.', 403);
  if (target.role === 'GMD' && !hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) throw new LifecycleAuthorizationError('Only the active GMD can modify the GMD account.', 403);

  // HR can NEVER mutate executive accounts
  if (!isExecutive) {
    if (isTargetExecutive || target.role !== 'STAFF') {
      throw new LifecycleAuthorizationError(
        'Forbidden: HR cannot modify executive or administrative accounts.',
        403
      );
    }

    // Enforce subsidiary scope for HR callers
    if (!hrScope.isGlobal) {
      const targetSubIds = target.assignments.map((a) => a.subsidiaryId);
      const hasSharedSubsidiary = targetSubIds.some((subId) =>
        hrScope.subsidiaryIds.includes(subId)
      );
      if (!hasSharedSubsidiary) {
        throw new LifecycleAuthorizationError(
          'Forbidden: Target staff member is outside your authorized HR subsidiary scope.',
          403
        );
      }
    }
  } else if (isTargetExecutive && options?.allowExecutiveTarget === false) {
    throw new LifecycleAuthorizationError(
      'Executive accounts cannot be modified through the staff HR endpoint.',
      403
    );
  }

  return { target, isExecutive, hrScope };
}

export async function approveEmployeeOnboarding(params: {
  actor: AuthenticatedEmployee;
  targetEmployeeId: string;
  assignedRole?: string;
  subsidiaryId?: string | null;
  departmentId?: string | null;
  positionName?: string | null;
  requireStaffRoleOnly?: boolean;
}, client?: Prisma.TransactionClient) {
  const { target, isExecutive, hrScope } = await verifyTargetEmployeeAccess(
    params.actor,
    params.targetEmployeeId,
    { allowExecutiveTarget: !params.requireStaffRoleOnly }, client || prisma
  );

  if (target.approvalStatus !== 'PENDING_APPROVAL') {
    throw new LifecycleAuthorizationError(
      `Cannot approve onboarding: account is currently ${target.approvalStatus} (must be PENDING_APPROVAL).`,
      400
    );
  }

  const requestedRole = (params.assignedRole || target.role || 'STAFF').toUpperCase();
  const allowedRoles = ['STAFF', 'GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'];
  if (!allowedRoles.includes(requestedRole)) throw new LifecycleAuthorizationError('Unsupported onboarding role.', 400);
  const finalRole = requestedRole;

  if (params.requireStaffRoleOnly && finalRole !== 'STAFF') {
    throw new LifecycleAuthorizationError(
      'HR onboarding approval is strictly limited to STAFF accounts.',
      403
    );
  }

  if (finalRole !== 'STAFF' && !isExecutive) {
    throw new LifecycleAuthorizationError(
      'Only an Executive (GMD or Super Admin) can approve an executive role.',
      403
    );
  }

  const isActorSuperAdmin = hasAnyRole(params.actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN']);
  if ((finalRole === 'SYSTEM_ADMIN' || finalRole === 'SUPER_ADMIN') && !isActorSuperAdmin) {
    throw new LifecycleAuthorizationError(
      'Only a Super Admin can grant Super Admin privileges.',
      403
    );
  }

  if (finalRole === 'GMD') {
    await assertSingleActiveGmd(target.id, client || prisma);
  }

  if (params.subsidiaryId && !isExecutive && !hrScope.isGlobal) {
    if (!hrScope.subsidiaryIds.includes(params.subsidiaryId)) {
      throw new LifecycleAuthorizationError(
        'Forbidden: Cannot assign staff to a subsidiary outside your HR scope.',
        403
      );
    }
  }

  const targetSubsidiaryId = params.subsidiaryId || target.assignments[0]?.subsidiaryId;
  if (targetSubsidiaryId && !await (client || prisma).organization.findFirst({ where: { id: targetSubsidiaryId, status: 'ACTIVE' } })) throw new LifecycleAuthorizationError('Choose an active subsidiary.', 400);
  if (params.departmentId) {
    const department = await (client || prisma).department.findUnique({ where: { id: params.departmentId } });
    if (!department || department.organizationId !== targetSubsidiaryId) throw new LifecycleAuthorizationError('The department must belong to the selected subsidiary.', 400);
  }

  const officialEmpNum = target.employeeNumber.startsWith('PENDING-')
    ? `BEMS-${finalRole.slice(0, 3)}-${crypto.randomUUID().slice(0, 12)}`
    : target.employeeNumber;

  const updated = await inLifecycleTransaction(client, async (tx) => {
    const current = await tx.employee.findUnique({ where: { id: target.id } });
    if (!current || current.status !== target.status || current.approvalStatus !== target.approvalStatus || current.role !== target.role) throw new LifecycleAuthorizationError('The employee changed. Refresh before retrying.', 409);
    const emp = await tx.employee.update({
      where: { id: target.id },
      data: {
        employeeNumber: officialEmpNum,
        role: finalRole,
        approvalStatus: 'APPROVED',
        status: 'ACTIVE',
      },
      select: SAFE_EMPLOYEE_SELECT,
    });

    const existingAssignment = await tx.employeeAssignment.findFirst({
      where: { employeeId: target.id, isPrimary: true },
    });

    if (existingAssignment) {
      await tx.employeeAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          status: 'ACTIVE',
          ...(params.subsidiaryId ? { subsidiaryId: params.subsidiaryId } : {}),
          ...(params.subsidiaryId && params.subsidiaryId !== existingAssignment.subsidiaryId ? { departmentId: params.departmentId || null } : params.departmentId ? { departmentId: params.departmentId } : {}),
          ...(params.positionName ? { positionName: params.positionName } : {}),
        },
      });
    } else if (params.subsidiaryId) {
      await tx.employeeAssignment.create({
        data: {
          employeeId: target.id,
          subsidiaryId: params.subsidiaryId,
          departmentId: params.departmentId || null,
          positionName: params.positionName || target.jobTitle || finalRole,
          isPrimary: true,
          status: 'ACTIVE',
        },
      });
    }

    await tx.systemNotification.create({
      data: {
        employeeId: target.id,
        kind: 'SIGNUP_APPROVED',
        title: 'Account Approved',
        body: `Your account has been approved with role ${finalRole}. You can now sign in.`,
        linkUrl: '/dashboard',
      },
    });

  await recordEmployeeAuditEvent({
    actor: params.actor,
    targetId: target.id,
    action: 'ONBOARDING_APPROVED',
    subsidiaryId: params.subsidiaryId || target.assignments[0]?.subsidiaryId || null,
    metadata: { assignedRole: finalRole, employeeNumber: officialEmpNum },
  }, tx);

    return emp;
  });



  return updated;
}

export async function rejectEmployeeOnboarding(params: {
  actor: AuthenticatedEmployee;
  targetEmployeeId: string;
  rejectionReason?: string | null;
  requireStaffRoleOnly?: boolean;
}, client?: Prisma.TransactionClient) {
  const { target } = await verifyTargetEmployeeAccess(
    params.actor,
    params.targetEmployeeId,
    { allowExecutiveTarget: !params.requireStaffRoleOnly }, client || prisma
  );

  if (target.approvalStatus !== 'PENDING_APPROVAL') {
    throw new LifecycleAuthorizationError(
      `Cannot reject onboarding: account is currently ${target.approvalStatus} (must be PENDING_APPROVAL).`,
      400
    );
  }

  const updated = await inLifecycleTransaction(client, async (tx) => {
    const current = await tx.employee.findUnique({ where: { id: target.id } });
    if (!current || current.status !== target.status || current.approvalStatus !== target.approvalStatus || current.role !== target.role) throw new LifecycleAuthorizationError('The employee changed. Refresh before retrying.', 409);
    const emp = await tx.employee.update({
      where: { id: target.id },
      data: {
        approvalStatus: 'REJECTED',
        status: 'TERMINATED',
      },
      select: SAFE_EMPLOYEE_SELECT,
    });

    await tx.employeeAssignment.updateMany({ where: { employeeId: target.id }, data: { status: 'INACTIVE' } });
    await tx.authSession.deleteMany({
      where: { employeeId: target.id },
    });

    await tx.systemNotification.create({
      data: {
        employeeId: target.id,
        kind: 'SIGNUP_REJECTED',
        title: 'Onboarding Declined',
        body: params.rejectionReason
          ? `Your onboarding registration was not approved: ${params.rejectionReason}`
          : 'Your onboarding registration was not approved.',
        linkUrl: '/dashboard',
      },
    });

  await recordEmployeeAuditEvent({
    actor: params.actor,
    targetId: target.id,
    action: 'ONBOARDING_REJECTED',
    subsidiaryId: target.assignments[0]?.subsidiaryId || null,
    metadata: { reason: params.rejectionReason || null },
  }, tx);

    return emp;
  });

  invalidateSessionCache();



  return updated;
}

export async function transitionEmployeeStatus(params: {
  actor: AuthenticatedEmployee;
  targetEmployeeId: string;
  nextStatus: 'ACTIVE' | 'SUSPENDED' | 'ON_LEAVE' | 'TERMINATED';
  reason?: string | null;
  requireStaffRoleOnly?: boolean;
}, client?: Prisma.TransactionClient) {
  const validStatuses = ['ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'TERMINATED'];
  if (!validStatuses.includes(params.nextStatus)) {
    throw new LifecycleAuthorizationError(
      `Invalid status "${params.nextStatus}". Allowed: ${validStatuses.join(', ')}`,
      400
    );
  }

  if (params.actor.id === params.targetEmployeeId) {
    throw new LifecycleAuthorizationError(
      'Action denied: You cannot change the lifecycle status of your own active account.',
      400
    );
  }

  const { target, isExecutive } = await verifyTargetEmployeeAccess(
    params.actor,
    params.targetEmployeeId,
    { allowExecutiveTarget: !params.requireStaffRoleOnly }, client || prisma
  );

  // Only approved accounts can be transitioned to ACTIVE / ON_LEAVE / SUSPENDED via status update
  if (params.nextStatus === 'ACTIVE' && target.approvalStatus !== 'APPROVED') {
    throw new LifecycleAuthorizationError(
      'Cannot activate an account whose onboarding has not been approved.',
      400
    );
  }

  const isTargetSuperAdmin = ['SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(
    (target.role || '').toUpperCase()
  );
  const isActorSuperAdmin = hasAnyRole(params.actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN']);
  if (isTargetSuperAdmin && !isActorSuperAdmin) {
    throw new LifecycleAuthorizationError(
      'Only a Super Admin can modify the status of another Super Admin account.',
      403
    );
  }

  if (params.nextStatus === 'ACTIVE' && target.role === 'GMD') {
    await assertSingleActiveGmd(target.id, client || prisma);
  }

  if (!isExecutive && params.nextStatus === 'SUSPENDED') {
    // Allow HR to set ACTIVE, ON_LEAVE, TERMINATED, or SUSPENDED on STAFF within scope
  }

  const updated = await inLifecycleTransaction(client, async (tx) => {
    const current = await tx.employee.findUnique({ where: { id: target.id } });
    if (!current || current.status !== target.status || current.approvalStatus !== target.approvalStatus || current.role !== target.role) throw new LifecycleAuthorizationError('The employee changed. Refresh before retrying.', 409);
    const emp = await tx.employee.update({
      where: { id: target.id },
      data: { status: params.nextStatus },
      select: SAFE_EMPLOYEE_SELECT,
    });

    if (params.nextStatus === 'TERMINATED') await tx.employeeAssignment.updateMany({ where: { employeeId: target.id }, data: { status: 'INACTIVE' } });
    if (params.nextStatus === 'ACTIVE') await tx.employeeAssignment.updateMany({ where: { employeeId: target.id, isPrimary: true }, data: { status: 'ACTIVE' } });
    if (params.nextStatus === 'SUSPENDED' || params.nextStatus === 'TERMINATED') {
      await tx.authSession.deleteMany({
        where: { employeeId: target.id },
      });
    }

  await recordEmployeeAuditEvent({
    actor: params.actor,
    targetId: target.id,
    action: `STATUS_${params.nextStatus}`,
    subsidiaryId: target.assignments[0]?.subsidiaryId || null,
    metadata: {
      previousStatus: target.status,
      nextStatus: params.nextStatus,
      reason: params.reason || null,
    },
  }, tx);

    return emp;
  });

  if (params.nextStatus === 'SUSPENDED' || params.nextStatus === 'TERMINATED') {
    invalidateSessionCache();
  }



  return updated;
}

