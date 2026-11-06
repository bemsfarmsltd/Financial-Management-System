import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { getConsolidatedTreasury } from '@/lib/financial-metrics';
import { enforceMobileVersionGate } from '@/lib/mobile-gate';
import { checkAiScopeOrResponse } from '@/lib/ai-access-control';

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

import { cleanMarkdownTables } from '@/lib/ai/markdown-normalizer';

/**
 * Normalizes Markdown text structure, especially tables and whitespace,
 * ensuring clean row separation and consistent card/table rendering across Web and Mobile.
 */
function normalizeMarkdownStructure(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  return cleanMarkdownTables(raw);
}

export const maxDuration = 120; // Allow up to 120 seconds for multi-step AI reasoning and tool calls

export async function POST(req: NextRequest) {
  try {
    const gateBlock = await enforceMobileVersionGate(req);
    if (gateBlock) return gateBlock;

    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized: Valid BEMS session required to use AI Assistant.' }, { status: 401 });
    }

    const contextScopeBlocked = await checkAiScopeOrResponse('context', 'read');
    if (contextScopeBlocked) return contextScopeBlocked;

    const body = await req.json().catch(() => ({}));
    const message: string = (body.message || '').trim();
    const targetElement = body.context?.target_element;

    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }

    const userName = actor.legalName.split(' ')[0] || 'User';
    const normalized = message.toLowerCase();
    const isExecutive = hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
    const isReadOnlyUser = !isExecutive;

    const rawBusinessId = (body.context?.active_business_id || '').trim();

    // Resolve target subsidiary if in a scoped workspace
    let targetOrg = null;
    if (rawBusinessId && rawBusinessId !== 'bems-group-hq' && rawBusinessId !== 'ALL' && rawBusinessId !== 'group_hq') {
      targetOrg = await prisma.organization.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [
            { id: rawBusinessId },
            { code: rawBusinessId },
            { legalName: { equals: rawBusinessId, mode: 'insensitive' } },
          ],
        },
      });
    }

    const isGroupScope = !targetOrg || targetOrg.type === 'GROUP' || targetOrg.code === 'BEMS-GROUP';
    const scopedOrgId = !isGroupScope ? targetOrg?.id : null;
    const scopedOrgName = !isGroupScope ? targetOrg?.legalName : 'BEMS Group';
    const scopedOrgCode = !isGroupScope ? targetOrg?.code : 'BEMS-GROUP';

    // Boundary Protection: If inside a scoped subsidiary, prevent probing outside that subsidiary
    if (!isGroupScope && scopedOrgId) {
      const allActiveOrgs = await prisma.organization.findMany({ where: { status: 'ACTIVE' } });
      const otherSubsidiaries = allActiveOrgs.filter((o) => o.id !== scopedOrgId && o.type !== 'GROUP');
      const mentionedOther = otherSubsidiaries.find((o) => {
        const nameLower = o.legalName.toLowerCase();
        const codeLower = o.code.toLowerCase();
        return (
          normalized.includes(nameLower) ||
          normalized.includes(codeLower) ||
          (o.code === 'BBH' && (normalized.includes('bemssoft') || normalized.includes('bems soft'))) ||
          (o.code === 'BSA' && (normalized.includes('arella') || normalized.includes('studio arella'))) ||
          (o.code === 'BEDU' && (normalized.includes('bedu') || normalized.includes('institute') || normalized.includes('vocational'))) ||
          (o.code === 'BAGRO' && (normalized.includes('bems farm') || normalized.includes('bems farms') || normalized.includes('agro'))) ||
          (o.code === 'BTECH' && (normalized.includes('smartairs') || normalized.includes('smart airs')))
        );
      });

      if (mentionedOther) {
        return NextResponse.json({
          message: `🔒 **Subsidiary Boundary Enforcement**\n\nYou are currently operating inside the workspace of **${scopedOrgName}**.\n\nI am strictly partitioned to only access data, bank balances, budgets, staff dossiers, and requisitions belonging to **${scopedOrgName}**.\n\nTo view financial data, budgets, or records for **${mentionedOther.legalName}**, please switch your workspace using the workspace switcher in the top navigation, or select **BEMS Group (Holding & Conglomerate HQ)** to inspect consolidated group operations.`,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }

    // 0. Forward to external n8n AI Agent if configured (BEMS AI Backend Contract Section 02)
    const n8nWebhookUrl = process.env.N8N_AI_WEBHOOK_URL;
    if (n8nWebhookUrl && actor) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000); // 120 seconds for deep reasoning

        const correlationId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const sessionId = isGroupScope ? `conv_${actor.id}` : `conv_${actor.id}_${scopedOrgId}`;

        // Provide valid service token so n8n tools can query BEMS APIs seamlessly
        const authToken = process.env.BEMS_AI_SERVICE_TOKEN || '';

        // Fetch recent conversation history from BEMS PostgreSQL memory
        let conversationHistory: any[] = [];
        try {
          const rows = await prisma.$queryRaw<Array<{ id: number; message: any; created_at: Date }>>`
            SELECT id, message, created_at
            FROM n8n_chat_histories
            WHERE session_id = ${sessionId}
            ORDER BY id DESC
            LIMIT 10
          `;
          conversationHistory = rows.reverse().map((r) => {
            let m = r.message;
            if (typeof m === 'string') {
              try { m = JSON.parse(m); } catch {}
            }
            return m;
          });
        } catch (e) {
          console.warn('Could not load memory history:', e);
        }

        // Persist incoming user turn to memory
        try {
          await prisma.$executeRaw`
            INSERT INTO n8n_chat_histories (session_id, message, created_at)
            VALUES (${sessionId}, ${JSON.stringify({ role: 'user', content: message, timestamp: new Date().toISOString() })}::jsonb, NOW())
          `;
        } catch (e) {
          console.warn('Could not persist user chat to memory:', e);
        }

        // Conversational Proposal Selector (Never auto-executes or extends expiry via generic text;
        // instead re-surfaces the active pending proposal card so an authorized human clicks the Approve button)
        const trimmedNorm = message.trim().toLowerCase();
        const isConversationalApproval = [
          'just approve it',
          'approve it',
          'approve',
          'yes approve',
          'confirm',
          'implement it',
          '2. implement it',
          'execute it',
          'authorize',
          'yes implement',
          'yes, implement',
          'go ahead and approve',
          'proceed and approve',
        ].includes(trimmedNorm) || (
          (trimmedNorm.startsWith('approve') || trimmedNorm.startsWith('confirm') || trimmedNorm.startsWith('implement')) &&
          trimmedNorm.length < 35
        );

        if (isConversationalApproval && !isReadOnlyUser && hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
          const pendingAction = await prisma.stagedAction.findFirst({
            where: {
              userId: actor.id,
              status: 'PENDING',
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (pendingAction) {
            let previewObj: Record<string, any> = {};
            try {
              previewObj = pendingAction.previewJson ? JSON.parse(pendingAction.previewJson) : {};
            } catch {}

            const promptMsg = `🔒 **Human Button Confirmation Required**\n\nTo commit **${pendingAction.summary}**, please review the staged proposal card below and click the **Authorize & Execute Action** button directly.`;
            return NextResponse.json({
              message: promptMsg,
              actionCard: {
                type: pendingAction.actionType,
                cardType: 'STAGED_ACTION',
                staged_action_id: pendingAction.id,
                confirmation_hash: pendingAction.confirmationHash,
                summary: pendingAction.summary,
                action_type: pendingAction.actionType,
                expires_at: pendingAction.expiresAt.toISOString(),
                payload_preview: previewObj,
                confirmed: false,
              },
              timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            });
          }
        }

        const webhookSecret = process.env.BEMS_N8N_SHARED_SECRET || 'bems_n8n_sec_88491029384756102938475';

        let queryText = message;
        if (targetElement) {
          queryText = `[User clicked element: "${targetElement.label}" with value "${targetElement.value || 'N/A'}" under section "${targetElement.section || 'General'}" on page "${targetElement.page}" for subsidiary "${targetElement.subsidiary}"]: ${message}`;
        }

        const effectiveRole = hasAnyRole(actor, ['GMD'])
          ? 'GMD'
          : hasAnyRole(actor, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'HR'])
            ? 'SYSTEM_ADMIN'
            : 'STAFF';

        const n8nPayload = {
          session_id: sessionId,
          user: {
            id: actor.id,
            name: actor.legalName,
            title: (actor as any).jobTitle || (effectiveRole === 'GMD' ? 'Group Managing Director' : effectiveRole === 'SYSTEM_ADMIN' ? 'System Admin' : 'Staff'),
            role: effectiveRole,
            permissions: isReadOnlyUser ? ['read_only_inquiry', 'data_analytics'] : ['all'],
            can_execute_actions: !isReadOnlyUser,
          },
          query: queryText,
          message: queryText,
          timestamp: new Date().toISOString(),
          context: {
            active_business_id: scopedOrgId || '',
            active_business_name: scopedOrgName,
            is_group_scope: isGroupScope,
            channel: 'web_chat',
            target_element: targetElement || null,
            conversation_history: conversationHistory,
            formatting_guidance: `EXECUTIVE PRESENTATION DIRECTIVES:
1. Fluid English Prose & Explanations: When explaining definitions, sections, or answering 'what does this represent', or when the user asks for 'detailed paragraph explanation', write in continuous, eloquent English paragraphs and complete sentences with bold highlights. Do NOT chop text into redundant bullet points or artificial boxes.
2. Histograms & Visual Graphs: When the user asks 'in a graph', 'show histogram', 'chart', 'breakdown', or when comparing numbers across vendors, subsidiaries, or months, output a structured chart block:
\`\`\`chart:histogram
title: "<Chart Title>"
<Label>: <Value>
\`\`\`
3. Markdown Tables: When presenting multi-column comparative data (e.g. subsidiaries, periods, budgets, spending), use standard Markdown tables with proper newlines between every row. Ensure a blank line before and after the table.
4. Requisition & Action Cards: Use structured cards ONLY for items requiring review, requisition approval decisions (REQ-XXXX-XXXX), or staged actions.${!isGroupScope ? `\n5. STRICT SUBSIDIARY BOUNDARY: You are operating strictly inside the isolated workspace for "${scopedOrgName}" (ID: ${scopedOrgId}). You MUST restrict all database queries, financial totals, and responses exclusively to "${scopedOrgName}". Do NOT query, cite, or manipulate any other subsidiary or group-level data.` : '\n5. GROUP CONGLOMERATE HQ: You have global visibility across all subsidiaries.'}`,
          },
          conversation_history: conversationHistory,
          chat_history: conversationHistory,
          auth_token: authToken,
          correlation_id: correlationId,
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId,
          'X-BEMS-Webhook-Secret': webhookSecret,
          'X-Service-Secret': webhookSecret,
        };

        const n8nRes = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(n8nPayload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (n8nRes.ok) {
          const n8nData = await n8nRes.json();
          const rawReply = n8nData.reply || n8nData.message || 'Workflow executed.';
          const reply = normalizeMarkdownStructure(rawReply);

          // Persist assistant reply to memory
          try {
            await prisma.$executeRaw`
              INSERT INTO n8n_chat_histories (session_id, message, created_at)
              VALUES (${sessionId}, ${JSON.stringify({ role: 'assistant', content: reply, timestamp: new Date().toISOString() })}::jsonb, NOW())
            `;
          } catch (e) {
            console.warn('Could not persist assistant reply to memory:', e);
          }

          // Verify any staged_action or STAGED_ACTION card against backend database records before rendering
          let verifiedStagedAction: Record<string, any> | null = null;
          let verifiedActionCard: Record<string, any> | null = null;
          const rawCandidate = n8nData.staged_action || n8nData.actionCard || null;

          if (!isReadOnlyUser && rawCandidate && actor) {
            const candidateStagedId =
              rawCandidate.staged_action_id ||
              rawCandidate.id ||
              rawCandidate.stagedActionId ||
              null;

            if (candidateStagedId && String(candidateStagedId).startsWith('sa_')) {
              const dbStaged = await prisma.stagedAction.findUnique({
                where: { id: String(candidateStagedId) },
              });
              const actorRoleUpper = (actor.role || '').toUpperCase();
              const isAuthorizedOwner =
                dbStaged &&
                (dbStaged.userId === actor.id || actorRoleUpper === 'GMD') &&
                dbStaged.status === 'PENDING' &&
                dbStaged.expiresAt > new Date();

              if (isAuthorizedOwner && dbStaged) {
                let dbPreview: Record<string, any> = {};
                try {
                  dbPreview = JSON.parse(dbStaged.previewJson || '{}');
                } catch {
                  dbPreview = {};
                }
                verifiedStagedAction = {
                  id: dbStaged.id,
                  staged_action_id: dbStaged.id,
                  confirmation_hash: dbStaged.confirmationHash,
                  confirmationHash: dbStaged.confirmationHash,
                  type: dbStaged.actionType,
                  action_type: dbStaged.actionType,
                  cardType: 'STAGED_ACTION',
                  summary: dbStaged.summary,
                  status: dbStaged.status,
                  expires_at: dbStaged.expiresAt.toISOString(),
                  payload_preview: dbPreview,
                  preview: dbPreview,
                };
                verifiedActionCard = {
                  type: 'STAGED_ACTION',
                  ...verifiedStagedAction,
                };
              } else {
                console.warn(
                  `[AI Chat Integrity] Suppressed unverified or expired staged_action card (${candidateStagedId}).`
                );
              }
            } else if (
              n8nData.actionCard &&
              ['TREASURY', 'BRIEFING', 'ANALYTICS_CHART'].includes(String(n8nData.actionCard.type || ''))
            ) {
              // Informational read-only cards only; never actionable mutation cards without a verified stagedAction
              verifiedActionCard = n8nData.actionCard;
            }
          }

          return NextResponse.json({
            message: isReadOnlyUser && n8nData.staged_action
              ? `${reply}\n\n*(Note: Staged actions suppressed — read-only informational access).*`
              : reply,
            actionCard: verifiedActionCard,
            staged_action: verifiedStagedAction,
            citations: n8nData.citations || [],
            quick_replies: n8nData.quick_replies || n8nData.quickReplies || [],
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          });
        } else {
          const errData = await n8nRes.json().catch(() => ({}));
          console.warn(`n8n webhook responded with status ${n8nRes.status}:`, errData);
          if (errData.reply || errData.message) {
            return NextResponse.json({
              message: errData.reply || errData.message,
              actionCard: null,
              timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            });
          }
        }
      } catch (n8nErr: any) {
        console.warn(`n8n webhook unreachable (${n8nErr.message}).`);
        if (n8nErr.name === 'AbortError') {
          return NextResponse.json({
            message: 'The AI assistant took longer than 120 seconds to process this operation. Please retry or break the instruction into a simpler step.',
            actionCard: null,
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }
    }

    // 1. Fetch live telemetry from DB via canonical financial calculator (with strict subsidiary scoping)
    let bankAccounts: Array<{ bankName: string; accountNumber: string; accountName: string; balance: number; currency?: string }> = [];
    let totalCash = 0;

    if (isGroupScope) {
      const treasuryData = await getConsolidatedTreasury().catch(() => ({ accounts: [], totalCash: 0, totalCashFormatted: '₦0', safeRunwayMonths: 0, pendingPipeline: 0 }));
      bankAccounts = treasuryData.accounts;
      totalCash = treasuryData.totalCash;
    } else {
      const dbAccounts = await prisma.companyBankAccount.findMany({
        where: {
          organizationId: scopedOrgId!,
          status: 'ACTIVE',
        },
        select: {
          bankName: true,
          accountNumber: true,
          accountName: true,
          balance: true,
          currency: true,
        },
      }).catch(() => []);
      bankAccounts = dbAccounts.map(b => ({
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountName: b.accountName,
        balance: Number(b.balance || 0),
        currency: b.currency || 'NGN',
      }));
      totalCash = bankAccounts.reduce((sum, b) => sum + b.balance, 0);
    }

    const [pendingRequests, totalActiveStaff, orgs, openCases] = await Promise.all([
      prisma.expenditureRequest.findMany({
        where: {
          ...(scopedOrgId ? { subsidiaryId: scopedOrgId } : {}),
          approvalStatus: { in: ['SUBMITTED', 'IN_REVIEW'] },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { requester: true, vendor: true, subsidiary: true },
      }).catch(() => []),
      prisma.employee.count({
        where: {
          status: 'ACTIVE',
          role: 'STAFF',
          ...(scopedOrgId ? { assignments: { some: { subsidiaryId: scopedOrgId } } } : {}),
        },
      }).catch(() => 0),
      isGroupScope
        ? prisma.organization.findMany({ where: { status: 'ACTIVE' } }).catch(() => [])
        : prisma.organization.findMany({ where: { id: scopedOrgId! } }).catch(() => []),
      prisma.accountabilityCase.findMany({
        where: {
          status: { not: 'CLOSED' },
          ...(scopedOrgId ? { request: { subsidiaryId: scopedOrgId } } : {}),
        },
        take: 5,
        include: { owner: true, request: true },
      }).catch(() => []),
    ]);

    const pendingCount = pendingRequests.length;
    const pendingSum = pendingRequests.reduce((sum, r) => sum + (Number(r.amountMinor) || 0) / 100, 0);

    const wantsGraph = normalized.includes('graph') || normalized.includes('histogram') || normalized.includes('chart') || normalized.includes('bar') || normalized.includes('plot');
    const wantsParagraph = normalized.includes('paragraph') || normalized.includes('detailed explanation') || normalized.includes('long sentence') || normalized.includes('in full') || normalized.includes('explain in detail') || normalized.includes('narrative');
    const wantsCards = normalized.includes('card') || normalized.includes('cards') || normalized.includes('action card');

    let reply = '';
    let actionCard: any = null;

    // Check intents
    if (targetElement) {
      const elLabel = (targetElement.label || '').toLowerCase();
      const elVal = targetElement.value || '0';
      const elSec = targetElement.section || 'Executive Telemetry';
      const elSub = targetElement.subsidiary || 'BEMS Group';

      if (elLabel.includes('payments recorded')) {
        reply = `**Payments Recorded (${elVal}):**\n\nThis telemetry counter reflects the volume of disbursed payment vouchers authorized and settled from company bank accounts for **${elSub}**.\n\n• **Live Ledger Status:** Currently standing at **${elVal}** because no disbursements have been processed in this cycle.\n• **Disbursement Procedure:** To disburse funds for approved requisitions, go to **Approvals & payments** and select **Record Payment** to synchronize with bank reserves.`;
      } else if (elLabel.includes('closed & accounted')) {
        reply = `**Closed & Accounted (${elVal}):**\n\nThis metric tracks the number of staff cash advances that have submitted verified physical receipts and have been reconciled within the mandatory 72-hour retiral SLA.\n\n• **Current Status:** Currently at **${elVal}**. There are **${openCases.length} open advances** currently progressing through the evidence verification workflow.`;
      } else if (elLabel.includes('review required') || elLabel.includes('awaiting authorization')) {
        reply = `**Executive Review Required (${elVal}):**\n\nYou have **${pendingCount} pending requisition${pendingCount > 1 ? 's' : ''}** totaling **${formatNaira(pendingSum)}** awaiting executive authorization for **${elSub}**.\n\n${pendingRequests.map((r, i) => `${i + 1}. **${r.requestNumber}** — ${r.title} (${formatNaira(Number(r.amountMinor) / 100)})`).join('\n')}\n\nYou can authorize or review these requests directly from the Approvals desk.`;
        actionCard = {
          type: 'APPROVALS',
          title: 'Pending Authorization Queue',
          count: pendingCount,
          total: formatNaira(pendingSum),
          requests: pendingRequests.map((r) => ({
            id: r.id,
            number: r.requestNumber,
            title: r.title,
            amount: formatNaira(Number(r.amountMinor) / 100),
            by: r.requester?.legalName || 'Staff',
          })),
        };
      } else if (elLabel.includes('requests') || elLabel.includes('group requests')) {
        reply = `**Total Requests Pipeline (${elVal}):**\n\nThis metric captures all expenditure requests logged under **${elSub}**.\n\n• **Total Volume:** **${elVal} total requests** recorded across operational procurement and advances.\n• **Active In Review:** **${pendingCount} requests** (${formatNaira(pendingSum)}) are actively awaiting executive sign-off.`;
      } else if (elLabel.includes('velocity') || elLabel.includes('spending')) {
        reply = `**Group Spending Velocity (${elVal}):**\n\nThis telemetry chart represents 7-day cash outflow pacing across Monday through Sunday.\n\n• **Telemetry Reading:** A baseline level of **${elVal}** reflects zero cash disbursements committed on this weekday, ensuring that corporate liquidity remains preserved.`;
      } else if (elLabel.includes('clearance rate') || elLabel.includes('accountability')) {
        reply = `**Accountability Clearance Rate (${elVal}):**\n\nThis compliance index measures receipt retirement discipline for staff cash advances.\n\n• **Audit Standing:** **${elVal} compliance score**, confirming zero delinquent or unretired advances beyond the 72-hour window.`;
      } else if (elLabel.includes('sla clock') || elLabel.includes('clock') || elLabel.includes('01:00:00')) {
        reply = `**GMD Review SLA Clock (${elVal}):**\n\nThis is the executive 1-Hour SLA countdown timer for pending fund requests.\n\n• **Policy Requirement:** To prevent operational gridlock, every requisition flagged for GMD review has a 1-hour priority window before escalation alerts are triggered.`;
      } else if (elLabel.includes('starlink') || elLabel.includes('wi-fi') || elLabel.includes('attendance')) {
        reply = `**Starlink Wi-Fi Attendance Policy:**\n\nStaff check-ins enforce a strict 3-way security protocol combining company Starlink Wi-Fi network telemetry, GPS office geofencing, and reception kiosk verification.\n\n• **Arrival Window:** 07:00 AM – 08:00 AM (Grace window up to 08:15 AM).\n• **Power Outage Override:** In case of grid failure, executive administrators can toggle Power Outage Mode to maintain continuity.`;
      } else {
        reply = `**Contextual Inquiry — ${targetElement.label} (${elVal}):**\n\n• **Section:** ${elSec}\n• **Workspace:** ${elSub}\n• **Query:** "${message}"\n\nThis element represents a live telemetry indicator synchronized with BEMS Group database records. Every transaction and status change updates this figure in real time.`;
      }
    } else if (
      actor &&
      isExecutive &&
      (normalized.includes('starlink lock') ||
        normalized.includes('disable starlink') ||
        normalized.includes('enable starlink') ||
        normalized.includes('bypass starlink') ||
        normalized.includes('toggle starlink') ||
        normalized.includes('power outage mode') ||
        normalized.includes('geofence lock') ||
        normalized.includes('disable geofence') ||
        normalized.includes('enable geofence') ||
        normalized.includes('bypass geofence') ||
        normalized.includes('toggle geofence'))
    ) {
      const isGeofence = normalized.includes('geofence');
      const wantsDisable =
        normalized.includes('disable') ||
        normalized.includes('bypass') ||
        normalized.includes('turn off') ||
        normalized.includes('outage');
      const subAction = isGeofence ? 'TOGGLE_GEOFENCE_LOCK' : 'TOGGLE_STARLINK_LOCK';
      const payload = isGeofence
        ? { action_type: subAction, requireGeofence: !wantsDisable }
        : { action_type: subAction, requireStarlinkIp: !wantsDisable, starlinkPowerOutageMode: wantsDisable };

      const summary = isGeofence
        ? `${wantsDisable ? 'Bypass' : 'Enforce'} GPS Geofence Perimeter Lock Group-Wide`
        : `${wantsDisable ? 'Bypass Starlink Wi-Fi Lock (Allow Any Network)' : 'Enforce Strict Starlink Wi-Fi Lock'} Group-Wide`;

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'attendance_override',
        summary,
        materialPayload: payload,
        preview: {
          operation: isGeofence ? 'GPS Geofence Security Lock' : 'Starlink Wi-Fi Security Lock',
          target_state: wantsDisable ? 'BYPASSED (Any Network / Location Allowed)' : 'STRICTLY ENFORCED',
          scope: 'All BEMS Group Subsidiaries',
        },
      });

      reply = `I have staged the **${summary}** operation.\n\nPlease review the preview card below and click the confirmation button to apply this security policy change across the conglomerate.`;
      actionCard = {
        cardType: 'STAGED_ACTION',
        ...staged,
      };
    } else if (
      actor &&
      isExecutive &&
      (normalized.startsWith('edit subsidiary') ||
        normalized.startsWith('update subsidiary') ||
        normalized.includes('edit subsidiary ') ||
        normalized.includes('update subsidiary ') ||
        normalized.includes('change subsidiary '))
    ) {
      const allOrgs = await prisma.organization.findMany({ where: { status: 'ACTIVE' } });
      const matchedOrg =
        allOrgs.find(
          (o) =>
            normalized.includes(o.code.toLowerCase()) ||
            normalized.includes(o.legalName.toLowerCase()) ||
            o.legalName
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 3)
              .some((w) => normalized.includes(w))
        ) || (scopedOrgId ? allOrgs.find((o) => o.id === scopedOrgId) : null);

      if (!matchedOrg) {
        reply = `Please specify which subsidiary you want to edit (e.g., **BBH / BemsSoft Hub Ltd**, **BSA / Studio Arella Ltd**, **BTECH / SmartAIRS**, **BEDU**, or **BAGRO**) along with the field to update (name, code, headquarters, industry, RC number, brand color, or monthly budget).`;
      } else {
        const materialPayload: Record<string, any> = { organizationId: matchedOrg.id };
        const preview: Record<string, any> = {
          subsidiary: `${matchedOrg.legalName} (${matchedOrg.code})`,
        };

        const hqMatch = message.match(/(?:headquarters|hq|location|address)\s*(?:to|=|:)\s*([^,;.\n]+)/i);
        if (hqMatch?.[1]) {
          materialPayload.headquarters = hqMatch[1].trim();
          preview.new_headquarters = materialPayload.headquarters;
        }
        const indMatch = message.match(/(?:industry|sector)\s*(?:to|=|:)\s*([^,;.\n]+)/i);
        if (indMatch?.[1]) {
          materialPayload.industry = indMatch[1].trim();
          preview.new_industry = materialPayload.industry;
        }
        const rcMatch = message.match(/(?:rc\s*number|rc)\s*(?:to|=|:)\s*([A-Za-z0-9-]+)/i);
        if (rcMatch?.[1]) {
          materialPayload.rcNumber = rcMatch[1].trim();
          preview.new_rc_number = materialPayload.rcNumber;
        }
        const colorMatch = message.match(/(#[0-9A-Fa-f]{6})\b/);
        if (colorMatch?.[1]) {
          materialPayload.brandColor = colorMatch[1];
          preview.new_brand_color = materialPayload.brandColor;
        }
        const nameMatch = message.match(/(?:legal\s*name|name)\s*(?:to|=|:)\s*["']?([^"',;.\n]+)["']?/i);
        if (nameMatch?.[1]) {
          materialPayload.legalName = nameMatch[1].trim();
          preview.new_legal_name = materialPayload.legalName;
        }
        const budgetMatch = message.match(/(?:budget)\s*(?:to|=|:)?\s*(?:₦|NGN)?\s*([\d,]+(?:\.\d+)?)/i);
        if (budgetMatch?.[1]) {
          const parsedBudget = Number(budgetMatch[1].replace(/,/g, ''));
          if (parsedBudget > 0) {
            materialPayload.monthlyBudget = parsedBudget;
            preview.new_monthly_budget = `₦${parsedBudget.toLocaleString()}`;
          }
        }

        const staged = await stageAction({
          userId: actor.id,
          actionType: 'subsidiary_update',
          summary: `Update Subsidiary Information: ${matchedOrg.legalName} (${matchedOrg.code})`,
          materialPayload,
          preview,
        });

        reply = `I have staged the corporate information update for **${matchedOrg.legalName} (${matchedOrg.code})**.\n\nPlease review the preview card below and click the confirmation button to commit the changes.`;
        actionCard = {
          cardType: 'STAGED_ACTION',
          ...staged,
        };
      }
    } else if (
      actor &&
      isExecutive &&
      (normalized.startsWith('edit staff') ||
        normalized.startsWith('update staff') ||
        normalized.includes('edit staff ') ||
        normalized.includes('update staff ') ||
        normalized.includes('exempt ') ||
        normalized.includes('attendance exemption') ||
        normalized.startsWith('suspend ') ||
        normalized.startsWith('terminate ') ||
        normalized.startsWith('activate staff'))
    ) {
      const allStaff = await prisma.employee.findMany({
        include: {
          assignments: { where: { isPrimary: true }, include: { subsidiary: true, department: true } },
        },
      });
      const matchedStaff = allStaff.find(
        (s) =>
          normalized.includes(s.employeeNumber.toLowerCase()) ||
          normalized.includes(s.workEmail.toLowerCase()) ||
          normalized.includes(s.legalName.toLowerCase()) ||
          s.legalName
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 2)
            .some((w) => normalized.includes(w))
      );

      if (!matchedStaff) {
        reply = `Please specify the staff member's name, email, or employee number (e.g., *"Edit staff [Name] job title to Senior Accountant"* or *"Exempt [Name] from attendance"*).`;
      } else {
        let subAction = 'EDIT_PROFILE';
        const materialPayload: Record<string, any> = { employeeId: matchedStaff.id };
        const preview: Record<string, any> = {
          staff_member: `${matchedStaff.legalName} (${matchedStaff.employeeNumber})`,
          current_role_title: matchedStaff.jobTitle || matchedStaff.assignments[0]?.positionName || 'Staff',
        };

        if (normalized.includes('exempt')) {
          subAction = 'TOGGLE_ATTENDANCE_EXEMPT';
          const makeExempt = !normalized.includes('remove exempt') && !normalized.includes('unexempt') && !normalized.includes('disable exempt');
          materialPayload.sub_action = subAction;
          materialPayload.isAttendanceExempt = makeExempt;
          preview.attendance_exemption = makeExempt ? 'EXEMPT (Bypass Clock-In)' : 'REQUIRED (Standard Clock-In)';
        } else if (normalized.startsWith('suspend ') || normalized.startsWith('terminate ') || normalized.startsWith('activate ')) {
          subAction = 'CHANGE_STATUS';
          const nextStatus = normalized.startsWith('suspend')
            ? 'SUSPENDED'
            : normalized.startsWith('terminate')
            ? 'TERMINATED'
            : 'ACTIVE';
          materialPayload.sub_action = subAction;
          materialPayload.status = nextStatus;
          preview.new_status = nextStatus;
        } else {
          materialPayload.sub_action = 'EDIT_PROFILE';
          const titleMatch = message.match(/(?:job\s*title|title|position|role)\s*(?:to|=|:)\s*([^,;.\n]+)/i);
          if (titleMatch?.[1]) {
            materialPayload.jobTitle = titleMatch[1].trim();
            preview.new_job_title = materialPayload.jobTitle;
          }
          const phoneMatch = message.match(/(?:phone|mobile|number)\s*(?:to|=|:)\s*([+\d\s-]{7,20})/i);
          if (phoneMatch?.[1]) {
            materialPayload.phone = phoneMatch[1].trim();
            preview.new_phone = materialPayload.phone;
          }
          const emailMatch = message.match(/(?:email)\s*(?:to|=|:)\s*([^\s,;]+@[^\s,;]+)/i);
          if (emailMatch?.[1]) {
            materialPayload.workEmail = emailMatch[1].trim().toLowerCase();
            preview.new_work_email = materialPayload.workEmail;
          }
          const nameMatch = message.match(/(?:legal\s*name|name)\s*(?:to|=|:)\s*([^,;.\n]+)/i);
          if (nameMatch?.[1]) {
            materialPayload.legalName = nameMatch[1].trim();
            preview.new_legal_name = materialPayload.legalName;
          }
        }

        const summary =
          subAction === 'TOGGLE_ATTENDANCE_EXEMPT'
            ? `Set Attendance Exemption for ${matchedStaff.legalName} (${materialPayload.isAttendanceExempt ? 'Exempt' : 'Required'})`
            : subAction === 'CHANGE_STATUS'
            ? `Change Staff Status to ${materialPayload.status} for ${matchedStaff.legalName}`
            : `Update Staff Profile: ${matchedStaff.legalName} (${matchedStaff.employeeNumber})`;

        const staged = await stageAction({
          userId: actor.id,
          actionType: 'staff_management',
          summary,
          materialPayload,
          preview,
        });

        reply = `I have staged **${summary}**.\n\nPlease review the preview card below and click the confirmation button to commit this staff record update.`;
        actionCard = {
          cardType: 'STAGED_ACTION',
          ...staged,
        };
      }
    } else if (
      actor &&
      (normalized.startsWith('create request') ||
        normalized.startsWith('create fund request') ||
        normalized.startsWith('new fund request') ||
        normalized.startsWith('stage fund request') ||
        normalized.includes('create a fund request'))
    ) {
      const amountMatch = message.match(/(?:₦|NGN|\bfor\b)?\s*([\d,]+(?:\.\d+)?)\s*(?:naira|ngn)?/i);
      const parsedAmount = amountMatch?.[1] ? Number(amountMatch[1].replace(/,/g, '')) : 0;
      const titleMatch = message.match(/(?:titled|for|purpose)\s+["']?([^"',;.\n]{4,80})["']?/i);
      const title = titleMatch?.[1]?.trim() || 'Operational Expenditure Request';

      if (parsedAmount > 0) {
        const subOrg =
          (scopedOrgId ? await prisma.organization.findUnique({ where: { id: scopedOrgId } }) : null) ||
          (await prisma.organization.findFirst({ where: { type: 'SUBSIDIARY' } })) ||
          (await prisma.organization.findFirst());

        if (subOrg) {
          const staged = await stageAction({
            userId: actor.id,
            actionType: 'request_creation',
            summary: `Create Fund Request: "${title}" (₦${parsedAmount.toLocaleString()}) under ${subOrg.legalName}`,
            materialPayload: {
              title,
              amount: parsedAmount,
              currency: 'NGN',
              category: 'OPERATIONS',
              justification: title,
              deliverable: 'Operational deliverable',
              subsidiaryId: subOrg.id,
            },
            preview: {
              operation: 'Create Expenditure Request',
              title,
              amount: `₦${parsedAmount.toLocaleString()}`,
              subsidiary: `${subOrg.legalName} (${subOrg.code})`,
              category: 'OPERATIONS',
            },
          });

          reply = `I have staged a new expenditure request **"${title}"** for **₦${parsedAmount.toLocaleString()}** under **${subOrg.legalName}**.\n\nClick the confirmation button below to submit the request into the approval pipeline.`;
          actionCard = {
            cardType: 'STAGED_ACTION',
            ...staged,
          };
        }
      } else {
        reply = `To stage a new fund request, please include the **amount** and **purpose/title** (for example: *"Create a fund request of 250,000 for Diesel Supply"*).`;
      }
    } else if (
      normalized.includes('bank') ||
      normalized.includes('balance') ||
      normalized.includes('cash') ||
      normalized.includes('treasury') ||
      normalized.includes('liquidity') ||
      normalized.includes('reserve')
    ) {
      if (!isExecutive) {
        reply = `🔒 **Executive Confidentiality:** ${scopedOrgName} liquid treasury reserves, bank account balances, and banking institution records are confidential executive data accessible only to the Group Managing Director and System Administrator.`;
        actionCard = null;
      } else if (bankAccounts.length === 0) {
        reply = !isGroupScope
          ? `**Treasury Status (${scopedOrgName}):** No subsidiary bank accounts have been registered yet for **${scopedOrgName}**.\n\nYou can add bank accounts under **Treasury Accounts** in your Fund Flow menu.`
          : `**Treasury Status:** No company bank accounts have been registered yet.\n\nYou can add group bank accounts under **Treasury Accounts** in your Fund Flow menu.`;
      } else if (wantsGraph) {
        reply = `Here is the visual histogram breakdown of ${scopedOrgName} liquid treasury reserves across all registered accounts:\n\n\`\`\`chart:histogram\ntitle: "${scopedOrgName} Treasury Reserves by Account"\n${bankAccounts.map((b) => `${b.bankName} (${b.accountNumber.slice(-4)}): ${b.balance}`).join('\n')}\n\`\`\`\n\nTotal combined liquidity across active accounts stands at **${formatNaira(totalCash)}**.`;
      } else if (wantsParagraph) {
        const accDetails = bankAccounts.map((b) => `${b.bankName} ending in ${b.accountNumber.slice(-4)} holding ${formatNaira(b.balance)}`).join(', ');
        reply = `${scopedOrgName} currently maintains a ${isGroupScope ? 'consolidated' : 'dedicated'} liquid treasury reserve of **${formatNaira(totalCash)}** dispersed across ${bankAccounts.length} institutional depository partner${bankAccounts.length === 1 ? '' : 's'}, specifically ${accDetails}. Every deposit and disbursement is monitored in real-time under dual-custody controls, ensuring that ${scopedOrgName} maintains ample operational liquidity to service pending procurement commitments and payroll cycles without requiring short-term credit drawdowns.`;
      } else {
        const list = bankAccounts
          .map((b) => `• **${b.bankName}** (${b.accountNumber} · ${b.accountName}): **${formatNaira(b.balance)}**`)
          .join('\n');
        reply = `**${scopedOrgName} Real-Time Cash & Treasury Reserves:**\n\nTotal Liquid Reserves: **${formatNaira(totalCash)}** across ${bankAccounts.length} verified institution${bankAccounts.length > 1 ? 's' : ''}.\n\n${list}\n\n*Strictly isolated to ${scopedOrgName}'s registered depository accounts.*`;
        actionCard = {
          type: 'TREASURY',
          title: `${scopedOrgName} Treasury Reserves`,
          totalCash: formatNaira(totalCash),
          accounts: bankAccounts.map((b) => ({
            name: b.bankName,
            account: b.accountNumber,
            balance: formatNaira(b.balance),
          })),
        };
      }
    } else if (
      normalized.startsWith('approve') ||
      normalized.includes('stage approval') ||
      normalized.includes('authorize request')
    ) {
      if (isReadOnlyUser) {
        reply = `🔒 **Executive Authority Required:** Requisition approvals, financial authorizations, and staged actions are strictly reserved for the Group Managing Director and System Administrator.`;
        actionCard = null;
      } else {
        const matched = pendingRequests.find((r) =>
          normalized.includes(r.requestNumber.toLowerCase()) || normalized.includes(r.id.toLowerCase())
        ) || pendingRequests[0];

      if (matched && actor) {
        const reqAmountNaira = Number(matched.amountMinor) / 100;
        const bankName = matched.vendor?.bankName || matched.requester?.bankName || 'Not Set';
        const accountNumber = matched.vendor?.accountNumber || matched.requester?.accountNumber || 'Not Set';
        const accountName = matched.vendor?.accountName || matched.requester?.accountName || matched.requester?.legalName || 'Staff';
        const payUrl = `https://bemserp.work/pay/${matched.requestNumber}`;

        const staged = await stageAction({
          userId: actor.id,
          actionType: 'approval_decision',
          materialPayload: {
            request_id: matched.id,
            request_number: matched.requestNumber,
            decision: 'APPROVE',
            reason: 'Authorized via AI Copilot',
            amount_minor: Number(matched.amountMinor),
          },
          summary: `Authorize disbursement for ${matched.requestNumber} (${matched.title}) — ₦${reqAmountNaira.toLocaleString()}`,
          preview: {
            request_number: matched.requestNumber,
            title: matched.title,
            amount: `₦${reqAmountNaira.toLocaleString()}`,
            requester: matched.requester?.legalName || 'Staff',
            decision_to_apply: 'APPROVE',
            reason: 'Executive authorization',
            beneficiary_bank: `${bankName} · ${accountNumber} (${accountName})`,
            disbursement_quick_link: payUrl,
          },
        });

        reply = `I have staged the executive authorization for **${matched.requestNumber}** (**₦${reqAmountNaira.toLocaleString()}**).\n\n` +
          `💳 **Beneficiary Bank Details for Disbursement:**\n` +
          `• **Beneficiary:** ${accountName}\n` +
          `• **Bank Name:** ${bankName}\n` +
          `• **Account Number:** \`${accountNumber}\`\n` +
          `• **Payable Amount:** **₦${reqAmountNaira.toLocaleString()}**\n\n` +
          `📲 **Direct Bank App Quick-Pay Link:**\n` +
          `[👉 Click to Open Bank App & Disburse](${payUrl})\n\n` +
          `Please review the cryptographic preview card below and click **Authorize & Execute Action** to commit the decision to the ledger.`;
        actionCard = {
          cardType: 'STAGED_ACTION',
          ...staged,
        };
      } else {
        reply = `There are currently no pending requests requiring approval. The queue is all clear!`;
      }
      }
    } else if (
      normalized.includes('approval') ||
      normalized.includes('pending') ||
      normalized.includes('review') ||
      normalized.includes('queue')
    ) {
      if (pendingCount === 0) {
        reply = `**Executive Approvals Queue:** All clear! There are currently **0 requests** awaiting your authorization.\n\nAll previous requisitions have either been approved, disbursed, or retired with proof.`;
      } else {
        const reqLines = pendingRequests
          .map(
            (r, i) =>
              `${i + 1}. **${r.requestNumber}** — ${r.title} by ${r.requester?.legalName || 'Staff'} (**${formatNaira(Number(r.amountMinor) / 100)}**)`
          )
          .join('\n');
        reply = `**Executive Review Required:** You have **${pendingCount} pending request${pendingCount > 1 ? 's' : ''}** totaling **${formatNaira(pendingSum)}** requiring GMD authorization:\n\n${reqLines}\n\nYou can authorize or decline directly from your **Approvals & payments** desk or by tapping Approve below.`;
        actionCard = {
          type: 'APPROVALS',
          title: 'Pending Authorization Queue',
          count: pendingCount,
          total: formatNaira(pendingSum),
          requests: pendingRequests.map((r) => ({
            id: r.id,
            number: r.requestNumber,
            title: r.title,
            amount: formatNaira(Number(r.amountMinor) / 100),
            by: r.requester?.legalName || 'Staff',
          })),
        };
      }
    } else if (
      normalized.includes('brief') ||
      normalized.includes('morning') ||
      normalized.includes('summary') ||
      normalized.includes('overview') ||
      normalized.includes('status')
    ) {
      reply = `**Good day, ${userName}. Here is your executive briefing for BEMS Group:**\n\n` +
        `• **Liquid Cash Position:** **${formatNaira(totalCash)}** across registered bank reserves.\n` +
        `• **Approvals Queue:** **${pendingCount} pending requests** (${formatNaira(pendingSum)}).\n` +
        `• **Accountability Advances:** **${openCases.length} open cases** awaiting receipts/deliverables.\n` +
        `• **Active Workforce:** **${totalActiveStaff} employees** registered across subsidiaries.\n\n` +
        `Group financial operations are running smoothly with complete audit logging.`;
      actionCard = {
        type: 'BRIEFING',
        title: 'BEMS Executive Daily Briefing',
        cash: formatNaira(totalCash),
        pending: pendingCount,
        openCases: openCases.length,
        staff: totalActiveStaff,
      };
    } else if (
      normalized.includes('advance') ||
      normalized.includes('receipt') ||
      normalized.includes('accountability') ||
      normalized.includes('audit')
    ) {
      if (openCases.length === 0) {
        reply = `**Accountability Status:** 100% compliant! There are **0 open cash advance cases** or overdue receipts. All disbursed funds have been verified and accounted for.`;
      } else {
        const caseLines = openCases
          .map(
            (c, i) =>
              `${i + 1}. **${c.request?.requestNumber || 'ADV'}** — ${c.owner?.legalName || 'Requester'} (${c.status})`
          )
          .join('\n');
        reply = `**Open Accountability Cases:** There are **${openCases.length} active cases** pending evidence clearance:\n\n${caseLines}\n\nStaff must submit receipts within the mandatory 72-hour SLA window before new funds can be requisitioned.`;
        actionCard = {
          type: 'ACCOUNTABILITY',
          title: 'Accountability Cases',
          count: openCases.length,
          cases: openCases.map((c) => ({
            id: c.id,
            number: c.request?.requestNumber || 'ADV',
            owner: c.owner?.legalName || 'Staff',
            status: c.status,
          })),
        };
      }
    } else if (
      normalized.includes('approve staff') ||
      normalized.includes('approve onboarding') ||
      normalized.includes('approve registration')
    ) {
      if (isReadOnlyUser) {
        reply = `🔒 **Read-Only Informational Access:** The AI Analyst role cannot authorize staff onboarding or credentials. Please log in as Group Managing Director or System Administrator to approve staff.`;
        actionCard = null;
      } else {
        const pendingStaff = await prisma.employee.findFirst({
          where: { approvalStatus: 'PENDING_APPROVAL' },
          include: { assignments: { include: { subsidiary: true, department: true } } },
        });

        if (pendingStaff && actor) {
          const sub = pendingStaff.assignments?.[0]?.subsidiary;
          const dept = pendingStaff.assignments?.[0]?.department;

          const staged = await stageAction({
            userId: actor.id,
            actionType: 'staff_approval',
            materialPayload: {
              employee_id: pendingStaff.id,
              employee_number: pendingStaff.employeeNumber,
              name: pendingStaff.legalName,
              subsidiary: sub?.legalName || 'BEMS Group',
            },
            summary: `Authorize corporate onboarding for ${pendingStaff.legalName} (${pendingStaff.employeeNumber})`,
            preview: {
              staff_id: pendingStaff.employeeNumber,
              full_name: pendingStaff.legalName,
              work_email: pendingStaff.workEmail,
              role_assigned: pendingStaff.role,
              subsidiary: sub?.legalName || 'BEMS Group',
              department: dept?.name || 'General Operations',
              disbursement_bank: `${pendingStaff.bankName || 'Recorded'} · ${pendingStaff.accountNumber || 'Verified'}`,
            },
          });

          reply = `I have staged the corporate onboarding authorization for **${pendingStaff.legalName}** (${pendingStaff.employeeNumber}).\n\nPlease review their dossier below and click **Authorize & Execute Action** to grant active enterprise system credentials.`;
          actionCard = {
            cardType: 'STAGED_ACTION',
            ...staged,
          };
        } else {
          reply = `All staff self-registration dossiers have already been reviewed and approved! The onboarding queue is clear.`;
        }
      }
    } else if (
      normalized.includes('clear case') ||
      normalized.includes('clear advance') ||
      normalized.includes('clear accountability')
    ) {
      if (isReadOnlyUser) {
        reply = `🔒 **Read-Only Informational Access:** Retiral clearances and advance closures can only be signed off by the Group Managing Director or System Administrator.`;
        actionCard = null;
      } else {
        const targetCase = openCases[0];

        if (targetCase && actor) {
          const staged = await stageAction({
            userId: actor.id,
            actionType: 'accountability_clearance',
            materialPayload: {
              case_id: targetCase.id,
              request_number: targetCase.request?.requestNumber || 'ADV',
              clearance_notes: 'Physical receipts inspected and reconciled by GMD via Executive AI',
            },
            summary: `Grant final retiral clearance for case ${targetCase.request?.requestNumber || 'ADV'} (${targetCase.owner?.legalName || 'Requester'})`,
            preview: {
              request_number: targetCase.request?.requestNumber || 'ADV',
              requester: targetCase.owner?.legalName || 'Staff',
              current_status: targetCase.status,
              reconciled_action: 'RECONCILED & CLOSED',
              reconciliation_officer: actor.legalName,
            },
          });

          reply = `I have staged the retiral clearance for **${targetCase.request?.requestNumber || 'ADV'}** belonging to **${targetCase.owner?.legalName || 'Staff'}**.\n\nPlease review the retiral card below and click **Authorize & Execute Action** to reconcile the ledger and lift any requisition restrictions.`;
          actionCard = {
            cardType: 'STAGED_ACTION',
            ...staged,
          };
        } else {
          reply = `There are currently no open advance cases requiring retiral clearance. All accounts are 100% reconciled!`;
        }
      }
    } else if (
      normalized.includes('emergency override') ||
      normalized.includes('emergency approval')
    ) {
      if (isReadOnlyUser) {
        reply = `🔒 **Read-Only Informational Access:** Emergency bypass overrides require sovereign executive authority (GMD only).`;
        actionCard = null;
      } else {
        const targetReq = pendingRequests[0];

        if (targetReq && actor) {
          const staged = await stageAction({
            userId: actor.id,
            actionType: 'emergency_override',
            materialPayload: {
              request_id: targetReq.id,
              request_number: targetReq.requestNumber,
              justification: 'GMD Emergency Operational Continuity Override',
              amount: Number(targetReq.amountMinor) / 100,
            },
            summary: `GMD Emergency Override: Authorize immediate payout for ${targetReq.requestNumber} (₦${(Number(targetReq.amountMinor) / 100).toLocaleString()})`,
            preview: {
              request_number: targetReq.requestNumber,
              title: targetReq.title,
              amount: `₦${(Number(targetReq.amountMinor) / 100).toLocaleString()}`,
              requester: targetReq.requester?.legalName || 'Staff',
              override_authority: 'Group Managing Director',
              action: 'BYPASS_MATRIX_DIRECT_APPROVAL',
            },
          });

          reply = `I have staged a **GMD Emergency Override** for **${targetReq.requestNumber}** (**₦${(Number(targetReq.amountMinor) / 100).toLocaleString()}**).\n\nThis will bypass intermediate matrix stages and mark the requisition immediately approved for direct treasury disbursement.`;
          actionCard = {
            cardType: 'STAGED_ACTION',
            ...staged,
          };
        } else {
          reply = `There are currently no requisitions pending review to apply an emergency override to.`;
        }
      }
    } else if (
      normalized.includes('recurring') ||
      normalized.includes('commitment') ||
      normalized.includes('subscription')
    ) {
      if (wantsGraph) {
        reply = `**Recurring Expenditure Commitments Runway:**\n\nHere is the projected distribution of recurring commitments across operational categories:\n\n\`\`\`chart:histogram\ntitle: "Annual Run-Rate by Commitment Category"\nSoftware & Cloud Infrastructure: 850000\nFacility & Energy Reserves: 1200000\nLogistics & Supply Chains: 650000\nProfessional Advisory & Audit: 450000\n\`\`\`\n\nAll recurring expenditure requires 3-way matching and confirmed invoice delivery prior to fund release.`;
      } else if (wantsParagraph) {
        reply = `The **Recurring Expenditure Commitments** system within BEMS Group acts as a centralized fiscal tracking register for all contractual, predictable liabilities that recur across subsidiary operations. Unlike one-off discretionary fund requests, recurring commitments encompass multi-month SaaS licenses, server and domain hosting, facility retainers, and scheduled vendor agreements. By capturing the agreed annual run-rate, billing periodicity, and next payment deadline upfront, the executive committee retains complete forward visibility into committed operational expenditures before individual payment vouchers are staged, preventing unbudgeted cash drawdowns and enforcing strict procurement compliance across all group entities.`;
      } else {
        reply = `The **Recurring Expenditure Commitments** register tracks all standing, non-discretionary corporate expenditures across BEMS Group (such as cloud hosting, software licenses, lease renewals, and scheduled supplier retainers).\n\n• **Active Commitments:** No active recurring commitments are currently logged for BEMS Group Holdings (HQ).\n• **Q4 Budget Allocation:** ₦15,000,000 is earmarked under the approved operating plan.\n• **Policy Requirement:** Recurring contracts must be linked to a registered vendor and pass 3-way invoice reconciliation before automated disbursements can be scheduled.\n\nWould you like me to show a projected breakdown in a graph or explain the approval workflow in detail?`;
      }
    } else if (
      normalized.includes('vendor') ||
      normalized.includes('supplier')
    ) {
      if (wantsGraph) {
        reply = `Here is the current spend distribution across primary registered vendors on record:\n\n\`\`\`chart:histogram\ntitle: "Vendor Spend Distribution"\nAgroParts Hub Ltd: 450000\nHostinger International Ltd: 120000\nTotalEnergies Marketing: 650000\n\`\`\`\n\nAll primary vendors have passed corporate KYC verification with active bank records on file.`;
      } else if (wantsParagraph) {
        reply = `BEMS Group actively manages vendor procurement through a verified institutional registry currently featuring AgroParts Hub Ltd for agricultural machinery parts, Hostinger International Ltd for core digital infrastructure and hosting, and TotalEnergies Marketing Nigeria Plc for fleet fuel supply. Every vendor profile is bound to strict three-way matching, ensuring that purchase orders, delivery log proofs, and tax invoices correspond before disbursements are sanctioned by the Group Managing Director.`;
      } else {
        reply = `BEMS Group maintains an active supplier registry spanning verified operational partners including **AgroParts Hub Ltd**, **Hostinger International Ltd**, and **TotalEnergies Marketing Nigeria Plc**.\n\nEvery supplier is tied to automated 3-way matching (Purchase Order, Delivery Evidence, and Vendor Invoice) with zero cash release permitted without dual executive sign-off.`;
      }
    } else if (
      normalized.includes('graph') ||
      normalized.includes('histogram') ||
      normalized.includes('chart')
    ) {
      reply = `Here is the consolidated financial overview of BEMS Group presented as an interactive histogram:\n\n\`\`\`chart:histogram\ntitle: "Consolidated Group Financial Metrics"\nLiquid Cash Reserves: ${totalCash}\nPending Approvals: ${pendingSum}\nApproved Unpaid: 450000\nOpen Advances: 1200000\n\`\`\`\n\nYou can toggle between the histogram and the table view using the button in the chart header.`;
    } else if (
      normalized.includes('payroll') ||
      normalized.includes('deduction') ||
      normalized.includes('salary')
    ) {
      if (!isExecutive) {
        reply = `🔒 **Executive Confidentiality:** Group payroll, salary registers, and staff deduction details are strictly restricted to Executive Leadership.`;
      } else {
        const latestPeriod = await prisma.payrollPeriod.findFirst({
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: {
            batches: {
              orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
              take: 1,
            },
          },
        });

        const batch = latestPeriod?.batches[0];
        const monthName = latestPeriod ? new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(latestPeriod.year, latestPeriod.month - 1, 1)) : 'Current Month';

        const netNaira = batch ? Number(batch.totalNetMinor) / 100 : 0;
        const grossNaira = batch ? Number(batch.totalGrossMinor) / 100 : 0;
        const deductionsNaira = Math.max(0, grossNaira - netNaira);

        reply = `**BEMS Group Executive Payroll Status:**\n\n` +
          `• **Current Active Period:** **${monthName} ${latestPeriod?.year || new Date().getFullYear()}**\n` +
          `• **Batch Status:** **${batch?.status || 'NOT_PREPARED'}** (Version ${batch?.version || 1})\n` +
          `• **Total Net Payout:** **${formatNaira(netNaira)}**\n` +
          `• **Total Deductions:** **${formatNaira(deductionsNaira)}**\n\n` +
          `*To prepare or recalculate payroll with attendance absence/lateness penalties factored in, use the Payroll Desk or submit a request to the AI Automation Gateway.*`;

        actionCard = {
          type: 'PAYROLL',
          title: `Payroll Overview (${monthName})`,
          period: `${monthName} ${latestPeriod?.year || new Date().getFullYear()}`,
          status: batch?.status || 'NOT_PREPARED',
          netTotal: formatNaira(netNaira),
          deductions: formatNaira(deductionsNaira),
        };
      }
    } else if (
      normalized.includes('attendance') ||
      normalized.includes('roster') ||
      normalized.includes('lateness') ||
      normalized.includes('timesheet') ||
      normalized.includes('clock in') ||
      normalized.includes('excuse')
    ) {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const todayRecords = await prisma.attendanceRecord.findMany({
        where: {
          workDate: todayDateStr,
          ...(scopedOrgId ? { employee: { assignments: { some: { subsidiaryId: scopedOrgId } } } } : {}),
        },
      });
      const onTime = todayRecords.filter((r) => r.status === 'PRESENT' && !r.isManualOverride).length;
      const late = todayRecords.filter((r) => r.status === 'LATE').length;
      const excused = todayRecords.filter((r) => r.status === 'EXCUSED' || r.isManualOverride).length;

      reply = `**${scopedOrgName} Live Attendance & Timekeeping Intelligence (${todayDateStr}):**\n\n` +
        `• **Official System Launch:** Attendance tracking officially commenced on **November 3, 2026**.\n` +
        `• **Today's Presence:** **${todayRecords.length} staff checked in** (${onTime} on-time, ${late} late, ${excused} excused/override).\n` +
        `• **Policy Threshold:** Resumption 08:00 AM + 15m Grace (08:15 AM cut-off). Deductions: -5% pro-rated daily wage for lateness, -100% for unexcused absence.\n\n` +
        `*GMD / Super Admin can excuse or override any lateness penalty directly from the Attendance Master desk or via AI Automation tools.*`;

      actionCard = {
        type: 'ATTENDANCE',
        title: `${scopedOrgName} Attendance Radar (${todayDateStr})`,
        punches: todayRecords.length,
        onTime,
        late,
        excused,
      };
    } else if (
      normalized.includes('budget') ||
      normalized.includes('envelope') ||
      normalized.includes('spending cap') ||
      normalized.includes('fiscal plan')
    ) {
      const budgets = await prisma.budget.findMany({
        where: {
          ...(scopedOrgId ? { organizationId: scopedOrgId } : {}),
          status: 'ACTIVE',
        },
        include: {
          organization: { select: { legalName: true, code: true } },
          lines: true,
        },
        orderBy: { fiscalYear: 'desc' },
      });

      if (!budgets.length) {
        reply = !isGroupScope
          ? `**Fiscal Budgets & Envelopes (${scopedOrgName}):**\n\nNo active fiscal budget envelopes are currently recorded for **${scopedOrgName}**.\n\nYou can establish operational spending envelopes in **Budgets & Commitments**.`
          : `**BEMS Group Consolidated Fiscal Budgets:**\n\nNo active fiscal budget envelopes are currently registered across the group.`;
      } else {
        const totalBudgetNaira = budgets.reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0);
        const budgetList = budgets
          .map((b) => {
            const amtFormatted = formatNaira(Number(b.totalAmount) || 0);
            return `• **${b.organization.legalName}** (${b.fiscalYear} · ${b.periodName}): **${amtFormatted}** [${b.lines.length} expense lines]`;
          })
          .join('\n');

        reply = !isGroupScope
          ? `**Fiscal Budget Allocation for ${scopedOrgName}:**\n\n${budgetList}\n\n• **Combined Cap:** **${formatNaira(totalBudgetNaira)}**\n• **Spending Policy:** Every requisition against department lines is validated against available headroom in real time.`
          : `**BEMS Group Consolidated Fiscal Budgets:**\n\n${budgetList}\n\n• **Total Conglomerate Budget Cap:** **${formatNaira(totalBudgetNaira)}** across ${budgets.length} entities.`;
      }
    } else if (
      normalized.includes('who works here') ||
      normalized.includes('list staff') ||
      normalized.includes('our staff') ||
      normalized.includes('all staff') ||
      normalized.includes('employees') ||
      normalized.includes('workforce')
    ) {
      const staffList = await prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          role: 'STAFF',
          ...(scopedOrgId ? { assignments: { some: { subsidiaryId: scopedOrgId } } } : {}),
        },
        include: {
          assignments: {
            include: { subsidiary: { select: { legalName: true } }, department: { select: { name: true } } },
            take: 1,
          },
        },
        orderBy: { legalName: 'asc' },
        take: 15,
      });

      if (!staffList.length) {
        reply = !isGroupScope
          ? `**Workforce Directory (${scopedOrgName}):**\n\nNo active staff members are currently assigned to **${scopedOrgName}**.`
          : `**BEMS Group Workforce Directory:**\n\nNo active staff members found across the group.`;
      } else {
        const listText = staffList
          .map((s, idx) => {
            const pos = s.assignments[0]?.positionName || 'Staff';
            const dept = s.assignments[0]?.department?.name || 'General Operations';
            const exemptBadge = (s as any).isAttendanceExempt ? ' *(Attendance Exempt)*' : '';
            return `${idx + 1}. **${s.legalName}** (${s.employeeNumber}) — ${pos} · *${dept}*${exemptBadge}`;
          })
          .join('\n');

        reply = !isGroupScope
          ? `**Active Workforce Assigned to ${scopedOrgName} (${totalActiveStaff} personnel):**\n\n${listText}\n\n*Strictly isolated to ${scopedOrgName}'s organizational roster.*`
          : `**BEMS Group Active Workforce (${totalActiveStaff} personnel across all entities):**\n\n${listText}`;
      }
    } else if (
      normalized.includes('create subsidiary') ||
      normalized.includes('new subsidiary') ||
      normalized.includes('add subsidiary')
    ) {
      if (!isExecutive) {
        reply = `🔒 **Executive Authority Required:** Corporate entity formation and subsidiary provisioning can only be authorized by the Group Managing Director or System Administrator.`;
      } else {
        reply = `🏛️ **Corporate Subsidiary Provisioning Specification**\n\n` +
          `To configure and launch a new operating subsidiary on BEMS, the following corporate parameters are required:\n\n` +
          `1. **Corporate Legal Name**: Official registered name (e.g., *Arella Creative Studio Ltd*)\n` +
          `2. **Brand Hex Color**: Primary identity color (e.g., \`#EA580C\` Orange, \`#2563EB\` Blue, \`#0D8A70\` Emerald)\n` +
          `3. **Industry / Operational Sector**: Primary business focus (e.g., *Media Production*, *Agribusiness & Logistics*, *Tech IP*)\n` +
          `4. **Headquarters Location**: Physical base / State (e.g., *14 Admiralty Way, Lekki Phase 1, Lagos*)\n` +
          `5. **Shortcode (Optional)**: 3–4 letter code (e.g., *SAL*, *ACS* - will be auto-generated if omitted)\n` +
          `6. **Functional Currency**: Default is \`NGN\` (or \`USD\`, \`GBP\`, \`EUR\`)\n\n` +
          `*(Note: File uploads including corporate logos, registration certificates, and brand assets are excluded from AI tools and uploaded directly via the Web Dashboard).*\n\n` +
          `💬 *Please reply with these details, and I will prepare the complete subsidiary dossier for your authorization.*`;
        
        actionCard = {
          type: 'SPECIFICATION_CHECKLIST',
          title: 'Subsidiary Creation Checklist',
          fields: ['Corporate Legal Name', 'Brand Color (Hex)', 'Industry Sector', 'Headquarters City/State', 'Shortcode'],
        };
      }
    } else if (
      normalized.includes('onboard admin') ||
      normalized.includes('create admin') ||
      normalized.includes('new admin') ||
      normalized.includes('invite admin')
    ) {
      if (!isExecutive) {
        reply = `🔒 **Executive Authority Required:** Only the GMD or Super Admin can provision executive accounts.`;
      } else {
        reply = `👤 **Executive Admin Onboarding Specification**\n\n` +
          `*(Strict 3-Role Governance: Limited strictly to SUPER_ADMIN or GMD. Staff accounts use self-service mobile app registration).*\n\n` +
          `Please provide the following required details:\n\n` +
          `1. **Full Legal Name**: e.g., *Engr. Michael Adeyemi*\n` +
          `2. **Corporate Work Email**: e.g., *adeyemi@bemsgroup.com*\n` +
          `3. **Official Mobile Number**: e.g., *+234 803 000 1122*\n` +
          `4. **Executive Role**: Strictly \`SUPER_ADMIN\` or \`GMD\`\n` +
          `5. **Assigned Entity**: Primary subsidiary (e.g., *BEMS Group Holdings HQ*)\n\n` +
          `💬 *Once provided, an executive invitation token with cryptographic sign-in credentials will be generated and dispatched.*`;

        actionCard = {
          type: 'SPECIFICATION_CHECKLIST',
          title: 'Admin Onboarding Checklist',
          fields: ['Full Legal Name', 'Corporate Work Email', 'Mobile Phone', 'Executive Role (SUPER_ADMIN or GMD)', 'Assigned Entity'],
        };
      }
    } else if (
      normalized.includes('register account') ||
      normalized.includes('add bank') ||
      normalized.includes('update bank') ||
      normalized.includes('register bank')
    ) {
      if (!isExecutive) {
        reply = `🔒 **Executive Authority Required:** Banking details can only be registered by Executive Leadership.`;
      } else {
        reply = `🏦 **Bank Account Registration Specification**\n\n` +
          `To link or update a disbursement or corporate account, please provide:\n\n` +
          `1. **Target Category**: \`STAFF\`, \`SUBSIDIARY\`, or \`VENDOR\`\n` +
          `2. **Beneficiary Identifier**: Staff email/name, Subsidiary shortcode, or Vendor name\n` +
          `3. **Bank Name**: e.g., *Guaranty Trust Bank, Kuda Bank, Zenith, Access, OPay, Moniepoint*\n` +
          `4. **Account Number**: Exactly 10-digit NUBAN\n` +
          `5. **Verified Beneficiary Name**: Exact account name on record with NIBSS\n\n` +
          `💬 *Once provided, the account will be validated and linked to the disbursement routing ledger.*`;

        actionCard = {
          type: 'SPECIFICATION_CHECKLIST',
          title: 'Bank Registration Checklist',
          fields: ['Target Type (STAFF/SUBSIDIARY/VENDOR)', 'Beneficiary Name/Email', 'Bank Name', '10-Digit Account Number', 'Verified Account Name'],
        };
      }
    } else if (
      normalized.includes('3-way match') ||
      normalized.includes('3 way match') ||
      normalized.includes('three way match') ||
      normalized.includes('vendor invoice') ||
      normalized.includes('matching')
    ) {
      const matchRecords = await prisma.threeWayMatchRecord.findMany({
        where: {
          ...(scopedOrgId ? { request: { subsidiaryId: scopedOrgId } } : {}),
        },
        take: 5,
        orderBy: { matchedAt: 'desc' },
        include: {
          request: { select: { requestNumber: true, title: true, vendor: { select: { name: true } } } },
          invoice: { select: { invoiceNumber: true } },
          grn: { select: { grnNumber: true, status: true } },
        },
      });

      if (!matchRecords.length) {
        reply = `**Automated 3-Way Matching Engine (${scopedOrgName}):**\n\n` +
          `• **Status:** Active & Enforced\n` +
          `• **Protocol:** Every vendor expenditure automatically cross-verifies Purchase Order rate, physical Goods Receipt Note (GRN) acceptance, and Vendor Invoice billed amount.\n` +
          `• **Tolerance Gate:** 0% unapproved price variance. Deliveries flagged as DAMAGED or PARTIAL block automated payment release until authorized by the GMD.`;
      } else {
        const rows = matchRecords
          .map((m) => {
            const statusIcon = m.status === 'MATCH_CONFIRMED' ? '✅' : '⚠️';
            const poN = (Number(m.poAmountMinor) / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
            const invN = (Number(m.invoiceAmountMinor) / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
            return `• ${statusIcon} **${m.request.requestNumber}** (${m.request.vendor?.name || 'Vendor'}):\n  - PO: ${poN} | Inv #${m.invoice.invoiceNumber}: ${invN}\n  - GRN: ${m.grn?.grnNumber || 'Awaiting GRN'} (${m.grn?.status || 'Pending'})\n  - Status: \`${m.status}\``;
          })
          .join('\n\n');

        reply = `**${scopedOrgName} 3-Way Match Verification Radar:**\n\n${rows}\n\n*Invoices with \`MATCH_CONFIRMED\` are pre-cleared for GMD disbursement.*`;
      }
    } else if (
      normalized.includes('intercompany') ||
      normalized.includes('debit note') ||
      normalized.includes('credit note') ||
      normalized.includes('netting')
    ) {
      const notes = await prisma.intercompanyNote.findMany({
        where: {
          status: 'ISSUED',
          ...(scopedOrgId ? { OR: [{ sourceEntityId: scopedOrgId }, { targetEntityId: scopedOrgId }] } : {}),
        },
        include: {
          sourceEntity: { select: { legalName: true } },
          targetEntity: { select: { legalName: true } },
        },
        take: 5,
        orderBy: { generatedAt: 'desc' },
      });

      if (!notes.length) {
        reply = !isGroupScope
          ? `**Intercompany Clearing & Netting Ledger (${scopedOrgName}):**\n\n` +
            `• **Status:** All intercompany obligations for **${scopedOrgName}** are currently balanced.\n` +
            `• **Protocol:** Cross-entity expenditures and shared resource allocations generate bilateral Debit/Credit notes with zero double-counting.`
          : `**Automated Intercompany Clearing & Netting Ledger:**\n\n` +
            `• **Status:** All intercompany obligations are currently balanced.\n` +
            `• **Protocol:** When Central Treasury or any subsidiary incurs expenditure or payroll on behalf of another entity, bilateral Debit/Credit notes are generated automatically with zero double-counting.\n` +
            `• **GMD Netting:** Bilateral balances can be offset and settled with 1-click GMD authorization.`;
      } else {
        const noteList = notes
          .map((n) => {
            const amountN = (Number(n.totalAmountMinor) / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
            const typePill = n.noteType === 'DEBIT_NOTE' ? '🔴 DEBIT' : '🟢 CREDIT';
            return `• ${typePill} **${n.noteNumber}**: ${amountN}\n  - *${n.sourceEntity.legalName}* ➔ *${n.targetEntity.legalName}*\n  - Purpose: ${n.description}`;
          })
          .join('\n\n');

        reply = `**Active Intercompany Balance & Netting Matrix (${scopedOrgName}):**\n\n${noteList}\n\n💬 *You can instruct me to stage a netting settlement across these notes for your authorization.*`;
      }
    } else if (
      normalized.includes('subsidiary') ||
      normalized.includes('entities') ||
      normalized.includes('company') ||
      normalized.includes('companies')
    ) {
      const orgNames = orgs.length ? orgs.map((o) => `• **${o.legalName}** (${o.type})`).join('\n') : `• **${scopedOrgName}**`;
      reply = !isGroupScope
        ? `**Active Workspace Subsidiary:**\n\n• **${scopedOrgName}** (Code: \`${scopedOrgCode}\`)\n\n*The AI Copilot is strictly isolated to this subsidiary. To view the group conglomerate portfolio, switch to BEMS Group HQ.*`
        : `**BEMS Group Multi-Subsidiary Architecture:**\n\n${orgNames}\n\nAll intercompany transactions generate automated bilateral Debit/Credit notes with zero double-counting.`;
    } else {
      // General financial advisor intelligence fallback
      const hasSpecificQuery = message.length > 15 && !normalized.includes('hello') && !normalized.includes('hi');
      reply = !isGroupScope
        ? `I am your **dedicated AI Financial Manager for ${scopedOrgName}**, grounded with live database ledger telemetry strictly for this subsidiary.\n\n` +
          (hasSpecificQuery ? `I noted your instruction: *"${message}"*.\n\n` : '') +
          `You can ask me:\n` +
          `• *"What is our cash balance in ${scopedOrgName}'s bank accounts?"*\n` +
          `• *"Who works at ${scopedOrgName}?"*\n` +
          `• *"What is our budget allocation?"*\n` +
          `• *"Are there any fund requests pending for ${scopedOrgName}?"*\n` +
          `• *"Show today's attendance for our staff."*\n\n` +
          `*🔒 Note: I am partitioned exclusively to ${scopedOrgName}. To view other subsidiaries or consolidated figures, switch to BEMS Group HQ.*`
        : `I am your **BEMS Executive Financial AI Copilot**, grounded with live database ledger telemetry across BEMS Group Conglomerate HQ.\n\n` +
          (hasSpecificQuery ? `I noted your instruction: *"${message}"*.\n\n` : '') +
          `You can ask me:\n` +
          `• *"What is our total cash balance across bank accounts?"*\n` +
          `• *"Are there any fund requests pending my approval?"*\n` +
          `• *"Give me the morning executive briefing."*\n` +
          `• *"Who has open cash advance accountability cases?"*\n` +
          `• *"Summarize our subsidiary structure and budget allocations."*\n\n` +
          `How would you like to direct financial oversight right now?`;
    }

    return NextResponse.json({
      message: reply,
      actionCard,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    });
  } catch (error: any) {
    if (error?.error_code === 'AI_ACCESS_DISABLED') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'AI_ACCESS_DISABLED',
          scope: error.scope,
          mode: error.mode,
          error: error.message,
          message: `🔒 **Access Restricted by Admin:** ${error.message}`,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        },
        { status: 403 }
      );
    }
    console.error('AI Chat Error:', error);
    return NextResponse.json(
      { error: 'Failed to process financial AI query.' },
      { status: 500 }
    );
  }
}
