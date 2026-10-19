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
    <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Sparkles size={11} color="#ea580c" />
        <span>Executive Quick Commands</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {defaultPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(p.prompt)}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '5px 12px',
              color: '#334155',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fff7ed';
              e.currentTarget.style.borderColor = '#fdba74';
              e.currentTarget.style.color = '#c2410c';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.color = '#334155';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>{p.label}</span>
            <ArrowUpRight size={10} color="#ea580c" />
          </button>
        ))}
      </div>
    </div>
  );
}
