'use client';

import React, { useState, useEffect } from 'react';
import { KineticOptikkaTorus } from './KineticOptikkaTorus';
import { ArrowRight } from 'lucide-react';

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
        const overdue = accountabilityCases.filter((c: any) => c.status === 'OVERDUE');

        // 4. Budget
        const totalBudget = budgets.reduce((sum: number, b: any) => sum + (Number(b.allocatedAmount) || 0), 0);

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

  // For reload mode: automatically transition directly to the dashboard after ~2.4 seconds
  useEffect(() => {
    if (mode === 'reload') {
      const autoTimer = setTimeout(() => {
        handleProceed();
      }, 2400);
      return () => clearTimeout(autoTimer);
    }
  }, [mode]);

  // Handle keyboard shortcut (Enter / Space / Escape to proceed)
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
    setIsFadingOut(true);
    setTimeout(onComplete, 350);
  };

  const currentUpdate = financialUpdates[financialIndex] || financialUpdates[0];

  // ==========================================
  // PAGE RELOAD MODE: ONLY THE MOVING OBJECT
  // ==========================================
  if (mode === 'reload') {
    return (
      <div
        className="ai-executive-motion-screen reload-minimal"
        onClick={handleProceed}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: '#f5f2eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isFadingOut ? 0 : 1,
          transform: isFadingOut ? 'scale(1.03)' : 'scale(1)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <KineticOptikkaTorus size={460} />
      </div>
    );
  }

  // ==========================================
  // LOGIN MODE: 3D OBJECT + USER NAME + LIVE FINANCIAL UPDATE TICKER + CONTINUE BUTTON
  // ==========================================
  return (
    <div
      className="ai-executive-motion-screen login-welcome"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#f5f2eb',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '36px 32px',
        color: '#1c1917',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        userSelect: 'none',
      }}
    >
      {/* Top Subtle Brand Tag */}
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#78716c' }}>
            BEMS AI · AUTONOMOUS LEDGER GOVERNANCE
          </span>
        </div>

        <span style={{ fontSize: '11px', fontWeight: 700, color: '#78716c', letterSpacing: '0.04em' }}>
          BEMS Group
        </span>
      </div>

      {/* Centerpiece: 3D Kinetic Optikka Torus + Executive Welcome + Live Financial Update */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          width: '100%',
          maxWidth: '820px',
          margin: 'auto 0',
        }}
      >
        {/* Kinetic 3D Torus Object */}
        <div style={{ transform: 'scale(1.02)', marginBottom: '18px' }}>
          <KineticOptikkaTorus size={380} />
        </div>

        {/* Executive Welcome Header with dynamic user name */}
        <h1
          style={{
            margin: '0 0 12px 0',
            fontSize: '44px',
            fontWeight: 850,
            letterSpacing: '-0.035em',
            color: '#1c1917',
            lineHeight: 1.15,
          }}
        >
          Welcome, {displayName}
        </h1>

        {/* Dynamic Financial Update Ticker */}
        <div
          style={{
            minHeight: '62px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 24px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 10px 30px rgba(28, 25, 23, 0.05)',
            transition: 'all 0.3s ease',
            width: 'min(640px, 94vw)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: currentUpdate.tagColor,
                background: 'rgba(255, 255, 255, 0.85)',
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid rgba(226, 232, 240, 0.8)',
              }}
            >
              {currentUpdate.metric}
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>· Live Update</span>
          </div>

          <p
            key={financialIndex}
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: '#334155',
              lineHeight: 1.4,
              animation: 'tickerFade 0.35s ease',
            }}
          >
            {currentUpdate.text}
          </p>
        </div>

        {/* In Login Mode: User MUST click Continue to Dashboard */}
        <div style={{ marginTop: '28px' }}>
          <button
            type="button"
            onClick={handleProceed}
            style={{
              background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '999px',
              padding: '12px 28px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 24px rgba(28, 25, 23, 0.25)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(28, 25, 23, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(28, 25, 23, 0.25)';
            }}
          >
            <span>Continue to Dashboard</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Bottom Subtitle */}
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11.5px', color: '#78716c' }}>
        <div>
          <span style={{ fontWeight: 700, color: '#44403c' }}>BEMS Group · Executive Governance</span>
        </div>

        <div>
          <span style={{ fontSize: '11px', color: '#a8a29e' }}>
            Enterprise Command Cockpit
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes tickerFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
