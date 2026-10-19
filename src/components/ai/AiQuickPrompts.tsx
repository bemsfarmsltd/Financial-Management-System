'use client';

import React from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';

interface Props {
  currentPage: string;
  onSelectPrompt: (promptText: string) => void;
}

export function AiQuickPrompts({ currentPage, onSelectPrompt }: Props) {
  const defaultPrompts = [
    { label: 'Executive Daily Brief', prompt: 'Good morning, what needs my financial attention today?' },
    { label: 'Review REQ-2026-0004', prompt: 'Review and decide on REQ-2026-0004 (Microsoft Cloud Licenses)' },
    { label: 'Simulate Cash Runway', prompt: 'Run a what-if scenario on our liquid reserves and monthly burn rate' },
    { label: 'Draft Q1 Tech Budget', prompt: 'Draft a ₦25 million Q1 2027 operational budget for BemsSoft Hub Ltd' },
    { label: 'Audit Accountability', prompt: 'Check all open accountability cases and highlight overdue receipts' },
    { label: 'Adjust Staff Salary', prompt: 'Prepare a proposed salary adjustment for Engr. Tunde Adeleke' },
  ];

  return (
    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Sparkles size={11} color="#f97316" />
        <span>Executive Quick Commands</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {defaultPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(p.prompt)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '4px 10px',
              color: '#e2e8f0',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(249, 115, 22, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.4)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#e2e8f0';
            }}
          >
            <span>{p.label}</span>
            <ArrowUpRight size={10} color="#94a3b8" />
          </button>
        ))}
      </div>
    </div>
  );
}
