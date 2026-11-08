'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
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

  const tabs: { key: WorkspaceTab; label: string; count: number | null; icon: React.ReactNode }[] = [
    { key: 'approvals', label: 'Requisition Approvals', count: reviewCount, icon: <ClipboardCheck size={13} /> },
    { key: 'vendors', label: 'Vendor Disbursements', count: readyCount, icon: <Building2 size={13} /> },
    { key: 'settlements', label: 'Settlement Ledger', count: confirmationCount, icon: <BadgeCheck size={13} /> },
    { key: 'governance', label: 'Approval Matrix & Overrides', count: null, icon: <ShieldCheck size={13} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <style>{`
        .bems-tab-pill-active,
        .bems-tab-pill-active span,
        .bems-tab-pill-active strong {
          color: #ffffff !important;
        }
      `}</style>
      {/* 1. SEAMLESS EXECUTIVE HEADER (Matching FundingView & BEMS ERP Standard) */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '8.5px', letterSpacing: '1.2px', fontWeight: 800, color: '#7d8ba1', textTransform: 'uppercase' }}>
            FUND LIFECYCLE &amp; APPROVALS DESK · {businessName.toUpperCase()}
          </span>
          <h1 style={{ fontSize: '18px', letterSpacing: '-0.3px', fontWeight: 700, margin: '4px 0 2px', color: '#17253d' }}>
            Approvals &amp; Disbursements
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
            Direct GMD authorization, staff wallet funding, and corporate vendor settlement ledger.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void refreshCounts()}
            disabled={refreshing}
            aria-label="Refresh counts"
            title="Refresh counts"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 11px',
              borderRadius: 7,
              fontSize: '11px',
              fontWeight: 650,
              background: '#fff',
              color: '#263c60',
              border: '1px solid #dce4ef',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* 2. MULTI-TAB TOOLBAR (Light Enterprise Styling matching FundingView) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '6px 10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={isActive ? 'bems-tab-pill-active' : 'bems-tab-pill'}
                data-active-pill={isActive ? 'true' : undefined}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 7,
                  fontSize: '11.5px',
                  fontWeight: isActive ? 700 : 600,
                  background: isActive ? '#ea580c' : '#f8fafc',
                  color: isActive ? '#ffffff' : '#475569',
                  border: isActive ? '1px solid #ea580c' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 1px 2px rgba(234, 88, 12, 0.2)' : 'none',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', color: isActive ? '#ffffff' : '#64748b' }}>
                  {tab.icon}
                </span>
                <span style={{ color: isActive ? '#ffffff' : '#475569', fontWeight: isActive ? 700 : 600 }}>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: isActive ? 'rgba(255, 255, 255, 0.28)' : '#e2e8f0',
                      color: isActive ? '#ffffff' : '#334155',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TAB CONTENT */}
      {activeTab === 'approvals' && (
        <ApprovalsDeskView
          businessName={businessName}
          userName={userName}
          scope={activeScope}
          businessId={businessId}
          businessCode={businessCode}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
          onApprovedRequest={() => void refreshCounts()}
          hideHeader={true}
        />
      )}

      {activeTab === 'vendors' && (
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
          hideHeader={true}
        />
      )}

      {activeTab === 'settlements' && (
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
          hideHeader={true}
        />
      )}

      {activeTab === 'governance' && (
        <section style={{ display: 'grid', gap: 12 }}>
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
                fontSize: 11.5,
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
                fontSize: 11.5,
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
    </div>
  );
}
