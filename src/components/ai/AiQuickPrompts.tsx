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
    { label: 'Pending Approvals Check', prompt: 'Check all pending fund requests and approval queues' },
    { label: 'Simulate Cash Runway', prompt: 'Run a what-if scenario on our liquid reserves and monthly burn rate' },
    { label: 'Simulate Operational Budget', prompt: 'Draft a proposed operational budget for group subsidiaries' },
    { label: 'Audit Accountability', prompt: 'Check all open accountability cases and highlight overdue receipts' },
    { label: 'Audit Staff Compensation', prompt: 'Review group staff compensation and dual-entity allocation' },
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
              background: 'rgba(255, 255, 255, 0.50)',
              border: '1px solid rgba(255, 255, 255, 0.70)',
              borderRadius: '20px',
              padding: '5px 12px',
              color: '#1e293b',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 247, 237, 0.85)';
              e.currentTarget.style.borderColor = '#fdba74';
              e.currentTarget.style.color = '#c2410c';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.50)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.70)';
              e.currentTarget.style.color = '#1e293b';
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
