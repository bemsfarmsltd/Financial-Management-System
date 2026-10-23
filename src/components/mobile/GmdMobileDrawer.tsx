'use client';

import React from 'react';
import {
  X,
  Landmark,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  FileText,
  Monitor,
  LogOut,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface GmdMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  gmdName: string;
  activeEntityName: string;
  onSelectAction: (prompt: string) => void;
  onOpenDesktopView: () => void;
  onSignOut: () => void;
}

export function GmdMobileDrawer({
  isOpen,
  onClose,
  gmdName,
  activeEntityName,
  onSelectAction,
  onOpenDesktopView,
  onSignOut,
}: GmdMobileDrawerProps) {
  if (!isOpen) return null;

  const menuItems = [
    {
      icon: Landmark,
      label: 'Treasury Reserves',
      prompt: 'What is our total cash balance across bank accounts?',
      color: '#38bdf8',
    },
    {
      icon: CheckCircle2,
      label: 'Pending Approvals Queue',
      prompt: 'Are there any fund requests pending my approval?',
      color: '#ea580c',
    },
    {
      icon: TrendingUp,
      label: '30-Day Cash Runway Forecast',
      prompt: 'Show our 30-day cash obligations and runway forecast in a graph',
      color: '#10b981',
    },
    {
      icon: RotateCcw,
      label: 'Recurring Commitments',
      prompt: 'Explain what recurring expenditure commitments are and show active categories in a graph',
      color: '#a855f7',
    },
    {
      icon: FileText,
      label: 'Executive Daily Briefing',
      prompt: 'Give me the morning executive briefing',
      color: '#f59e0b',
    },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Drawer Content */}
      <div
        style={{
          position: 'relative',
          width: 'min(310px, 84vw)',
          height: '100%',
          background: '#0b1120',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 110,
          animation: 'slideInLeft 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px) 16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.35)',
              }}
            >
              <Sparkles size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                BEMS GMD
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                {gmdName} · Executive AI
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'grid',
              placeItems: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Active Subsidiary Info */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '8px 12px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Active Operating Entity
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>
            {activeEntityName}
          </div>
        </div>

        {/* Fast Action Items */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 6px' }}>
            Executive Cockpit Commands
          </div>

          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectAction(item.prompt);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '11px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  color: '#e2e8f0',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    background: `${item.color}15`,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon size={15} color={item.color} />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={onOpenDesktopView}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: '#cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Monitor size={15} />
            <span>Switch to Full Desktop View</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
