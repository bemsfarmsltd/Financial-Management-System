'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, CircleDollarSign, ClipboardCheck, RefreshCw } from 'lucide-react';
import { ApprovalsHubView } from './ApprovalsHubView';
import { DisbursementsDeskView } from './DisbursementsDeskView';

type Stage = 'REVIEW' | 'PAYMENTS';

export function FundFlowWorkspace({
  businessName,
  userName,
  onNavigate,
  onSelectBusiness,
}: {
  businessName: string;
  userName: string;
  onNavigate: (page: string) => void;
  onSelectBusiness: (id: string) => void;
}) {
  const [stage, setStage] = useState<Stage>('REVIEW');
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [readyCount, setReadyCount] = useState<number | null>(null);
  const [confirmationCount, setConfirmationCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestToRecordId, setRequestToRecordId] = useState<string | null>(null);

  const refreshCounts = useCallback(async () => {
    setRefreshing(true);
    try {
      const [approvalsResponse, paymentsResponse] = await Promise.all([
        fetch('/api/approvals?subsidiary=ALL'),
        fetch('/api/disbursements?subsidiary=ALL'),
      ]);
      if (approvalsResponse.ok) {
        const approvals = await approvalsResponse.json();
        setReviewCount(Number(approvals.summary?.totalPendingCount ?? 0));
      }
      if (paymentsResponse.ok) {
        const payments = await paymentsResponse.json();
        setReadyCount(Array.isArray(payments.readyForTransfer) ? payments.readyForTransfer.length : 0);
        setConfirmationCount(Number(payments.summary?.awaitingCount ?? 0));
      }
    } catch {
      // The stage links remain usable if count refresh is temporarily unavailable.
    } finally {
      setRefreshing(false);
    }
  }, []);

  const continueToPayment = useCallback((requestId: string) => {
    setRequestToRecordId(requestId);
    setStage('PAYMENTS');
    void refreshCounts();
  }, [refreshCounts]);
  const clearPaymentRequest = useCallback(() => setRequestToRecordId(null), []);

  useEffect(() => { void refreshCounts(); }, [refreshCounts]);

  const stageCard = (next: Stage, title: string, description: string, countText: string, icon: React.ReactNode) => {
    const selected = stage === next;
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => setStage(next)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', minHeight: 76,
          border: selected ? '2px solid #ea580c' : '1px solid #dbe4ef', borderRadius: 10,
          background: selected ? '#fff7ed' : '#fff', padding: '12px 14px', cursor: 'pointer',
          boxShadow: selected ? '0 0 0 2px rgba(234,88,12,.15)' : 'none',
        }}
      >
        <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', flex: '0 0 auto', borderRadius: 9, background: selected ? '#ea580c' : '#edf2f8', color: selected ? '#fff' : '#506784' }}>{icon}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', color: '#172b4d', fontSize: 13 }}>{title}</strong>
          <small style={{ display: 'block', color: '#62748b', fontSize: 11, lineHeight: 1.4, marginTop: 3 }}>{description}</small>
        </span>
        <span style={{ flex: '0 0 auto', color: selected ? '#ea580c' : '#64748b', fontSize: 11, fontWeight: 700 }}>{countText}</span>
      </button>
    );
  };

  return (
    <main style={{ display: 'grid', gap: 16, width: '100%' }}>
      <header style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <span style={{ color: '#8392a8', fontSize: 10, fontWeight: 800, letterSpacing: '1.3px' }}>FUND LIFECYCLE · {businessName}</span>
            <h1 style={{ color: '#102344', fontSize: 23, margin: '5px 0 4px' }}>Approvals &amp; Payments</h1>
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Approval authorizes payment. After payment is recorded, the requester confirms receipt and completes accountability.</p>
          </div>
          <button type="button" onClick={() => void refreshCounts()} disabled={refreshing} aria-label="Refresh workflow counts" title="Refresh workflow counts" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #dbe4ef', background: '#fff', borderRadius: 8, padding: '7px 9px', color: '#52667f', fontSize: 11, fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/> Refresh
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
          {stageCard('REVIEW', '1. Request Review', 'Check the request, ask questions, approve or decline, and review policy or emergency controls.', reviewCount === null ? 'Loading…' : `${reviewCount} awaiting`, <ClipboardCheck size={18}/>)}
          {stageCard('PAYMENTS', '2. Payments & Staff Confirmation', 'Record payment and upload the receipt, then track staff confirmation and completed payments.', readyCount === null || confirmationCount === null ? 'Loading…' : `${readyCount} ready · ${confirmationCount} awaiting staff`, <CircleDollarSign size={18}/>)}
        </div>
        <p aria-live="polite" style={{ margin: '9px 0 0', color: '#64748b', fontSize: 11 }}>
          Showing {stage === 'REVIEW' ? 'Stage 1: request decisions' : 'Stage 2: payment recording and receipt confirmation'} below.
        </p>
      </header>

      <section style={{ display: stage === 'REVIEW' ? 'block' : 'none' }} aria-label="Request review stage" aria-hidden={stage !== 'REVIEW'}>
        <ApprovalsHubView businessName={businessName} userName={userName} onNavigate={onNavigate} onSelectBusiness={onSelectBusiness} onApprovedRequest={continueToPayment}/>
      </section>
      <section style={{ display: stage === 'PAYMENTS' ? 'grid' : 'none', gap: 14 }} aria-label="Payments and confirmation stage" aria-hidden={stage !== 'PAYMENTS'}>
        <>
          <div style={{ background: '#f1f7ff', border: '1px solid #d4e5ff', borderRadius: 10, padding: '11px 14px', color: '#38516f', fontSize: 12 }}>
            <strong style={{ color: '#102344' }}>After approval:</strong> record the off-platform payment and upload the actual bank slip. The staff requester then confirms receipt or reports a problem.
          </div>
          <DisbursementsDeskView businessName={businessName} userName={userName} onNavigate={onNavigate} onSelectBusiness={onSelectBusiness} requestToRecordId={requestToRecordId} onRequestToRecordOpened={clearPaymentRequest}/>
          <aside style={{ background: '#fff', border: '1px solid #dce5f0', borderRadius: 10, padding: '12px 15px', color: '#52667f', fontSize: 12 }}>
            <BadgeCheck size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: '#098764' }}/>
            Staff confirmation completes the payment-receipt step and opens the request’s accountability follow-up.
          </aside>
        </>
      </section>
    </main>
  );
}
