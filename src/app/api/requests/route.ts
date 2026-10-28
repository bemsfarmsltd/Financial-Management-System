import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";
import { toSystemRequestId } from "@/lib/request-id";
import { notifyApprovalRequired } from "@/lib/notifications/bridge";
import { createWithUniqueRequestNumber } from "@/lib/request-number";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const subsidiaryId = searchParams.get("organization_id") || searchParams.get("subsidiaryId") || searchParams.get("subsidiary");
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

    if (subsidiaryId && subsidiaryId !== 'ALL') {
      const { resolveOrganizationScope } = await import('@/lib/organizations');
      const scope = await resolveOrganizationScope(subsidiaryId);
      if (!scope.isGroup) {
        where.subsidiaryId = { in: scope.organizationIds };
      }
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
        approvalStatus: req.approvalStatus,
        paymentStatus: req.paymentStatus,
        accountabilityStatus: req.accountabilityStatus,
        requestType: req.requestType,
        urgency: req.urgency,
        statusLabel,
        stepIndex,
        submittedDate: req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-NG", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }) : new Date().toLocaleDateString("en-NG"),
        createdAt: req.createdAt ? new Date(req.createdAt).toISOString() : new Date().toISOString(),
        subsidiaryName: req.subsidiary?.legalName || "BEMS Group",
        subsidiary: req.subsidiary ? {
          id: req.subsidiary.id,
          legalName: req.subsidiary.legalName,
          code: req.subsidiary.code,
        } : null,
        requester: req.requester ? {
          id: req.requester.id,
          legalName: req.requester.legalName,
          workEmail: req.requester.workEmail,
          role: req.requester.role,
        } : null,
        departmentName,
        needsRetirement,
        rejectionReason,
        comments,
        channelComments: comments,
        vendor: req.vendor ? { id: req.vendor.id, name: req.vendor.name, code: req.vendor.code } : null,
        neededBy: req.neededBy ? new Date(req.neededBy).toISOString() : null,
        dueDate: req.neededBy ? new Date(req.neededBy).toLocaleDateString("en-NG", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }) : null,
        justification: req.justification,
        deliverable: req.deliverable,
        isRecurring: req.isRecurring,
        recurringInterval: req.recurringInterval,
      };
    });

    return NextResponse.json(formatted, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
    });
  } catch (error: any) {
    console.error("GET /api/requests error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      const fallbackEmpId = request.headers.get("x-employee-id");
      if (fallbackEmpId) {
        const emp = await prisma.employee.findUnique({
          where: { id: fallbackEmpId },
          select: {
            id: true,
            employeeNumber: true,
            legalName: true,
            workEmail: true,
            phone: true,
            role: true,
            status: true,
            approvalStatus: true,
          },
        });
        if (emp && emp.status === "ACTIVE" && emp.approvalStatus === "APPROVED") {
          actor = emp as any;
        }
      }
    }

    if (!actor) {
      return NextResponse.json({ error: "Sign in to submit a fund request." }, { status: 401 });
    }
    if (actor.role === "GMD" || actor.role === "SYSTEM_ADMIN") {
      return NextResponse.json({ error: "GMD and System Admin accounts are executive governance roles and do not submit fund requests." }, { status: 403 });
    }

    const body = await request.json();
    let {
      subsidiaryId,
      subsidiary: subsidiaryNameInput,
      vendorId,
      vendorName,
      requestType,
      category,
      amountNaira,
      amountMinor: inputAmountMinor,
      title,
      justification,
      deliverable,
      neededBy,
      dueDate,
      isRecurring,
      recurringInterval,
      attachments,
    } = body;

    // Normalize category
    if (category) {
      const lower = category.toLowerCase();
      if (lower.includes("software") || lower.includes("cloud") || lower.includes("infrastructure")) {
        category = "IT_SOFTWARE";
      } else if (lower.includes("power") || lower.includes("diesel") || lower.includes("facility")) {
        category = "OFFICE_EXPENSE";
      } else if (lower.includes("advance") || lower.includes("petty cash") || lower.includes("per-diem") || lower.includes("welfare")) {
        category = "OFFICE_EXPENSE";
        requestType = "ADVANCE";
      } else if (lower.includes("travel") || lower.includes("haulage") || lower.includes("logistics")) {
        category = "TRAVEL";
      } else if (lower.includes("feed") || lower.includes("raw grain") || lower.includes("agro") || lower.includes("farm")) {
        category = "OFFICE_EXPENSE";
      } else if (lower.includes("machinery") || lower.includes("repair") || lower.includes("spares")) {
        category = "ASSET";
      } else if (lower.includes("marketing")) {
        category = "MARKETING";
      } else {
        category = "OFFICE_EXPENSE";
      }
    } else {
      category = "OFFICE_EXPENSE";
    }

    // Resolve subsidiaryId
    if (!subsidiaryId && subsidiaryNameInput) {
      const matchOrg = await prisma.organization.findFirst({
        where: {
          OR: [
            { legalName: { contains: subsidiaryNameInput, mode: "insensitive" } },
            { code: { contains: subsidiaryNameInput, mode: "insensitive" } },
          ],
        },
      });
      if (matchOrg) subsidiaryId = matchOrg.id;
    }

    if (!subsidiaryId) {
      const assignment = await prisma.employeeAssignment.findFirst({
        where: { employeeId: actor.id, status: "ACTIVE" },
        orderBy: { isPrimary: "desc" },
      });
      if (assignment) {
        subsidiaryId = assignment.subsidiaryId;
      } else {
        const defaultOrg = await prisma.organization.findFirst({
          where: { status: "ACTIVE" },
        });
        subsidiaryId = defaultOrg?.id;
      }
    }

    if (!subsidiaryId) {
      return NextResponse.json({ error: "Could not resolve organization subsidiary for requester." }, { status: 400 });
    }

    // Resolve vendor if vendorName provided but no vendorId
    if (!vendorId && vendorName && typeof vendorName === "string" && vendorName.trim()) {
      const foundVendor = await prisma.vendor.findFirst({
        where: { name: { contains: vendorName.trim(), mode: "insensitive" } },
      });
      if (foundVendor) vendorId = foundVendor.id;
    }

    // Resolve minor unit amount
    let amountMinor: bigint;
    if (inputAmountMinor !== undefined && inputAmountMinor !== null) {
      amountMinor = BigInt(Math.round(Number(inputAmountMinor)));
    } else if (amountNaira !== undefined && amountNaira !== null) {
      amountMinor = BigInt(Math.round(parseFloat(String(amountNaira)) * 100));
    } else if (body.amount !== undefined && body.amount !== null) {
      amountMinor = BigInt(Math.round(parseFloat(String(body.amount)) * 100));
    } else {
      return NextResponse.json({ error: "Specify a valid expenditure amount." }, { status: 400 });
    }

    const titleStr = typeof title === "string" && title.trim() ? title.trim() : "Expenditure Request";
    const justStr = justification || "Official business operational expense.";
    const delivStr = deliverable || "Itemized receipt and proof of delivery.";
    const needDate = neededBy ? new Date(neededBy) : (dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 3600 * 1000));

    // Determine initial approver role based on policy limits
    let initialApproverRole = "HEAD_OF_ADMIN";
    const amountValue = Number(amountMinor);
    if (category === "IT_SOFTWARE" && amountValue > 15000000) {
      initialApproverRole = "GMD";
    } else if (amountValue > 100000000) {
      initialApproverRole = "GMD";
    } else if (amountValue > 10000000) {
      initialApproverRole = "COO";
    }

    const sub = await prisma.organization.findUnique({
      where: { id: subsidiaryId },
    });
    const groupId = sub?.parentGroupId || sub?.id || "";

    const newRequest = await createWithUniqueRequestNumber("REQ-2026", async (reqNum) => {
      return await prisma.expenditureRequest.create({
        data: {
          requestNumber: reqNum,
          groupId,
          subsidiaryId,
          requestedById: actor.id,
          vendorId: vendorId || null,
          requestType: requestType || "ORDINARY",
          category,
          amountMinor,
          currency: "NGN",
          title: titleStr,
          justification: justStr,
          deliverable: delivStr,
          neededBy: isNaN(needDate.getTime()) ? new Date(Date.now() + 7 * 24 * 3600 * 1000) : needDate,
          approvalStatus: "IN_REVIEW",
          paymentStatus: "UNPAID",
          accountabilityStatus: "PENDING",
          isRecurring: !!isRecurring,
          recurringInterval: isRecurring ? recurringInterval : null,
          channel: {
            create: {
              classification: "GENERAL",
              messages: {
                create: {
                  authorName: "System",
                  authorRole: "SYSTEM",
                  messageType: "AUDIT_EVENT",
                  body: `Request ${reqNum} created and submitted. Assigned to ${initialApproverRole} for review.`,
                },
              },
            },
          },
          approvalSteps: {
            create: {
              stageIndex: 1,
              assignedRole: initialApproverRole,
              status: "PENDING",
            },
          },
        },
      });
    });

    // Save attachments if provided
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att && att.fileUrl) {
          await prisma.attachment.create({
            data: {
              ownerType: "REQUEST",
              ownerId: newRequest.id,
              requestId: newRequest.id,
              fileName: att.fileName || "supporting_document.pdf",
              fileUrl: att.fileUrl,
              contentType: att.contentType || "application/octet-stream",
              notes: att.notes || "Uploaded with requisition",
              uploadedById: actor.id,
            },
          });
        }
      }
    }

    // Trigger notification bridge
    try {
      const org = await prisma.organization.findUnique({ where: { id: subsidiaryId }, select: { legalName: true } });
      await notifyApprovalRequired({
        requestNumber: newRequest.requestNumber,
        title: titleStr,
        amountMinor: Number(amountMinor),
        approverRole: initialApproverRole,
        requesterName: actor.legalName,
        subsidiaryName: org?.legalName || "BEMS Group",
        justification: justStr,
      });
    } catch (notifErr) {
      console.error("Notification bridge error:", notifErr);
    }

    return NextResponse.json({
      success: true,
      id: newRequest.id,
      systemId: toSystemRequestId(newRequest.id),
      requestNumber: newRequest.requestNumber,
      amountMinor: Number(newRequest.amountMinor),
    });
  } catch (error: any) {
    console.error("Failed to create request:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create request" },
      { status: 500 }
    );
  }
}

