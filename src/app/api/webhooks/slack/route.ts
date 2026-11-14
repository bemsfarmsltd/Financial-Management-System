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

    return NextResponse.json({ status: 'HUMAN_CONFIRMATION_REQUIRED', text: 'Open BEMi in the executive workspace to review the request and click its approval button.', url: (process.env.NEXT_PUBLIC_APP_URL || 'https://bemserp.work') + '/finance' });
  } catch (error: any) {
    console.error("Slack webhook handler error:", error);
    return NextResponse.json({ error: error.message || "Failed to process Slack action" }, { status: 500 });
  }
}
