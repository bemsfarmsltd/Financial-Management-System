'use client';

import React, { useEffect } from 'react';

export interface AgentOption {
  id: 'financial' | 'hr' | 'both' | 'auto';
  tag: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgLight: string;
}

interface AgentMentionMenuProps {
  prefix: '@' | '/';
  filterText: string;
  selectedIndex: number;
  onSelect: (option: AgentOption) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

export function AgentMentionMenu({
  prefix,
  filterText,
  selectedIndex,
  onSelect,
  onClose,
  style,
}: AgentMentionMenuProps) {
  const options: AgentOption[] = [
    {
      id: 'both',
      tag: `${prefix}both`,
      label: 'Dual-Agent Co-Pilot (Both)',
      description: 'Call Financial & HR agents in parallel for unified cross-domain synthesis',
      icon: '✦',
      color: '#7c3aed',
      bgLight: '#f5f3ff',
    },
    {
      id: 'financial',
      tag: `${prefix}finance`,
      label: 'Financial & Treasury Manager',
      description: 'Budgets, requisitions, payroll batches, bank accounts & disbursements',
      icon: '⚡',
      color: '#ea580c',
      bgLight: '#fff7ed',
    },
    {
      id: 'hr',
      tag: `${prefix}hr`,
      label: 'HR & Workforce Operations',
      description: 'Attendance clock-in, lateness, leave, rosters & staff dossiers',
      icon: '👥',
      color: '#059669',
      bgLight: '#ecfdf5',
    },
    {
      id: 'auto',
      tag: `${prefix}auto`,
      label: 'Auto-Detect Agent',
      description: 'Intelligently route your query to the best suited domain agent',
      icon: '✦',
      color: '#6366f1',
      bgLight: '#eef2ff',
    },
  ];

  const filtered = options.filter((opt) => {
    if (!filterText) return true;
    const clean = filterText.toLowerCase();
    return (
      opt.tag.toLowerCase().includes(clean) ||
      opt.id.toLowerCase().includes(clean) ||
      opt.label.toLowerCase().includes(clean)
    );
  });

  if (filtered.length === 0) return null;

  return (
    <div
      className="agent-mention-dropdown"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 0,
        zIndex: 99999,
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '14px',
        boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.16), 0 8px 12px -6px rgba(15, 23, 42, 0.08)',
        padding: '8px',
        minWidth: '320px',
        maxWidth: '380px',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: '6px 8px 4px 8px',
          fontSize: '10.5px',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '4px',
        }}
      >
        <span>Select Agent ({prefix})</span>
        <span style={{ fontSize: '9.5px', fontWeight: 500, color: '#94a3b8' }}>↑↓ Navigate · ↵ Select</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {filtered.map((opt, idx) => {
          const isSelected = idx === selectedIndex % filtered.length;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 10px',
                borderRadius: '8px',
                border: 'none',
                background: isSelected ? opt.bgLight : 'transparent',
                outline: isSelected ? `1.5px solid ${opt.color}40` : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.12s ease',
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: opt.bgLight,
                  border: `1px solid ${opt.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                {opt.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 750,
                      color: isSelected ? opt.color : '#0f172a',
                    }}
                  >
                    {opt.tag}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    {opt.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '1px',
                  }}
                >
                  {opt.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

