'use client';

import React, { useState } from 'react';
import { BudgetProposalCardData } from '../types';
import { Check, ShieldAlert, ArrowUpRight, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface Props {
  data: BudgetProposalCardData;
  confirmed?: boolean;
  cancelled?: boolean;
  resultMessage?: string;
  onConfirmBudget: (budgetData: BudgetProposalCardData) => void;
  onCancel?: () => void;
}

export function BudgetProposalCard({ data, confirmed, cancelled, resultMessage, onConfirmBudget, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const lineSum = data.lines.reduce((acc, l) => acc + l.allocatedAmount, 0);
  const isValidSum = lineSum === data.totalAmount;

  if (confirmed || resultMessage) {
    return (
      <div
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '14px',
          marginTop: '8px',
          fontSize: '12px',
          color: '#166534',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <CheckCircle2 size={16} color="#16a34a" />
          <strong style={{ fontSize: '13px' }}>Budget Proposal Committed</strong>
        </div>
        <p style={{ margin: 0, color: '#15803d' }}>
          {resultMessage || `${data.periodName} (${formatNaira(data.totalAmount)}) has been saved for ${data.organizationName}.`}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.85)',
        borderRadius: '14px',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        marginTop: '8px',
        fontSize: '12px',
        color: '#0f172a',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
            Budget Allocation Preview
          </span>
          <h3 style={{ margin: '4px 0 2px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{data.periodName}</h3>
          <span style={{ color: '#64748b', fontSize: '11px' }}>
            {data.organizationName} · FY{data.fiscalYear} ({data.fiscalPeriod})
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{formatNaira(data.totalAmount)}</strong>
          {data.varianceFromPrevious && (
            <span style={{ display: 'block', fontSize: '10px', color: data.varianceFromPrevious > 0 ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
              {data.varianceFromPrevious > 0 ? `+${formatNaira(data.varianceFromPrevious)}` : formatNaira(data.varianceFromPrevious)} vs prior
            </span>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', padding: '8px 12px', background: '#f1f5f9', fontSize: '10px', fontWeight: 800, color: '#64748b' }}>
          <span>DEPARTMENT</span>
          <span>CATEGORY</span>
          <span style={{ textAlign: 'right' }}>AMOUNT</span>
        </div>
        {data.lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1.5fr 1fr',
              padding: '8px 12px',
              borderTop: '1px solid #f1f5f9',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700, color: '#1e293b' }}>{l.departmentName}</span>
            <span style={{ color: '#64748b' }}>{l.category}</span>
            <strong style={{ textAlign: 'right', color: '#0f172a' }}>{formatNaira(l.allocatedAmount)}</strong>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
          <span style={{ fontWeight: 800, color: '#475569' }}>Total Allocated Lines:</span>
          <strong style={{ color: isValidSum ? '#059669' : '#dc2626' }}>
            {formatNaira(lineSum)} {isValidSum ? '✓' : `(Mismatch of ${formatNaira(Math.abs(lineSum - data.totalAmount))})`}
          </strong>
        </div>
      </div>

      {/* Confirmation Warning Notice */}
      <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <AlertTriangle size={14} color="#d97706" />
        <span style={{ fontSize: '11px', color: '#b45309' }}>
          Saving this budget will set active departmental ceiling controls for {data.organizationName}.
        </span>
      </div>

      {/* Confirm Button */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          disabled={!isValidSum || submitting}
          onClick={() => {
            setSubmitting(true);
            onConfirmBudget(data);
          }}
          style={{
            flex: 2,
            background: isValidSum ? '#f97316' : '#cbd5e1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '9px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: isValidSum ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Check size={13} />
          Confirm & Save Budget
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '6px',
              padding: '9px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Discard
          </button>
        )}
      </div>
    </div>
  );
}
