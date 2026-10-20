'use client';

import React from 'react';
import { BriefingCardData } from '../types';
import { Zap } from 'lucide-react';

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
        background: 'rgba(255, 255, 255, 0.65)',
        borderRadius: '16px',
        padding: '18px',
        color: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.85)',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        marginTop: '10px',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #fed7aa',
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
          <span style={{ color: '#64748b', fontSize: '11px' }}>as of {data.asOf}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '11.5px', fontWeight: 800 }}>
          <Zap size={14} color="#059669" />
          <span>{data.cashRunwayMonths} Runway</span>
        </div>
      </div>

      {/* Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.50)', borderRadius: '10px', padding: '10px', border: '1px solid rgba(255, 255, 255, 0.70)' }}>
          <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Pending Approvals</span>
          <strong style={{ fontSize: '16px', color: '#ea580c', display: 'block', margin: '2px 0' }}>{data.totalPendingApprovals}</strong>
          <small style={{ fontSize: '10px', color: '#64748b' }}>{formatNaira(data.totalPendingMinor / 100)}</small>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.50)', borderRadius: '10px', padding: '10px', border: '1px solid rgba(255, 255, 255, 0.70)' }}>
          <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Unrecorded Payments</span>
          <strong style={{ fontSize: '16px', color: '#0284c7', display: 'block', margin: '2px 0' }}>{data.unrecordedPayments}</strong>
          <small style={{ fontSize: '10px', color: '#64748b' }}>{formatNaira(data.unrecordedMinor / 100)}</small>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.50)', borderRadius: '10px', padding: '10px', border: '1px solid rgba(255, 255, 255, 0.70)' }}>
          <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Accountability</span>
          <strong style={{ fontSize: '16px', color: data.overdueCasesCount > 0 ? '#dc2626' : '#059669', display: 'block', margin: '2px 0' }}>
            {data.overdueCasesCount > 0 ? `${data.overdueCasesCount} Overdue` : 'All Clear'}
          </strong>
          <small style={{ fontSize: '10px', color: '#64748b' }}>Proof receipts</small>
        </div>
      </div>

      {/* Ranked Urgent Action Queue */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0' }}>
          Prioritized Action Queue
        </p>

        {data.urgentItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'rgba(255, 255, 255, 0.50)',
              border: '1px solid rgba(255, 255, 255, 0.70)',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#ea580c', fontWeight: 800, fontSize: '11px' }}>{item.requestNumber}</span>
                <span style={{ color: '#64748b', fontSize: '10px' }}>· {item.subsidiaryName}</span>
              </div>
              <p style={{ margin: '2px 0 0', color: '#0f172a', fontWeight: 700, fontSize: '12px' }}>{item.title}</p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 800, color: '#0f172a', fontSize: '12.5px' }}>{formatNaira(item.amountNaira)}</span>
              <button
                type="button"
                onClick={() => onSelectAction && onSelectAction(`Review and decide on ${item.requestNumber}`)}
                style={{
                  background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '4px',
                  boxShadow: '0 1px 3px rgba(234, 88, 12, 0.2)',
                }}
              >
                Inspect →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fast Shortcuts */}
      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('Approvals & payments')}
          style={{
            flex: 1,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            color: '#334155',
            borderRadius: '8px',
            padding: '8px',
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
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            color: '#334155',
            borderRadius: '8px',
            padding: '8px',
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
