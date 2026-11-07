import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";
import { executeThreeWayMatch } from "@/lib/services/three-way-match";
import { resolveAuthorizedOrganizationScope } from "@/lib/organizations";
import { buildDatedRequestPrefix } from "@/lib/request-number";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: "Sign in to inspect matching." }, { status: 401 });

    const isExecutive = hasAnyRole(actor, ["SYSTEM_ADMIN", "SUPER_ADMIN", "GMD"]);
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");
    const subsidiaryId = searchParams.get("subsidiaryId") || searchParams.get("subsidiary") || "ALL";
    const scope = await resolveAuthorizedOrganizationScope(actor, subsidiaryId);

    if (!requestId) {
      // Return scoped match records
      const matches = await prisma.threeWayMatchRecord.findMany({
        where: {
          request: {
            ...(!scope.isGroup ? { subsidiaryId: { in: scope.organizationIds } } : {}),
            ...(!isExecutive ? { requestedById: actor.id } : {}),
          },
        },
        include: {
          request: {
            select: {
              id: true,
              requestNumber: true,
              title: true,
              amountMinor: true,
              vendor: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  category: true,
                  ...(isExecutive
                    ? { taxId: true, bankName: true, accountNumber: true, accountName: true }
                    : {}),
                },
              },
            },
          },
          invoice: true,
          grn: true,
        },
        orderBy: { matchedAt: "desc" },
      });

      const safeMatches = JSON.parse(
        JSON.stringify(matches, (_, v) => (typeof v === "bigint" ? Number(v) : v))
      );
      return NextResponse.json({ matches: safeMatches });
    }

    const match = await prisma.threeWayMatchRecord.findUnique({
      where: { requestId },
      include: {
        request: {
          select: {
            id: true,
            requestNumber: true,
            title: true,
            amountMinor: true,
            requestedById: true,
            subsidiaryId: true,
            vendor: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
                ...(isExecutive
                  ? { taxId: true, bankName: true, accountNumber: true, accountName: true }
                  : {}),
              },
            },
          },
        },
        invoice: true,
        grn: true,
      },
    });

    if (match && !isExecutive && match.request.requestedById !== actor.id) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to view this matching record." }, { status: 403 });
    }

    const safeMatch = match
      ? JSON.parse(JSON.stringify(match, (_, v) => (typeof v === "bigint" ? Number(v) : v)))
      : null;

    return NextResponse.json({ match: safeMatch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch match record" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: "Sign in to perform 3-way match." }, { status: 401 });
    if (!hasAnyRole(actor, ["SYSTEM_ADMIN", "SUPER_ADMIN", "GMD"])) {
      return NextResponse.json({ error: "Executive role required." }, { status: 403 });
    }

    const body = await request.json();
    const {
      requestId,
      invoiceNumber,
      invoiceAmountMinor,
      invoiceDate,
      taxMinor,
      grnNumber,
      waybillNumber,
      inspectionNotes,
      tolerancePercentage,
    } = body;

    if (!requestId) {
      return NextResponse.json({ error: "Specify target expenditure request ID." }, { status: 400 });
    }

    const expRequest = await prisma.expenditureRequest.findUnique({
      where: { id: requestId },
      include: { vendor: true },
    });

    if (!expRequest) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    if (!expRequest.vendorId) {
      return NextResponse.json({ error: "This request does not have an assigned vendor/supplier." }, { status: 400 });
    }

    // 1. Create or resolve VendorInvoice
    let invoice = await prisma.vendorInvoice.findFirst({
      where: { requestId, invoiceNumber: invoiceNumber || "INV-AUTO" },
    });

    if (!invoice && (invoiceNumber || invoiceAmountMinor)) {
      invoice = await prisma.vendorInvoice.create({
        data: {
          vendorId: expRequest.vendorId,
          requestId,
          invoiceNumber: invoiceNumber || `INV-${expRequest.requestNumber}`,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          amountMinor: BigInt(invoiceAmountMinor || expRequest.amountMinor),
          taxMinor: BigInt(taxMinor || 0),
          currency: expRequest.currency,
          status: "PENDING",
        },
      });
    }

    // 2. Create or resolve GoodsReceiptNote (GRN) if provided
    let grn = await prisma.goodsReceiptNote.findFirst({
      where: { requestId },
    });

    if (!grn && (grnNumber || waybillNumber || inspectionNotes)) {
      const count = await prisma.goodsReceiptNote.count();
      const grnPrefix = buildDatedRequestPrefix("GRN");
      grn = await prisma.goodsReceiptNote.create({
        data: {
          requestId,
          grnNumber: grnNumber || `${grnPrefix}-${String(count + 1).padStart(4, "0")}`,
          receivedById: actor.id,
          waybillNumber: waybillNumber || null,
          inspectionNotes: inspectionNotes || "Goods inspected and accepted in good order.",
          status: "ACCEPTED",
        },
      });
    }

    if (!invoice) {
      return NextResponse.json({ error: "Please provide invoice details to perform matching." }, { status: 400 });
    }

    // 3. Execute 3-way match
    const matchResult = await executeThreeWayMatch({
      requestId,
      invoiceId: invoice.id,
      grnId: grn?.id || null,
      tolerancePercentage: tolerancePercentage || 0.0,
    });

    return NextResponse.json({
      success: true,
      matchResult: {
        ...matchResult,
        poAmountMinor: Number(matchResult.poAmountMinor),
        invoiceAmountMinor: Number(matchResult.invoiceAmountMinor),
        varianceMinor: Number(matchResult.varianceMinor),
      },
    });
  } catch (error: any) {
    console.error("Match error:", error);
    return NextResponse.json({ error: error.message || "Match execution failed" }, { status: 500 });
  }
}
