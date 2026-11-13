import { prisma } from "@/lib/prisma";
import { sendEmail, getExecutiveRecipients } from "@/lib/email";
import { dispatchNotificationBridge, resolveGmdNotificationTarget } from "@/lib/notifications/bridge";

const DIGEST_SETTING_KEY = "MORNING_DIGEST_LAST_SENT_DATE";

function getLagosDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function formatNaira(minor: bigint | number): string {
  const num = typeof minor === "bigint" ? Number(minor) : minor;
  return `₦${Math.round(num / 100).toLocaleString("en-NG")}`;
}

export interface MorningDigestResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  dateKey: string;
  whatsappStatus?: string;
  emailSent?: boolean;
  counts: {
    pendingRequests: number;
    unreadStaffMessages: number;
    pendingPayrollBatches: number;
    pendingLeaves: number;
    pendingWalletReleases: number;
    pendingStaffApprovals: number;
    recurringFeesCount: number;
    recurringDueSoonCount: number;
  };
}

export async function buildAndSendGmdMorningDigest(options?: { force?: boolean }): Promise<MorningDigestResult> {
  const force = Boolean(options?.force);
  const dateKey = getLagosDateString();

  // Resolve primary organization (Group HQ) for idempotent WorkspaceSetting storage
  const rootOrg = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, legalName: true },
  });

  if (!force && rootOrg) {
    const existing = await prisma.workspaceSetting.findUnique({
      where: {
        organizationId_key: {
          organizationId: rootOrg.id,
          key: DIGEST_SETTING_KEY,
        },
      },
    });
    if (existing?.value === dateKey) {
      return {
        ok: true,
        skipped: true,
        reason: `Morning digest already dispatched for ${dateKey}.`,
        dateKey,
        counts: {
          pendingRequests: 0,
          unreadStaffMessages: 0,
          pendingPayrollBatches: 0,
          pendingLeaves: 0,
          pendingWalletReleases: 0,
          pendingStaffApprovals: 0,
          recurringFeesCount: 0,
          recurringDueSoonCount: 0,
        },
      };
    }
  }

  const now = new Date();
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    pendingRequests,
    unreadStaffMessages,
    pendingPayrollBatches,
    pendingLeaves,
    pendingWalletReleases,
    pendingStaffApprovals,
    recurringRequests,
    gmdTarget,
  ] = await Promise.all([
    prisma.expenditureRequest.findMany({
      where: { approvalStatus: { in: ["SUBMITTED", "IN_REVIEW"] } },
      select: {
        requestNumber: true,
        title: true,
        amountMinor: true,
        requester: { select: { legalName: true } },
        subsidiary: { select: { legalName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.staffAdminMessage.findMany({
      where: {
        channel: "GMD",
        senderRole: "STAFF",
        isReadByAdmin: false,
      },
      select: {
        senderName: true,
        message: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.payrollBatch.findMany({
      where: { status: { in: ["SUBMITTED", "PREPARED"] } },
      select: {
        id: true,
        period: { select: { year: true, month: true } },
        totalNetMinor: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        leaveType: true,
        employee: { select: { legalName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.walletReleaseProposal.findMany({
      where: { status: { in: ["PROPOSED", "PENDING_CONFIRMATION", "STAGED"] } },
      select: {
        id: true,
        amountMinor: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.employee.count({
      where: {
        role: "STAFF",
        approvalStatus: "PENDING",
        status: { not: "TERMINATED" },
      },
    }),
    prisma.expenditureRequest.findMany({
      where: {
        isRecurring: true,
        approvalStatus: { not: "REJECTED" },
      },
      select: {
        requestNumber: true,
        title: true,
        amountMinor: true,
        recurringInterval: true,
        neededBy: true,
      },
      orderBy: { neededBy: "asc" },
      take: 25,
    }),
    resolveGmdNotificationTarget(),
  ]);

  const totalPendingRequestMinor = pendingRequests.reduce(
    (sum, r) => sum + BigInt(r.amountMinor || 0),
    BigInt(0)
  );
  const recurringDueSoon = recurringRequests.filter(
    (r) => r.neededBy && new Date(r.neededBy).getTime() <= sevenDaysAhead.getTime()
  );
  const monthlyRecurringMinor = recurringRequests.reduce((sum, r) => {
    const amt = BigInt(r.amountMinor || 0);
    if (r.recurringInterval === "ANNUAL") return sum + amt / BigInt(12);
    if (r.recurringInterval === "QUARTERLY") return sum + amt / BigInt(3);
    return sum + amt;
  }, BigInt(0));

  const lines: string[] = [
    `☀️ *BEMS Group Morning Executive Briefing (${dateKey})*`,
    `Good morning, *${gmdTarget.name}*. Here is today's operational & treasury digest:`,
    "",
    `📋 *1. Pending Fund Requests (${pendingRequests.length})*`,
  ];

  if (pendingRequests.length === 0) {
    lines.push("• No pending fund requests.");
  } else {
    lines.push(`• Total Value: *${formatNaira(totalPendingRequestMinor)}*`);
    for (const r of pendingRequests.slice(0, 4)) {
      lines.push(
        `  – *${r.requestNumber}*: ${r.title} (${formatNaira(r.amountMinor)}) · ${r.requester?.legalName || "Staff"}`
      );
    }
  }

  lines.push("");
  lines.push(`💬 *2. Unread Staff Messages (${unreadStaffMessages.length})*`);
  if (unreadStaffMessages.length === 0) {
    lines.push("• All staff executive messages are read.");
  } else {
    for (const m of unreadStaffMessages.slice(0, 4)) {
      const snippet = m.message.length > 75 ? `${m.message.slice(0, 75)}...` : m.message;
      lines.push(`  – *${m.senderName}*: "${snippet}"`);
    }
  }

  const totalApprovalsCount =
    pendingPayrollBatches.length +
    pendingLeaves.length +
    pendingWalletReleases.length +
    pendingStaffApprovals;

  lines.push("");
  lines.push(`✅ *3. Approvals Queue (${totalApprovalsCount} items)*`);
  if (totalApprovalsCount === 0) {
    lines.push("• All payroll, leave, wallet & onboarding approvals are clear.");
  } else {
    if (pendingPayrollBatches.length > 0) {
      for (const b of pendingPayrollBatches.slice(0, 2)) {
        const periodLabel = b.period ? `${b.period.month}/${b.period.year}` : b.status;
        lines.push(
          `  – Payroll Batch (${periodLabel}): *${formatNaira(b.totalNetMinor)}* awaiting sign-off`
        );
      }
    }
    if (pendingLeaves.length > 0) {
      lines.push(`  – Leave Applications: *${pendingLeaves.length}* awaiting review`);
    }
    if (pendingWalletReleases.length > 0) {
      lines.push(`  – Wallet Releases: *${pendingWalletReleases.length}* pending confirmation`);
    }
    if (pendingStaffApprovals > 0) {
      lines.push(`  – Staff Onboarding: *${pendingStaffApprovals}* pending activation`);
    }
  }

  lines.push("");
  lines.push(`🔁 *4. Recurring Fees & Subscriptions (${recurringRequests.length} active)*`);
  if (recurringRequests.length === 0) {
    lines.push("• No active recurring commitments recorded.");
  } else {
    lines.push(`• Est. Monthly Run-Rate: *${formatNaira(monthlyRecurringMinor)}*`);
    if (recurringDueSoon.length > 0) {
      lines.push(`• Due within 7 days (${recurringDueSoon.length}):`);
      for (const rf of recurringDueSoon.slice(0, 4)) {
        lines.push(`  – *${rf.title}*: ${formatNaira(rf.amountMinor)} (${rf.recurringInterval || "MONTHLY"})`);
      }
    } else {
      for (const rf of recurringRequests.slice(0, 3)) {
        lines.push(`  – *${rf.title}*: ${formatNaira(rf.amountMinor)} (${rf.recurringInterval || "MONTHLY"})`);
      }
    }
  }

  lines.push("");
  lines.push("🔗 Open Cockpit: https://bemserp.work");

  const rawText = lines.join("\n");

  const waResult = await dispatchNotificationBridge({
    channel: "WHATSAPP",
    recipient: gmdTarget.phone,
    eventType: "MORNING_DIGEST",
    title: `Morning Executive Briefing (${dateKey})`,
    summary: `Requests: ${pendingRequests.length}, Staff Messages: ${unreadStaffMessages.length}, Approvals: ${totalApprovalsCount}, Recurring Fees: ${recurringRequests.length}`,
    correlationId: `morning_digest_${dateKey}_${Date.now()}`,
    metadata: {
      dateKey,
      rawText,
    },
  });

  // Also email the morning digest to executive recipients
  let emailSent = false;
  try {
    const execs = await getExecutiveRecipients();
    const gmdEmails = gmdTarget.email
      ? [gmdTarget.email]
      : execs.map((e) => e.email).filter(Boolean);
    if (gmdEmails.length > 0) {
      const htmlBody = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
            <div style="font-size:11px;font-weight:800;color:#ea580c;letter-spacing:0.08em;text-transform:uppercase;">BEMS Group · Morning Executive Briefing</div>
            <h2 style="margin:6px 0 12px;font-size:20px;color:#0f172a;">Daily Digest — ${dateKey}</h2>
            <pre style="white-space:pre-wrap;font-family:Inter,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#334155;background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;">${rawText
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")}</pre>
            <div style="margin-top:16px;">
              <a href="https://bemserp.work" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;">Open BEMS Executive Cockpit →</a>
            </div>
          </div>
        </div>
      `;
      await sendEmail({
        to: gmdEmails[0],
        subject: `BEMS Group Morning Briefing (${dateKey}) — ${pendingRequests.length} Requests · ${unreadStaffMessages.length} Messages · ${totalApprovalsCount} Approvals`,
        html: htmlBody,
      });
      emailSent = true;
    }
  } catch (err) {
    console.error("[MorningDigest] Email dispatch failed:", err);
  }

  if (rootOrg) {
    const actorId = gmdTarget.id || "SYSTEM";
    await prisma.workspaceSetting.upsert({
      where: {
        organizationId_key: {
          organizationId: rootOrg.id,
          key: DIGEST_SETTING_KEY,
        },
      },
      update: {
        value: dateKey,
        updatedById: actorId,
      },
      create: {
        organizationId: rootOrg.id,
        key: DIGEST_SETTING_KEY,
        value: dateKey,
        updatedById: actorId,
      },
    });
  }

  return {
    ok: true,
    dateKey,
    whatsappStatus: waResult.whatsappStatus || "SKIPPED",
    emailSent,
    counts: {
      pendingRequests: pendingRequests.length,
      unreadStaffMessages: unreadStaffMessages.length,
      pendingPayrollBatches: pendingPayrollBatches.length,
      pendingLeaves: pendingLeaves.length,
      pendingWalletReleases: pendingWalletReleases.length,
      pendingStaffApprovals,
      recurringFeesCount: recurringRequests.length,
      recurringDueSoonCount: recurringDueSoon.length,
    },
  };
}

