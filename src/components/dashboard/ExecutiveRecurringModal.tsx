'use client';

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Calendar,
  User,
  Building2,
  Repeat,
  Sparkles,
  FileText,
  Lock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export type RecurringRequestDetail = {
  id: string;
  systemId: string;
  requestNumber: string;
  title: string;
  category: string;
  amountMinor: string;
  currency: string;
  recurringInterval: string | null;
  approvalStatus: string;
  paymentStatus: string;
  accountabilityStatus: string;
  justification: string;
  deliverable: string | null;
  neededBy: string;
  createdAt: string;
  subsidiary: { id: string; legalName: string; code: string };
  requester: { id: string; legalName: string; role: string };
  vendor: { id: string; name: string } | null;
};

interface ExecutiveRecurringModalProps {
  request: RecurringRequestDetail | null;
  onClose: () => void;
}

const cadenceLabel: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
};

const formatNaira = (minor: string | number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
};

function getRelativeDays(dateStr: string) {
  try {
    const diffTime = new Date(dateStr).getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays}d`;
  } catch {
    return '';
  }
}

export function ExecutiveRecurringModal({ request, onClose }: ExecutiveRecurringModalProps) {
  const [copied, setCopied] = useState(false);

  if (!request) return null;

  const handleCopySystemId = () => {
    navigator.clipboard.writeText(request.systemId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const annualOutflowMinor =
    request.recurringInterval === 'ANNUAL'
      ? Number(request.amountMinor)
      : request.recurringInterval === 'QUARTERLY'
      ? Number(request.amountMinor) * 4
      : Number(request.amountMinor) * 12;

  const cadenceText = cadenceLabel[request.recurringInterval || ''] || 'Monthly';
  const multiplierText = request.recurringInterval === 'ANNUAL' ? '1×' : request.recurringInterval === 'QUARTERLY' ? '4×' : '12×';

  const isApproved = request.approvalStatus === 'APPROVED';
  const isPaid = request.paymentStatus === 'RECIPIENT_CONFIRMED' || request.paymentStatus === 'AWAITING_RECIPIENT_CONFIRMATION';
  const isAccounted = request.accountabilityStatus === 'VERIFIED' || request.accountabilityStatus === 'CLOSED';

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(8, 14, 26, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="executive-recurring-title"
        style={{
          width: 'min(740px, 100%)',
          maxHeight: 'min(90vh, 840px)',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.05)',
          position: 'relative',
        }}
      >
        {/* Brand Accent Top Strip */}
        <div
          style={{
            height: 4,
            background: 'var(--brand-gradient, linear-gradient(90deg, #0d8a70 0%, #2563eb 100%))',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
          }}
        />

        {/* Modal Header */}
        <header
          style={{
            padding: '20px 24px 18px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            background: 'linear-gradient(180deg, #fafbfd 0%, #ffffff 100%)',
          }}
        >
          <div>
            {/* Meta Tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--brand-primary, #0d8a70)',
                  background: 'var(--brand-soft, rgba(13, 138, 112, 0.08))',
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--brand-border, rgba(13, 138, 112, 0.2))',
                }}
              >
                {request.requestNumber}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#334155',
                  background: '#f1f5f9',
                  padding: '3px 8px',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-primary, #0d8a70)' }} />
                {request.subsidiary.legalName}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#64748b',
                  background: '#f8fafc',
                  padding: '3px 7px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {request.category}
              </span>
            </div>

            {/* Title */}
            <h2
              id="executive-recurring-title"
              style={{
                margin: 0,
                color: '#0f172a',
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {request.title}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#ea580c',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  padding: '2px 8px',
                  borderRadius: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Repeat size={10} />
                {cadenceText} Renewal
              </span>
            </h2>

            {/* System ID with Copy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                Ref: {request.systemId}
              </span>
              <button
                type="button"
                onClick={handleCopySystemId}
                title="Copy tracking reference"
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: copied ? '#059669' : '#94a3b8',
                  padding: 2,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              {copied && <span style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>Copied!</span>}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#64748b',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              transition: 'background 0.15s',
            }}
          >
            <X size={16} />
          </button>
        </header>

        {/* Modal Body */}
        <div style={{ padding: '22px 24px', display: 'grid', gap: 18 }}>
          {/* Hero Financial Banner */}
          <div
            style={{
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', padding: '16px 20px', gap: 16 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  RECURRING CYCLE AMOUNT
                </span>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', lineHeight: 1.2, marginTop: 4 }}>
                  {formatNaira(request.amountMinor)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>/ {cadenceText.toLowerCase()}</span>
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'block' }}>
                  Authorized recurring disbursement rate
                </span>
              </div>

              <div style={{ borderLeft: '1px solid #f1f5f9', paddingLeft: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ANNUALIZED RUN-RATE
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: '#2563eb',
                      background: '#eff6ff',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {multiplierText} Cadence
                  </span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', lineHeight: 1.2, marginTop: 4 }}>
                  {formatNaira(annualOutflowMinor)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>/ yr</span>
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'block' }}>
                  Projected 12-month committed expenditure
                </span>
              </div>
            </div>

            {/* Sub-bar */}
            <div
              style={{
                background: '#f1f5f9',
                padding: '8px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 11,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#334155', fontWeight: 600 }}>
                <Clock size={12} color="#ea580c" />
                Next Execution: <strong>{formatDate(request.neededBy)}</strong>{' '}
                <span style={{ color: '#ea580c', fontWeight: 700 }}>({getRelativeDays(request.neededBy)})</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 10 }}>
                <Lock size={10} color="#059669" />
                Treasury Gate: Maker-Checker Dual-Custody Enforced
              </span>
            </div>
          </div>

          {/* Connected 4-Stage Lifecycle Stepper */}
          <div style={{ padding: 16, borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                GOVERNANCE &amp; DISBURSEMENT LIFECYCLE
              </span>
              <span style={{ fontSize: 10, color: '#64748b' }}>Stage 2 of 4 Active</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, position: 'relative' }}>
              {/* Stepper Card 1: Submitted */}
              <div
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#059669',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 4px',
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  ✓
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46' }}>Submitted</div>
                <div style={{ fontSize: 9, color: '#059669', marginTop: 1 }}>Requisition Lodged</div>
              </div>

              {/* Stepper Card 2: GMD Approval */}
              <div
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  background: isApproved ? '#ecfdf5' : '#eff6ff',
                  border: `1px solid ${isApproved ? '#a7f3d0' : '#bfdbfe'}`,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isApproved ? '#059669' : '#2563eb',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 4px',
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {isApproved ? '✓' : '2'}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isApproved ? '#065f46' : '#1e40af' }}>GMD Approval</div>
                <div style={{ fontSize: 9, color: isApproved ? '#059669' : '#2563eb', marginTop: 1 }}>
                  {isApproved ? 'Sign-Off Cleared' : 'Under Review'}
                </div>
              </div>

              {/* Stepper Card 3: Disbursement */}
              <div
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  background: isPaid ? '#ecfdf5' : '#ffffff',
                  border: `1px solid ${isPaid ? '#a7f3d0' : '#e2e8f0'}`,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isPaid ? '#059669' : '#94a3b8',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 4px',
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {isPaid ? '✓' : '3'}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isPaid ? '#065f46' : '#64748b' }}>Disbursement</div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>
                  {isPaid ? 'Payout Recorded' : 'Maker-Checker Gate'}
                </div>
              </div>

              {/* Stepper Card 4: Accountability */}
              <div
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  background: isAccounted ? '#ecfdf5' : '#ffffff',
                  border: `1px solid ${isAccounted ? '#a7f3d0' : '#e2e8f0'}`,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isAccounted ? '#059669' : '#94a3b8',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 4px',
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {isAccounted ? '✓' : '4'}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isAccounted ? '#065f46' : '#64748b' }}>Accountability</div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>
                  {isAccounted ? 'Verified Closed' : '72h Retiral Window'}
                </div>
              </div>
            </div>
          </div>

          {/* Executive Governance Parameters Grid (6 Cells) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={gridCard}>
              <span style={gridCardLabel}>
                <User size={11} style={{ marginRight: 4 }} /> REQUESTER PROFILE
              </span>
              <strong style={gridCardValue}>{request.requester.legalName}</strong>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                Role: <span style={{ fontWeight: 700, color: '#0f172a' }}>{request.requester.role.replaceAll('_', ' ')}</span>
              </span>
            </div>

            <div style={gridCard}>
              <span style={gridCardLabel}>
                <Building2 size={11} style={{ marginRight: 4 }} /> BENEFICIARY / VENDOR
              </span>
              <strong style={gridCardValue}>
                {request.vendor?.name || 'Direct Employee Disbursement'}
              </strong>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                {request.vendor ? 'Corporate Vendor Account' : 'Internal Staff Account'}
              </span>
            </div>

            <div style={gridCard}>
              <span style={gridCardLabel}>
                <Calendar size={11} style={{ marginRight: 4 }} /> RENEWAL FREQUENCY
              </span>
              <strong style={gridCardValue}>{cadenceText} Cadence</strong>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                Cycle: <strong style={{ color: '#059669' }}>Automated Requisition</strong>
              </span>
            </div>

            <div style={gridCard}>
              <span style={gridCardLabel}>
                <FileText size={11} style={{ marginRight: 4 }} /> BUDGET LINE MAPPING
              </span>
              <strong style={gridCardValue}>{request.category}</strong>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                Cost Center: <strong style={{ color: '#0f172a' }}>Operational Expenses (OPEX)</strong>
              </span>
            </div>

            <div style={gridCard}>
              <span style={gridCardLabel}>
                <ShieldCheck size={11} style={{ marginRight: 4 }} /> RETIRAL ACCOUNTABILITY
              </span>
              <strong style={gridCardValue}>72-Hour Verification</strong>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                Status: <strong style={{ color: '#ea580c' }}>Pending Disbursement</strong>
              </span>
            </div>

            <div style={gridCard}>
              <span style={gridCardLabel}>
                <ShieldAlert size={11} style={{ marginRight: 4 }} /> ESCALATION THRESHOLD
              </span>
              <strong style={gridCardValue}>BUD-05 Governance</strong>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                Level: <strong style={{ color: '#0f172a' }}>Executive GMD Direct</strong>
              </span>
            </div>
          </div>

          {/* Operational Justification & Expected Deliverables */}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                OPERATIONAL JUSTIFICATION
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.5 }}>
                {request.justification || 'No operational justification recorded for this recurring commitment.'}
              </p>
            </div>

            {request.deliverable && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fef3c7' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', marginBottom: 4 }}>
                  EXPECTED PROOF / RETIRAL DELIVERABLE
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                  {request.deliverable}
                </p>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <a
              href={`/requests/${request.requestNumber}`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--brand-gradient, var(--brand-primary, #0d8a70))',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px var(--brand-shadow-color, rgba(13, 138, 112, 0.25))',
              }}
            >
              <ExternalLink size={14} /> Open Full Dossier
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

const gridCard: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 10,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: 68,
};

const gridCardLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
};

const gridCardValue: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#0f172a',
  margin: '4px 0 2px',
};
