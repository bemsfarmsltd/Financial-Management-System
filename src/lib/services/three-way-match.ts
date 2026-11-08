import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface ThreeWayMatchResult {
  ok: boolean;
  matchStatus: 'MATCH_CONFIRMED' | 'PRICE_VARIANCE' | 'MISSING_GRN' | 'AWAITING_INVOICE' | 'DELIVERY_ISSUE';
  poAmountMinor?: number;
  invoiceAmountMinor?: number;
  varianceMinor?: number;
  summary: {
    requestId: string;
    requestNumber: string;
    vendorName: string;
    poAmountMinor: number;
    invoiceAmountMinor: number;
    varianceMinor: number;
    variancePercent: number;
    invoiceNumber: string | null;
    grnNumber: string | null;
    grnStatus: string | null;
    canDisburse: boolean;
    recommendation: string;
  };
  record?: any;
}

/**
 * Pure, side-effect-free computation of 3-Way Match status from loaded request relations.
 * Never mutates VendorInvoice, ThreeWayMatchRecord, or AuditEvent.
 */
export function computeThreeWayMatchFromLoadedRequest(
  request: {
    id: string;
    requestNumber: string;
    amountMinor: bigint | number;
    vendor?: { name: string } | null;
    invoices: Array<{ id: string; invoiceNumber: string; amountMinor: bigint | number }>;
    goodsReceipts: Array<{ id: string; grnNumber: string; status: string }>;
    threeWayMatch?: {
      id: string;
      status: string;
      poAmountMinor: bigint | number;
      invoiceAmountMinor: bigint | number;
      varianceMinor: bigint | number;
      matchedAt: Date;
    } | null;
  },
  options?: { invoiceId?: string; grnId?: string | null }
): ThreeWayMatchResult & {
  targetInvoice?: { id: string; invoiceNumber: string; amountMinor: bigint | number };
  targetGrn?: { id: string; grnNumber: string; status: string };
  targetInvoiceStatus?: 'PENDING' | 'VARIANCE_FLAGGED' | 'MATCHED';
} {
  const invoice = options?.invoiceId
    ? request.invoices.find((i) => i.id === options.invoiceId)
    : request.invoices[0];

  const grn = options?.grnId
    ? request.goodsReceipts.find((g) => g.id === options.grnId)
    : request.goodsReceipts[0];

  const vendorName = request.vendor?.name || 'Registered Vendor';
  const poAmountMinor = Number(request.amountMinor);

  if (!invoice) {
    return {
      ok: true,
      matchStatus: 'AWAITING_INVOICE',
      poAmountMinor,
      invoiceAmountMinor: 0,
      varianceMinor: 0,
      summary: {
        requestId: request.id,
        requestNumber: request.requestNumber,
        vendorName,
        poAmountMinor,
        invoiceAmountMinor: 0,
        varianceMinor: 0,
        variancePercent: 0,
        invoiceNumber: null,
        grnNumber: grn?.grnNumber || null,
        grnStatus: grn?.status || null,
        canDisburse: false,
        recommendation: 'Awaiting vendor invoice upload before 3-way match verification can execute.',
      },
      record: request.threeWayMatch
        ? {
            id: request.threeWayMatch.id,
            status: request.threeWayMatch.status,
            poAmountMinor: Number(request.threeWayMatch.poAmountMinor),
            invoiceAmountMinor: Number(request.threeWayMatch.invoiceAmountMinor),
            varianceMinor: Number(request.threeWayMatch.varianceMinor),
            matchedAt: request.threeWayMatch.matchedAt.toISOString(),
          }
        : undefined,
    };
  }

  const invoiceAmountMinor = Number(invoice.amountMinor);
  const varianceMinor = invoiceAmountMinor - poAmountMinor;
  const variancePercent = poAmountMinor > 0 ? (varianceMinor / poAmountMinor) * 100 : 0;

  let matchStatus: 'MATCH_CONFIRMED' | 'PRICE_VARIANCE' | 'MISSING_GRN' | 'DELIVERY_ISSUE';
  let targetInvoiceStatus: 'PENDING' | 'VARIANCE_FLAGGED' | 'MATCHED';
  let recommendation: string;
  let canDisburse = false;

  if (!grn) {
    matchStatus = 'MISSING_GRN';
    targetInvoiceStatus = 'PENDING';
    recommendation = `Invoice #${invoice.invoiceNumber} recorded, but physical delivery or service completion note (GRN) has not been certified.`;
    canDisburse = false;
  } else if (grn.status === 'DAMAGED' || grn.status === 'PARTIAL') {
    matchStatus = 'DELIVERY_ISSUE';
    targetInvoiceStatus = 'VARIANCE_FLAGGED';
    recommendation = `Goods receipt is flagged as ${grn.status}. Deliverables must be re-inspected before payment release.`;
    canDisburse = false;
  } else if (varianceMinor > 0) {
    matchStatus = 'PRICE_VARIANCE';
    targetInvoiceStatus = 'VARIANCE_FLAGGED';
    const overageNaira = (varianceMinor / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
    recommendation = `Price variance detected! Vendor invoice exceeds approved PO amount by ${overageNaira} (+${variancePercent.toFixed(1)}%). Requires GMD variance approval.`;
    canDisburse = false;
  } else {
    matchStatus = 'MATCH_CONFIRMED';
    targetInvoiceStatus = 'MATCHED';
    recommendation = `3-way match verified. PO rate, GRN acceptance, and Invoice #${invoice.invoiceNumber} are fully aligned.`;
    canDisburse = true;
  }

  return {
    ok: true,
    matchStatus,
    poAmountMinor,
    invoiceAmountMinor,
    varianceMinor,
    targetInvoice: invoice,
    targetGrn: grn,
    targetInvoiceStatus,
    summary: {
      requestId: request.id,
      requestNumber: request.requestNumber,
      vendorName,
      poAmountMinor,
      invoiceAmountMinor,
      varianceMinor,
      variancePercent: Number(variancePercent.toFixed(2)),
      invoiceNumber: invoice.invoiceNumber,
      grnNumber: grn?.grnNumber || null,
      grnStatus: grn?.status || null,
      canDisburse,
      recommendation,
    },
    record: request.threeWayMatch
      ? {
          id: request.threeWayMatch.id,
          status: request.threeWayMatch.status,
          poAmountMinor: Number(request.threeWayMatch.poAmountMinor),
          invoiceAmountMinor: Number(request.threeWayMatch.invoiceAmountMinor),
          varianceMinor: Number(request.threeWayMatch.varianceMinor),
          matchedAt: request.threeWayMatch.matchedAt.toISOString(),
        }
      : undefined,
  };
}

/**
 * Pure read-only 3-Way Match Summary lookup.
 * Never mutates VendorInvoice, ThreeWayMatchRecord, or AuditEvent.
 */
export async function getThreeWayMatchSummary(requestId: string): Promise<ThreeWayMatchResult> {
  const request = await prisma.expenditureRequest.findUnique({
    where: { id: requestId },
    include: {
      vendor: true,
      invoices: { orderBy: { createdAt: 'desc' } },
      goodsReceipts: { orderBy: { receivedAt: 'desc' } },
      threeWayMatch: true,
    },
  });

  if (!request) {
    throw new Error(`Expenditure request not found: ${requestId}`);
  }

  const computed = computeThreeWayMatchFromLoadedRequest(request);
  return {
    ok: computed.ok,
    matchStatus: computed.matchStatus,
    poAmountMinor: computed.poAmountMinor,
    invoiceAmountMinor: computed.invoiceAmountMinor,
    varianceMinor: computed.varianceMinor,
    summary: computed.summary,
    record: computed.record,
  };
}

/**
 * Executes and persists a deterministic 3-way match against:
 * 1. Purchase Order (ExpenditureRequest.amountMinor)
 * 2. Vendor Invoice (VendorInvoice.amountMinor)
 * 3. Goods Receipt Note (GoodsReceiptNote.status: ACCEPTED)
 */
export async function executeThreeWayMatch(params: {
  requestId: string;
  invoiceId?: string;
  grnId?: string | null;
  tolerancePercentage?: number;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}, client?: Prisma.TransactionClient): Promise<ThreeWayMatchResult> {
  if (!client) return prisma.$transaction(tx => executeThreeWayMatch(params, tx), { isolationLevel: 'Serializable' });
  const db = client;
  const { requestId, invoiceId, grnId, actorId, actorName, actorRole } = params;

  const request = await db.expenditureRequest.findUnique({
    where: { id: requestId },
    include: {
      vendor: true,
      invoices: { orderBy: { createdAt: 'desc' } },
      goodsReceipts: { orderBy: { receivedAt: 'desc' } },
      threeWayMatch: true,
    },
  });

  if (!request) {
    throw new Error(`Expenditure request not found: ${requestId}`);
  }

  const computed = computeThreeWayMatchFromLoadedRequest(request, { invoiceId, grnId });
  if (!computed.targetInvoice || !computed.targetInvoiceStatus) {
    return computed;
  }

  const invoice = computed.targetInvoice;
  const grn = computed.targetGrn;
  const matchStatus = computed.matchStatus;
  const poAmountMinor = computed.poAmountMinor ?? 0;
  const invoiceAmountMinor = computed.invoiceAmountMinor ?? 0;
  const varianceMinor = computed.varianceMinor ?? 0;

  await db.vendorInvoice.update({
    where: { id: invoice.id },
    data: { status: computed.targetInvoiceStatus },
  });

  const matchRecord = await db.threeWayMatchRecord.upsert({
    where: { requestId: request.id },
    create: {
      requestId: request.id,
      invoiceId: invoice.id,
      grnId: grn?.id || null,
      poAmountMinor: BigInt(poAmountMinor),
      invoiceAmountMinor: BigInt(invoiceAmountMinor),
      varianceMinor: BigInt(varianceMinor),
      status: matchStatus,
    },
    update: {
      invoiceId: invoice.id,
      grnId: grn?.id || null,
      poAmountMinor: BigInt(poAmountMinor),
      invoiceAmountMinor: BigInt(invoiceAmountMinor),
      varianceMinor: BigInt(varianceMinor),
      status: matchStatus,
      matchedAt: new Date(),
    },
  });

  try {
    await db.auditEvent.create({
      data: {
        actorId: actorId || null,
        actorName: actorName || '3-Way Match Verification Engine',
        actorRole: actorRole || 'SYSTEM_ADMIN',
        groupId: request.groupId,
        subsidiaryId: request.subsidiaryId,
        targetType: 'DISBURSEMENT',
        targetId: request.id,
        action: matchStatus === 'MATCH_CONFIRMED' ? 'VERIFIED' : 'CLARIFICATION_REQUESTED',
        correlationId: `match_${request.id}_${Date.now()}`,
        metadata: JSON.stringify({
          matchStatus,
          requestNumber: request.requestNumber,
          poAmountMinor,
          invoiceAmountMinor,
          varianceMinor,
          invoiceNumber: invoice.invoiceNumber,
          grnNumber: grn?.grnNumber,
        }),
      },
    });
  } catch (e) {
    throw e;
  }

  return {
    ok: true,
    matchStatus,
    poAmountMinor,
    invoiceAmountMinor,
    varianceMinor,
    summary: computed.summary,
    record: {
      id: matchRecord.id,
      status: matchRecord.status,
      poAmountMinor: Number(matchRecord.poAmountMinor),
      invoiceAmountMinor: Number(matchRecord.invoiceAmountMinor),
      varianceMinor: Number(matchRecord.varianceMinor),
      matchedAt: matchRecord.matchedAt.toISOString(),
    },
  };
}
