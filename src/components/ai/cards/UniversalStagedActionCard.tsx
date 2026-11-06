'use client';

import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle, AlertTriangle, Layers, DollarSign, User, Calendar, Clock, ArrowRight } from 'lucide-react';

interface Props {
  stagedActionId: string;
  confirmationHash: string;
  actionType: string;
  summary: string;
  preview?: Record<string, any>;
  warnings?: string[];
  blockingErrors?: string[];
  expiresAt?: string;
  confirmed?: boolean;
  cancelled?: boolean;
  resultMessage?: string;
  onConfirm: (stagedActionId: string, confirmationHash: string) => Promise<void> | void;
  onCancel?: (stagedActionId: string) => Promise<void> | void;
}

export function UniversalStagedActionCard({
  stagedActionId,
  confirmationHash,
  actionType,
  summary,
  preview = {},
  warnings = [],
  blockingErrors = [],
  expiresAt,
  confirmed,
  cancelled,
  resultMessage,
  onConfirm,
  onCancel,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const getActionMeta = (type: string) => {
    const norm = (type || '').toLowerCase();
    if (norm.includes('budget')) {
      return {
        label: 'Budget Allocation & Ceiling Control',
        badgeBg: '#eff6ff',
        badgeColor: '#1d4ed8',
        borderColor: '#bfdbfe',
        btnText: 'Approve & Commit Budget',
      };
    }
    if (norm.includes('salary') || norm.includes('compensation')) {
      return {
        label: 'Compensation & Payroll Adjustment',
        badgeBg: '#ecfdf5',
        badgeColor: '#047857',
        borderColor: '#a7f3d0',
        btnText: 'Authorize Salary Update',
      };
    }
    if (norm.includes('approval') || norm.includes('disbursement') || norm.includes('decision')) {
      return {
        label: 'Executive Expenditure Authorization',
        badgeBg: '#fffbeb',
        badgeColor: '#b45309',
        borderColor: '#fde68a',
        btnText: 'Authorize Disbursement',
      };
    }
    if (norm.includes('staff_message')) {
      return {
        label: 'Direct Staff Helpdesk Dispatch',
        badgeBg: '#eff6ff',
        badgeColor: '#1d4ed8',
        borderColor: '#bfdbfe',
        btnText: 'Confirm & Send Message',
      };
    }
    if (norm.includes('policy_update') || norm.includes('deadline_extension')) {
      return {
        label: 'Corporate Governance & Policy Control',
        badgeBg: '#f8fafc',
        badgeColor: '#0f172a',
        borderColor: '#cbd5e1',
        btnText: 'Authorize Governance Update',
      };
    }
    if (norm.includes('staff_management')) {
      return {
        label: 'Staff Profile & Governance Update',
        badgeBg: '#f5f3ff',
        badgeColor: '#6d28d9',
        borderColor: '#ddd6fe',
        btnText: 'Authorize Staff Update',
      };
    }
    if (norm.includes('subsidiary_update') || norm.includes('subsidiary_creation')) {
      return {
        label: 'Corporate Entity & Subsidiary Governance',
        badgeBg: '#fff7ed',
        badgeColor: '#c2410c',
        borderColor: '#fed7aa',
        btnText: norm.includes('update') ? 'Authorize Subsidiary Update' : 'Authorize Entity Creation',
      };
    }
    if (norm.includes('request_creation')) {
      return {
        label: 'Expenditure Requisition Submission',
        badgeBg: '#eff6ff',
        badgeColor: '#1d4ed8',
        borderColor: '#bfdbfe',
        btnText: 'Confirm & Submit Request',
      };
    }
    if (norm.includes('grn_creation') || norm.includes('vendor_invoice') || norm.includes('vendor_approval')) {
      return {
        label: 'Procurement & 3-Way Match Control',
        badgeBg: '#f0fdf4',
        badgeColor: '#15803d',
        borderColor: '#bbf7d0',
        btnText: 'Authorize Procurement Action',
      };
    }
    if (norm.includes('attendance')) {
      return {
        label: 'Attendance & Security Lock Control',
        badgeBg: '#ecfeff',
        badgeColor: '#0e7490',
        borderColor: '#a5f3fc',
        btnText: 'Authorize Attendance Policy / Override',
      };
    }
    if (norm.includes('leave_action')) {
      return {
        label: 'HR Leave Authorization',
        badgeBg: '#fdf4ff',
        badgeColor: '#a21caf',
        borderColor: '#f5d0fe',
        btnText: 'Confirm Leave Action',
      };
    }
    if (norm.includes('task_action')) {
      return {
        label: 'Executive Follow-Up Task',
        badgeBg: '#f8fafc',
        badgeColor: '#334155',
        borderColor: '#cbd5e1',
        btnText: 'Confirm Task Assignment',
      };
    }
    if (norm.includes('payroll')) {
      return {
        label: 'Payroll Batch & Disbursement Control',
        badgeBg: '#ecfdf5',
        badgeColor: '#047857',
        borderColor: '#a7f3d0',
        btnText: 'Authorize Payroll Action',
      };
    }
    if (norm.includes('intercompany')) {
      return {
        label: 'Intercompany Clearing & Netting',
        badgeBg: '#eff6ff',
        badgeColor: '#1e40af',
        borderColor: '#bfdbfe',
        btnText: 'Authorize Intercompany Note',
      };
    }
    if (norm.includes('bank_account')) {
      return {
        label: 'Beneficiary & Treasury Bank Registry',
        badgeBg: '#fefce8',
        badgeColor: '#a16207',
        borderColor: '#fef08a',
        btnText: 'Authorize Bank Account Update',
      };
    }
    if (norm.includes('staff')) {
      return {
        label: 'Staff Onboarding & System Access',
        badgeBg: '#f5f3ff',
        badgeColor: '#6d28d9',
        borderColor: '#ddd6fe',
        btnText: 'Authorize Staff Onboarding',
      };
    }
    if (norm.includes('clearance') || norm.includes('accountability')) {
      return {
        label: '72H Advance Retiral Clearance',
        badgeBg: '#f0fdfa',
        badgeColor: '#0f766e',
        borderColor: '#99f6e4',
        btnText: 'Grant Retiral Clearance',
      };
    }
    if (norm.includes('emergency')) {
      return {
        label: 'GMD Emergency Sovereign Override',
        badgeBg: '#fff1f2',
        badgeColor: '#be123c',
        borderColor: '#fecdd3',
        btnText: 'Authorize Emergency Override',
      };
    }
    return {
      label: 'Executive Staged Action',
      badgeBg: '#f8fafc',
      badgeColor: '#334155',
      borderColor: '#e2e8f0',
      btnText: 'Authorize & Execute Action',
    };
  };

  const meta = getActionMeta(actionType);

  const handleConfirm = async () => {
    if (submitting || cancelling) return;
    setSubmitting(true);
    try {
      await onConfirm(stagedActionId, confirmationHash);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (submitting || cancelling) return;
    setCancelling(true);
    try {
      if (onCancel) await onCancel(stagedActionId);
    } finally {
      setCancelling(false);
    }
  };

  if (confirmed || resultMessage) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: '1px solid #86efac',
          borderRadius: '12px',
          padding: '14px 16px',
          marginTop: '8px',
          fontSize: '12px',
          color: '#166534',
          boxShadow: '0 4px 12px rgba(22, 101, 52, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <CheckCircle2 size={18} color="#16a34a" />
          <strong style={{ fontSize: '13px', fontWeight: 800 }}>Operation Committed to Ledger</strong>
        </div>
        <p style={{ margin: 0, color: '#15803d', lineHeight: '1.4' }}>
          {resultMessage || `${summary} has been authorized and committed to the live BEMS database.`}
        </p>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 14px',
          marginTop: '8px',
          fontSize: '12px',
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <XCircle size={16} color="#94a3b8" />
          <span style={{ fontWeight: 700 }}>Staged action discarded</span>
        </div>
      </div>
    );
  }

  const hasErrors = blockingErrors && blockingErrors.length > 0;
  const allocations = Array.isArray(preview?.allocations) ? preview.allocations : null;

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: `1.5px solid ${meta.borderColor}`,
        borderRadius: '14px',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        marginTop: '8px',
        fontSize: '12px',
        color: '#0f172a',
      }}
    >
      {/* Header Badge & Action Id */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: meta.badgeColor,
              background: meta.badgeBg,
              padding: '3px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {meta.label}
          </span>
          <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
            #{stagedActionId ? stagedActionId.slice(0, 10) : 'PENDING'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '10px', fontWeight: 700 }}>
          <Clock size={12} />
          <span>Pending GMD Sign-off</span>
        </div>
      </div>

      {/* Summary Title */}
      <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800, color: '#0f172a', lineHeight: '1.3' }}>
        {summary}
      </h4>

      {/* Preview Details Grid */}
      <div
        style={{
          background: '#f8fafc',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '10px 12px',
          marginBottom: '12px',
          display: 'grid',
          gap: '6px',
        }}
      >
        {Object.entries(preview)
          .filter(([key]) => key !== 'allocations' && key !== 'lines' && key !== 'warnings' && key !== 'blocking_errors')
          .slice(0, 8)
          .map(([key, val]) => {
            const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const displayVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '—');
            const isHighlight =
              key.includes('amount') ||
              key.includes('salary') ||
              key.includes('delta') ||
              key.includes('total') ||
              key.includes('decision');

            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{formattedKey}:</span>
                <span style={{ fontWeight: isHighlight ? 800 : 600, color: isHighlight ? '#0f172a' : '#334155' }}>
                  {displayVal}
                </span>
              </div>
            );
          })}
      </div>

      {/* Allocations Table if present (e.g. Budget) */}
      {allocations && allocations.length > 0 && (
        <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', padding: '6px 12px', background: '#f1f5f9', fontSize: '10px', fontWeight: 800, color: '#64748b' }}>
            <span>LINE / DEPARTMENT</span>
            <span style={{ textAlign: 'right' }}>ALLOCATION</span>
          </div>
          {allocations.map((item: any, idx: number) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                padding: '6px 12px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '11px',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                {item.department || item.line_name || item.name || 'General Allocation'}
              </span>
              <strong style={{ textAlign: 'right', color: '#0f172a' }}>
                {typeof item.amount === 'number'
                  ? `₦${item.amount.toLocaleString()}`
                  : item.amount || '—'}
              </strong>
            </div>
          ))}
        </div>
      )}

      {/* Warnings & Notices */}
      {warnings && warnings.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <AlertTriangle size={14} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: '#b45309' }}>
            {warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        </div>
      )}

      {/* Blocking Errors */}
      {hasErrors && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <XCircle size={14} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: '#b91c1c' }}>
            {blockingErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          disabled={hasErrors || submitting || cancelling}
          onClick={handleConfirm}
          style={{
            flex: 2,
            background: hasErrors
              ? '#cbd5e1'
              : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: hasErrors ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: hasErrors ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.25)',
            transition: 'all 0.15s ease',
          }}
        >
          {submitting ? (
            <>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid #ffffff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              Executing Action...
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              {meta.btnText}
            </>
          )}
        </button>

        {onCancel && (
          <button
            type="button"
            disabled={submitting || cancelling}
            onClick={handleCancel}
            style={{
              flex: 1,
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            {cancelling ? 'Discarding...' : 'Discard'}
          </button>
        )}
      </div>
    </div>
  );
}

