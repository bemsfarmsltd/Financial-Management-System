'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Props {
  isActive?: boolean;
  isProcessing?: boolean;
  lastActivityTime?: number;
  brandColor?: string;
}

export const AI_INACTIVITY_LIMIT_MS = 5 * 1000; // 5 seconds of inactivity

function hexToRgba(hex: string | undefined, alpha: number): string {
  if (!hex) return `rgba(13, 138, 112, ${alpha})`;
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) {
    return `rgba(13, 138, 112, ${alpha})`;
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return `rgba(13, 138, 112, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Utility to notify the screen edge glow that an AI interaction occurred
 */
export function notifyAiInteraction() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bems-ai-interaction', { detail: { timestamp: Date.now() } }));
  }
}

export function AiScreenEdgeGlow({ isActive = true, isProcessing = false, lastActivityTime, brandColor }: Props) {
  const [lastActive, setLastActive] = useState<number>(() => Date.now());
  const [isGlowing, setIsGlowing] = useState<boolean>(true);

  const activeColor = brandColor || '#0d8a70';
  const c1 = hexToRgba(activeColor, isProcessing ? 0.45 : 0.28);
  const c2 = hexToRgba(activeColor, isProcessing ? 0.22 : 0.12);
  const borderCol = hexToRgba(activeColor, isProcessing ? 0.55 : 0.32);
  const shadowLow = hexToRgba(activeColor, 0.25);
  const shadowMid = hexToRgba(activeColor, 0.50);
  const shadowHigh = hexToRgba(activeColor, 0.75);

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

  // Check 5-second inactivity countdown
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

    const interval = setInterval(checkTimer, 250);
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
          ? `inset 0 0 36px 4px ${c1}, inset 0 0 80px 10px ${c2}, inset 0 0 120px 16px rgba(255, 255, 255, 0.14)`
          : `inset 0 0 22px 2px ${c1}, inset 0 0 55px 6px ${c2}, inset 0 0 90px 10px rgba(255, 255, 255, 0.06)`,
        animation: isGlowing
          ? (isProcessing ? 'edgeGlowPulse 1.8s infinite ease-in-out' : 'edgeGlowBreathe 4.5s infinite ease-in-out')
          : 'none',
        transition: 'opacity 0.4s ease, box-shadow 0.4s ease',
      }}
    >
      {/* Specular border shimmer line along the very edge */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1.5px solid ${borderCol}`,
          transition: 'border 0.4s ease',
        }}
      />

      <style jsx>{`
        @keyframes edgeGlowBreathe {
          0%, 100% {
            filter: drop-shadow(0 0 4px ${shadowLow});
          }
          50% {
            filter: drop-shadow(0 0 10px ${shadowMid});
          }
        }
        @keyframes edgeGlowPulse {
          0%, 100% {
            filter: drop-shadow(0 0 6px ${shadowMid});
          }
          50% {
            filter: drop-shadow(0 0 16px ${shadowHigh});
          }
        }
      `}</style>
    </div>
  );
}
