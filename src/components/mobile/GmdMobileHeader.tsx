'use client';

import React, { useState } from 'react';
import { Menu, Plus, ChevronDown, Sparkles, Building2, ShieldCheck } from 'lucide-react';

interface Organization {
  id: string;
  legalName: string;
  code?: string;
}

interface GmdMobileHeaderProps {
  organizations: Organization[];
  currentOrgId: string;
  onSelectOrg: (id: string) => void;
  onOpenDrawer: () => void;
  onNewChat: () => void;
  isStreaming?: boolean;
}

export function GmdMobileHeader({
  organizations,
  currentOrgId,
  onSelectOrg,
  onOpenDrawer,
  onNewChat,
  isStreaming = false,
}: GmdMobileHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0] || {
    id: 'hq',
    legalName: 'BEMS Group Holdings Ltd (HQ)',
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(9, 13, 22, 0.88)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 14px 10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#f8fafc',
      }}
    >
      {/* Left: Drawer Menu Icon */}
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open navigation menu"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          display: 'grid',
          placeItems: 'center',
          color: '#cbd5e1',
          cursor: 'pointer',
        }}
      >
        <Menu size={19} />
      </button>

      {/* Center: Entity Selector Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '6px 12px',
            borderRadius: '999px',
            color: '#f8fafc',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            maxWidth: '210px',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '999px',
              background: isStreaming ? '#38bdf8' : '#ea580c',
              boxShadow: isStreaming ? '0 0 8px #38bdf8' : '0 0 8px #ea580c',
            }}
          />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '150px',
            }}
          >
            {currentOrg.legalName}
          </span>
          <ChevronDown size={13} color="#94a3b8" />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <>
            <div
              onClick={() => setDropdownOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60 }}
            />
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '260px',
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '14px',
                padding: '6px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                zIndex: 70,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div
                style={{
                  padding: '6px 10px 4px 10px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Switch Operating Subsidiary
              </div>
              {organizations.map((org) => {
                const isSelected = org.id === currentOrg.id;
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      onSelectOrg(org.id);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 10px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
                      border: isSelected ? '1px solid rgba(234, 88, 12, 0.3)' : '1px solid transparent',
                      color: isSelected ? '#f97316' : '#e2e8f0',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {org.legalName}
                    </span>
                    {isSelected && <ShieldCheck size={13} color="#f97316" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Right: New Chat Button */}
      <button
        type="button"
        onClick={onNewChat}
        aria-label="Start new conversation"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          display: 'grid',
          placeItems: 'center',
          color: '#cbd5e1',
          cursor: 'pointer',
        }}
      >
        <Plus size={19} />
      </button>
    </header>
  );
}
