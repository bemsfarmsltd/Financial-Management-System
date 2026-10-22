import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const subsidiaryId = searchParams.get("organization_id") || searchParams.get("subsidiaryId");
    const search = searchParams.get("q") || searchParams.get("search");
    const requesterId = searchParams.get("requester_id");
    const minAmount = searchParams.get("min_amount") ? Number(searchParams.get("min_amount")) : null;
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const limit = Math.min(Number(searchParams.get("limit") || 100), 200);

    // Build Prisma where query
    const where: any = {};

    // If logged in as staff, restrict to their own requests unless privileged
    if (actor && !hasAnyRole(actor, ["SYSTEM_ADMIN", "GMD", "HR", "COO", "FINANCE", "DIRECTOR", "HEAD_OF_ADMIN", "AI_ANALYST", "FINANCE_CONTROLLER"])) {
      where.requestedById = actor.id;
    }

    if (requesterId) {
      where.requestedById = requesterId;
    }

    if (status) {
      where.approvalStatus = status;
    }

    if (category) {
      where.category = category;
    }

    if (subsidiaryId) {
      where.subsidiaryId = subsidiaryId;
    }

    if (minAmount && !isNaN(minAmount)) {
      where.amount = { gte: minAmount };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { requestNumber: { contains: search, mode: "insensitive" } },
        { justification: { contains: search, mode: "insensitive" } },
      ];
    }

    const requests = await prisma.expenditureRequest.findMany({
      where,
      include: {
        subsidiary: true,
        requester: {
          include: {
            assignments: {
              include: { department: true },
            },
          },
        },
        vendor: true,
        approvalSteps: {
          orderBy: { stageIndex: "asc" },
        },
        channel: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              take: 20,
            },
          },
        },
        accountabilityCase: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Format response so it directly populates the Flutter mobile app and web tables
    const formatted = requests.map((req) => {
      // Determine status label & stepIndex (0 to 4)
      let stepIndex = 0;
      let statusLabel = "Submitted to HOD";
      const appStatus = req.approvalStatus;

      if (appStatus === "REJECTED") {
        statusLabel = "Request Declined";
        stepIndex = 0;
      } else if (appStatus === "CLARIFICATION_REQUESTED") {
        statusLabel = "Clarification Requested";
        stepIndex = 1;
      } else if (appStatus === "APPROVED") {
        if (req.paymentStatus === "UNPAID") {
          statusLabel = "Approved for Disbursement";
          stepIndex = 2;
        } else if (req.accountabilityStatus === "PENDING" && req.requestType === "ADVANCE") {
          statusLabel = "Funds Disbursed — Retirement Due";
          stepIndex = 3;
        } else if (req.accountabilityStatus === "EVIDENCE_SUBMITTED") {
          statusLabel = "Retirement Evidence In Review";
          stepIndex = 3;
        } else if (req.accountabilityStatus === "CLOSED" || req.paymentStatus === "RECIPIENT_CONFIRMED") {
          statusLabel = "Completed & Reconciled";
          stepIndex = 4;
        } else {
          statusLabel = "Disbursed";
          stepIndex = 3;
        }
      } else if (appStatus === "IN_REVIEW") {
        const pendingStep = req.approvalSteps.find((s) => s.status === "PENDING");
        if (pendingStep?.assignedRole === "GMD") {
          statusLabel = "GMD Executive Review";
          stepIndex = 2;
        } else if (pendingStep?.assignedRole === "COO") {
          statusLabel = "COO Review";
          stepIndex = 2;
        } else {
          statusLabel = "HOD Review";
          stepIndex = 1;
        }
      }

      // Department name from requester assignment
      const primaryAssignment = req.requester?.assignments?.find((a) => a.isPrimary) || req.requester?.assignments?.[0];
      const departmentName = primaryAssignment?.department?.name || "Corporate Operations";

      // Comments from channel
      const comments = (req.channel?.messages || []).map((m) => `${m.authorName}: ${m.body}`);

      // Rejection reason if any
      const rejectedStep = req.approvalSteps?.find((s) => s.status === "REJECTED");
      const rejectionReason = rejectedStep?.decisionReason || null;

      const needsRetirement = (req.requestType === "ADVANCE" || req.category.includes("ADVANCE") || req.category.includes("TRAVEL")) &&
        req.paymentStatus !== "UNPAID" &&
        req.accountabilityStatus !== "CLOSED";

      return {
        id: req.id,
        requestNumber: req.requestNumber,
        title: req.title,
        category: req.category,
        amount: Number(req.amountMinor) / 100,
        amountMinor: Number(req.amountMinor),
        currency: req.currency || "NGN",
        status: req.approvalStatus,
        statusLabel,
        stepIndex,
        submittedDate: req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-NG", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }) : new Date().toLocaleDateString("en-NG"),
        createdAt: req.createdAt ? new Date(req.createdAt).toISOString() : new Date().toISOString(),
        subsidiaryName: req.subsidiary?.legalName || "BEMS Group",
        departmentName,
        needsRetirement,
        rejectionReason,
        comments,
        channelComments: comments,
        vendor: req.vendor ? { id: req.vendor.id, name: req.vendor.name, code: req.vendor.code } : null,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/requests error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch requests" }, { status: 500 });
  }
}
