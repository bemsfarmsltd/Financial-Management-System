import { prisma } from "@/lib/prisma";

export interface MatchResult {
  status: "MATCH_CONFIRMED" | "PRICE_VARIANCE" | "MISSING_GRN" | "QUANTITY_MISMATCH";
  poAmountMinor: bigint;
  invoiceAmountMinor: bigint;
  varianceMinor: bigint;
  variancePercentage: number;
  hasGrn: boolean;
  message: string;
}

/**
 * Executes a 3-way match verification between:
 * 1. Expenditure Request / Purchase Order
 * 2. Vendor Invoice
 * 3. Goods Receipt Note (GRN) / Delivery Waybill
 */
export async function executeThreeWayMatch(params: {
  requestId: string;
  invoiceId: string;
  grnId?: string | null;
  tolerancePercentage?: number;
}): Promise<MatchResult> {
  const { requestId, invoiceId, grnId, tolerancePercentage = 0.0 } = params;

  const [request, invoice, grn] = await Promise.all([
    prisma.expenditureRequest.findUnique({
      where: { id: requestId },
      include: { vendor: true },
    }),
    prisma.vendorInvoice.findUnique({
      where: { id: invoiceId },
    }),
    grnId
      ? prisma.goodsReceiptNote.findUnique({
          where: { id: grnId },
        })
      : prisma.goodsReceiptNote.findFirst({
          where: { requestId },
        }),
  ]);

  if (!request) {
    throw new Error(`Expenditure request ${requestId} not found`);
  }
  if (!invoice) {
    throw new Error(`Vendor invoice ${invoiceId} not found`);
  }

  const poAmount = request.amountMinor;
  const invoiceAmount = invoice.amountMinor;
  const variance = invoiceAmount - poAmount;
  const variancePercentage = poAmount > BigInt(0)
    ? (Number(variance) / Number(poAmount)) * 100
    : 0;

  const hasGrn = !!grn && grn.status === "ACCEPTED";

  let status: MatchResult["status"] = "MATCH_CONFIRMED";
  let message = "3-way match confirmed: PO amount, invoice, and goods receipt verified.";

  if (variancePercentage > tolerancePercentage) {
    status = "PRICE_VARIANCE";
    message = `Price variance detected: Invoice exceeds PO by ₦${(Number(variance) / 100).toLocaleString()} (${variancePercentage.toFixed(1)}%).`;
  } else if (!hasGrn) {
    status = "MISSING_GRN";
    message = "Delivery pending: Goods receipt note or signed waybill has not yet been registered.";
  }

  // Persist or update the match record in the database
  await prisma.threeWayMatchRecord.upsert({
    where: { requestId },
    create: {
      requestId,
      invoiceId,
      grnId: grn?.id || null,
      poAmountMinor: poAmount,
      invoiceAmountMinor: invoiceAmount,
      varianceMinor: variance,
      status,
    },
    update: {
      invoiceId,
      grnId: grn?.id || null,
      poAmountMinor: poAmount,
      invoiceAmountMinor: invoiceAmount,
      varianceMinor: variance,
      status,
      matchedAt: new Date(),
    },
  });

  // Update invoice status accordingly
  await prisma.vendorInvoice.update({
    where: { id: invoiceId },
    data: {
      status: status === "MATCH_CONFIRMED" ? "MATCHED" : status === "PRICE_VARIANCE" ? "VARIANCE_FLAGGED" : "PENDING",
    },
  });

  return {
    status,
    poAmountMinor: poAmount,
    invoiceAmountMinor: invoiceAmount,
    varianceMinor: variance,
    variancePercentage,
    hasGrn,
    message,
  };
}
