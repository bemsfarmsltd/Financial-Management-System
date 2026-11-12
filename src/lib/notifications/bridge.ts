import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, getExecutiveRecipients, sendGmdRequisitionAlert } from "@/lib/email";

export interface NotificationPayload {
  channel: "SLACK" | "WHATSAPP" | "EMAIL" | "BOTH" | "ALL";
  recipient: string; // Phone number, email, or Slack channel/user ID
  eventType: "APPROVAL_REQUESTED" | "DISBURSED" | "RETIREMENT_WARNING" | "CLARIFICATION_REQUIRED" | "STAFF_ONBOARDING";
  title: string;
  summary: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
  correlationId?: string;
}

export interface BridgeDispatchResult {
  success: boolean;
  correlationId: string;
  slackStatus?: "PENDING" | "SENT" | "SKIPPED" | "FAILED";
  whatsappStatus?: "PENDING" | "SENT" | "SKIPPED" | "FAILED";
  emailStatus?: "PENDING" | "SENT" | "SKIPPED" | "FAILED";
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
  correlationId: string;
}) {
  const amountFormatted = params.amountMinor
    ? `₦${(params.amountMinor / 100).toLocaleString("en-NG")}`
    : "N/A";

  return {
    correlationId: params.correlationId,
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
            value: JSON.stringify({ action: "APPROVE", requestNumber: params.requestNumber, correlationId: params.correlationId }),
            action_id: "action_approve_request",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "💬 Clarify",
              emoji: true,
            },
            value: JSON.stringify({ action: "CLARIFY", requestNumber: params.requestNumber, correlationId: params.correlationId }),
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
            value: JSON.stringify({ action: "REJECT", requestNumber: params.requestNumber, correlationId: params.correlationId }),
            action_id: "action_decline_request",
          },
        ],
      },
    ],
  };
}

/**
 * Outbox-backed notification bridge:
 * 1. Persists an OutboundNotification row in `PENDING` state with a correlationId before dispatch.
 * 2. Executes provider delivery and transitions the row to `SENT`, `SKIPPED`, or `FAILED` with audit details.
 */
export async function dispatchNotificationBridge(payload: NotificationPayload): Promise<BridgeDispatchResult> {
  const correlationId =
    payload.correlationId ||
    payload.metadata?.correlationId ||
    `outbox_${Date.now()}_${randomUUID().slice(0, 8)}`;

  const result: BridgeDispatchResult = {
    success: true,
    correlationId,
    notificationIds: [],
  };

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const whatsappApiToken = process.env.WHATSAPP_API_TOKEN;
  const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;
  const whatsappVersion = process.env.WHATSAPP_GRAPH_API_VERSION;

  // 1. Outbox + Dispatch Slack
  if (payload.channel === "SLACK" || payload.channel === "BOTH" || payload.channel === "ALL") {
    const slackPayload = buildSlackApprovalCard({
      title: payload.title,
      summary: payload.summary,
      requestNumber: payload.metadata?.requestNumber,
      amountMinor: payload.metadata?.amountMinor,
      requesterName: payload.metadata?.requesterName,
      approverRole: payload.metadata?.approverRole,
      correlationId,
    });

    const outboxRow = await prisma.outboundNotification.create({
      data: {
        channel: "SLACK",
        recipient: payload.recipient || "#finance-approvals",
        eventType: payload.eventType,
        payload: JSON.stringify({ correlationId, state: "PENDING", card: slackPayload }),
        status: "PENDING",
        externalId: correlationId,
      },
    });
    result.notificationIds.push(outboxRow.id);

    let slackStatus: "SENT" | "SKIPPED" | "FAILED" = "SKIPPED";
    let slackExternalId: string | null = correlationId;
    let errorReason: string | null = null;

    if (slackWebhookUrl) {
      try {
        const res = await fetch(slackWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-Id": correlationId,
          },
          body: JSON.stringify(slackPayload),
        });
        if (res.ok) {
          slackStatus = "SENT";
          slackExternalId = `slack-ts-${Date.now()}`;
        } else {
          slackStatus = "FAILED";
          errorReason = `HTTP ${res.status}`;
          result.success = false;
        }
      } catch (err: any) {
        slackStatus = "FAILED";
        errorReason = err?.message || "Network error";
        result.success = false;
      }
    } else {
      slackStatus = "SKIPPED";
      slackExternalId = null;
      result.success = false;
    }

    await prisma.outboundNotification.update({
      where: { id: outboxRow.id },
      data: {
        status: slackStatus,
        externalId: slackExternalId,
        payload: JSON.stringify({
          correlationId,
          state: slackStatus,
          dispatchedAt: new Date().toISOString(),
          errorReason,
          card: slackPayload,
        }),
      },
    });

    result.slackStatus = slackStatus;
  }

  // 2. Outbox + Dispatch WhatsApp
  if (payload.channel === "WHATSAPP" || payload.channel === "BOTH" || payload.channel === "ALL") {
    const reqRef = payload.metadata?.requestNumber || "N/A";
    const formattedAmt = payload.metadata?.amountMinor
      ? (Number(payload.metadata.amountMinor) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })
      : "N/A";
    const waText = `*BEMS Group Alert: ${payload.title}*\n\n${payload.summary}\n\n• Reference: *${reqRef}*\n• Amount: *₦${formattedAmt}*\n\n👉 Reply *APPROVE ${reqRef}* or *DECLINE ${reqRef}*`;

    let waPhone = (payload.recipient || "").replace(/[^0-9]/g, "");
    if (!waPhone || waPhone.length < 10) {
      const fallback = process.env.GMD_WHATSAPP_PHONE || "";
      waPhone = fallback.replace(/[^0-9]/g, "");
    }

    const outboxRow = await prisma.outboundNotification.create({
      data: {
        channel: "WHATSAPP",
        recipient: waPhone || payload.recipient || "",
        eventType: payload.eventType,
        payload: JSON.stringify({ correlationId, state: "PENDING", text: waText, metadata: payload.metadata }),
        status: "PENDING",
        externalId: correlationId,
      },
    });
    result.notificationIds.push(outboxRow.id);

    let waStatus: "SENT" | "SKIPPED" | "FAILED" = "SKIPPED";
    let waExternalId: string | null = correlationId;
    let errorReason: string | null = null;

    if (whatsappApiToken && whatsappPhoneId && /^v\d+\.\d+$/.test(whatsappVersion || "") && waPhone.length >= 10) {
      try {
        let res = await fetch(`https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${whatsappApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: waPhone,
            type: "text",
            text: { body: waText },
          }),
        });

        // If outside the 24h Meta conversation window, fallback to template
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (errData?.error?.code === 131047 || String(errData?.error?.message).toLowerCase().includes("template")) {
            res = await fetch(`https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneId}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${whatsappApiToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: waPhone,
                type: "template",
                template: {
                  name: "hello_world",
                  language: { code: "en_US" },
                },
              }),
            });
          }
        }

        if (res.ok) {
          const data = await res.json();
          waStatus = "SENT";
          waExternalId = data?.messages?.[0]?.id || `wamid-${Date.now()}`;
        } else {
          waStatus = "FAILED";
          errorReason = `HTTP ${res.status}`;
          result.success = false;
        }
      } catch (err: any) {
        waStatus = "FAILED";
        errorReason = err?.message || "Network error";
        result.success = false;
      }
    } else {
      waStatus = "SKIPPED";
      waExternalId = null;
      result.success = false;
    }

    await prisma.outboundNotification.update({
      where: { id: outboxRow.id },
      data: {
        status: waStatus,
        externalId: waExternalId,
        payload: JSON.stringify({
          correlationId,
          state: waStatus,
          dispatchedAt: new Date().toISOString(),
          errorReason,
          text: waText,
          metadata: payload.metadata,
        }),
      },
    });

    result.whatsappStatus = waStatus;
  }

  // 3. Outbox + Dispatch Email
  if (payload.channel === "EMAIL" || payload.channel === "ALL") {
    const outboxRow = await prisma.outboundNotification.create({
      data: {
        channel: "EMAIL",
        recipient: payload.recipient,
        eventType: payload.eventType,
        payload: JSON.stringify({ correlationId, state: "PENDING", subject: payload.title, summary: payload.summary }),
        status: "PENDING",
        externalId: correlationId,
      },
    });
    result.notificationIds.push(outboxRow.id);

    try {
      const emailResult = await sendEmail({
        to: payload.recipient,
        subject: payload.title,
        html: `<p><strong>${payload.title}</strong></p><p>${payload.summary}</p>`,
        text: `${payload.title}\n\n${payload.summary}`,
        eventType: payload.eventType,
      });
      const emailStatus = emailResult.success ? "SENT" : "FAILED";
      if (!emailResult.success) {
        result.success = false;
      }
      await prisma.outboundNotification.update({
        where: { id: outboxRow.id },
        data: {
          status: emailStatus,
          externalId: emailResult.messageId || correlationId,
          payload: JSON.stringify({
            correlationId,
            state: emailStatus,
            dispatchedAt: new Date().toISOString(),
            messageId: emailResult.messageId || null,
            subject: payload.title,
          }),
        },
      });
      result.emailStatus = emailStatus;
    } catch (err: any) {
      result.emailStatus = "FAILED";
      result.success = false;
      await prisma.outboundNotification.update({
        where: { id: outboxRow.id },
        data: {
          status: "FAILED",
          payload: JSON.stringify({
            correlationId,
            state: "FAILED",
            dispatchedAt: new Date().toISOString(),
            errorReason: err?.message || "Email dispatch failed",
            subject: payload.title,
          }),
        },
      });
    }
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
  subsidiaryName?: string;
  justification?: string;
  recipientPhone?: string;
  correlationId?: string;
}) {
  const correlationId = params.correlationId || `req_alert_${params.requestNumber}_${Date.now()}`;

  let recipientPhone = params.recipientPhone?.trim() || "";
  if (!recipientPhone) {
    try {
      const gmd = await prisma.employee.findFirst({
        where: { role: "GMD", status: "ACTIVE" },
        select: { phone: true },
      });
      if (gmd?.phone) recipientPhone = gmd.phone.trim();
    } catch {}
  }
  if (!recipientPhone) {
    recipientPhone = process.env.GMD_WHATSAPP_PHONE?.trim() || "";
  }

  // Dispatch multi-channel bridge (Slack + WhatsApp)
  const bridgePromise = dispatchNotificationBridge({
    channel: "BOTH",
    recipient: recipientPhone,
    eventType: "APPROVAL_REQUESTED",
    title: `Pending Approval: ${params.title}`,
    summary: `${params.requesterName} submitted a fund request of ₦${(params.amountMinor / 100).toLocaleString()} requiring ${params.approverRole} review.`,
    correlationId,
    metadata: {
      requestNumber: params.requestNumber,
      amountMinor: params.amountMinor,
      approverRole: params.approverRole,
      requesterName: params.requesterName,
      correlationId,
    },
  });

  // Always send real-time executive notification emails to GMD & System Admin
  const emailPromise = (async () => {
    try {
      const execs = await getExecutiveRecipients();
      for (let i = 0; i < execs.length; i++) {
        const exec = execs[i];
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 600));
        }
        await sendGmdRequisitionAlert({
          gmdEmail: exec.email,
          gmdName: exec.name,
          requestNumber: params.requestNumber,
          requesterName: params.requesterName,
          subsidiaryName: params.subsidiaryName || "BEMS Group",
          category: params.title,
          amountMinor: params.amountMinor,
          justification: params.justification || "Official expenditure request awaiting review.",
          approverRole: params.approverRole,
        }).catch((err) => console.error(`Failed to dispatch alert to ${exec.email}:`, err));
      }
    } catch (err) {
      console.error("Failed to dispatch GMD requisition email:", err);
    }
  })();

  const [bridgeResult] = await Promise.all([bridgePromise, emailPromise]);
  return bridgeResult;
}

export async function notifyRetirementWarning(params: {
  requestNumber: string;
  employeeName: string;
  recipientPhone: string;
  hoursRemaining: number;
  correlationId?: string;
}) {
  return dispatchNotificationBridge({
    channel: "WHATSAPP",
    recipient: params.recipientPhone,
    eventType: "RETIREMENT_WARNING",
    title: "Accountability SLA Warning",
    summary: `Hello ${params.employeeName}, your advance for ${params.requestNumber} requires itemized retirement deliverables. You have ${params.hoursRemaining} hours remaining before automated escalation.`,
    correlationId: params.correlationId || `retire_warn_${params.requestNumber}_${Date.now()}`,
    metadata: {
      requestNumber: params.requestNumber,
      hoursRemaining: params.hoursRemaining,
    },
  });
}
