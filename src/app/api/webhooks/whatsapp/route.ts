import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { executeDashboardCommand } from "@/lib/staged-actions";

export const dynamic = "force-dynamic";

function normalizeLast10Digits(phone: string | null | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/**
 * Send an outbound WhatsApp text message via Meta Cloud API
 */
async function sendWhatsAppReply(to: string, bodyText: string): Promise<boolean> {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_ID?.trim();
  const version = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v21.0";

  if (!token || !phoneId) {
    console.error("[WhatsApp Webhook] Outbound credentials missing (WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID).");
    return false;
  }

  const cleanPhone = to.replace(/[^0-9]/g, "");
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: bodyText },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[WhatsApp Webhook] Outbound reply failed:", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp Webhook] Outbound network error:", err);
    return false;
  }
}

/**
 * WhatsApp Cloud API Webhook Verification Challenge
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!verifyToken) {
    return NextResponse.json(
      { error: "WhatsApp webhook verification is disabled: WHATSAPP_VERIFY_TOKEN is not configured." },
      { status: 503 }
    );
  }

  if (mode === "subscribe" && token && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Inbound WhatsApp two-way interactive message processor
 */
export async function POST(request: Request) {
  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
    const signatureHeader = request.headers.get("x-hub-signature-256");

    const rawBody = await request.text();

    // Verify HMAC signature only if WHATSAPP_APP_SECRET is configured
    if (appSecret) {
      if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
        return NextResponse.json({ error: "Missing or invalid X-Hub-Signature-256 header." }, { status: 401 });
      }

      const expectedSignature = `sha256=${crypto
        .createHmac("sha256", appSecret)
        .update(rawBody, "utf8")
        .digest("hex")}`;

      const sigBuf = Buffer.from(signatureHeader, "utf8");
      const expectedBuf = Buffer.from(expectedSignature, "utf8");
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return NextResponse.json({ error: "Invalid WhatsApp webhook HMAC signature." }, { status: 401 });
      }
    }

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const messages = value?.messages;

    // Delivery statuses (sent, delivered, read) do not contain a messages array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ status: "STATUS_UPDATE_ACK" }, { status: 200 });
    }

    const message = messages[0];
    const senderRawPhone = String(message.from || "");
    const msgType = message.type;
    const incomingText = (
      msgType === "text"
        ? message.text?.body
        : message.button?.text || message.interactive?.button_reply?.title || ""
    ).trim();

    if (!incomingText) {
      return NextResponse.json({ status: "EMPTY_MESSAGE_ACK" }, { status: 200 });
    }

    const senderDigits10 = normalizeLast10Digits(senderRawPhone);
    const gmdPhoneDigits10 = normalizeLast10Digits(process.env.GMD_WHATSAPP_PHONE);

    // 1. Resolve employee identity (GMD fallback or database phone lookup)
    let employee = null;
    if (gmdPhoneDigits10 && senderDigits10 === gmdPhoneDigits10) {
      employee = await prisma.employee.findFirst({
        where: { role: "GMD", status: "ACTIVE" },
      });
    }

    if (!employee && senderDigits10) {
      const candidates = await prisma.employee.findMany({
        where: {
          status: "ACTIVE",
          approvalStatus: "APPROVED",
          phone: { not: null },
        },
      });
      employee = candidates.find((c) => normalizeLast10Digits(c.phone) === senderDigits10) || null;
    }

    // 2. Authorization validation
    if (!employee) {
      await sendWhatsAppReply(
        senderRawPhone,
        `❌ *Access Denied*\n\nYour WhatsApp number (+${senderRawPhone}) is not linked to an active executive account in BEMS ERP.\n\nPlease update your phone number in your ERP staff profile to enable WhatsApp approvals.`
      );
      return NextResponse.json({ status: "UNAUTHORIZED_PHONE" }, { status: 200 });
    }

    if (!["GMD", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(employee.role)) {
      await sendWhatsAppReply(
        senderRawPhone,
        `❌ *Unauthorized Role*\n\nWhatsApp approvals are restricted to the Group Managing Director (GMD) and Executive Administrators.`
      );
      return NextResponse.json({ status: "FORBIDDEN_ROLE" }, { status: 200 });
    }

    const command = incomingText.trim();

    // -------------------------------------------------------------
    // COMMAND 1: 4-digit PIN Entry (answering an active approval challenge)
    // -------------------------------------------------------------
    if (/^\d{4}$/.test(command)) {
      const pin = command;

      // Find an active pending challenge for this executive created within the last 5 minutes
      const activeChallenge = await prisma.outboundNotification.findFirst({
        where: {
          channel: "WHATSAPP_CHALLENGE",
          recipient: employee.id,
          status: "PENDING",
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!activeChallenge) {
        await sendWhatsAppReply(
          senderRawPhone,
          `⚠️ *No Active Approval Challenge*\n\nThere is no requisition waiting for PIN authorization right now (approval sessions expire after 5 minutes).\n\nReply *PENDING* to see pending requests, or *APPROVE <Request#>* to begin.`
        );
        return NextResponse.json({ status: "NO_ACTIVE_CHALLENGE" }, { status: 200 });
      }

      if (!employee.securityPinHash) {
        await sendWhatsAppReply(
          senderRawPhone,
          `🔐 *Security PIN Not Set*\n\nYou have not set your 4-digit Security PIN yet.\n\nReply:\n*SETPIN <4-digit PIN>*\n(Example: *SETPIN 1234*)`
        );
        return NextResponse.json({ status: "PIN_NOT_SET" }, { status: 200 });
      }

      const isPinValid = await verifyPassword(pin, employee.securityPinHash);
      if (!isPinValid) {
        await sendWhatsAppReply(
          senderRawPhone,
          `❌ *Incorrect Security PIN*\n\nThe 4-digit PIN you entered is invalid. Please try again with your correct PIN, or reply *HELP*.`
        );
        return NextResponse.json({ status: "INVALID_PIN" }, { status: 200 });
      }

      // PIN is valid - Mark challenge as RESOLVED and execute approval
      await prisma.outboundNotification.update({
        where: { id: activeChallenge.id },
        data: { status: "RESOLVED" },
      });

      let challengeData: any = {};
      try {
        challengeData = JSON.parse(activeChallenge.payload);
      } catch {
        challengeData = {};
      }

      const targetRequestId = challengeData.requestId;
      const targetRequestNumber = challengeData.requestNumber || "Request";

      const actor = {
        id: employee.id,
        legalName: employee.legalName,
        role: employee.role,
        employeeNumber: employee.employeeNumber,
      };

      try {
        await executeDashboardCommand(actor, "approval_decision", {
          request_id: targetRequestId,
          decision: "APPROVED",
          reason: "Approved via WhatsApp with 2FA Security PIN",
        });

        const formattedAmt = challengeData.amountMinor
          ? (Number(challengeData.amountMinor) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })
          : "N/A";

        await sendWhatsAppReply(
          senderRawPhone,
          `✅ *Requisition Approved Successfully*\n\n• Reference: *${targetRequestNumber}*\n• Title: *${challengeData.title || "Expenditure Request"}*\n• Amount: *₦${formattedAmt}*\n• Authorized By: *${employee.legalName} (${employee.role})*\n• Status: *APPROVED*\n\nThe payment has been authorized and queued for Finance disbursement.`
        );

        return NextResponse.json({ status: "APPROVED_VIA_PIN" }, { status: 200 });
      } catch (execErr: any) {
        console.error("[WhatsApp Webhook] Approval execution failed:", execErr);
        await sendWhatsAppReply(
          senderRawPhone,
          `⚠️ *Approval Failed*: ${execErr?.message || "Internal system error occurred while updating the request."}`
        );
        return NextResponse.json({ error: execErr?.message || "Execution error" }, { status: 400 });
      }
    }

    // -------------------------------------------------------------
    // COMMAND 2: SETPIN <4-digit PIN>
    // -------------------------------------------------------------
    const setPinMatch = command.match(/^(?:SETPIN|SET PIN|PIN)\s+(\d{4})$/i);
    if (setPinMatch) {
      const newPin = setPinMatch[1];
      const pinHash = await hashPassword(newPin);

      await prisma.employee.update({
        where: { id: employee.id },
        data: { securityPinHash: pinHash },
      });

      await sendWhatsAppReply(
        senderRawPhone,
        `🔒 *Security PIN Updated Successfully*\n\nYour 4-digit approval PIN is now active.\n\nYou can now approve expenditure requests securely by replying with this PIN whenever prompted.`
      );

      return NextResponse.json({ status: "PIN_SET_SUCCESS" }, { status: 200 });
    }

    // -------------------------------------------------------------
    // COMMAND 3: APPROVE <Request#>
    // -------------------------------------------------------------
    const approveMatch = command.match(/^(?:APPROVE|ACCEPT)\s*(.*)$/i);
    if (approveMatch) {
      const identifier = approveMatch[1]?.trim();
      if (!identifier) {
        await sendWhatsAppReply(
          senderRawPhone,
          `⚠️ Please specify the request number.\nExample: *APPROVE REQ-2026-0006*\n\nReply *PENDING* to see requisitions awaiting approval.`
        );
        return NextResponse.json({ status: "MISSING_IDENTIFIER" }, { status: 200 });
      }

      const req = await prisma.expenditureRequest.findFirst({
        where: {
          OR: [
            { requestNumber: { equals: identifier, mode: "insensitive" } },
            { requestNumber: { contains: identifier, mode: "insensitive" } },
            { id: identifier },
          ],
        },
        include: { requester: true },
        orderBy: { createdAt: "desc" },
      });

      if (!req) {
        await sendWhatsAppReply(
          senderRawPhone,
          `⚠️ Requisition *"${identifier}"* was not found.\n\nReply *PENDING* to see list of active requests awaiting your approval.`
        );
        return NextResponse.json({ status: "NOT_FOUND" }, { status: 200 });
      }

      if (req.approvalStatus === "APPROVED") {
        await sendWhatsAppReply(
          senderRawPhone,
          `ℹ️ Requisition *${req.requestNumber}* is already *APPROVED*.`
        );
        return NextResponse.json({ status: "ALREADY_APPROVED" }, { status: 200 });
      }

      if (req.approvalStatus === "REJECTED") {
        await sendWhatsAppReply(
          senderRawPhone,
          `ℹ️ Requisition *${req.requestNumber}* has already been *DECLINED*.`
        );
        return NextResponse.json({ status: "ALREADY_REJECTED" }, { status: 200 });
      }

      // Check if employee has a Security PIN configured
      if (!employee.securityPinHash) {
        await sendWhatsAppReply(
          senderRawPhone,
          `🔐 *Security PIN Setup Required*\n\nBefore approving *${req.requestNumber}*, you must set your 4-digit WhatsApp Security PIN.\n\nPlease reply:\n*SETPIN <4-digit PIN>*\n(Example: *SETPIN 1234*)`
        );
        return NextResponse.json({ status: "PIN_REQUIRED" }, { status: 200 });
      }

      // Expire previous pending challenges for this user
      await prisma.outboundNotification.updateMany({
        where: {
          channel: "WHATSAPP_CHALLENGE",
          recipient: employee.id,
          status: "PENDING",
        },
        data: { status: "EXPIRED" },
      });

      // Create a fresh 5-minute approval challenge
      await prisma.outboundNotification.create({
        data: {
          channel: "WHATSAPP_CHALLENGE",
          recipient: employee.id,
          eventType: "PENDING_APPROVAL",
          payload: JSON.stringify({
            requestId: req.id,
            requestNumber: req.requestNumber,
            amountMinor: req.amountMinor.toString(),
            title: req.title,
            expiresAt: Date.now() + 5 * 60 * 1000,
          }),
          status: "PENDING",
        },
      });

      const formattedAmt = (Number(req.amountMinor) / 100).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
      });

      await sendWhatsAppReply(
        senderRawPhone,
        `🔐 *Authorization Challenge*\n\n• Request: *${req.requestNumber}*\n• Title: *${req.title}*\n• Amount: *₦${formattedAmt}*\n• Requester: *${req.requester?.legalName || "Staff"}*\n\nPlease reply with your *4-digit Security PIN* within 5 minutes to confirm and authorize this requisition.`
      );

      return NextResponse.json({ status: "CHALLENGE_ISSUED" }, { status: 200 });
    }

    // -------------------------------------------------------------
    // COMMAND 4: DECLINE <Request#>
    // -------------------------------------------------------------
    const declineMatch = command.match(/^(?:DECLINE|REJECT)\s*(.*)$/i);
    if (declineMatch) {
      const identifier = declineMatch[1]?.trim();
      if (!identifier) {
        await sendWhatsAppReply(
          senderRawPhone,
          `⚠️ Please specify the request number.\nExample: *DECLINE REQ-2026-0006*`
        );
        return NextResponse.json({ status: "MISSING_IDENTIFIER" }, { status: 200 });
      }

      const req = await prisma.expenditureRequest.findFirst({
        where: {
          OR: [
            { requestNumber: { equals: identifier, mode: "insensitive" } },
            { requestNumber: { contains: identifier, mode: "insensitive" } },
            { id: identifier },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      if (!req) {
        await sendWhatsAppReply(
          senderRawPhone,
          `⚠️ Requisition *"${identifier}"* was not found.`
        );
        return NextResponse.json({ status: "NOT_FOUND" }, { status: 200 });
      }

      const actor = {
        id: employee.id,
        legalName: employee.legalName,
        role: employee.role,
        employeeNumber: employee.employeeNumber,
      };

      try {
        await executeDashboardCommand(actor, "approval_decision", {
          request_id: req.id,
          decision: "REJECT",
          reason: "Declined by executive via WhatsApp",
        });

        await sendWhatsAppReply(
          senderRawPhone,
          `❌ *Requisition Declined*\n\n• Reference: *${req.requestNumber}*\n• Status: *DECLINED*\n• Decided By: *${employee.legalName} (${employee.role})*\n\nThe requester and department have been notified.`
        );

        return NextResponse.json({ status: "DECLINED_SUCCESS" }, { status: 200 });
      } catch (err: any) {
        console.error("[WhatsApp Webhook] Decline failed:", err);
        await sendWhatsAppReply(
          senderRawPhone,
          `⚠️ *Decline Failed*: ${err?.message || "Internal system error"}`
        );
        return NextResponse.json({ error: err?.message }, { status: 400 });
      }
    }

    // -------------------------------------------------------------
    // COMMAND 5: PENDING / LIST (List requisitions awaiting decision)
    // -------------------------------------------------------------
    if (/^(?:PENDING|LIST|REQS|REQUESTS)$/i.test(command)) {
      const pendingReqs = await prisma.expenditureRequest.findMany({
        where: {
          approvalStatus: { in: ["SUBMITTED", "IN_REVIEW", "CLARIFICATION_REQUESTED"] },
        },
        include: { requester: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      if (pendingReqs.length === 0) {
        await sendWhatsAppReply(
          senderRawPhone,
          `🎉 *No Pending Requisitions*\n\nThere are currently no expenditure requests awaiting executive approval.`
        );
        return NextResponse.json({ status: "NO_PENDING" }, { status: 200 });
      }

      let listText = `📋 *Pending Requisitions (${pendingReqs.length})*\n\n`;
      pendingReqs.forEach((r, idx) => {
        const amt = (Number(r.amountMinor) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
        listText += `${idx + 1}. *${r.requestNumber}*\n   • ${r.title}\n   • Amount: ₦${amt}\n   • Requester: ${r.requester?.legalName || "Staff"}\n\n`;
      });
      listText += `Reply *APPROVE <Request#>* or *DECLINE <Request#>* to act.`;

      await sendWhatsAppReply(senderRawPhone, listText);
      return NextResponse.json({ status: "PENDING_LIST_SENT" }, { status: 200 });
    }

    // -------------------------------------------------------------
    // COMMAND 6: STATUS <Request#> (Check details of a request)
    // -------------------------------------------------------------
    const statusMatch = command.match(/^(?:STATUS|CHECK|VIEW)\s*(.*)$/i);
    if (statusMatch && statusMatch[1]?.trim()) {
      const identifier = statusMatch[1].trim();
      const req = await prisma.expenditureRequest.findFirst({
        where: {
          OR: [
            { requestNumber: { equals: identifier, mode: "insensitive" } },
            { requestNumber: { contains: identifier, mode: "insensitive" } },
            { id: identifier },
          ],
        },
        include: { requester: true },
      });

      if (!req) {
        await sendWhatsAppReply(senderRawPhone, `⚠️ Requisition *"${identifier}"* not found.`);
        return NextResponse.json({ status: "NOT_FOUND" }, { status: 200 });
      }

      const amt = (Number(req.amountMinor) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
      const statusText =
        `📋 *Requisition Status: ${req.requestNumber}*\n\n` +
        `• Title: *${req.title}*\n` +
        `• Amount: *₦${amt}*\n` +
        `• Category: *${req.category || "General"}*\n` +
        `• Approval: *${req.approvalStatus}*\n` +
        `• Payment: *${req.paymentStatus}*\n` +
        `• Requester: *${req.requester?.legalName || "Staff"}*\n` +
        `• Created: *${new Date(req.createdAt).toLocaleDateString("en-GB")}*`;

      await sendWhatsAppReply(senderRawPhone, statusText);
      return NextResponse.json({ status: "STATUS_SENT" }, { status: 200 });
    }

    // -------------------------------------------------------------
    // COMMAND 7: HELP / Guidance Fallback
    // -------------------------------------------------------------
    const hasPin = Boolean(employee.securityPinHash);
    const helpText =
      `👋 *BEMS ERP Executive Assistant*\n\n` +
      `Welcome ${employee.legalName} (${employee.role}).\n` +
      `PIN Status: ${hasPin ? "✅ Active" : "⚠️ Not set"}\n\n` +
      `*Available Commands:*\n` +
      `• *PENDING* - View requisitions awaiting approval\n` +
      `• *APPROVE <Request#>* - Authorize a request (e.g. *APPROVE REQ-2026-0006*)\n` +
      `• *DECLINE <Request#>* - Decline a request\n` +
      `• *STATUS <Request#>* - Check status of any request\n` +
      `• *SETPIN <4-digit PIN>* - ${hasPin ? "Update" : "Create"} your 4-digit approval PIN\n` +
      `• *HELP* - Show this menu`;

    await sendWhatsAppReply(senderRawPhone, helpText);
    return NextResponse.json({ status: "HELP_SENT" }, { status: 200 });
  } catch (error: any) {
    console.error("[WhatsApp Webhook] Handler error:", error);
    return NextResponse.json({ error: error.message || "Failed to process WhatsApp webhook" }, { status: 500 });
  }
}
