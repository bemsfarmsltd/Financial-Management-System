'use client';

import { useState, useEffect } from 'react';
import { roleDashboardConfigs, RoleDashboardConfig, FunnelStageData, VolumeRowData, BentoPillData } from './roleCardConfigs';

interface DynamicDashboardParams {
  role: string;
  businessName: string;
  subsidiaryId?: string;
}

export function useDynamicDashboardConfig({ role, businessName, subsidiaryId }: DynamicDashboardParams): {
  config: RoleDashboardConfig;
  loading: boolean;
  refetch: () => void;
} {
  const baseConfig: RoleDashboardConfig = roleDashboardConfigs[role] || roleDashboardConfigs.GMD;
  const [config, setConfig] = useState<RoleDashboardConfig>(baseConfig);
  const [loading, setLoading] = useState(true);

  const fetchLiveTelemetry = async () => {
    try {
      setLoading(true);
      const subParam = subsidiaryId && subsidiaryId !== 'ALL' ? `&subsidiaryId=${encodeURIComponent(subsidiaryId)}` : '';
      
      const [analyticsRes, requestsRes, staffRes] = await Promise.all([
        fetch(`/api/analytics?period=30d${subParam}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/requests?limit=5${subParam}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/staff${subsidiaryId && subsidiaryId !== 'ALL' ? `?orgId=${encodeURIComponent(subsidiaryId)}` : ''}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (!analyticsRes) {
        setConfig(baseConfig);
        setLoading(false);
        return;
      }

      const summary = analyticsRes.summary || {};
      const reqCount = Number(summary.requestCount || 0);
      const closedCases = Number(summary.closedCases || 0);
      const paidCount = Number(summary.paidCount || summary.disbursementsCount || 0);
      const pendingCount = Number(summary.pendingCount || 0);
      const approvedCount = Number(summary.approvedCount || 0);
      const paidMinor = Number(summary.paidMinor || 0);
      const requestedMinor = Number(summary.requestedMinor || 0);

      // 1. Dynamic Bento Pills
      const bentoPills: BentoPillData[] = [
        {
          label: subsidiaryId && subsidiaryId !== 'ALL' ? `${businessName} Requests` : 'Total Group Requests',
          value: String(reqCount),
          delta: reqCount > 0 ? `${reqCount} total recorded in system` : '0 requests across subsidiaries',
          isPrimary: true,
          link: 'Fund requests',
        },
        {
          label: 'Closed & Accounted',
          value: String(closedCases),
          delta: closedCases > 0 ? `${closedCases} closed with verified proof` : '0 cases awaiting proof',
          link: 'Accountability closure',
        },
        {
          label: 'Payments Recorded',
          value: String(paidCount),
          delta: paidCount > 0 ? `${paidCount} payment transactions` : 'No payments disbursed yet',
          link: 'Disbursements desk',
        },
        {
          label: 'Executive Review Required',
          value: String(pendingCount),
          delta: pendingCount > 0 ? `${pendingCount} awaiting authorization` : 'Review queue is all clear',
          statusBadge: pendingCount > 0 ? 'Action Needed' : undefined,
          link: 'Approvals & payments',
        },
      ];

      // 2. Dynamic Stepped Funnel
      const formatAmount = (minor: number) => {
        if (!minor) return '₦0';
        const val = minor / 100;
        if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `₦${(val / 1_000).toFixed(0)}k`;
        return `₦${val.toLocaleString('en-NG')}`;
      };

      const funnelStages: FunnelStageData[] = [
        {
          label: 'Initiated Requests',
          value: String(reqCount),
          amount: formatAmount(requestedMinor),
          height: 175,
          drop: reqCount > 0 ? '100%' : '0%',
        },
        {
          label: 'In Review / Authorized',
          value: String(pendingCount),
          amount: formatAmount(Number(summary.pendingApprovalMinor || 0)),
          height: 145,
          drop: reqCount > 0 ? `${Math.round((pendingCount / reqCount) * 100)}%` : '0%',
        },
        {
          label: 'GMD Approved',
          value: String(approvedCount),
          amount: formatAmount(Number(summary.approvedUnpaidMinor || 0)),
          height: 115,
          drop: reqCount > 0 ? `${Math.round((approvedCount / reqCount) * 100)}%` : '0%',
        },
        {
          label: 'Payment Recorded',
          value: String(paidCount),
          amount: formatAmount(paidMinor),
          height: 85,
          drop: reqCount > 0 ? `${Math.round((paidCount / reqCount) * 100)}%` : '0%',
        },
        {
          label: 'Audited & Cleared',
          value: String(closedCases),
          amount: formatAmount(closedCases * 100000),
          height: 65,
          drop: 'Closed',
        },
      ];

      // 3. Dynamic Volume Outflow & Categories
      const categories: { label: string; count: number; amountMinor: number }[] = analyticsRes.categories || [];
      const totalVolumeMinor = paidMinor > 0 ? paidMinor : requestedMinor;
      const palette = ['#10b981', '#ea580c', '#3b82f6', '#ec4899', '#8b5cf6'];

      const volumeRows: VolumeRowData[] = categories.length > 0
        ? categories.slice(0, 3).map((cat, idx) => ({
            label: cat.label,
            percent: totalVolumeMinor > 0 ? Math.max(1, Math.round((cat.amountMinor / totalVolumeMinor) * 100)) : 0,
            color: palette[idx % palette.length],
            hatchGradient: `repeating-linear-gradient(45deg, ${palette[idx % palette.length]}, ${palette[idx % palette.length]} 3px, #fb923c 3px, #fb923c 6px)`,
          }))
        : [
            {
              label: 'No expenditure recorded yet',
              percent: 100,
              color: '#cbd5e1',
              hatchGradient: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)',
            },
          ];

      // 4. Dynamic Spending Velocity Capsules (Sunday to Saturday)
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const rawSeries: { key: string; label: string; requestCount: number; requestedMinor: number }[] = analyticsRes.series || [];
      const capsuleDays = dayNames.map((day, idx) => {
        const item = rawSeries[idx];
        const count = item ? item.requestCount : 0;
        const height = count > 0 ? Math.min(170, 70 + count * 20) : 70;
        return {
          day,
          height,
          type: count > 3 ? ('solid-dark' as const) : count > 1 ? ('solid-mid' as const) : count > 0 ? ('solid-light' as const) : ('hatched' as const),
          tooltip: count > 0 ? `${count} reqs` : undefined,
        };
      });

      // 5. Dynamic Active Capital Commitments / Recent Requests
      const liveRequests = requestsRes?.requests || [];
      const projects = liveRequests.length > 0
        ? liveRequests.map((r: any, idx: number) => {
            const glyphs: ('endpoints' | 'onboarding' | 'dashboard' | 'optimize' | 'testing')[] = ['endpoints', 'onboarding', 'dashboard', 'optimize', 'testing'];
            return {
              title: r.title,
              date: r.neededBy ? `Due: ${new Date(r.neededBy).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}` : `Ref: ${r.requestNumber}`,
              glyph: glyphs[idx % glyphs.length],
            };
          })
        : [
            {
              title: 'No active expenditure requests',
              date: 'Submit a new request to track in real time',
              glyph: 'endpoints' as const,
            },
          ];

      // 6. Dynamic Team Members / Registered Staff
      const liveStaff = staffRes?.employees || [];
      const teamMembers = liveStaff.length > 0
        ? liveStaff.slice(0, 4).map((emp: any, idx: number) => {
            const emojis = ['👨🏾‍💼', '👨🏾‍💻', '🧔🏾‍♂️', '👩🏾‍💼', '👨🏽‍🎨'];
            const bgs = ['#ffedd5', '#fef3c7', '#ede9fe', '#e0f2fe'];
            const roleName = emp.role ? emp.role.replaceAll('_', ' ') : 'Staff';
            const dept = emp.assignments?.[0]?.department?.name || emp.assignments?.[0]?.subsidiary?.legalName || 'Operations';
            return {
              name: emp.legalName,
              avatarEmoji: emojis[idx % emojis.length],
              avatarBg: bgs[idx % bgs.length],
              task: `${roleName} · ${dept}`,
              status: emp.status === 'ACTIVE' ? ('Completed' as const) : ('Pending' as const),
              statusColor: emp.status === 'ACTIVE' ? '#f0fdf4' : '#fefce8',
              textColor: emp.status === 'ACTIVE' ? '#16a34a' : '#ca8a04',
              borderColor: emp.status === 'ACTIVE' ? '#dcfce7' : '#fef08a',
            };
          })
        : baseConfig.teamMembers;

      // 7. Dynamic Accountability Clearance Rate
      const arcPercent = paidCount > 0 ? Math.min(100, Math.round((closedCases / paidCount) * 100)) : 100;

      // 8. Dynamic SLA Clock
      const decisionQueue = analyticsRes.decisionQueue || [];
      const oldestPending = decisionQueue[0];
      const timerValue = oldestPending ? `${String(Math.max(1, 24 - (oldestPending.ageDays * 24))).padStart(2, '0')}:00:00` : '00:00:00';
      const timerSubtitle = oldestPending ? `Action queue: ${oldestPending.requestNumber}` : 'All requests within SLA';

      const transactionsAmount = paidCount > 0 ? String(paidCount) : '0';
      const transactionsDelta = paidCount > 0 ? `+${paidCount}` : '0';

      setConfig({
        ...baseConfig,
        bentoPills,
        funnelStages,
        volumeAmount: formatAmount(paidMinor),
        volumeRows,
        capsuleDays,
        projects,
        teamMembers,
        arcPercent,
        arcSubtitle: `${closedCases} of ${paidCount || reqCount || 0} Cleared`,
        timerValue,
        timerSubtitle,
        transactionsAmount,
        transactionsDelta,
      });
    } catch (err) {
      console.error('Error loading live telemetry:', err);
      setConfig(baseConfig);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveTelemetry();
  }, [role, businessName, subsidiaryId]);

  return { config, loading, refetch: fetchLiveTelemetry };
}
