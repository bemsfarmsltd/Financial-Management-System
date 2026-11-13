import { NextResponse } from "next/server";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";
import { buildAndSendGmdMorningDigest } from "@/lib/notifications/morning-digest";

export const dynamic = "force-dynamic";

async function authorizeCronOrExecutive(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET?.trim() || process.env.N8N_API_KEY?.trim() || "";
  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || req.headers.get("x-api-key") || "";

  if (cronSecret && (authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret)) {
    return true;
  }

  const actor = await getAuthenticatedEmployee(req);
  if (actor && hasAnyRole(actor, ["GMD", "SUPER_ADMIN", "SYSTEM_ADMIN"])) {
    return true;
  }

  return false;
}

export async function GET(req: Request) {
  try {
    const authorized = await authorizeCronOrExecutive(req);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized cron or executive trigger." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const result = await buildAndSendGmdMorningDigest({ force });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[MorningDigest Cron] GET failed:", error);
    return NextResponse.json({ error: error?.message || "Morning digest failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authorized = await authorizeCronOrExecutive(req);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized cron or executive trigger." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const force = Boolean(body?.force) || searchParams.get("force") === "true";
    const result = await buildAndSendGmdMorningDigest({ force });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[MorningDigest Cron] POST failed:", error);
    return NextResponse.json({ error: error?.message || "Morning digest failed." }, { status: 500 });
  }
}

