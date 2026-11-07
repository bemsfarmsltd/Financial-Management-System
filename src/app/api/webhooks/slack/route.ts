import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestIdentifierWhere } from "@/lib/request-id";

import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET?.trim();
    if (!slackSigningSecret) {
      return NextResponse.json(
        { error: "Slack webhook integration is disabled: SLACK_SIGNING_SECRET is not configured." },
        { status: 503 }
      );
    }

    const timestamp = request.headers.get("x-slack-request-timestamp");
    const signature = request.headers.get("x-slack-signature");
    if (!timestamp || !signature) {
      return NextResponse.json({ error: "Missing Slack verification headers." }, { status: 401 });
    }
    const parsedTimestamp = Number(timestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      return NextResponse.json({ error: "Invalid Slack request timestamp." }, { status: 401 });
    }
    const timeDiff = Math.abs(Math.floor(Date.now() / 1000) - parsedTimestamp);
    if (timeDiff > 300) {
      return NextResponse.json({ error: "Slack request timestamp expired." }, { status: 401 });
    }

    const rawBody = await request.text();
    const sigBaseString = `v0:${timestamp}:${rawBody}`;
    const expectedSignature = `v0=${crypto
      .createHmac("sha256", slackSigningSecret)
      .update(sigBaseString, "utf8")
      .digest("hex")}`;

    const sigBuf = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return NextResponse.json({ error: "Invalid Slack HMAC signature." }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let actionData: { action: string; requestNumber: string } | null = null;
    let userSlackName = "Slack User";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      const payloadStr = params.get("payload");
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
      try {
        actionData = JSON.parse(rawBody);
      } catch {
        actionData = null;
      }
    }

    if (!actionData?.requestNumber || !actionData?.action) {
      return NextResponse.json({ error: "Invalid Slack interactive payload" }, { status: 400 });
    }

    const normalizedAction = String(actionData.action).trim().toUpperCase();
    if (normalizedAction !== "APPROVE" && normalizedAction !== "REJECT" && normalizedAction !== "DECLINE") {
      return NextResponse.json(
        { error: `Unrecognized Slack decision action "${actionData.action}". Allowed: APPROVE, REJECT, DECLINE.` },
        { status: 400 }
      );
    }

    const requestNumber = String(actionData.requestNumber).trim();
    const action = normalizedAction;

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
