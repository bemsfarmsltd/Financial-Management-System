import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestIdentifierWhere } from "@/lib/request-id";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let actionData: { action: string; requestNumber: string } | null = null;
    let userSlackName = "Slack User";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const payloadStr = formData.get("payload");
      if (typeof payloadStr === "string") {
        const payload = JSON.parse(payloadStr);
        userSlackName = payload.user?.name || payload.user?.username || "Slack User";
        const actionObj = payload.actions?.[0];
        if (actionObj?.value) {
          try {
            actionData = JSON.parse(actionObj.value);
          } catch {
            actionData = null;
          }
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      actionData = body;
    }

    if (!actionData?.requestNumber || !actionData?.action) {
      return NextResponse.json({ error: "Invalid Slack interactive payload" }, { status: 400 });
    }

    const { requestNumber, action } = actionData;

    // Look up the request
    const expRequest = await prisma.expenditureRequest.findUnique({
      where: requestIdentifierWhere(requestNumber),
      include: {
        channel: true,
        approvalSteps: {
          orderBy: { stageIndex: "asc" },
        },
      },
    });

    if (!expRequest) {
      return NextResponse.json({
        replace_original: false,
        text: `⚠️ Request ${requestNumber} was not found in the BEMS Group system.`,
      });
    }

    const pendingStep = expRequest.approvalSteps.find((s) => s.status === "PENDING");
    if (!pendingStep) {
      return NextResponse.json({
        replace_original: false,
        text: `ℹ️ Request ${requestNumber} has already been resolved or has no pending approval steps.`,
      });
    }

    const isApprove = action === "APPROVE";
    const decisionReason = `Action recorded via Slack Bot integration by @${userSlackName}`;

    // Resolve system admin or executive actor for webhook execution
    const systemActor = await prisma.employee.findFirst({
      where: { role: pendingStep.assignedRole, status: "ACTIVE" },
    }) || await prisma.employee.findFirst({
      where: { role: "SYSTEM_ADMIN", status: "ACTIVE" },
    });

    const actorId = systemActor?.id || "slack-bot-system";
    const actorName = systemActor ? `${systemActor.legalName} (via Slack)` : `@${userSlackName} (via Slack)`;

    await prisma.$transaction(async (tx) => {
      // 1. Update step
      await tx.approvalStep.update({
        where: { id: pendingStep.id },
        data: {
          status: isApprove ? "APPROVED" : "REJECTED",
          approverId: systemActor?.id || null,
          approverName: actorName,
          decidedAt: new Date(),
          decisionReason,
        },
      });

      // 2. Check if more steps exist
      const remainingSteps = expRequest.approvalSteps.filter(
        (s) => s.stageIndex > pendingStep.stageIndex && s.status === "PENDING"
      );

      const nextApprovalStatus = isApprove
        ? (remainingSteps.length > 0 ? "IN_REVIEW" : "APPROVED")
        : "REJECTED";

      await tx.expenditureRequest.update({
        where: { id: expRequest.id },
        data: { approvalStatus: nextApprovalStatus },
      });

      // 3. Post to channel
      if (expRequest.channel) {
        await tx.channelMessage.create({
          data: {
            channelId: expRequest.channel.id,
            authorName: actorName,
            authorRole: pendingStep.assignedRole,
            messageType: "AUDIT_EVENT",
            body: isApprove
              ? `Decision via Slack Bot: Request approved by ${actorName}. ${nextApprovalStatus === "APPROVED" ? "Ready for disbursement." : "Routed to next stage."}`
              : `Decision via Slack Bot: Request declined by ${actorName}.`,
          },
        });
      }

      // 4. Audit trail
      await tx.auditEvent.create({
        data: {
          actorName,
          actorRole: pendingStep.assignedRole,
          groupId: expRequest.groupId,
          subsidiaryId: expRequest.subsidiaryId,
          targetType: "REQUEST",
          targetId: expRequest.id,
          action: isApprove ? "APPROVED" : "REJECTED",
          correlationId: `CORR-SLACK-${Date.now()}`,
          metadata: JSON.stringify({ requestNumber, decisionReason, slackUser: userSlackName }),
        },
      });
    });

    // Return updated Slack message response
    return NextResponse.json({
      replace_original: true,
      text: isApprove
        ? `✅ *Request ${requestNumber} Approved!* (${expRequest.title})\n_Decision recorded by ${actorName}_`
        : `❌ *Request ${requestNumber} Declined.* (${expRequest.title})\n_Decision recorded by ${actorName}_`,
    });
  } catch (error: any) {
    console.error("Slack webhook handler error:", error);
    return NextResponse.json({ error: error.message || "Failed to process Slack action" }, { status: 500 });
  }
}
