'use client';

import React from 'react';
import { ChevronRight, Sparkles, Zap, Users, Compass } from 'lucide-react';

export interface AgentOption {
  id: 'both' | 'financial' | 'hr' | 'auto';
  tag: string;
  label: string;
  description: string;
  icon: React.ReactNode;
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
      id: 'financial',
      tag: `${prefix}finance`,
      label: 'Financial Manager',
      description: 'Budgets, requisitions, payroll, bank accounts & disbursements',
      icon: <Zap size={16} color="#ea580c" />,
      color: '#ea580c',
      bgLight: '#fff7ed',
    },
    {
      id: 'hr',
      tag: `${prefix}hr`,
      label: 'HR & Workforce Operations',
      description: 'Attendance clock-in, lateness, leave, rosters & staff dossiers',
      icon: <Users size={16} color="#059669" />,
      color: '#059669',
      bgLight: '#ecfdf5',
    },
    {
      id: 'both',
      tag: `${prefix}both`,
      label: 'Dual-Agent Co-Pilot (Both)',
      description: 'Run Financial & HR agents in parallel for unified co-synthesis',
      icon: <Sparkles size={16} color="#7c3aed" />,
      color: '#7c3aed',
      bgLight: '#f5f3ff',
    },
    {
      id: 'auto',
      tag: `${prefix}auto`,
      label: 'Auto-Detect Agent',
      description: 'Intelligently route your prompt based on question context',
      icon: <Compass size={16} color="#2563eb" />,
      color: '#2563eb',
      bgLight: '#eff6ff',
    },
  ];

  const filtered = options.filter((opt) => {
    if (!filterText) return true;
    const clean = filterText.toLowerCase();
    return (
      opt.tag.toLowerCase().includes(clean) ||
      opt.id.toLowerCase().includes(clean) ||
      opt.label.toLowerCase().includes(clean) ||
      opt.description.toLowerCase().includes(clean)
    );
  });

  if (filtered.length === 0) return null;

  return (
    <div
      className="agent-mention-dropdown chatgpt-style-menu"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 10px)',
        left: 0,
        zIndex: 99999,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -8px rgba(15, 23, 42, 0.16), 0 8px 16px -4px rgba(15, 23, 42, 0.08)',
        padding: '6px',
        width: 'min(460px, 94vw)',
        maxWidth: '480px',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'chatGptMenuAppear 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes chatGptMenuAppear {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {/* Header bar matching ChatGPT */}
      <div
        style={{
          padding: '6px 12px 6px 10px',
          fontSize: '11px',
          fontWeight: 750,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '4px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Agents & Modes ({prefix})</span>
        </span>
        <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8' }}>
          ↑↓ Navigate · ↵ Select · Esc Dismiss
        </span>
      </div>

      {/* Agent items list */}
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
                gap: '12px',
                padding: '9px 12px',
                borderRadius: '11px',
                border: isSelected ? `1px solid ${opt.color}35` : '1px solid transparent',
                background: isSelected ? opt.bgLight : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={() => {
                // Allows mouse hover feel natural
              }}
            >
              {/* Icon Container */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9px',
                  background: opt.bgLight,
                  border: `1px solid ${opt.color}25`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {opt.icon}
              </div>

              {/* Title & Description inline/stacked like ChatGPT */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 750,
                      color: isSelected ? opt.color : '#0f172a',
                    }}
                  >
                    {opt.label}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      color: isSelected ? opt.color : '#94a3b8',
                      background: isSelected ? '#ffffff' : '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: '5px',
                    }}
                  >
                    {opt.tag}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '11.5px',
                    color: '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px',
                  }}
                >
                  {opt.description}
                </div>
              </div>

              {/* Chevron icon right */}
              <div
                style={{
                  color: isSelected ? opt.color : '#cbd5e1',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'transform 0.12s ease, color 0.12s ease',
                  transform: isSelected ? 'translateX(2px)' : 'none',
                }}
              >
                <ChevronRight size={15} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
