'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { ApprovalsDeskView } from './ApprovalsDeskView';
import { DisbursementsDeskView } from './DisbursementsDeskView';
import { ApprovalMatrixView } from './ApprovalMatrixView';
import { EmergencyOverridesView } from './EmergencyOverridesView';

export type WorkspaceTab = 'approvals' | 'vendors' | 'settlements' | 'governance';
export type GovernanceSubTab = 'matrix' | 'emergency';

export function FundFlowWorkspace({
  businessName,
  userName,
  scope,
  businessId,
  businessCode,
  onNavigate,
  onSelectBusiness,
}: {
  businessName: string;
  userName: string;
  scope?: string;
  businessId?: string;
  businessCode?: string;
  onNavigate: (page: string) => void;
  onSelectBusiness: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('approvals');
  const [governanceTab, setGovernanceTab] = useState<GovernanceSubTab>('matrix');
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [readyCount, setReadyCount] = useState<number | null>(null);
  const [confirmationCount, setConfirmationCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const activeScope = scope || 'ALL';

  const refreshCounts = useCallback(async () => {
    setRefreshing(true);
    try {
      const [approvalsResponse, paymentsResponse] = await Promise.all([
        fetch(`/api/approvals?subsidiary=${encodeURIComponent(activeScope)}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`/api/disbursements?subsidiary=${encodeURIComponent(activeScope)}`, { credentials: 'include', cache: 'no-store' }),
      ]);
      if (approvalsResponse.ok) {
        const approvals = await approvalsResponse.json();
        setReviewCount(Number(approvals.summary?.totalPendingCount ?? 0));
      } else {
        setReviewCount((prev) => (prev !== null ? prev : 0));
      }
      if (paymentsResponse.ok) {
        const payments = await paymentsResponse.json();
        setReadyCount(Array.isArray(payments.readyForTransfer) ? payments.readyForTransfer.length : 0);
        setConfirmationCount(Number(payments.summary?.awaitingCount ?? 0));
      } else {
        setReadyCount((prev) => (prev !== null ? prev : 0));
        setConfirmationCount((prev) => (prev !== null ? prev : 0));
      }
    } catch {
      setReviewCount((prev) => (prev !== null ? prev : 0));
      setReadyCount((prev) => (prev !== null ? prev : 0));
      setConfirmationCount((prev) => (prev !== null ? prev : 0));
    } finally {
      setRefreshing(false);
    }
  }, [activeScope]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  const navPill = (
    tab: WorkspaceTab,
    label: string,
    badgeCount: number | null,
    icon: React.ReactNode,
    badgeTone: 'orange' | 'blue' | 'emerald' | 'slate' = 'slate'
  ) => {
    const isSelected = activeTab === tab;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={() => setActiveTab(tab)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          fontSize: 12.5,
          fontWeight: isSelected ? 700 : 600,
          borderRadius: 8,
          border: isSelected ? '1px solid #ea580c' : '1px solid #e2e8f0',
          background: isSelected ? '#ea580c' : '#ffffff',
          color: isSelected ? '#ffffff' : '#475569',
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out',
          boxShadow: isSelected ? '0 1px 3px rgba(234, 88, 12, 0.25)' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', color: isSelected ? '#ffffff' : '#64748b' }}>
          {icon}
        </span>
        <span>{label}</span>
        {badgeCount !== null && badgeCount > 0 && (
          <span
            style={{
              padding: '1px 7px',
              borderRadius: 9999,
              fontSize: 10.5,
              fontWeight: 800,
              background: isSelected ? 'rgba(255, 255, 255, 0.28)' : '#f1f5f9',
              color: isSelected ? '#ffffff' : '#0f172a',
              border: isSelected ? 'none' : '1px solid #cbd5e1',
            }}
          >
            {badgeCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <main style={{ display: 'grid', gap: 14, width: '100%', background: '#f8fafc', minHeight: '100vh', padding: '0 0 32px' }}>
      {/* HEADER WITH UNIFIED NAV PILLS */}
      <header
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#ea580c', fontSize: 10, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                Fund Lifecycle
              </span>
              <span style={{ color: '#94a3b8', fontSize: 10 }}>·</span>
              <span style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px' }}>
                {businessName}
              </span>
            </div>
            <h1 style={{ color: '#0f172a', fontSize: 22, fontWeight: 800, margin: '4px 0 2px', letterSpacing: '-0.3px' }}>
              Approvals &amp; Disbursements
            </h1>
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
              Direct GMD authorization, staff wallet funding, and corporate vendor settlement ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshCounts()}
            disabled={refreshing}
            aria-label="Refresh workspace counts"
            title="Refresh workspace counts"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              borderRadius: 8,
              padding: '7px 12px',
              color: '#334155',
              fontSize: 11.5,
              fontWeight: 650,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s ease',
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* TOP TAB PILLS */}
        <nav
          role="tablist"
          aria-label="Approvals and Disbursements Workspace Tabs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid #f1f5f9',
            overflowX: 'auto',
          }}
        >
          {navPill('approvals', 'Requisition Approvals', reviewCount, <ClipboardCheck size={14} />, 'orange')}
          {navPill('vendors', 'Vendor Disbursements', readyCount, <Building2 size={14} />, 'blue')}
          {navPill('settlements', 'Settlement & Confirmation Ledger', confirmationCount, <BadgeCheck size={14} />, 'emerald')}
          {navPill('governance', 'Approval Matrix & Overrides', null, <ShieldCheck size={14} />, 'slate')}
        </nav>
      </header>

      {/* TAB CONTENT 1: REQUISITION APPROVALS */}
      {activeTab === 'approvals' && (
        <section aria-label="Requisition approvals">
          <ApprovalsDeskView
            businessName={businessName}
            userName={userName}
            scope={activeScope}
            businessId={businessId}
            businessCode={businessCode}
            onNavigate={onNavigate}
            onSelectBusiness={onSelectBusiness}
            onApprovedRequest={() => void refreshCounts()}
          />
        </section>
      )}

      {/* TAB CONTENT 2: VENDOR DISBURSEMENTS */}
      {activeTab === 'vendors' && (
        <section aria-label="Vendor disbursements">
          <DisbursementsDeskView
            businessName={businessName}
            userName={userName}
            scope={activeScope}
            businessId={businessId}
            businessCode={businessCode}
            onNavigate={onNavigate}
            onSelectBusiness={onSelectBusiness}
            filterMode="vendors"
            initialTab="AWAITING_TRANSFER"
          />
        </section>
      )}

      {/* TAB CONTENT 3: SETTLEMENT & CONFIRMATION LEDGER */}
      {activeTab === 'settlements' && (
        <section aria-label="Settlement and confirmation ledger">
          <DisbursementsDeskView
            businessName={businessName}
            userName={userName}
            scope={activeScope}
            businessId={businessId}
            businessCode={businessCode}
            onNavigate={onNavigate}
            onSelectBusiness={onSelectBusiness}
            filterMode="settled"
            initialTab="CLEARED"
          />
        </section>
      )}

      {/* TAB CONTENT 4: APPROVAL MATRIX & OVERRIDES */}
      {activeTab === 'governance' && (
        <section aria-label="Approval matrix and governance" style={{ display: 'grid', gap: 12 }}>
          {/* Sub-tab navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 4,
              width: 'fit-content',
            }}
          >
            <button
              type="button"
              onClick={() => setGovernanceTab('matrix')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: governanceTab === 'matrix' ? 700 : 500,
                borderRadius: 6,
                border: 'none',
                background: governanceTab === 'matrix' ? '#0f172a' : 'transparent',
                color: governanceTab === 'matrix' ? '#ffffff' : '#64748b',
                cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={13} />
              Approval Policy Matrix
            </button>
            <button
              type="button"
              onClick={() => setGovernanceTab('emergency')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: governanceTab === 'emergency' ? 700 : 500,
                borderRadius: 6,
                border: 'none',
                background: governanceTab === 'emergency' ? '#b42318' : 'transparent',
                color: governanceTab === 'emergency' ? '#ffffff' : '#64748b',
                cursor: 'pointer',
              }}
            >
              <ShieldAlert size={13} />
              Emergency Overrides
            </button>
          </div>

          {governanceTab === 'matrix' && (
            <ApprovalMatrixView
              businessName={businessName}
              userName={userName}
              onNavigate={onNavigate}
              onSelectBusiness={onSelectBusiness}
            />
          )}

          {governanceTab === 'emergency' && (
            <EmergencyOverridesView
              businessName={businessName}
              userName={userName}
              onNavigate={onNavigate}
              onSelectBusiness={onSelectBusiness}
            />
          )}
        </section>
      )}
    </main>
  );
}
