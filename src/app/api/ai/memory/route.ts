import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee } from "@/lib/auth";
import { cleanMarkdownTables } from "@/lib/ai/markdown-normalizer";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/ai/memory?session_id=...&limit=20
 * Retrieves conversation memory for a session
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ ok: false, error_code: "NOT_PERMITTED", message: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const defaultSessionId = (!scope || scope === 'group_hq' || scope === 'bems-group-hq' || scope === 'ALL')
      ? `conv_${actor.id}`
      : `conv_${actor.id}_${scope}`;
    const sessionId = searchParams.get("session_id") || defaultSessionId;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "40", 10), 1), 100);
    const mode = searchParams.get("mode");

    // Mode: return all distinct sessions for this actor
    if (mode === "sessions") {
      const sessionPrefix = `conv_${actor.id}%`;
      const sessionRows = await prisma.$queryRaw<Array<{ session_id: string; total_turns: bigint; latest_at: Date }>>`
        SELECT session_id, COUNT(*) as total_turns, MAX(created_at) as latest_at
        FROM n8n_chat_histories
        WHERE session_id LIKE ${sessionPrefix} OR session_id = ${`conv_${actor.id}`}
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

    // Query n8n_chat_histories in reverse order to get the latest turns, then order chronologically
    const rows = await prisma.$queryRaw<Array<{ id: number; session_id: string; message: any; created_at: Date }>>`
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
      return {
        id: r.id,
        ...parsed,
        created_at: r.created_at,
      };
    });

    return NextResponse.json({
      ok: true,
      session_id: sessionId,
      count: messages.length,
      retention: "30_days",
      messages,
    });
  } catch (error: any) {
    console.error("Memory GET error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to fetch memory." }, { status: 500 });
  }
}

/**
 * POST /api/v1/ai/memory
 * Appends a message turn to conversation memory and enforces 30-day retention
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ ok: false, error_code: "NOT_PERMITTED", message: "Authentication required." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = body.session_id || (actor ? `conv_${actor.id}` : "");
    const role = (body.role || (body.message && body.message.role) || "assistant").toLowerCase();
    const content = body.content || body.text || (typeof body.message === "string" ? body.message : body.message?.content || "");

    if (!sessionId || !content) {
      return NextResponse.json(
        { ok: false, error_code: "VALIDATION_FAILED", message: "session_id and message/content are required." },
        { status: 400 }
      );
    }

    const messageObj = {
      role,
      content,
      actor_id: actor.id,
      timestamp: new Date().toISOString(),
      ...(body.metadata || {}),
    };

    // Insert into n8n_chat_histories
    await prisma.$executeRaw`
      INSERT INTO n8n_chat_histories (session_id, message, created_at)
      VALUES (${sessionId}, ${JSON.stringify(messageObj)}::jsonb, NOW())
    `;

    // Asynchronously purge messages older than 30 days
    prisma.$executeRaw`
      DELETE FROM n8n_chat_histories
      WHERE created_at < NOW() - INTERVAL '30 days'
    `.catch((err) => console.error("Retention purge error:", err));

    return NextResponse.json({
      ok: true,
      session_id: sessionId,
      role,
      status: "PERSISTED",
      retention_window: "30_days",
    });
  } catch (error: any) {
    console.error("Memory POST error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to save memory." }, { status: 500 });
  }
}
