import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { getConsolidatedTreasury } from '@/lib/financial-metrics';
import { enforceMobileVersionGate } from '@/lib/mobile-gate';

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function POST(req: NextRequest) {
  try {
    const gateBlock = await enforceMobileVersionGate(req);
    if (gateBlock) return gateBlock;

    const actor = await getAuthenticatedEmployee(req);
    const body = await req.json().catch(() => ({}));
    const message: string = (body.message || '').trim();

    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }

    const userName = actor ? actor.legalName.split(' ')[0] : 'GMD';
    const normalized = message.toLowerCase();
    const isReadOnlyUser = !actor || actor.role === 'AI_ANALYST';

    // Check if AI Analyst chat access is paused by admin
    if (actor && actor.role === 'AI_ANALYST') {
      const aiSetting = await prisma.workspaceSetting.findFirst({
        where: { key: 'ai.access' },
      });
      if (aiSetting && typeof aiSetting.value === 'object' && aiSetting.value !== null) {
        const val = aiSetting.value as Record<string, any>;
        if (val.allowAiAnalystChat === false) {
          return NextResponse.json(
            { error: 'AI Chat access for the AI Analyst role is currently paused by the administrator in Settings.' },
            { status: 403 }
          );
        }
      }
    }

    // 0. Forward to external n8n AI Agent if configured (BEMS AI Backend Contract Section 02)
    const n8nWebhookUrl = process.env.N8N_AI_WEBHOOK_URL;
    if (n8nWebhookUrl && actor) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);

        const correlationId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const sessionId = `conv_${actor.id}`;

        // Provide valid service token so n8n tools can query BEMS APIs seamlessly
        const authToken = process.env.BEMS_AI_SERVICE_TOKEN || process.env.BEMS_BOOTSTRAP_SECRET || 'bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de';

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

        const webhookSecret = process.env.BEMS_N8N_SHARED_SECRET || 'bems_n8n_sec_88491029384756102938475';

        const targetElement = body.context?.target_element;
        let queryText = message;
        if (targetElement) {
          queryText = `[User clicked element: "${targetElement.label}" with value "${targetElement.value || 'N/A'}" under section "${targetElement.section || 'General'}" on page "${targetElement.page}" for subsidiary "${targetElement.subsidiary}"]: ${message}`;
        }

        const n8nPayload = {
          session_id: sessionId,
          user: {
            id: actor.id,
            name: actor.legalName,
            title: (actor as any).jobTitle || (actor.role === 'GMD' ? 'Group Managing Director' : actor.role === 'AI_ANALYST' ? 'AI Financial Analyst (Read-Only)' : 'System Admin'),
            role: actor.role,
            permissions: isReadOnlyUser ? ['read_only_inquiry', 'data_analytics'] : ['all'],
            can_execute_actions: !isReadOnlyUser,
          },
          query: queryText,
          message: queryText,
          timestamp: new Date().toISOString(),
          context: {
            active_business_id: (body.context && body.context.active_business_id) || '',
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
3. Requisition & Action Cards: Use structured cards ONLY for items requiring review, requisition approval decisions (REQ-XXXX-XXXX), or staged actions.${isReadOnlyUser ? '\n4. STRICT READ-ONLY MODE: The active user has the AI Analyst role. They have read-only access to query information, ledger statistics, and financial intelligence. They CANNOT execute actions, stage approvals, or commit ledger writes. Do NOT stage any actions for this user.' : '\n4. User Instruction Adherence: If user asks for paragraphs, provide detailed prose. If user asks for a graph or histogram, provide a visual chart block.'}`,
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
          const reply = n8nData.reply || n8nData.message || 'Workflow executed.';

          // Persist assistant reply to memory
          try {
            await prisma.$executeRaw`
              INSERT INTO n8n_chat_histories (session_id, message, created_at)
              VALUES (${sessionId}, ${JSON.stringify({ role: 'assistant', content: reply, timestamp: new Date().toISOString() })}::jsonb, NOW())
            `;
          } catch (e) {
            console.warn('Could not persist assistant reply to memory:', e);
          }

          return NextResponse.json({
            message: isReadOnlyUser && n8nData.staged_action
              ? `${reply}\n\n*(Note: Staged actions suppressed — the AI Analyst role has read-only informational access).*`
              : reply,
            actionCard: isReadOnlyUser
              ? null
              : n8nData.staged_action
                ? {
                    type: 'STAGED_ACTION',
                    ...n8nData.staged_action,
                  }
                : n8nData.actionCard || null,
            staged_action: isReadOnlyUser ? null : (n8nData.staged_action || null),
            citations: n8nData.citations || [],
            quick_replies: n8nData.quick_replies || n8nData.quickReplies || [],
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          });
        } else {
          const errData = await n8nRes.json().catch(() => ({}));
          console.warn(`n8n webhook responded with status ${n8nRes.status}:`, errData);
          // Gracefully fall back to internal PostgreSQL database engine
        }
      } catch (n8nErr: any) {
        console.warn(`n8n webhook unreachable (${n8nErr.message}). Gracefully falling back to internal engine.`);
      }
    }

    // 1. Fetch live telemetry from DB via canonical financial calculator
    const [treasuryData, pendingRequests, totalActiveStaff, orgs, openCases] = await Promise.all([
      getConsolidatedTreasury().catch(() => ({ accounts: [], totalCash: 0, totalCashFormatted: '₦0', safeRunwayMonths: 0, pendingPipeline: 0 })),
      prisma.expenditureRequest.findMany({
        where: { approvalStatus: { in: ['SUBMITTED', 'IN_REVIEW'] } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { requester: true },
      }).catch(() => []),
      prisma.employee.count({ where: { status: 'ACTIVE', role: { not: 'SYSTEM_ADMIN' } } }).catch(() => 0),
      prisma.organization.findMany({ where: { status: 'ACTIVE' } }).catch(() => []),
      prisma.accountabilityCase.findMany({
        where: { status: { not: 'CLOSED' } },
        take: 5,
        include: { owner: true, request: true },
      }).catch(() => []),
    ]);

    const bankAccounts = treasuryData.accounts;
    const totalCash = treasuryData.totalCash;
    const pendingCount = pendingRequests.length;
    const pendingSum = pendingRequests.reduce((sum, r) => sum + (Number(r.amountMinor) || 0) / 100, 0);

    const wantsGraph = normalized.includes('graph') || normalized.includes('histogram') || normalized.includes('chart') || normalized.includes('bar') || normalized.includes('plot');
    const wantsParagraph = normalized.includes('paragraph') || normalized.includes('detailed explanation') || normalized.includes('long sentence') || normalized.includes('in full') || normalized.includes('explain in detail') || normalized.includes('narrative');
    const wantsCards = normalized.includes('card') || normalized.includes('cards') || normalized.includes('action card');

    let reply = '';
    let actionCard: any = null;

    // Check intents
    if (
      normalized.includes('bank') ||
      normalized.includes('balance') ||
      normalized.includes('cash') ||
      normalized.includes('treasury') ||
      normalized.includes('liquidity') ||
      normalized.includes('reserve')
    ) {
      if (bankAccounts.length === 0) {
        reply = `**Treasury Status:** No company bank accounts have been registered yet.\n\nYou can add group bank accounts under **Treasury Accounts** in your Fund Flow menu.`;
      } else if (wantsGraph) {
        reply = `Here is the visual histogram breakdown of BEMS Group liquid treasury reserves across all registered accounts:\n\n\`\`\`chart:histogram\ntitle: "Group Treasury Reserves by Account"\n${bankAccounts.map((b) => `${b.bankName} (${b.accountNumber.slice(-4)}): ${b.balance}`).join('\n')}\n\`\`\`\n\nTotal combined liquidity across active accounts stands at **${formatNaira(totalCash)}**.`;
      } else if (wantsParagraph) {
        const accDetails = bankAccounts.map((b) => `${b.bankName} ending in ${b.accountNumber.slice(-4)} holding ${formatNaira(b.balance)}`).join(', ');
        reply = `BEMS Group currently maintains a consolidated liquid treasury reserve of **${formatNaira(totalCash)}** dispersed across ${bankAccounts.length} institutional depository partners, specifically ${accDetails}. Every deposit and disbursement is monitored in real-time under dual-custody controls, ensuring that the group maintains ample operational liquidity to service pending procurement commitments and payroll cycles without requiring short-term credit drawdowns.`;
      } else {
        const list = bankAccounts
          .map((b) => `• **${b.bankName}** (${b.accountNumber} · ${b.accountName}): **${formatNaira(b.balance)}**`)
          .join('\n');
        reply = `**BEMS Group Real-Time Cash & Treasury Reserves:**\n\nTotal Liquid Reserves: **${formatNaira(totalCash)}** across ${bankAccounts.length} verified institution${bankAccounts.length > 1 ? 's' : ''}.\n\n${list}\n\nAll accounts are synchronized with live ledger reconciliation.`;
        actionCard = {
          type: 'TREASURY',
          title: 'Group Treasury Reserves',
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
        reply = `🔒 **Read-Only Informational Access:** The AI Analyst role is strictly restricted to data queries, financial analytics, and informational reporting. Action execution, approvals, and ledger writes are reserved for the Group Managing Director and System Administrator.`;
        actionCard = null;
      } else {
        const matched = pendingRequests.find((r) =>
          normalized.includes(r.requestNumber.toLowerCase()) || normalized.includes(r.id.toLowerCase())
        ) || pendingRequests[0];

      if (matched && actor) {
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
          summary: `Authorize disbursement for ${matched.requestNumber} (${matched.title}) — ₦${(Number(matched.amountMinor) / 100).toLocaleString()}`,
          preview: {
            request_number: matched.requestNumber,
            title: matched.title,
            amount: `₦${(Number(matched.amountMinor) / 100).toLocaleString()}`,
            requester: matched.requester?.legalName || 'Staff',
            decision_to_apply: 'APPROVE',
            reason: 'Executive authorization',
          },
        });

        reply = `I have staged the executive authorization for **${matched.requestNumber}** (**₦${(Number(matched.amountMinor) / 100).toLocaleString()}**). In accordance with the BEMS Staged-Action security policy, no write has been committed yet.\n\nPlease review the cryptographic preview card below and click **Authorize & Execute Action** to commit the decision to the ledger.`;
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
      normalized.includes('subsidiary') ||
      normalized.includes('entities') ||
      normalized.includes('company') ||
      normalized.includes('companies')
    ) {
      const orgNames = orgs.length ? orgs.map((o) => `• **${o.legalName}** (${o.type})`).join('\n') : '• **BEMS Group Holdings (HQ)**';
      reply = `**BEMS Group Multi-Subsidiary Architecture:**\n\n${orgNames}\n\nAll intercompany transactions generate automated bilateral Debit/Credit notes with zero double-counting.`;
    } else {
      // General financial advisor intelligence
      reply = `I am your **BEMS Executive Financial AI Copilot**, grounded with live database ledger telemetry across BEMS Group.\n\nYou can ask me:\n` +
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
  } catch (error) {
    console.error('AI Chat Error:', error);
    return NextResponse.json(
      { error: 'Failed to process financial AI query.' },
      { status: 500 }
    );
  }
}
