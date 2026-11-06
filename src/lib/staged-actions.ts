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

export const STAGED_ACTION_TTL_MINUTES = 15;

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
  warnings?: string[];
  blockingErrors?: string[];
}

export async function stageAction(input: StageActionInput) {
  const resolvedUserId = input.userId || input.actorId;
  if (!resolvedUserId) {
    throw new Error('userId or actorId is required to stage an action.');
  }

  // Enforce Admin AI Write Access Control Matrix for the specific capability scope
  const requiredScope = resolveScopeFromStagePayload(input.actionType, input.materialPayload);
  await assertAiScopeAllowed(requiredScope, 'write', input.targetSubsidiaryId);

  const creator = await prisma.employee.findUnique({
    where: { id: resolvedUserId },
    select: { role: true, status: true },
  });
  if (!creator || creator.status !== 'ACTIVE') {
    throw new Error('Active authenticated employee required to stage actions.');
  }

  const resolvedPreview = input.preview || input.clientPreview || {};
  const hash = computeConfirmationHash(input.materialPayload);
  const actionId = `sa_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const expiresAt = new Date(Date.now() + STAGED_ACTION_TTL_MINUTES * 60 * 1000);

  const staged = await prisma.stagedAction.create({
    data: {
      id: actionId,
      userId: resolvedUserId,
      actionType: input.actionType,
      confirmationHash: hash,
      payload: JSON.stringify(input.materialPayload),
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
      expires_at: staged.expiresAt.toISOString(),
      payload_preview: resolvedPreview,
    },
  };
}

export interface ConfirmResult {
  ok: boolean;
  errorCode?: string;
  message?: string;
  record_type?: string;
  record_id?: string;
  url?: string;
  record?: any;
  notifications_sent?: string[];
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
    if (action.resultJson) {
      try {
        const cached = JSON.parse(action.resultJson);
        return { ok: true, ...cached };
      } catch {
        // continue
      }
    }
    return {
      ok: false,
      errorCode: 'ALREADY_EXECUTED',
      message: 'This staged action has already been executed.',
    };
  }

  if (action.status === 'CANCELLED') {
    return {
      ok: false,
      errorCode: 'CANCELLED',
      message: 'This staged action was previously discarded.',
    };
  }

  // 4. Expiry check
  if (new Date() > action.expiresAt) {
    return {
      ok: false,
      errorCode: 'STAGED_ACTION_EXPIRED',
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

  // 6. Execute business write atomically in transaction
  const auditEventId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  let resultRecord: any = null;
  let recordType = action.actionType;
  let recordId = '';
  let url = '';
  let notificationsSent: string[] = [];

  await prisma.$transaction(async (tx) => {
    if (action.actionType === 'budget') {
      const { budget_id, organization_id, period, total_amount, allocations, mode, currency } = materialPayload;
      const budgetMode = (mode || materialPayload.action || 'create').toLowerCase();

      let targetOrgId = organization_id;
      if (!targetOrgId && budget_id) {
        const existing = await tx.budget.findUnique({ where: { id: budget_id } });
        if (existing) targetOrgId = existing.organizationId;
      }
      if (!targetOrgId) {
        const defaultOrg = await tx.organization.findFirst({ select: { id: true } });
        targetOrgId = defaultOrg?.id;
      }

      let budget: any = null;

      if (budgetMode === 'delete' || budgetMode === 'archive' || budgetMode === 'remove') {
        const toDelete = budget_id
          ? await tx.budget.findUnique({ where: { id: budget_id } })
          : await tx.budget.findFirst({
              where: {
                organizationId: targetOrgId,
                periodName: { contains: period || '', mode: 'insensitive' },
                status: 'ACTIVE',
              },
            });

        if (toDelete) {
          budget = await tx.budget.update({
            where: { id: toDelete.id },
            data: { status: 'CLOSED' },
            include: { lines: true },
          });
        }
      } else if (budgetMode === 'reallocate' || budgetMode === 'update') {
        // Find existing budget
        const existing = budget_id
          ? await tx.budget.findUnique({ where: { id: budget_id } })
          : await tx.budget.findFirst({
              where: {
                organizationId: targetOrgId,
                periodName: { contains: period || '', mode: 'insensitive' },
                status: 'ACTIVE',
              },
              orderBy: { createdAt: 'desc' },
            });

        if (existing) {
          const updatedTotal = total_amount ? Number(total_amount) : existing.totalAmount;
          await tx.budget.update({
            where: { id: existing.id },
            data: {
              totalAmount: updatedTotal,
              status: 'ACTIVE',
            },
          });

          if (Array.isArray(allocations) && allocations.length > 0) {
            await tx.budgetLine.deleteMany({ where: { budgetId: existing.id } });
            await tx.budgetLine.createMany({
              data: allocations.map((line: any) => ({
                budgetId: existing.id,
                departmentName: line.department || line.departmentName || 'Operations',
                category: line.line_name || line.category || line.categoryName || 'General',
                allocatedAmount: Number(line.amount || line.allocatedAmount || 0),
                expenseType: line.expenseType || 'OPEX',
              })),
            });
          }

          budget = await tx.budget.findUnique({
            where: { id: existing.id },
            include: { lines: true },
          });
        }
      }

      if (!budget) {
        const existingOverlap = await tx.budget.findFirst({
          where: {
            organizationId: targetOrgId,
            periodName: { contains: period || '', mode: 'insensitive' },
            status: 'ACTIVE',
          },
        });

        if (existingOverlap && Array.isArray(allocations) && allocations.length > 0) {
          await tx.budget.update({
            where: { id: existingOverlap.id },
            data: { totalAmount: total_amount ? Number(total_amount) : existingOverlap.totalAmount },
          });
          await tx.budgetLine.deleteMany({ where: { budgetId: existingOverlap.id } });
          await tx.budgetLine.createMany({
            data: allocations.map((line: any) => ({
              budgetId: existingOverlap.id,
              departmentName: line.department || line.departmentName || 'Operations',
              category: line.line_name || line.category || line.categoryName || 'General',
              allocatedAmount: Number(line.amount || line.allocatedAmount || 0),
              expenseType: line.expenseType || 'OPEX',
            })),
          });
          budget = await tx.budget.findUnique({ where: { id: existingOverlap.id }, include: { lines: true } });
        } else {
          budget = await tx.budget.create({
            data: {
              organizationId: targetOrgId!,
              fiscalYear: new Date().getFullYear(),
              fiscalPeriod: period || 'MONTHLY',
              periodName: period || `Budget ${new Date().getFullYear()}`,
              totalAmount: Number(total_amount || 0),
              createdById: actor.id,
              status: 'ACTIVE',
              lines: {
                create: (allocations || []).map((line: any) => ({
                  departmentName: line.department || line.departmentName || 'Operations',
                  category: line.line_name || line.category || line.categoryName || 'General',
                  allocatedAmount: Number(line.amount || line.allocatedAmount || 0),
                  expenseType: line.expenseType || 'OPEX',
                })),
              },
            },
            include: { lines: true },
          });
        }
      }

      recordType = 'budget';
      recordId = budget.id;
      url = `/budgets`;
      resultRecord = JSON.parse(
        JSON.stringify(budget, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
    } else if (action.actionType === 'approval_decision') {
      const { request_id, decision, reason } = materialPayload;

      const req = await tx.expenditureRequest.findUnique({
        where: { id: request_id },
        include: { requester: true },
      });

      if (!req) throw new Error(`Request ${request_id} not found.`);

      const newStatus = decision === 'APPROVE' ? 'APPROVED' : decision === 'DECLINE' ? 'REJECTED' : 'REQUIRES_CLARIFICATION';

      const updatedReq = await tx.expenditureRequest.update({
        where: { id: request_id },
        data: {
          approvalStatus: newStatus,
        },
        include: { requester: true },
      });

      // Record approval step
      await tx.approvalStep.create({
        data: {
          requestId: req.id,
          stageIndex: 1,
          assignedRole: actor.role,
          approverId: actor.id,
          approverName: actor.legalName,
          status: newStatus,
          decisionReason: reason || `Executive decision via AI: ${decision}`,
          decidedAt: new Date(),
        },
      });

      if (req.requestedById) notificationsSent.push(req.requestedById);

      recordType = 'fund_request';
      recordId = updatedReq.requestNumber;
      url = `/requests/${updatedReq.requestNumber}`;
      resultRecord = JSON.parse(
        JSON.stringify(updatedReq, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
    } else if (action.actionType === 'payment_record') {
      const { request_id, amount, currency, payer_account_id, beneficiary_name, beneficiary_bank, beneficiary_account, transfer_reference, payment_date } = materialPayload;

      const req = await tx.expenditureRequest.findFirst({
        where: { OR: [{ id: request_id }, { requestNumber: request_id }] },
      });
      if (!req) throw new Error(`Request ${request_id} not found.`);

      const disbursement = await tx.disbursement.create({
        data: {
          requestId: req.id,
          payerOrgId: req.subsidiaryId,
          amountMinor: BigInt(Math.round(amount * 100)),
          currency: currency || req.currency || 'NGN',
          externalReference: transfer_reference || `TX-${Date.now()}`,
          bankName: 'Commercial Bank',
          beneficiaryName: beneficiary_name || 'Payee',
          beneficiaryBank: beneficiary_bank || 'Access Bank',
          beneficiaryAccount: beneficiary_account || '0000000000',
          recordedById: actor.id,
          status: 'AWAITING_RECIPIENT_CONFIRMATION',
          idempotencyKey: idempotencyKey || `disb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          paidAt: payment_date ? new Date(payment_date) : new Date(),
        },
      });

      await tx.expenditureRequest.update({
        where: { id: req.id },
        data: { paymentStatus: 'PAID' },
      });

      recordType = 'disbursement';
      recordId = disbursement.id;
      url = `/disbursements`;
      resultRecord = JSON.parse(
        JSON.stringify(disbursement, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
    } else if (action.actionType === 'salary_change') {
      const employee_id = materialPayload.employee_id;
      const amount = Number(materialPayload.amount ?? materialPayload.new_base_salary ?? 0);
      const effective_date = materialPayload.effective_date;
      const reason = materialPayload.reason;

      let agreement = await tx.employmentAgreement.findFirst({
        where: { employeeId: employee_id, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
      });

      if (!agreement) {
        agreement = await tx.employmentAgreement.findFirst({
          where: { employeeId: employee_id },
          orderBy: { startDate: 'desc' },
        });
      }

      if (!agreement) {
        const emp = await tx.employee.findUnique({
          where: { id: employee_id },
          include: { assignments: { orderBy: { isPrimary: 'desc' }, take: 1 } },
        });
        if (emp) {
          const orgId = emp.assignments[0]?.subsidiaryId || (await tx.organization.findFirst({ select: { id: true } }))?.id;
          if (orgId) {
            agreement = await tx.employmentAgreement.create({
              data: {
                employeeId: emp.id,
                employerEntityId: orgId,
                agreementType: 'PERMANENT',
                status: 'ACTIVE',
              },
            });
          }
        }
      }

      if (agreement) {
        // Find highest existing version
        const maxComp = await tx.compensationAgreement.findFirst({
          where: { employmentAgreementId: agreement.id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const nextVersion = (maxComp?.version || 1) + 1;

        await tx.compensationAgreement.create({
          data: {
            employmentAgreementId: agreement.id,
            version: nextVersion,
            grossMinor: BigInt(Math.round(amount * 100)),
            currency: 'NGN',
            effectiveFrom: effective_date ? new Date(effective_date) : new Date(),
            changeReason: reason || 'Executive AI salary modification',
            approvedBy: actor.id,
          },
        });
      }

      notificationsSent.push(employee_id);
      recordType = 'compensation';
      recordId = employee_id;
      url = `/payroll`;
      resultRecord = { employee_id, new_base_salary: amount, effective_date };
    } else if (action.actionType === 'staff_approval') {
      const { employee_id } = materialPayload;

      const emp = await tx.employee.findUnique({ where: { id: employee_id } });
      if (!emp) throw new Error(`Staff member ${employee_id} not found.`);

      const updated = await tx.employee.update({
        where: { id: employee_id },
        data: {
          approvalStatus: 'APPROVED',
          status: 'ACTIVE',
        },
      });

      notificationsSent.push(employee_id);
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

      const emp = await tx.employee.findUnique({ where: { id: employee_id } });
      if (!emp) throw new Error(`Staff member ${employee_id} not found.`);

      const updated = await tx.employee.update({
        where: { id: employee_id },
        data: { role: new_role },
      });

      notificationsSent.push(employee_id);
      recordType = 'employee';
      recordId = updated.employeeNumber;
      url = `/staff`;
      resultRecord = {
        employee_number: updated.employeeNumber,
        name: updated.legalName,
        prior_role: emp.role,
        new_role: updated.role,
        reason: reason || 'Executive role reassignment',
      };
    } else if (action.actionType === 'accountability_clearance') {
      const { case_id, request_number, clearance_notes } = materialPayload;

      const accCase = await tx.accountabilityCase.findFirst({
        where: { OR: [{ id: case_id }, { request: { requestNumber: request_number || case_id } }] },
        include: { request: true, owner: true },
      });

      if (!accCase) throw new Error(`Accountability case ${case_id} not found.`);

      const updated = await tx.accountabilityCase.update({
        where: { id: accCase.id },
        data: {
          status: 'CLOSED',
          closureNotes: clearance_notes || 'Receipts inspected and cleared by GMD via Executive AI',
        },
      });

      if (accCase.ownerUserId) notificationsSent.push(accCase.ownerUserId);
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
      const { case_id, extension_hours, reason } = materialPayload;

      const accCase = await tx.accountabilityCase.findUnique({ where: { id: case_id }, include: { request: true, owner: true } });
      if (!accCase) throw new Error(`Accountability case ${case_id} not found.`);

      const hours = Number(extension_hours) || 48;
      const newDueAt = new Date(accCase.dueAt.getTime() + hours * 3600 * 1000);

      const updated = await tx.accountabilityCase.update({
        where: { id: case_id },
        data: {
          dueAt: newDueAt,
          closureNotes: `${accCase.closureNotes ? accCase.closureNotes + '\n' : ''}GMD Granted +${hours}h extension: ${reason || 'Executive discretion'}`,
        },
      });

      if (accCase.ownerUserId) notificationsSent.push(accCase.ownerUserId);
      recordType = 'accountability_case';
      recordId = accCase.request?.requestNumber || accCase.id;
      url = `/accountability`;
      resultRecord = {
        case_id: updated.id,
        new_due_at: newDueAt.toISOString(),
        extension_hours: hours,
      };
    } else if (action.actionType === 'treasury_account') {
      const { bank_name, account_number, account_name, balance, subsidiary_id, mode } = materialPayload;
      const accountMode = (mode || materialPayload.action || 'upsert').toLowerCase();

      if (accountMode === 'deactivate' || accountMode === 'delete' || accountMode === 'archive') {
        const deactivated = await tx.companyBankAccount.update({
          where: { accountNumber: account_number },
          data: { status: 'INACTIVE' },
        });
        recordType = 'treasury_account';
        recordId = account_number;
        url = `/treasury`;
        resultRecord = { id: deactivated.id, accountNumber: account_number, status: 'INACTIVE' };
      } else {
        // Resolve valid organization ID
        let targetOrgId = subsidiary_id;
        if (!targetOrgId || targetOrgId === 'bems-group-hq' || targetOrgId === 'ALL') {
          const hqOrg = await tx.organization.findFirst({
            where: { code: { in: ['BEMS-HQ', 'BEMS-GROUP'] } },
          });
          targetOrgId = hqOrg?.id || (await tx.organization.findFirst())?.id;
        }

        const dbAccount = await tx.companyBankAccount.upsert({
          where: { accountNumber: account_number },
          update: {
            bankName: bank_name,
            accountName: account_name || 'BEMS Group Operations',
            balance: Number(balance) || 0,
            organizationId: targetOrgId!,
            status: 'ACTIVE',
          },
          create: {
            bankName: bank_name,
            accountName: account_name || 'BEMS Group Operations',
            accountNumber: account_number,
            balance: Number(balance) || 0,
            organizationId: targetOrgId!,
            currency: 'NGN',
            status: 'ACTIVE',
          },
          include: { organization: true },
        });

        recordType = 'treasury_account';
        recordId = account_number;
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
      const mode = (materialPayload.mode || materialPayload.action || (materialPayload.targetNoteIds ? 'SETTLE' : 'CREATE_NOTE')).toUpperCase();

      if (mode === 'SETTLE' || mode === 'STAGE_SETTLEMENT' || Array.isArray(materialPayload.targetNoteIds)) {
        const noteIds: string[] = materialPayload.targetNoteIds || materialPayload.noteIds || [];
        const settled = await reconcileIntercompanyNotes({
          noteIds,
          settlementReference: materialPayload.settlementReference || 'GMD_NETTING_SETTLEMENT',
          actor: { id: actor.id, legalName: actor.legalName, role: actor.role },
        });
        recordType = 'intercompany_settlement';
        recordId = noteIds[0] || 'SETTLEMENT';
        url = `/intercompany`;
        resultRecord = settled;
      } else {
        const sourceId = materialPayload.source_entity_id || materialPayload.sourceEntityId;
        const targetId = materialPayload.target_entity_id || materialPayload.targetEntityId;
        const amountNaira = Number(materialPayload.amount || (materialPayload.amountMinor ? Number(materialPayload.amountMinor) / 100 : 0));
        const amountMinor = materialPayload.amountMinor ? Number(materialPayload.amountMinor) : Math.round(amountNaira * 100);
        const description = materialPayload.description || 'Intercompany recharge note via Executive AI';

        const paired = await generateOperationalIntercompanyNotes({
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          amountMinor,
          currency: materialPayload.currency || 'NGN',
          description,
          actor: { id: actor.id, legalName: actor.legalName, role: actor.role },
        });

        recordType = 'intercompany_note';
        recordId = paired.debitNote.noteNumber;
        url = `/intercompany`;
        resultRecord = paired;
      }
    } else if (action.actionType === 'vendor_approval') {
      const mode = (materialPayload.mode || materialPayload.action || 'REGISTER').toUpperCase();

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
      } else {
        const { name, category, tin, taxId, bank_name, bankName, account_number, accountNumber, account_name, accountName, contact_person, contact_phone, contactPhone, contactEmail, notes, code: customCode } = materialPayload;

        const code = customCode || `VND-${Date.now().toString().slice(-6)}`;
        const vendor = await tx.vendor.create({
          data: {
            name,
            code,
            category: category || 'GENERAL',
            taxId: taxId || tin || 'PENDING_TIN',
            bankName: bankName || bank_name || 'Commercial Bank',
            accountNumber: accountNumber || account_number || '0000000000',
            accountName: accountName || account_name || contact_person || name,
            contactPhone: contactPhone || contact_phone || null,
            contactEmail: contactEmail || null,
            notes: notes || null,
            rating: 5,
          },
        });

        recordType = 'vendor';
        recordId = vendor.id;
        url = `/vendors`;
        resultRecord = vendor;
      }
    } else if (action.actionType === 'emergency_override') {
      const { request_id, justification } = materialPayload;

      const reqItem = await tx.expenditureRequest.findFirst({
        where: { OR: [{ id: request_id }, { requestNumber: request_id }] },
        include: { requester: true },
      });

      if (!reqItem) throw new Error(`Request ${request_id} not found.`);

      const updated = await tx.expenditureRequest.update({
        where: { id: reqItem.id },
        data: {
          approvalStatus: 'APPROVED',
        },
        include: { requester: true },
      });

      await tx.approvalStep.create({
        data: {
          requestId: reqItem.id,
          stageIndex: 99,
          assignedRole: 'GMD',
          approverId: actor.id,
          approverName: actor.legalName,
          status: 'APPROVED',
          decisionReason: `GMD EMERGENCY OVERRIDE: ${justification || 'Critical operational continuity'}`,
          decidedAt: new Date(),
        },
      });

      if (reqItem.requestedById) notificationsSent.push(reqItem.requestedById);
      recordType = 'fund_request';
      recordId = updated.requestNumber;
      url = `/requests/${updated.requestNumber}`;
      resultRecord = JSON.parse(
        JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
    } else if (action.actionType === 'attendance_override') {
      const subAction = (materialPayload.action_type || materialPayload.sub_action || 'EXCUSE_OVERRIDE').toUpperCase();

      if (
        subAction === 'UPDATE_POLICY' ||
        subAction === 'TOGGLE_STARLINK_LOCK' ||
        subAction === 'TOGGLE_GEOFENCE_LOCK' ||
        subAction === 'TOGGLE_POWER_OUTAGE'
      ) {
        const allOrgs = await tx.organization.findMany();
        const current =
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
            data: { radiusMeters: Number(materialPayload.radiusMeters) },
          });
        }

        await tx.attendancePolicy.updateMany({ data: updateData });
        for (const org of allOrgs) {
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

        recordType = 'attendance_policy';
        recordId = 'GROUP_ATTENDANCE_POLICY';
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
        const targetDate = materialPayload.work_date || new Date().toISOString().split('T')[0];
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
        const { employee_id, work_date, action_type, reason, override_status, deduction_percent } = materialPayload;
        const targetDate = work_date || new Date().toISOString().split('T')[0];
        const targetStatus = override_status || (action_type === 'EXCUSE' ? 'EXCUSED' : 'PRESENT');
        const deductionPercent = Number(deduction_percent ?? 0.0);

        const attendance = await tx.attendanceRecord.upsert({
          where: {
            employeeId_workDate: {
              employeeId: employee_id,
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
            deductionMinor: BigInt(0),
            excuseStatus: 'APPROVED',
            excuseRequestNote: reason,
          },
          create: {
            employeeId: employee_id,
            workDate: targetDate,
            status: targetStatus,
            checkInTime: new Date(),
            isManualOverride: true,
            overrideReason: reason || 'Executive GMD Attendance Adjustment',
            overrideById: actor.id,
            isDeductionApplied: deductionPercent > 0,
            deductionPercent,
            deductionMinor: BigInt(0),
            excuseStatus: 'APPROVED',
            excuseRequestNote: reason,
          },
          include: { employee: true },
        });

        notificationsSent.push(employee_id);
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
        if (!org) throw new Error('Target subsidiary not found.');

        const bankAccount = await tx.companyBankAccount.upsert({
          where: { accountNumber },
          update: {
            organizationId: org.id,
            bankName,
            accountName,
            accountType: accountType || 'Corporate Operational',
          },
          create: {
            organizationId: org.id,
            bankName,
            accountName,
            accountNumber,
            accountType: accountType || 'Corporate Operational',
            currency: org.defaultCurrency || 'NGN',
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
          notificationsSent.push(item.employeeId);
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

        if (subAction === 'TOGGLE_ATTENDANCE_EXEMPT') {
          const isExempt =
            materialPayload.isAttendanceExempt !== undefined
              ? Boolean(materialPayload.isAttendanceExempt)
              : !targetEmployee.isAttendanceExempt;
          const updated = await tx.employee.update({
            where: { id: employeeId },
            data: { isAttendanceExempt: isExempt },
          });
          notificationsSent.push(employeeId);
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
          notificationsSent.push(employeeId);
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

          notificationsSent.push(employeeId);
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

          notificationsSent.push(employeeId);
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

        notificationsSent.push(reqItem.requestedById);
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
        notificationsSent.push(updated.employeeId);
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

        notificationsSent.push(assigneeId);
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
        select: { id: true, legalName: true, workEmail: true },
      });
      if (!employee) throw new Error('Target staff member not found.');

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

      notificationsSent.push(targetEmployeeId);
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

    // Create Audit Event
    await tx.auditEvent.create({
      data: {
        id: auditEventId,
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: 'BEMS_GROUP_HOLDINGS',
        targetType: recordType.toUpperCase(),
        targetId: recordId,
        action: `AI_STAGED_${action.actionType.toUpperCase()}_EXECUTED`,
        correlationId: idempotencyKey || auditEventId,
        metadata: JSON.stringify({
          stagedActionId: actionId,
          correlationId: idempotencyKey,
          summary: action.summary,
        }),
      },
    });

    // Mark staged action executed
    await tx.stagedAction.update({
      where: { id: actionId },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
        idempotencyKey,
        auditEventId,
        resultJson: JSON.stringify({
          record_type: recordType,
          record_id: recordId,
          url,
          record: resultRecord,
          notifications_sent: notificationsSent,
          audit_event_id: auditEventId,
        }),
      },
    });
  });

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

  return {
    ok: true,
    record_type: recordType,
    record_id: recordId,
    url,
    record: resultRecord,
    notifications_sent: notificationsSent,
    audit_event_id: auditEventId,
  };
}
