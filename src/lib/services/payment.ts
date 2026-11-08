import { walletEnabled, WalletError } from '@/lib/wallet/core';
import { payrollSnapshotHash } from './payroll-snapshot';
import { accountabilityDeadline } from './accountability-deadline';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { computeThreeWayMatchFromLoadedRequest } from './three-way-match';
import { generatePayrollIntercompanyNotes } from './intercompany';

export interface TransferInput {
  requestId?: string;
  payrollItemId?: string;
  payerAccountId?: string;
  payerOrgId?: string;
  bankName?: string;
  amountMinor: bigint;
  reference: string;
  beneficiaryName?: string;
  beneficiaryBank?: string;
  beneficiaryAccount?: string;
  receipt: { name: string; type: string; bytes: Buffer };
  actor: { id: string; legalName: string; role: string };
  idempotencyKey: string;
}

export async function recordTransfer(tx: Prisma.TransactionClient, input: TransferInput) {
  const { actor, receipt } = input;
  if (walletEnabled()) throw new WalletError('LEGACY_PAYMENT_DISABLED', 'External payment recording is disabled in wallet mode. Use the GMD wallet release flow.', 409);
  if (!['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role)) throw new Error('Executive authority is required.');
  if (input.amountMinor <= BigInt(0) || !input.reference.trim()) throw new Error('A positive amount and bank transfer reference are required.');
  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(receipt.type) || !receipt.bytes.length || receipt.bytes.length > 10 * 1024 * 1024) {
    throw new Error('Upload the actual bank receipt as PDF, PNG, JPEG or WebP, up to 10 MB.');
  }
  const receiptHash = createHash('sha256').update(receipt.bytes).digest('hex');
  // Every entry point takes these locks in the same order. The reference and
  // document checks remain safe while a concurrent transfer is being recorded.
  const resources = ['reference:' + input.reference, 'receipt:' + receiptHash, 'target:' + (input.requestId || input.payrollItemId)].sort();
  for (const resource of resources) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${resource}, 0))`;
  }
  if (await tx.disbursement.findFirst({ where: { externalReference: input.reference } })) throw new Error('This transfer reference is already recorded.');
  if (await tx.paymentReceipt.findFirst({ where: { sha256: receiptHash } })) throw new Error('This bank receipt is already recorded.');

  const request = input.requestId ? await tx.expenditureRequest.findFirst({
    where: { OR: [{ id: input.requestId }, { requestNumber: input.requestId }] },
    include: { requester: true, vendor: true, invoices: { orderBy: { createdAt: 'desc' } }, goodsReceipts: { orderBy: { receivedAt: 'desc' } } },
  }) : null;
  const payroll = input.payrollItemId ? await tx.payrollItem.findUnique({ where: { id: input.payrollItemId }, include: { employee: true, batch: true } }) : null;
  if (!request && !payroll) throw new Error('Payment target was not found.');
  if (request && request.approvalStatus !== 'APPROVED') throw new Error('Only an approved request can be paid.');
  if (payroll && payroll.batch.status !== 'APPROVED') throw new Error('Only approved payroll can be paid.');
  if (payroll) {
    const items = await tx.payrollItem.findMany({ where: { batchId: payroll.batchId }, include: { allocations: true } });
    if (!payroll.batch.snapshotHash || payroll.batch.snapshotHash !== payrollSnapshotHash(items)) throw new Error('Payroll changed after sign-off. Obtain a fresh approval before recording payment.');
  }
  const assignee = request?.disbursementAssigneeId || payroll?.batch.disbursementAssigneeId;
  if (assignee && assignee !== actor.id) throw new Error('This payment is assigned to another executive.');
  if (request && input.amountMinor !== request.amountMinor) throw new Error('The recorded amount must equal the approved amount.');
  if (payroll && input.amountMinor !== payroll.netMinor) throw new Error('The recorded amount must equal the approved net salary.');
  if (request?.vendorId && !computeThreeWayMatchFromLoadedRequest(request).summary.canDisburse) throw new Error('Vendor invoice and goods receipt must pass three-way matching before payment.');
  if (await tx.disbursement.findFirst({ where: request ? { requestId: request.id } : { payrollItemId: payroll!.id } })) {
    throw new Error('A payment already exists for this target. Resolve its status instead of recording a second transfer.');
  }
  const payerOrgId = input.payerOrgId || payroll?.batch.paymentEntityId;
  const suppliedBank = (input.bankName || '').trim();
  const accountNumber = suppliedBank.match(/\((\d{10})\)$/)?.[1];
  const accounts = await tx.companyBankAccount.findMany({ where: {
    status: 'ACTIVE',
    ...(input.payerAccountId ? { id: input.payerAccountId } : {
      ...(payerOrgId ? { organizationId: payerOrgId } : { id: '__missing_payer__' }),
      ...(accountNumber ? { accountNumber } : { bankName: { equals: suppliedBank, mode: 'insensitive' as const } }),
    }),
  }, take: 2 });
  if (accounts.length !== 1) throw new Error('Select one exact active corporate bank account.');
  const bank = accounts[0];
  if (payerOrgId && bank.organizationId !== payerOrgId) throw new Error('The selected bank account belongs to another paying entity.');
  if (bank.currency !== (request?.currency || payroll!.currency)) throw new Error('Payer and payment currency must match.');
  const employee = request?.requester || payroll!.employee;
  const beneficiary = request?.vendor || employee;
  const name = input.beneficiaryName?.trim() || ('name' in beneficiary ? beneficiary.accountName || beneficiary.name : beneficiary.accountName || beneficiary.legalName);
  const beneficiaryBank = input.beneficiaryBank?.trim() || ('salaryBankName' in beneficiary ? beneficiary.salaryBankName || beneficiary.bankName : beneficiary.bankName) || '';
  const account = (input.beneficiaryAccount || ('salaryAccountNumber' in beneficiary ? beneficiary.salaryAccountNumber || beneficiary.accountNumber : beneficiary.accountNumber) || '').replace(/\D/g, '');
  if (!name || !beneficiaryBank || !/^\d{10}$/.test(account) || account === '0000000000') throw new Error('Verified beneficiary account details are required.');
  const expectedAccount = ('salaryAccountNumber' in beneficiary && payroll ? beneficiary.salaryAccountNumber || beneficiary.accountNumber : beneficiary.accountNumber) || '';
  if (expectedAccount && expectedAccount !== account) throw new Error('Beneficiary account changed. Update and verify the beneficiary before recording payment.');
  const amount = new Prisma.Decimal(input.amountMinor.toString()).dividedBy(100);
  const debit = await tx.companyBankAccount.updateMany({ where: { id: bank.id, status: 'ACTIVE', balance: { gte: amount } }, data: { balance: { decrement: amount } } });
  if (debit.count !== 1) throw new Error('Treasury balance is insufficient. Reconcile the bank account before recording this transfer.');
  const payment = await tx.disbursement.create({ data: {
    requestId: request?.id, payrollItemId: payroll?.id, beneficiaryEmployeeId: payroll?.employeeId,
    payerOrgId: bank.organizationId, amountMinor: input.amountMinor, currency: bank.currency,
    externalReference: input.reference, bankName: bank.bankName, beneficiaryName: name, beneficiaryBank, beneficiaryAccount: account,
    recordedById: actor.id, status: 'AWAITING_RECIPIENT_CONFIRMATION', idempotencyKey: input.idempotencyKey,
  } });
  const receiptId = randomUUID();
  await tx.paymentReceipt.create({ data: { id: receiptId, disbursementId: payment.id, fileName: receipt.name.replace(/[\\/\r\n"]/g, '_').slice(0, 180), fileUrl: '/api/receipts/' + receiptId, sha256: receiptHash, mimeType: receipt.type, fileData: new Uint8Array(receipt.bytes), uploadedById: actor.id } });
  if (request) {
    await tx.expenditureRequest.update({ where: { id: request.id }, data: { paymentStatus: 'AWAITING_RECIPIENT_CONFIRMATION', requestVersion: { increment: 1 } } });
    const dueAt = await accountabilityDeadline(request.subsidiaryId, request.requestType === 'EMERGENCY', payment.paidAt, tx);
    await tx.accountabilityCase.upsert({ where: { requestId: request.id }, update: {}, create: { requestId: request.id, ownerUserId: request.requestedById, requiredDeliverables: request.deliverable, dueAt } });
  }
  if (payroll) await generatePayrollIntercompanyNotes({ payrollItemId: payroll.id, payingEntityId: bank.organizationId, periodId: payroll.batch.periodId, actor }, tx);
  await tx.systemNotification.create({ data: { employeeId: employee.id, kind: 'PAYMENT_CONFIRMATION_REQUIRED', title: 'Confirm payment received', body: 'Review the recorded bank transfer and confirm whether the funds reached your account.', linkUrl: request ? '/requests/' + request.requestNumber : '/payroll' } });
  const org = await tx.organization.findUnique({ where: { id: bank.organizationId }, select: { parentGroupId: true } });
  await tx.auditEvent.create({ data: { actorId: actor.id, actorName: actor.legalName, actorRole: actor.role, groupId: org?.parentGroupId || bank.organizationId, subsidiaryId: request?.subsidiaryId || bank.organizationId, targetType: 'DISBURSEMENT', targetId: payment.id, action: 'PAYMENT_RECORDED', correlationId: input.idempotencyKey, metadata: JSON.stringify({ payerAccountId: bank.id, amountMinor: input.amountMinor.toString(), reference: input.reference, receiptHash }) } });
  return payment;
}
