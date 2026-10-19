import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";
import { requestIdentifierWhere } from "@/lib/request-id";

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: "Sign in to submit or close accountability cases." }, { status: 401 });

    const body = await request.json();
    const { caseId, requestId, decision, closureNotes, actualSpentMinor, refundAmountMinor, notes, receiptFileName } = body;

    // SCENARIO 1: Staff submits retirement evidence via requestId (e.g. from Mobile or Web Staff Desk)
    if (requestId && !caseId) {
      const expRequest = await prisma.expenditureRequest.findUnique({
        where: requestIdentifierWhere(requestId),
        include: {
          accountabilityCase: true,
          channel: true,
          disbursements: true,
        },
      });

      if (!expRequest) {
        return NextResponse.json({ error: "Request not found." }, { status: 404 });
      }

      // Check ownership unless privileged
      const isPrivileged = hasAnyRole(actor, ["SYSTEM_ADMIN", "GMD", "HR"]);
      if (!isPrivileged && expRequest.requestedById !== actor.id) {
        return NextResponse.json({ error: "Only the request owner or executive can submit retirement evidence." }, { status: 403 });
      }

      // Ensure accountability case exists
      let accCase = expRequest.accountabilityCase;
      if (!accCase) {
        accCase = await prisma.accountabilityCase.create({
          data: {
            requestId: expRequest.id,
            ownerUserId: expRequest.requestedById,
            requiredDeliverables: "Itemized expense receipts and retirement declaration",
            dueAt: new Date(Date.now() + 72 * 3600 * 1000), // 72 hours SLA
            status: "OPEN",
          },
        });
      }

      const noteText = notes || closureNotes || "Advance retirement evidence submitted.";
      const fileName = receiptFileName || "retirement_evidence.pdf";

      await prisma.$transaction(async (tx) => {
        // Record attachment evidence
        await tx.attachment.create({
          data: {
            ownerType: "ACCOUNTABILITY",
            ownerId: accCase.id,
            requestId: expRequest.id,
            fileName,
            fileUrl: `/uploads/${fileName}`,
            contentType: "application/pdf",
            notes: `Actual Spent: ₦${actualSpentMinor ? (Number(actualSpentMinor) / 100).toLocaleString() : 'N/A'}. Refund: ₦${refundAmountMinor ? (Number(refundAmountMinor) / 100).toLocaleString() : '0'}. Details: ${noteText}`,
            uploadedById: actor.id,
          },
        });

        // Update case status to EVIDENCE_SUBMITTED
        await tx.accountabilityCase.update({
          where: { id: accCase.id },
          data: {
            status: "EVIDENCE_SUBMITTED",
          },
        });

        await tx.expenditureRequest.update({
          where: { id: expRequest.id },
          data: {
            accountabilityStatus: "EVIDENCE_SUBMITTED",
          },
        });

        // Add channel message
        if (expRequest.channel) {
          await tx.channelMessage.create({
            data: {
              channelId: expRequest.channel.id,
              authorId: actor.id,
              authorName: actor.legalName,
              authorRole: actor.role,
              messageType: "AUDIT_EVENT",
              body: `Advance retirement submitted by ${actor.legalName}: "${noteText}". Ready for Verifier inspection.`,
            },
          });
        }

        // Add audit trail
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            actorName: actor.legalName,
            actorRole: actor.role,
            groupId: expRequest.groupId,
            subsidiaryId: expRequest.subsidiaryId,
            targetType: "REQUEST",
            targetId: expRequest.id,
            action: "CLOSED",
            correlationId: `CORR-RETIRE-${accCase.id}-${Date.now()}`,
            metadata: JSON.stringify({
              caseId: accCase.id,
              actualSpentMinor: actualSpentMinor || null,
              refundAmountMinor: refundAmountMinor || null,
              note: noteText,
            }),
          },
        });
      });

      return NextResponse.json({ success: true, caseId: accCase.id, status: "EVIDENCE_SUBMITTED" });
    }

    // SCENARIO 2: Executive closes accountability case via caseId
    if (!hasAnyRole(actor, ["SYSTEM_ADMIN", "GMD", "HR"])) {
      return NextResponse.json({ error: "Executive or admin access is required to close cases." }, { status: 403 });
    }

    const accCase = await prisma.accountabilityCase.findUnique({
      where: { id: caseId },
      include: {
        request: {
          include: {
            channel: true,
            disbursements: true,
          },
        },
      },
    });

    if (!accCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (decision === "CLOSE" || !decision) {
      if (!["OPEN", "EVIDENCE_SUBMITTED", "VERIFIED"].includes(accCase.status)) {
        return NextResponse.json({ error: "This case cannot be closed from its current state." }, { status: 409 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.accountabilityCase.update({
          where: { id: caseId },
          data: {
            status: "CLOSED",
            verifierUserId: actor.id,
            verifiedAt: new Date(),
            closureNotes: typeof closureNotes === "string" && closureNotes.trim() ? closureNotes.trim() : "Supporting deliverables inspected and verified.",
          },
        });

        await tx.expenditureRequest.update({
          where: { id: accCase.requestId },
          data: { accountabilityStatus: "CLOSED" },
        });

        if (accCase.request.channel) {
          await tx.channelMessage.create({
            data: {
              channelId: accCase.request.channel.id,
              authorId: actor.id,
              authorName: actor.legalName,
              authorRole: actor.role,
              messageType: "AUDIT_EVENT",
              body: `Post-payment deliverables inspected and verified closed by ${actor.legalName}.`,
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            actorName: actor.legalName,
            actorRole: actor.role,
            groupId: accCase.request.groupId,
            subsidiaryId: accCase.request.subsidiaryId,
            targetType: "REQUEST",
            targetId: accCase.requestId,
            action: "CLOSED",
            correlationId: `CORR-CLOSE-${caseId}-${Date.now()}`,
            metadata: JSON.stringify({ caseId, closureNotes: closureNotes || null }),
          },
        });
      });

      return NextResponse.json({ success: true, caseId, status: "CLOSED" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Closure error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process accountability action." },
      { status: 500 }
    );
  }
}
