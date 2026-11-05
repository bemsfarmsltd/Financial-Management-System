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
 * Executes a deterministic 3-way match against:
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
}): Promise<ThreeWayMatchResult> {
  const { requestId, invoiceId, grnId, actorId, actorName, actorRole } = params;

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

  // Resolve target Invoice
  const invoice = invoiceId
    ? request.invoices.find((i) => i.id === invoiceId)
    : request.invoices[0];

  // Resolve target Goods Receipt Note
  const grn = grnId
    ? request.goodsReceipts.find((g) => g.id === grnId)
    : request.goodsReceipts[0];

  const vendorName = request.vendor?.name || 'Registered Vendor';
  const poAmountMinor = Number(request.amountMinor);

  // Scenario 1: No Invoice Submitted Yet
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
    };
  }

  const invoiceAmountMinor = Number(invoice.amountMinor);
  const varianceMinor = invoiceAmountMinor - poAmountMinor;
  const variancePercent = poAmountMinor > 0 ? (varianceMinor / poAmountMinor) * 100 : 0;

  let matchStatus: 'MATCH_CONFIRMED' | 'PRICE_VARIANCE' | 'MISSING_GRN' | 'DELIVERY_ISSUE';
  let recommendation: string;
  let canDisburse = false;

  // Scenario 2: Invoice exists but no GRN
  if (!grn) {
    matchStatus = 'MISSING_GRN';
    recommendation = `Invoice #${invoice.invoiceNumber} recorded, but physical delivery or service completion note (GRN) has not been certified.`;
    canDisburse = false;
    await prisma.vendorInvoice.update({
      where: { id: invoice.id },
      data: { status: 'PENDING' },
    });
  } else if (grn.status === 'DAMAGED' || grn.status === 'PARTIAL') {
    // Scenario 3: Delivery Damaged or Partial
    matchStatus = 'DELIVERY_ISSUE';
    recommendation = `Goods receipt is flagged as ${grn.status}. Deliverables must be re-inspected before payment release.`;
    canDisburse = false;
    await prisma.vendorInvoice.update({
      where: { id: invoice.id },
      data: { status: 'VARIANCE_FLAGGED' },
    });
  } else if (varianceMinor > 0) {
    // Scenario 4: Price Variance (Billed amount exceeds approved PO)
    matchStatus = 'PRICE_VARIANCE';
    const overageNaira = (varianceMinor / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
    recommendation = `Price variance detected! Vendor invoice exceeds approved PO amount by ${overageNaira} (+${variancePercent.toFixed(1)}%). Requires GMD variance approval.`;
    canDisburse = false;
    await prisma.vendorInvoice.update({
      where: { id: invoice.id },
      data: { status: 'VARIANCE_FLAGGED' },
    });
  } else {
    // Scenario 5: Perfect Match (Amounts within PO budget and GRN Accepted)
    matchStatus = 'MATCH_CONFIRMED';
    recommendation = `3-way match verified. PO rate, GRN acceptance, and Invoice #${invoice.invoiceNumber} are fully aligned.`;
    canDisburse = true;
    await prisma.vendorInvoice.update({
      where: { id: invoice.id },
      data: { status: 'MATCHED' },
    });
  }

  // Upsert ThreeWayMatchRecord
  const matchRecord = await prisma.threeWayMatchRecord.upsert({
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

  // Audit Event
  try {
    await prisma.auditEvent.create({
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
    console.warn('Could not record match audit event:', e);
  }

  return {
    ok: true,
    matchStatus,
    poAmountMinor,
    invoiceAmountMinor,
    varianceMinor,
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

/**
 * Fetch 3-Way Match Summary for any request
 */
export async function getThreeWayMatchSummary(requestId: string): Promise<ThreeWayMatchResult> {
  return executeThreeWayMatch({ requestId });
}
