'use client';

import React, { useState, useEffect } from 'react';
import { KineticOptikkaTorus } from './KineticOptikkaTorus';
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
  userName = 'Dr. Pastra',
  userRole = 'GMD',
  mode = 'reload',
}: Props) {
  const [financialIndex, setFinancialIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // When user is GMD, use "Dr. Pastra" as specifically requested
  const isGmd = userRole === 'GMD' || !userName || userName.toLowerCase().includes('pastra') || userName.toLowerCase().includes('bems') || userName.toLowerCase().includes('henry');
  const displayName = isGmd ? 'Dr. Pastra' : userName;

  const financialUpdates = [
    {
      metric: 'GROUP LIQUIDITY',
      text: 'Consolidated group liquidity stands at ₦84.2M across 3 subsidiaries',
      tag: 'HEALTHY',
      tagColor: '#059669',
    },
    {
      metric: 'EXECUTIVE APPROVAL QUEUE',
      text: '1 pending requisition requires GMD signature (₦650,000 · BemsSoft Hub Ltd)',
      tag: 'ACTION REQUIRED',
      tagColor: '#ea580c',
    },
    {
      metric: 'CASH RUNWAY FORECAST',
      text: 'Liquid cash runway confirmed at 11.4 months at current monthly burn rate',
      tag: 'OPTIMAL',
      tagColor: '#0284c7',
    },
    {
      metric: 'AUDIT & COMPLIANCE',
      text: 'Accountability verification is 100% compliant with zero overdue retirements',
      tag: 'VERIFIED',
      tagColor: '#059669',
    },
    {
      metric: 'CAPITAL COMMITMENTS',
      text: 'Q4 operational commitments allocated with 34% remaining budget headroom',
      tag: 'CONTROLLED',
      tagColor: '#7c3aed',
    },
  ];

  // Cycle through real-time financial updates
  useEffect(() => {
    const timer = setInterval(() => {
      setFinancialIndex((prev) => (prev + 1) % financialUpdates.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [financialUpdates.length]);

  // For reload mode: automatically transition to the dashboard after ~2.4 seconds
  useEffect(() => {
    if (mode === 'reload') {
      const autoTimer = setTimeout(() => {
        handleProceed();
      }, 2500);
      return () => clearTimeout(autoTimer);
    }
  }, [mode]);

  // Handle keyboard shortcut (Enter / Space / Escape to continue)
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

  const currentUpdate = financialUpdates[financialIndex];

  return (
    <div
      className="ai-executive-motion-screen"
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

        <span style={{ fontSize: '11px', fontWeight: 600, color: '#a8a29e' }}>
          {businessName}
        </span>
      </div>

      {/* Centerpiece: Enormous 3D Kinetic Optikka Torus + Executive Welcome + Live Financial Update */}
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
        {/* Large Kinetic 3D Torus Object */}
        <div style={{ transform: 'scale(1.05)', marginBottom: '18px' }}>
          <KineticOptikkaTorus size={400} />
        </div>

        {/* Executive Welcome Header */}
        <h1
          style={{
            margin: '0 0 12px 0',
            fontSize: '46px',
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

        {/* In Login Mode: Prominent Continue Button */}
        {mode === 'login' ? (
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
        ) : (
          <div style={{ marginTop: '20px' }}>
            <span style={{ fontSize: '11px', color: '#a8a29e', fontWeight: 500 }}>
              Entering cockpit... click anywhere or press Enter to skip
            </span>
          </div>
        )}
      </div>

      {/* Bottom Subtitle & URL */}
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11.5px', color: '#78716c' }}>
        <div>
          <span style={{ fontWeight: 700, color: '#44403c' }}>Executive Governance, Redefined.</span>
        </div>

        <div>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a8a29e' }}>
            bemsfarms.com
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
