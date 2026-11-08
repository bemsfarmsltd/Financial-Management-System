import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee } from "@/lib/auth";
import { cleanMarkdownTables } from "@/lib/ai/markdown-normalizer";
import { redactUntrustedAndSensitiveFields } from "@/lib/platform/read-catalog";

export const dynamic = "force-dynamic";

const RETENTION_PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let lastRetentionPurgeAtMs = 0;

function maybeRunScheduledChatRetentionPurge() {
  const now = Date.now();
  if (now - lastRetentionPurgeAtMs < RETENTION_PURGE_INTERVAL_MS) {
    return;
  }
  lastRetentionPurgeAtMs = now;
  prisma.$executeRaw`
    DELETE FROM n8n_chat_histories
    WHERE created_at < NOW() - INTERVAL '30 days'
  `.catch((err) => console.error("[AI Memory] Scheduled retention purge error:", err));
}

function isAuthorizedSessionForActor(sessionId: string, actorId: string): boolean {
  return sessionId === `conv_${actorId}` || sessionId.startsWith(`conv_${actorId}_`);
}

function sanitizeAllowedMetadata(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const safe: Record<string, string> = {};
  for (const key of ["staged_action_id", "correlation_id", "scope_id"]) {
    const val = source[key];
    if (typeof val === "string" && val.trim().length > 0 && val.length <= 128) {
      safe[key] = val.trim();
    }
  }
  return safe;
}

/**
 * GET /api/v1/ai/memory?session_id=...&limit=40&before_id=...
 * Retrieves conversation memory for an owned session with indexed cursor pagination
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (actor && actor.role !== 'GMD') return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access is exclusively for the GMD.'},{status:403});
    if (!actor) {
      return NextResponse.json({ ok: false, error_code: "NOT_PERMITTED", message: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const defaultSessionId = (!scope || scope === "group_hq" || scope === "bems-group-hq" || scope === "ALL")
      ? `conv_${actor.id}`
      : `conv_${actor.id}_${scope}`;
    const sessionId = searchParams.get("session_id") || defaultSessionId;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "40", 10), 1), 100);
    const beforeIdRaw = searchParams.get("before_id");
    const beforeId = beforeIdRaw ? parseInt(beforeIdRaw, 10) : null;
    const mode = searchParams.get("mode");

    // Mode: return all distinct sessions owned by this actor
    if (mode === "sessions") {
      const sessionPrefix = scope ? `conv_${actor.id}_${["group_hq", "bems-group-hq", "ALL"].includes(scope) ? "group" : scope}_` : `conv_${actor.id}_`;
      const sessionRows = await prisma.$queryRaw<Array<{ session_id: string; total_turns: bigint; latest_at: Date }>>`
        SELECT session_id, COUNT(*) as total_turns, MAX(created_at) as latest_at
        FROM n8n_chat_histories
        WHERE LEFT(session_id, LENGTH(${sessionPrefix})) = ${sessionPrefix} OR (${!scope || ["group_hq", "bems-group-hq", "ALL"].includes(scope)} AND session_id = ${`conv_${actor.id}`})
        GROUP BY session_id
        ORDER BY MAX(created_at) DESC
        LIMIT 25
      `;

      const sessions = await Promise.all(
        sessionRows.map(async (s) => {
          const firstUserMsg = await prisma.$queryRaw<Array<{ message: any }>>`
            SELECT message FROM n8n_chat_histories
            WHERE session_id = ${s.session_id}
            ORDER BY id ASC
            LIMIT 2
          `;
          let snippet = "Executive Financial Oversight";
          if (firstUserMsg && firstUserMsg.length > 0) {
            for (const r of firstUserMsg) {
              let m = r.message;
              if (typeof m === "string") {
                try { m = JSON.parse(m); } catch {}
              }
              if (m && m.role === "user" && m.content) {
                snippet = m.content.slice(0, 50);
                break;
              }
            }
          }

          return {
            id: s.session_id,
            title: snippet,
            turnsCount: Number(s.total_turns),
            updatedAt: s.latest_at,
          };
        })
      );

      return NextResponse.json({ ok: true, sessions });
    }

    if (!sessionId) {
      return NextResponse.json({ ok: false, error_code: "VALIDATION_FAILED", message: "session_id query param is required." }, { status: 400 });
    }

    if (!isAuthorizedSessionForActor(sessionId, actor.id)) {
      return NextResponse.json(
        { ok: false, error_code: "NOT_PERMITTED", message: "Access denied: session_id does not belong to the authenticated actor." },
        { status: 403 }
      );
    }

    const rows = (beforeId !== null && Number.isFinite(beforeId) && beforeId > 0)
      ? await prisma.$queryRaw<Array<{ id: number; session_id: string; message: any; created_at: Date }>>`
          SELECT id, session_id, message, created_at
          FROM (
            SELECT id, session_id, message, created_at
            FROM n8n_chat_histories
            WHERE session_id = ${sessionId} AND id < ${beforeId}
            ORDER BY id DESC
            LIMIT ${limit}
          ) sub
          ORDER BY id ASC
        `
      : await prisma.$queryRaw<Array<{ id: number; session_id: string; message: any; created_at: Date }>>`
          SELECT id, session_id, message, created_at
          FROM (
            SELECT id, session_id, message, created_at
            FROM n8n_chat_histories
            WHERE session_id = ${sessionId}
            ORDER BY id DESC
            LIMIT ${limit}
          ) sub
          ORDER BY id ASC
        `;

    const messages = rows.map((r) => {
      let parsed = r.message;
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          parsed = { role: "unknown", content: parsed };
        }
      }
      if (parsed && typeof parsed.content === "string") {
        parsed.content = cleanMarkdownTables(parsed.content);
      }
      return redactUntrustedAndSensitiveFields({
        id: r.id,
        ...parsed,
        created_at: r.created_at,
      });
    });

    const nextBeforeId = rows.length > 0 ? rows[0].id : null;

    return NextResponse.json({
      ok: true,
      session_id: sessionId,
      count: messages.length,
      next_before_id: nextBeforeId,
      has_more: rows.length === limit,
      retention: "30_days",
      messages,
    });
  } catch (error: any) {
    console.error("[AI Memory] GET error:", error?.message || "Unknown error");
    return NextResponse.json({ ok: false, error: "Failed to fetch conversation memory." }, { status: 500 });
  }
}

/**
 * POST /api/v1/ai/memory
 * Appends a verified turn to conversation memory with strict role & metadata binding
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (actor && actor.role !== 'GMD') return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access is exclusively for the GMD.'},{status:403});
    if (!actor) {
      return NextResponse.json({ ok: false, error_code: "NOT_PERMITTED", message: "Authentication required." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || (actor ? `conv_${actor.id}` : "")).trim();
    const requestedRole = String(body.role || (body.message && body.message.role) || "").trim().toLowerCase();
    const rawContent = body.content || body.text || (typeof body.message === "string" ? body.message : body.message?.content || "");
    const content = String(rawContent || "").trim();

    if (!sessionId || !content) {
      return NextResponse.json(
        { ok: false, error_code: "VALIDATION_FAILED", message: "session_id and message/content are required." },
        { status: 400 }
      );
    }

    if (!isAuthorizedSessionForActor(sessionId, actor.id)) {
      return NextResponse.json(
        { ok: false, error_code: "NOT_PERMITTED", message: "Access denied: session_id does not belong to the authenticated actor." },
        { status: 403 }
      );
    }

    if (requestedRole === "system" || requestedRole === "developer" || requestedRole === "tool") {
      return NextResponse.json(
        { ok: false, error_code: "NOT_PERMITTED", message: "System or tool roles cannot be injected via memory API." },
        { status: 403 }
      );
    }

    const boundRole = 'user' as const;
    const isAutomationPrincipal = false;

    const safeMeta = sanitizeAllowedMetadata(body.metadata);

    const messageObj = redactUntrustedAndSensitiveFields({
      ...safeMeta,
      role: boundRole,
      content: content.slice(0, 16000),
      actor_id: actor.id,
      auth_source: isAutomationPrincipal ? "automation_delegated" : "session",
      timestamp: new Date().toISOString(),
    });

    await prisma.$executeRaw`
      INSERT INTO n8n_chat_histories (session_id, message, created_at)
      VALUES (${sessionId}, ${JSON.stringify(messageObj)}::jsonb, NOW())
    `;

    maybeRunScheduledChatRetentionPurge();

    return NextResponse.json({
      ok: true,
      session_id: sessionId,
      role: boundRole,
      status: "PERSISTED",
      retention_window: "30_days",
    });
  } catch (error: any) {
    console.error("[AI Memory] POST error:", error?.message || "Unknown error");
    return NextResponse.json({ ok: false, error: "Failed to persist conversation memory." }, { status: 500 });
  }
}
