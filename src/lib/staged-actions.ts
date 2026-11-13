import { assertGroupIdentityUpdate } from '@/lib/organization-identity';
import {walletRequestFunding} from '@/lib/wallet/accountability';
import {createFundedEnvelopeTx} from '@/lib/wallet/core';
import {adjustFundedEnvelopeTx} from '@/lib/wallet/operations';
import { walletEnabled, WalletError } from '@/lib/wallet/core';
import { payrollSnapshotHash } from './services/payroll-snapshot';
import { accountabilityDeadline } from './services/accountability-deadline';
import { applyGovernanceTemplate } from './services/governance-template';
import { createReportSnapshot } from './services/report-export';
import { queueDelivery, processDeliveryOutbox } from './services/delivery-outbox';
import { normalizeAiAccessMatrix } from '@/lib/ai-access-control';
import type { Prisma } from '@prisma/client';
import { activateMobileArtifact } from './services/mobile-release';
import { captureCommandTargets, assertCommandTargetsUnchanged } from './platform/command-targets';
import { redactUntrustedAndSensitiveFields, stripAuthenticationSecrets } from './platform/read-catalog';
import { recordTransfer } from './services/payment';
import crypto from 'node:crypto';
import type { AuthenticatedAiActor } from './ai-tools-auth';
import { normalizeCanonicalRole } from './platform/actor-scope';
import { prisma } from './prisma';
import { sendAdminInvitationEmail, sendChatMessageEmail, sendApprovalDecisionEmail } from './email';
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
import { assertSingleActiveGmd, verifyTargetEmployeeAccess, approveEmployeeOnboarding, rejectEmployeeOnboarding, transitionEmployeeStatus } from './employee-lifecycle';
import { invalidateSessionCache, getHrAuthorizationScope, verifyPassword } from './auth';
import {
  applyCanonicalCompensationChange,
  CompensationChangeType,
} from './services/compensation';
import { getCommandDescriptor } from './platform/command-catalog';
import { verifyStagedAttachments } from './platform/staged-attachments';

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
  | 'policy_update'
  | 'notification_read';

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
  'notification_read',
]);

export function validateStageActionProposal(
  actionType: string,
  materialPayload: Record<string, any>,
  summary: string
): asserts actionType is StagedActionType {
  if (!SUPPORTED_STAGED_ACTION_TYPES.has(actionType as StagedActionType)) {
    throw new Error(`Unsupported staged action type: "${actionType}". Proposal rejected before card generation.`);
  }
  const descriptor = getCommandDescriptor(actionType as StagedActionType);
  if (!descriptor) {
    throw new Error(`Command "${actionType}" is not registered in COMMAND_CATALOG.`);
  }
  if (!summary || !String(summary).trim()) {
    throw new Error('A human-readable summary is required to stage an action.');
  }
  if (!materialPayload || typeof materialPayload !== 'object' || Array.isArray(materialPayload)) {
    throw new Error('materialPayload must be a non-empty object.');
  }

  const catalogValidation = descriptor.validateInput(materialPayload);
  if (!catalogValidation.valid) {
    throw new Error(catalogValidation.errorMessage || `Missing required fields: ${catalogValidation.missingFields.join(', ')}`);
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
  actorContext?: Partial<AuthenticatedAiActor>;
  userId?: string;
  actorId?: string;
  actionType: StagedActionType;
  materialPayload: Record<string, any>;
  summary: string;
  preview?: Record<string, any>;
  clientPreview?: Record<string, any>;
  targetEmployeeId?: string;
  targetSubsidiaryId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  targetVersion?: string | number;
  conversationId?: string;
  attachmentIds?: string[];
  eligibleApproverRoles?: string;
  warnings?: string[];
  blockingErrors?: string[];
}

export async function stageAction(input: StageActionInput) {
  const resolvedUserId = input.userId || input.actorId;
  if (!resolvedUserId) {
    throw new Error('userId is required to stage an action.');
  }

  validateStageActionProposal(input.actionType, input.materialPayload, input.summary);
  const descriptor = getCommandDescriptor(input.actionType);
  const principal = input.actorContext;
  const requiredCommandScope = resolveScopeFromStagePayload(input.actionType, input.materialPayload);
  if (principal?.delegation) {
    const delegation = principal.delegation;
    if (delegation.requesterId !== resolvedUserId || delegation.operationMode !== 'READ_AND_STAGE' ||
        (delegation.allowedScopes !== 'ALL' && !delegation.allowedScopes.includes(requiredCommandScope))) {
      throw new StagedPermissionError('Delegation cannot stage this operation.');
    }
  }

  const resolvedSubsidiaryId =
    input.targetSubsidiaryId ||
    input.materialPayload.subsidiaryId ||
    input.materialPayload.organization_id ||
    input.materialPayload.organizationId ||
    input.materialPayload.subsidiary_id ||
    principal?.delegation?.scopedOrganizationId ||
    undefined;

  // Enforce Admin AI Write Access Control Matrix for the specific capability scope
  const requiredScope = resolveScopeFromStagePayload(input.actionType, input.materialPayload);
  await assertAiScopeAllowed(requiredScope, 'write', resolvedSubsidiaryId);

  const creator = await prisma.employee.findUnique({
    where: { id: resolvedUserId },
    select: { id: true, role: true, status: true, approvalStatus: true, legalName: true },
  });
  if (!creator || creator.status !== 'ACTIVE' || creator.approvalStatus !== 'APPROVED') {
    throw new Error('Active authenticated employee required to stage actions.');
  }

  const callerRole = normalizeCanonicalRole(creator.role);
  if (!callerRole || !descriptor || !descriptor.allowedCallerRoles.includes(callerRole)) {
    throw new StagedPermissionError('Your role cannot propose this operation.');
  }
  if (principal?.delegation?.scopedOrganizationId) {
    const delegatedEntity = await prisma.organization.findUnique({ where: { id: principal.delegation.scopedOrganizationId }, select: { type: true } });
    const policySubAction = String(input.materialPayload.sub_action || input.materialPayload.action || '').toUpperCase();
    const globalOperation = ['role_change', 'subsidiary_creation', 'admin_onboarding'].includes(input.actionType) || (input.actionType === 'policy_update' && ['UPDATE_MOBILE_GATE', 'MOBILE_GATE', 'ACTIVATE_MOBILE_APK', 'UPLOAD_APK'].includes(policySubAction));
    if (delegatedEntity?.type !== 'GROUP' && (input.materialPayload.scope === 'GROUP' || input.materialPayload.is_group_scope === true || globalOperation)) throw new StagedPermissionError('This operation requires the authorized group workspace.');
    const scope = await resolveAuthorizedOrganizationScope({ ...creator, delegation: principal.delegation } as any, resolvedSubsidiaryId || principal.delegation.scopedOrganizationId);
    if (scope.organizationIds.length === 0 || (resolvedSubsidiaryId && !scope.organizationIds.includes(resolvedSubsidiaryId))) {
      throw new StagedPermissionError('Target is outside the delegated workspace.');
    }
  }

  const rawAttachmentIds =
    input.attachmentIds ||
    (Array.isArray(input.materialPayload.attachment_ids) ? input.materialPayload.attachment_ids : undefined) ||
    (Array.isArray(input.materialPayload.attachmentIds) ? input.materialPayload.attachmentIds : undefined) ||
    [];
  const canonicalCreatorRole = normalizeThreeRole(creator.role);
  const attachmentCheck = await verifyStagedAttachments({
    attachmentIds: rawAttachmentIds,
    actorId: creator.id,
    isExecutive: canonicalCreatorRole === 'GMD' || canonicalCreatorRole === 'SUPER_ADMIN',
  });
  if (!attachmentCheck.valid) {
    throw new Error(attachmentCheck.errorMessage || 'Invalid staged attachment reference.');
  }
  const verifiedAttachments = attachmentCheck.attachments;

  const resolvedTargetEntityType = input.targetEntityType || descriptor?.targetEntityType || input.actionType;
  const resolvedTargetEntityId =
    input.targetEntityId ||
    input.targetEmployeeId ||
    input.materialPayload.request_id ||
    input.materialPayload.employee_id ||
    input.materialPayload.employeeId ||
    input.materialPayload.budget_id ||
    input.materialPayload.account_id ||
    input.materialPayload.vendor_id ||
    input.materialPayload.case_id ||
    null;
  const resolvedExpectedVersion =
    input.targetVersion !== undefined
      ? String(input.targetVersion)
      : input.materialPayload.expected_version !== undefined
      ? String(input.materialPayload.expected_version)
      : null;
  const resolvedEligibleApprovers =
    input.eligibleApproverRoles ||
    (descriptor?.allowedApproverRoles ? descriptor.allowedApproverRoles.join(',') : 'GMD,SUPER_ADMIN');
  const resolvedConversationId =
    principal?.conversationId || input.conversationId ||
    (typeof input.materialPayload.conversation_id === 'string' ? input.materialPayload.conversation_id : null) ||
    `conv_${creator.id}`;

  // Persist targetSubsidiaryId & targetEmployeeId in canonical materialPayload if provided
  const canonicalPayload: Record<string, any> = {
    ...input.materialPayload,
    ...(principal?.delegation ? { _delegated_organization_id: principal.delegation.scopedOrganizationId, _delegated_scope: requiredCommandScope } : {}),
    ...(resolvedSubsidiaryId && !input.materialPayload.subsidiaryId && !input.materialPayload.organization_id
      ? { subsidiaryId: resolvedSubsidiaryId }
      : {}),
    ...(input.targetEmployeeId && !input.materialPayload.employee_id && !input.materialPayload.employeeId
      ? { employee_id: input.targetEmployeeId }
      : {}),
    ...(input.targetVersion !== undefined ? { expected_version: input.targetVersion } : {}),
    ...(verifiedAttachments.length > 0 ? { attachment_ids: verifiedAttachments.map((a) => a.id) } : {}),
  };

  if (input.blockingErrors?.length) throw new StagedValidationError('PROPOSAL_BLOCKED', input.blockingErrors.join('; '));
  if (input.actionType === 'staff_management' && canonicalPayload.sub_action === 'DELETE_OR_DEACTIVATE') input.warnings = [...(input.warnings || []), 'This operation ends account access and retains business and employment history. It does not erase the employee record.'];
  canonicalPayload._target_snapshots = await captureCommandTargets(prisma, canonicalPayload, input.actionType);
  const basePreview = input.preview || input.clientPreview || {};
  const resolvedPreview: Record<string, any> = {
    ...basePreview,
    execution: redactUntrustedAndSensitiveFields(Object.fromEntries(Object.entries(canonicalPayload).filter(([key]) => !key.startsWith('_')))),
    resolved_targets: canonicalPayload._target_snapshots.map((target: any) => ({ model: target.model, id: target.id, before: target.preview })),
    command_version: descriptor?.commandVersion || 1,
    target_entity_type: resolvedTargetEntityType,
    target_entity_id: resolvedTargetEntityId,
    expected_version: resolvedExpectedVersion,
    eligible_approver_roles: resolvedEligibleApprovers,
    ...(verifiedAttachments.length > 0 ? { attachments: verifiedAttachments } : {}),
  };
  const hash = computeConfirmationHash(canonicalPayload);
  const actionId = `sa_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const expiresAt = new Date(Date.now() + STAGED_ACTION_TTL_MINUTES * 60 * 1000);

  const staged = await prisma.stagedAction.create({
    data: {
      id: actionId,
      userId: resolvedUserId,
      actionType: input.actionType,
      commandVersion: descriptor?.commandVersion || 1,
      conversationId: resolvedConversationId,
      targetSubsidiaryId: resolvedSubsidiaryId ? String(resolvedSubsidiaryId) : null,
      targetEntityType: resolvedTargetEntityType,
      targetEntityId: resolvedTargetEntityId ? String(resolvedTargetEntityId) : null,
      expectedVersion: resolvedExpectedVersion,
      eligibleApproverRoles: resolvedEligibleApprovers,
      attachmentIds: verifiedAttachments.length > 0 ? JSON.stringify(verifiedAttachments.map((a) => a.id)) : null,
      sideEffectStatus: 'PENDING',
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
    command_version: staged.commandVersion,
    conversation_id: staged.conversationId,
    target_subsidiary_id: staged.targetSubsidiaryId,
    target_entity_type: staged.targetEntityType,
    target_entity_id: staged.targetEntityId,
    expected_version: staged.expectedVersion,
    eligible_approver_roles: staged.eligibleApproverRoles,
    attachment_ids: verifiedAttachments.map((a) => a.id),
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
      command_version: staged.commandVersion,
      conversation_id: staged.conversationId,
      target_subsidiary_id: staged.targetSubsidiaryId,
      target_entity_type: staged.targetEntityType,
      target_entity_id: staged.targetEntityId,
      expected_version: staged.expectedVersion,
      eligible_approver_roles: staged.eligibleApproverRoles,
      attachment_ids: verifiedAttachments.map((a) => a.id),
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
  password?: string;
}): Promise<ConfirmResult> {
  const { actionId, confirmationHash, actor, idempotencyKey, password } = params;

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

  const currentDescriptor = getCommandDescriptor(action.actionType as StagedActionType);
  if (!currentDescriptor || currentDescriptor.commandVersion !== action.commandVersion || (action.blockingErrors && JSON.parse(action.blockingErrors).length)) {
    return { ok: false, errorCode: 'STALE_TARGET', message: 'This proposal requires a fresh preview before approval.' };
  }

  // 1b. Strict 3-Role Executive Authority Check (GMD or Super Admin required to execute staged actions)
  const actorRoleUpper = (actor.role || '').toUpperCase();
  const canonicalActorRole = normalizeThreeRole(actorRoleUpper);
  const isExecutiveActor = canonicalActorRole === 'GMD' || canonicalActorRole === 'SUPER_ADMIN';
  if (!isExecutiveActor) {
    return {
      ok: false,
      errorCode: 'NOT_PERMITTED',
      message: 'Executive authority (GMD or Super Admin) is required to confirm and execute staged actions.',
    };
  }

  if (action.eligibleApproverRoles) {
    const allowedRoles = action.eligibleApproverRoles
      .split(',')
      .map((r) => normalizeThreeRole(r))
      .filter(Boolean);
    if (allowedRoles.length > 0 && canonicalActorRole && !allowedRoles.includes(canonicalActorRole) && canonicalActorRole !== 'GMD') {
      return {
        ok: false,
        errorCode: 'NOT_PERMITTED',
        message: `Role ${canonicalActorRole} is not in eligible approvers (${action.eligibleApproverRoles}) for this action.`,
      };
    }
  }

  // 2. Ownership check (allow either the staging user or the GMD to confirm)
  if (action.userId !== actor.id && actorRoleUpper !== 'GMD') {
    return {
      ok: false,
      errorCode: 'NOT_PERMITTED',
      message: 'This staged action belongs to a different executive and cannot be confirmed.',
    };
  }

  // 2b. Verify any staged attachments before execution
  if (action.attachmentIds) {
    try {
      const parsedIds = JSON.parse(action.attachmentIds);
      if (Array.isArray(parsedIds) && parsedIds.length > 0) {
        const attRes = await verifyStagedAttachments({
          attachmentIds: parsedIds,
          actorId: actor.id,
          isExecutive: isExecutiveActor,
        });
        if (!attRes.valid) {
          return {
            ok: false,
            errorCode: 'ATTACHMENT_VERIFICATION_FAILED',
            message: attRes.errorMessage || 'Staged attachment verification failed.',
          };
        }
      }
    } catch (attErr: any) {
      return {
        ok: false,
        errorCode: 'ATTACHMENT_VERIFICATION_FAILED',
        message: attErr.message || 'Staged attachment verification failed.',
      };
    }
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
        liveActor.status !== 'ACTIVE' || liveActor.approvalStatus !== 'APPROVED' ||
        normalizeCanonicalRole(liveActor.role) !== canonicalActorRole ||
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

      try { await assertCommandTargetsUnchanged(tx, materialPayload._target_snapshots || []); } catch (error) { throw new StaleTargetError(error instanceof Error ? error.message : 'Proposal target changed.'); }

      const committed = await executeBusinessCommand(tx, { action, actor, materialPayload, actionId, effectiveIdempotencyKey, auditEventId, source: 'AI_STAGED', confirmationPassword: password });
      resultRecord = committed.resultRecord; recordType = committed.recordType; recordId = committed.recordId;
      url = committed.url; resolvedSubsidiaryId = committed.resolvedSubsidiaryId;
      notificationIntentIds.push(...committed.notificationIntentIds);
      notificationsDeliveredIds.push(...committed.notificationsDeliveredIds);
      const deliveryStatus = committed.deliveryStatus;

    // Persist committed execution result onto the claimed StagedAction
    const sideEffectState =
      deliveryStatus === 'DELIVERED'
        ? 'DELIVERED'
        : deliveryStatus === 'QUEUED'
        ? 'PENDING_RETRY'
        : 'NOT_APPLICABLE';

    await tx.stagedAction.update({
      where: { id: actionId },
      data: {
        status: 'EXECUTED',
        executedAt: txNow,
        idempotencyKey: effectiveIdempotencyKey,
        auditEventId,
        sideEffectStatus: sideEffectState,
        sideEffectLogJson: JSON.stringify({
          notification_intent: notificationIntentIds,
          notifications_sent: notificationsDeliveredIds,
          delivery_status: deliveryStatus,
          updated_at: txNow.toISOString(),
        }),
        resultJson: JSON.stringify({
          record_type: recordType,
          record_id: recordId,
          url,
          record: resultRecord,
          subsidiary_id: resolvedSubsidiaryId,
          notification_intent: notificationIntentIds,
          notifications_sent: notificationsDeliveredIds,
          notification_delivery_status: deliveryStatus,
          side_effect_status: sideEffectState,
          audit_event_id: auditEventId,
        }),
      },
    });
    }, { timeout: 20000, isolationLevel: 'Serializable' });
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

  try {
    await processDeliveryOutbox(actionId);
  } catch (outboxErr) {
    console.warn('[StagedAction] Delivery outbox post-commit processing deferred:', outboxErr);
  }

  if (resultRecord?.nextPeriod?.year && resultRecord?.nextPeriod?.month) {
    await executeDashboardCommand(actor, 'payroll_action', {
      sub_action: 'PREPARE',
      year: resultRecord.nextPeriod.year,
      month: resultRecord.nextPeriod.month,
    }).catch(() => {});
  }

  const queuedEffects = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM "DeliveryOutbox" WHERE "commandId" = ${actionId} AND "status" <> 'SENT'`;
  const finalDeliveryStatus: 'DELIVERED' | 'QUEUED' | 'NOT_APPLICABLE' =
    Number(queuedEffects[0]?.count || 0) > 0 ? 'QUEUED' : notificationsDeliveredIds.length > 0
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

/**
 * Retries failed or queued notification/integration side-effects for an already EXECUTED
 * staged action without repeating the underlying business database mutation (Audit Item 05 Pillar 5).
 */
export async function retryStagedActionSideEffects(params: {
  actionId: string;
  actor: { id: string; legalName: string; role: string };
}) {
  const { actionId, actor } = params;
  const canonicalRole = normalizeThreeRole(actor.role);
  if (!canonicalRole || (canonicalRole !== 'GMD' && canonicalRole !== 'SUPER_ADMIN')) {
    return {
      ok: false,
      errorCode: 'NOT_PERMITTED',
      message: 'Executive authority is required to retry staged action side-effects.',
    };
  }

  const action = await prisma.stagedAction.findUnique({ where: { id: actionId } });
  if (!action) {
    return {
      ok: false,
      errorCode: 'NOT_FOUND',
      message: `Staged action ${actionId} not found.`,
    };
  }

  if (action.status !== 'EXECUTED') {
    return {
      ok: false,
      errorCode: 'INVALID_STATE',
      message: `Only EXECUTED staged actions can retry side-effects (current status: ${action.status}).`,
    };
  }

  let parsedResult: Record<string, any> = {};
  try {
    parsedResult = action.resultJson ? JSON.parse(action.resultJson) : {};
  } catch {}

  const intentIds: string[] = Array.isArray(parsedResult.notification_intent) ? parsedResult.notification_intent : [];
  const alreadySentIds = new Set<string>(
    Array.isArray(parsedResult.notifications_sent) ? parsedResult.notifications_sent : []
  );

  const newlySentIds: string[] = [];
  for (const recipientId of intentIds) {
    if (!alreadySentIds.has(recipientId)) {
      await prisma.systemNotification.create({
        data: {
          employeeId: recipientId,
          kind: 'STAGED_ACTION_FOLLOWUP',
          title: `Action Executed: ${action.summary}`,
          body: `Executive action "${action.summary}" was completed by ${actor.legalName}.`,
          linkUrl: parsedResult.url || '/dashboard',
        },
      });
      alreadySentIds.add(recipientId);
      newlySentIds.push(recipientId);
    }
  }

  const updatedSent = Array.from(alreadySentIds);
  await processDeliveryOutbox(actionId);
  const pending = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM "DeliveryOutbox" WHERE "commandId" = ${actionId} AND "status" <> 'SENT'`;
  const newDeliveryStatus = Number(pending[0]?.count || 0) > 0 ? 'QUEUED' : updatedSent.length === intentIds.length && updatedSent.length > 0 ? 'DELIVERED' : intentIds.length > 0 ? 'QUEUED' : 'NOT_APPLICABLE';
  const newSideEffectStatus = newDeliveryStatus === 'DELIVERED' ? 'DELIVERED' : newDeliveryStatus === 'QUEUED' ? 'PENDING_RETRY' : 'NOT_APPLICABLE';

  const updatedResult = {
    ...parsedResult,
    notifications_sent: updatedSent,
    notification_delivery_status: newDeliveryStatus,
    side_effect_status: newSideEffectStatus,
  };

  await prisma.stagedAction.update({
    where: { id: actionId },
    data: {
      sideEffectStatus: newSideEffectStatus,
      sideEffectLogJson: JSON.stringify({
        notification_intent: intentIds,
        notifications_sent: updatedSent,
        retried_by: actor.id,
        retried_at: new Date().toISOString(),
        newly_dispatched: newlySentIds,
      }),
      resultJson: JSON.stringify(updatedResult),
    },
  });

  return {
    ok: true,
    staged_action_id: actionId,
    side_effect_status: newSideEffectStatus,
    notification_delivery_status: newDeliveryStatus,
    newly_dispatched: newlySentIds,
    notifications_sent: updatedSent,
  };
}


export async function executeBusinessCommand(tx: Prisma.TransactionClient, input: {
  action: { actionType: string; summary: string; userId: string };
  actor: { id: string; legalName: string; role: string; employeeNumber?: string };
  materialPayload: Record<string, any>;
  actionId: string;
  effectiveIdempotencyKey: string;
  auditEventId: string;
  source: 'AI_STAGED' | 'DASHBOARD';
  confirmationPassword?: string;
}) {
  const { action, actor, materialPayload, actionId, effectiveIdempotencyKey, auditEventId, source, confirmationPassword } = input;
  let resultRecord: any = null;
  let recordType: string = action.actionType;
  let recordId = '';
  let url = '';
  let resolvedSubsidiaryId: string | null = materialPayload.subsidiaryId || materialPayload.organization_id || materialPayload.organizationId || null;
  const notificationIntentIds: string[] = [];
  const notificationsDeliveredIds: string[] = [];
      if (action.actionType === 'notification_read') {
        const updated = await tx.systemNotification.updateMany({ where: { employeeId: action.userId, readAt: null, ...(Array.isArray(materialPayload.notificationIds) && materialPayload.notificationIds.length ? { id: { in: materialPayload.notificationIds } } : {}) }, data: { readAt: new Date() } });
        recordType = 'notification'; recordId = action.userId; url = '/finance'; resultRecord = { markedReadCount: updated.count };
      } else if (action.actionType === 'budget') {
      if(walletEnabled()) {
        if(materialPayload.wallet_operation==='ALLOCATE')resultRecord=await createFundedEnvelopeTx(tx,actor,{organizationId:materialPayload.organization_id,label:materialPayload.label,amountMinor:materialPayload.amountMinor,parentId:materialPayload.parentId,idempotencyKey:effectiveIdempotencyKey});
        else if(materialPayload.wallet_operation==='ADJUST')resultRecord=await adjustFundedEnvelopeTx(tx,actor,materialPayload.budget_id,{operation:materialPayload.operation,amountMinor:materialPayload.amountMinor,targetEnvelopeId:materialPayload.targetEnvelopeId,expectedVersion:materialPayload.expectedVersion});
        else throw new WalletError('FUNDED_BUDGET_REQUIRED','Use funded wallet envelopes while wallet mode is active.',409);
        recordType='wallet_budget';recordId=resultRecord.id;url='/wallet/funding';resolvedSubsidiaryId=materialPayload.organization_id;
      } else {

      const { budget_id, organization_id, period, total_amount, allocations, mode } = materialPayload;
      const budgetMode = (mode || materialPayload.action || 'create').toLowerCase();
      if (materialPayload.warning_threshold !== undefined && (!Number.isFinite(Number(materialPayload.warning_threshold)) || Number(materialPayload.warning_threshold) < 0 || Number(materialPayload.warning_threshold) > 100)) throw new Error('Warning threshold must be between 0 and 100.');
      if (allocations !== undefined && !Array.isArray(allocations)) throw new Error('Allocations must be an array.');
      if ((allocations || []).some((line: any) => !Number.isFinite(Number(line.amount ?? line.allocatedAmount ?? 0)) || Number(line.amount ?? line.allocatedAmount ?? 0) < 0)) throw new Error('Each budget allocation must be a finite nonnegative amount.');

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
          ? await tx.budget.findUnique({ where: { id: budget_id }, include: { lines: true, organization: true } })
          : exactPeriod
          ? await tx.budget.findFirst({
              where: {
                organizationId: targetOrgId,
                periodName: { equals: exactPeriod, mode: 'insensitive' },
                status: 'ACTIVE',
              },
              include: { lines: true, organization: true },
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
          include: { lines: true, organization: true },
        });
      } else if (budgetMode === 'reallocate' || budgetMode === 'update') {
        const existing = budget_id
          ? await tx.budget.findUnique({ where: { id: budget_id }, include: { lines: true, organization: true } })
          : exactPeriod
          ? await tx.budget.findFirst({
              where: {
                organizationId: targetOrgId,
                periodName: { equals: exactPeriod, mode: 'insensitive' },
                status: 'ACTIVE',
              },
              include: { lines: true, organization: true },
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
        if (!Number.isFinite(updatedTotal) || updatedTotal <= 0) {
          throw new StagedValidationError('INVALID_BUDGET_AMOUNT', 'Budget total amount must be a positive number.');
        }

        const [poolRec] = await tx.$queryRaw<Array<{ availableMinor: bigint }>>`SELECT "availableMinor" FROM "WalletFundingPool" WHERE "id" = 'MONNIFY_NGN'`;
        if (poolRec && poolRec.availableMinor > BigInt(0)) {
          const maxAllowedNaira = Number(poolRec.availableMinor) / 100;
          if (updatedTotal > maxAllowedNaira) {
            throw new StagedValidationError(
              'BUDGET_EXCEEDS_MONNIFY_BALANCE',
              `Subsidiary budget (₦${updatedTotal.toLocaleString()}) cannot exceed the available Monnify balance (₦${maxAllowedNaira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
            );
          }
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
            ...(exactPeriod ? { periodName: exactPeriod } : {}),
            ...(materialPayload.warning_threshold !== undefined ? { warningThreshold: Number(materialPayload.warning_threshold) } : {}),
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
                    el.departmentName.toLowerCase() === dept.toLowerCase()))
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
          include: { lines: true, organization: true },
        });
      } else if (budgetMode === 'create') {
        if (!exactPeriod) {
          throw new StagedValidationError('BUDGET_PERIOD_REQUIRED', 'Fiscal period is required to create a budget.');
        }
        const parsedTotal = Number(total_amount || 0);
        if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
          throw new StagedValidationError('INVALID_BUDGET_AMOUNT', 'Budget total amount must be greater than zero.');
        }

        const [poolRecCreate] = await tx.$queryRaw<Array<{ availableMinor: bigint }>>`SELECT "availableMinor" FROM "WalletFundingPool" WHERE "id" = 'MONNIFY_NGN'`;
        if (poolRecCreate && poolRecCreate.availableMinor > BigInt(0)) {
          const maxAllowedNaira = Number(poolRecCreate.availableMinor) / 100;
          if (parsedTotal > maxAllowedNaira) {
            throw new StagedValidationError(
              'BUDGET_EXCEEDS_MONNIFY_BALANCE',
              `Subsidiary budget (₦${parsedTotal.toLocaleString()}) cannot exceed the available Monnify balance (₦${maxAllowedNaira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
            );
          }
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
            fiscalPeriod: materialPayload.fiscal_period || 'QUARTERLY',
            warningThreshold: Number(materialPayload.warning_threshold ?? 80),
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
          include: { lines: true, organization: true },
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
      }
    } else if (action.actionType === 'approval_decision') {
      if (walletEnabled() && String(materialPayload.decision).toUpperCase() === 'APPROVE') throw new WalletError('WALLET_RELEASE_REQUIRED', 'Use the exact GMD wallet release preview to approve and fund this payment.', 409);
      const { request_id, request_ids, expected_versions, decision, reason } = materialPayload;
      const targetIds: string[] =
        Array.isArray(request_ids) && request_ids.length > 0
          ? request_ids.map((id: any) => String(id))
          : [String(request_id)];

      const normDecision = String(decision || '').toUpperCase().trim();
      if (!['APPROVE', 'APPROVED', 'DECLINE', 'REJECT', 'REJECTED', 'CLARIFY', 'CLARIFICATION', 'REQUEST_CLARIFICATION', 'CLARIFICATION_REQUESTED', 'REQUIRES_CLARIFICATION'].includes(normDecision)) throw new Error('Choose approve, reject, or request clarification.');
      const newStatus =
        normDecision === 'APPROVE' || normDecision === 'APPROVED'
          ? 'APPROVED'
          : normDecision === 'DECLINE' || normDecision === 'REJECT' || normDecision === 'REJECTED'
          ? 'REJECTED'
          : 'CLARIFICATION_REQUESTED';

      const updatedResults: any[] = [];
      for (const targetReqId of [...targetIds].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'approval:' + targetReqId}, 0))`;
        const req = await tx.expenditureRequest.findFirst({
          where: { OR: [{ id: targetReqId }, { requestNumber: targetReqId }] },
          include: {
            requester: true,
            approvalSteps: { orderBy: { stageIndex: 'asc' } },
            channel: true,
          },
        });

        if (!req) throw new Error(`Request ${targetReqId} not found.`);
        resolvedSubsidiaryId = req.subsidiaryId;

        if (!['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(req.approvalStatus)) {
          throw new StaleTargetError(
            `Request ${req.requestNumber} is already ${req.approvalStatus} and can no longer be decided from this preview.`
          );
        }
        const expectedVer =
          expected_versions && typeof expected_versions === 'object' && expected_versions[req.id] !== undefined
            ? Number(expected_versions[req.id])
            : targetIds.length === 1 && materialPayload.expected_version !== undefined
            ? Number(materialPayload.expected_version)
            : undefined;
        if (expectedVer !== undefined && req.requestVersion !== expectedVer) {
          throw new StaleTargetError(
            `Request ${req.requestNumber} was modified since staging (v${req.requestVersion}). Please request a fresh preview.`
          );
        }

        if (newStatus === 'APPROVED' && req.requestedById === actor.id && actor.role !== 'GMD') {
          throw new StagedPermissionError(
            'SEPARATION_OF_DUTIES',
            `Separation of duties policy: You cannot approve your own request ${req.requestNumber}.`
          );
        }

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'approval:' + req.id}, 0))`;
        const settings = await tx.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId: req.subsidiaryId, key: 'approval.controls' } } });
        const policy = settings ? JSON.parse(settings.value) : {};
        const trimmedReason = String(reason || '').trim();
        if (newStatus !== 'APPROVED' && policy.requireDecisionReason === true && !trimmedReason) {
          throw new Error('A decision reason is required by subsidiary approval policy.');
        }
        const assigneeId = materialPayload.disbursementAssigneeId;
        if (newStatus === 'APPROVED' && policy.requireAssignedDisbursementOwner && !assigneeId) throw new Error('Assign an executive to record the payment.');
        if (assigneeId) {
          const assignee = await tx.employee.findUnique({ where: { id: assigneeId } });
          if (!assignee || assignee.status !== 'ACTIVE' || assignee.approvalStatus !== 'APPROVED' || !['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(assignee.role)) throw new Error('Choose an active approved executive payment owner.');
        }
        const now = new Date();
        const pendingStep = req.approvalSteps.find((s) => s.status === 'PENDING');
        const decisionNote = trimmedReason || (newStatus === 'REJECTED' ? 'Declined by executive' : newStatus === 'APPROVED' ? 'Approved by executive' : 'Clarification requested by executive');

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
            requestVersion: { increment: 1 },
            ...(assigneeId ? { disbursementAssigneeId: assigneeId } : {}),
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

          if (updatedReq.requester?.workEmail) {
            const dec = newStatus === 'APPROVED' ? 'APPROVED' : newStatus === 'REJECTED' ? 'REJECTED' : 'CLARIFICATION_REQUESTED';
            sendApprovalDecisionEmail({
              to: updatedReq.requester.workEmail,
              recipientName: updatedReq.requester.legalName,
              decision: dec,
              decidedBy: actor.legalName,
              decidedByRole: actor.role,
              requestNumber: updatedReq.requestNumber,
              title: updatedReq.title,
              amountMinor: Number(updatedReq.amountMinor),
              reason: decisionNote || undefined,
            }).catch((err) => console.error(`[Approval Email Failed] ${updatedReq.requestNumber}:`, err));
          }
        }

        updatedResults.push(
          JSON.parse(JSON.stringify(updatedReq, (_, v) => (typeof v === 'bigint' ? Number(v) : v)))
        );
      }

      recordType = 'fund_request';
      recordId = updatedResults.map((r) => r.requestNumber).join(',');
      url = updatedResults.length === 1 ? `/requests/${updatedResults[0].requestNumber}` : `/approvals`;
      resultRecord = updatedResults.length === 1 ? updatedResults[0] : { count: updatedResults.length, requests: updatedResults };
    } else if (action.actionType === 'payment_record') {
      if(walletEnabled())throw new WalletError('LEGACY_PAYMENT_DISABLED','Wallet mode preserves historical payments and uses canonical wallet release and transfer records.',409);
      const paymentSubAction = String(materialPayload.sub_action || 'RECORD_PAYMENT').toUpperCase();
      if (paymentSubAction === 'RESOLVE_PAYMENT_ISSUE') {
        const disbId = materialPayload.disbursement_id;
        const disb = await tx.disbursement.findUnique({
          where: { id: String(disbId) },
          include: { request: { include: { channel: true } } },
        });
        if (!disb) throw new Error(`Disbursement ${disbId} not found.`);
        if (disb.status !== 'RECIPIENT_REPORTED_ISSUE') {
          throw new StaleTargetError(`Disbursement ${disb.externalReference} is in status ${disb.status}, not RECIPIENT_REPORTED_ISSUE.`);
        }
        resolvedSubsidiaryId = disb.request?.subsidiaryId || disb.payerOrgId;

        await tx.recipientPaymentConfirmation.deleteMany({ where: { disbursementId: disb.id } });
        const updatedDisb = await tx.disbursement.update({
          where: { id: disb.id },
          data: { status: 'AWAITING_RECIPIENT_CONFIRMATION' },
        });
        if (disb.requestId) {
          await tx.expenditureRequest.update({
            where: { id: disb.requestId },
            data: { paymentStatus: 'AWAITING_RECIPIENT_CONFIRMATION' },
          });
        }
        const noteText = String(materialPayload.resolution_note || 'Payment issue resolved; awaiting recipient re-confirmation.');
        if (disb.request?.channel) {
          await tx.channelMessage.create({
            data: {
              channelId: disb.request.channel.id,
              authorId: actor.id,
              authorName: actor.legalName,
              authorRole: actor.role,
              messageType: 'AUDIT_EVENT',
              body: `Payment issue resolved by ${actor.legalName}: ${noteText}`,
            },
          });
        }
        const recipientId = disb.beneficiaryEmployeeId || disb.request?.requestedById;
        if (recipientId) {
          notificationIntentIds.push(recipientId);
          await tx.systemNotification.create({
            data: {
              employeeId: recipientId,
              kind: 'PAYMENT_CONFIRMATION_REQUIRED',
              title: 'Payment issue resolved — please re-confirm receipt',
              body: `${actor.legalName} resolved the reported payment issue: ${noteText}`,
              linkUrl: disb.request ? `/requests/${disb.request.requestNumber}` : '/disbursements',
            },
          });
          notificationsDeliveredIds.push(recipientId);
        }
        recordType = 'disbursement';
        recordId = updatedDisb.id;
        url = `/disbursements`;
        resultRecord = JSON.parse(JSON.stringify(updatedDisb, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
      } else {
      const attachmentIds: string[] = materialPayload.attachment_ids || [];
      if (attachmentIds.length !== 1) throw new Error('Attach exactly one actual bank receipt for this transfer.');
      const evidence = await tx.attachment.findUnique({ where: { id: attachmentIds[0] } });
      if (!evidence?.fileData) throw new Error('Bank receipt bytes are unavailable.');
      const disbursement = await recordTransfer(tx, {
        actor, requestId: materialPayload.request_id, payerAccountId: materialPayload.payer_account_id,
        amountMinor: BigInt(Math.round(Number(materialPayload.amount) * 100)), reference: String(materialPayload.transfer_reference || ''),
        beneficiaryName: materialPayload.beneficiary_name, beneficiaryBank: materialPayload.beneficiary_bank, beneficiaryAccount: materialPayload.beneficiary_account,
        receipt: { name: evidence.fileName, type: evidence.contentType, bytes: Buffer.from(evidence.fileData) }, idempotencyKey: effectiveIdempotencyKey,
      });
      resolvedSubsidiaryId = disbursement.payerOrgId;
      recordType = 'disbursement'; recordId = disbursement.id; url = '/disbursements';
      resultRecord = JSON.parse(JSON.stringify(disbursement, (_, value) => typeof value === 'bigint' ? value.toString() : value));
      }
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
      const employeeId = materialPayload.employee_id || materialPayload.employeeId;
      const reject = ['REJECT', 'REJECTED', 'REJECT_ONBOARDING'].includes(String(materialPayload.decision || 'APPROVE').toUpperCase());
      const updated = reject
        ? await rejectEmployeeOnboarding({ actor: actor as any, targetEmployeeId: employeeId, rejectionReason: materialPayload.reason, requireStaffRoleOnly: true }, tx)
        : await approveEmployeeOnboarding({ actor: actor as any, targetEmployeeId: employeeId, assignedRole: 'STAFF', subsidiaryId: materialPayload.subsidiaryId || materialPayload.subsidiary_id, departmentId: materialPayload.departmentId || materialPayload.department_id, positionName: materialPayload.positionName, requireStaffRoleOnly: true }, tx);
      const assignment = await tx.employeeAssignment.findFirst({ where: { employeeId, isPrimary: true } });
      resolvedSubsidiaryId = assignment?.subsidiaryId || resolvedSubsidiaryId;
      recordType = 'employee'; recordId = updated.employeeNumber; url = '/staff';
      resultRecord = { employee_id: updated.id, employee_number: updated.employeeNumber, name: updated.legalName, status: updated.status, approval_status: updated.approvalStatus };
      notificationIntentIds.push(employeeId); notificationsDeliveredIds.push(employeeId);
    } else if (action.actionType === 'role_change') {
      if(walletEnabled() && actor.id!==process.env.BEMS_FINANCIAL_GMD_ID && [materialPayload.employeeId, materialPayload.employee_id, materialPayload.target_employee_id].includes(process.env.BEMS_FINANCIAL_GMD_ID)) throw new Error('The designated GMD account cannot be changed by another administrator.');
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

      if ((normalizeCanonicalRole(new_role) === 'SUPER_ADMIN' || normalizeCanonicalRole(emp.role) === 'SUPER_ADMIN') && normalizeCanonicalRole(actor.role) !== 'SUPER_ADMIN') throw new StagedPermissionError('Only a Super Admin may change Super Admin privileges.');
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
      const subAction = String(materialPayload.sub_action || materialPayload.action || 'CLEAR_CASE').toUpperCase();

      if (subAction === 'INITIALIZE_LEGACY_CASES' || subAction === 'INITIALIZE_CASES') {
        const legacyRequests = await tx.expenditureRequest.findMany({
          where: { disbursements: { some: {} }, accountabilityCase: { is: null }, ...(materialPayload._delegated_organization_id ? { subsidiaryId: materialPayload._delegated_organization_id } : {}) },
          include: { disbursements: { orderBy: { paidAt: 'asc' }, take: 1 } },
        });
        let createdCount = 0;
        for (const reqItem of legacyRequests) {
          const firstPayment = reqItem.disbursements[0];
          if (!firstPayment) continue;
          const dueAt = await accountabilityDeadline(reqItem.subsidiaryId, reqItem.requestType === 'EMERGENCY', firstPayment.paidAt, tx);
          const accCase = await tx.accountabilityCase.create({
            data: {
              requestId: reqItem.id,
              ownerUserId: reqItem.requestedById,
              requiredDeliverables: reqItem.deliverable,
              dueAt,
              status: reqItem.accountabilityStatus === 'EVIDENCE_SUBMITTED' ? 'EVIDENCE_SUBMITTED' : 'OPEN',
            },
          });
          await tx.followupTask.create({
            data: {
              accountabilityCaseId: accCase.id,
              assigneeId: reqItem.requestedById,
              description: `Submit post-payment deliverables for ${reqItem.requestNumber}`,
              dueAt,
            },
          });
          createdCount++;
        }
        recordType = 'accountability_case';
        recordId = 'INITIALIZE_LEGACY_CASES';
        url = `/accountability`;
        resultRecord = { initializedCount: createdCount };
      } else {
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

        if (subAction === 'SUBMIT_EVIDENCE' || subAction === 'UPLOAD_EVIDENCE') {
          const attIds: string[] = Array.isArray(materialPayload.attachment_ids) ? materialPayload.attachment_ids : [];
          const notes = String(materialPayload.notes || clearance_notes || 'Post-payment evidence submitted via BEMI');
          const files = await tx.attachment.findMany({ where: { id: { in: attIds } } });
          if (!files.length || files.length !== attIds.length || files.some(file => !file.fileData?.length || (file.requestId && file.requestId !== accCase.requestId) || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.contentType))) throw new Error('Upload actual supporting evidence for this request.');
          const funding=await walletRequestFunding(tx,accCase.requestId);
          if(funding?funding.settledMinor<=BigInt(0):!await tx.disbursement.count({where:{requestId:accCase.requestId}}))throw new Error('A confirmed bank withdrawal or historical payment is required before expense evidence.');
          if (attIds.length > 0) {
            await tx.attachment.updateMany({
              where: { id: { in: attIds } },
              data: { ownerType: 'ACCOUNTABILITY', ownerId: accCase.id, requestId: accCase.requestId, notes },
            });
          }
          const updated = await tx.accountabilityCase.update({
            where: { id: accCase.id },
            data: { status: 'EVIDENCE_SUBMITTED' },
          });
          await tx.expenditureRequest.update({
            where: { id: accCase.requestId },
            data: { accountabilityStatus: 'EVIDENCE_SUBMITTED' },
          });
          recordType = 'accountability_case';
          recordId = accCase.request?.requestNumber || accCase.id;
          url = `/accountability`;
          resultRecord = {
            case_id: updated.id,
            request_number: accCase.request?.requestNumber,
            status: updated.status,
            attachments_linked: attIds.length,
          };
        } else if (subAction === 'REVIEW_CASE') {
          const updated = await tx.accountabilityCase.update({
            where: { id: accCase.id },
            data: {
              status: 'UNDER_REVIEW',
              closureNotes: clearance_notes || 'Evidence reviewed by executive',
            },
          });
          recordType = 'accountability_case';
          recordId = accCase.request?.requestNumber || accCase.id;
          url = `/accountability`;
          resultRecord = {
            case_id: updated.id,
            request_number: accCase.request?.requestNumber,
            status: updated.status,
          };
        } else {
          if (!['CLEAR_CASE', 'CLOSE', 'VERIFY', 'CLEAR'].includes(subAction)) throw new Error('Unsupported accountability operation.');
          const funding=await walletRequestFunding(tx,accCase.requestId);
          if(funding&&(funding.availableMinor>BigInt(0)||funding.heldMinor>BigInt(0)))throw new Error('Withdraw or return all unused approved funds before final accountability closure.');
          if(!funding&&!await tx.disbursement.count({where:{requestId:accCase.requestId}}))throw new Error('An actual payment record is required before closing this case.');
          const files = await tx.attachment.findMany({ where: { ownerType: 'ACCOUNTABILITY', ownerId: accCase.id, requestId: accCase.requestId }, select: { fileData: true } });
          if (!(funding&&funding.returnedMinor===funding.creditedMinor) && !files.some(file => file.fileData?.length)) throw new Error('Supporting evidence bytes are required before closing this case.');
          const updated = await tx.accountabilityCase.update({
            where: { id: accCase.id },
            data: {
              status: 'CLOSED', verifierUserId: actor.id, verifiedAt: new Date(),
              closureNotes: clearance_notes || 'Receipts inspected and cleared by GMD via Executive AI',
            },
          });

          await tx.expenditureRequest.update({ where: { id: accCase.requestId }, data: { accountabilityStatus: 'CLOSED' } });
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
        }
      }
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
      if (daily_limit !== undefined && (!Number.isFinite(Number(daily_limit)) || Number(daily_limit) < 0)) throw new Error('Daily limit must be finite and nonnegative.');
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
        if (!targetOrgId || targetOrgId === 'BEMS-GROUP' || targetOrgId.toUpperCase() === 'ALL') {
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
          if (balance === undefined || balance === null || !Number.isFinite(Number(balance)) || Number(balance) < 0) {
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
            balance !== undefined && balance !== null && !!Number.isFinite(Number(balance))
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
          accountType: dbAccount.accountType, dailyLimit: Number(dbAccount.dailyLimit),
          status: dbAccount.status,
        };
      }
    } else if (action.actionType === 'intercompany_note') {
      const mode = (
        materialPayload.mode ||
        materialPayload.sub_action ||
        materialPayload.action ||
        (materialPayload.targetNoteIds || materialPayload.noteIds ? 'SETTLE' : 'CREATE_NOTE')
      ).toUpperCase();

      if (
        mode === 'SETTLE' ||
        mode === 'STAGE_SETTLEMENT' ||
        mode === 'RECONCILE_SETTLEMENT' || mode === 'RECONCILE_NOTE' ||
        mode === 'RECONCILE' ||
        Array.isArray(materialPayload.targetNoteIds)
      ) {
        const noteIds: string[] = materialPayload.targetNoteIds || materialPayload.noteIds || (materialPayload.noteId ? [materialPayload.noteId] : []);
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

        if (!sourceId || !targetId || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
          throw new StagedValidationError(
            'INVALID_INTERCOMPANY_NOTE',
            'sourceEntityId, targetEntityId, and a positive amount are required to issue paired intercompany notes.'
          );
        }

        const paired = await generateOperationalIntercompanyNotes({
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          amountMinor,
          currency: materialPayload.currency || (await tx.organization.findUnique({ where: { id: sourceId } }))?.defaultCurrency || 'NGN',
          description,
          actor: { id: actor.id, legalName: actor.legalName, role: actor.role },
          tx,
        });

        resolvedSubsidiaryId = sourceId;
        recordType = 'intercompany_note';
        recordId = paired.debitNote.noteNumber;
        url = `/intercompany`;
        resultRecord = paired;
      } else if (mode === 'AMEND_NOTE' || mode === 'UPDATE_NOTE' || mode === 'AMEND') {
        const noteId = materialPayload.noteId || materialPayload.id;
        const noteNumber = materialPayload.noteNumber;
        const existingNote = await tx.intercompanyNote.findFirst({
          where: { OR: [{ id: String(noteId || '') }, { noteNumber: String(noteNumber || '') }] },
        });
        if (!existingNote) {
          throw new StaleTargetError('Target intercompany note not found.');
        }
        if (existingNote.status !== 'ISSUED') {
          throw new StaleTargetError(`Intercompany note ${existingNote.noteNumber} is ${existingNote.status} and cannot be amended.`);
        }
        if (
          materialPayload.priorAmountMinor !== undefined &&
          Number(existingNote.totalAmountMinor) !== Number(materialPayload.priorAmountMinor)
        ) {
          throw new StaleTargetError(`Intercompany note ${existingNote.noteNumber} amount changed since staging.`);
        }
        const nextAmountMinor = BigInt(Math.round(Number(materialPayload.amountMinor || existingNote.totalAmountMinor)));
        const nextDescription = String(materialPayload.description || existingNote.description).trim();

        const updatedNote = await tx.intercompanyNote.update({
          where: { id: existingNote.id },
          data: {
            totalAmountMinor: nextAmountMinor,
            description: nextDescription,
          },
        });

        // Also update paired counterpart note if one exists with matching suffix
        const suffix = existingNote.noteNumber.replace(/^(DN|CN)-/, '');
        const counterpartNumber = existingNote.noteNumber.startsWith('DN-') ? `CN-${suffix}` : `DN-${suffix}`;
        await tx.intercompanyNote.updateMany({
          where: { noteNumber: counterpartNumber, status: 'ISSUED' },
          data: { totalAmountMinor: nextAmountMinor },
        });

        resolvedSubsidiaryId = existingNote.sourceEntityId;
        recordType = 'intercompany_note';
        recordId = updatedNote.noteNumber;
        url = `/intercompany`;
        resultRecord = {
          id: updatedNote.id,
          noteNumber: updatedNote.noteNumber,
          amountMinor: Number(updatedNote.totalAmountMinor),
          description: updatedNote.description,
          status: updatedNote.status,
        };
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
        }, tx);
        recordType = 'three_way_match';
        recordId = requestId;
        url = `/vendors`;
        resultRecord = matchResult;
      } else if (mode === 'RESOLVE_MATCH_EXCEPTION' || mode === 'OVERRIDE_MATCH_EXCEPTION') {
        const requestId = materialPayload.request_id || materialPayload.requestId;
        const reason = String(materialPayload.reason || '').trim();
        if (reason.length < 10) throw new Error('Explain the matching exception before requesting an override.');
        const reqItem = await tx.expenditureRequest.findFirst({
          where: { OR: [{ id: String(requestId) }, { requestNumber: String(requestId) }] },
          include: { invoices: { take: 1, orderBy: { createdAt: 'desc' } }, goodsReceipts: { take: 1, orderBy: { receivedAt: 'desc' } } },
        });
        if (!reqItem) throw new StaleTargetError(`Request ${requestId} not found.`);
        resolvedSubsidiaryId = reqItem.subsidiaryId;

        const existingMatch = await tx.threeWayMatchRecord.findUnique({ where: { requestId: reqItem.id } });
        let resolvedMatch: any;
        if (existingMatch) {
          resolvedMatch = await tx.threeWayMatchRecord.update({
            where: { id: existingMatch.id },
            data: { status: 'MATCH_CONFIRMED', matchedAt: new Date() },
          });
        } else if (reqItem.invoices[0]) {
          const inv = reqItem.invoices[0];
          resolvedMatch = await tx.threeWayMatchRecord.create({
            data: {
              requestId: reqItem.id,
              invoiceId: inv.id,
              grnId: reqItem.goodsReceipts[0]?.id || null,
              poAmountMinor: reqItem.amountMinor,
              invoiceAmountMinor: inv.amountMinor,
              varianceMinor: inv.amountMinor - reqItem.amountMinor,
              status: 'MATCH_CONFIRMED',
            },
          });
        } else {
          throw new Error('An actual invoice is required before a matching exception can be resolved.');
        }

        if (reqItem.invoices[0]) {
          await tx.vendorInvoice.update({
            where: { id: reqItem.invoices[0].id },
            data: { status: 'MATCHED' },
          });
        }

        recordType = 'three_way_match';
        recordId = reqItem.requestNumber;
        url = `/vendors`;
        resultRecord = {
          requestNumber: reqItem.requestNumber,
          status: 'MATCH_CONFIRMED',
          overrideReason: reason,
          matchId: resolvedMatch.id || reqItem.id,
        };
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
      if(walletEnabled()) throw new WalletError('WALLET_RELEASE_REQUIRED','Prepare the emergency request and use the funded GMD wallet release flow.',409);
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
        const reqNumber = `EMG-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;

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
        const isGroupScope = materialPayload.scope === 'GROUP';
        if (!isGroupScope && !targetOrgId) throw new Error('Choose an attendance entity or explicit GROUP scope.');
        const targetOrgs = isGroupScope
          ? await tx.organization.findMany({ where: { status: 'ACTIVE', ...(Array.isArray(materialPayload._policy_target_ids) ? { id: { in: materialPayload._policy_target_ids } } : {}) } })
          : await tx.organization.findMany({ where: { id: String(targetOrgId), status: 'ACTIVE' } });
        if (targetOrgs.length === 0) {
          throw new StagedValidationError('ORGANIZATION_NOT_FOUND', 'Target organization for attendance policy was not found.');
        }

        const current =
          (targetOrgId
            ? await tx.attendancePolicy.findUnique({ where: { organizationId: String(targetOrgId) } })
            : null) ||
          (isGroupScope ? await tx.attendancePolicy.findFirst({ where: { organization: { type: 'GROUP' } } }) : null);

        for (const key of ['latenessDeductionPercent', 'absenceDeductionPercent']) {
          if (materialPayload[key] !== undefined && (!Number.isFinite(Number(materialPayload[key])) || Number(materialPayload[key]) < 0 || Number(materialPayload[key]) > 100)) throw new Error('Attendance deductions must be between 0 and 100 percent.');
        }
        if (materialPayload.radiusMeters !== undefined && (!Number.isFinite(Number(materialPayload.radiusMeters)) || Number(materialPayload.radiusMeters) < 10 || Number(materialPayload.radiusMeters) > 10000)) throw new Error('Station radius must be between 10 and 10000 metres.');
        if (materialPayload.gracePeriodMinutes !== undefined && (!Number.isInteger(Number(materialPayload.gracePeriodMinutes)) || Number(materialPayload.gracePeriodMinutes) < 0 || Number(materialPayload.gracePeriodMinutes) > 180)) throw new Error('Grace period must be between 0 and 180 minutes.');
        for (const key of ['earliestCheckInTime', 'resumptionTime', 'closingTime']) if (materialPayload[key] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(materialPayload[key]))) throw new Error('Attendance times must use HH:MM.');
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
            where: { organizationId: { in: targetOrgs.map(org => org.id) }, ...(Array.isArray(materialPayload._policy_station_ids) ? { id: { in: materialPayload._policy_station_ids } } : {}) },
            data: { radiusMeters: Number(materialPayload.radiusMeters) },
          });
        }

        if (isGroupScope) {
          await tx.attendancePolicy.updateMany({ where: { organizationId: { in: targetOrgs.map(org => org.id) } }, data: updateData });
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

        // Re-evaluate today's non-overridden punches so new shift hours / grace / late penalty take effect immediately
        if (
          materialPayload.resumptionTime !== undefined ||
          materialPayload.gracePeriodMinutes !== undefined ||
          materialPayload.latenessDeductionPercent !== undefined
        ) {
          const todayWat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
          const targetOrgIds = targetOrgs.map((o) => o.id);
          const effectiveResumption = updateData.resumptionTime || current?.resumptionTime || '08:00';
          const effectiveGrace = updateData.gracePeriodMinutes ?? current?.gracePeriodMinutes ?? 15;
          const effectivePenalty = updateData.latenessDeductionPercent ?? current?.latenessDeductionPercent ?? 5.0;
          const [rH, rM] = String(effectiveResumption).split(':').map(Number);
          const cutoffMinutes = (Number.isFinite(rH) ? rH : 8) * 60 + (Number.isFinite(rM) ? rM : 0) + Number(effectiveGrace);

          const todayRecords = await tx.attendanceRecord.findMany({
            where: {
              workDate: todayWat,
              approvedById: null,
              status: { in: ['PRESENT', 'LATE'] },
              checkInTime: { not: null },
              employee: {
                isAttendanceExempt: false,
                assignments: { some: { subsidiaryId: { in: targetOrgIds }, status: 'ACTIVE' } },
              },
            },
            select: { id: true, checkInTime: true, status: true, deductionPercent: true },
          });

          const watTimeFmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Africa/Lagos',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });

          for (const rec of todayRecords) {
            if (!rec.checkInTime) continue;
            const hhmm = watTimeFmt.format(rec.checkInTime);
            const [cH, cM] = hhmm.split(':').map(Number);
            if (!Number.isFinite(cH) || !Number.isFinite(cM)) continue;
            const punchMinutes = cH * 60 + cM;
            const nextIsLate = punchMinutes > cutoffMinutes;
            const nextStatus = nextIsLate ? 'LATE' : 'PRESENT';
            const nextDeduction = nextIsLate ? Number(effectivePenalty) : 0.0;
            if (rec.status !== nextStatus || Number(rec.deductionPercent) !== nextDeduction) {
              await tx.attendanceRecord.update({
                where: { id: rec.id },
                data: { status: nextStatus, deductionPercent: nextDeduction },
              });
            }
          }
        }

        resolvedSubsidiaryId = targetOrgId ? String(targetOrgId) : resolvedSubsidiaryId;
        recordType = 'attendance_policy';
        recordId = isGroupScope ? 'GROUP_ATTENDANCE_POLICY' : String(targetOrgId);
        url = `/attendance`;
        const displayEntity = targetOrgId || targetOrgs.find(org => org.type === 'GROUP')?.id || targetOrgs[0].id;
        resultRecord = await tx.attendancePolicy.findUnique({ where: { organizationId: displayEntity } });
        resolvedSubsidiaryId = displayEntity;
      } else if (subAction === 'UPDATE_ROSTER') {
        const employeeId = materialPayload.employeeId || materialPayload.employee_id;
        if (!employeeId) throw new Error('employeeId is required to update staff work schedule roster.');
        if (!await tx.employee.findFirst({ where: { id: employeeId, status: 'ACTIVE', approvalStatus: 'APPROVED', role: 'STAFF' } })) throw new Error('Choose an active approved staff member.');
        const weeklyOffDays = String(materialPayload.weeklyOffDays ?? '0,6');
        const customShiftIn = String(materialPayload.customShiftIn || '08:00');
        const customShiftOut = String(materialPayload.customShiftOut || '17:00');
        if (!/^([0-6](,[0-6])*)?$/.test(weeklyOffDays) || new Set(weeklyOffDays.split(',')).size !== weeklyOffDays.split(',').length) throw new Error('Weekly off days must be distinct numbers from 0 to 6.');
        if (![customShiftIn, customShiftOut].every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('Shift times must use HH:MM.');
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

        const organizationId = materialPayload.organizationId || materialPayload.subsidiaryId || resolvedSubsidiaryId;
        if (!organizationId) throw new Error('Choose the exact station organization before calibration.');
        const org = await tx.organization.findFirst({ where: { id: String(organizationId), status: 'ACTIVE' } });
        if (!org) throw new Error('An active station organization is required.');
        const stations = await tx.attendanceStation.findMany({ where: { organizationId: org.id, ...(materialPayload.stationId ? { id: String(materialPayload.stationId) } : { status: 'ACTIVE' }) }, take: 2 });
        if (stations.length > 1) throw new Error('Choose one exact station ID before calibration.');
        let station = stations[0];
        resolvedSubsidiaryId = org.id;
        if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90 || !Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180 || !Number.isInteger(radiusNum) || radiusNum < 10 || radiusNum > 10000) throw new Error('Supply valid coordinates and a radius between 10 and 10000 metres.');

        if (!station) {
          station = await tx.attendanceStation.create({
            data: {
              organizationId: org.id,
              name: materialPayload.name?.trim() || 'BEMS Group',
              code: `STN-${org.code}-${crypto.randomUUID().slice(0, 8)}`,
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
          null;

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

        if (!Number.isFinite(deductionPercent) || deductionPercent < 0 || deductionPercent > 100) throw new Error('Deduction percentage must be between 0 and 100.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !Number.isFinite(Date.parse(targetDate))) throw new Error('Use a valid ISO work date.');
        if (deduction_minor !== undefined && (!Number.isSafeInteger(Number(deduction_minor)) || Number(deduction_minor) < 0)) throw new Error('Deduction must be a nonnegative exact minor amount.');
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
        if (['COMPLETED', 'ACCEPTED', 'REVOKED'].includes(invitation.status)) throw new Error('This invitation cannot be resent.');
        if (normalizeCanonicalRole(invitation.role) === 'STAFF' || !normalizeCanonicalRole(invitation.role)) throw new Error('Only executive invitations are supported.');
        if (normalizeCanonicalRole(invitation.role) === 'SUPER_ADMIN' && normalizeCanonicalRole(actor.role) !== 'SUPER_ADMIN') throw new StagedPermissionError('Only a Super Admin can resend this invitation.');

        const newToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const updated = await tx.adminInvitation.update({
          where: { id: inviteId },
          data: { token: newToken, expiresAt, status: 'PENDING' },
        });

        try {
          await queueDelivery(tx, actionId, 'ADMIN_INVITATION', {
            to: invitation.workEmail,
            role: invitation.role,
            subsidiaryName: invitation.subsidiary.legalName,
            positionName: invitation.positionName || invitation.role,
            inviteToken: newToken,
            expiresInDays: 7,
          });
        } catch (e) {
          throw e;
        }

        recordType = 'admin_invitation';
        recordId = updated.id;
        url = `/staff`;
        resultRecord = updated;
      } else if (subAction === 'REVOKE_INVITE') {
        const inviteId = materialPayload.invitationId || materialPayload.id;
        const existing = await tx.adminInvitation.findUnique({ where: { id: inviteId } });
        if (!existing || ['COMPLETED', 'ACCEPTED'].includes(existing.status)) throw new Error('Only incomplete invitations can be revoked.');
        if (normalizeCanonicalRole(existing.role) === 'SUPER_ADMIN' && normalizeCanonicalRole(actor.role) !== 'SUPER_ADMIN') throw new StagedPermissionError('Only a Super Admin can revoke this invitation.');
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
        const canonicalRole = normalizeCanonicalRole(role);
        if (!canonicalRole || canonicalRole === 'STAFF') throw new StagedPermissionError('Only executive invitations are permitted.');
        if (canonicalRole === 'SUPER_ADMIN' && normalizeCanonicalRole(actor.role) !== 'SUPER_ADMIN') throw new StagedPermissionError('Only a Super Admin can invite another Super Admin.');

        if (canonicalRole === 'GMD') {
          const existingGmd = await tx.employee.findFirst({
            where: { role: 'GMD', status: 'ACTIVE', approvalStatus: 'APPROVED' },
          });
          if (existingGmd) {
            throw new Error(`An active GMD already exists: ${existingGmd.legalName} (${existingGmd.workEmail}).`);
          }
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(workEmail || ''))) throw new Error('A valid work email is required.');
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
          await queueDelivery(tx, actionId, 'ADMIN_INVITATION', {
            to: workEmail,
            role: canonicalRole,
            subsidiaryName: subsidiary.legalName,
            positionName: invitation.positionName || canonicalRole,
            inviteToken: token,
            expiresInDays: 7,
          });
        } catch (e) {
          throw e;
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
          token: invitation.token,
        };
      }
    } else if (action.actionType === 'subsidiary_creation') {
      const { name, code, type, currency, brandColor, industry, headquarters, logoUrl } = materialPayload;
      if (type === 'GROUP' || String(code).toUpperCase() === 'BEMS-GROUP') throw new Error('BEMS Group already exists; create a subsidiary instead.');
      assertGroupIdentityUpdate({ code: 'NEW_SUBSIDIARY' }, { legalName: name, code, type });
      const parentGroup = await tx.organization.findUnique({ where: { code: 'BEMS-GROUP' } });
      if (!parentGroup || parentGroup.type !== 'GROUP') throw new Error('BEMS Group is not configured.');

      const org = await tx.organization.create({
        data: {
          legalName: name,
          parentGroupId: parentGroup.id,
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
          starlinkIpAddresses: '',
          starlinkPowerOutageMode: false,
        },
      });

      const extraSettings: Array<[string, string | null | undefined]> = [
        ['SUBSIDIARY_INDUSTRY', industry],
        ['HEADQUARTERS_LOCATION', headquarters],
        ['RC_NUMBER', materialPayload.rcNumber],
        ['TIN_NUMBER', materialPayload.tinNumber],
        ['INCORPORATION_DATE', materialPayload.incorporationDate],
        ['WEBSITE_URL', materialPayload.websiteUrl],
        ['CORPORATE_DESCRIPTION', materialPayload.description],
        ['EXECUTIVE_LEAD_NAME', materialPayload.leadName],
        ['EXECUTIVE_LEAD_TITLE', materialPayload.leadTitle],
        ['EXECUTIVE_LEAD_EMAIL', materialPayload.leadEmail],
        ['EXECUTIVE_LEAD_PHONE', materialPayload.leadPhone],
      ];
      for (const [k, v] of extraSettings) {
        if (v && String(v).trim()) {
          await tx.workspaceSetting.upsert({
            where: { organizationId_key: { organizationId: org.id, key: k } },
            create: { organizationId: org.id, key: k, value: String(v).trim(), updatedById: actor.id },
            update: { value: String(v).trim(), updatedById: actor.id },
          });
        }
      }

      const initialBudget = Number(materialPayload.monthlyBudget ?? materialPayload.initialBudget ?? 0);
      if (Number.isFinite(initialBudget) && initialBudget > 0) {
        const now = new Date();
        const fiscalYear = now.getFullYear();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        await tx.budget.create({
          data: {
            organizationId: org.id,
            fiscalYear,
            fiscalPeriod: 'MONTHLY',
            periodName: `${monthNames[now.getMonth()]} ${fiscalYear}`,
            totalAmount: initialBudget,
            committedAmount: 0,
            spentAmount: 0,
            status: 'ACTIVE',
            warningThreshold: 80.0,
          },
        });
      }

      if (Array.isArray(materialPayload.staffIds) && materialPayload.staffIds.length > 0) {
        for (const staffId of materialPayload.staffIds) {
          const emp = await tx.employee.findUnique({ where: { id: String(staffId) } });
          if (emp) {
            const existingAsg = await tx.employeeAssignment.findFirst({
              where: { employeeId: emp.id, subsidiaryId: org.id },
            });
            if (!existingAsg) {
              await tx.employeeAssignment.create({
                data: {
                  employeeId: emp.id,
                  subsidiaryId: org.id,
                  positionName: emp.jobTitle || 'Subsidiary Staff',
                  isPrimary: false,
                  status: 'ACTIVE',
                },
              });
            }
          }
        }
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

      if (!Number.isInteger(year) || year < 2020 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('A valid payroll year and month are required.');
      if (subAction === 'PREPARE') {
        const payrollOrgId = materialPayload.organization_id || materialPayload.subsidiaryId || null;
        if (materialPayload._delegated_organization_id && !payrollOrgId) throw new Error('Choose an explicit payroll entity.');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'payroll:' + year + '-' + month + ':' + (payrollOrgId || 'group')}, 0))`;

        const allSubsidiaries = await tx.organization.findMany({ where: { status: 'ACTIVE' } });
        const hqOrg = allSubsidiaries.find((o) => o.type === 'GROUP' || o.code === 'BEMS-GROUP') || allSubsidiaries[0];
        const selectedOrg = payrollOrgId ? allSubsidiaries.find(org => org.id === payrollOrgId) : hqOrg;
        if (!selectedOrg) throw new Error('Choose an active payroll organization.');
        const defaultSubId = selectedOrg.id;
        resolvedSubsidiaryId = defaultSubId;

        let period = await tx.payrollPeriod.findFirst({
          where: { year, month },
          include: {
            batches: {
              where: { paymentEntityId: defaultSubId },
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
                where: { paymentEntityId: defaultSubId },
                orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
                include: { items: { include: { disbursement: true } } },
              },
            },
          });
        }

        const activeStaff = await tx.employee.findMany({
          where: { status: 'ACTIVE', approvalStatus: 'APPROVED', role: 'STAFF', ...(payrollOrgId ? { assignments: { some: { subsidiaryId: payrollOrgId, status: 'ACTIVE' } } } : {}) },
          include: {
            assignments: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } },
            employmentAgreements: {
              where: { status: 'ACTIVE', ...(payrollOrgId ? { employerEntityId: payrollOrgId } : {}) },
              orderBy: { startDate: 'desc' },
              include: {
                compensations: {
                  orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
                  take: 1,
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
          if(walletEnabled() && (batch.status==='WALLET_CREDITED'||batch.items.some(item=>item.status==='WALLET_CREDITED'))) throw new Error('Released payroll is immutable. Create an explicitly reviewed supplemental batch for additional pay.');
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
              paymentEntityId: defaultSubId,
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

          const allocations = (comp.costAllocations || []).filter(allocation => !allocation.effectiveTo || allocation.effectiveTo >= period.startsOn);
          if (allocations.length && (allocations.some(allocation => !Number.isFinite(allocation.percentage) || allocation.percentage < 0) || Math.abs(allocations.reduce((sum, allocation) => sum + allocation.percentage, 0) - 100) > 0.001)) throw new Error('Payroll cost allocations must total 100 percent.');
          if (allocations.length > 0) {
            let allocated = BigInt(0);
            for (const alloc of allocations) {
              const allocationMinor = alloc === allocations[allocations.length - 1] ? grossMinor - allocated : grossMinor * BigInt(Math.round(alloc.percentage * 10000)) / BigInt(1000000);
              allocated += allocationMinor;
              await tx.payrollItemAllocation.create({
                data: {
                  itemId: item.id,
                  subsidiaryId: alloc.subsidiaryId,
                  allocableCostMinor: allocationMinor,
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
        const rawPassword = String(confirmationPassword || materialPayload.password || '').trim();
        const useWalletDisbursement =
          walletEnabled() ||
          materialPayload.disburseToWallets === true ||
          source === 'AI_STAGED' ||
          rawPassword.length > 0;

        const batchId = String(materialPayload.batchId || '');
        if (!batchId) throw new Error('Choose an exact payroll batch.');
        const batch = await tx.payrollBatch.findUnique({
          where: { id: batchId },
          include: {
            period: true,
            items: {
              include: {
                allocations: true,
                employee: { select: { id: true, legalName: true, employeeNumber: true, workEmail: true, role: true } },
              },
            },
          },
        });
        if (!batch || !['SUBMITTED', 'APPROVED'].includes(batch.status) || !batch.items.length) {
          throw new StaleTargetError('Only a submitted nonempty payroll batch can be signed off and disbursed.');
        }
        const period = batch.period;

        if (!useWalletDisbursement) {
          const paymentEntityId = materialPayload.paymentEntityId || batch.paymentEntityId;
          if (!paymentEntityId || !(await tx.organization.findFirst({ where: { id: paymentEntityId, status: 'ACTIVE' } }))) {
            throw new Error('Select an active payroll paying entity.');
          }
          const disbursementAssigneeId = materialPayload.disbursementAssigneeId || batch.disbursementAssigneeId;
          if (
            !disbursementAssigneeId ||
            !(await tx.employee.findFirst({
              where: {
                id: disbursementAssigneeId,
                status: 'ACTIVE',
                approvalStatus: 'APPROVED',
                role: { in: ['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] },
              },
            }))
          ) {
            throw new Error('Assign an active executive to record payroll transfers.');
          }
          if (
            batch.items.some((item) => item.netMinor < BigInt(0) || item.grossMinor < item.netMinor) ||
            batch.items.reduce((sum, item) => sum + item.netMinor, BigInt(0)) !== batch.totalNetMinor ||
            batch.items.reduce((sum, item) => sum + item.grossMinor, BigInt(0)) !== batch.totalGrossMinor
          ) {
            throw new Error('Payroll totals require reconciliation before approval.');
          }
          if (
            batch.items.some(
              (item) =>
                item.allocations.reduce((sum, allocation) => sum + allocation.allocableCostMinor, BigInt(0)) !==
                item.grossMinor
            )
          ) {
            throw new Error('Payroll allocations must reconcile exactly to gross amounts.');
          }
          const snapshotHash = payrollSnapshotHash(batch.items);
          resolvedSubsidiaryId = paymentEntityId;
          const updated = await tx.payrollBatch.update({
            where: { id: batch.id },
            data: {
              status: 'APPROVED',
              snapshotHash,
              approvedAt: new Date(),
              ...(paymentEntityId ? { paymentEntityId } : {}),
              ...(disbursementAssigneeId ? { disbursementAssigneeId } : {}),
            },
          });
          await tx.payrollPeriod.update({
            where: { id: period.id },
            data: { lockStatus: 'LOCKED' },
          });
          if (disbursementAssigneeId) {
            notificationIntentIds.push(disbursementAssigneeId);
            await tx.systemNotification.create({
              data: {
                employeeId: disbursementAssigneeId,
                kind: 'DISBURSEMENT_ASSIGNED',
                title: `Payroll Disbursement Assigned (${year}-${String(month).padStart(2, '0')})`,
                body: `${actor.legalName} approved payroll batch v${updated.version} and assigned you to record salary payouts.`,
                linkUrl: '/payroll',
              },
            });
            notificationsDeliveredIds.push(disbursementAssigneeId);
          }
          recordType = 'payroll_batch';
          recordId = updated.id;
          url = `/payroll`;
          resultRecord = {
            id: updated.id,
            status: updated.status,
            version: updated.version,
            paymentEntityId: updated.paymentEntityId,
            disbursementAssigneeId: updated.disbursementAssigneeId,
            totalNet: Number(updated.totalNetMinor) / 100,
            approvedAt: updated.approvedAt,
          };
        } else {
          // Verify GMD Executive Password before crediting staff BEMS Wallets
          const approverAccount = await tx.employee.findUnique({
            where: { id: actor.id },
            select: { id: true, passwordHash: true, legalName: true, role: true },
          });
          if (!rawPassword) {
            throw new Error('Please enter your executive password to authorize salary disbursement to staff BEMS Wallets.');
          }
          if (!approverAccount?.passwordHash || !(await verifyPassword(rawPassword, approverAccount.passwordHash))) {
            throw new Error('Invalid executive password. Salary disbursement was not authorized.');
          }

          const paymentEntityId = materialPayload.paymentEntityId || batch.paymentEntityId || period.groupId;
          const disbursementAssigneeId = materialPayload.disbursementAssigneeId || batch.disbursementAssigneeId || actor.id;
          const snapshotHash = payrollSnapshotHash(batch.items);
          resolvedSubsidiaryId = paymentEntityId;

          const monthLabel = `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(period.year, period.month - 1, 1))} ${period.year}`;
          const proposalId = crypto.randomUUID();
          const proposalAmount = batch.totalNetMinor > BigInt(0) ? batch.totalNetMinor : BigInt(1);

          await tx.$executeRaw`
            INSERT INTO "WalletReleaseProposal" (
              "id", "createdById", "sourceType", "sourceId",
              "amountMinor", "category", "sourceHash", "confirmationHash", "expiresAt",
              "status", "approvedById", "approvedAt"
            ) VALUES (
              ${proposalId}, ${actor.id}, 'PAYROLL_BATCH', ${batch.id},
              ${proposalAmount}, 'SALARY', ${snapshotHash}, ${snapshotHash}, now(),
              'EXECUTED', ${actor.id}, now()
            )
          `;

          let creditedCount = 0;
          for (const item of batch.items) {
            const orgId = item.allocations[0]?.subsidiaryId || paymentEntityId || period.groupId;
            if (item.netMinor > BigInt(0)) {
              const existingLots = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "WalletCreditLot"
                WHERE "payrollItemId" = ${item.id}
                LIMIT 1
              `;
              if (existingLots.length === 0) {
                const creditId = crypto.randomUUID();
                await tx.$executeRaw`
                  INSERT INTO "WalletCreditLot" (
                    "id", "proposalId", "payrollItemId", "sourceType", "sourceId",
                    "employeeId", "organizationId", "category", "amountMinor", "availableMinor"
                  ) VALUES (
                    ${creditId}, ${proposalId}, ${item.id}, 'PAYROLL_ITEM', ${item.id},
                    ${item.employeeId}, ${orgId}, 'SALARY', ${item.netMinor}, ${item.netMinor}
                  )
                `;

                const sourceKey = `SALARY:${period.year}:${period.month}:${item.employeeId}`;
                await tx.$executeRaw`
                  INSERT INTO "WalletPaidSource" ("key", "proposalId")
                  VALUES (${sourceKey}, ${proposalId})
                  ON CONFLICT DO NOTHING
                `;

                const journalId = crypto.randomUUID();
                const journalRef = `WLT-SAL-${period.year}${String(period.month).padStart(2, '0')}-${item.id.slice(0, 8)}-${Date.now().toString().slice(-5)}`;
                await tx.$executeRaw`
                  INSERT INTO "WalletJournal" ("id", "kind", "reference", "actorId")
                  VALUES (${journalId}, 'WALLET_CREDITED', ${journalRef}, ${actor.id})
                `;
                await tx.$executeRaw`
                  INSERT INTO "WalletJournalEntry" ("id", "journalId", "accountKey", "amountMinor")
                  VALUES
                    (${crypto.randomUUID()}, ${journalId}, ${'PAYROLL_BATCH:' + batch.id}, ${-item.netMinor}),
                    (${crypto.randomUUID()}, ${journalId}, ${'STAFF:' + item.employeeId + ':SALARY'}, ${item.netMinor})
                `;
                creditedCount++;
              }

              const formattedNet = '₦' + (Number(item.netMinor) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 });
              const formattedGross = '₦' + (Number(item.grossMinor) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 });
              const formattedDed = '₦' + (Number(item.employeeDeductionsMinor) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 });

              notificationIntentIds.push(item.employeeId);
              await tx.systemNotification.create({
                data: {
                  employeeId: item.employeeId,
                  subsidiaryId: orgId,
                  category: 'PAYROLL_DEDUCTIONS',
                  priority: 'CRITICAL',
                  kind: 'WALLET_CREDITED',
                  title: `💸 ${monthLabel} Salary Credited: ${formattedNet}`,
                  body: `Your ${monthLabel} salary (${formattedNet} net; Gross: ${formattedGross}, Deductions: ${formattedDed}) has been approved by ${actor.legalName} (${actor.role}) and credited to your BEMS Wallet. Open the BEMS App or Portal to withdraw to your personal bank account.`,
                  actionLabel: 'Withdraw from BEMS Wallet',
                  actionUrl: '/wallet',
                  linkUrl: '/wallet',
                },
              });
              notificationsDeliveredIds.push(item.employeeId);

              if (item.employee?.workEmail) {
                await queueDelivery(tx, actionId, 'SALARY_WALLET_CREDITED', {
                  to: item.employee.workEmail,
                  recipientName: item.employee.legalName,
                  employeeNumber: item.employee.employeeNumber,
                  periodName: monthLabel,
                  grossMinor: Number(item.grossMinor),
                  deductionsMinor: Number(item.employeeDeductionsMinor),
                  netMinor: Number(item.netMinor),
                  approvedBy: actor.legalName,
                  approvedByRole: actor.role,
                });
              }
            }
          }

          await tx.payrollItem.updateMany({
            where: { batchId: batch.id },
            data: { status: 'PAID' },
          });

          const updated = await tx.payrollBatch.update({
            where: { id: batch.id },
            data: {
              status: 'PAID',
              snapshotHash,
              approvedAt: new Date(),
              ...(paymentEntityId ? { paymentEntityId } : {}),
              ...(disbursementAssigneeId ? { disbursementAssigneeId } : {}),
            },
          });

          await tx.payrollPeriod.update({
            where: { id: period.id },
            data: { lockStatus: 'LOCKED' },
          });

          await tx.auditEvent.create({
            data: {
              actorId: actor.id,
              actorName: actor.legalName,
              actorRole: actor.role,
              groupId: period.groupId,
              subsidiaryId: paymentEntityId || period.groupId,
              targetType: 'PAYROLL_BATCH',
              targetId: batch.id,
              action: 'GMD_PAYROLL_APPROVED_AND_CREDITED',
              correlationId: proposalId,
              metadata: JSON.stringify({
                batchId: batch.id,
                periodId: period.id,
                year: period.year,
                month: period.month,
                periodName: monthLabel,
                version: batch.version,
                preparedById: batch.submittedById,
                preparedByName: batch.submittedByName || 'System / HR Payroll Prep',
                approvedById: actor.id,
                approvedByName: actor.legalName,
                approvedByRole: actor.role,
                totalGrossMinor: batch.totalGrossMinor.toString(),
                totalNetMinor: batch.totalNetMinor.toString(),
                employeeCount: batch.items.length,
                walletsCredited: creditedCount,
                notes: materialPayload.comments || null,
              }),
            },
          });

          const nextYear = period.month === 12 ? period.year + 1 : period.year;
          const nextMonth = period.month === 12 ? 1 : period.month + 1;
          const nextPeriodName = `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(nextYear, nextMonth - 1, 1))} ${nextYear}`;

          recordType = 'payroll_batch';
          recordId = updated.id;
          url = `/payroll`;
          resultRecord = {
            id: updated.id,
            status: updated.status,
            version: updated.version,
            paymentEntityId: updated.paymentEntityId,
            disbursementAssigneeId: updated.disbursementAssigneeId,
            totalGross: Number(updated.totalGrossMinor) / 100,
            totalNet: Number(updated.totalNetMinor) / 100,
            employeeCount: batch.items.length,
            walletsCredited: creditedCount,
            approvedBy: actor.legalName,
            approvedAt: updated.approvedAt,
            nextPeriod: {
              year: nextYear,
              month: nextMonth,
              periodName: nextPeriodName,
            },
          };
        }
      } else if (subAction === 'RECORD_PAYOUT' || subAction === 'DISBURSE') {
        const itemId = materialPayload.itemId || materialPayload.payrollItemId;
        if (!itemId) throw new Error('Select one payroll item and its actual transfer receipt.');
        const ids: string[] = materialPayload.attachment_ids || [];
        if (ids.length !== 1) throw new Error('Attach one actual bank receipt.');
        const evidence = await tx.attachment.findUnique({ where: { id: ids[0] } });
        const item = await tx.payrollItem.findUnique({ where: { id: itemId } });
        if (!item || !evidence?.fileData) throw new Error('Payroll item or receipt file is unavailable.');
        const payment = await recordTransfer(tx, {
          actor, payrollItemId: item.id, payerAccountId: materialPayload.payer_account_id || materialPayload.payerAccountId,
          bankName: materialPayload.bankName, amountMinor: item.netMinor, reference: String(materialPayload.externalReference || ''),
          receipt: { name: evidence.fileName, type: evidence.contentType, bytes: Buffer.from(evidence.fileData) }, idempotencyKey: effectiveIdempotencyKey,
        });
        recordType = 'disbursement'; recordId = payment.id; url = '/payroll'; resolvedSubsidiaryId = payment.payerOrgId;
        resultRecord = { paymentId: payment.id, amountMinor: payment.amountMinor.toString() };
      } else if (subAction === 'REMOVE_ITEM') {
        if(walletEnabled()){const item=await tx.payrollItem.findUnique({where:{id:String(materialPayload.itemId||materialPayload.item_id||materialPayload.payrollItemId||'')}});if(item?.status==='WALLET_CREDITED')throw new Error('A wallet-funded payroll item cannot be removed.');}
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
        const employeeId = item.employeeId;
        const now = new Date();
      // 4. If mode is PERMANENT, stop recurring salary (set grossMinor to 0)
      if (mode === 'PERMANENT') {
        const agreement = await tx.employmentAgreement.findFirst({
          where: { employeeId, status: 'ACTIVE' },
          orderBy: { startDate: 'desc' }
        });

        if (agreement) {
          const activeSalary = await tx.compensationAgreement.findFirst({
            where: {
              employmentAgreementId: agreement.id,
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
            },
            orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
          });

          if (activeSalary) {
            await tx.compensationAgreement.update({
              where: { id: activeSalary.id },
              data: { effectiveTo: new Date(now.getTime() - 1) }
            });
          }

          const prior = await tx.compensationAgreement.findMany({
            where: { employmentAgreementId: agreement.id },
            select: { version: true }
          });
          const nextVersion = Math.max(0, ...prior.map(c => c.version)) + 1;

          await tx.compensationAgreement.create({
            data: {
              employmentAgreementId: agreement.id,
              grossMinor: BigInt(0),
              currency: activeSalary?.currency || 'NGN',
              recurrence: activeSalary?.recurrence || 'MONTHLY',
              effectiveFrom: now,
              version: nextVersion,
              approvedBy: actor.id,
              changeType: 'REMOVED_FROM_PAYROLL',
              changeReason: reason,
            }
          });
        }

        // Cancel any pending proposals
        await tx.salaryChangeProposal.updateMany({
          where: { employeeId, status: 'PENDING_APPROVAL' },
          data: {
            status: 'CANCELLED',
            decisionNote: `Staff removed from salary payroll by ${actor.legalName}. Reason: ${reason}`,
            decidedById: actor.id,
            decidedByName: actor.legalName,
            decidedAt: now,
          }
        });
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
          data: { totalGrossMinor: newGross, totalNetMinor: newNet, status: 'SUBMITTED', approvedAt: null, snapshotHash: null, version: { increment: 1 } },
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

      assertGroupIdentityUpdate(existingOrg, updateData);

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

      const updateExtraSettings: Array<[string, string | null | undefined]> = [
        ['TIN_NUMBER', materialPayload.tinNumber],
        ['INCORPORATION_DATE', materialPayload.incorporationDate],
        ['WEBSITE_URL', materialPayload.websiteUrl],
        ['CORPORATE_DESCRIPTION', materialPayload.description],
        ['EXECUTIVE_LEAD_NAME', materialPayload.leadName],
        ['EXECUTIVE_LEAD_TITLE', materialPayload.leadTitle],
        ['EXECUTIVE_LEAD_EMAIL', materialPayload.leadEmail],
        ['EXECUTIVE_LEAD_PHONE', materialPayload.leadPhone],
      ];
      for (const [k, v] of updateExtraSettings) {
        if (v !== undefined && String(v || '').trim()) {
          await tx.workspaceSetting.upsert({
            where: { organizationId_key: { organizationId, key: k } },
            create: { organizationId, key: k, value: String(v).trim(), updatedById: actor.id },
            update: { value: String(v).trim(), updatedById: actor.id },
          });
        }
      }

      if (Array.isArray(materialPayload.staffIds) && materialPayload.staffIds.length > 0) {
        for (const staffId of materialPayload.staffIds) {
          const emp = await tx.employee.findUnique({ where: { id: String(staffId) } });
          if (emp) {
            const existingAsg = await tx.employeeAssignment.findFirst({
              where: { employeeId: emp.id, subsidiaryId: organizationId },
            });
            if (!existingAsg) {
              await tx.employeeAssignment.create({
                data: {
                  employeeId: emp.id,
                  subsidiaryId: organizationId,
                  positionName: emp.jobTitle || 'Subsidiary Staff',
                  isPrimary: false,
                  status: 'ACTIVE',
                },
              });
            } else if (existingAsg.status !== 'ACTIVE') {
              await tx.employeeAssignment.update({
                where: { id: existingAsg.id },
                data: { status: 'ACTIVE' },
              });
            }
          }
        }
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
      if (!['REGISTER_OFFLINE', 'EDIT_PROFILE', 'TOGGLE_ATTENDANCE_EXEMPT', 'CHANGE_STATUS', 'REQUEST_UPDATE', 'SEND_PASSWORD_RESET_INVITE', 'RESET_PASSWORD_INVITE', 'DELETE_OR_DEACTIVATE'].includes(subAction)) throw new Error('Unsupported staff operation.');
      if (subAction !== 'TOGGLE_ATTENDANCE_EXEMPT' && walletEnabled() && actor.id!==process.env.BEMS_FINANCIAL_GMD_ID && [materialPayload.employeeId, materialPayload.employee_id, materialPayload.target_employee_id].includes(process.env.BEMS_FINANCIAL_GMD_ID)) throw new Error('The designated GMD account cannot be changed by another administrator.');

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

        if (normalizeCanonicalRole(targetEmployee.role) === 'SUPER_ADMIN' && normalizeCanonicalRole(actor.role) !== 'SUPER_ADMIN') throw new StagedPermissionError('Only a Super Admin can modify a Super Admin account.');

        if (subAction !== 'TOGGLE_ATTENDANCE_EXEMPT' && targetEmployee.role === 'GMD' && actor.role !== 'GMD') {
          throw new StagedValidationError(
            'GMD_IMMUTABLE',
            'Only the active Group Managing Director can modify the GMD account.'
          );
        }

        if (subAction === 'TOGGLE_ATTENDANCE_EXEMPT') {
          if (!['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role)) {
            throw new StagedPermissionError('Only GMD or Super Admin can update attendance exemptions.');
          }
          const isExempt =
            materialPayload.isAttendanceExempt !== undefined
              ? Boolean(materialPayload.isAttendanceExempt)
              : !targetEmployee.isAttendanceExempt;
          const updated = await tx.employee.update({
            where: { id: employeeId },
            data: { isAttendanceExempt: isExempt },
          });
          await tx.staffWorkSchedule.upsert({ where: { employeeId }, update: { isExempt }, create: { employeeId, weeklyOffDays: '0,6', isExempt } });

          if (isExempt) {
            const unpaidItems = await tx.payrollItem.findMany({
              where: {
                employeeId,
                status: { notIn: ['PAID', 'WALLET_CREDITED'] },
                batch: { status: { not: 'PAID' } },
              },
              select: { id: true, batchId: true, grossMinor: true, employeeDeductionsMinor: true },
            });
            for (const item of unpaidItems) {
              if (item.employeeDeductionsMinor > BigInt(0)) {
                await tx.payrollItem.update({
                  where: { id: item.id },
                  data: {
                    employeeDeductionsMinor: BigInt(0),
                    netMinor: item.grossMinor,
                  },
                });
                const batchItems = await tx.payrollItem.findMany({
                  where: { batchId: item.batchId },
                  select: { grossMinor: true, netMinor: true },
                });
                let totalG = BigInt(0);
                let totalN = BigInt(0);
                for (const bi of batchItems) {
                  totalG += bi.grossMinor;
                  totalN += bi.netMinor;
                }
                await tx.payrollBatch.update({
                  where: { id: item.batchId },
                  data: { totalGrossMinor: totalG, totalNetMinor: totalN },
                });
              }
            }
          }

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
          const nextStatus = String(materialPayload.status || '').toUpperCase();
          if (!['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'].includes(nextStatus)) throw new Error('Choose a supported employee status.');
          const updated = await transitionEmployeeStatus({ actor: actor as any, targetEmployeeId: employeeId, nextStatus: nextStatus as 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED', reason: materialPayload.reason }, tx);
          recordType = 'employee'; recordId = updated.id; url = '/hr'; resultRecord = updated;
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
        } else if (subAction === 'SEND_PASSWORD_RESET_INVITE' || subAction === 'RESET_PASSWORD_INVITE') {
          const resetUrl = '/finance?reset=1';
          await queueDelivery(tx, actionId, 'CHAT_MESSAGE', { to: targetEmployee.workEmail, recipientName: targetEmployee.legalName, senderName: actor.legalName, senderRole: actor.role, messageText: 'An executive requested that you reset your password. Open the secure sign-in screen, choose Forgot password, and request a verification code sent directly to your email. Never share that code with another person.', contextTitle: 'Account security', actionUrl: new URL(resetUrl, process.env.NEXT_PUBLIC_APP_URL || 'https://bemserp.work').toString() });
          await tx.systemNotification.create({
            data: {
              employeeId,
              kind: 'SECURITY_RESET_INVITE',
              title: 'Password Reset Authorized',
              body: `${actor.legalName} issued an authorized password reset invitation for your account. Complete verification on the dedicated password reset screen.`,
              linkUrl: '/login?reset=1',
            },
          });

          notificationIntentIds.push(employeeId);
          notificationsDeliveredIds.push(employeeId);
          recordType = 'password_reset_invitation';
          recordId = targetEmployee.id;
          url = `/hr`;
          resultRecord = {
            employeeId: targetEmployee.id,
            workEmail: targetEmployee.workEmail,
            verificationRequired: true,
            secretIssued: false,
            resetUrl,
          };
        } else if (subAction === 'DELETE_OR_DEACTIVATE') {
          const updated =
            targetEmployee.status === 'TERMINATED'
              ? await tx.employee.update({
                  where: { id: employeeId },
                  data: { status: 'TERMINATED' },
                })
              : await transitionEmployeeStatus(
                  {
                    actor: actor as any,
                    targetEmployeeId: employeeId,
                    nextStatus: 'TERMINATED',
                    reason: materialPayload.reason || 'Account deactivated; business records retained.',
                  },
                  tx
                );
          await tx.employeeAssignment.updateMany({ where: { employeeId }, data: { status: 'INACTIVE' } });
          await tx.employmentAgreement.updateMany({ where: { employeeId, status: 'ACTIVE' }, data: { status: 'TERMINATED', endDate: new Date() } });
          await tx.authSession.deleteMany({ where: { employeeId } });

          const openPayrollItems = await tx.payrollItem.findMany({
            where: {
              employeeId,
              status: { notIn: ['PAID', 'WALLET_CREDITED'] },
              batch: { status: { not: 'PAID' } },
            },
            include: { disbursement: true },
          });
          for (const pi of openPayrollItems) {
            if (pi.disbursement && pi.disbursement.status === 'UNPAID') {
              await tx.disbursement.delete({ where: { id: pi.disbursement.id } });
            }
            if (!pi.disbursement || pi.disbursement.status === 'UNPAID') {
              await tx.payrollItemAllocation.deleteMany({ where: { itemId: pi.id } });
              await tx.payrollItem.delete({ where: { id: pi.id } });
              const batchItems = await tx.payrollItem.findMany({
                where: { batchId: pi.batchId },
                select: { grossMinor: true, netMinor: true },
              });
              let totalG = BigInt(0);
              let totalN = BigInt(0);
              for (const bi of batchItems) {
                totalG += bi.grossMinor;
                totalN += bi.netMinor;
              }
              await tx.payrollBatch.update({
                where: { id: pi.batchId },
                data: { totalGrossMinor: totalG, totalNetMinor: totalN },
              });
            }
          }

          recordType = 'employee';
          recordId = employeeId;
          url = '/hr';
          resultRecord = {
            id: employeeId,
            legalName: updated.legalName,
            status: updated.status,
            mode: 'DEACTIVATED_WITH_HISTORY',
            message: `Staff account for ${updated.legalName} has been removed from active directory and open payroll runs.`,
          };
        } else {
          // EDIT_PROFILE
          const updateData: any = {};
          if (typeof materialPayload.legalName === 'string' && materialPayload.legalName.trim()) {
            updateData.legalName = materialPayload.legalName.trim();
          }
          if (typeof materialPayload.workEmail === 'string' && materialPayload.workEmail.trim()) {
            const cleanEmail = materialPayload.workEmail.trim().toLowerCase();
            if (cleanEmail !== targetEmployee.workEmail) {
              if(walletEnabled())throw new Error('Wallet-owner recovery email changes require a verified owner recovery process; administrative email reassignment is disabled.');
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
      } else if (
        subAction === 'UPDATE_RECURRING' ||
        subAction === 'PAUSE_RECURRING' ||
        subAction === 'CANCEL_RECURRING'
      ) {
        const reqLookup = materialPayload.requestId || materialPayload.requestNumber;
        const reqItem = await tx.expenditureRequest.findFirst({
          where: { OR: [{ id: reqLookup }, { requestNumber: reqLookup }] },
        });
        if (!reqItem) throw new Error(`Request "${reqLookup}" not found.`);
        resolvedSubsidiaryId = reqItem.subsidiaryId;

        const nextRecurring = subAction === 'UPDATE_RECURRING' ? Boolean(materialPayload.isRecurring ?? true) : false;
        const nextInterval = nextRecurring ? String(materialPayload.recurringInterval || 'MONTHLY').toUpperCase() : null;
        const nextNeededBy = materialPayload.neededBy ? new Date(materialPayload.neededBy) : reqItem.neededBy;

        const updatedRec = await tx.expenditureRequest.update({
          where: { id: reqItem.id },
          data: {
            isRecurring: nextRecurring,
            recurringInterval: nextInterval,
            neededBy: nextNeededBy,
          },
        });

        recordType = 'fund_request';
        recordId = updatedRec.requestNumber;
        url = `/requests/${updatedRec.requestNumber}`;
        resultRecord = {
          id: updatedRec.id,
          requestNumber: updatedRec.requestNumber,
          isRecurring: updatedRec.isRecurring,
          recurringInterval: updatedRec.recurringInterval,
          neededBy: updatedRec.neededBy,
        };
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

        if (!materialPayload.subsidiaryId) {
          throw new StagedValidationError('SUBSIDIARY_REQUIRED', 'An explicit subsidiaryId is required to create a fund request.');
        }
        const subsidiaryOrg = await tx.organization.findUnique({ where: { id: String(materialPayload.subsidiaryId) } });
        if (!subsidiaryOrg) throw new Error('Valid subsidiary organization not found.');
        resolvedSubsidiaryId = subsidiaryOrg.id;

        const targetRequesterId = String(materialPayload.requestedById || actor.id);
        const isOnBehalf = targetRequesterId !== actor.id;

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
            requestedById: targetRequesterId,
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
                    authorId: actor.id,
                    authorName: actor.legalName,
                    authorRole: actor.role,
                    messageType: 'AUDIT_EVENT',
                    body: `Fund request ${requestNumber} created and submitted via BEMI (${currency} ${(Number(amountMinor) / 100).toLocaleString()})${isOnBehalf ? ` by ${actor.legalName} on behalf of requester` : ''}.`,
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
        await verifyTargetEmployeeAccess(actor as any, employeeId, { allowExecutiveTarget: false });
        const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
        if (!validDate(startDate) || !validDate(endDate) || startDate > endDate || !String(materialPayload.reason || '').trim()) {
          throw new Error('Valid startDate and endDate strings are required for leave requests.');
        }
        const overlap = await tx.leaveRequest.findFirst({ where: { employeeId, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: endDate }, endDate: { gte: startDate } } });
        if (overlap) throw new Error('An overlapping leave request already exists.');
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
        const existing = await tx.leaveRequest.findUnique({ where: { id: leaveId } });
        if (!existing || existing.status !== 'PENDING') throw new StaleTargetError('Only pending leave requests can be reviewed.');
        await verifyTargetEmployeeAccess(actor as any, existing.employeeId, { allowExecutiveTarget: false });
        if (existing.employeeId === actor.id) throw new StagedPermissionError('A different authorized reviewer must decide your leave request.');
        if (!['APPROVE_LEAVE', 'REJECT_LEAVE'].includes(subAction)) throw new Error('Unsupported leave operation.');
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
        const today = new Date().toISOString().slice(0, 10);
        if (decision === 'APPROVED' && updated.startDate <= today && updated.endDate >= today) {
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
        const current = await tx.followupTask.findUnique({ where: { id: taskId }, include: { accountabilityCase: { include: { request: true } }, channel: { include: { request: true } } } });
        if (!current) throw new Error('Task not found.');
        if (normalizeCanonicalRole(actor.role) === 'STAFF' && current.assigneeId !== actor.id) throw new StagedPermissionError('Only the assignee can update this task.');
        const linkedRequest = current.accountabilityCase?.request || current.channel?.request;
        resolvedSubsidiaryId = linkedRequest?.subsidiaryId || null;
        const nextStatus = subAction === 'REOPEN_TASK' ? 'PENDING' : 'COMPLETED';
        const updated = await tx.followupTask.update({
          where: { id: taskId },
          data: {
            status: nextStatus,
            completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
            responseNotes: typeof materialPayload.responseNotes === 'string' ? materialPayload.responseNotes.trim().slice(0, 1000) : null,
          },
        });
        recordType = 'followup_task';
        recordId = updated.id;
        url = `/tasks`;
        resultRecord = updated;
      } else {
        const description = String(materialPayload.description || '').trim();
        const assigneeId = materialPayload.assigneeId;
        if (normalizeCanonicalRole(actor.role) === 'STAFF') throw new StagedPermissionError('Executive authority is required to assign tasks.');
        if (description.length < 3 || description.length > 1000 || !assigneeId) {
          throw new Error('description and assigneeId are required to create a follow-up task.');
        }
        const dueAt = materialPayload.dueAt ? new Date(materialPayload.dueAt) : new Date(Date.now() + 3 * 86400_000);
        if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() < Date.now() - 60000) throw new Error('Choose a valid future task deadline.');
        const assignee = await tx.employee.findFirst({ where: { id: String(assigneeId), status: 'ACTIVE', approvalStatus: 'APPROVED' } });
        if (!assignee) throw new Error('Choose an active approved employee.');
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

        if (!accountabilityCaseId && !channelId) throw new Error('Link the task to an actual request or accountability case.');
        const linkedCase = accountabilityCaseId ? await tx.accountabilityCase.findUnique({ where: { id: String(accountabilityCaseId) }, include: { request: { include: { channel: true } } } }) : null;
        const linkedChannel = channelId ? await tx.requestChannel.findUnique({ where: { id: String(channelId) }, include: { request: true } }) : null;
        if ((accountabilityCaseId && !linkedCase) || (channelId && !linkedChannel)) throw new Error('Linked task target not found.');
        if (linkedCase && linkedChannel && linkedCase.requestId !== linkedChannel.requestId) throw new Error('Task targets belong to different requests.');
        resolvedSubsidiaryId = linkedCase?.request.subsidiaryId || linkedChannel?.request.subsidiaryId || null;

        const created = await tx.followupTask.create({
          data: {
            accountabilityCaseId,
            channelId,
            assigneeId,
            description,
            dueAt,
          },
        });

        let sendAlert = true;
        if (resolvedSubsidiaryId) {
          const preference = await tx.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId: resolvedSubsidiaryId, key: 'notifications.preferences' } } });
          if (preference) sendAlert = JSON.parse(preference.value).taskAssignmentAlerts !== false;
        }
        if (sendAlert) await tx.systemNotification.create({
          data: {
            employeeId: assigneeId,
            kind: 'FOLLOWUP_TASK_ASSIGNED',
            title: 'A follow-up task was assigned to you',
            body: description,
            linkUrl: '/',
          },
        });

        if (sendAlert) { notificationIntentIds.push(assigneeId); notificationsDeliveredIds.push(assigneeId); }
        const channel = linkedChannel || linkedCase?.request.channel;
        if (channel) await tx.channelMessage.create({ data: { channelId: channel.id, authorId: actor.id, authorName: actor.legalName, authorRole: actor.role, messageType: 'AUDIT_EVENT', body: `Task assigned to ${assignee.legalName}: ${description}` } });
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

      if (targetChannel === 'GMD' && actor.role !== 'GMD') {
        throw new StagedValidationError(
          'FORBIDDEN_CHANNEL',
          'Only the Group Managing Director can send messages on the confidential GMD Executive Line.'
        );
      }

      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      const attIds: string[] = materialPayload.attachment_ids || (Array.isArray(materialPayload.attachmentIds) ? materialPayload.attachmentIds : []);
      if (attIds.length > 0) {
        const firstAtt = await tx.attachment.findUnique({ where: { id: String(attIds[0]) } });
        if (firstAtt) {
          attachmentUrl = firstAtt.fileUrl;
          attachmentName = firstAtt.fileName;
        }
      }

      const newMessage = await tx.staffAdminMessage.create({
        data: {
          employeeId: targetEmployeeId,
          channel: targetChannel,
          senderRole: actor.role === 'GMD' ? 'GMD' : 'SYSTEM_ADMIN',
          senderId: actor.id,
          senderName: actor.legalName,
          message: messageText,
          attachmentUrl,
          attachmentName,
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
        await queueDelivery(tx, actionId, 'CHAT_MESSAGE', {
          to: employee.workEmail,
          recipientName: employee.legalName,
          senderName: actor.legalName,
          senderRole: actor.role,
          messageText,
          attachmentName: null,
          contextTitle: `BEMS ${channelLabel}`,
          actionUrl: `https://bemserp.work/helpdesk?channel=${targetChannel}`,
        });
      }

      notificationIntentIds.push(targetEmployeeId);
      notificationsDeliveredIds.push(targetEmployeeId);
      recordType = 'staff_admin_message';
      recordId = newMessage.id;
      url = `/helpdesk`;
      resultRecord = newMessage;
    } else if (action.actionType === 'policy_update') {
      const subAction = String(materialPayload.sub_action || materialPayload.action || 'UPDATE_APPROVAL_POLICY').toUpperCase();

      if (subAction === 'EXPORT_REPORT') {
        resultRecord = await createReportSnapshot(tx, actor, materialPayload);
        recordType = 'report_export'; recordId = resultRecord.report_id; url = resultRecord.download_url;
      } else if (subAction === 'DELETE_POLICY') {
        if (!materialPayload.id) throw new Error('Select an exact policy.');
        const policy = await tx.approvalPolicy.update({ where: { id: String(materialPayload.id) }, data: { active: false } });
        recordType = 'approval_policy'; recordId = policy.id; resolvedSubsidiaryId = policy.scopeSubsidiaryId; url = '/policies';
        resultRecord = { ...policy, minAmountMinor: policy.minAmountMinor.toString(), maxAmountMinor: policy.maxAmountMinor?.toString() ?? null };
      } else if (subAction === 'UPDATE_MOBILE_GATE' || subAction === 'MOBILE_GATE') {
        const appId = String(materialPayload.appId || 'GMD_APP').toUpperCase();
        const minimumAllowedVersion = String(materialPayload.minimumAllowedVersion || '1.0.0');
        const latestVersionAvailable = String(materialPayload.latestVersionAvailable || minimumAllowedVersion);
        const forceUpdate = materialPayload.forceUpdate !== undefined ? Boolean(materialPayload.forceUpdate) : true;
        const directDownloadUrl = String(
          materialPayload.directDownloadUrl ||
            (appId === 'GMD_APP' ? 'https://bemserp.work/download/gmd-app.apk' : 'https://bemserp.work/download/staff-app.apk')
        );
        const upgradePromptNotes = String(materialPayload.upgradePromptNotes || '');

        const gate = await tx.mobileAppGate.upsert({
          where: { appId },
          update: {
            minimumAllowedVersion,
            latestVersionAvailable,
            forceUpdate,
            directDownloadUrl,
            upgradePromptNotes,
            updatedById: actor.id,
          },
          create: {
            appId,
            appName: appId === 'GMD_APP' ? 'BEMS GMD AI' : 'BEMS Staff App',
            packageName: appId === 'GMD_APP' ? 'com.bemsgroup.bems_gmd_ai' : 'com.bemsfarms.bems_staff_app',
            minimumAllowedVersion,
            latestVersionAvailable,
            forceUpdate,
            directDownloadUrl,
            upgradePromptNotes,
            updatedById: actor.id,
          },
        });
        recordType = 'mobile_app_gate';
        recordId = gate.id;
        url = `/settings`;
        resultRecord = gate;
      } else if (subAction === 'ACTIVATE_MOBILE_APK' || subAction === 'UPLOAD_APK') {
        const artifactId = String(materialPayload.artifact_id || materialPayload.attachment_ids?.[0] || '');
        const release = await activateMobileArtifact(tx, artifactId, actor);
        recordType = 'mobile_app_release'; recordId = release.id; url = '/settings'; resultRecord = release;
      } else if (subAction === 'CONFIGURE_CHANNEL' || subAction === 'IMPORT_TEMPLATE') {
        const organizationId = String(materialPayload.organizationId || '');
        if (!organizationId) throw new Error('organizationId is required.');
        resolvedSubsidiaryId = organizationId;

        if (subAction === 'IMPORT_TEMPLATE') {
          const templateId = String(materialPayload.templateId || 'STANDARD_CORPORATE');
          resultRecord = await applyGovernanceTemplate(tx, organizationId, templateId, actor.id);
          recordType = 'workspace_setting'; recordId = resultRecord.settingId; url = '/settings';
        } else {
          const existing = await tx.workspaceSetting.findUnique({
            where: { organizationId_key: { organizationId, key: 'notification.channels' } },
          });
          let channels: any[] = [];
          if (existing?.value) {
            try {
              const parsed = JSON.parse(existing.value);
              if (Array.isArray(parsed)) channels = parsed;
            } catch {}
          }
          const chan = materialPayload.channel;
          if (!chan || !String(chan.name || '').trim()) throw new Error('A channel name and configuration are required.');
          chan.status = chan.status === 'Disabled' ? 'Disabled' : 'Configured';
          const idx = channels.findIndex((c) => String(c.name || '').toLowerCase() === String(chan.name || '').toLowerCase());
          if (idx >= 0) channels[idx] = { ...channels[idx], ...chan };
          else channels.push(chan);

          const saved = await tx.workspaceSetting.upsert({
            where: { organizationId_key: { organizationId, key: 'notification.channels' } },
            create: { organizationId, key: 'notification.channels', value: JSON.stringify(channels), updatedById: actor.id },
            update: { value: JSON.stringify(channels), updatedById: actor.id },
          });
          recordType = 'workspace_setting';
          recordId = saved.id;
          url = `/settings`;
          resultRecord = { organizationId, channel: chan, channelsCount: channels.length };
        }
      } else if (subAction === 'UPDATE_WORKSPACE_SETTINGS' || subAction === 'UPDATE_SETTINGS') {
        const organizationId = materialPayload.organizationId;
        const key = String(materialPayload.key || '');
        const value = materialPayload.value;
        if (!organizationId || !key || !value) {
          throw new Error('organizationId, key, and value are required to update workspace settings.');
        }
        resolvedSubsidiaryId = organizationId;
        if (!['approval.controls', 'notifications.preferences', 'data.retention', 'ai.access'].includes(key)) throw new Error('Unsupported settings section.');
        const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) throw new Error('Settings must be an object.');
        const normalizedValue = key === 'ai.access' ? normalizeAiAccessMatrix(parsedValue) : parsedValue;
        const json = JSON.stringify(normalizedValue);
        if (json.length > 16000) throw new Error('Settings are too large.');
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
        if (!['UPDATE_APPROVAL_POLICY', 'UPSERT_POLICY'].includes(subAction)) throw new Error('Unsupported policy operation.');
        const policyRole = normalizeCanonicalRole(materialPayload.requiredRole || 'GMD');
        if (!policyRole || policyRole === 'STAFF') throw new Error('Approval policies require GMD or Super Admin authority.');
        const min = Number(materialPayload.minAmount ?? 0);
        const max = materialPayload.maxAmount == null ? null : Number(materialPayload.maxAmount);
        if (!Number.isFinite(min) || min < 0 || (max !== null && (!Number.isFinite(max) || max < min))) throw new Error('Approval limits must be finite, nonnegative, and ordered.');
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
          requiredRole: policyRole,
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

    if ((action.actionType === 'grn_creation' || action.actionType === 'vendor_invoice_creation') && resultRecord?.requestId) {
      resultRecord.threeWayMatch = await executeThreeWayMatch({ requestId: resultRecord.requestId, actorId: actor.id, actorName: actor.legalName, actorRole: actor.role }, tx);
    }
    resultRecord = stripAuthenticationSecrets(resultRecord);

    // Resolve actual Group & Subsidiary scope for AuditEvent
    const groupOrg = await tx.organization.findFirst({
      where: { code: 'BEMS-GROUP' },
      select: { id: true },
    });
    const resolvedGroupId = groupOrg?.id || resolvedSubsidiaryId || 'BEMS-GROUP';
    const queued = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM "DeliveryOutbox" WHERE "commandId" = ${actionId} AND "status" <> 'SENT'`;
    const deliveryStatus: 'DELIVERED' | 'QUEUED' | 'NOT_APPLICABLE' =
      Number(queued[0]?.count || 0) > 0 ? 'QUEUED' : notificationsDeliveredIds.length > 0
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
        action: `${source}_${action.actionType.toUpperCase()}_EXECUTED`,
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

  return { resultRecord, recordType, recordId, url, resolvedSubsidiaryId, notificationIntentIds, notificationsDeliveredIds, deliveryStatus };
}

export async function executeDashboardCommand(
  actor: { id: string; legalName: string; role: string; employeeNumber?: string },
  actionType: StagedActionType,
  materialPayload: Record<string, any>
) {
  validateStageActionProposal(actionType, materialPayload, 'Dashboard command');
  const descriptor = getCommandDescriptor(actionType);
  const role = normalizeCanonicalRole(actor.role);
  if (!descriptor) throw new StagedPermissionError('Unknown business command.');
  const hrScope = role === 'STAFF' && (actionType === 'leave_action' || (actionType === 'attendance_override' && ['CALIBRATE_STATION', 'UPDATE_POLICY', 'TOGGLE_STARLINK_LOCK', 'TOGGLE_GEOFENCE_LOCK', 'TOGGLE_POWER_OUTAGE'].includes(String(materialPayload.action_type))) || (actionType === 'payroll_action' && String(materialPayload.sub_action).toUpperCase() === 'PREPARE')) ? await getHrAuthorizationScope(actor as any) : null;
  const hrAuthorized = hrScope?.authorized && (actionType === 'leave_action' || hrScope.isGlobal || ((materialPayload.organization_id || materialPayload.organizationId) && hrScope.subsidiaryIds.includes(materialPayload.organization_id || materialPayload.organizationId)));
  const selfTaskUpdate = role === 'STAFF' && actionType === 'task_action' && ['COMPLETE_TASK', 'REOPEN_TASK'].includes(String(materialPayload.sub_action));
  if (!role || (!descriptor?.allowedCallerRoles.includes(role) && !hrAuthorized && !selfTaskUpdate)) throw new StagedPermissionError('This dashboard operation is not permitted for the selected workspace.');
  const resultRecord = await prisma.$transaction(async tx => {
    const liveActor = await tx.employee.findUnique({ where: { id: actor.id } });
    if (!liveActor || liveActor.status !== 'ACTIVE' || liveActor.approvalStatus !== 'APPROVED' || normalizeCanonicalRole(liveActor.role) !== role) throw new StagedPermissionError('Your account is no longer authorized.');
    const id = crypto.randomUUID();
    const result = await executeBusinessCommand(tx, {
      action: { actionType, userId: actor.id, summary: descriptor.title }, actor, materialPayload,
      actionId: id, effectiveIdempotencyKey: 'dashboard_' + id, auditEventId: 'aud_' + id, source: 'DASHBOARD',
    });
    return result.resultRecord;
  }, { timeout: 20000, isolationLevel: 'Serializable' });

  // Dispatched immediately post-commit so email deliveries are processed without delay
  try {
    await processDeliveryOutbox();
  } catch (err) {
    console.warn('[DashboardCommand] Delivery outbox post-commit processing deferred:', err);
  }

  return resultRecord;
}
