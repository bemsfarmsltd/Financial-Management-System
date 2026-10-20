'use client';

import React, { useState } from 'react';
import { SalaryAdjustmentCardData } from '../types';
import { CheckCircle2, User, AlertTriangle, ArrowRight, ShieldCheck, Mail } from 'lucide-react';

interface Props {
  data: SalaryAdjustmentCardData;
  confirmed?: boolean;
  cancelled?: boolean;
  resultMessage?: string;
  onAuthorizeAdjustment: (data: SalaryAdjustmentCardData) => void;
  onCancel?: () => void;
}

export function SalaryAdjustmentCard({ data, confirmed, cancelled, resultMessage, onAuthorizeAdjustment, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const diff = data.proposedSalary - data.currentSalary;
  const pctChange = data.currentSalary > 0 ? Math.round((diff / data.currentSalary) * 100) : 0;

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
          <strong style={{ fontSize: '13px' }}>Salary Adjustment Committed</strong>
        </div>
        <p style={{ margin: 0, color: '#15803d' }}>
          {resultMessage || `Compensation record updated for ${data.employeeName} to ${formatNaira(data.proposedSalary)} effective ${data.effectiveDate}. Versioned history preserved.`}
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
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: data.changeType === 'ADDITION' ? '#16a34a' : '#ea580c',
              background: data.changeType === 'ADDITION' ? '#f0fdf4' : '#fff7ed',
              padding: '2px 6px',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}
          >
            Staff Compensation Proposal · {data.changeType}
          </span>
          <h3 style={{ margin: '4px 0 2px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{data.employeeName}</h3>
          <span style={{ color: '#64748b', fontSize: '11px' }}>
            {data.employeeNumber} · {data.subsidiaryName} ({data.departmentName})
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong style={{ fontSize: '14px', fontWeight: 800, color: diff >= 0 ? '#16a34a' : '#dc2626' }}>
            {diff >= 0 ? `+${formatNaira(diff)}` : formatNaira(diff)} ({pctChange >= 0 ? `+${pctChange}%` : `${pctChange}%`})
          </strong>
          <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>Effective: {data.effectiveDate}</span>
        </div>
      </div>

      {/* Before / After Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
        <div>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Current Monthly Gross</span>
          <strong style={{ fontSize: '15px', color: '#334155' }}>{formatNaira(data.currentSalary)}</strong>
        </div>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <ArrowRight size={16} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Proposed Monthly Gross</span>
          <strong style={{ fontSize: '16px', color: '#059669' }}>{formatNaira(data.proposedSalary)}</strong>
        </div>
      </div>

      {/* Justification */}
      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', borderLeft: '3px solid #f97316' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Executive Justification</span>
        <p style={{ margin: '2px 0 0', color: '#334155', fontStyle: 'italic', fontSize: '11px' }}>"{data.reason}"</p>
      </div>

      {/* Staff Notification Banner */}
      {data.willNotifyEmployee && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #bfdbfe' }}>
          <Mail size={13} color="#2563eb" />
          <span style={{ fontSize: '11px', color: '#1d4ed8' }}>
            Staff member will automatically be notified with this reason upon executive sign-off.
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setSubmitting(true);
            onAuthorizeAdjustment(data);
          }}
          style={{
            flex: 2,
            background: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '9px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <ShieldCheck size={14} />
          Authorize Salary Update
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
