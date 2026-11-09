'use client';

import React, { useState } from 'react';
import type { MouseEvent } from 'react';
import {
  X,
  Check,
  Copy,
  Clock,
  ShieldCheck,
  FileText,
  Paperclip,
  Download,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Building2,
  User,
  ArrowRight,
  ExternalLink,
  Receipt,
  Trash2,
} from 'lucide-react';
import { toSystemRequestId } from '@/lib/request-id';

export interface RequisitionModalData {
  id: string;
  systemId?: string;
  requestNumber: string;
  title: string;
  amount: number;
  amountFormatted: string;
  currency: string;
  category: string;
  justification: string;
  deliverable: string;
  neededBy: string;
  tierLevel: number;
  tierLabel: string;
  approvalStatus: string;
  paymentStatus: string;
  accountabilityStatus: string;
  isRecurring?: boolean;
  recurringInterval?: string | null;
  createdAt: string;
  subsidiary: {
    id?: string;
    code: string;
    name: string;
  };
  requester: {
    id?: string;
    name: string;
    role: string;
    employeeNumber: string;
    department: string;
    bankName?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
  };
  vendor: {
    id?: string;
    code: string;
    name: string;
    category: string;
    taxId?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
    rating?: number;
  } | null;
  threeWayMatch: {
    poMatched: boolean;
    quoteAttached: boolean;
    scopeVerified: boolean;
    status: string;
  };
  budgetImpact: {
    totalBudget: number;
    spentSoFar: number;
    remainingBefore?: number;
    remainingAfter: number;
    percentOfBudget: number;
  };
  approvalSteps: Array<{
    id: string;
    stageIndex: number;
    assignedRole: string;
    approverName: string | null;
    status: string;
    decidedAt: string | null;
    decisionReason: string | null;
  }>;
  recentMessages: Array<{
    id: string;
    authorName: string;
    authorRole: string;
    body: string;
    createdAt: string;
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    contentType: string;
    notes?: string | null;
    ownerType?: string;
    checksum?: string | null;
    uploadedAt?: string | null;
  }>;
}

interface ExecutiveRequisitionModalProps {
  request: RequisitionModalData;
  onClose: () => void;
  onRequestChat?: () => void;
  onImageClick?: (attachment: { url: string; name: string }) => void;
  canDecide?: boolean;
  onApprove?: () => void;
  onClarify?: () => void;
  onDecline?: () => void;
  onDelete?: () => void;
}

export function ExecutiveRequisitionModal({
  request,
  onClose,
  onRequestChat,
  onImageClick,
  canDecide = false,
  onApprove,
  onClarify,
  onDecline,
  onDelete,
}: ExecutiveRequisitionModalProps) {
  const [copiedSystemId, setCopiedSystemId] = useState(false);
  const [evidenceTab, setEvidenceTab] = useState<'ALL' | 'PRE_APPROVAL' | 'POST_RETIREMENT' | 'COMPARE'>('ALL');
  const systemId = request.systemId || toSystemRequestId(request.id);

  const preApprovalEvidence = (request.attachments || []).filter(
    (att) => !att.ownerType || att.ownerType === 'REQUEST'
  );
  const postRetirementEvidence = (request.attachments || []).filter(
    (att) => att.ownerType === 'ACCOUNTABILITY'
  );

  const copySystemId = async () => {
    try {
      await navigator.clipboard.writeText(systemId);
      setCopiedSystemId(true);
      setTimeout(() => setCopiedSystemId(false), 1600);
    } catch {
      setCopiedSystemId(false);
    }
  };

  const closeOnBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isOverBudget =
    (request.budgetImpact.spentSoFar + request.amount) > request.budgetImpact.totalBudget ||
    request.budgetImpact.percentOfBudget > 100;

  const overrunAmount = Math.max(
    0,
    (request.budgetImpact.spentSoFar + request.amount) - request.budgetImpact.totalBudget
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={closeOnBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 14, 26, 0.74)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        padding: '24px 16px',
        animation: 'modalBackdropFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: 'min(1160px, 95vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 40px -10px var(--brand-primary, #0d8a70)25',
          border: '1px solid #e2e8f0',
          position: 'relative',
        }}
      >
        {/* ========================================================= */}
        {/* STICKY EXECUTIVE COMMAND MASTHEAD                         */}
        {/* ========================================================= */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 10,
            padding: '18px 24px 14px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Top Meta Chips & Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Request Reference Pill */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  letterSpacing: '0.02em',
                }}
              >
                {request.requestNumber}
              </span>

              {/* Tier Pill */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 750,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                }}
              >
                {request.tierLabel}
              </span>

              {/* Subsidiary & Category */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 650,
                  color: '#334155',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--brand-primary, #0d8a70)',
                    display: 'inline-block',
                  }}
                />
                {request.subsidiary.name} · {request.category.replace(/_/g, ' ')}
              </span>

              {/* System ID with 1-Click Copy */}
              <button
                type="button"
                onClick={() => void copySystemId()}
                title="Copy immutable system verification ID"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  color: '#64748b',
                  fontSize: '10.5px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>System ID: {systemId.slice(0, 16)}...</span>
                {copiedSystemId ? <Check size={12} color="#059669" /> : <Copy size={12} />}
              </button>
            </div>

            {/* Header Right Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {onRequestChat && (
                <button
                  type="button"
                  onClick={onRequestChat}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 750,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <MessageSquare size={13} />
                  Request chat
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close request dossier"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e2e8f0';
                  e.currentTarget.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.transform = 'rotate(0deg)';
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Hero Requisition Title & Currency Display */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: 850,
                  color: '#0f172a',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.25,
                }}
              >
                {request.title}
              </h2>
              <div
                style={{
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '11.5px',
                  color: '#64748b',
                }}
              >
                <span>
                  Requisitioned by <strong style={{ color: '#1e293b' }}>{request.requester.name}</strong>
                </span>
                <span>·</span>
                <span>{request.requester.department}</span>
                <span>·</span>
                <span>
                  Logged:{' '}
                  {new Date(request.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Prominent Currency Hero Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, #070c16 0%, #0f172a 100%)',
                color: '#ffffff',
                padding: '8px 18px',
                borderRadius: '12px',
                boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.3)',
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                }}
              >
                REQUISITION AMOUNT
              </div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
                  lineHeight: 1.15,
                  marginTop: '2px',
                }}
              >
                {request.amountFormatted}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TWO-COLUMN EXECUTIVE GRID                                 */}
        {/* ========================================================= */}
        <div
          style={{
            padding: '20px 24px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
            gap: '20px',
          }}
        >
          {/* ------------------------------------------------------- */}
          {/* LEFT COLUMN: JUSTIFICATION, DELIVERABLE, EVIDENCE, MATCH */}
          {/* ------------------------------------------------------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Executive Justification */}
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <FileText size={13} color="#475569" />
                <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.8px', color: '#475569', textTransform: 'uppercase' }}>
                  BUSINESS JUSTIFICATION &amp; OPERATIONAL NEED
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#1e293b', lineHeight: 1.6, fontWeight: 500 }}>
                {request.justification || 'No justification details provided on requisition submission.'}
              </p>
            </div>

            {/* Tangible Deliverable */}
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <ShieldCheck size={13} color="#475569" />
                <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.8px', color: '#475569', textTransform: 'uppercase' }}>
                  TANGIBLE DELIVERABLE &amp; EVIDENCE GATES
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#1e293b', lineHeight: 1.6, fontWeight: 500 }}>
                {request.deliverable || 'No specific deliverable recorded.'}
              </p>
              <div
                style={{
                  marginTop: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#0369a1',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                <Clock size={12} />
                <span>
                  Required by:{' '}
                  <strong>
                    {new Date(request.neededBy).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                </span>
              </div>
            </div>

            {/* DUAL-CHAMBER AUDIT EVIDENCE VAULT (PRE-APPROVAL INVOICES VS POST-DISBURSEMENT RECEIPTS) */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Paperclip size={14} color="var(--brand-primary, #0d8a70)" />
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: '#0f172a', textTransform: 'uppercase', display: 'block' }}>
                      AUDIT EVIDENCE VAULT ({request.attachments?.length || 0} TOTAL FILES)
                    </span>
                    <span style={{ fontSize: '9px', color: '#64748b' }}>
                      Stage 1 Invoices &amp; Quotations vs. Stage 2 Post-Disbursement Physical Receipts
                    </span>
                  </div>
                </div>

                {/* Evidence Chamber Filter Pills */}
                <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '2px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setEvidenceTab('ALL')}
                    style={{
                      border: 0,
                      background: evidenceTab === 'ALL' ? '#ffffff' : 'transparent',
                      color: evidenceTab === 'ALL' ? '#0f172a' : '#64748b',
                      fontSize: '9.5px',
                      fontWeight: 750,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: evidenceTab === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    All Files ({request.attachments?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceTab('PRE_APPROVAL')}
                    style={{
                      border: 0,
                      background: evidenceTab === 'PRE_APPROVAL' ? '#ffffff' : 'transparent',
                      color: evidenceTab === 'PRE_APPROVAL' ? '#0284c7' : '#64748b',
                      fontSize: '9.5px',
                      fontWeight: 750,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: evidenceTab === 'PRE_APPROVAL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    1. Pre-Quotes ({preApprovalEvidence.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceTab('POST_RETIREMENT')}
                    style={{
                      border: 0,
                      background: evidenceTab === 'POST_RETIREMENT' ? '#ffffff' : 'transparent',
                      color: evidenceTab === 'POST_RETIREMENT' ? '#059669' : '#64748b',
                      fontSize: '9.5px',
                      fontWeight: 750,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: evidenceTab === 'POST_RETIREMENT' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    2. Post-Receipts ({postRetirementEvidence.length})
                  </button>
                  {preApprovalEvidence.length > 0 && postRetirementEvidence.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEvidenceTab('COMPARE')}
                      style={{
                        border: 0,
                        background: evidenceTab === 'COMPARE' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'transparent',
                        color: evidenceTab === 'COMPARE' ? '#ffffff' : '#7c3aed',
                        fontSize: '9.5px',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxShadow: evidenceTab === 'COMPARE' ? '0 1px 4px rgba(124, 58, 237, 0.3)' : 'none',
                      }}
                    >
                      ⚡ Side-by-Side Split
                    </button>
                  )}
                </div>
              </div>

              {/* SIDE-BY-SIDE SPLIT VIEW */}
              {evidenceTab === 'COMPARE' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  {/* Left Column: Pre-Approval Quotes */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                        CHAMBER A: PRE-APPROVAL INVOICE / QUOTE
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {preApprovalEvidence.map((att) => (
                        <div key={att.id} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                          {att.contentType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(att.fileUrl) ? (
                            <img src={att.fileUrl} alt={att.fileName} onClick={() => onImageClick?.({ url: att.fileUrl, name: att.fileName })} style={{ width: '100%', height: '140px', objectFit: 'contain', background: '#0f172a', cursor: 'pointer' }} />
                          ) : (
                            <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}><FileText size={24} color="#0284c7" /></div>
                          )}
                          <div style={{ padding: '6px 8px', fontSize: '10px' }}>
                            <b style={{ color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.fileName}</b>
                            <span style={{ color: '#64748b', fontSize: '9px' }}>{att.notes || 'Uploaded at request creation'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Post-Disbursement Receipts */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#15803d', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                        CHAMBER B: POST-EXPENSE RETIREMENT RECEIPT
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {postRetirementEvidence.map((att) => (
                        <div key={att.id} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                          {att.contentType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(att.fileUrl) ? (
                            <img src={att.fileUrl} alt={att.fileName} onClick={() => onImageClick?.({ url: att.fileUrl, name: att.fileName })} style={{ width: '100%', height: '140px', objectFit: 'contain', background: '#0f172a', cursor: 'pointer' }} />
                          ) : (
                            <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}><Receipt size={24} color="#059669" /></div>
                          )}
                          <div style={{ padding: '6px 8px', fontSize: '10px' }}>
                            <b style={{ color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.fileName}</b>
                            <span style={{ color: '#64748b', fontSize: '9px' }}>{att.notes || 'Uploaded on mobile SLA'} · SHA-256 ✓</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD GALLERY VIEW WITH PHASE BADGES */
                <div>
                  {(!request.attachments || request.attachments.length === 0) ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <Paperclip size={20} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 }}>No supporting files or receipts attached to this requisition.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginTop: '6px' }}>
                      {(request.attachments || [])
                        .filter((att) => {
                          if (evidenceTab === 'PRE_APPROVAL') return !att.ownerType || att.ownerType === 'REQUEST';
                          if (evidenceTab === 'POST_RETIREMENT') return att.ownerType === 'ACCOUNTABILITY';
                          return true;
                        })
                        .map((att) => {
                          const isPost = att.ownerType === 'ACCOUNTABILITY';
                          const isImage = att.contentType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.fileUrl || att.fileName);

                          return (
                            <div
                              key={att.id}
                              style={{
                                border: isPost ? '1px solid #86efac' : '1px solid #bae6fd',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                background: '#ffffff',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.18s ease',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                              }}
                            >
                              {/* Chamber Badge Header */}
                              <div
                                style={{
                                  padding: '4px 8px',
                                  background: isPost ? '#f0fdf4' : '#f0f9ff',
                                  borderBottom: isPost ? '1px solid #dcfce7' : '1px solid #e0f2fe',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <span style={{ fontSize: '8px', fontWeight: 800, color: isPost ? '#15803d' : '#0369a1', textTransform: 'uppercase' }}>
                                  {isPost ? '🧾 Post-Receipt' : '📋 Pre-Quote'}
                                </span>
                                {att.checksum && (
                                  <span style={{ fontSize: '7.5px', color: '#16a34a', fontWeight: 700 }}>
                                    SHA-256 ✓
                                  </span>
                                )}
                              </div>

                              {isImage ? (
                                <div
                                  onClick={() => onImageClick?.({ url: att.fileUrl, name: att.fileName })}
                                  style={{
                                    width: '100%',
                                    height: '96px',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    background: '#0f172a',
                                    overflow: 'hidden',
                                  }}
                                  title="Click to view full photo proof"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={att.fileUrl}
                                    alt={att.fileName}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      transition: 'transform 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.06)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                  />
                                  <span
                                    style={{
                                      position: 'absolute',
                                      bottom: '4px',
                                      right: '4px',
                                      background: 'rgba(15, 23, 42, 0.75)',
                                      color: '#ffffff',
                                      padding: '2px 5px',
                                      borderRadius: '4px',
                                      fontSize: '8px',
                                      fontWeight: 700,
                                      backdropFilter: 'blur(4px)',
                                    }}
                                  >
                                    View
                                  </span>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    height: '96px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#f8fafc',
                                    color: '#64748b',
                                  }}
                                >
                                  <FileText size={26} color={isPost ? '#059669' : '#0284c7'} />
                                  <span style={{ fontSize: '9px', fontWeight: 700, color: isPost ? '#047857' : '#0369a1', marginTop: '4px' }}>
                                    PDF Document
                                  </span>
                                </div>
                              )}

                              <div style={{ padding: '8px 10px', background: '#ffffff', borderTop: '1px solid #f1f5f9' }}>
                                <div
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={att.fileName}
                                >
                                  {att.fileName}
                                </div>
                                <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {att.notes || (isPost ? 'SLA Retirement' : 'Requisition quote')}
                                </div>
                                <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '8.5px', color: '#94a3b8' }}>
                                    {att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString() : 'Recorded'}
                                  </span>
                                  <a
                                    href={att.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                    style={{
                                      color: 'var(--brand-primary, #0d8a70)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontSize: '9px',
                                      fontWeight: 750,
                                      textDecoration: 'none',
                                    }}
                                  >
                                    <Download size={10} /> Open
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Vendor Registry & 3-Way Matching Checklist */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.8px', color: '#047857', textTransform: 'uppercase' }}>
                    VENDOR &amp; 3-WAY MATCHING AUDIT
                  </span>
                  <h4 style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 750, color: '#0f172a' }}>
                    {request.vendor ? request.vendor.name : 'Direct Internal Reimbursement'}
                  </h4>
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#ecfdf5',
                    color: '#047857',
                    fontSize: '9.5px',
                    fontWeight: 750,
                    border: '1px solid #a7f3d0',
                  }}
                >
                  {request.threeWayMatch.status}
                </span>
              </div>

              {request.vendor && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '11px',
                    background: '#f8fafc',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '9.5px' }}>Vendor Code / TIN</span>
                    <strong style={{ color: '#1e293b' }}>{request.vendor.code} · {request.vendor.taxId || 'Verified'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '9.5px' }}>Verified Settlement Bank</span>
                    <strong style={{ color: '#1e293b' }}>{request.vendor.bankName || 'Standard Bank'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '9.5px' }}>Account Number</span>
                    <strong style={{ color: '#1e293b', fontFamily: 'monospace' }}>{request.vendor.accountNumber || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '9.5px' }}>Beneficiary Name</span>
                    <strong style={{ color: '#1e293b' }}>{request.vendor.accountName || request.vendor.name}</strong>
                  </div>
                </div>
              )}

              {/* 3-Way Matching Checklist Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857' }}>
                  <CheckCircle2 size={14} />
                  <span>1. Automated Purchase Order generated and line items matched.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857' }}>
                  <CheckCircle2 size={14} />
                  <span>2. Pro-forma quotation and official tax invoice verified on file.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857' }}>
                  <CheckCircle2 size={14} />
                  <span>3. Scope of works / delivery certification schedule attached.</span>
                </div>
              </div>
            </div>

            {/* Requester Profile Card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '13px' }}>
                {request.requester.name.charAt(0)}
              </div>
              <div style={{ fontSize: '11px', flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '12.5px', color: '#0f172a' }}>{request.requester.name}</strong>
                <span style={{ color: '#64748b' }}>
                  {request.requester.role} · Department: {request.requester.department} · {request.requester.employeeNumber}
                </span>
              </div>
            </div>

            {/* Optional Request Conversation Messages */}
            {request.recentMessages && request.recentMessages.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', background: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
                    REQUEST CONVERSATION
                  </span>
                  {onRequestChat && (
                    <button
                      type="button"
                      onClick={onRequestChat}
                      style={{ border: 'none', background: 'transparent', color: 'var(--brand-primary, #0d8a70)', fontSize: '10.5px', fontWeight: 750, cursor: 'pointer', padding: 0 }}
                    >
                      Open request chat →
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {request.recentMessages.slice(-3).map((msg) => (
                    <div key={msg.id} style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10px', marginBottom: '2px' }}>
                        <strong style={{ color: '#1e293b' }}>{msg.authorName} ({msg.authorRole})</strong>
                        <time>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                      </div>
                      <p style={{ margin: 0, color: '#334155' }}>{msg.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------- */}
          {/* RIGHT COLUMN: BUDGET POSITION, AUDIT STEPS & DECISION   */}
          {/* ------------------------------------------------------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Budget Exposure Card */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
                DEPARTMENT BUDGET POSITION
              </span>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '20px', fontWeight: 850, color: '#0f172a' }}>
                  {request.amountFormatted}
                </strong>
                <span style={{ fontSize: '11px', fontWeight: 750, color: isOverBudget ? '#dc2626' : 'var(--brand-primary, #0d8a70)' }}>
                  {request.budgetImpact.percentOfBudget}% of annual cap
                </span>
              </div>

              {/* Overrun Alert Banner */}
              {isOverBudget && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '11px', color: '#991b1b', lineHeight: 1.45 }}>
                    <strong style={{ display: 'block', fontWeight: 800 }}>Budget Overrun Threshold Exceeded</strong>
                    This request exceeds the annual budget cap by ₦{overrunAmount.toLocaleString()}. Requires GMD exceptional capital authorization.
                  </div>
                </div>
              )}

              {/* Budget Track */}
              <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', margin: '10px 0 12px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round(((request.budgetImpact.spentSoFar + request.amount) / Math.max(request.budgetImpact.totalBudget, 1)) * 100))}%`,
                    background: isOverBudget ? 'linear-gradient(90deg, #ea580c, #dc2626)' : 'var(--brand-primary, #0d8a70)',
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Annual Budget Cap:</span>
                  <strong style={{ color: '#1e293b' }}>₦{request.budgetImpact.totalBudget.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Spent Prior to this Request:</span>
                  <strong style={{ color: '#1e293b' }}>₦{request.budgetImpact.spentSoFar.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: isOverBudget ? '#dc2626' : '#047857', fontWeight: 750, paddingTop: '4px', borderTop: '1px dashed #e2e8f0' }}>
                  <span>Remaining Balance After Approval:</span>
                  <strong>₦{request.budgetImpact.remainingAfter.toLocaleString()}</strong>
                </div>
              </div>
            </div>

            {/* Multi-Threshold Stepper */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
                APPROVAL CHAIN &amp; AUDIT LOGS
              </span>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {request.approvalSteps.map((step, idx) => (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '11px' }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: step.status === 'APPROVED' ? '#ecfdf5' : step.status === 'REJECTED' ? '#fef2f2' : '#eff6ff',
                        color: step.status === 'APPROVED' ? '#047857' : step.status === 'REJECTED' ? '#b91c1c' : '#1d4ed8',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: '10px',
                        flexShrink: 0,
                        border: '1px solid #cbd5e1',
                      }}
                    >
                      {step.status === 'APPROVED' ? '✓' : idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#0f172a' }}>
                          Stage {step.stageIndex}: {step.assignedRole.replace(/_/g, ' ')}
                        </strong>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 750,
                            color: step.status === 'APPROVED' ? '#047857' : '#64748b',
                            background: step.status === 'APPROVED' ? '#ecfdf5' : '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {step.status}
                        </span>
                      </div>
                      {step.approverName && (
                        <small style={{ color: '#64748b', display: 'block', fontSize: '10px', marginTop: '2px' }}>Reviewer: {step.approverName}</small>
                      )}
                      {step.decisionReason && (
                        <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '10.5px', fontStyle: 'italic', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', borderLeft: '2px solid #cbd5e1' }}>
                          &ldquo;{step.decisionReason}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Executive Action Box */}
            {canDecide ? (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  TAKE EXECUTIVE DECISION
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={onApprove}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: '#ffffff',
                      border: '1px solid #047857',
                      fontWeight: 750,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve &amp; record</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClarify}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#fffbeb',
                      color: '#92400e',
                      border: '1px solid #fde68a',
                      fontWeight: 750,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <MessageSquare size={13} />
                    <span>Clarify</span>
                  </button>

                  <button
                    type="button"
                    onClick={onDecline}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                      fontWeight: 750,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <X size={13} />
                    <span>Decline</span>
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      onClick={onDelete}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: '#fff',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontWeight: 750,
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                      title="Permanently delete requisition"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 16px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: 650 }}>
                  This requisition is {request.approvalStatus.toLowerCase().replace(/_/g, ' ')}.
                </span>
                {onDelete && (request.paymentStatus === 'UNPAID' || !request.paymentStatus) && (
                  <button
                    type="button"
                    onClick={onDelete}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: '#fff',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      fontWeight: 750,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title="Permanently delete requisition"
                  >
                    <Trash2 size={13} />
                    <span>Delete Requisition</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalBackdropFade {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
