'use client';

import React from 'react';
import { Building2 } from 'lucide-react';

interface Props {
  role: string;
  userName: string;
  businessName: string;
  currentPage: string;
}

export function AiContextBanner({ role, userName, businessName, currentPage }: Props) {
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.25)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.40)',
        padding: '9px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        color: '#475569',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#059669' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
          <strong style={{ color: '#0f172a', fontWeight: 800 }}>{role}</strong>
        </div>
        <span style={{ color: '#94a3b8' }}>·</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Building2 size={13} color="#ea580c" />
          <span style={{ color: '#334155', fontWeight: 600 }}>{businessName}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#64748b', fontWeight: 500 }}>Active Context:</span>
        <span
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            color: '#0f172a',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '10.5px',
            fontWeight: 700,
            border: '1px solid rgba(255, 255, 255, 0.80)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {currentPage}
        </span>
      </div>
    </div>
  );
}
