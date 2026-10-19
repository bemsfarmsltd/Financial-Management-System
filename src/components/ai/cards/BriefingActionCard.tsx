'use client';

import React from 'react';
import { BriefingCardData } from '../types';
import { ShieldCheck, AlertTriangle, ArrowRight, Clock, ChevronRight, Zap } from 'lucide-react';

interface Props {
  data: BriefingCardData;
  onNavigate?: (tab: string) => void;
  onSelectAction?: (actionPrompt: string) => void;
}

export function BriefingActionCard({ data, onNavigate, onSelectAction }: Props) {
  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 100%)',
        borderRadius: '14px',
        padding: '16px',
        color: '#ffffff',
        border: '1px solid rgba(249, 115, 22, 0.25)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        marginTop: '8px',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: 'rgba(249, 115, 22, 0.2)',
              color: '#f97316',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Daily Executive Brief
          </span>
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>as of {data.asOf}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '11px', fontWeight: 700 }}>
          <Zap size={13} />
          <span>{data.cashRunwayMonths} Runway</span>
        </div>
      </div>

      {/* Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Pending Approvals</span>
          <strong style={{ fontSize: '16px', color: '#f97316', display: 'block', margin: '2px 0' }}>{data.totalPendingApprovals}</strong>
          <small style={{ fontSize: '10px', color: '#cbd5e1' }}>{formatNaira(data.totalPendingMinor / 100)}</small>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Unrecorded Payments</span>
          <strong style={{ fontSize: '16px', color: '#38bdf8', display: 'block', margin: '2px 0' }}>{data.unrecordedPayments}</strong>
          <small style={{ fontSize: '10px', color: '#cbd5e1' }}>{formatNaira(data.unrecordedMinor / 100)}</small>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Accountability</span>
          <strong style={{ fontSize: '16px', color: data.overdueCasesCount > 0 ? '#ef4444' : '#10b981', display: 'block', margin: '2px 0' }}>
            {data.overdueCasesCount > 0 ? `${data.overdueCasesCount} Overdue` : 'All Clear'}
          </strong>
          <small style={{ fontSize: '10px', color: '#cbd5e1' }}>Proof receipts</small>
        </div>
      </div>

      {/* Ranked Urgent Action Queue */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px 0' }}>
          Prioritized Action Queue
        </p>

        {data.urgentItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#f97316', fontWeight: 800, fontSize: '11px' }}>{item.requestNumber}</span>
                <span style={{ color: '#64748b', fontSize: '10px' }}>· {item.subsidiaryName}</span>
              </div>
              <p style={{ margin: '2px 0 0', color: '#f1f5f9', fontWeight: 600, fontSize: '12px' }}>{item.title}</p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 800, color: '#ffffff', fontSize: '12px' }}>{formatNaira(item.amountNaira)}</span>
              <button
                type="button"
                onClick={() => onSelectAction && onSelectAction(`Review and decide on ${item.requestNumber}`)}
                style={{
                  background: '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '3px',
                }}
              >
                Inspect →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fast Shortcuts */}
      <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('Approvals & payments')}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#e2e8f0',
            borderRadius: '6px',
            padding: '6px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Approvals Desk ↗
        </button>
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('Disbursements desk')}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#e2e8f0',
            borderRadius: '6px',
            padding: '6px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Disbursements ↗
        </button>
      </div>
    </div>
  );
}
