import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";
import { toSystemRequestId } from "@/lib/request-id";
import { notifyApprovalRequired } from "@/lib/notifications/bridge";
import { createWithUniqueRequestNumber } from "@/lib/request-number";

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: "Sign in to submit a fund request." }, { status: 401 });
    if (hasAnyRole(actor, ["GMD", "SYSTEM_ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "The Group Managing Director and Super admin accounts are executive governance roles and do not submit fund requests." }, { status: 403 });
    }

    const body = await request.json();
    let {
      subsidiaryId,
      vendorId,
      requestType,
      category,
      amountNaira,
      amountMinor: inputAmountMinor,
      title,
      justification,
      rationale,
      deliverable,
      neededBy,
      isRecurring,
      recurringInterval,
    } = body;

    // Normalize category if human label was passed from mobile
    if (category) {
      const lower = category.toLowerCase();
      if (lower.includes("software") || lower.includes("cloud") || lower.includes("infrastructure")) {
        category = "IT_SOFTWARE";
      } else if (lower.includes("power") || lower.includes("diesel") || lower.includes("facility")) {
        category = "OFFICE_EXPENSE";
      } else if (lower.includes("advance") || lower.includes("petty cash")) {
        category = "OFFICE_EXPENSE";
        requestType = "ADVANCE";
      } else if (lower.includes("travel") || lower.includes("logistics")) {
        category = "TRAVEL";
      } else if (lower.includes("marketing")) {
        category = "MARKETING";
      } else if (lower.includes("asset")) {
        category = "ASSET";
      }
    } else {
      category = "OFFICE_EXPENSE";
    }

    // Resolve subsidiaryId if omitted (e.g. from mobile app)
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

    // Resolve minor unit amount (kobo)
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

    const titleStr = typeof title === "string" ? title.trim() : "Expenditure Request";
    const justStr = justification || rationale || "Official business operational expense.";
    const delivStr = deliverable || "Itemized receipt and proof of delivery.";
    const needDate = neededBy ? new Date(neededBy) : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    // In 3-role model, staff submits and GMD approves directly
    const initialApproverRole = "GMD";

    // Lookup group parent
    const sub = await prisma.organization.findUnique({
      where: { id: subsidiaryId },
    });
    const groupId = sub?.parentGroupId || sub?.id || "";

    // Create request atomically with channel and initial approval step
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
          neededBy: needDate,
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
                  body: `Request ${reqNum} created and submitted. Assigned to The Group Managing Director for executive approval.`,
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

    // Save any supporting documentation attachments
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      for (const att of body.attachments) {
        if (att && att.fileUrl && att.fileName) {
          try {
            await prisma.attachment.create({
              data: {
                ownerType: "REQUEST",
                ownerId: newRequest.id,
                requestId: newRequest.id,
                fileName: att.fileName,
                fileUrl: att.fileUrl,
                contentType: att.contentType || "application/octet-stream",
                uploadedById: actor.id,
              },
            });
          } catch (attErr) {
            console.error("Failed to link attachment to request:", attErr);
          }
        }
      }
    }
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
