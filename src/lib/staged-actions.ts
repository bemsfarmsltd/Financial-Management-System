import crypto from 'node:crypto';
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
  | 'payment_recorder';

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
          requestId: request_id,
          stepOrder: 1,
          approverRole: actor.role,
          approverId: actor.id,
          status: newStatus,
          notes: reason || `Executive decision via AI: ${decision}`,
          actedAt: new Date(),
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

      const req = await tx.expenditureRequest.findUnique({ where: { id: request_id } });
      if (!req) throw new Error(`Request ${request_id} not found.`);

      const disbursement = await tx.disbursement.create({
        data: {
          requestId: request_id,
          organizationId: req.organizationId,
          totalAmountMinor: BigInt(Math.round(amount * 100)),
          currency: currency || req.currency || 'NGN',
          paymentReference: transfer_reference || `TX-${Date.now()}`,
          recordedById: actor.id,
          status: 'COMPLETED',
          executedAt: payment_date ? new Date(payment_date) : new Date(),
        },
      });

      await tx.expenditureRequest.update({
        where: { id: request_id },
        data: { approvalStatus: 'DISBURSED' },
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
