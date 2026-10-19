'use client';

import React, { useState } from 'react';
import { KineticAiOrb } from './KineticAiOrb';
import { useAmbientTelemetry } from './useAmbientTelemetry';

interface Props {
  currentPage: string;
  businessName: string;
  onOpenDrawer: (initialPrompt?: string) => void;
  pendingCount?: number;
}

export function AmbientAiCopilotHud({
  currentPage,
  businessName,
  onOpenDrawer,
  pendingCount = 1,
}: Props) {
  const [isMinimized, setIsMinimized] = useState(false);
  const { telemetry, displayText, isTyping } = useAmbientTelemetry({
    currentPage,
    businessName,
  });

  const getSeverityBadgeColor = () => {
    switch (telemetry.severity) {
      case 'warning':
        return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' };
      case 'highlight':
        return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' };
      case 'success':
        return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', dot: '#10b981' };
      default:
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' };
    }
  };

  const badgeColors = getSeverityBadgeColor();

  if (isMinimized) {
    return (
      <div
        className="ambient-ai-hud-minimized"
        style={{
          position: 'fixed',
          top: '16px',
          right: '84px',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 14px 6px 8px',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderRadius: '9999px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={() => setIsMinimized(false)}
        title="Expand BEMS AI Copilot HUD"
      >
        <KineticAiOrb size="compact" isTyping={false} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#ea580c', letterSpacing: '0.06em' }}>
            AI COPILOT ACTIVE
          </span>
          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
            {currentPage} Monitor
          </span>
        </div>
        {pendingCount > 0 && (
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '999px',
              fontSize: '10px',
              fontWeight: 800,
              background: '#ea580c',
              color: '#ffffff',
            }}
          >
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="ambient-ai-hud-container"
      style={{
        position: 'sticky',
        top: '8px',
        zIndex: 850,
        margin: '0 auto 14px auto',
        maxWidth: '1180px',
        width: 'calc(100% - 32px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        padding: '8px 16px 8px 12px',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.92) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: '16px',
        boxShadow: '0 12px 36px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03)',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        userSelect: 'none',
      }}
    >
      {/* LEFT: Kinetic 3D Optikka Orb & Context Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          cursor: 'pointer',
        }}
        onClick={() => onOpenDrawer(telemetry.actionPrompt)}
        title="Open BEMS AI Financial Manager (Cmd + J)"
      >
        <div style={{ position: 'relative' }}>
          <KineticAiOrb size="hud" isTyping={isTyping} />
          {pendingCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ea580c',
                border: '2px solid #ffffff',
                animation: 'pulse 2s infinite',
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '9.5px',
                fontWeight: 800,
                letterSpacing: '0.07em',
                background: badgeColors.bg,
                color: badgeColors.text,
                border: `1px solid ${badgeColors.border}`,
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: badgeColors.dot,
                  display: 'inline-block',
                }}
              />
              {telemetry.badge}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
              · {currentPage}
            </span>
          </div>

          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.01em',
            }}
          >
            BEMS AI Group Financial Manager
          </span>
        </div>
      </div>

      {/* CENTER: Real-Time Typewriter Live Stream */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: '0 8px',
          cursor: 'pointer',
        }}
        onClick={() => onOpenDrawer(telemetry.actionPrompt)}
      >
        <p
          style={{
            margin: 0,
            fontSize: '12.5px',
            lineHeight: 1.45,
            color: '#1e293b',
            fontWeight: 500,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {displayText}
          {isTyping && (
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '13px',
                marginLeft: '4px',
                background: '#ea580c',
                borderRadius: '1px',
                verticalAlign: 'middle',
                animation: 'blink 0.8s infinite',
              }}
            />
          )}
        </p>
      </div>

      {/* RIGHT: Contextual Action Chip & Launcher Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {telemetry.actionLabel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrawer(telemetry.actionPrompt);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 13px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
              border: '1px solid #fed7aa',
              color: '#c2410c',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(234, 88, 12, 0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(234, 88, 12, 0.08)';
            }}
          >
            <span>⚡</span>
            {telemetry.actionLabel}
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenDrawer()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#475569',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Open Full Copilot Cockpit (Cmd + J)"
        >
          <kbd
            style={{
              padding: '1px 5px',
              borderRadius: '4px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              fontSize: '9.5px',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            ⌘J
          </kbd>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '14px',
            cursor: 'pointer',
          }}
          title="Minimize HUD to top pill"
        >
          −
        </button>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
