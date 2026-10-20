'use client';

import React, { useState } from 'react';
import { ApprovalDecisionCardData } from '../types';
import { CheckCircle2, XCircle, HelpCircle, UserCheck, ShieldAlert, AlertCircle } from 'lucide-react';

interface Props {
  data: ApprovalDecisionCardData;
  confirmed?: boolean;
  cancelled?: boolean;
  resultMessage?: string;
  onExecuteDecision: (action: 'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION', reason: string, recorder?: string) => void;
}

export function ApprovalDecisionCard({ data, confirmed, cancelled, resultMessage, onExecuteDecision }: Props) {
  const [reason, setReason] = useState('');
  const [selectedRecorder, setSelectedRecorder] = useState('Bems system Admin');
  const [submitting, setSubmitting] = useState(false);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAction = (action: 'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION') => {
    setSubmitting(true);
    onExecuteDecision(action, reason, action === 'APPROVE' ? selectedRecorder : undefined);
  };

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
          <strong style={{ fontSize: '13px' }}>Action Executed Successfully</strong>
        </div>
        <p style={{ margin: 0, color: '#15803d' }}>
          {resultMessage || `Decision on ${data.requestNumber} (${formatNaira(data.amountNaira)}) has been committed to the audit ledger.`}
        </p>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          padding: '12px',
          marginTop: '8px',
          fontSize: '12px',
          color: '#991b1b',
        }}
      >
        <span>Action cancelled for {data.requestNumber}. No changes were made.</span>
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#ea580c', background: '#fff7ed', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
            Decision Gate
          </span>
          <h3 style={{ margin: '4px 0 2px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{data.title}</h3>
          <span style={{ color: '#64748b', fontSize: '11px' }}>
            {data.requestNumber} · {data.subsidiaryName} · Requester: {data.requesterName}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{formatNaira(data.amountNaira)}</strong>
          <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>{data.category}</span>
        </div>
      </div>

      {/* Justification snippet */}
      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', borderLeft: '3px solid #ea580c' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Operational Justification</span>
        <p style={{ margin: '2px 0 0', color: '#334155', fontStyle: 'italic', fontSize: '11px' }}>"{data.justification}"</p>
      </div>

      {/* Budget Impact & Policy Checks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Budget Headroom</span>
          <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', margin: '2px 0' }}>
            {data.budgetImpact.headroomPercentage}% Available
          </strong>
          <small style={{ fontSize: '10px', color: '#64748b' }}>
            After approval: {formatNaira(data.budgetImpact.newTotalAfterApproval)} / {formatNaira(data.budgetImpact.budgetTotal)}
          </small>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Policy Validation</span>
          {data.policyChecks.map((chk, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              {chk.passed ? <CheckCircle2 size={11} color="#16a34a" /> : <AlertCircle size={11} color="#ea580c" />}
              <span style={{ fontSize: '10px', color: chk.passed ? '#15803d' : '#c2410c' }}>{chk.check}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assign Payment Recorder (Optional executive assignment) */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
          Assign Payment Recorder (on Approval):
        </label>
        <select
          value={selectedRecorder}
          onChange={(e) => setSelectedRecorder(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            fontSize: '11px',
            color: '#0f172a',
          }}
        >
          <option value="Bems system Admin">Bems system Admin (Central Treasury)</option>
          <option value="Engr. Tunde Adeleke">Engr. Tunde Adeleke (COO - Tech)</option>
          <option value="Capt. Niyi Alabi">Capt. Niyi Alabi (COO - Logistics)</option>
        </select>
      </div>

      {/* Decision Notes / Clarification input */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
          Executive Notes / Reason (Optional):
        </label>
        <input
          type="text"
          placeholder="e.g. Approved per Q4 infrastructure roadmap."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '11px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('APPROVE')}
          style={{
            flex: 2,
            background: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <CheckCircle2 size={13} />
          Approve & Authorize
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('REQUEST_CLARIFICATION')}
          style={{
            flex: 1.2,
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <HelpCircle size={13} />
          Clarify
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('REJECT')}
          style={{
            flex: 1,
            background: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <XCircle size={13} />
          Decline
        </button>
      </div>
    </div>
  );
}
