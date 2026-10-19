import { prisma } from "@/lib/prisma";

export interface NotificationPayload {
  channel: "SLACK" | "WHATSAPP" | "BOTH";
  recipient: string; // Phone number or Slack channel/user ID
  eventType: "APPROVAL_REQUESTED" | "DISBURSED" | "RETIREMENT_WARNING" | "CLARIFICATION_REQUIRED";
  title: string;
  summary: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
}

export interface BridgeDispatchResult {
  success: boolean;
  slackStatus?: "SENT" | "SKIPPED" | "FAILED";
  whatsappStatus?: "SENT" | "SKIPPED" | "FAILED";
  notificationIds: string[];
}

/**
 * Builds Slack Block Kit message payload for executive approval cards
 */
function buildSlackApprovalCard(params: {
  title: string;
  summary: string;
  requestNumber?: string;
  amountMinor?: number;
  requesterName?: string;
  approverRole?: string;
}) {
  const amountFormatted = params.amountMinor
    ? `₦${(params.amountMinor / 100).toLocaleString("en-NG")}`
    : "N/A";

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `⚡ Action Required: ${params.title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Request #:* \`${params.requestNumber || "N/A"}\``,
          },
          {
            type: "mrkdwn",
            text: `*Amount:* *${amountFormatted}*`,
          },
          {
            type: "mrkdwn",
            text: `*Requester:* ${params.requesterName || "Staff Member"}`,
          },
          {
            type: "mrkdwn",
            text: `*Assigned Role:* \`${params.approverRole || "Executive"}\``,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `> ${params.summary}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ Approve",
              emoji: true,
            },
            style: "primary",
            value: JSON.stringify({ action: "APPROVE", requestNumber: params.requestNumber }),
            action_id: "action_approve_request",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "💬 Clarify",
              emoji: true,
            },
            value: JSON.stringify({ action: "CLARIFY", requestNumber: params.requestNumber }),
            action_id: "action_clarify_request",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "❌ Decline",
              emoji: true,
            },
            style: "danger",
            value: JSON.stringify({ action: "REJECT", requestNumber: params.requestNumber }),
            action_id: "action_decline_request",
          },
        ],
      },
    ],
  };
}

/**
 * Dispatches outbound notifications to Slack and/or WhatsApp
 * Logs each dispatch to the OutboundNotification table.
 */
export async function dispatchNotificationBridge(payload: NotificationPayload): Promise<BridgeDispatchResult> {
  const result: BridgeDispatchResult = {
    success: true,
    notificationIds: [],
  };

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const whatsappApiToken = process.env.WHATSAPP_API_TOKEN;
  const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;

  // 1. Dispatch Slack
  if (payload.channel === "SLACK" || payload.channel === "BOTH") {
    let slackStatus: "SENT" | "SKIPPED" | "FAILED" = "SKIPPED";
    let slackExternalId: string | null = null;
    const slackPayload = buildSlackApprovalCard({
      title: payload.title,
      summary: payload.summary,
      requestNumber: payload.metadata?.requestNumber,
      amountMinor: payload.metadata?.amountMinor,
      requesterName: payload.metadata?.requesterName,
      approverRole: payload.metadata?.approverRole,
    });

    if (slackWebhookUrl) {
      try {
        const res = await fetch(slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackPayload),
        });
        if (res.ok) {
          slackStatus = "SENT";
          slackExternalId = `slack-ts-${Date.now()}`;
        } else {
          slackStatus = "FAILED";
        }
      } catch (err) {
        console.error("Slack webhook dispatch error:", err);
        slackStatus = "FAILED";
      }
    } else {
      // In development / demo mode, mark as DELIVERED to local bridge log
      slackStatus = "SENT";
      slackExternalId = `simulated-slack-${Date.now()}`;
    }

    const recorded = await prisma.outboundNotification.create({
      data: {
        channel: "SLACK",
        recipient: payload.recipient || "#finance-approvals",
        eventType: payload.eventType,
        payload: JSON.stringify(slackPayload),
        status: slackStatus,
        externalId: slackExternalId,
      },
    });

    result.notificationIds.push(recorded.id);
    result.slackStatus = slackStatus;
  }

  // 2. Dispatch WhatsApp
  if (payload.channel === "WHATSAPP" || payload.channel === "BOTH") {
    let waStatus: "SENT" | "SKIPPED" | "FAILED" = "SKIPPED";
    let waExternalId: string | null = null;

    const waText = `*BEMS Group Alert: ${payload.title}*\n\n${payload.summary}\n\n• Reference: ${payload.metadata?.requestNumber || "N/A"}\n• Amount: ₦${payload.metadata?.amountMinor ? (payload.metadata.amountMinor / 100).toLocaleString() : 'N/A'}\n\nReply *APPROVE* or *DECLINE* followed by the request number.`;

    if (whatsappApiToken && whatsappPhoneId && payload.recipient) {
      try {
        const res = await fetch(`https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${whatsappApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: payload.recipient.replace(/[^0-9]/g, ""),
            type: "text",
            text: { body: waText },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          waStatus = "SENT";
          waExternalId = data?.messages?.[0]?.id || `wamid-${Date.now()}`;
        } else {
          waStatus = "FAILED";
        }
      } catch (err) {
        console.error("WhatsApp dispatch error:", err);
        waStatus = "FAILED";
      }
    } else {
      // Local bridge demo simulation
      waStatus = "SENT";
      waExternalId = `simulated-wamid-${Date.now()}`;
    }

    const recorded = await prisma.outboundNotification.create({
      data: {
        channel: "WHATSAPP",
        recipient: payload.recipient || "+2348000000000",
        eventType: payload.eventType,
        payload: JSON.stringify({ text: waText, metadata: payload.metadata }),
        status: waStatus,
        externalId: waExternalId,
      },
    });

    result.notificationIds.push(recorded.id);
    result.whatsappStatus = waStatus;
  }

  return result;
}

/**
 * Convenience dispatchers for core business events
 */
export async function notifyApprovalRequired(params: {
  requestNumber: string;
  title: string;
  amountMinor: number;
  approverRole: string;
  requesterName: string;
  recipientPhone?: string;
}) {
  return dispatchNotificationBridge({
    channel: "BOTH",
    recipient: params.recipientPhone || "+2348011223344",
    eventType: "APPROVAL_REQUESTED",
    title: `Pending Approval: ${params.title}`,
    summary: `${params.requesterName} submitted a fund request of ₦${(params.amountMinor / 100).toLocaleString()} requiring ${params.approverRole} review.`,
    metadata: {
      requestNumber: params.requestNumber,
      amountMinor: params.amountMinor,
      approverRole: params.approverRole,
      requesterName: params.requesterName,
    },
  });
}

export async function notifyRetirementWarning(params: {
  requestNumber: string;
  employeeName: string;
  recipientPhone: string;
  hoursRemaining: number;
}) {
  return dispatchNotificationBridge({
    channel: "WHATSAPP",
    recipient: params.recipientPhone,
    eventType: "RETIREMENT_WARNING",
    title: "Accountability SLA Warning",
    summary: `Hello ${params.employeeName}, your advance for ${params.requestNumber} requires itemized retirement deliverables. You have ${params.hoursRemaining} hours remaining before automated escalation.`,
    metadata: {
      requestNumber: params.requestNumber,
      hoursRemaining: params.hoursRemaining,
    },
  });
}
