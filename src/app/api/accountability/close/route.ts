import {walletRequestFunding} from '@/lib/wallet/accountability';
import { accountabilityDeadline } from '@/lib/services/accountability-deadline';
import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";
import { requestIdentifierWhere } from "@/lib/request-id";

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: "Sign in to submit or close accountability cases." }, { status: 401 });

    const body = await request.json();
    const { caseId, requestId, decision, closureNotes, actualSpentMinor, refundAmountMinor, notes, receiptFileName, attachmentId } = body;

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
      const isPrivileged = hasAnyRole(actor, ["SYSTEM_ADMIN", "SUPER_ADMIN", "GMD"]);
      if (!isPrivileged && expRequest.requestedById !== actor.id) {
        return NextResponse.json({ error: "Only the request owner or executive can submit retirement evidence." }, { status: 403 });
      }

      const walletFunding=await walletRequestFunding(prisma,expRequest.id);
      if(walletFunding&&walletFunding.settledMinor<=BigInt(0))return NextResponse.json({error:'A confirmed project bank withdrawal is required before submitting expense evidence.'},{status:409});
      // Guard against submitting retirement before funds have been disbursed
      if (expRequest.paymentStatus === "UNPAID" && expRequest.disbursements.length === 0) {
        return NextResponse.json(
          { error: "Cannot submit retirement evidence before payment has been disbursed for this request." },
          { status: 409 }
        );
      }

      // Prevent reopening an already CLOSED accountability case
      if (expRequest.accountabilityCase?.status === "CLOSED" || expRequest.accountabilityStatus === "CLOSED") {
        return NextResponse.json(
          { error: "This accountability case has already been verified and closed." },
          { status: 409 }
        );
      }

      const evidence = attachmentId ? await prisma.attachment.findUnique({ where: { id: String(attachmentId) } }) : null;
      if (!evidence?.fileData?.length || (!isPrivileged && evidence.uploadedById !== actor.id)) {
        return NextResponse.json({ error: 'Upload an evidence file and provide its attachmentId.' }, { status: 400 });
      }
      if (evidence.requestId && evidence.requestId !== expRequest.id) return NextResponse.json({ error: 'Evidence belongs to another request.' }, { status: 403 });

      // Ensure accountability case exists
      let accCase = expRequest.accountabilityCase;
      if (!accCase) {
        accCase = await prisma.accountabilityCase.create({
          data: {
            requestId: expRequest.id,
            ownerUserId: expRequest.requestedById,
            requiredDeliverables: expRequest.deliverable || "Itemized expense receipts and retirement declaration",
            dueAt: await accountabilityDeadline(expRequest.subsidiaryId, expRequest.requestType === 'EMERGENCY', expRequest.disbursements[0]?.paidAt || new Date()),
            status: "OPEN",
          },
        });
      }

      const noteText = notes || closureNotes || "Advance retirement evidence submitted.";
      const fileName = receiptFileName || "retirement_evidence.pdf";

      await prisma.$transaction(async (tx) => {
        await tx.attachment.update({ where: { id: evidence.id }, data: { ownerType: 'ACCOUNTABILITY', ownerId: accCase.id, requestId: expRequest.id } });

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
            action: "EVIDENCE_SUBMITTED",
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

    if (decision && decision !== 'CLOSE') return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    const result = await executeDashboardCommand(actor, 'accountability_clearance', { case_id: caseId, sub_action: 'CLEAR_CASE', clearance_notes: closureNotes });
    return NextResponse.json({ success: true, caseId, status: result.status });

  } catch (error: any) {
    console.error("Closure error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process accountability action." },
      { status: 500 }
    );
  }
}
