import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './prisma';

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
  | 'emergency_override';

export interface StageActionInput {
  userId: string;
  actionType: StagedActionType;
  materialPayload: Record<string, any>;
  summary: string;
  preview: Record<string, any>;
  warnings?: string[];
  blockingErrors?: string[];
}

export async function stageAction(input: StageActionInput) {
  const hash = computeConfirmationHash(input.materialPayload);
  const actionId = `sa_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const expiresAt = new Date(Date.now() + STAGED_ACTION_TTL_MINUTES * 60 * 1000);

  const staged = await prisma.stagedAction.create({
    data: {
      id: actionId,
      userId: input.userId,
      actionType: input.actionType,
      confirmationHash: hash,
      payload: JSON.stringify(input.materialPayload),
      summary: input.summary,
      previewJson: JSON.stringify(input.preview),
      warnings: input.warnings ? JSON.stringify(input.warnings) : null,
      blockingErrors: input.blockingErrors ? JSON.stringify(input.blockingErrors) : null,
      status: 'PENDING',
      expiresAt,
    },
  });

  return {
    staged_action_id: staged.id,
    confirmation_hash: staged.confirmationHash,
    type: staged.actionType,
    expires_at: staged.expiresAt.toISOString(),
    summary: staged.summary,
    preview: input.preview,
    warnings: input.warnings || [],
    blocking_errors: input.blockingErrors || [],
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

  // 2. Ownership check
  if (action.userId !== actor.id) {
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
      const { organization_id, period, total_amount, allocations, currency } = materialPayload;
      
      const budget = await tx.budget.create({
        data: {
          organizationId: organization_id,
          period,
          totalAmountMinor: BigInt(Math.round(total_amount * 100)),
          currency: currency || 'NGN',
          createdById: actor.id,
          status: 'ACTIVE',
          lines: {
            create: (allocations || []).map((line: any) => ({
              categoryName: line.line_name || line.categoryName || 'General',
              allocatedAmountMinor: BigInt(Math.round((line.amount || 0) * 100)),
            })),
          },
        },
        include: { lines: true },
      });

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

      if (req.requesterId) notificationsSent.push(req.requesterId);

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
      const { employee_id, amount, effective_date, reason } = materialPayload;

      const agreement = await tx.employmentAgreement.findFirst({
        where: { employeeId: employee_id, status: 'ACTIVE' },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (agreement) {
        await tx.compensationAgreement.create({
          data: {
            agreementId: agreement.id,
            version: 2,
            baseGrossSalaryMinor: BigInt(Math.round(amount * 100)),
            effectiveFrom: effective_date ? new Date(effective_date) : new Date(),
            changeReason: reason || 'Executive AI salary modification',
            approvedById: actor.id,
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
          status: 'RECONCILED',
          evidenceNotes: clearance_notes || 'Receipts inspected and cleared by GMD via Executive AI',
        },
      });

      if (accCase.ownerId) notificationsSent.push(accCase.ownerId);
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
          evidenceNotes: `${accCase.evidenceNotes ? accCase.evidenceNotes + '\n' : ''}GMD Granted +${hours}h extension: ${reason || 'Executive discretion'}`,
        },
      });

      if (accCase.ownerId) notificationsSent.push(accCase.ownerId);
      recordType = 'accountability_case';
      recordId = accCase.request?.requestNumber || accCase.id;
      url = `/accountability`;
      resultRecord = {
        case_id: updated.id,
        new_due_at: newDueAt.toISOString(),
        extension_hours: hours,
      };
    } else if (action.actionType === 'treasury_account') {
      const { bank_name, account_number, account_name, balance, subsidiary_id, subsidiary_name } = materialPayload;

      const dataFilePath = path.join(process.cwd(), 'src', 'data', 'company-bank-accounts.json');
      let accounts: any[] = [];
      try {
        if (fs.existsSync(dataFilePath)) {
          accounts = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8')) || [];
        }
      } catch {
        accounts = [];
      }

      const existingIndex = accounts.findIndex(a => a.accountNumber === account_number);
      const newAccount = {
        id: `acc-${Date.now()}`,
        bankName: bank_name,
        accountNumber: account_number,
        accountName: account_name || 'BEMS Group Operations',
        balance: Number(balance) || 0,
        subsidiaryId: subsidiary_id || 'bems-group-hq',
        subsidiaryName: subsidiary_name || 'BEMS Group Holding HQ',
        currency: 'NGN',
        verified: true,
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        accounts[existingIndex] = { ...accounts[existingIndex], ...newAccount };
      } else {
        accounts.push(newAccount);
      }

      fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
      fs.writeFileSync(dataFilePath, JSON.stringify(accounts, null, 2));

      recordType = 'treasury_account';
      recordId = account_number;
      url = `/treasury`;
      resultRecord = newAccount;
    } else if (action.actionType === 'intercompany_note') {
      const { source_entity_id, target_entity_id, amount, note_type, description } = materialPayload;

      const noteNumber = `NOTE-${Date.now().toString().slice(-6)}`;
      const note = await tx.intercompanyNote.create({
        data: {
          noteNumber,
          sourceEntityId: source_entity_id,
          targetEntityId: target_entity_id,
          totalAmountMinor: BigInt(Math.round(amount * 100)),
          currency: 'NGN',
          noteType: note_type || 'DEBIT_NOTE',
          description: description || 'Intercompany recharge note via Executive AI',
          status: 'ISSUED',
        },
        include: { sourceEntity: true, targetEntity: true },
      });

      recordType = 'intercompany_note';
      recordId = note.noteNumber;
      url = `/intercompany`;
      resultRecord = JSON.parse(
        JSON.stringify(note, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
    } else if (action.actionType === 'vendor_approval') {
      const { name, category, tin, bank_name, account_number, contact_person, contact_phone } = materialPayload;

      const code = `VND-${Date.now().toString().slice(-6)}`;
      const vendor = await tx.vendor.create({
        data: {
          name,
          code,
          category: category || 'GENERAL',
          taxId: tin || 'PENDING_TIN',
          bankName: bank_name || 'Commercial Bank',
          accountNumber: account_number || '0000000000',
          accountName: contact_person || name,
          contactPhone: contact_phone || null,
          rating: 5,
        },
      });

      recordType = 'vendor';
      recordId = vendor.id;
      url = `/vendors`;
      resultRecord = vendor;
    } else if (action.actionType === 'emergency_override') {
      const { request_id, justification, amount } = materialPayload;

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

      if (reqItem.requesterId) notificationsSent.push(reqItem.requesterId);
      recordType = 'fund_request';
      recordId = updated.requestNumber;
      url = `/requests/${updated.requestNumber}`;
      resultRecord = JSON.parse(
        JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
      );
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
        targetType: recordType.toUpperCase(),
        targetId: recordId,
        action: `AI_STAGED_${action.actionType.toUpperCase()}_EXECUTED`,
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
