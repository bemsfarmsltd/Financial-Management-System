'use client';

import React from 'react';
import { ShieldCheck, Building2, LayoutDashboard, Lock } from 'lucide-react';

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
        background: 'rgba(255, 255, 255, 0.03)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        color: '#94a3b8',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <strong style={{ color: '#f1f5f9' }}>{role}</strong>
        </div>
        <span style={{ color: '#475569' }}>·</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Building2 size={12} color="#f97316" />
          <span style={{ color: '#cbd5e1' }}>{businessName}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#64748b' }}>Active Context:</span>
        <span
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#e2e8f0',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 700,
          }}
        >
          {currentPage}
        </span>
      </div>
    </div>
  );
}
