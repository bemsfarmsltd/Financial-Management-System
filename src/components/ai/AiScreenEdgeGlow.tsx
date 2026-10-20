'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Props {
  isActive?: boolean;
  isProcessing?: boolean;
  lastActivityTime?: number;
}

export const AI_INACTIVITY_LIMIT_MS = 60 * 1000; // 1 minute

/**
 * Utility to notify the screen edge glow that an AI interaction occurred
 */
export function notifyAiInteraction() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bems-ai-interaction', { detail: { timestamp: Date.now() } }));
  }
}

export function AiScreenEdgeGlow({ isActive = true, isProcessing = false, lastActivityTime }: Props) {
  const [lastActive, setLastActive] = useState<number>(() => Date.now());
  const [isGlowing, setIsGlowing] = useState<boolean>(true);

  // If processing (AI thinking or typing), always glow and update lastActive
  useEffect(() => {
    if (isProcessing) {
      setLastActive(Date.now());
      setIsGlowing(true);
    }
  }, [isProcessing]);

  // Update on explicit prop change
  useEffect(() => {
    if (lastActivityTime) {
      setLastActive(lastActivityTime);
      setIsGlowing(true);
    }
  }, [lastActivityTime]);

  // Listen for global AI interaction events across the dashboard
  useEffect(() => {
    const handleInteraction = () => {
      setLastActive(Date.now());
      setIsGlowing(true);
    };

    window.addEventListener('bems-ai-interaction', handleInteraction);
    return () => window.removeEventListener('bems-ai-interaction', handleInteraction);
  }, []);

  // Check 1-minute inactivity countdown
  useEffect(() => {
    if (!isActive) return;

    const checkTimer = () => {
      if (isProcessing) {
        setIsGlowing(true);
        return;
      }
      const elapsed = Date.now() - lastActive;
      if (elapsed >= AI_INACTIVITY_LIMIT_MS) {
        setIsGlowing(false);
      } else {
        setIsGlowing(true);
      }
    };

    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [isActive, isProcessing, lastActive]);

  if (!isActive) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9990,
        opacity: isGlowing ? (isProcessing ? 1 : 0.85) : 0,
        boxShadow: isProcessing
          ? 'inset 0 0 36px 4px rgba(249, 115, 22, 0.45), inset 0 0 80px 10px rgba(234, 88, 12, 0.22), inset 0 0 120px 16px rgba(16, 185, 129, 0.14)'
          : 'inset 0 0 22px 2px rgba(249, 115, 22, 0.28), inset 0 0 55px 6px rgba(249, 115, 22, 0.12), inset 0 0 90px 10px rgba(16, 185, 129, 0.06)',
        animation: isProcessing ? 'edgeGlowPulse 1.8s infinite ease-in-out' : 'edgeGlowBreathe 4.5s infinite ease-in-out',
        transition: 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease',
      }}
    >
      {/* Specular border shimmer line along the very edge */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: isProcessing ? '1.5px solid rgba(249, 115, 22, 0.55)' : '1px solid rgba(249, 115, 22, 0.32)',
          transition: 'border 0.4s ease',
        }}
      />

      <style jsx>{`
        @keyframes edgeGlowBreathe {
          0%, 100% {
            opacity: 0.65;
            filter: drop-shadow(0 0 4px rgba(249, 115, 22, 0.2));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.4));
          }
        }
        @keyframes edgeGlowPulse {
          0%, 100% {
            opacity: 0.8;
            filter: drop-shadow(0 0 6px rgba(249, 115, 22, 0.4));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 14px rgba(249, 115, 22, 0.7));
          }
        }
      `}</style>
    </div>
  );
}
