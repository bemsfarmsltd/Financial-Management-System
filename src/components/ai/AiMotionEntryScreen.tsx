'use client';

import React, { useState, useEffect } from 'react';
import { KineticOptikkaTorus } from './KineticOptikkaTorus';
import { ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  onComplete: () => void;
  businessName?: string;
  userName?: string;
}

export function AiMotionEntryScreen({ onComplete, businessName = 'BEMS Group', userName = 'Bems' }: Props) {
  const [progress, setProgress] = useState(12);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const steps = [
    { title: 'Initializing Autonomous Ledger Monitor', detail: 'Connecting to multi-level audit ledger' },
    { title: `Auditing ${businessName} Portfolios`, detail: 'Validating capital commitments & approval limits' },
    { title: 'Calibrating Liquidity & Runway Metrics', detail: '₦84.2M liquid reserves synchronized across subsidiaries' },
    { title: `Welcome back, ${userName.split(' ')[0]}`, detail: 'Executive Copilot Autonomous and Active' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + 18;
        if (next > 75) setStepIndex(3);
        else if (next > 50) setStepIndex(2);
        else if (next > 25) setStepIndex(1);
        return Math.min(next, 100);
      });
    }, 380);

    return () => clearInterval(interval);
  }, []);

  // When progress reaches 100, trigger smooth fade-out and complete
  useEffect(() => {
    if (progress >= 100) {
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(onComplete, 400);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(onComplete, 200);
  };

  return (
    <div
      className="ai-motion-entry-screen"
      onClick={handleSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#f4f0ea',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 48px',
        color: '#1c1917',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Top Header Tagline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#78716c' }}>
            Financial Precision · Powered by BEMS AI
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          style={{
            background: 'rgba(28, 25, 23, 0.05)',
            border: '1px solid rgba(28, 25, 23, 0.10)',
            borderRadius: '999px',
            padding: '6px 14px',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#44403c',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Enter Cockpit</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Center 3D Kinetic Geometry & Hero Title */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', margin: 'auto 0' }}>
        <KineticOptikkaTorus size={280} />

        <div style={{ marginTop: '20px' }}>
          <h1
            style={{
              margin: '0 0 6px 0',
              fontSize: '44px',
              fontWeight: 850,
              letterSpacing: '-0.035em',
              color: '#1c1917',
              lineHeight: 1.1,
            }}
          >
            Meet BEMS AI
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '14.5px',
              color: '#57534e',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            Group Financial Manager · Autonomous Requisition & Ledger Governance
          </p>
        </div>

        {/* Live Calibration Telemetry & Progress */}
        <div
          style={{
            marginTop: '28px',
            width: 'min(440px, 90vw)',
            background: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.85)',
            borderRadius: '16px',
            padding: '12px 18px',
            boxShadow: '0 8px 24px rgba(28, 25, 23, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}>
              <Sparkles size={13} color="#ea580c" />
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1c1917' }}>
                {steps[stepIndex].title}
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ea580c' }}>
              {progress}%
            </span>
          </div>

          {/* Slim Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '3.5px',
              borderRadius: '999px',
              background: '#e7e5e4',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #ea580c 0%, #f97316 100%)',
                borderRadius: '999px',
                transition: 'width 0.35s ease-out',
              }}
            />
          </div>

          <span style={{ display: 'block', fontSize: '10.5px', color: '#78716c', marginTop: '6px', textAlign: 'left' }}>
            {steps[stepIndex].detail}
          </span>
        </div>
      </div>

      {/* Bottom Footer: Left Subtitle, Right URL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '12px', color: '#78716c' }}>
        <div>
          <strong style={{ display: 'block', color: '#1c1917', fontWeight: 800, letterSpacing: '-0.01em' }}>
            Executive Governance, Redefined.
          </strong>
          <span style={{ fontSize: '11px' }}>Autonomous oversight for multi-entity enterprises</span>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#a8a29e' }}>
            bemsfarms.com
          </span>
        </div>
      </div>
    </div>
  );
}
