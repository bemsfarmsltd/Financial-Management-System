import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requestIdentifierWhere } from "@/lib/request-id";

export const dynamic = "force-dynamic";

function normalizeLast10Digits(phone: string | null | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
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
 * Inbound WhatsApp message processor
 */
export async function POST(request: Request) {
  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (!appSecret) {
      return NextResponse.json(
        { error: "WhatsApp webhook processing is disabled: WHATSAPP_APP_SECRET is not configured." },
        { status: 503 }
      );
    }

    const signatureHeader = request.headers.get("x-hub-signature-256");
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      return NextResponse.json({ error: "Missing or invalid X-Hub-Signature-256 header." }, { status: 401 });
    }

    const rawBody = await request.text();
    const expectedSignature = `sha256=${crypto
      .createHmac("sha256", appSecret)
      .update(rawBody, "utf8")
      .digest("hex")}`;

    const sigBuf = Buffer.from(signatureHeader, "utf8");
    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return NextResponse.json({ error: "Invalid WhatsApp webhook HMAC signature." }, { status: 401 });
    }

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    return NextResponse.json({ status: 'HUMAN_CONFIRMATION_REQUIRED', message: 'Review and approve the staged action in BEMI.', url: (process.env.NEXT_PUBLIC_APP_URL || 'https://bemserp.work') + '/finance' });
  } catch (error: any) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ error: error.message || "Failed to process WhatsApp webhook" }, { status: 500 });
  }
}
