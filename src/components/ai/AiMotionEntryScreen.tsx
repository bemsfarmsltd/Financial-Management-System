'use client';

import React, { useState, useEffect } from 'react';
import { AmaraHologramAvatar } from './AmaraHologramAvatar';
import { ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  onComplete: () => void;
  businessName?: string;
  userName?: string;
  userRole?: string;
  mode?: 'login' | 'reload';
}

export function AiMotionEntryScreen({
  onComplete,
  businessName = 'BEMS Group',
  userName = '',
  userRole = '',
  mode = 'reload',
}: Props) {
  const [financialIndex, setFinancialIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDissolving, setIsDissolving] = useState(false);

  // Dynamic user display name
  const displayName = userName?.trim() || (userRole === 'GMD' ? 'Dr Pastra' : userRole.includes('ADMIN') ? 'Bems system Admin' : 'Executive');

  const [liveUpdates, setLiveUpdates] = useState<Array<{ metric: string; text: string; tag: string; tagColor: string }>>([
    {
      metric: 'GROUP TELEMETRY',
      text: 'Synchronizing real-time ledger intelligence across BEMS Group subsidiaries...',
      tag: 'CONNECTING',
      tagColor: '#ea580c',
    },
    {
      metric: 'EXECUTIVE APPROVAL QUEUE',
      text: 'Connecting to live requisition approval pipeline...',
      tag: 'AUDIT',
      tagColor: '#0284c7',
    },
    {
      metric: 'ACCOUNTABILITY STATUS',
      text: 'Verifying 72-hour cash advance retirement evidence...',
      tag: 'VERIFYING',
      tagColor: '#059669',
    },
  ]);

  // Fetch real-time live database statistics on mount
  useEffect(() => {
    fetch('/api/briefing?_t=' + Date.now())
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const requests = Array.isArray(data.requests) ? data.requests : [];
        const budgets = Array.isArray(data.budgets) ? data.budgets : [];
        const accountabilityCases = Array.isArray(data.accountabilityCases) ? data.accountabilityCases : [];
        const disbursements = Array.isArray(data.disbursements) ? data.disbursements : [];
        const orgs = Array.isArray(data.organizations) ? data.organizations : [];

        // 1. Pending Approvals
        const pending = requests.filter((r: any) => r.approvalStatus === 'SUBMITTED' || r.approvalStatus === 'IN_REVIEW');
        const pendingSum = pending.reduce((sum: number, r: any) => sum + (Number(r.amountNaira) || 0), 0);

        // 2. Unpaid Approved
        const unpaid = requests.filter((r: any) => r.approvalStatus === 'APPROVED' && r.paymentStatus === 'UNPAID');
        const unpaidSum = unpaid.reduce((sum: number, r: any) => sum + (Number(r.amountNaira) || 0), 0);

        // 3. Accountability Compliance
        const now = new Date();
        const overdue = accountabilityCases.filter((c: any) => c.status !== 'CLOSED' && new Date(c.dueAt) < now);

        // 4. Budget Total
        const totalBudget = budgets.reduce((sum: number, b: any) => sum + (Number(b.totalAmount) || 0), 0);

        const realList = [
          {
            metric: 'EXECUTIVE APPROVAL QUEUE',
            text: pending.length > 0
              ? `${pending.length} pending requisition${pending.length > 1 ? 's' : ''} awaiting executive review (₦${pendingSum.toLocaleString()})`
              : 'Zero pending requisitions awaiting executive authorization — queue is fully cleared',
            tag: pending.length > 0 ? 'ACTION NEEDED' : 'CLEAR',
            tagColor: pending.length > 0 ? '#ea580c' : '#059669',
          },
          {
            metric: 'PAYMENT DISBURSEMENT QUEUE',
            text: unpaid.length > 0
              ? `${unpaid.length} approved requisition${unpaid.length > 1 ? 's' : ''} awaiting payment recording (₦${unpaidSum.toLocaleString()})`
              : 'All approved requisitions have been disbursed and matched to external bank records',
            tag: unpaid.length > 0 ? 'READY TO PAY' : 'SETTLED',
            tagColor: unpaid.length > 0 ? '#0284c7' : '#059669',
          },
          {
            metric: 'AUDIT & 72H COMPLIANCE',
            text: overdue.length === 0
              ? `Accountability is 100% compliant across ${accountabilityCases.length} advance case${accountabilityCases.length === 1 ? '' : 's'} with 0 overdue`
              : `${overdue.length} advance retirement${overdue.length > 1 ? 's' : ''} past 72-hour evidence deadline`,
            tag: overdue.length === 0 ? 'COMPLIANT' : 'OVERDUE',
            tagColor: overdue.length === 0 ? '#059669' : '#dc2626',
          },
          {
            metric: 'CONSOLIDATED CAPITAL ALLOCATION',
            text: `${orgs.length || 3} active subsidiaries operating with ₦${(totalBudget / 1_000_000).toFixed(1)}M total allocated capital`,
            tag: 'OPTIMAL',
            tagColor: '#38bdf8',
          },
          {
            metric: 'DISBURSEMENT LEDGER',
            text: `${disbursements.length} verified group disbursement${disbursements.length === 1 ? '' : 's'} recorded on ledger`,
            tag: 'VERIFIED',
            tagColor: '#059669',
          },
        ];

        setLiveUpdates(realList);
      })
      .catch((err) => console.warn('Could not load live briefing metrics for entry screen:', err));
  }, []);

  const financialUpdates = liveUpdates;

  // Cycle through real-time financial updates in login mode
  useEffect(() => {
    if (mode !== 'login') return;
    const timer = setInterval(() => {
      setFinancialIndex((prev) => (prev + 1) % financialUpdates.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [financialUpdates.length, mode]);

  // For reload mode: automatic graceful transition after avatar greeting (~3.2 seconds)
  useEffect(() => {
    if (mode === 'reload') {
      const autoTimer = setTimeout(() => {
        handleProceed();
      }, 3400);
      return () => clearTimeout(autoTimer);
    }
  }, [mode]);

  // Handle keyboard shortcuts (Enter / Space / Escape to proceed)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        handleProceed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleProceed = () => {
    setIsDissolving(true);
    setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(onComplete, 450);
    }, 400);
  };

  const currentUpdate = financialUpdates[financialIndex] || financialUpdates[0];

  return (
    <div
      className="amara-executive-motion-screen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'radial-gradient(circle at 50% 38%, #0f172a 0%, #070b14 65%, #02050b 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '28px 32px',
        color: '#f8fafc',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Top Telemetry Header HUD */}
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#38bdf8',
              boxShadow: '0 0 10px #38bdf8',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#94a3b8',
              textShadow: '0 2px 8px rgba(0,0,0,0.7)',
            }}
          >
            BEMS AI · AUTONOMOUS LEDGER GOVERNANCE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={14} color="#ea580c" />
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#f97316', letterSpacing: '0.04em' }}>
            BEMS Group HQ
          </span>
        </div>
      </div>

      {/* Centerpiece: Amara Holographic Avatar & Particle Convergence */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          width: '100%',
          maxWidth: '900px',
          margin: 'auto 0',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <AmaraHologramAvatar
          userName={displayName}
          userRole={userRole}
          statusText={currentUpdate?.text}
          metricBadge={{ label: currentUpdate?.metric || 'EXECUTIVE TELEMETRY', text: currentUpdate?.text || '', color: currentUpdate?.tagColor }}
          isDissolving={isDissolving}
          size={500}
        />

        {/* Proceed to Dashboard Button (Clickable in login mode; also clickable anytime on reload) */}
        <div style={{ marginTop: '22px', position: 'relative', zIndex: 30 }}>
          <button
            type="button"
            onClick={handleProceed}
            style={{
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#ffffff',
              border: '1px solid rgba(254, 215, 170, 0.4)',
              borderRadius: '999px',
              padding: '11px 28px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '9px',
              boxShadow: '0 8px 30px rgba(234, 88, 12, 0.45)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 12px 35px rgba(234, 88, 12, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(234, 88, 12, 0.45)';
            }}
          >
            <span>Continue to Dashboard</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Bottom Subtitle Brand HUD */}
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: '11.5px',
          color: '#64748b',
          position: 'relative',
          zIndex: 20,
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: '#94a3b8' }}>BEMS Group · Executive Telemetry</span>
        </div>

        <div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Enterprise Command Cockpit
          </span>
        </div>
      </div>
    </div>
  );
}
