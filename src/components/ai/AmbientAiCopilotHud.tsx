'use client';

import React, { useState } from 'react';
import { KineticAiOrb } from './KineticAiOrb';
import { useAmbientTelemetry, TelemetryItem } from './useAmbientTelemetry';

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

  const getSeverityGlow = () => {
    switch (telemetry.severity) {
      case 'warning':
        return 'rgba(239, 68, 68, 0.35)';
      case 'highlight':
        return 'rgba(249, 115, 22, 0.35)';
      case 'success':
        return 'rgba(16, 185, 129, 0.35)';
      default:
        return 'rgba(99, 102, 241, 0.25)';
    }
  };

  const getSeverityBadgeColor = () => {
    switch (telemetry.severity) {
      case 'warning':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' };
      case 'highlight':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#fdba74', border: 'rgba(249, 115, 22, 0.3)' };
      case 'success':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' };
      default:
        return { bg: 'rgba(99, 102, 241, 0.15)', text: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)' };
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
          background: 'rgba(11, 18, 32, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(249, 115, 22, 0.35)',
          borderRadius: '9999px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(249, 115, 22, 0.2)',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={() => setIsMinimized(false)}
        title="Expand BEMS AI Copilot HUD"
      >
        <KineticAiOrb size="compact" isTyping={false} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#f97316', letterSpacing: '0.06em' }}>
            AI COPILOT ACTIVE
          </span>
          <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 500 }}>
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
              background: '#f97316',
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
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(11, 18, 32, 0.92) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${badgeColors.border}`,
        borderRadius: '16px',
        boxShadow: `0 14px 40px rgba(0, 0, 0, 0.45), 0 0 24px ${getSeverityGlow()}`,
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
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
                background: '#f97316',
                border: '2px solid #0f172a',
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
                  background: badgeColors.text,
                  display: 'inline-block',
                }}
              />
              {telemetry.badge}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
              · {currentPage}
            </span>
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#e2e8f0',
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
            color: '#cbd5e1',
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
                background: '#f97316',
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
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.22), rgba(234, 88, 12, 0.15))',
              border: '1px solid rgba(249, 115, 22, 0.45)',
              color: '#fed7aa',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.35), rgba(234, 88, 12, 0.25))';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.22), rgba(234, 88, 12, 0.15))';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
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
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
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
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              fontSize: '9.5px',
              fontWeight: 700,
              color: '#e2e8f0',
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
            color: '#64748b',
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
