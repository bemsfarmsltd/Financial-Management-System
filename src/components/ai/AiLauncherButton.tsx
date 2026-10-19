'use client';

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface HeaderLauncherProps {
  onClick: () => void;
  pendingCount?: number;
}

export function AiHeaderLauncher({ onClick, pendingCount = 1 }: HeaderLauncherProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Open AI Group Financial Manager (Cmd + J)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15) 0%, rgba(249, 115, 22, 0.25) 100%)',
        border: '1px solid rgba(249, 115, 22, 0.5)',
        borderRadius: '20px',
        padding: '6px 12px',
        color: '#ffffff',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 750,
        boxShadow: '0 0 12px rgba(249, 115, 22, 0.25)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 0 18px rgba(249, 115, 22, 0.45)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 0 12px rgba(249, 115, 22, 0.25)';
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Bot size={12} color="#ffffff" />
      </div>

      <span style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}>AI Financial Manager</span>

      {pendingCount > 0 && (
        <span
          style={{
            background: '#ef4444',
            color: '#ffffff',
            borderRadius: '10px',
            padding: '1px 6px',
            fontSize: '10px',
            fontWeight: 800,
          }}
        >
          {pendingCount}
        </span>
      )}
    </button>
  );
}

interface FloatingLauncherProps {
  onClick: () => void;
  pendingCount?: number;
}

export function AiFloatingLauncher({ onClick, pendingCount = 1 }: FloatingLauncherProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9000,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        title="Open BEMS AI Group Financial Manager (Cmd + J)"
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '2px solid #f97316',
          boxShadow: '0 8px 24px rgba(234, 88, 12, 0.4), 0 0 12px rgba(249, 115, 22, 0.25)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          position: 'relative',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 12px 30px rgba(234, 88, 12, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(234, 88, 12, 0.4)';
        }}
      >
        <Bot size={26} color="#f97316" />

        {pendingCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: '10px',
              fontWeight: 800,
              border: '2px solid #0f172a',
            }}
          >
            {pendingCount}
          </span>
        )}
      </button>
    </div>
  );
}
