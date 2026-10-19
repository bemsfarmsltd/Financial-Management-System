import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestIdentifierWhere } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * WhatsApp Cloud API Webhook Verification Challenge
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "bems_group_webhook_secret";

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Inbound WhatsApp message processor
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Extract message from WhatsApp Cloud payload structure
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ status: "IGNORED_NO_MESSAGE" });
    }

    const fromPhone = message.from || "unknown";
    const textBody = (message.text?.body || "").trim();

    // Check if message matches approval keywords, e.g. "APPROVE REQ-2026-0001" or "DECLINE REQ-2026-0001"
    const match = textBody.match(/^(APPROVE|DECLINE|REJECT)\s+(REQ-\d{4}-\d{4})/i);

    if (match) {
      const action = match[1].toUpperCase();
      const requestNumber = match[2].toUpperCase();
      const isApprove = action === "APPROVE";

      const expRequest = await prisma.expenditureRequest.findUnique({
        where: requestIdentifierWhere(requestNumber),
        include: {
          channel: true,
          approvalSteps: { orderBy: { stageIndex: "asc" } },
        },
      });

      if (expRequest) {
        const pendingStep = expRequest.approvalSteps.find((s) => s.status === "PENDING");
        if (pendingStep) {
          const actorName = `WhatsApp User (+${fromPhone})`;

          await prisma.$transaction(async (tx) => {
            await tx.approvalStep.update({
              where: { id: pendingStep.id },
              data: {
                status: isApprove ? "APPROVED" : "REJECTED",
                approverName: actorName,
                decidedAt: new Date(),
                decisionReason: `Action recorded via WhatsApp Bot command from +${fromPhone}`,
              },
            });

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

            if (expRequest.channel) {
              await tx.channelMessage.create({
                data: {
                  channelId: expRequest.channel.id,
                  authorName: actorName,
                  authorRole: pendingStep.assignedRole,
                  messageType: "AUDIT_EVENT",
                  body: isApprove
                    ? `WhatsApp Bot Action: Request approved by +${fromPhone}. ${nextApprovalStatus === "APPROVED" ? "Disbursement unlocked." : "Forwarded to next stage."}`
                    : `WhatsApp Bot Action: Request declined by +${fromPhone}.`,
                },
              });
            }

            await tx.auditEvent.create({
              data: {
                actorName,
                actorRole: pendingStep.assignedRole,
                groupId: expRequest.groupId,
                subsidiaryId: expRequest.subsidiaryId,
                targetType: "REQUEST",
                targetId: expRequest.id,
                action: isApprove ? "APPROVED" : "REJECTED",
                correlationId: `CORR-WA-${Date.now()}`,
                metadata: JSON.stringify({ requestNumber, fromPhone, action }),
              },
            });
          });
        }
      }
    }

    return NextResponse.json({ status: "SUCCESS" });
  } catch (error: any) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ error: error.message || "Failed to process WhatsApp webhook" }, { status: 500 });
  }
}
