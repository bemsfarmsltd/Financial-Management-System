import crypto from 'node:crypto';
import { prisma } from './prisma';
import { sendAdminInvitationEmail, sendChatMessageEmail } from './email';
import {
  generateOperationalIntercompanyNotes,
  generatePayrollIntercompanyNotes,
  reconcileIntercompanyNotes,
} from './services/intercompany';
import { executeThreeWayMatch } from './services/three-way-match';
import {
  assertAiScopeAllowed,
  resolveScopeFromStagePayload,
} from './ai-access-control';
import { resolveAuthorizedOrganizationScope } from './organizations';
import { assertSingleActiveGmd } from './employee-lifecycle';
import { invalidateSessionCache } from './auth';
import {
  applyCanonicalCompensationChange,
  CompensationChangeType,
} from './services/compensation';

function normalizeThreeRole(rawRole: unknown): 'STAFF' | 'GMD' | 'SUPER_ADMIN' | null {
  const upper = String(rawRole || '').trim().toUpperCase();
  if (upper === 'STAFF') return 'STAFF';
  if (upper === 'GMD') return 'GMD';
  if (upper === 'SUPER_ADMIN' || upper === 'SYSTEM_ADMIN') return 'SUPER_ADMIN';
  return null;
}

async function assertValidRoleAndGmdUniqueness(
  tx: any,
  rawRole: unknown,
  excludeEmployeeId?: string
): Promise<'STAFF' | 'GMD' | 'SUPER_ADMIN'> {
  const canonical = normalizeThreeRole(rawRole);
  if (!canonical) {
    throw new Error(`Invalid target role "${rawRole}". Only STAFF, GMD, and SUPER_ADMIN exist.`);
  }
  if (canonical === 'GMD') {
    const existingGmd = await tx.employee.findFirst({
      where: {
        role: 'GMD',
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      },
      select: { id: true, legalName: true, workEmail: true },
    });
    if (existingGmd) {
      throw new StaleTargetError(
        `The system can only have one Group Managing Director (GMD). Active GMD is ${existingGmd.legalName} (${existingGmd.workEmail}).`
      );
    }
    await assertSingleActiveGmd(excludeEmployeeId).catch((err) => {
      throw new StaleTargetError(err.message);
    });
  }
  return canonical;
}

export const STAGED_ACTION_TTL_MINUTES = 15;

export class StaleTargetError extends Error {
  errorCode = 'TARGET_CHANGED';
  constructor(message: string) {
    super(message);
    this.name = 'StaleTargetError';
  }
}

export class StagedStateConflictError extends Error {
  errorCode: string;
  constructor(errorCode: string, message: string) {
    super(message);
    this.name = 'StagedStateConflictError';
    this.errorCode = errorCode;
  }
}

export class StagedValidationError extends Error {
  errorCode: string;
  constructor(errorCode: string, message: string) {
    super(message);
    this.name = 'StagedValidationError';
    this.errorCode = errorCode;
  }
}

export class StagedPermissionError extends Error {
  errorCode: string;
  constructor(errorCodeOrMessage: string, message?: string) {
    super(message ?? errorCodeOrMessage);
    this.name = 'StagedPermissionError';
    this.errorCode = message ? errorCodeOrMessage : 'NOT_PERMITTED';
  }
}

/**
 * Deterministically sorts object keys and computes a SHA-256 confirmation hash
 */
export function computeConfirmationHash(data: unknown): string {
  const normalize = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(normalize);
    return Object.keys(obj)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = normalize(obj[key]);
        return result;
      }, {});
  };

  const canonicalString = JSON.stringify(normalize(data));
  const hex = crypto.createHash('sha256').update(canonicalString).digest('hex');
  return `sha256:${hex}`;
}

export type StagedActionType =
  | 'budget'
  | 'approval_decision'
  | 'payment_record'
  | 'salary_change'
  | 'payment_recorder'
  | 'staff_approval'
  | 'role_change'
  | 'accountability_clearance'
  | 'deadline_extension'
  | 'treasury_account'
  | 'intercompany_note'
  | 'vendor_approval'
  | 'emergency_override'
  | 'attendance_override'
  | 'admin_onboarding'
  | 'subsidiary_creation'
  | 'subsidiary_update'
  | 'bank_account_update'
  | 'payroll_action'
  | 'staff_management'
  | 'request_creation'
  | 'grn_creation'
  | 'vendor_invoice_creation'
  | 'leave_action'
  | 'task_action'
  | 'staff_message'
  | 'policy_update';

export const SUPPORTED_STAGED_ACTION_TYPES: ReadonlySet<StagedActionType> = new Set<StagedActionType>([
  'budget',
  'approval_decision',
  'payment_record',
  'salary_change',
  'payment_recorder',
  'staff_approval',
  'role_change',
  'accountability_clearance',
  'deadline_extension',
  'treasury_account',
  'intercompany_note',
  'vendor_approval',
  'emergency_override',
  'attendance_override',
  'admin_onboarding',
  'subsidiary_creation',
  'subsidiary_update',
  'bank_account_update',
  'payroll_action',
  'staff_management',
  'request_creation',
  'grn_creation',
  'vendor_invoice_creation',
  'leave_action',
  'task_action',
  'staff_message',
  'policy_update',
]);

export function validateStageActionProposal(
  actionType: string,
  materialPayload: Record<string, any>,
  summary: string
): asserts actionType is StagedActionType {
  if (!SUPPORTED_STAGED_ACTION_TYPES.has(actionType as StagedActionType)) {
    throw new Error(`Unsupported staged action type: "${actionType}". Proposal rejected before card generation.`);
  }
  if (!summary || !String(summary).trim()) {
    throw new Error('A human-readable summary is required to stage an action.');
  }
  if (!materialPayload || typeof materialPayload !== 'object' || Array.isArray(materialPayload)) {
    throw new Error('materialPayload must be a non-empty object.');
  }

  switch (actionType as StagedActionType) {
    case 'approval_decision':
      if (!materialPayload.request_id || !materialPayload.decision) {
        throw new Error('approval_decision requires request_id and decision.');
      }
      break;
    case 'payment_record':
      if (!materialPayload.request_id || !(Number(materialPayload.amount) > 0)) {
        throw new Error('payment_record requires request_id and a positive amount.');
      }
      break;
    case 'payment_recorder':
      if (!materialPayload.request_id || !materialPayload.assignee_user_id) {
        throw new Error('payment_recorder requires request_id and assignee_user_id.');
      }
      break;
    case 'salary_change':
      if (!materialPayload.employee_id || Number.isNaN(Number(materialPayload.amount ?? materialPayload.new_base_salary))) {
        throw new Error('salary_change requires employee_id and numeric amount.');
      }
      break;
    case 'staff_approval':
      if (!materialPayload.employee_id) {
        throw new Error('staff_approval requires employee_id.');
      }
      break;
    case 'role_change': {
      if (!materialPayload.employee_id || !materialPayload.new_role) {
        throw new Error('role_change requires employee_id and new_role.');
      }
      const normalizedRole = normalizeThreeRole(materialPayload.new_role);
      if (!normalizedRole) {
        throw new Error(`Invalid target role "${materialPayload.new_role}". Only STAFF, GMD, and SUPER_ADMIN exist.`);
      }
      break;
    }
    case 'accountability_clearance':
      if (!materialPayload.case_id && !materialPayload.request_number) {
        throw new Error('accountability_clearance requires case_id or request_number.');
      }
      break;
    case 'deadline_extension':
      if (!materialPayload.case_id) {
        throw new Error('deadline_extension requires case_id.');
      }
      break;
    default:
      break;
  }
}

export interface StageActionInput {
  userId?: string;
  actorId?: string;
  actionType: StagedActionType;
  materialPayload: Record<string, any>;
  summary: string;
  preview?: Record<string, any>;
  clientPreview?: Record<string, any>;
  targetEmployeeId?: string;
  targetSubsidiaryId?: string;
  targetVersion?: string | number;
  warnings?: string[];
  blockingErrors?: string[];
}

export async function stageAction(input: StageActionInput) {
  const resolvedUserId = input.userId || input.actorId;
  if (!resolvedUserId) {
    throw new Error('userId is required to stage an action.');
  }

  validateStageActionProposal(input.actionType, input.materialPayload, input.summary);

  const resolvedSubsidiaryId =
    input.targetSubsidiaryId ||
    input.materialPayload.subsidiaryId ||
    input.materialPayload.organization_id ||
    input.materialPayload.organizationId ||
    input.materialPayload.subsidiary_id ||
    undefined;

  // Enforce Admin AI Write Access Control Matrix for the specific capability scope
  const requiredScope = resolveScopeFromStagePayload(input.actionType, input.materialPayload);
  await assertAiScopeAllowed(requiredScope, 'write', resolvedSubsidiaryId);

  const creator = await prisma.employee.findUnique({
    where: { id: resolvedUserId },
    select: { id: true, role: true, status: true, legalName: true },
  });
  if (!creator || creator.status !== 'ACTIVE') {
    throw new Error('Active authenticated employee required to stage actions.');
  }

  // Persist targetSubsidiaryId & targetEmployeeId in canonical materialPayload if provided
  const canonicalPayload: Record<string, any> = {
    ...input.materialPayload,
    ...(resolvedSubsidiaryId && !input.materialPayload.subsidiaryId && !input.materialPayload.organization_id
      ? { subsidiaryId: resolvedSubsidiaryId }
      : {}),
    ...(input.targetEmployeeId && !input.materialPayload.employee_id && !input.materialPayload.employeeId
      ? { employee_id: input.targetEmployeeId }
      : {}),
    ...(input.targetVersion !== undefined ? { expected_version: input.targetVersion } : {}),
  };

  const resolvedPreview = input.preview || input.clientPreview || {};
  const hash = computeConfirmationHash(canonicalPayload);
  const actionId = `sa_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const expiresAt = new Date(Date.now() + STAGED_ACTION_TTL_MINUTES * 60 * 1000);

  const staged = await prisma.stagedAction.create({
    data: {
      id: actionId,
      userId: resolvedUserId,
      actionType: input.actionType,
      confirmationHash: hash,
      payload: JSON.stringify(canonicalPayload),
      summary: input.summary,
      previewJson: JSON.stringify(resolvedPreview),
      warnings: input.warnings ? JSON.stringify(input.warnings) : null,
      blockingErrors: input.blockingErrors ? JSON.stringify(input.blockingErrors) : null,
      status: 'PENDING',
      expiresAt,
    },
  });

  const confirmEndpoint = `/api/ai/staged-actions/${staged.id}/confirm`;

  return {
    id: staged.id,
    staged_action_id: staged.id,
    confirmationHash: staged.confirmationHash,
    confirmation_hash: staged.confirmationHash,
    type: staged.actionType,
    staged_status: 'PENDING' as const,
    expires_at: staged.expiresAt.toISOString(),
    summary: staged.summary,
    preview: resolvedPreview,
    warnings: input.warnings || [],
    blocking_errors: input.blockingErrors || [],
    confirmation_button: {
      label: 'Authorize & Execute Action (GMD)',
      action_type: 'CONFIRM_STAGED_ACTION',
      endpoint: confirmEndpoint,
      method: 'POST',
      payload: {
        confirmation_hash: staged.confirmationHash,
      },
    },
    staged_action: {
      type: staged.actionType,
      cardType: 'STAGED_ACTION',
      staged_action_id: staged.id,
      confirmation_hash: staged.confirmationHash,
      summary: staged.summary,
      action_type: staged.actionType,
      status: 'PENDING' as const,
      expires_at: staged.expiresAt.toISOString(),
      payload_preview: resolvedPreview,
    },
  };
}

export interface ConfirmResult {
  ok: boolean;
  errorCode?: string;
  message?: string;
  status?: string;
  record_type?: string;
  record_id?: string;
  url?: string;
  record?: any;
  notification_intent?: string[];
  notifications_sent?: string[];
  notification_delivery_status?: 'DELIVERED' | 'QUEUED' | 'NOT_APPLICABLE';
  audit_event_id?: string;
}

export async function executeStagedAction(params: {
  actionId: string;
  confirmationHash: string;
  actor: { id: string; legalName: string; role: string; employeeNumber?: string };
  idempotencyKey?: string;
}): Promise<ConfirmResult> {
  const { actionId, confirmationHash, actor, idempotencyKey } = params;

  // 1. Fetch staged action
  const action = await prisma.stagedAction.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    return {
      ok: false,
      errorCode: 'NOT_FOUND',
      message: `Staged action ${actionId} not found.`,
    };
  }

  if (!SUPPORTED_STAGED_ACTION_TYPES.has(action.actionType as StagedActionType)) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_ACTION_TYPE',
      message: `Unsupported action type: ${action.actionType}`,
    };
  }

  // 1b. Strict 3-Role Executive Authority Check (GMD or Super Admin required to execute staged actions)
  const actorRoleUpper = (actor.role || '').toUpperCase();
  const isExecutiveActor = ['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(actorRoleUpper);
  if (!isExecutiveActor) {
    return {
      ok: false,
      errorCode: 'NOT_PERMITTED',
      message: 'Executive authority (GMD or Super Admin) is required to confirm and execute staged actions.',
    };
  }

  // 2. Ownership check (allow either the staging user or the GMD to confirm)
  if (action.userId !== actor.id && actorRoleUpper !== 'GMD') {
    return {
      ok: false,
      errorCode: 'NOT_PERMITTED',
      message: 'This staged action belongs to a different executive and cannot be confirmed.',
    };
  }

  // 3. Replay / Idempotency check
  if (action.status === 'EXECUTED') {
    if (idempotencyKey && action.idempotencyKey === idempotencyKey && action.resultJson) {
      try {
        const cached = JSON.parse(action.resultJson);
        return { ok: true, status: 'EXECUTED', ...cached };
      } catch {
        // continue
      }
    }
    return {
      ok: false,
      errorCode: 'ALREADY_EXECUTED',
      status: 'EXECUTED',
      message: 'This staged action has already been executed.',
    };
  }

  if (action.status === 'CANCELLED') {
    return {
      ok: false,
      errorCode: 'CANCELLED',
      status: 'CANCELLED',
      message: 'This staged action was previously discarded.',
    };
  }

  // 4. Expiry check
  const now = new Date();
  if (action.status === 'EXPIRED' || now > action.expiresAt) {
    if (action.status === 'PENDING') {
      await prisma.stagedAction.updateMany({
        where: { id: actionId, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      }).catch(() => {});
    }
    return {
      ok: false,
      errorCode: 'STAGED_ACTION_EXPIRED',
      status: 'EXPIRED',
      message: 'This staged action has expired. Please re-stage the request with the AI assistant.',
    };
  }

  // 5. Hash integrity verification
  const materialPayload = JSON.parse(action.payload);
  const expectedHash = computeConfirmationHash(materialPayload);

  if (expectedHash !== confirmationHash || action.confirmationHash !== confirmationHash) {
    return {
      ok: false,
      errorCode: 'HASH_MISMATCH',
      message: 'Material fields have changed since this action was staged. Execution aborted.',
    };
  }

  // 5b. Revalidate AI Write Scope and Authorized Entity Scope at confirmation time
  const payloadSubId =
    materialPayload.subsidiaryId ||
    materialPayload.organization_id ||
    materialPayload.organizationId ||
    materialPayload.subsidiary_id ||
    undefined;
  const requiredScope = resolveScopeFromStagePayload(action.actionType as StagedActionType, materialPayload);
  try {
    await assertAiScopeAllowed(requiredScope, 'write', payloadSubId);
  } catch (scopeErr: any) {
    return {
      ok: false,
      errorCode: 'AI_SCOPE_DISABLED',
      message: scopeErr.message || `AI write access for scope "${requiredScope}" is currently disabled.`,
    };
  }

  const authorizedOrgScope = await resolveAuthorizedOrganizationScope(
    {
      id: actor.id,
      role: actor.role,
      employeeNumber: actor.employeeNumber || 'EXEC',
      legalName: actor.legalName,
      workEmail: '',
      phone: null,
      avatarUrl: null,
    },
    payloadSubId || 'ALL'
  );
  if (payloadSubId && !authorizedOrgScope.organizationIds.includes(payloadSubId) && !authorizedOrgScope.isGroup) {
    return {
      ok: false,
      errorCode: 'NOT_PERMITTED',
      message: 'Target subsidiary is outside your authorized organization scope.',
    };
  }

  // 6. Execute business write atomically in transaction with conditional PENDING claim
  const auditEventId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const effectiveIdempotencyKey = idempotencyKey || `exec_${actionId}`;
  let resultRecord: any = null;
  let recordType: string = action.actionType;
  let recordId = '';
  let url = '';
  let resolvedSubsidiaryId: string | null = payloadSubId || null;
  const notificationIntentIds: string[] = [];
  const notificationsDeliveredIds: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      const txNow = new Date();

      // Re-verify human executive status inside the transaction
      const liveActor = await tx.employee.findUnique({
        where: { id: actor.id },
        select: { id: true, role: true, status: true, approvalStatus: true },
      });
      if (
        !liveActor ||
        liveActor.status !== 'ACTIVE' ||
        !['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(liveActor.role.toUpperCase())
      ) {
        throw new StagedStateConflictError(
          'NOT_PERMITTED',
          'Executive account is no longer active or authorized to execute staged actions.'
        );
      }

      // Atomic conditional claim of the PENDING action inside the write transaction
      const claimed = await tx.stagedAction.updateMany({
        where: {
          id: actionId,
          status: 'PENDING',
          confirmationHash,
          expiresAt: { gt: txNow },
        },
        data: {
          status: 'EXECUTED',
          executedAt: txNow,
          idempotencyKey: effectiveIdempotencyKey,
          auditEventId,
        },
      });

      if (claimed.count === 0) {
        const current = await tx.stagedAction.findUnique({ where: { id: actionId } });
        if (current?.status === 'EXECUTED') {
          throw new StagedStateConflictError('ALREADY_EXECUTED', 'This staged action has already been executed.');
        }
        if (current?.status === 'CANCELLED') {
          throw new StagedStateConflictError('CANCELLED', 'This staged action was cancelled.');
        }
        throw new StagedStateConflictError('STAGED_ACTION_EXPIRED', 'This staged action has expired.');
      }

      if (action.actionType === 'budget') {
      const { budget_id, organization_id, period, total_amount, allocations, mode } = materialPayload;
      const budgetMode = (mode || materialPayload.action || 'create').toLowerCase();

      let targetOrgId = organization_id || materialPayload.subsidiaryId;
      if (!targetOrgId && budget_id) {
        const existing = await tx.budget.findUnique({ where: { id: budget_id } });
        if (existing) targetOrgId = existing.organizationId;
      }
      if (!targetOrgId) {
        throw new StagedValidationError(
          'BUDGET_ORG_REQUIRED',
          'Target organization ID is required to execute a budget command.'
        );
      }

      const orgRecord = await tx.organization.findUnique({ where: { id: targetOrgId } });
      if (!orgRecord) {
        throw new StagedValidationError(
          'BUDGET_ORG_NOT_FOUND',
          `Target organization (${targetOrgId}) does not exist.`
        );
      }
      resolvedSubsidiaryId = orgRecord.id;

      let budget: any = null;
      const exactPeriod = String(period || '').trim();

      if (budgetMode === 'delete' || budgetMode === 'archive' || budgetMode === 'remove') {
        const toDelete = budget_id
          ? await tx.budget.findUnique({ where: { id: budget_id }, include: { lines: true } })
          : exactPeriod
          ? await tx.budget.findFirst({
              where: {
                organizationId: targetOrgId,
                periodName: { equals: exactPeriod, mode: 'insensitive' },
                status: 'ACTIVE',
              },
              include: { lines: true },
            })
          : null;

        if (!toDelete) {
          throw new StaleTargetError('Target active budget could not be found or was already closed.');
        }
        if (toDelete.organizationId !== targetOrgId) {
          throw new StagedValidationError(
            'BUDGET_ORG_MISMATCH',
            'Target budget belongs to a different organization than the staged proposal.'
          );
        }
        if (toDelete.status === 'CLOSED') {
          throw new StaleTargetError('Target budget is already closed. Please request a fresh preview.');
        }
        if (
          materialPayload.expected_updated_at &&
          toDelete.updatedAt.toISOString() !== String(materialPayload.expected_updated_at)
        ) {
          throw new StaleTargetError(
            'The target budget was modified after this preview was generated. Please request a fresh preview.'
          );
        }

        budget = await tx.budget.update({
          where: { id: toDelete.id },
          data: { status: 'CLOSED' },
          include: { lines: true },
        });
      } else if (budgetMode === 'reallocate' || budgetMode === 'update') {
        const existing = budget_id
          ? await tx.budget.findUnique({ where: { id: budget_id }, include: { lines: true } })
          : exactPeriod
          ? await tx.budget.findFirst({
              where: {
                organizationId: targetOrgId,
                periodName: { equals: exactPeriod, mode: 'insensitive' },
                status: 'ACTIVE',
              },
              include: { lines: true },
            })
          : null;

        if (!existing) {
          throw new StaleTargetError('Target budget for update/reallocation could not be found.');
        }
        if (existing.organizationId !== targetOrgId) {
          throw new StagedValidationError(
            'BUDGET_ORG_MISMATCH',
            'Target budget belongs to a different organization than the staged proposal.'
          );
        }
        if (existing.status === 'CLOSED') {
          throw new StaleTargetError('Cannot update or reallocate a closed budget.');
        }
        if (
          materialPayload.expected_updated_at &&
          existing.updatedAt.toISOString() !== String(materialPayload.expected_updated_at)
        ) {
          throw new StaleTargetError('The target budget was modified after this preview was generated. Please request a fresh preview.');
        }

        const updatedTotal = total_amount !== undefined && total_amount !== null ? Number(total_amount) : existing.totalAmount;
        if (isNaN(updatedTotal) || updatedTotal <= 0) {
          throw new StagedValidationError('INVALID_BUDGET_AMOUNT', 'Budget total amount must be a positive number.');
        }

        const minFloor = Math.max(Number(existing.committedAmount || 0), Number(existing.spentAmount || 0));
        if (updatedTotal < minFloor) {
          throw new StagedValidationError(
            'BUDGET_BELOW_COMMITTED',
            `Cannot reduce total budget (${updatedTotal.toLocaleString()}) below committed/spent amount (${minFloor.toLocaleString()}).`
          );
        }

        await tx.budget.update({
          where: { id: existing.id },
          data: {
            totalAmount: updatedTotal,
            status: 'ACTIVE',
          },
        });

        if (Array.isArray(allocations) && allocations.length > 0) {
          const existingLines = existing.lines || [];
          const matchedLineIds = new Set<string>();

          for (const incoming of allocations) {
            const dept = String(incoming.department || incoming.departmentName || 'Operations').trim();
            const cat = String(incoming.line_name || incoming.category || incoming.categoryName || 'General').trim();
            const expType = String(incoming.expenseType || 'OPEX').trim();
            const allocAmt = Number(incoming.amount ?? incoming.allocatedAmount ?? 0);

            const match = existingLines.find(
              (el: any) =>
                !matchedLineIds.has(el.id) &&
                (incoming.id === el.id ||
                  (el.category.toLowerCase() === cat.toLowerCase() &&
                    el.departmentName.toLowerCase() === dept.toLowerCase()) ||
                  el.category.toLowerCase() === cat.toLowerCase())
            );

            if (match) {
              matchedLineIds.add(match.id);
              const lineFloor = Math.max(Number(match.committedAmount || 0), Number(match.spentAmount || 0));
              if (allocAmt < lineFloor) {
                throw new StagedValidationError(
                  'BUDGET_LINE_BELOW_COMMITTED',
                  `Line "${cat}" allocation (${allocAmt.toLocaleString()}) cannot be lower than its committed/spent amount (${lineFloor.toLocaleString()}).`
                );
              }
              await tx.budgetLine.update({
                where: { id: match.id },
                data: {
                  departmentName: dept,
                  category: cat,
                  expenseType: expType,
                  allocatedAmount: allocAmt,
                },
              });
            } else {
              await tx.budgetLine.create({
                data: {
                  budgetId: existing.id,
                  departmentName: dept,
                  category: cat,
                  expenseType: expType,
                  allocatedAmount: allocAmt,
                  committedAmount: 0,
                  spentAmount: 0,
                  status: 'ACTIVE',
                },
              });
            }
          }

          if (budgetMode === 'update') {
            for (const el of existingLines) {
              if (!matchedLineIds.has(el.id)) {
                const hasActivity = Number(el.committedAmount || 0) > 0 || Number(el.spentAmount || 0) > 0;
                if (!hasActivity) {
                  await tx.budgetLine.delete({ where: { id: el.id } });
                }
              }
            }
          }
        }

        budget = await tx.budget.findUnique({
          where: { id: existing.id },
          include: { lines: true },
        });
      } else if (budgetMode === 'create') {
        if (!exactPeriod) {
          throw new StagedValidationError('BUDGET_PERIOD_REQUIRED', 'Fiscal period is required to create a budget.');
        }
        const parsedTotal = Number(total_amount || 0);
        if (isNaN(parsedTotal) || parsedTotal <= 0) {
          throw new StagedValidationError('INVALID_BUDGET_AMOUNT', 'Budget total amount must be greater than zero.');
        }

        const existingOverlap = await tx.budget.findFirst({
          where: {
            organizationId: targetOrgId,
            periodName: { equals: exactPeriod, mode: 'insensitive' },
            status: 'ACTIVE',
          },
        });

        if (existingOverlap) {
          throw new StaleTargetError(
            `An active budget for ${orgRecord.legalName} (${exactPeriod}) already exists. Stage an update or reallocation instead.`
          );
        }

        budget = await tx.budget.create({
          data: {
            organizationId: targetOrgId,
            fiscalYear: Number(materialPayload.fiscal_year) || new Date().getFullYear(),
            fiscalPeriod: exactPeriod,
            periodName: exactPeriod,
            totalAmount: parsedTotal,
            createdById: actor.id,
            status: 'ACTIVE',
            lines: {
              create: (allocations || []).map((line: any) => ({
                departmentName: line.department || line.departmentName || 'Operations',
                category: line.line_name || line.category || line.categoryName || 'General',
                allocatedAmount: Number(line.amount ?? line.allocatedAmount ?? 0),
                committedAmount: 0,
                spentAmount: 0,
                expenseType: line.expenseType || 'OPEX',
                status: 'ACTIVE',
              })),
            },
          },
          include: { lines: true },
        });
      } else {
        throw new StagedValidationError('UNSUPPORTED_BUDGET_MODE', `Unsupported budget mode "${budgetMode}".`);
      }

      resolvedSubsidiaryId = budget.organizationId || resolvedSubsidiaryId;
      recordType = 'budget';
      recordId = budget.id;
      url = `/budgets`;
      resultRecord = JSON.parse(
        JSON.stringify(budget, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
    } else if (action.actionType === 'approval_decision') {
      const { request_id, decision, reason } = materialPayload;

      const req = await tx.expenditureRequest.findFirst({
        where: { OR: [{ id: request_id }, { requestNumber: request_id }] },
        include: {
          requester: true,
          approvalSteps: { orderBy: { stageIndex: 'asc' } },
          channel: true,
        },
      });

      if (!req) throw new Error(`Request ${request_id} not found.`);
      resolvedSubsidiaryId = req.subsidiaryId;

      if (!['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(req.approvalStatus)) {
        throw new StaleTargetError(
          `Request ${req.requestNumber} is already ${req.approvalStatus} and can no longer be decided from this preview.`
        );
      }
      if (
        materialPayload.expected_version !== undefined &&
        req.requestVersion !== Number(materialPayload.expected_version)
      ) {
        throw new StaleTargetError(
          `Request ${req.requestNumber} was modified since staging (v${req.requestVersion}). Please request a fresh preview.`
        );
      }

      const normDecision = String(decision || '').toUpperCase().trim();
      const newStatus =
        normDecision === 'APPROVE' || normDecision === 'APPROVED'
          ? 'APPROVED'
          : normDecision === 'DECLINE' || normDecision === 'REJECT' || normDecision === 'REJECTED'
          ? 'REJECTED'
          : 'CLARIFICATION_REQUESTED';

      if (newStatus === 'APPROVED' && req.requestedById === actor.id && actor.role !== 'GMD') {
        throw new StagedPermissionError(
          'SEPARATION_OF_DUTIES',
          `Separation of duties policy: You cannot approve your own request ${req.requestNumber}.`
        );
      }

      const now = new Date();
      const pendingStep = req.approvalSteps.find((s) => s.status === 'PENDING');
      const decisionNote = reason || `Executive decision via AI: ${newStatus}`;

      if (pendingStep) {
        await tx.approvalStep.update({
          where: { id: pendingStep.id },
          data: {
            status: newStatus === 'CLARIFICATION_REQUESTED' ? 'PENDING' : newStatus,
            approverId: actor.id,
            approverName: actor.legalName,
            decidedAt: now,
            decisionReason: decisionNote,
          },
        });
        if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
          await tx.approvalStep.updateMany({
            where: { requestId: req.id, status: 'PENDING', id: { not: pendingStep.id } },
            data: {
              status: newStatus,
              approverId: actor.id,
              approverName: actor.legalName,
              decidedAt: now,
              decisionReason: decisionNote,
            },
          });
        }
      } else {
        await tx.approvalStep.create({
          data: {
            requestId: req.id,
            stageIndex: (req.approvalSteps[req.approvalSteps.length - 1]?.stageIndex || 0) + 1,
            assignedRole: actor.role,
            approverId: actor.id,
            approverName: actor.legalName,
            status: newStatus === 'CLARIFICATION_REQUESTED' ? 'PENDING' : newStatus,
            decisionReason: decisionNote,
            decidedAt: now,
          },
        });
      }

      const updatedReq = await tx.expenditureRequest.update({
        where: { id: req.id },
        data: {
          approvalStatus: newStatus,
          updatedAt: now,
        },
        include: { requester: true },
      });

      if (newStatus === 'APPROVED') {
        const activeBudget = await tx.budget.findFirst({
          where: { organizationId: req.subsidiaryId, status: 'ACTIVE' },
          include: { lines: true },
          orderBy: { createdAt: 'desc' },
        });
        if (activeBudget) {
          const amtNaira = Number(req.amountMinor) / 100;
          await tx.budget.update({
            where: { id: activeBudget.id },
            data: { committedAmount: { increment: amtNaira } },
          });
          const matchedLine = activeBudget.lines.find(
            (l) => l.category.toLowerCase() === (req.category || '').toLowerCase()
          );
          if (matchedLine) {
            await tx.budgetLine.update({
              where: { id: matchedLine.id },
              data: { committedAmount: { increment: amtNaira } },
            });
          }
        }
      }

      if (req.channel) {
        const channelBody =
          newStatus === 'APPROVED'
            ? `Approved by ${actor.legalName}. Ready for Finance disbursement recording.`
            : newStatus === 'REJECTED'
            ? `Declined by ${actor.legalName}: ${decisionNote}`
            : `Clarification requested by ${actor.legalName}: ${decisionNote}`;
        await tx.channelMessage.create({
          data: {
            channelId: req.channel.id,
            authorId: actor.id,
            authorName: actor.legalName,
            authorRole: actor.role,
            messageType: newStatus === 'CLARIFICATION_REQUESTED' ? 'CLARIFICATION' : 'AUDIT_EVENT',
            body: channelBody,
          },
        });
      }

      if (req.requestedById) {
        notificationIntentIds.push(req.requestedById);
        await tx.systemNotification.create({
          data: {
            employeeId: req.requestedById,
            kind: 'REQUEST_DECISION',
            title: `Request ${updatedReq.requestNumber} ${newStatus}`,
            body: `Your expenditure request "${updatedReq.title}" was marked ${newStatus} by ${actor.legalName}.`,
            linkUrl: `/requests/${updatedReq.requestNumber}`,
          },
        });
        notificationsDeliveredIds.push(req.requestedById);
      }

      recordType = 'fund_request';
      recordId = updatedReq.requestNumber;
      url = `/requests/${updatedReq.requestNumber}`;
      resultRecord = JSON.parse(
        JSON.stringify(updatedReq, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
    } else if (action.actionType === 'payment_record') {
      const {
        request_id,
        amount,
        currency,
        payer_account_id,
        beneficiary_name,
        beneficiary_bank,
        beneficiary_account,
        transfer_reference,
        payment_date,
      } = materialPayload;

      const req = await tx.expenditureRequest.findFirst({
        where: { OR: [{ id: request_id }, { requestNumber: request_id }] },
        include: { vendor: true, requester: true, channel: true },
      });
      if (!req) throw new Error(`Request ${request_id} not found.`);
      resolvedSubsidiaryId = req.subsidiaryId;

      if (req.approvalStatus !== 'APPROVED') {
        throw new StaleTargetError(`Request ${req.requestNumber} is ${req.approvalStatus}; only APPROVED requests can be disbursed.`);
      }
      if (
        req.paymentStatus === 'PAID' ||
        req.paymentStatus === 'RECIPIENT_CONFIRMED' ||
        req.paymentStatus === 'AWAITING_RECIPIENT_CONFIRMATION'
      ) {
        throw new StaleTargetError(`Request ${req.requestNumber} already has a recorded payment (${req.paymentStatus}).`);
      }

      const numAmount = Number(amount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        throw new StagedValidationError('INVALID_PAYMENT_AMOUNT', 'Payment amount must be a positive number.');
      }
      const amountMinor = BigInt(Math.round(numAmount * 100));
      if (amountMinor > req.amountMinor) {
        throw new StagedValidationError(
          'EXCEEDS_APPROVED_AMOUNT',
          `Payment amount (₦${numAmount.toLocaleString()}) exceeds approved request amount.`
        );
      }

      const extRef = String(transfer_reference || '').trim();
      if (!extRef) {
        throw new StagedValidationError('MISSING_TRANSFER_REFERENCE', 'An external bank transfer reference is required.');
      }
      const existingRef = await tx.disbursement.findFirst({ where: { externalReference: extRef } });
      if (existingRef) {
        throw new StaleTargetError(`Bank transfer reference "${extRef}" has already been recorded.`);
      }

      // Validate corporate payer account
      let payerBank = null;
      if (payer_account_id && String(payer_account_id) !== 'DEFAULT_CORP') {
        payerBank = await tx.companyBankAccount.findFirst({
          where: {
            status: 'ACTIVE',
            OR: [{ id: String(payer_account_id) }, { accountNumber: String(payer_account_id) }],
          },
        });
      }
      if (!payerBank) {
        const subAccounts = await tx.companyBankAccount.findMany({
          where: { organizationId: req.subsidiaryId, status: 'ACTIVE' },
        });
        if (subAccounts.length === 1) payerBank = subAccounts[0];
      }
      if (!payerBank) {
        throw new StagedValidationError(
          'PAYER_ACCOUNT_NOT_FOUND',
          'A valid active corporate treasury bank account (payer_account_id) is required to record payment.'
        );
      }

      const invalidValues = new Set(['0000000000', 'n/a', 'na', 'payee', 'designated beneficiary', 'commercial bank']);
      const isInvalidVal = (v: unknown) => !v || invalidValues.has(String(v).trim().toLowerCase());

      const finalBeneficiaryName = !isInvalidVal(beneficiary_name)
        ? String(beneficiary_name).trim()
        : req.vendor?.accountName || req.vendor?.name || req.requester?.accountName || req.requester?.legalName || '';
      const finalBeneficiaryBank = !isInvalidVal(beneficiary_bank)
        ? String(beneficiary_bank).trim()
        : req.vendor?.bankName || req.requester?.bankName || req.requester?.salaryBankName || '';
      const finalBeneficiaryAccount = (
        !isInvalidVal(beneficiary_account)
          ? String(beneficiary_account)
          : req.vendor?.accountNumber || req.requester?.accountNumber || req.requester?.salaryAccountNumber || ''
      ).replace(/\D/g, '');

      if (
        isInvalidVal(finalBeneficiaryName) ||
        isInvalidVal(finalBeneficiaryBank) ||
        finalBeneficiaryAccount.length !== 10 ||
        finalBeneficiaryAccount === '0000000000'
      ) {
        throw new StagedValidationError(
          'INVALID_BENEFICIARY_BANK',
          `Verified 10-digit NUBAN beneficiary account details are required to record payment for ${req.requestNumber}.`
        );
      }

      const disbursement = await tx.disbursement.create({
        data: {
          requestId: req.id,
          payerOrgId: payerBank.organizationId,
          amountMinor,
          currency: currency || req.currency || 'NGN',
          externalReference: extRef,
          bankName: payerBank.bankName,
          beneficiaryName: finalBeneficiaryName,
          beneficiaryBank: finalBeneficiaryBank,
          beneficiaryAccount: finalBeneficiaryAccount,
          recordedById: actor.id,
          status: 'AWAITING_RECIPIENT_CONFIRMATION',
          idempotencyKey: effectiveIdempotencyKey,
          paidAt: payment_date ? new Date(payment_date) : new Date(),
        },
      });

      // Create canonical PaymentReceipt voucher matching /api/disbursements
      const receiptId = crypto.randomUUID();
      const formattedNaira = numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 });
      const voucherSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380" style="background:#0f172a;font-family:sans-serif;color:#fff;">
  <rect width="600" height="380" fill="#0f172a" rx="16"/>
  <rect x="20" y="20" width="560" height="340" fill="#1e293b" rx="12" stroke="#334155" stroke-width="2"/>
  <text x="40" y="54" font-size="16" font-weight="bold" fill="#ffffff">BEMS ERP · DISBURSEMENT VOUCHER</text>
  <text x="40" y="120" font-size="11" fill="#94a3b8">BANK REFERENCE</text>
  <text x="40" y="140" font-size="15" font-weight="bold" fill="#38bdf8">${extRef}</text>
  <text x="320" y="120" font-size="11" fill="#94a3b8">AMOUNT TRANSFERRED</text>
  <text x="320" y="142" font-size="18" font-weight="bold" fill="#34d399">NGN ${formattedNaira}</text>
  <text x="40" y="180" font-size="11" fill="#94a3b8">BENEFICIARY</text>
  <text x="40" y="200" font-size="13" font-weight="bold" fill="#ffffff">${finalBeneficiaryName}</text>
  <text x="40" y="218" font-size="12" fill="#cbd5e1">${finalBeneficiaryBank} • ${finalBeneficiaryAccount}</text>
  <text x="320" y="180" font-size="11" fill="#94a3b8">PAYER SOURCE</text>
  <text x="320" y="200" font-size="13" font-weight="bold" fill="#ffffff">${payerBank.bankName} (${payerBank.accountNumber})</text>
</svg>`.trim();
      const fileBytes = Buffer.from(voucherSvg, 'utf-8');
      const receiptHash = crypto.createHash('sha256').update(fileBytes).digest('hex');

      await tx.paymentReceipt.create({
        data: {
          id: receiptId,
          disbursementId: disbursement.id,
          fileName: `voucher-${extRef}.svg`,
          fileUrl: `/api/receipts/${receiptId}`,
          sha256: receiptHash,
          mimeType: 'image/svg+xml',
          fileData: new Uint8Array(fileBytes),
          uploadedById: actor.id,
        },
      });

      // Deduct corporate bank account balance
      const nextBalance = Math.max(0, Number(payerBank.balance) - numAmount);
      await tx.companyBankAccount.update({
        where: { id: payerBank.id },
        data: { balance: nextBalance },
      });

      // Keep paymentStatus consistent with disbursement awaiting recipient confirmation
      await tx.expenditureRequest.update({
        where: { id: req.id },
        data: { paymentStatus: 'AWAITING_RECIPIENT_CONFIRMATION' },
      });

      // Ensure post-payment AccountabilityCase exists
      const existingCase = await tx.accountabilityCase.findUnique({ where: { requestId: req.id } });
      if (!existingCase) {
        const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const createdCase = await tx.accountabilityCase.create({
          data: {
            requestId: req.id,
            ownerUserId: req.requestedById,
            requiredDeliverables: req.deliverable,
            dueAt,
            status: 'OPEN',
          },
        });
        await tx.followupTask.create({
          data: {
            accountabilityCaseId: createdCase.id,
            assigneeId: req.requestedById,
            description: `Submit post-payment deliverables for ${req.requestNumber}`,
            dueAt,
          },
        });
      }

      if (req.channel) {
        await tx.channelMessage.create({
          data: {
            channelId: req.channel.id,
            authorId: actor.id,
            authorName: actor.legalName,
            authorRole: actor.role,
            messageType: 'AUDIT_EVENT',
            body: `Payment recorded by ${actor.legalName} (reference ${extRef}). The requester has been asked to confirm receipt.`,
          },
        });
      }

      if (req.requestedById) {
        notificationIntentIds.push(req.requestedById);
        await tx.systemNotification.create({
          data: {
            employeeId: req.requestedById,
            kind: 'PAYMENT_CONFIRMATION_REQUIRED',
            title: `Confirm receipt of funds (${req.requestNumber})`,
            body: `A payment of ${currency || req.currency || 'NGN'} ${numAmount.toLocaleString()} was recorded for "${req.title}". Review the receipt and confirm whether you received it.`,
            linkUrl: `/requests/${req.requestNumber}`,
          },
        });
        notificationsDeliveredIds.push(req.requestedById);
      }

      recordType = 'disbursement';
      recordId = disbursement.id;
      url = `/disbursements`;
      resultRecord = JSON.parse(
        JSON.stringify(disbursement, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
    } else if (action.actionType === 'payment_recorder') {
      const { request_id, assignee_user_id, note } = materialPayload;

      const [req, assignee] = await Promise.all([
        tx.expenditureRequest.findFirst({
          where: { OR: [{ id: request_id }, { requestNumber: request_id }] },
        }),
        tx.employee.findUnique({ where: { id: assignee_user_id } }),
      ]);
      if (!req) throw new Error(`Request ${request_id} not found.`);
      if (!assignee || assignee.status !== 'ACTIVE') {
        throw new StaleTargetError(`Assignee ${assignee_user_id} is not an active employee.`);
      }
      resolvedSubsidiaryId = req.subsidiaryId;

      if (req.approvalStatus !== 'APPROVED') {
        throw new StaleTargetError(`Request ${req.requestNumber} must be APPROVED before assigning a payment recorder (current: ${req.approvalStatus}).`);
      }
      if (req.paymentStatus === 'PAID' || req.paymentStatus === 'RECIPIENT_CONFIRMED') {
        throw new StaleTargetError(`Request ${req.requestNumber} has already been paid.`);
      }

      const updatedReq = await tx.expenditureRequest.update({
        where: { id: req.id },
        data: { disbursementAssigneeId: assignee.id },
      });

      notificationIntentIds.push(assignee.id);
      await tx.systemNotification.create({
        data: {
          employeeId: assignee.id,
          kind: 'DISBURSEMENT_ASSIGNED',
          title: `Disbursement Recording Assigned: ${req.requestNumber}`,
          body: `${actor.legalName} assigned you to record payment for ${req.requestNumber} (${req.title}). ${note ? `Note: ${note}` : ''}`.trim(),
          linkUrl: `/requests/${req.requestNumber}`,
        },
      });
      notificationsDeliveredIds.push(assignee.id);

      recordType = 'fund_request';
      recordId = updatedReq.requestNumber;
      url = `/requests/${updatedReq.requestNumber}`;
      resultRecord = {
        request_id: updatedReq.id,
        request_number: updatedReq.requestNumber,
        disbursement_assignee_id: assignee.id,
        disbursement_assignee_name: assignee.legalName,
      };
    } else if (action.actionType === 'salary_change') {
      const employee_id = materialPayload.employee_id;
      const amount = Number(materialPayload.new_base_salary ?? materialPayload.amount ?? 0);
      const effective_date = materialPayload.effective_date;
      const reason = String(materialPayload.reason || 'Executive AI salary modification').trim();
      const rawChangeType = String(materialPayload.change_type || 'SET_EXACT').toUpperCase();
      const changeType: CompensationChangeType =
        rawChangeType === 'REMOVE_FROM_PAYROLL' ||
        rawChangeType === 'ADDITION' ||
        rawChangeType === 'DEDUCTION' ||
        rawChangeType === 'INITIAL_SALARY' ||
        rawChangeType === 'SET_EXACT'
          ? (rawChangeType as CompensationChangeType)
          : 'SET_EXACT';

      let compResult;
      try {
        compResult = await applyCanonicalCompensationChange(tx, {
          employeeId: employee_id,
          changeType,
          amountNaira: amount,
          isTargetGross: true,
          effectiveFrom: effective_date ? new Date(effective_date) : new Date(),
          reason: reason.length >= 5 ? reason : `${reason} (Executive review)`,
          actorId: actor.id,
          expectedCompVersion:
            materialPayload.expected_comp_version !== undefined
              ? Number(materialPayload.expected_comp_version)
              : undefined,
        });
      } catch (err: any) {
        const msg = err?.message || 'Failed to update compensation.';
        if (msg.startsWith('STALE_COMPENSATION_VERSION:')) {
          throw new StaleTargetError(msg.replace('STALE_COMPENSATION_VERSION: ', ''));
        }
        throw new StagedValidationError('SALARY_CHANGE_FAILED', msg);
      }

      resolvedSubsidiaryId = compResult.subsidiaryId || resolvedSubsidiaryId;

      notificationIntentIds.push(employee_id);
      await tx.systemNotification.create({
        data: {
          employeeId: employee_id,
          kind: 'PAYROLL_SALARY_CHANGED',
          title: 'Your salary has been updated',
          body: compResult.notificationBody,
          linkUrl: '/payroll',
        },
      });
      notificationsDeliveredIds.push(employee_id);

      recordType = 'compensation';
      recordId = employee_id;
      url = `/payroll`;
      resultRecord = {
        employee_id,
        compensation_id: compResult.compensation.id,
        version: compResult.compensation.version,
        previous_base_salary: Number(compResult.previousGrossMinor) / 100,
        new_base_salary: Number(compResult.newGrossMinor) / 100,
        previous_gross_formatted: compResult.previousGrossFormatted,
        new_gross_formatted: compResult.newGrossFormatted,
        effective_date: compResult.compensation.effectiveFrom.toISOString(),
        affected_open_periods: compResult.affectedOpenPeriods,
      };
    } else if (action.actionType === 'staff_approval') {
      const { employee_id } = materialPayload;

      if (!['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role)) {
        throw new StagedValidationError('NOT_PERMITTED', 'Only GMD or Super Admin can approve staff onboarding.');
      }

      const emp = await tx.employee.findUnique({
        where: { id: employee_id },
        include: { assignments: { where: { isPrimary: true }, take: 1 } },
      });
      if (!emp) throw new Error(`Staff member ${employee_id} not found.`);
      resolvedSubsidiaryId = emp.assignments[0]?.subsidiaryId || resolvedSubsidiaryId;

      if (emp.role !== 'STAFF') {
        throw new StagedValidationError(
          'INVALID_TARGET_ROLE',
          `Cannot use staff self-service approval for executive role (${emp.role}).`
        );
      }

      if (emp.approvalStatus !== 'PENDING_APPROVAL') {
        throw new StaleTargetError(
          `Staff member ${emp.legalName} is no longer pending approval (current approvalStatus: ${emp.approvalStatus}, status: ${emp.status}).`
        );
      }

      const updated = await tx.employee.update({
        where: { id: employee_id },
        data: {
          approvalStatus: 'APPROVED',
          status: 'ACTIVE',
        },
      });

      await tx.employeeAssignment.updateMany({
        where: { employeeId: employee_id, isPrimary: true },
        data: { status: 'ACTIVE' },
      });

      notificationIntentIds.push(employee_id);
      await tx.systemNotification.create({
        data: {
          employeeId: employee_id,
          kind: 'ACCOUNT_APPROVED',
          title: 'Account Approved',
          body: `Your BEMS account has been approved by ${actor.legalName}.`,
          linkUrl: '/',
        },
      });
      notificationsDeliveredIds.push(employee_id);

      recordType = 'employee';
      recordId = updated.employeeNumber;
      url = `/staff`;
      resultRecord = {
        employee_id: updated.id,
        employee_number: updated.employeeNumber,
        name: updated.legalName,
        status: updated.status,
        approval_status: updated.approvalStatus,
      };
    } else if (action.actionType === 'role_change') {
      const { employee_id, new_role, reason } = materialPayload;

      if (!['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role)) {
        throw new StagedValidationError('NOT_PERMITTED', 'Only GMD or Super Admin can change system roles.');
      }

      const emp = await tx.employee.findUnique({
        where: { id: employee_id },
        include: { assignments: { where: { isPrimary: true }, take: 1 } },
      });
      if (!emp) throw new Error(`Staff member ${employee_id} not found.`);
      resolvedSubsidiaryId = emp.assignments[0]?.subsidiaryId || resolvedSubsidiaryId;

      if (emp.role === 'GMD' && actor.role !== 'GMD') {
        throw new StagedValidationError(
          'GMD_IMMUTABLE',
          'Only the active Group Managing Director can modify the GMD role assignment.'
        );
      }

      if (materialPayload.expected_role && emp.role !== materialPayload.expected_role) {
        throw new StaleTargetError(
          `Employee role changed from ${materialPayload.expected_role} to ${emp.role} after staging. Please request a fresh preview.`
        );
      }

      const canonicalRole = await assertValidRoleAndGmdUniqueness(tx, new_role, emp.id);

      const updated = await tx.employee.update({
        where: { id: employee_id },
        data: { role: canonicalRole },
      });

      await tx.authSession.deleteMany({ where: { employeeId: emp.id } });
      invalidateSessionCache(emp.id);

      notificationIntentIds.push(employee_id);
      await tx.systemNotification.create({
        data: {
          employeeId: employee_id,
          kind: 'ROLE_UPDATED',
          title: 'System Role Updated',
          body: `Your BEMS role was updated from ${emp.role} to ${updated.role} by ${actor.legalName}. Please sign in again.`,
          linkUrl: '/',
        },
      });
      notificationsDeliveredIds.push(employee_id);

      recordType = 'employee';
      recordId = updated.employeeNumber;
      url = `/staff`;
      resultRecord = {
        employee_number: updated.employeeNumber,
        name: updated.legalName,
        prior_role: emp.role,
        new_role: updated.role,
        sessions_revoked: true,
        reason: reason || 'Executive role reassignment',
      };
    } else if (action.actionType === 'accountability_clearance') {
      const { case_id, request_number, clearance_notes } = materialPayload;

      const accCase = await tx.accountabilityCase.findFirst({
        where: { OR: [{ id: case_id }, { request: { requestNumber: request_number || case_id } }] },
        include: { request: true, owner: true },
      });

      if (!accCase) throw new Error(`Accountability case ${case_id} not found.`);
      resolvedSubsidiaryId = accCase.request?.subsidiaryId || resolvedSubsidiaryId;

      if (accCase.status === 'CLOSED') {
        throw new StaleTargetError(`Accountability case for ${accCase.request?.requestNumber || accCase.id} is already CLOSED.`);
      }

      const updated = await tx.accountabilityCase.update({
        where: { id: accCase.id },
        data: {
          status: 'CLOSED',
          closureNotes: clearance_notes || 'Receipts inspected and cleared by GMD via Executive AI',
        },
      });

      if (accCase.ownerUserId) {
        notificationIntentIds.push(accCase.ownerUserId);
        await tx.systemNotification.create({
          data: {
            employeeId: accCase.ownerUserId,
            kind: 'ACCOUNTABILITY_CLEARED',
            title: `Retiral Cleared: ${accCase.request?.requestNumber || accCase.id}`,
            body: `Your accountability case for ${accCase.request?.requestNumber || 'your advance'} has been cleared and closed by ${actor.legalName}.`,
            linkUrl: '/accountability',
          },
        });
        notificationsDeliveredIds.push(accCase.ownerUserId);
      }

      recordType = 'accountability_case';
      recordId = accCase.request?.requestNumber || accCase.id;
      url = `/accountability`;
      resultRecord = {
        case_id: updated.id,
        request_number: accCase.request?.requestNumber,
        status: updated.status,
        owner: accCase.owner?.legalName,
      };
    } else if (action.actionType === 'deadline_extension') {
      const { case_id, extension_hours, new_due_at, reason } = materialPayload;

      const accCase = await tx.accountabilityCase.findUnique({ where: { id: case_id }, include: { request: true, owner: true } });
      if (!accCase) throw new Error(`Accountability case ${case_id} not found.`);
      resolvedSubsidiaryId = accCase.request?.subsidiaryId || resolvedSubsidiaryId;

      if (accCase.status === 'CLOSED') {
        throw new StaleTargetError(`Accountability case ${accCase.request?.requestNumber || case_id} is already CLOSED and cannot be extended.`);
      }
      if (materialPayload.expected_due_at && accCase.dueAt.toISOString() !== String(materialPayload.expected_due_at)) {
        throw new StaleTargetError(`Accountability deadline was already modified after staging. Please request a fresh preview.`);
      }

      const hours = Number(extension_hours) || 48;
      const newDueAt = new_due_at
        ? new Date(new_due_at)
        : new Date(accCase.dueAt.getTime() + hours * 3600 * 1000);

      const updated = await tx.accountabilityCase.update({
        where: { id: case_id },
        data: {
          dueAt: newDueAt,
          closureNotes: `${accCase.closureNotes ? accCase.closureNotes + '\n' : ''}GMD Granted deadline extension to ${newDueAt.toISOString().split('T')[0]}: ${reason || 'Executive discretion'}`,
        },
      });

      if (accCase.ownerUserId) {
        notificationIntentIds.push(accCase.ownerUserId);
        await tx.systemNotification.create({
          data: {
            employeeId: accCase.ownerUserId,
            kind: 'ACCOUNTABILITY_EXTENDED',
            title: `Retiral Deadline Extended: ${accCase.request?.requestNumber || accCase.id}`,
            body: `Your accountability retirement deadline was extended to ${newDueAt.toISOString().split('T')[0]} by ${actor.legalName}.`,
            linkUrl: '/accountability',
          },
        });
        notificationsDeliveredIds.push(accCase.ownerUserId);
      }

      recordType = 'accountability_case';
      recordId = accCase.request?.requestNumber || accCase.id;
      url = `/accountability`;
      resultRecord = {
        case_id: updated.id,
        new_due_at: newDueAt.toISOString(),
        extension_hours: hours,
      };
    } else if (action.actionType === 'treasury_account') {
      const {
        account_id,
        bank_name,
        account_number,
        account_name,
        account_type,
        balance,
        daily_limit,
        subsidiary_id,
        mode,
        expected_balance,
      } = materialPayload;
      const rawMode = String(mode || materialPayload.action || 'register').toLowerCase().trim();
      const accountMode =
        rawMode === 'delete' || rawMode === 'archive'
          ? 'deactivate'
          : rawMode === 'update'
          ? 'update_metadata'
          : rawMode;

      const cleanAccountNumber = String(account_number || '').replace(/\D/g, '');
      const existing = account_id
        ? await tx.companyBankAccount.findUnique({ where: { id: String(account_id) }, include: { organization: true } })
        : cleanAccountNumber
        ? await tx.companyBankAccount.findUnique({ where: { accountNumber: cleanAccountNumber }, include: { organization: true } })
        : null;

      if (accountMode === 'deactivate') {
        if (!existing) {
          throw new StaleTargetError('Target company bank account to deactivate could not be found.');
        }
        if (existing.status === 'INACTIVE') {
          throw new StaleTargetError(`Account ${existing.accountNumber} is already inactive.`);
        }
        const deactivated = await tx.companyBankAccount.update({
          where: { id: existing.id },
          data: { status: 'INACTIVE' },
          include: { organization: true },
        });
        resolvedSubsidiaryId = deactivated.organizationId;
        recordType = 'treasury_account';
        recordId = deactivated.accountNumber;
        url = `/treasury`;
        resultRecord = {
          id: deactivated.id,
          accountNumber: deactivated.accountNumber,
          organizationId: deactivated.organizationId,
          status: 'INACTIVE',
        };
      } else {
        const targetOrgId = String(subsidiary_id || materialPayload.organization_id || '').trim();
        if (!targetOrgId || targetOrgId === 'bems-group-hq' || targetOrgId.toUpperCase() === 'ALL') {
          throw new StagedValidationError(
            'TREASURY_ORG_REQUIRED',
            'An explicit resolved organization ID is required for corporate treasury operations.'
          );
        }
        const targetOrg = await tx.organization.findUnique({ where: { id: targetOrgId } });
        if (!targetOrg) {
          throw new StagedValidationError('TREASURY_ORG_NOT_FOUND', `Target organization (${targetOrgId}) does not exist.`);
        }
        resolvedSubsidiaryId = targetOrg.id;

        if (!cleanAccountNumber || cleanAccountNumber.length !== 10) {
          throw new StagedValidationError('INVALID_NUBAN', 'A valid 10-digit NUBAN account number is required.');
        }

        if (existing && existing.organizationId !== targetOrg.id) {
          throw new StagedValidationError(
            'TREASURY_ORG_MISMATCH',
            `Account ${cleanAccountNumber} belongs to ${existing.organization.legalName} and cannot be reassigned to ${targetOrg.legalName}.`
          );
        }

        if (
          existing &&
          expected_balance !== undefined &&
          expected_balance !== null &&
          Math.abs(Number(existing.balance) - Number(expected_balance)) > 0.005
        ) {
          throw new StaleTargetError(
            `Account ${cleanAccountNumber} balance changed since staging (now ₦${Number(existing.balance).toLocaleString()}). Please request a fresh preview.`
          );
        }

        let dbAccount: any;
        if (accountMode === 'update_metadata') {
          if (!existing) {
            throw new StaleTargetError(`Target account ${cleanAccountNumber} was not found for metadata update.`);
          }
          dbAccount = await tx.companyBankAccount.update({
            where: { id: existing.id },
            data: {
              bankName: bank_name ? String(bank_name).trim() : existing.bankName,
              accountName: account_name ? String(account_name).trim() : existing.accountName,
              accountType: account_type ? String(account_type).trim() : existing.accountType,
              ...(daily_limit !== undefined ? { dailyLimit: Number(daily_limit) } : {}),
              // Never modify balance during metadata update
            },
            include: { organization: true },
          });
        } else if (accountMode === 'correct_balance') {
          if (!existing) {
            throw new StaleTargetError(`Target account ${cleanAccountNumber} was not found for balance correction.`);
          }
          if (balance === undefined || balance === null || isNaN(Number(balance)) || Number(balance) < 0) {
            throw new StagedValidationError('INVALID_BALANCE', 'A valid non-negative balance is required.');
          }
          dbAccount = await tx.companyBankAccount.update({
            where: { id: existing.id },
            data: {
              balance: Number(balance),
              ...(bank_name ? { bankName: String(bank_name).trim() } : {}),
              ...(account_name ? { accountName: String(account_name).trim() } : {}),
            },
            include: { organization: true },
          });
        } else if (accountMode === 'register') {
          if (existing && existing.status === 'ACTIVE') {
            throw new StaleTargetError(
              `Corporate account ${cleanAccountNumber} is already active under ${existing.organization.legalName}.`
            );
          }
          if (!bank_name || !String(bank_name).trim() || !account_name || !String(account_name).trim()) {
            throw new StagedValidationError('TREASURY_FIELDS_REQUIRED', 'bank_name and account_name are required to register an account.');
          }
          const initialBal =
            balance !== undefined && balance !== null && !isNaN(Number(balance))
              ? Number(balance)
              : existing
              ? Number(existing.balance)
              : 0;

          dbAccount = existing
            ? await tx.companyBankAccount.update({
                where: { id: existing.id },
                data: {
                  bankName: String(bank_name).trim(),
                  accountName: String(account_name).trim(),
                  accountType: account_type || existing.accountType || 'Corporate Operational',
                  balance: initialBal,
                  ...(daily_limit !== undefined ? { dailyLimit: Number(daily_limit) } : {}),
                  status: 'ACTIVE',
                },
                include: { organization: true },
              })
            : await tx.companyBankAccount.create({
                data: {
                  bankName: String(bank_name).trim(),
                  accountName: String(account_name).trim(),
                  accountNumber: cleanAccountNumber,
                  accountType: account_type || 'Corporate Operational',
                  balance: initialBal,
                  dailyLimit: daily_limit !== undefined ? Number(daily_limit) : 25000000,
                  organizationId: targetOrg.id,
                  currency: targetOrg.defaultCurrency || 'NGN',
                  status: 'ACTIVE',
                },
                include: { organization: true },
              });
        } else {
          throw new StagedValidationError('UNSUPPORTED_TREASURY_MODE', `Unsupported treasury mode "${accountMode}".`);
        }

        recordType = 'treasury_account';
        recordId = dbAccount.accountNumber;
        url = `/treasury`;
        resultRecord = {
          id: dbAccount.id,
          bankName: dbAccount.bankName,
          accountNumber: dbAccount.accountNumber,
          accountName: dbAccount.accountName,
          balance: Number(dbAccount.balance),
          organizationId: dbAccount.organizationId,
          currency: dbAccount.currency,
          status: dbAccount.status,
        };
      }
    } else if (action.actionType === 'intercompany_note') {
      const mode = (
        materialPayload.mode ||
        materialPayload.action ||
        (materialPayload.targetNoteIds || materialPayload.noteIds ? 'SETTLE' : 'CREATE_NOTE')
      ).toUpperCase();

      if (
        mode === 'SETTLE' ||
        mode === 'STAGE_SETTLEMENT' ||
        mode === 'RECONCILE_SETTLEMENT' ||
        mode === 'RECONCILE' ||
        Array.isArray(materialPayload.targetNoteIds)
      ) {
        const noteIds: string[] = materialPayload.targetNoteIds || materialPayload.noteIds || [];
        let settled;
        try {
          settled = await reconcileIntercompanyNotes({
            noteIds,
            settlementReference: materialPayload.settlementReference || 'GMD_NETTING_SETTLEMENT',
            expectedTotalSettlementMinor:
              materialPayload.totalSettlementMinor !== undefined
                ? Number(materialPayload.totalSettlementMinor)
                : undefined,
            actor: { id: actor.id, legalName: actor.legalName, role: actor.role },
            tx,
          });
        } catch (err: any) {
          const msg = err?.message || 'Intercompany settlement failed.';
          if (msg.startsWith('STALE_INTERCOMPANY_NOTES:')) {
            throw new StaleTargetError(msg.replace('STALE_INTERCOMPANY_NOTES: ', ''));
          }
          throw new StagedValidationError('INTERCOMPANY_SETTLEMENT_FAILED', msg);
        }
        recordType = 'intercompany_settlement';
        recordId = settled.noteNumbers?.[0] || noteIds[0] || 'SETTLEMENT';
        url = `/intercompany`;
        resultRecord = settled;
      } else if (mode === 'CREATE_NOTE' || mode === 'ISSUE_PAIRED_NOTES' || mode === 'GENERATE') {
        const sourceId = materialPayload.source_entity_id || materialPayload.sourceEntityId;
        const targetId = materialPayload.target_entity_id || materialPayload.targetEntityId;
        const amountNaira = Number(
          materialPayload.amount || (materialPayload.amountMinor ? Number(materialPayload.amountMinor) / 100 : 0)
        );
        const amountMinor = materialPayload.amountMinor
          ? Number(materialPayload.amountMinor)
          : Math.round(amountNaira * 100);
        const description = materialPayload.description || 'Intercompany recharge note via Executive AI';

        if (!sourceId || !targetId || amountMinor <= 0) {
          throw new StagedValidationError(
            'INVALID_INTERCOMPANY_NOTE',
            'sourceEntityId, targetEntityId, and a positive amount are required to issue paired intercompany notes.'
          );
        }

        const paired = await generateOperationalIntercompanyNotes({
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          amountMinor,
          currency: materialPayload.currency || 'NGN',
          description,
          actor: { id: actor.id, legalName: actor.legalName, role: actor.role },
          tx,
        });

        resolvedSubsidiaryId = sourceId;
        recordType = 'intercompany_note';
        recordId = paired.debitNote.noteNumber;
        url = `/intercompany`;
        resultRecord = paired;
      } else {
        throw new StagedValidationError(
          'UNSUPPORTED_INTERCOMPANY_MODE',
          `Unsupported intercompany mode "${mode}".`
        );
      }
    } else if (action.actionType === 'vendor_approval') {
      const mode = String(
        materialPayload.mode ||
          materialPayload.action ||
          (materialPayload.vendor_id || materialPayload.vendorId
            ? 'APPROVE_EXISTING_VENDOR'
            : 'REGISTER_NEW_VENDOR')
      )
        .toUpperCase()
        .trim();

      if (mode === 'RECOMPUTE_MATCH' || mode === 'CHECK_MATCH') {
        const requestId = materialPayload.request_id || materialPayload.requestId;
        const matchResult = await executeThreeWayMatch({
          requestId,
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
        });
        recordType = 'three_way_match';
        recordId = requestId;
        url = `/vendors`;
        resultRecord = matchResult;
      } else if (mode === 'APPROVE_EXISTING_VENDOR' || mode === 'APPROVE') {
        const targetVendorId = String(materialPayload.vendor_id || materialPayload.vendorId || '').trim();
        const existingVendor = targetVendorId
          ? await tx.vendor.findUnique({ where: { id: targetVendorId } })
          : materialPayload.name
          ? await tx.vendor.findFirst({
              where: { name: { equals: String(materialPayload.name).trim(), mode: 'insensitive' } },
            })
          : null;

        if (!existingVendor) {
          throw new StaleTargetError('Target existing vendor could not be found.');
        }

        const cleanBank = String(
          materialPayload.bankName || materialPayload.bank_name || existingVendor.bankName || ''
        ).trim();
        const cleanAcctNum = String(
          materialPayload.accountNumber || materialPayload.account_number || existingVendor.accountNumber || ''
        ).replace(/\D/g, '');
        const cleanAcctName = String(
          materialPayload.accountName || materialPayload.account_name || existingVendor.accountName || existingVendor.name
        ).trim();
        const rawTin = String(materialPayload.taxId || materialPayload.tin || existingVendor.taxId || '').trim();
        const cleanTin = rawTin && rawTin.toUpperCase() !== 'PENDING_TIN' ? rawTin : null;

        if (
          !cleanBank ||
          cleanBank.toLowerCase() === 'commercial bank' ||
          cleanAcctNum.length !== 10 ||
          cleanAcctNum === '0000000000' ||
          !cleanAcctName
        ) {
          throw new StagedValidationError(
            'INVALID_VENDOR_BANKING',
            `Vendor "${existingVendor.name}" requires a verified bank name, 10-digit NUBAN, and account holder name.`
          );
        }

        const vendor = await tx.vendor.update({
          where: { id: existingVendor.id },
          data: {
            category: materialPayload.category || existingVendor.category,
            taxId: cleanTin,
            bankName: cleanBank,
            accountNumber: cleanAcctNum,
            accountName: cleanAcctName,
            contactPhone: materialPayload.contactPhone || materialPayload.contact_phone || existingVendor.contactPhone,
            contactEmail: materialPayload.contactEmail || existingVendor.contactEmail,
            notes: materialPayload.notes || existingVendor.notes,
          },
        });

        recordType = 'vendor';
        recordId = vendor.id;
        url = `/vendors`;
        resultRecord = vendor;
      } else {
        const {
          name,
          category,
          tin,
          taxId,
          bank_name,
          bankName,
          account_number,
          accountNumber,
          account_name,
          accountName,
          contact_person,
          contact_phone,
          contactPhone,
          contactEmail,
          notes,
          code: customCode,
        } = materialPayload;

        const cleanName = String(name || '').trim();
        const cleanBank = String(bankName || bank_name || '').trim();
        const cleanAcctNum = String(accountNumber || account_number || '').replace(/\D/g, '');
        const cleanAcctName = String(accountName || account_name || contact_person || '').trim();
        const rawTin = String(taxId || tin || '').trim();
        const cleanTin = rawTin && rawTin.toUpperCase() !== 'PENDING_TIN' ? rawTin : null;

        if (!cleanName || cleanName.length < 2) {
          throw new StagedValidationError('VENDOR_NAME_REQUIRED', 'Vendor name (min 2 chars) is required.');
        }
        if (
          !cleanBank ||
          cleanBank.toLowerCase() === 'commercial bank' ||
          cleanAcctNum.length !== 10 ||
          cleanAcctNum === '0000000000' ||
          !cleanAcctName
        ) {
          throw new StagedValidationError(
            'INVALID_VENDOR_BANKING',
            'A verified commercial bank name, 10-digit NUBAN account number, and beneficiary account name are required to register a vendor.'
          );
        }

        const dupVendor = await tx.vendor.findFirst({
          where: {
            OR: [
              { name: { equals: cleanName, mode: 'insensitive' } },
              { accountNumber: cleanAcctNum },
              ...(cleanTin ? [{ taxId: { equals: cleanTin, mode: 'insensitive' as const } }] : []),
            ],
          },
        });
        if (dupVendor) {
          throw new StaleTargetError(
            `Vendor "${dupVendor.name}" (${dupVendor.code}) is already registered with matching name, NUBAN, or tax ID.`
          );
        }

        const count = await tx.vendor.count();
        const words = cleanName.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        const prefix = words.length >= 2 ? words.map((w) => w[0]).join('').slice(0, 3).toUpperCase() : 'VND';
        const code = customCode || `${prefix}-${String(count + 1).padStart(4, '0')}`;

        const vendor = await tx.vendor.create({
          data: {
            name: cleanName,
            code,
            category: String(category || 'GENERAL').toUpperCase().trim(),
            taxId: cleanTin,
            bankName: cleanBank,
            accountNumber: cleanAcctNum,
            accountName: cleanAcctName,
            contactPhone: contactPhone || contact_phone || null,
            contactEmail: contactEmail || null,
            notes: notes || null,
            rating: typeof materialPayload.rating === 'number' ? materialPayload.rating : 0,
          },
        });

        recordType = 'vendor';
        recordId = vendor.id;
        url = `/vendors`;
        resultRecord = vendor;
      }
    } else if (action.actionType === 'emergency_override') {
      const mode = String(
        materialPayload.mode ||
          (materialPayload.request_id || materialPayload.request_number
            ? 'OVERRIDE_EXISTING_REQUEST'
            : 'DECLARE_NEW_EMERGENCY')
      )
        .toUpperCase()
        .trim();
      const justification = String(materialPayload.justification || '').trim();
      if (!justification || justification.length < 5) {
        throw new StagedValidationError(
          'EMERGENCY_JUSTIFICATION_REQUIRED',
          'A justification of at least 5 characters is required for an emergency override.'
        );
      }

      const now = new Date();
      const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (mode === 'DECLARE_NEW_EMERGENCY') {
        const subId = String(materialPayload.subsidiary_id || materialPayload.subsidiaryId || '').trim();
        const title = String(materialPayload.title || '').trim();
        const amountNaira = Number(materialPayload.amount || 0);
        if (!subId || !title || !Number.isFinite(amountNaira) || amountNaira <= 0 || amountNaira > 1_000_000) {
          throw new StagedValidationError(
            'INVALID_EMERGENCY_DECLARATION',
            'Emergency declaration requires a valid subsidiary, title, and positive amount up to ₦1,000,000.'
          );
        }
        const org = await tx.organization.findUnique({ where: { id: subId } });
        if (!org) {
          throw new StagedValidationError('SUBSIDIARY_NOT_FOUND', `Subsidiary (${subId}) not found.`);
        }
        resolvedSubsidiaryId = org.id;

        const amountMinor = BigInt(Math.round(amountNaira * 100));
        const reqNumber = `EMG-2026-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        const createdReq = await tx.expenditureRequest.create({
          data: {
            requestNumber: reqNumber,
            groupId: org.parentGroupId || org.id,
            subsidiaryId: org.id,
            requestedById: actor.id,
            requestType: 'EMERGENCY',
            category: 'FACILITY_EMERGENCY',
            amountMinor,
            currency: 'NGN',
            title,
            justification,
            deliverable: 'Emergency repair sign-off, purchase receipt, and incident photo deliverables',
            neededBy: now,
            approvalStatus: 'APPROVED',
            paymentStatus: 'UNPAID',
            accountabilityStatus: 'PENDING',
          },
        });

        await tx.accountabilityCase.create({
          data: {
            requestId: createdReq.id,
            ownerUserId: actor.id,
            requiredDeliverables: 'Itemized vendor invoice, signed technician waybill, and photo evidence',
            dueAt,
            status: 'OPEN',
          },
        });

        recordType = 'fund_request';
        recordId = createdReq.requestNumber;
        url = `/requests/${createdReq.requestNumber}`;
        resultRecord = JSON.parse(
          JSON.stringify(createdReq, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
        );
      } else if (mode === 'OVERRIDE_EXISTING_REQUEST') {
        const { request_id, amount, amount_minor, expected_version } = materialPayload;

        const reqItem = await tx.expenditureRequest.findFirst({
          where: { OR: [{ id: request_id }, { requestNumber: request_id }] },
          include: { requester: true, approvalSteps: { orderBy: { stageIndex: 'asc' } }, channel: true },
        });

        if (!reqItem) throw new Error(`Request ${request_id} not found.`);
        resolvedSubsidiaryId = reqItem.subsidiaryId;

        if (!['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(reqItem.approvalStatus)) {
          throw new StaleTargetError(
            `Request ${reqItem.requestNumber} is already ${reqItem.approvalStatus} and cannot be overridden.`
          );
        }
        if (expected_version !== undefined && reqItem.requestVersion !== Number(expected_version)) {
          throw new StaleTargetError(
            `Request ${reqItem.requestNumber} was modified since staging (v${reqItem.requestVersion}). Please request a fresh preview.`
          );
        }

        const actualMinor = Number(reqItem.amountMinor);
        const actualNaira = actualMinor / 100;
        if (actualNaira <= 0 || actualNaira > 1_000_000) {
          throw new StagedValidationError(
            'EMERGENCY_CAP_EXCEEDED',
            `Request ${reqItem.requestNumber} amount (₦${actualNaira.toLocaleString()}) exceeds the ₦1,000,000 emergency override cap.`
          );
        }

        const expectedMinor =
          amount_minor !== undefined
            ? Number(amount_minor)
            : amount !== undefined
            ? Math.round(Number(amount) * 100)
            : actualMinor;
        if (Math.abs(actualMinor - expectedMinor) > 1) {
          throw new StaleTargetError(
            `Request ${reqItem.requestNumber} amount changed after staging (staged ₦${(expectedMinor / 100).toLocaleString()} vs actual ₦${actualNaira.toLocaleString()}).`
          );
        }

        const pendingSteps = reqItem.approvalSteps.filter((s) => s.status === 'PENDING');
        if (pendingSteps.length > 0) {
          await tx.approvalStep.updateMany({
            where: { requestId: reqItem.id, status: 'PENDING' },
            data: {
              status: 'APPROVED',
              approverId: actor.id,
              approverName: actor.legalName,
              decidedAt: now,
              decisionReason: `GMD EMERGENCY OVERRIDE: ${justification}`,
            },
          });
        } else {
          await tx.approvalStep.create({
            data: {
              requestId: reqItem.id,
              stageIndex: (reqItem.approvalSteps[reqItem.approvalSteps.length - 1]?.stageIndex || 0) + 1,
              assignedRole: actor.role,
              approverId: actor.id,
              approverName: actor.legalName,
              status: 'APPROVED',
              decisionReason: `GMD EMERGENCY OVERRIDE: ${justification}`,
              decidedAt: now,
            },
          });
        }

        const updated = await tx.expenditureRequest.update({
          where: { id: reqItem.id },
          data: {
            requestType: 'EMERGENCY',
            approvalStatus: 'APPROVED',
            updatedAt: now,
          },
          include: { requester: true },
        });

        await tx.accountabilityCase.upsert({
          where: { requestId: reqItem.id },
          create: {
            requestId: reqItem.id,
            ownerUserId: reqItem.requestedById,
            requiredDeliverables:
              reqItem.deliverable || 'Itemized vendor invoice, signed technician waybill, and photo evidence',
            dueAt,
            status: 'OPEN',
          },
          update: {
            dueAt,
            status: 'OPEN',
          },
        });

        if (reqItem.channel) {
          await tx.channelMessage.create({
            data: {
              channelId: reqItem.channel.id,
              authorId: actor.id,
              authorName: actor.legalName,
              authorRole: actor.role,
              messageType: 'AUDIT_EVENT',
              body: `Emergency override approved by ${actor.legalName}: ${justification}. Mandatory 24-hour accountability case opened.`,
            },
          });
        }

        if (reqItem.requestedById) {
          notificationIntentIds.push(reqItem.requestedById);
          await tx.systemNotification.create({
            data: {
              employeeId: reqItem.requestedById,
              kind: 'EMERGENCY_OVERRIDE',
              title: `Emergency Approval Granted: ${updated.requestNumber}`,
              body: `Your request "${updated.title}" was approved via executive emergency override. Proof of expenditure is due within 24 hours.`,
              linkUrl: `/requests/${updated.requestNumber}`,
            },
          });
          notificationsDeliveredIds.push(reqItem.requestedById);
        }
        recordType = 'fund_request';
        recordId = updated.requestNumber;
        url = `/requests/${updated.requestNumber}`;
        resultRecord = JSON.parse(
          JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
        );
      } else {
        throw new StagedValidationError('UNSUPPORTED_EMERGENCY_MODE', `Unsupported emergency mode "${mode}".`);
      }
    } else if (action.actionType === 'attendance_override') {
      const subAction = (materialPayload.action_type || materialPayload.sub_action || 'EXCUSE_OVERRIDE').toUpperCase();
      const lagosTodayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      if (
        subAction === 'UPDATE_POLICY' ||
        subAction === 'TOGGLE_STARLINK_LOCK' ||
        subAction === 'TOGGLE_GEOFENCE_LOCK' ||
        subAction === 'TOGGLE_POWER_OUTAGE'
      ) {
        const targetOrgId = materialPayload.organizationId || materialPayload.subsidiaryId || resolvedSubsidiaryId || null;
        const isGroupScope = materialPayload.scope === 'GROUP' || !targetOrgId;
        const targetOrgs = isGroupScope
          ? await tx.organization.findMany()
          : await tx.organization.findMany({ where: { id: String(targetOrgId) } });
        if (targetOrgs.length === 0) {
          throw new StagedValidationError('ORGANIZATION_NOT_FOUND', 'Target organization for attendance policy was not found.');
        }

        const current =
          (targetOrgId
            ? await tx.attendancePolicy.findUnique({ where: { organizationId: String(targetOrgId) } })
            : null) ||
          (await tx.attendancePolicy.findFirst({ where: { organization: { type: 'GROUP' } } })) ||
          (await tx.attendancePolicy.findFirst());

        const updateData: any = { updatedAt: new Date() };
        if (materialPayload.latenessDeductionPercent !== undefined) updateData.latenessDeductionPercent = Number(materialPayload.latenessDeductionPercent);
        if (materialPayload.absenceDeductionPercent !== undefined) updateData.absenceDeductionPercent = Number(materialPayload.absenceDeductionPercent);
        if (materialPayload.gracePeriodMinutes !== undefined) updateData.gracePeriodMinutes = Number(materialPayload.gracePeriodMinutes);
        if (materialPayload.earliestCheckInTime) updateData.earliestCheckInTime = String(materialPayload.earliestCheckInTime);
        if (materialPayload.resumptionTime) updateData.resumptionTime = String(materialPayload.resumptionTime);
        if (materialPayload.closingTime) updateData.closingTime = String(materialPayload.closingTime);
        if (materialPayload.starlinkIpAddresses !== undefined) updateData.starlinkIpAddresses = String(materialPayload.starlinkIpAddresses).trim();
        if (materialPayload.requireQrScan !== undefined) updateData.requireQrScan = Boolean(materialPayload.requireQrScan);

        if (subAction === 'TOGGLE_STARLINK_LOCK' || materialPayload.requireStarlinkIp !== undefined) {
          const nextStarlink =
            materialPayload.requireStarlinkIp !== undefined
              ? Boolean(materialPayload.requireStarlinkIp)
              : !(current?.requireStarlinkIp ?? true);
          updateData.requireStarlinkIp = nextStarlink;
          updateData.starlinkPowerOutageMode = !nextStarlink;
        } else if (subAction === 'TOGGLE_POWER_OUTAGE' || materialPayload.starlinkPowerOutageMode !== undefined) {
          const nextOutage =
            materialPayload.starlinkPowerOutageMode !== undefined
              ? Boolean(materialPayload.starlinkPowerOutageMode)
              : !(current?.starlinkPowerOutageMode ?? false);
          updateData.starlinkPowerOutageMode = nextOutage;
          updateData.requireStarlinkIp = !nextOutage;
        }

        if (subAction === 'TOGGLE_GEOFENCE_LOCK' || materialPayload.requireGeofence !== undefined) {
          const nextGeofence =
            materialPayload.requireGeofence !== undefined
              ? Boolean(materialPayload.requireGeofence)
              : !(current?.requireGeofence ?? true);
          updateData.requireGeofence = nextGeofence;
        }

        if (materialPayload.radiusMeters !== undefined && Number(materialPayload.radiusMeters) > 0) {
          await tx.attendanceStation.updateMany({
            where: isGroupScope ? {} : { organizationId: String(targetOrgId) },
            data: { radiusMeters: Number(materialPayload.radiusMeters) },
          });
        }

        if (isGroupScope) {
          await tx.attendancePolicy.updateMany({ data: updateData });
        }
        for (const org of targetOrgs) {
          await tx.attendancePolicy.upsert({
            where: { organizationId: org.id },
            update: updateData,
            create: {
              organizationId: org.id,
              requireStarlinkIp: updateData.requireStarlinkIp ?? current?.requireStarlinkIp ?? true,
              starlinkPowerOutageMode: updateData.starlinkPowerOutageMode ?? current?.starlinkPowerOutageMode ?? false,
              requireGeofence: updateData.requireGeofence ?? current?.requireGeofence ?? true,
            },
          });
        }

        resolvedSubsidiaryId = targetOrgId ? String(targetOrgId) : resolvedSubsidiaryId;
        recordType = 'attendance_policy';
        recordId = isGroupScope ? 'GROUP_ATTENDANCE_POLICY' : String(targetOrgId);
        url = `/attendance`;
        resultRecord = updateData;
      } else if (subAction === 'UPDATE_ROSTER') {
        const employeeId = materialPayload.employeeId || materialPayload.employee_id;
        if (!employeeId) throw new Error('employeeId is required to update staff work schedule roster.');
        const weeklyOffDays = String(materialPayload.weeklyOffDays ?? '0,6');
        const customShiftIn = String(materialPayload.customShiftIn || '08:00');
        const customShiftOut = String(materialPayload.customShiftOut || '17:00');
        const isExempt = Boolean(materialPayload.isExempt ?? false);
        const notes = materialPayload.notes ? String(materialPayload.notes) : null;

        const schedule = await tx.staffWorkSchedule.upsert({
          where: { employeeId },
          update: { weeklyOffDays, customShiftIn, customShiftOut, isExempt, notes },
          create: { employeeId, weeklyOffDays, customShiftIn, customShiftOut, isExempt, notes },
        });
        if (materialPayload.isExempt !== undefined) {
          await tx.employee.update({
            where: { id: employeeId },
            data: { isAttendanceExempt: isExempt },
          }).catch(() => {});
        }

        recordType = 'staff_work_schedule';
        recordId = schedule.id;
        url = `/attendance`;
        resultRecord = schedule;
      } else if (subAction === 'CALIBRATE_STATION') {
        const latNum = parseFloat(String(materialPayload.latitude));
        const lngNum = parseFloat(String(materialPayload.longitude));
        const radiusNum = parseInt(String(materialPayload.radiusMeters ?? 100), 10);
        if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
          throw new Error('Valid latitude and longitude coordinates are required.');
        }

        let station = await tx.attendanceStation.findFirst({ where: { status: 'ACTIVE' } });
        const org = await tx.organization.findFirst();
        if (!org) throw new Error('No organization found.');

        if (!station) {
          station = await tx.attendanceStation.create({
            data: {
              organizationId: org.id,
              name: materialPayload.name?.trim() || 'BEMS Group Corporate Headquarters',
              code: 'BEMS-HQ-MAIN',
              latitude: latNum,
              longitude: lngNum,
              radiusMeters: radiusNum > 0 ? radiusNum : 100,
              activeSecret: crypto.randomBytes(32).toString('hex'),
              status: 'ACTIVE',
            },
          });
        } else {
          station = await tx.attendanceStation.update({
            where: { id: station.id },
            data: {
              name: materialPayload.name?.trim() || station.name,
              latitude: latNum,
              longitude: lngNum,
              radiusMeters: radiusNum > 0 ? radiusNum : station.radiusMeters,
            },
          });
        }

        recordType = 'attendance_station';
        recordId = station.id;
        url = `/attendance`;
        resultRecord = station;
      } else if (subAction === 'CLOCK_IN' || subAction === 'CLOCK_OUT') {
        const isClockOut = subAction === 'CLOCK_OUT';
        const employee_id = materialPayload.employee_id;
        if (!employee_id) throw new StagedValidationError('MISSING_EMPLOYEE', 'employee_id is required for clock in/out.');
        const targetDate = materialPayload.work_date || lagosTodayStr;
        const now = new Date();

        const attendance = isClockOut
          ? await tx.attendanceRecord.upsert({
              where: { employeeId_workDate: { employeeId: employee_id, workDate: targetDate } },
              update: { checkOutTime: now },
              create: {
                employeeId: employee_id,
                workDate: targetDate,
                status: 'PRESENT',
                checkInTime: now,
                checkOutTime: now,
              },
              include: { employee: true },
            })
          : await tx.attendanceRecord.upsert({
              where: { employeeId_workDate: { employeeId: employee_id, workDate: targetDate } },
              update: { checkInTime: now, status: 'PRESENT' },
              create: {
                employeeId: employee_id,
                workDate: targetDate,
                status: 'PRESENT',
                checkInTime: now,
              },
              include: { employee: true },
            });

        recordType = 'attendance';
        recordId = attendance.id;
        url = `/attendance`;
        resultRecord = {
          id: attendance.id,
          employeeId: attendance.employeeId,
          employeeName: attendance.employee.legalName,
          workDate: attendance.workDate,
          status: attendance.status,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
        };
      } else {
        const { employee_id, work_date, action_type, reason, override_status, deduction_percent, deduction_minor } = materialPayload;
        if (!employee_id) {
          throw new StagedValidationError('MISSING_EMPLOYEE', 'employee_id is required for an attendance override.');
        }
        const targetDate = work_date || lagosTodayStr;
        const targetStatus = String(
          override_status || (action_type === 'EXCUSE' || action_type === 'WAIVE_DEDUCTION' ? 'EXCUSED' : 'PRESENT')
        ).toUpperCase();
        if (!['PRESENT', 'LATE', 'HALF_DAY', 'EXCUSED', 'ABSENT', 'ON_LEAVE'].includes(targetStatus)) {
          throw new StagedValidationError(
            'INVALID_ATTENDANCE_STATUS',
            `Invalid attendance override status "${targetStatus}".`
          );
        }

        const emp = await tx.employee.findUnique({
          where: { id: String(employee_id) },
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
              take: 1,
            },
            employmentAgreements: {
              where: { status: 'ACTIVE' },
              include: {
                compensations: {
                  where: { effectiveTo: null },
                  orderBy: { effectiveFrom: 'desc' },
                  take: 1,
                },
              },
              orderBy: { startDate: 'desc' },
              take: 1,
            },
          },
        });
        if (!emp) {
          throw new StagedValidationError('EMPLOYEE_NOT_FOUND', `Employee "${employee_id}" not found.`);
        }

        const empSubsidiaryId = emp.assignments[0]?.subsidiaryId || emp.employmentAgreements[0]?.employerEntityId || null;
        if (empSubsidiaryId) resolvedSubsidiaryId = empSubsidiaryId;

        const policy =
          (empSubsidiaryId
            ? await tx.attendancePolicy.findUnique({ where: { organizationId: empSubsidiaryId } })
            : null) ||
          (await tx.attendancePolicy.findFirst({ where: { organization: { type: 'GROUP' } } })) ||
          (await tx.attendancePolicy.findFirst());

        let deductionPercent: number;
        if (deduction_percent !== undefined && deduction_percent !== null) {
          deductionPercent = Number(deduction_percent);
        } else if (targetStatus === 'PRESENT' || targetStatus === 'EXCUSED' || targetStatus === 'ON_LEAVE') {
          deductionPercent = 0.0;
        } else if (targetStatus === 'LATE') {
          deductionPercent = Number(policy?.latenessDeductionPercent ?? 5.0);
        } else if (targetStatus === 'HALF_DAY') {
          deductionPercent = 50.0;
        } else if (targetStatus === 'ABSENT') {
          deductionPercent = Number(policy?.absenceDeductionPercent ?? 100.0);
        } else {
          deductionPercent = 0.0;
        }

        const monthlyGrossMinor = Number(emp.employmentAgreements[0]?.compensations[0]?.grossMinor ?? 0);
        const dailyWageMinor = monthlyGrossMinor > 0 ? Math.round(monthlyGrossMinor / 22) : 0;
        const computedDeductionMinor =
          deduction_minor !== undefined && deduction_minor !== null
            ? BigInt(Math.round(Number(deduction_minor)))
            : BigInt(Math.round(dailyWageMinor * (deductionPercent / 100)));

        const existingAttendance = await tx.attendanceRecord.findUnique({
          where: {
            employeeId_workDate: {
              employeeId: emp.id,
              workDate: targetDate,
            },
          },
        });

        const hasClockEvent = targetStatus === 'PRESENT' || targetStatus === 'LATE' || targetStatus === 'HALF_DAY';

        const attendance = await tx.attendanceRecord.upsert({
          where: {
            employeeId_workDate: {
              employeeId: emp.id,
              workDate: targetDate,
            },
          },
          update: {
            status: targetStatus,
            isManualOverride: true,
            overrideReason: reason || 'Executive GMD Attendance Adjustment',
            overrideById: actor.id,
            isDeductionApplied: deductionPercent > 0,
            deductionPercent,
            deductionMinor: computedDeductionMinor,
            excuseStatus: targetStatus === 'EXCUSED' || deductionPercent === 0 ? 'APPROVED' : existingAttendance?.excuseStatus || 'NONE',
            excuseRequestNote: reason || existingAttendance?.excuseRequestNote,
          },
          create: {
            employeeId: emp.id,
            workDate: targetDate,
            status: targetStatus,
            checkInTime: hasClockEvent ? new Date() : null,
            isManualOverride: true,
            overrideReason: reason || 'Executive GMD Attendance Adjustment',
            overrideById: actor.id,
            isDeductionApplied: deductionPercent > 0,
            deductionPercent,
            deductionMinor: computedDeductionMinor,
            excuseStatus: targetStatus === 'EXCUSED' || deductionPercent === 0 ? 'APPROVED' : 'NONE',
            excuseRequestNote: reason,
          },
          include: { employee: true },
        });

        notificationIntentIds.push(emp.id);
        await tx.systemNotification.create({
          data: {
            employeeId: emp.id,
            kind: 'ATTENDANCE_OVERRIDE',
            title: `Attendance Adjusted (${targetDate})`,
            body: `Your attendance status for ${targetDate} was updated to ${targetStatus} (${deductionPercent}% penalty) by ${actor.legalName}.`,
            linkUrl: '/attendance',
          },
        });
        notificationsDeliveredIds.push(emp.id);
        recordType = 'attendance';
        recordId = attendance.id;
        url = `/attendance`;
        resultRecord = {
          id: attendance.id,
          employeeId: attendance.employeeId,
          employeeName: attendance.employee.legalName,
          workDate: attendance.workDate,
          status: attendance.status,
          deductionPercent: attendance.deductionPercent,
          deductionMinor: Number(attendance.deductionMinor),
        };
      }
    } else if (action.actionType === 'admin_onboarding') {
      const subAction = String(materialPayload.sub_action || materialPayload.action || 'CREATE_INVITE').toUpperCase();

      if (subAction === 'RESEND_INVITE') {
        const inviteId = materialPayload.invitationId || materialPayload.id;
        const invitation = await tx.adminInvitation.findUnique({
          where: { id: inviteId },
          include: { subsidiary: { select: { id: true, legalName: true } } },
        });
        if (!invitation) throw new Error('Invitation not found.');
        if (invitation.status === 'COMPLETED') throw new Error('Invitation is already completed.');

        const newToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const updated = await tx.adminInvitation.update({
          where: { id: inviteId },
          data: { token: newToken, expiresAt, status: 'PENDING' },
        });

        try {
          await sendAdminInvitationEmail({
            to: invitation.workEmail,
            role: invitation.role,
            subsidiaryName: invitation.subsidiary.legalName,
            positionName: invitation.positionName || invitation.role,
            inviteToken: newToken,
            expiresInDays: 7,
          });
        } catch (e) {
          console.warn('Resend invite email warning:', e);
        }

        recordType = 'admin_invitation';
        recordId = updated.id;
        url = `/staff`;
        resultRecord = updated;
      } else if (subAction === 'REVOKE_INVITE') {
        const inviteId = materialPayload.invitationId || materialPayload.id;
        const updated = await tx.adminInvitation.update({
          where: { id: inviteId },
          data: { status: 'REVOKED' },
        });
        recordType = 'admin_invitation';
        recordId = updated.id;
        url = `/staff`;
        resultRecord = updated;
      } else {
        const { workEmail, role, subsidiaryId, departmentId, positionName, legalName } = materialPayload;
        const canonicalRole = role === 'GMD' ? 'GMD' : 'SUPER_ADMIN';

        if (canonicalRole === 'GMD') {
          const existingGmd = await tx.employee.findFirst({
            where: { role: 'GMD', status: 'ACTIVE', approvalStatus: 'APPROVED' },
          });
          if (existingGmd) {
            throw new Error(`An active GMD already exists: ${existingGmd.legalName} (${existingGmd.workEmail}).`);
          }
        }

        const existingEmp = await tx.employee.findUnique({ where: { workEmail } });
        if (existingEmp) {
          throw new Error(`An active account already exists for ${workEmail} (${existingEmp.legalName}).`);
        }

        const subsidiary = await tx.organization.findUnique({
          where: { id: subsidiaryId },
          select: { id: true, legalName: true },
        });
        if (!subsidiary) {
          throw new Error('Selected subsidiary entity was not found.');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await tx.adminInvitation.updateMany({
          where: { workEmail, status: 'PENDING' },
          data: { status: 'REVOKED' },
        });

        const invitation = await tx.adminInvitation.create({
          data: {
            workEmail,
            role: canonicalRole,
            subsidiaryId: subsidiary.id,
            departmentId: departmentId || null,
            positionName: positionName || (canonicalRole === 'GMD' ? 'The Group Managing Director' : 'Super Admin'),
            token,
            invitedById: actor.id,
            status: 'PENDING',
            expiresAt,
          },
        });

        try {
          await sendAdminInvitationEmail({
            to: workEmail,
            role: canonicalRole,
            subsidiaryName: subsidiary.legalName,
            positionName: invitation.positionName || canonicalRole,
            inviteToken: token,
            expiresInDays: 7,
          });
        } catch (e) {
          console.warn('Executive invite email dispatch warning:', e);
        }

        recordType = 'admin_invitation';
        recordId = invitation.id;
        url = `/staff`;
        resultRecord = {
          id: invitation.id,
          legalName,
          workEmail: invitation.workEmail,
          role: invitation.role,
          subsidiaryName: subsidiary.legalName,
          expiresAt: invitation.expiresAt.toISOString(),
        };
      }
    } else if (action.actionType === 'subsidiary_creation') {
      const { name, code, type, currency, brandColor, industry, headquarters, logoUrl } = materialPayload;

      const org = await tx.organization.create({
        data: {
          legalName: name,
          code,
          type: ['GROUP', 'SUBSIDIARY', 'OPERATING_SUBSIDIARY', 'SPECIAL_PURPOSE_VEHICLE'].includes(type) ? type : 'SUBSIDIARY',
          status: 'ACTIVE',
          defaultCurrency: ['NGN', 'USD', 'GBP', 'EUR'].includes(currency) ? currency : 'NGN',
          timezone: 'Africa/Lagos',
          brandColor,
          logoUrl: logoUrl || null,
        },
      });

      await tx.attendancePolicy.create({
        data: {
          organizationId: org.id,
          earliestCheckInTime: '07:00',
          resumptionTime: '08:00',
          closingTime: '17:00',
          gracePeriodMinutes: 15,
          latenessDeductionPercent: 5.0,
          absenceDeductionPercent: 100.0,
          requireGeofence: true,
          requireQrScan: true,
          requireStarlinkIp: true,
          starlinkIpAddresses: '2605:59c1:1a3a:a210:*, 98.97.76.109, 98.97.76.*, 98.97.*',
          starlinkPowerOutageMode: false,
        },
      });

      if (industry) {
        await tx.workspaceSetting.create({
          data: { organizationId: org.id, key: 'SUBSIDIARY_INDUSTRY', value: industry, updatedById: actor.id },
        });
      }
      if (headquarters) {
        await tx.workspaceSetting.create({
          data: { organizationId: org.id, key: 'HEADQUARTERS_LOCATION', value: headquarters, updatedById: actor.id },
        });
      }

      recordType = 'organization';
      recordId = org.id;
      url = `/`;
      resultRecord = {
        id: org.id,
        name: org.legalName,
        code: org.code,
        type: org.type,
        currency: org.defaultCurrency,
        brandColor: org.brandColor,
      };
    } else if (action.actionType === 'bank_account_update') {
      const { targetType, targetRecordId, bankName, accountNumber, accountName, accountType } = materialPayload;

      if (targetType === 'STAFF') {
        const emp = await tx.employee.findUnique({ where: { id: targetRecordId } });
        if (!emp) throw new Error('Target staff member not found.');

        const updated = await tx.employee.update({
          where: { id: emp.id },
          data: {
            bankName,
            accountNumber,
            accountName,
            salaryBankName: emp.salaryBankName || bankName,
            salaryAccountNumber: emp.salaryAccountNumber || accountNumber,
            salaryAccountName: emp.salaryAccountName || accountName,
          },
        });
        recordType = 'staff_bank_account';
        recordId = updated.id;
        url = `/staff`;
        resultRecord = {
          id: updated.id,
          name: updated.legalName,
          bankName: updated.bankName,
          accountNumber: updated.accountNumber,
          accountName: updated.accountName,
        };
      } else if (targetType === 'SUBSIDIARY') {
        const org = await tx.organization.findUnique({ where: { id: targetRecordId } });
        if (!org) throw new StagedValidationError('TREASURY_ORG_NOT_FOUND', 'Target subsidiary not found.');
        resolvedSubsidiaryId = org.id;

        const existingAcct = await tx.companyBankAccount.findUnique({
          where: { accountNumber },
          include: { organization: true },
        });
        if (existingAcct && existingAcct.organizationId !== org.id) {
          throw new StagedValidationError(
            'TREASURY_ORG_MISMATCH',
            `Account ${accountNumber} is already registered to ${existingAcct.organization.legalName} and cannot be moved to ${org.legalName}.`
          );
        }

        const bankAccount = existingAcct
          ? await tx.companyBankAccount.update({
              where: { id: existingAcct.id },
              data: {
                bankName,
                accountName,
                accountType: accountType || existingAcct.accountType || 'Corporate Operational',
                status: 'ACTIVE',
                // Never reset balance or reassign organizationId
              },
            })
          : await tx.companyBankAccount.create({
              data: {
                organizationId: org.id,
                bankName,
                accountName,
                accountNumber,
                accountType: accountType || 'Corporate Operational',
                currency: org.defaultCurrency || 'NGN',
                balance: 0,
                status: 'ACTIVE',
              },
            });
        recordType = 'company_bank_account';
        recordId = bankAccount.id;
        url = `/treasury`;
        resultRecord = bankAccount;
      } else if (targetType === 'VENDOR') {
        const vendor = await tx.vendor.update({
          where: { id: targetRecordId },
          data: { bankName, accountNumber, accountName },
        });
        recordType = 'vendor_bank_account';
        recordId = vendor.id;
        url = `/vendors`;
        resultRecord = vendor;
      } else {
        throw new Error(`Invalid bank_account_update targetType: ${targetType}`);
      }
    } else if (action.actionType === 'payroll_action') {
      const subAction = (materialPayload.sub_action || materialPayload.action || 'PREPARE').toUpperCase();
      const year = Number(materialPayload.year) || new Date().getFullYear();
      const month = Number(materialPayload.month) || new Date().getMonth() + 1;

      if (subAction === 'PREPARE') {
        const allSubsidiaries = await tx.organization.findMany({ where: { status: 'ACTIVE' } });
        const hqOrg = allSubsidiaries.find((o) => o.type === 'GROUP' || o.code === 'BEMS-GROUP') || allSubsidiaries[0];
        const defaultSubId = hqOrg?.id || 'bems-group-hq';

        let period = await tx.payrollPeriod.findFirst({
          where: { year, month },
          include: {
            batches: {
              orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
              include: { items: { include: { disbursement: true } } },
            },
          },
        });

        if (!period) {
          period = await tx.payrollPeriod.create({
            data: {
              groupId: defaultSubId,
              year,
              month,
              startsOn: new Date(year, month - 1, 1),
              endsOn: new Date(year, month, 0, 23, 59, 59),
              lockStatus: 'OPEN',
            },
            include: {
              batches: {
                orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
                include: { items: { include: { disbursement: true } } },
              },
            },
          });
        }

        const activeStaff = await tx.employee.findMany({
          where: { status: 'ACTIVE', role: 'STAFF' },
          include: {
            assignments: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } },
            employmentAgreements: {
              where: { status: 'ACTIVE' },
              orderBy: { startDate: 'desc' },
              include: {
                compensations: {
                  orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
                  include: { costAllocations: true },
                },
              },
            },
          },
        });

        const eligibleStaff = activeStaff.filter((s) => {
          const ag = s.employmentAgreements[0];
          const comp = ag?.compensations[0];
          return Boolean(ag && comp && Number(comp.grossMinor) > 0);
        });

        if (eligibleStaff.length === 0) {
          throw new Error('No active staff members have a configured salary yet.');
        }

        let batch = period.batches[0];
        let isRegeneration = false;
        if (batch) {
          if (batch.items.some((item) => Boolean(item.disbursement))) {
            throw new Error('Cannot regenerate payroll batch because salary disbursements have already been recorded.');
          }
          isRegeneration = true;
          await tx.payrollItemAllocation.deleteMany({ where: { item: { batchId: batch.id } } });
          await tx.payrollItem.deleteMany({ where: { batchId: batch.id } });
          if (period.lockStatus === 'LOCKED') {
            await tx.payrollPeriod.update({ where: { id: period.id }, data: { lockStatus: 'OPEN' } });
          }
        } else {
          batch = await tx.payrollBatch.create({
            data: {
              periodId: period.id,
              version: 1,
              status: 'SUBMITTED',
              totalGrossMinor: BigInt(0),
              totalNetMinor: BigInt(0),
            },
            include: { items: { include: { disbursement: true } } },
          });
        }

        let totalGross = BigInt(0);
        let totalNet = BigInt(0);
        for (const staff of eligibleStaff) {
          const agreement = staff.employmentAgreements[0];
          const comp = agreement.compensations[0];
          const grossMinor = comp.grossMinor;
          const grossNum = Number(grossMinor);

          const item = await tx.payrollItem.create({
            data: {
              batchId: batch.id,
              employeeId: staff.id,
              agreementId: agreement.id,
              grossMinor,
              employeeDeductionsMinor: BigInt(0),
              employerCostMinor: BigInt(0),
              netMinor: grossMinor,
              currency: comp.currency || 'NGN',
              status: 'CALCULATED',
            },
          });

          totalGross += grossMinor;
          totalNet += grossMinor;

          const allocations = comp.costAllocations || [];
          if (allocations.length > 0) {
            for (const alloc of allocations) {
              await tx.payrollItemAllocation.create({
                data: {
                  itemId: item.id,
                  subsidiaryId: alloc.subsidiaryId,
                  allocableCostMinor: BigInt(Math.round(grossNum * (alloc.percentage / 100))),
                  percentage: alloc.percentage,
                },
              });
            }
          } else {
            const subId = staff.assignments[0]?.subsidiaryId || agreement.employerEntityId || defaultSubId;
            await tx.payrollItemAllocation.create({
              data: {
                itemId: item.id,
                subsidiaryId: subId,
                allocableCostMinor: grossMinor,
                percentage: 100,
              },
            });
          }
        }

        const nextVersion = isRegeneration ? batch.version + 1 : batch.version;
        const updatedBatch = await tx.payrollBatch.update({
          where: { id: batch.id },
          data: {
            version: nextVersion,
            status: 'SUBMITTED',
            approvedAt: null,
            snapshotHash: null,
            paymentEntityId: batch.paymentEntityId || defaultSubId,
            submittedById: actor.id,
            submittedByName: actor.legalName,
            totalGrossMinor: totalGross,
            totalNetMinor: totalNet,
          },
        });

        recordType = 'payroll_batch';
        recordId = updatedBatch.id;
        url = `/payroll`;
        resultRecord = {
          batchId: updatedBatch.id,
          version: nextVersion,
          employeeCount: eligibleStaff.length,
          totalGross: Number(totalGross) / 100,
          totalNet: Number(totalNet) / 100,
        };
      } else if (subAction === 'SIGN_OFF' || subAction === 'APPROVE') {
        const period = await tx.payrollPeriod.findFirst({
          where: { year, month },
          include: { batches: { orderBy: [{ version: 'desc' }, { createdAt: 'desc' }], take: 1 } },
        });
        if (!period || !period.batches.length) {
          throw new Error(`No prepared payroll batch found for ${month}/${year}.`);
        }
        const batch = period.batches[0];
        const updated = await tx.payrollBatch.update({
          where: { id: batch.id },
          data: { status: 'APPROVED', approvedAt: new Date() },
        });
        await tx.payrollPeriod.update({
          where: { id: period.id },
          data: { lockStatus: 'LOCKED' },
        });
        recordType = 'payroll_batch';
        recordId = updated.id;
        url = `/payroll`;
        resultRecord = {
          id: updated.id,
          status: updated.status,
          version: updated.version,
          totalNet: Number(updated.totalNetMinor) / 100,
          approvedAt: updated.approvedAt,
        };
      } else if (subAction === 'RECORD_PAYOUT' || subAction === 'DISBURSE') {
        const itemId = materialPayload.itemId || materialPayload.payrollItemId;
        const batchId = materialPayload.batchId;
        const externalReference = materialPayload.externalReference || `PAY-AI-${Date.now()}`;
        const bankName = materialPayload.bankName || 'Corporate Treasury Bank';

        const targetItems = itemId
          ? await tx.payrollItem.findMany({
              where: { id: itemId },
              include: { employee: true, disbursement: true, batch: { include: { period: true } } },
            })
          : await tx.payrollItem.findMany({
              where: { batchId },
              include: { employee: true, disbursement: true, batch: { include: { period: true } } },
            });

        if (!targetItems.length) {
          throw new Error('No matching payroll items found to disburse.');
        }

        const defaultOrg = await tx.organization.findFirst({ orderBy: { type: 'asc' }, select: { id: true } });
        const disbursedIds: string[] = [];

        for (const item of targetItems) {
          if (item.disbursement) continue;
          if (item.batch.status !== 'APPROVED') {
            throw new Error('Only an APPROVED payroll batch can be disbursed.');
          }
          const payingEntityId = item.batch.paymentEntityId || defaultOrg?.id;
          if (!payingEntityId) throw new Error('No paying organization configured for payroll batch.');

          const beneficiaryBank = item.employee.salaryBankName || item.employee.bankName || 'Bank on Record';
          const beneficiaryAccount = item.employee.salaryAccountNumber || item.employee.accountNumber || '0000000000';

          const payment = await tx.disbursement.create({
            data: {
              payrollItemId: item.id,
              beneficiaryEmployeeId: item.employeeId,
              payerOrgId: payingEntityId,
              beneficiaryName: item.employee.legalName,
              beneficiaryBank,
              beneficiaryAccount,
              amountMinor: item.netMinor,
              currency: item.currency,
              externalReference: targetItems.length > 1 ? `${externalReference}-${item.employee.employeeNumber}` : externalReference,
              bankName,
              recordedById: actor.id,
              status: 'AWAITING_RECIPIENT_CONFIRMATION',
              idempotencyKey: `PAY-${item.id}-${Date.now()}`,
            },
          });

          await tx.payrollItem.update({
            where: { id: item.id },
            data: { status: 'PAID' },
          });

          await tx.systemNotification.create({
            data: {
              employeeId: item.employeeId,
              kind: 'PAYROLL_PAYMENT_CONFIRMATION_REQUIRED',
              title: 'Confirm payroll payment received',
              body: `A payroll transfer for ${item.batch.period.year}-${String(item.batch.period.month).padStart(2, '0')} was recorded. Please confirm whether the salary reached your account.`,
              linkUrl: '/payroll',
            },
          });

          const amountNaira = Number(item.netMinor) / 100;
          const bankAccount =
            (await tx.companyBankAccount.findFirst({
              where: { organizationId: payingEntityId, status: 'ACTIVE', bankName: { contains: bankName, mode: 'insensitive' } },
            })) ||
            (await tx.companyBankAccount.findFirst({
              where: { organizationId: payingEntityId, status: 'ACTIVE' },
            }));

          if (bankAccount) {
            const newBal = Math.max(0, Number(bankAccount.balance) - amountNaira);
            await tx.companyBankAccount.update({
              where: { id: bankAccount.id },
              data: { balance: newBal },
            });
          }

          disbursedIds.push(payment.id);
          notificationIntentIds.push(item.employeeId);
          notificationsDeliveredIds.push(item.employeeId);
          resolvedSubsidiaryId = payingEntityId || resolvedSubsidiaryId;
        }

        if (batchId) {
          await tx.payrollBatch.update({
            where: { id: batchId },
            data: { status: 'PAID' },
          });
        }

        recordType = 'payroll_disbursement';
        recordId = disbursedIds[0] || batchId || itemId;
        url = `/payroll`;
        resultRecord = {
          disbursedCount: disbursedIds.length,
          disbursementIds: disbursedIds,
        };
      } else if (subAction === 'REMOVE_ITEM') {
        const itemId = materialPayload.itemId || materialPayload.payrollItemId;
        const mode = materialPayload.mode === 'PERMANENT' ? 'PERMANENT' : 'BATCH_ONLY';
        const reason = String(materialPayload.reason || 'Removed from payroll run via BEMI');
        const item = await tx.payrollItem.findUnique({
          where: { id: itemId },
          include: { employee: true, disbursement: true },
        });
        if (!item) throw new Error('Payroll item not found.');
        if (item.disbursement && item.disbursement.status !== 'UNPAID') {
          throw new Error('Cannot remove item because salary disbursement has already been recorded.');
        }

        if (item.disbursement) {
          await tx.disbursement.delete({ where: { id: item.disbursement.id } });
        }
        await tx.payrollItemAllocation.deleteMany({ where: { itemId } });
        await tx.payrollItem.delete({ where: { id: itemId } });

        const remaining = await tx.payrollItem.findMany({
          where: { batchId: item.batchId },
          select: { grossMinor: true, netMinor: true },
        });
        let newGross = BigInt(0);
        let newNet = BigInt(0);
        for (const r of remaining) {
          newGross += r.grossMinor;
          newNet += r.netMinor;
        }
        await tx.payrollBatch.update({
          where: { id: item.batchId },
          data: { totalGrossMinor: newGross, totalNetMinor: newNet },
        });

        recordType = 'payroll_item_removed';
        recordId = itemId;
        url = `/payroll`;
        resultRecord = { itemId, staffName: item.employee.legalName, mode, reason };
      } else if (subAction === 'CONFIRM_RECEIPT') {
        const disbursementId = materialPayload.disbursementId;
        const decision = String(materialPayload.decision || 'RECEIVED').toUpperCase();
        const note = materialPayload.note ? String(materialPayload.note).trim() : null;
        const disbursement = await tx.disbursement.findUnique({
          where: { id: disbursementId },
          include: { request: true, payrollItem: true },
        });
        if (!disbursement) throw new Error('Disbursement not found.');

        const received = decision === 'RECEIVED';
        const nextStatus = received ? 'RECIPIENT_CONFIRMED' : 'RECIPIENT_REPORTED_ISSUE';

        await tx.recipientPaymentConfirmation.upsert({
          where: { disbursementId },
          create: { disbursementId, employeeId: actor.id, decision, note },
          update: { decision, note },
        });
        const updatedDisb = await tx.disbursement.update({
          where: { id: disbursementId },
          data: { status: nextStatus },
        });
        if (disbursement.requestId) {
          await tx.expenditureRequest.update({
            where: { id: disbursement.requestId },
            data: { paymentStatus: nextStatus },
          });
        }

        recordType = 'disbursement_confirmation';
        recordId = updatedDisb.id;
        url = `/payroll`;
        resultRecord = { disbursementId: updatedDisb.id, status: nextStatus, decision };
      } else {
        throw new Error(`Unsupported payroll_action sub_action: ${subAction}`);
      }
    } else if (action.actionType === 'subsidiary_update') {
      const organizationId = materialPayload.organizationId || materialPayload.subsidiaryId || materialPayload.id;
      if (!organizationId) {
        throw new Error('organizationId is required to update a subsidiary.');
      }

      const existingOrg = await tx.organization.findUnique({
        where: { id: organizationId },
        include: { budgets: { where: { status: 'ACTIVE' }, select: { id: true, totalAmount: true } } },
      });
      if (!existingOrg) {
        throw new Error(`Organization (${organizationId}) not found.`);
      }

      const updateData: any = {};
      if (typeof materialPayload.legalName === 'string' && materialPayload.legalName.trim()) {
        updateData.legalName = materialPayload.legalName.trim();
      }
      if (typeof materialPayload.code === 'string' && materialPayload.code.trim()) {
        const cleanCode = materialPayload.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        if (cleanCode && cleanCode !== existingOrg.code) {
          const dupCode = await tx.organization.findFirst({
            where: { code: cleanCode, id: { not: organizationId } },
          });
          if (dupCode) {
            throw new Error(`Another subsidiary already uses the code "${cleanCode}".`);
          }
          updateData.code = cleanCode;
        }
      }
      if (typeof materialPayload.defaultCurrency === 'string' && materialPayload.defaultCurrency.trim()) {
        updateData.defaultCurrency = materialPayload.defaultCurrency.trim().toUpperCase();
      }
      if (
        typeof materialPayload.type === 'string' &&
        ['GROUP', 'SUBSIDIARY', 'CLIENT'].includes(materialPayload.type.trim().toUpperCase())
      ) {
        updateData.type = materialPayload.type.trim().toUpperCase();
      }
      if (materialPayload.brandColor !== undefined) {
        updateData.brandColor =
          typeof materialPayload.brandColor === 'string' && materialPayload.brandColor.trim()
            ? materialPayload.brandColor.trim()
            : null;
      }
      if (materialPayload.logoUrl !== undefined) {
        updateData.logoUrl =
          typeof materialPayload.logoUrl === 'string' && materialPayload.logoUrl.trim()
            ? materialPayload.logoUrl.trim()
            : null;
      }

      const updatedOrg = await tx.organization.update({
        where: { id: organizationId },
        data: updateData,
      });

      if (materialPayload.brandColor) {
        await tx.workspaceSetting.upsert({
          where: { organizationId_key: { organizationId, key: 'BRAND_COLOR' } },
          create: { organizationId, key: 'BRAND_COLOR', value: String(materialPayload.brandColor).trim(), updatedById: actor.id },
          update: { value: String(materialPayload.brandColor).trim(), updatedById: actor.id },
        });
      }
      if (materialPayload.industry !== undefined && String(materialPayload.industry).trim()) {
        await tx.workspaceSetting.upsert({
          where: { organizationId_key: { organizationId, key: 'SUBSIDIARY_INDUSTRY' } },
          create: { organizationId, key: 'SUBSIDIARY_INDUSTRY', value: String(materialPayload.industry).trim(), updatedById: actor.id },
          update: { value: String(materialPayload.industry).trim(), updatedById: actor.id },
        });
      }
      if (materialPayload.headquarters !== undefined && String(materialPayload.headquarters).trim()) {
        await tx.workspaceSetting.upsert({
          where: { organizationId_key: { organizationId, key: 'HEADQUARTERS_LOCATION' } },
          create: { organizationId, key: 'HEADQUARTERS_LOCATION', value: String(materialPayload.headquarters).trim(), updatedById: actor.id },
          update: { value: String(materialPayload.headquarters).trim(), updatedById: actor.id },
        });
      }
      if (materialPayload.rcNumber !== undefined && String(materialPayload.rcNumber).trim()) {
        await tx.workspaceSetting.upsert({
          where: { organizationId_key: { organizationId, key: 'RC_NUMBER' } },
          create: { organizationId, key: 'RC_NUMBER', value: String(materialPayload.rcNumber).trim(), updatedById: actor.id },
          update: { value: String(materialPayload.rcNumber).trim(), updatedById: actor.id },
        });
      }

      const monthlyBudget = Number(materialPayload.monthlyBudget ?? materialPayload.monthly_budget ?? NaN);
      if (!Number.isNaN(monthlyBudget) && monthlyBudget >= 0) {
        const activeBudget = existingOrg.budgets[0];
        if (activeBudget) {
          await tx.budget.update({
            where: { id: activeBudget.id },
            data: { totalAmount: monthlyBudget },
          });
        } else {
          const now = new Date();
          const fiscalYear = now.getFullYear();
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          await tx.budget.create({
            data: {
              organizationId,
              fiscalYear,
              fiscalPeriod: 'MONTHLY',
              periodName: `${monthNames[now.getMonth()]} ${fiscalYear}`,
              totalAmount: monthlyBudget,
              committedAmount: 0,
              spentAmount: 0,
              status: 'ACTIVE',
              warningThreshold: 80.0,
            },
          });
        }
      }

      recordType = 'subsidiary';
      recordId = updatedOrg.id;
      url = `/subsidiary`;
      resultRecord = updatedOrg;
    } else if (action.actionType === 'staff_management') {
      const subAction = String(materialPayload.sub_action || materialPayload.action_type || 'EDIT_PROFILE').toUpperCase();

      if (subAction === 'REGISTER_OFFLINE') {
        const legalName = String(materialPayload.legalName || '').trim();
        if (!legalName || legalName.length < 2) {
          throw new Error('Staff full legal name is required for offline registration.');
        }
        const subsidiaryId = materialPayload.subsidiaryId;
        const org = subsidiaryId
          ? await tx.organization.findUnique({ where: { id: subsidiaryId } })
          : await tx.organization.findFirst({ orderBy: { type: 'asc' } });
        if (!org) throw new Error('Valid subsidiary organization not found.');

        const orgCode = (org.code || 'GRO').replace(/^BEMS-?/i, '').slice(0, 3).toUpperCase() || 'GRO';
        const year = new Date().getFullYear();
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const employeeNumber = `BEMS-${orgCode}-${year}-${randomSuffix}`;
        const kioskPin =
          typeof materialPayload.kioskPin === 'string' && /^\d{4}$/.test(materialPayload.kioskPin.trim())
            ? materialPayload.kioskPin.trim()
            : String(Math.floor(1000 + Math.random() * 9000));
        const placeholderEmail = `offline.${employeeNumber.toLowerCase()}@bems.internal`;
        const jobTitle = String(materialPayload.jobTitle || 'Field Staff').trim();
        const now = new Date();

        const emp = await tx.employee.create({
          data: {
            employeeNumber,
            legalName,
            workEmail: placeholderEmail,
            phone: materialPayload.phone || null,
            role: 'STAFF',
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            isOfflineStaff: true,
            kioskPin,
            onboardedById: actor.id,
            gender: materialPayload.gender || 'MALE',
            jobTitle,
            employmentType: materialPayload.employmentType || 'FULL_TIME',
            staffGrade: materialPayload.staffGrade || null,
            residentialAddress: materialPayload.residentialAddress || null,
            cityState: materialPayload.cityState || null,
            bankName: materialPayload.bankName || null,
            accountNumber: materialPayload.accountNumber || null,
            accountName: materialPayload.accountName || legalName,
            salaryBankName: materialPayload.bankName || null,
            salaryAccountNumber: materialPayload.accountNumber || null,
            salaryAccountName: materialPayload.accountName || legalName,
          },
        });

        await tx.employeeAssignment.create({
          data: {
            employeeId: emp.id,
            subsidiaryId: org.id,
            departmentId: materialPayload.departmentId || null,
            positionName: jobTitle,
            isPrimary: true,
            status: 'ACTIVE',
          },
        });

        const agreement = await tx.employmentAgreement.create({
          data: {
            employeeId: emp.id,
            employerEntityId: org.id,
            agreementType: 'PERMANENT',
            paymentModel: 'GROUP_PAID',
            status: 'ACTIVE',
            startDate: now,
          },
        });

        const proposedSalary = Number(materialPayload.proposedSalary || 0);
        if (proposedSalary > 0) {
          const grossMinor = BigInt(Math.round(proposedSalary * 100));
          const comp = await tx.compensationAgreement.create({
            data: {
              employmentAgreementId: agreement.id,
              grossMinor,
              currency: 'NGN',
              recurrence: 'MONTHLY',
              effectiveFrom: now,
              version: 1,
              approvedBy: actor.id,
              changeType: 'INITIAL_SALARY',
              changeReason: `Initial offline enrollment authorized by ${actor.legalName}`,
            },
          });
          await tx.costAllocation.create({
            data: {
              compensationAgreementId: comp.id,
              subsidiaryId: org.id,
              percentage: 100,
              effectiveFrom: now,
            },
          });
        }

        recordType = 'employee';
        recordId = emp.id;
        url = `/hr`;
        resultRecord = {
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          legalName: emp.legalName,
          kioskPin: emp.kioskPin,
          subsidiaryName: org.legalName,
        };
      } else {
        const employeeId = materialPayload.employeeId || materialPayload.employee_id;
        if (!employeeId) throw new Error('employeeId is required for staff management actions.');

        const targetEmployee = await tx.employee.findUnique({
          where: { id: employeeId },
          include: {
            assignments: { where: { isPrimary: true } },
            expenditureRequests: { take: 1, select: { id: true } },
            disbursementAssignments: { take: 1, select: { id: true } },
            approvalSteps: { take: 1, select: { id: true } },
            disbursementsRecorded: { take: 1, select: { id: true } },
          },
        });
        if (!targetEmployee) {
          throw new Error(`Staff member (${employeeId}) not found.`);
        }

        resolvedSubsidiaryId = targetEmployee.assignments[0]?.subsidiaryId || resolvedSubsidiaryId;

        if (targetEmployee.role === 'GMD' && actor.role !== 'GMD') {
          throw new StagedValidationError(
            'GMD_IMMUTABLE',
            'Only the active Group Managing Director can modify the GMD account.'
          );
        }

        if (subAction === 'TOGGLE_ATTENDANCE_EXEMPT') {
          const isExempt =
            materialPayload.isAttendanceExempt !== undefined
              ? Boolean(materialPayload.isAttendanceExempt)
              : !targetEmployee.isAttendanceExempt;
          const updated = await tx.employee.update({
            where: { id: employeeId },
            data: { isAttendanceExempt: isExempt },
          });
          notificationIntentIds.push(employeeId);
          await tx.systemNotification.create({
            data: {
              employeeId,
              kind: 'ATTENDANCE_EXEMPTION',
              title: `Attendance Exemption ${isExempt ? 'Enabled' : 'Disabled'}`,
              body: `Your attendance clock-in exemption was ${isExempt ? 'enabled' : 'disabled'} by ${actor.legalName}.`,
              linkUrl: '/attendance',
            },
          });
          notificationsDeliveredIds.push(employeeId);
          recordType = 'employee';
          recordId = updated.id;
          url = `/hr`;
          resultRecord = {
            id: updated.id,
            legalName: updated.legalName,
            isAttendanceExempt: updated.isAttendanceExempt,
          };
        } else if (subAction === 'CHANGE_STATUS') {
          const nextStatus = String(materialPayload.status || 'ACTIVE').toUpperCase();
          if (!['ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(nextStatus)) {
            throw new Error(`Invalid staff status: ${nextStatus}`);
          }
          const updated = await tx.employee.update({
            where: { id: employeeId },
            data: { status: nextStatus },
          });
          if (nextStatus === 'TERMINATED' || nextStatus === 'SUSPENDED') {
            await tx.authSession.deleteMany({ where: { employeeId } });
            invalidateSessionCache(employeeId);
          }
          if (nextStatus === 'TERMINATED') {
            await tx.employeeAssignment.updateMany({
              where: { employeeId },
              data: { status: 'INACTIVE' },
            });
          } else if (nextStatus === 'ACTIVE') {
            await tx.employeeAssignment.updateMany({
              where: { employeeId, isPrimary: true },
              data: { status: 'ACTIVE' },
            });
          }
          notificationIntentIds.push(employeeId);
          await tx.systemNotification.create({
            data: {
              employeeId,
              kind: 'ACCOUNT_STATUS',
              title: `Account Status: ${nextStatus}`,
              body: `Your account status was updated to ${nextStatus} by ${actor.legalName}.`,
              linkUrl: '/',
            },
          });
          notificationsDeliveredIds.push(employeeId);
          recordType = 'employee';
          recordId = updated.id;
          url = `/hr`;
          resultRecord = {
            id: updated.id,
            legalName: updated.legalName,
            status: updated.status,
          };
        } else if (subAction === 'REQUEST_UPDATE') {
          const requestedFields = Array.isArray(materialPayload.requestedFields)
            ? materialPayload.requestedFields
            : ['bankAccount', 'phone', 'residentialAddress'];
          const instructions =
            typeof materialPayload.instructions === 'string' && materialPayload.instructions.trim()
              ? materialPayload.instructions.trim()
              : 'Please verify and update your profile records on the BEMS portal.';

          await tx.staffProfileUpdateRequest.updateMany({
            where: { employeeId, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          });

          const updateRequest = await tx.staffProfileUpdateRequest.create({
            data: {
              employeeId,
              requestedById: actor.id,
              requestedFields: JSON.stringify(requestedFields),
              instructions,
              status: 'PENDING',
            },
          });

          await tx.systemNotification.create({
            data: {
              employeeId,
              title: 'Action Required: Profile Update Requested',
              body: instructions,
              kind: 'ACTION_REQUIRED',
            },
          });

          notificationIntentIds.push(employeeId);
          notificationsDeliveredIds.push(employeeId);
          recordType = 'staff_profile_update_request';
          recordId = updateRequest.id;
          url = `/hr`;
          resultRecord = updateRequest;
        } else if (subAction === 'DELETE_OR_DEACTIVATE') {
          if (targetEmployee.id === actor.id) {
            throw new Error('You cannot delete your own active session account.');
          }
          const hasAuditHistory =
            targetEmployee.expenditureRequests.length > 0 ||
            targetEmployee.disbursementAssignments.length > 0 ||
            targetEmployee.approvalSteps.length > 0 ||
            targetEmployee.disbursementsRecorded.length > 0;

          if (hasAuditHistory) {
            const deactivated = await tx.employee.update({
              where: { id: employeeId },
              data: {
                status: 'TERMINATED',
                approvalStatus: 'REJECTED',
                passwordHash: null,
                workEmail: `deleted_${Date.now()}_${targetEmployee.workEmail}`,
              },
            });
            await tx.authSession.deleteMany({ where: { employeeId } });
            invalidateSessionCache(employeeId);
            await tx.employeeAssignment.deleteMany({ where: { employeeId } });
            await tx.staffWorkSchedule.deleteMany({ where: { employeeId } });
            await tx.systemNotification.deleteMany({ where: { employeeId } });
            recordType = 'employee';
            recordId = deactivated.id;
            url = `/hr`;
            resultRecord = {
              id: deactivated.id,
              legalName: targetEmployee.legalName,
              mode: 'DEACTIVATED_ARCHIVED',
              status: 'TERMINATED',
            };
          } else {
            await tx.authSession.deleteMany({ where: { employeeId } });
            invalidateSessionCache(employeeId);
            await tx.systemNotification.deleteMany({ where: { employeeId } });
            await tx.employeeAssignment.deleteMany({ where: { employeeId } });
            await tx.staffWorkSchedule.deleteMany({ where: { employeeId } });
            await tx.attendanceRecord.deleteMany({ where: { employeeId } });
            await tx.leaveRequest.deleteMany({ where: { employeeId } });
            await tx.salaryChangeProposal.deleteMany({ where: { employeeId } });
            await tx.staffAdminMessage.deleteMany({ where: { employeeId } });
            await tx.recipientPaymentConfirmation.deleteMany({ where: { employeeId } });
            await tx.followupTask.deleteMany({ where: { assigneeId: employeeId } });
            const agreements = await tx.employmentAgreement.findMany({
              where: { employeeId },
              select: { id: true },
            });
            if (agreements.length > 0) {
              const agIds = agreements.map((a) => a.id);
              const comps = await tx.compensationAgreement.findMany({
                where: { employmentAgreementId: { in: agIds } },
                select: { id: true },
              });
              if (comps.length > 0) {
                await tx.costAllocation.deleteMany({
                  where: { compensationAgreementId: { in: comps.map((c) => c.id) } },
                });
                await tx.compensationAgreement.deleteMany({
                  where: { id: { in: comps.map((c) => c.id) } },
                });
              }
              await tx.employmentAgreement.deleteMany({ where: { id: { in: agIds } } });
            }
            await tx.adminInvitation.deleteMany({
              where: { workEmail: targetEmployee.workEmail.toLowerCase() },
            });
            await tx.employee.delete({ where: { id: employeeId } });

            recordType = 'employee';
            recordId = employeeId;
            url = `/hr`;
            resultRecord = {
              id: employeeId,
              legalName: targetEmployee.legalName,
              mode: 'PERMANENTLY_DELETED',
            };
          }
        } else {
          // EDIT_PROFILE
          const updateData: any = {};
          if (typeof materialPayload.legalName === 'string' && materialPayload.legalName.trim()) {
            updateData.legalName = materialPayload.legalName.trim();
          }
          if (typeof materialPayload.workEmail === 'string' && materialPayload.workEmail.trim()) {
            const cleanEmail = materialPayload.workEmail.trim().toLowerCase();
            if (cleanEmail !== targetEmployee.workEmail) {
              const dup = await tx.employee.findUnique({ where: { workEmail: cleanEmail } });
              if (dup && dup.id !== employeeId) {
                throw new Error(`Another account already uses ${cleanEmail}.`);
              }
              updateData.workEmail = cleanEmail;
            }
          }
          if (materialPayload.phone !== undefined) {
            updateData.phone = materialPayload.phone ? String(materialPayload.phone).trim() : null;
          }
          if (materialPayload.jobTitle !== undefined) {
            updateData.jobTitle = materialPayload.jobTitle ? String(materialPayload.jobTitle).trim() : null;
          }
          if (materialPayload.staffGrade !== undefined) {
            updateData.staffGrade = materialPayload.staffGrade ? String(materialPayload.staffGrade).trim() : null;
          }
          if (materialPayload.residentialAddress !== undefined) {
            updateData.residentialAddress = materialPayload.residentialAddress
              ? String(materialPayload.residentialAddress).trim()
              : null;
          }
          if (materialPayload.isAttendanceExempt !== undefined) {
            updateData.isAttendanceExempt = Boolean(materialPayload.isAttendanceExempt);
          }

          const updated = await tx.employee.update({
            where: { id: employeeId },
            data: updateData,
          });

          if (materialPayload.subsidiaryId || materialPayload.departmentId !== undefined || materialPayload.jobTitle) {
            const primaryAssignment = targetEmployee.assignments[0];
            if (primaryAssignment) {
              await tx.employeeAssignment.update({
                where: { id: primaryAssignment.id },
                data: {
                  ...(materialPayload.subsidiaryId ? { subsidiaryId: materialPayload.subsidiaryId } : {}),
                  ...(materialPayload.departmentId !== undefined
                    ? { departmentId: materialPayload.departmentId || null }
                    : {}),
                  ...(materialPayload.jobTitle ? { positionName: String(materialPayload.jobTitle).trim() } : {}),
                },
              });
            } else if (materialPayload.subsidiaryId) {
              await tx.employeeAssignment.create({
                data: {
                  employeeId,
                  subsidiaryId: materialPayload.subsidiaryId,
                  departmentId: materialPayload.departmentId || null,
                  positionName: String(materialPayload.jobTitle || updated.jobTitle || 'Staff'),
                  isPrimary: true,
                  status: 'ACTIVE',
                },
              });
            }
          }

          notificationIntentIds.push(employeeId);
          await tx.systemNotification.create({
            data: {
              employeeId,
              kind: 'PROFILE_UPDATED',
              title: 'Profile Information Updated',
              body: `Your staff profile was updated by ${actor.legalName}.`,
              linkUrl: '/',
            },
          });
          notificationsDeliveredIds.push(employeeId);
          recordType = 'employee';
          recordId = updated.id;
          url = `/hr`;
          resultRecord = {
            id: updated.id,
            employeeNumber: updated.employeeNumber,
            legalName: updated.legalName,
            workEmail: updated.workEmail,
            phone: updated.phone,
            jobTitle: updated.jobTitle,
            isAttendanceExempt: updated.isAttendanceExempt,
          };
        }
      }
    } else if (action.actionType === 'request_creation') {
      const subAction = String(materialPayload.sub_action || materialPayload.action || 'CREATE_REQUEST').toUpperCase();

      if (subAction === 'SEND_MESSAGE' || subAction === 'REQUEST_CLARIFICATION' || subAction === 'CLARIFY') {
        const reqLookup = materialPayload.requestId || materialPayload.requestNumber;
        const reqItem = await tx.expenditureRequest.findFirst({
          where: { OR: [{ id: reqLookup }, { requestNumber: reqLookup }] },
          include: { channel: true },
        });
        if (!reqItem) throw new Error(`Request "${reqLookup}" not found.`);
        resolvedSubsidiaryId = reqItem.subsidiaryId;

        let channelId = reqItem.channel?.id;
        if (!channelId) {
          const createdChan = await tx.requestChannel.create({
            data: { requestId: reqItem.id, classification: 'GENERAL' },
          });
          channelId = createdChan.id;
        }

        const messageBody = String(materialPayload.message || materialPayload.text || 'Please provide additional clarification on this request.').trim();
        const isClarify = subAction === 'REQUEST_CLARIFICATION' || subAction === 'CLARIFY';

        if (isClarify) {
          await tx.expenditureRequest.update({
            where: { id: reqItem.id },
            data: { approvalStatus: 'CLARIFICATION_REQUESTED' },
          });
        }

        const msg = await tx.channelMessage.create({
          data: {
            channelId,
            authorId: actor.id,
            authorName: actor.legalName,
            authorRole: actor.role,
            messageType: isClarify ? 'CLARIFICATION_REQUEST' : 'COMMENT',
            body: messageBody,
          },
        });

        await tx.systemNotification.create({
          data: {
            employeeId: reqItem.requestedById,
            kind: isClarify ? 'CLARIFICATION_REQUESTED' : 'REQUEST_COMMENT',
            title: isClarify ? `Clarification Requested on ${reqItem.requestNumber}` : `New Message on ${reqItem.requestNumber}`,
            body: messageBody.slice(0, 180),
            linkUrl: `/requests/${reqItem.requestNumber}`,
          },
        });

        notificationIntentIds.push(reqItem.requestedById);
        notificationsDeliveredIds.push(reqItem.requestedById);
        recordType = 'request_message';
        recordId = msg.id;
        url = `/requests/${reqItem.requestNumber}`;
        resultRecord = { id: msg.id, requestNumber: reqItem.requestNumber, message: messageBody };
      } else if (subAction === 'DELETE_REQUEST') {
        const reqLookup = materialPayload.requestId || materialPayload.requestNumber;
        const reqItem = await tx.expenditureRequest.findFirst({
          where: { OR: [{ id: reqLookup }, { requestNumber: reqLookup }] },
          include: { disbursements: true, channel: true },
        });
        if (!reqItem) throw new Error(`Request "${reqLookup}" not found.`);
        if (reqItem.disbursements.length > 0 || reqItem.paymentStatus === 'PAID') {
          throw new Error('Cannot delete a request that already has recorded disbursements.');
        }

        if (reqItem.channel) {
          await tx.channelMessage.deleteMany({ where: { channelId: reqItem.channel.id } });
          await tx.followupTask.deleteMany({ where: { channelId: reqItem.channel.id } });
          await tx.requestChannel.delete({ where: { id: reqItem.channel.id } });
        }
        await tx.approvalStep.deleteMany({ where: { requestId: reqItem.id } });
        await tx.attachment.deleteMany({ where: { requestId: reqItem.id } });
        await tx.expenditureRequest.delete({ where: { id: reqItem.id } });

        recordType = 'fund_request_deleted';
        recordId = reqItem.requestNumber;
        url = `/requests`;
        resultRecord = { requestNumber: reqItem.requestNumber, title: reqItem.title, status: 'DELETED' };
      } else {
        const title = String(materialPayload.title || '').trim();
        const justification = String(materialPayload.justification || title).trim();
        const deliverable = String(materialPayload.deliverable || 'Itemized receipt and proof of delivery.').trim();
        const category = String(materialPayload.category || 'OFFICE_EXPENSE').trim().toUpperCase();
        const currency = String(materialPayload.currency || 'NGN').trim().toUpperCase();
        const amountNaira = Number(materialPayload.amount ?? materialPayload.amountNaira ?? 0);
        const amountMinor = materialPayload.amountMinor
          ? BigInt(materialPayload.amountMinor)
          : BigInt(Math.round(amountNaira * 100));

        if (!title || amountMinor <= BigInt(0)) {
          throw new Error('Request title and positive amount are required.');
        }

        const subsidiaryOrg = materialPayload.subsidiaryId
          ? await tx.organization.findUnique({ where: { id: materialPayload.subsidiaryId } })
          : (await tx.organization.findFirst({ where: { type: 'SUBSIDIARY' } })) ||
            (await tx.organization.findFirst());
        if (!subsidiaryOrg) throw new Error('Valid subsidiary organization not found.');

        const groupId = subsidiaryOrg.parentGroupId || subsidiaryOrg.id;
        const requestNumber = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        const isRecurring = Boolean(materialPayload.isRecurring);
        const recurringInterval = isRecurring ? String(materialPayload.recurringInterval || 'MONTHLY').toUpperCase() : null;
        const neededBy = materialPayload.neededBy ? new Date(materialPayload.neededBy) : new Date(Date.now() + 7 * 86400_000);

        const createdReq = await tx.expenditureRequest.create({
          data: {
            requestNumber,
            groupId,
            subsidiaryId: subsidiaryOrg.id,
            requestedById: actor.id,
            vendorId: materialPayload.vendorId || null,
            requestType: materialPayload.requestType || 'ORDINARY',
            category,
            amountMinor,
            currency,
            title,
            justification,
            deliverable,
            neededBy,
            approvalStatus: 'IN_REVIEW',
            paymentStatus: 'UNPAID',
            accountabilityStatus: 'PENDING',
            isRecurring,
            recurringInterval,
            channel: {
              create: {
                classification: 'GENERAL',
                messages: {
                  create: {
                    authorName: actor.legalName,
                    authorRole: actor.role,
                    messageType: 'AUDIT_EVENT',
                    body: `Fund request ${requestNumber} created and submitted via BEMI (${currency} ${(Number(amountMinor) / 100).toLocaleString()}).`,
                  },
                },
              },
            },
            approvalSteps: {
              create: {
                stageIndex: 1,
                assignedRole: 'GMD',
                status: 'PENDING',
              },
            },
          },
        });

        recordType = 'fund_request';
        recordId = createdReq.requestNumber;
        url = `/requests/${createdReq.requestNumber}`;
        resultRecord = {
          id: createdReq.id,
          requestNumber: createdReq.requestNumber,
          title: createdReq.title,
          amount: Number(createdReq.amountMinor) / 100,
          currency: createdReq.currency,
          subsidiaryId: createdReq.subsidiaryId,
          isRecurring: createdReq.isRecurring,
        };
      }
    } else if (action.actionType === 'grn_creation') {
      const requestId = materialPayload.requestId || materialPayload.request_id;
      const reqRecord = await tx.expenditureRequest.findFirst({
        where: { OR: [{ id: requestId }, { requestNumber: requestId }] },
      });
      if (!reqRecord) {
        throw new Error(`Expenditure request (${requestId}) not found for GRN.`);
      }

      const grnNumber =
        materialPayload.grnNumber ||
        `GRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const status = ['ACCEPTED', 'PARTIAL', 'DAMAGED'].includes(
        String(materialPayload.status || materialPayload.deliveryStatus || '').toUpperCase()
      )
        ? String(materialPayload.status || materialPayload.deliveryStatus).toUpperCase()
        : 'ACCEPTED';

      const grn = await tx.goodsReceiptNote.create({
        data: {
          requestId: reqRecord.id,
          receivedById: actor.id,
          grnNumber,
          waybillNumber: materialPayload.waybillNumber || null,
          inspectionNotes: materialPayload.inspectionNotes || materialPayload.conditionNotes || 'Verified and staged via BEMI',
          status,
        },
      });

      recordType = 'goods_receipt_note';
      recordId = grn.id;
      url = `/vendors`;
      resultRecord = {
        ...grn,
        requestId: reqRecord.id,
      };
    } else if (action.actionType === 'vendor_invoice_creation') {
      const requestId = materialPayload.requestId || materialPayload.request_id;
      const reqRecord = await tx.expenditureRequest.findFirst({
        where: { OR: [{ id: requestId }, { requestNumber: requestId }] },
      });
      if (!reqRecord) {
        throw new Error(`Expenditure request (${requestId}) not found for Vendor Invoice.`);
      }

      const vendorId = materialPayload.vendorId || reqRecord.vendorId;
      if (!vendorId) {
        throw new Error('A vendorId is required to record a Vendor Invoice.');
      }

      const invoiceNumber =
        materialPayload.invoiceNumber ||
        `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const amountMinor = materialPayload.amountMinor
        ? BigInt(materialPayload.amountMinor)
        : materialPayload.amount
        ? BigInt(Math.round(Number(materialPayload.amount) * 100))
        : reqRecord.amountMinor;

      const invoice = await tx.vendorInvoice.create({
        data: {
          requestId: reqRecord.id,
          vendorId,
          invoiceNumber,
          invoiceDate: materialPayload.invoiceDate ? new Date(materialPayload.invoiceDate) : new Date(),
          amountMinor,
          taxMinor: BigInt(materialPayload.taxMinor || 0),
          currency: materialPayload.currency || reqRecord.currency || 'NGN',
          status: 'PENDING',
        },
      });

      recordType = 'vendor_invoice';
      recordId = invoice.id;
      url = `/vendors`;
      resultRecord = {
        ...invoice,
        requestId: reqRecord.id,
        amountMinor: invoice.amountMinor.toString(),
        taxMinor: invoice.taxMinor.toString(),
      };
    } else if (action.actionType === 'leave_action') {
      const subAction = String(materialPayload.sub_action || materialPayload.action || 'APPROVE_LEAVE').toUpperCase();

      if (subAction === 'CREATE_LEAVE') {
        const employeeId = materialPayload.employeeId || actor.id;
        const startDate = String(materialPayload.startDate || '').trim();
        const endDate = String(materialPayload.endDate || '').trim();
        if (!startDate || !endDate) {
          throw new Error('Valid startDate and endDate strings are required for leave requests.');
        }
        const leave = await tx.leaveRequest.create({
          data: {
            employeeId,
            leaveType: materialPayload.leaveType || 'ANNUAL',
            startDate,
            endDate,
            reason: String(materialPayload.reason || 'Staged via BEMI'),
            handoverNotes: materialPayload.handoverNotes || materialPayload.reliefOfficerName || null,
            status: 'PENDING',
          },
        });
        recordType = 'leave_request';
        recordId = leave.id;
        url = `/hr`;
        resultRecord = leave;
      } else {
        const leaveId = materialPayload.leaveId || materialPayload.id;
        if (!leaveId) throw new Error('leaveId is required to approve or reject a leave request.');
        const decision = subAction.includes('REJECT') || materialPayload.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
        const updated = await tx.leaveRequest.update({
          where: { id: leaveId },
          data: {
            status: decision,
            reviewedById: actor.id,
            reviewedByName: actor.legalName,
            reviewNote:
              decision === 'REJECTED'
                ? materialPayload.rejectionReason || 'Declined by executive'
                : 'Approved by executive',
            reviewedAt: new Date(),
          },
        });
        if (decision === 'APPROVED') {
          await tx.employee.update({
            where: { id: updated.employeeId },
            data: { status: 'ON_LEAVE' },
          });
        }
        await tx.systemNotification.create({
          data: {
            employeeId: updated.employeeId,
            kind: 'ALERT',
            title: `Leave Request ${decision === 'APPROVED' ? 'Approved' : 'Declined'}`,
            body: `Your ${updated.leaveType.replace(/_/g, ' ')} leave request (${updated.startDate} to ${updated.endDate}) was ${decision.toLowerCase()} by ${actor.legalName}.`,
            linkUrl: '/',
          },
        });
        notificationIntentIds.push(updated.employeeId);
        notificationsDeliveredIds.push(updated.employeeId);
        recordType = 'leave_request';
        recordId = updated.id;
        url = `/hr`;
        resultRecord = updated;
      }
    } else if (action.actionType === 'task_action') {
      const subAction = String(materialPayload.sub_action || materialPayload.action || 'CREATE_TASK').toUpperCase();

      if (subAction === 'COMPLETE_TASK' || subAction === 'REOPEN_TASK') {
        const taskId = materialPayload.taskId || materialPayload.id;
        if (!taskId) throw new Error('taskId is required to update a follow-up task.');
        const nextStatus = subAction === 'REOPEN_TASK' ? 'PENDING' : 'COMPLETED';
        const updated = await tx.followupTask.update({
          where: { id: taskId },
          data: {
            status: nextStatus,
            completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
            responseNotes: materialPayload.responseNotes || null,
          },
        });
        recordType = 'followup_task';
        recordId = updated.id;
        url = `/tasks`;
        resultRecord = updated;
      } else {
        const description = String(materialPayload.description || '').trim();
        const assigneeId = materialPayload.assigneeId;
        if (!description || !assigneeId) {
          throw new Error('description and assigneeId are required to create a follow-up task.');
        }
        const dueAt = materialPayload.dueAt ? new Date(materialPayload.dueAt) : new Date(Date.now() + 3 * 86400_000);
        let accountabilityCaseId = materialPayload.accountabilityCaseId || null;
        let channelId = materialPayload.channelId || null;

        if (!accountabilityCaseId && !channelId && materialPayload.requestId) {
          const reqItem = await tx.expenditureRequest.findFirst({
            where: { OR: [{ id: materialPayload.requestId }, { requestNumber: materialPayload.requestId }] },
            include: { channel: true, accountabilityCase: true },
          });
          if (reqItem?.channel) channelId = reqItem.channel.id;
          if (reqItem?.accountabilityCase) accountabilityCaseId = reqItem.accountabilityCase.id;
          if (reqItem?.subsidiaryId) resolvedSubsidiaryId = reqItem.subsidiaryId;
        }

        if (!accountabilityCaseId && !channelId) {
          const fallbackChannel = await tx.requestChannel.findFirst();
          if (fallbackChannel) channelId = fallbackChannel.id;
        }

        const created = await tx.followupTask.create({
          data: {
            accountabilityCaseId,
            channelId,
            assigneeId,
            description,
            dueAt,
          },
        });

        await tx.systemNotification.create({
          data: {
            employeeId: assigneeId,
            kind: 'FOLLOWUP_TASK_ASSIGNED',
            title: 'A follow-up task was assigned to you',
            body: description,
            linkUrl: '/',
          },
        });

        notificationIntentIds.push(assigneeId);
        notificationsDeliveredIds.push(assigneeId);
        recordType = 'followup_task';
        recordId = created.id;
        url = `/tasks`;
        resultRecord = created;
      }
    } else if (action.actionType === 'staff_message') {
      const targetEmployeeId = materialPayload.employeeId || materialPayload.employee_id;
      const messageText = String(materialPayload.message || '').trim();
      const targetChannel = String(materialPayload.channel || (actor.role === 'GMD' ? 'GMD' : 'HR')).toUpperCase();
      if (!targetEmployeeId || !messageText) {
        throw new Error('employeeId and message are required to send a staff helpdesk message.');
      }

      const employee = await tx.employee.findUnique({
        where: { id: targetEmployeeId },
        include: { assignments: { where: { isPrimary: true }, take: 1 } },
      });
      if (!employee) throw new Error('Target staff member not found.');
      resolvedSubsidiaryId = employee.assignments[0]?.subsidiaryId || resolvedSubsidiaryId;

      const newMessage = await tx.staffAdminMessage.create({
        data: {
          employeeId: targetEmployeeId,
          channel: targetChannel,
          senderRole: actor.role === 'GMD' ? 'GMD' : 'SYSTEM_ADMIN',
          senderId: actor.id,
          senderName: actor.legalName,
          message: messageText,
          isReadByStaff: false,
          isReadByAdmin: true,
        },
      });

      const channelLabel = targetChannel === 'GMD' ? 'Executive Desk (GMD)' : 'HR Operations Desk';
      await tx.systemNotification.create({
        data: {
          employeeId: targetEmployeeId,
          kind: 'CHAT',
          title: `New message from ${actor.legalName} (${channelLabel})`,
          body: messageText.length > 100 ? `${messageText.slice(0, 100)}...` : messageText,
          linkUrl: `/helpdesk?channel=${targetChannel}`,
        },
      });

      if (employee.workEmail && !employee.workEmail.endsWith('@bems.internal')) {
        sendChatMessageEmail({
          to: employee.workEmail,
          recipientName: employee.legalName,
          senderName: actor.legalName,
          senderRole: actor.role,
          messageText,
          attachmentName: null,
          contextTitle: `BEMS ${channelLabel}`,
          actionUrl: `https://bemserp.work/helpdesk?channel=${targetChannel}`,
        }).catch(() => {});
      }

      notificationIntentIds.push(targetEmployeeId);
      notificationsDeliveredIds.push(targetEmployeeId);
      recordType = 'staff_admin_message';
      recordId = newMessage.id;
      url = `/helpdesk`;
      resultRecord = newMessage;
    } else if (action.actionType === 'policy_update') {
      const subAction = String(materialPayload.sub_action || materialPayload.action || 'UPDATE_APPROVAL_POLICY').toUpperCase();

      if (subAction === 'UPDATE_WORKSPACE_SETTINGS' || subAction === 'UPDATE_SETTINGS') {
        const organizationId = materialPayload.organizationId;
        const key = String(materialPayload.key || '');
        const value = materialPayload.value;
        if (!organizationId || !key || !value) {
          throw new Error('organizationId, key, and value are required to update workspace settings.');
        }
        resolvedSubsidiaryId = organizationId;
        const json = typeof value === 'string' ? value : JSON.stringify(value);
        const saved = await tx.workspaceSetting.upsert({
          where: { organizationId_key: { organizationId, key } },
          create: { organizationId, key, value: json, updatedById: actor.id },
          update: { value: json, updatedById: actor.id },
        });
        recordType = 'workspace_setting';
        recordId = saved.id;
        url = `/settings`;
        resultRecord = saved;
      } else {
        const minAmountMinor = BigInt(Math.round((Number(materialPayload.minAmount) || 0) * 100));
        const maxAmountMinor =
          materialPayload.maxAmount !== null && materialPayload.maxAmount !== undefined
            ? BigInt(Math.round(Number(materialPayload.maxAmount) * 100))
            : null;
        resolvedSubsidiaryId = materialPayload.scopeSubsidiaryId || resolvedSubsidiaryId;
        const data = {
          scopeSubsidiaryId: materialPayload.scopeSubsidiaryId || null,
          category: materialPayload.category || null,
          minAmountMinor,
          maxAmountMinor,
          requiredRole: materialPayload.requiredRole || 'GMD',
          priority: Number(materialPayload.priority) || 1,
          active: materialPayload.active !== undefined ? Boolean(materialPayload.active) : true,
        };

        const saved = materialPayload.id
          ? await tx.approvalPolicy.update({ where: { id: materialPayload.id }, data })
          : await tx.approvalPolicy.create({ data });

        recordType = 'approval_policy';
        recordId = saved.id;
        url = `/policies`;
        resultRecord = {
          ...saved,
          minAmountMinor: saved.minAmountMinor.toString(),
          maxAmountMinor: saved.maxAmountMinor ? saved.maxAmountMinor.toString() : null,
        };
      }
    } else {
      throw new Error(`Unsupported action type: ${action.actionType}`);
    }

    // Resolve actual Group & Subsidiary scope for AuditEvent
    const groupOrg = await tx.organization.findFirst({
      where: { OR: [{ type: 'GROUP' }, { code: 'BEMS-GROUP' }, { code: 'BEMS-HQ' }] },
      select: { id: true },
    });
    const resolvedGroupId = groupOrg?.id || resolvedSubsidiaryId || 'BEMS-GROUP';
    const deliveryStatus: 'DELIVERED' | 'QUEUED' | 'NOT_APPLICABLE' =
      notificationsDeliveredIds.length > 0
        ? 'DELIVERED'
        : notificationIntentIds.length > 0
        ? 'QUEUED'
        : 'NOT_APPLICABLE';

    // Create Audit Event scoped to actual target entity & subsidiary
    await tx.auditEvent.create({
      data: {
        id: auditEventId,
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: resolvedGroupId,
        subsidiaryId: resolvedSubsidiaryId,
        targetType: recordType.toUpperCase(),
        targetId: recordId,
        action: `AI_STAGED_${action.actionType.toUpperCase()}_EXECUTED`,
        correlationId: effectiveIdempotencyKey,
        metadata: JSON.stringify({
          stagedActionId: actionId,
          correlationId: effectiveIdempotencyKey,
          summary: action.summary,
          subsidiaryId: resolvedSubsidiaryId,
          notification_intent: notificationIntentIds,
          notifications_sent: notificationsDeliveredIds,
          notification_delivery_status: deliveryStatus,
        }),
      },
    });

    // Persist committed execution result onto the claimed StagedAction
    await tx.stagedAction.update({
      where: { id: actionId },
      data: {
        status: 'EXECUTED',
        executedAt: txNow,
        idempotencyKey: effectiveIdempotencyKey,
        auditEventId,
        resultJson: JSON.stringify({
          record_type: recordType,
          record_id: recordId,
          url,
          record: resultRecord,
          subsidiary_id: resolvedSubsidiaryId,
          notification_intent: notificationIntentIds,
          notifications_sent: notificationsDeliveredIds,
          notification_delivery_status: deliveryStatus,
          audit_event_id: auditEventId,
        }),
      },
    });
    });
  } catch (err: any) {
    if (err instanceof StaleTargetError) {
      // Mark the stale proposal as EXPIRED so a fresh preview must be requested
      await prisma.stagedAction.updateMany({
        where: { id: actionId, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      }).catch(() => {});
      return {
        ok: false,
        errorCode: 'TARGET_CHANGED',
        status: 'EXPIRED',
        message: err.message,
      };
    }
    if (err instanceof StagedStateConflictError) {
      return {
        ok: false,
        errorCode: err.errorCode,
        status:
          err.errorCode === 'ALREADY_EXECUTED'
            ? 'EXECUTED'
            : err.errorCode === 'CANCELLED'
            ? 'CANCELLED'
            : 'EXPIRED',
        message: err.message,
      };
    }
    if (err instanceof StagedValidationError || err instanceof StagedPermissionError) {
      return {
        ok: false,
        errorCode: err.errorCode,
        message: err.message,
      };
    }
    return {
      ok: false,
      errorCode: 'EXECUTION_FAILED',
      message: err?.message || 'Failed to execute staged action.',
    };
  }

  if (
    (action.actionType === 'grn_creation' || action.actionType === 'vendor_invoice_creation') &&
    resultRecord?.requestId
  ) {
    try {
      const matchReport = await executeThreeWayMatch({
        requestId: resultRecord.requestId,
        ...(action.actionType === 'grn_creation' ? { grnId: resultRecord.id } : { invoiceId: resultRecord.id }),
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
      });
      resultRecord.threeWayMatch = matchReport;
    } catch {
      // Non-fatal if counter-documents aren't uploaded yet
    }
  }

  const finalDeliveryStatus: 'DELIVERED' | 'QUEUED' | 'NOT_APPLICABLE' =
    notificationsDeliveredIds.length > 0
      ? 'DELIVERED'
      : notificationIntentIds.length > 0
      ? 'QUEUED'
      : 'NOT_APPLICABLE';

  return {
    ok: true,
    status: 'EXECUTED',
    record_type: recordType,
    record_id: recordId,
    url,
    record: resultRecord,
    notification_intent: notificationIntentIds,
    notifications_sent: notificationsDeliveredIds,
    notification_delivery_status: finalDeliveryStatus,
    audit_event_id: auditEventId,
  };
}
