'use client';

import React from 'react';

interface Props {
  isActive?: boolean;
  isProcessing?: boolean;
}

export function AiScreenEdgeGlow({ isActive = true, isProcessing = false }: Props) {
  if (!isActive) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9990,
        boxShadow: isProcessing
          ? 'inset 0 0 36px 4px rgba(249, 115, 22, 0.45), inset 0 0 80px 10px rgba(234, 88, 12, 0.22), inset 0 0 120px 16px rgba(16, 185, 129, 0.14)'
          : 'inset 0 0 22px 2px rgba(249, 115, 22, 0.28), inset 0 0 55px 6px rgba(249, 115, 22, 0.12), inset 0 0 90px 10px rgba(16, 185, 129, 0.06)',
        animation: isProcessing ? 'edgeGlowPulse 1.8s infinite ease-in-out' : 'edgeGlowBreathe 4.5s infinite ease-in-out',
        transition: 'box-shadow 0.4s ease, opacity 0.4s ease',
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
