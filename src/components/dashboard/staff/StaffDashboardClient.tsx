'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  Upload,
  Building,
  Receipt,
  Check,
  ShieldCheck,
  HelpCircle,
  MessageSquare,
  Search,
  Filter,
  CheckSquare,
  XCircle,
  ExternalLink,
  ChevronRight,
  Send,
  Zap,
} from 'lucide-react';

interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeNumber?: string;
  phone?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
}

interface DisbursementItem {
  id: string;
  amountMinor: number;
  amountFormatted: string;
  bankName: string;
  accountNumber?: string;
  externalReference: string;
  status: string;
  paidAt: string;
  confirmed: boolean;
  request?: {
    id: string;
    requestNumber: string;
    title: string;
    category: string;
    amountMinor: number;
    amountFormatted: string;
    deliverable?: string;
  } | null;
}

interface RequestItem {
  id: string;
  requestNumber: string;
  title: string;
  category: string;
  amountMinor: number;
  currency?: string;
  approvalStatus: string;
  paymentStatus: string;
  accountabilityStatus: string;
  createdAt: string;
  justification?: string;
  requestedById?: string;
  approvalSteps?: Array<{
    id: string;
    stageIndex: number;
    status: string;
    approverRole?: string;
  }>;
}

interface AccountabilityItem {
  id: string;
  requestId: string;
  ownerUserId: string;
  status: string;
  dueAt: string;
  requiredDeliverables?: string;
  request?: {
    id: string;
    requestNumber: string;
    title: string;
    amountMinor: number;
  };
}

interface StaffDashboardClientProps {
  user: StaffUser;
  businessName?: string;
}

export function StaffDashboardClient({ user, businessName = 'BEMS Group' }: StaffDashboardClientProps) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [cases, setCases] = useState<AccountabilityItem[]>([]);
  const [disbursementsAwaiting, setDisbursementsAwaiting] = useState<DisbursementItem[]>([]);
  const [allDisbursements, setAllDisbursements] = useState<DisbursementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PAID' | 'CLOSED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Maker-Checker confirmation state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [issueModalDisbursement, setIssueModalDisbursement] = useState<DisbursementItem | null>(null);
  const [issueDecision, setIssueDecision] = useState<'NOT_RECEIVED' | 'AMOUNT_MISMATCH'>('NOT_RECEIVED');
  const [issueNote, setIssueNote] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Load live data from staff endpoints
  const loadStaffData = async () => {
    try {
      setLoading(true);
      const [reqRes, caseRes, disbRes] = await Promise.all([
        fetch('/api/requests').then((r) => (r.ok ? r.json() : { requests: [] })),
        fetch('/api/accountability').then((r) => (r.ok ? r.json() : { cases: [] })),
        fetch('/api/staff/disbursements').then((r) => (r.ok ? r.json() : { awaitingConfirmation: [], recentDisbursements: [] })),
      ]);

      const rawRequests = Array.isArray(reqRes) ? reqRes : (reqRes?.requests || []);
      const myRequests = rawRequests.filter(
        (r: any) =>
          r.requestedById === user.id ||
          r.requester?.workEmail?.toLowerCase() === user.email.toLowerCase() ||
          !r.requestedById // fallback if dev role
      );
      setRequests(myRequests);

      const rawCases = Array.isArray(caseRes) ? caseRes : (caseRes?.cases || []);
      const myCases = rawCases.filter(
        (c: any) =>
          c.ownerUserId === user.id ||
          c.owner?.workEmail?.toLowerCase() === user.email.toLowerCase() ||
          c.request?.requestedById === user.id
      );
      setCases(myCases);

      setDisbursementsAwaiting(disbRes.awaitingConfirmation || []);
      setAllDisbursements(disbRes.recentDisbursements || []);
    } catch (err) {
      console.error('Failed to load staff dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, [user.id, user.email]);

  const firstName = user.fullName ? user.fullName.split(' ')[0] : 'Staff Member';

  const formatNaira = (minor: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(minor / 100);
  };

  // Confirm receipt of funds (Maker-Checker)
  const handleConfirmReceived = async (disbursementId: string) => {
    setConfirmingId(disbursementId);
    try {
      const res = await fetch('/api/disbursements/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disbursementId,
          decision: 'RECEIVED',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to confirm payment receipt');
      }

      setNotice('✓ Payment receipt successfully confirmed! 72-Hour Evidence Window activated.');
      await loadStaffData();
    } catch (err: any) {
      alert(err.message || 'Error confirming payment');
    } finally {
      setConfirmingId(null);
    }
  };

  // Submit issue with disbursement
  const handleSubmitIssue = async () => {
    if (!issueModalDisbursement) return;
    if (!issueNote.trim()) {
      alert('Please provide a short explanation for Finance.');
      return;
    }

    setSubmittingIssue(true);
    try {
      const res = await fetch('/api/disbursements/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disbursementId: issueModalDisbursement.id,
          decision: issueDecision,
          note: issueNote.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit payment issue');
      }

      setNotice('Payment issue reported to Finance & Audit team for investigation.');
      setIssueModalDisbursement(null);
      setIssueNote('');
      await loadStaffData();
    } catch (err: any) {
      alert(err.message || 'Error reporting issue');
    } finally {
      setSubmittingIssue(false);
    }
  };

  // Metrics calculations
  const pendingRequests = requests.filter((r) =>
    ['SUBMITTED', 'IN_REVIEW', 'PENDING'].includes(r.approvalStatus)
  );
  const approvedRequests = requests.filter(
    (r) => r.approvalStatus === 'APPROVED' && r.paymentStatus !== 'PAID'
  );
  const activeUnretiredCases = cases.filter((c) => c.status !== 'CLOSED');

  // Compute 72h SLA nearest deadline
  const nearestAdvance = useMemo(() => {
    if (activeUnretiredCases.length === 0) return null;
    const sorted = [...activeUnretiredCases].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    );
    const closest = sorted[0];
    const diffMs = new Date(closest.dueAt).getTime() - Date.now();
    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const isOverdue = diffMs < 0;

    return {
      case: closest,
      hoursLeft,
      minsLeft,
      isOverdue,
      timeString: isOverdue
        ? `Overdue by ${Math.abs(hoursLeft)}h ${Math.abs(minsLeft)}m`
        : `${hoursLeft}h ${minsLeft}m remaining`,
    };
  }, [activeUnretiredCases]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Tab filter
      if (activeTab === 'PENDING') {
        if (!['SUBMITTED', 'IN_REVIEW', 'PENDING'].includes(r.approvalStatus)) return false;
      } else if (activeTab === 'APPROVED') {
        if (r.approvalStatus !== 'APPROVED') return false;
      } else if (activeTab === 'PAID') {
        if (r.paymentStatus !== 'PAID' && r.paymentStatus !== 'RECIPIENT_CONFIRMED') return false;
      } else if (activeTab === 'CLOSED') {
        if (r.accountabilityStatus !== 'CLOSED' && r.approvalStatus !== 'REJECTED') return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(query);
        const matchesNum = (r.requestNumber || '').toLowerCase().includes(query);
        const matchesCat = (r.category || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesNum && !matchesCat) return false;
      }

      return true;
    });
  }, [requests, activeTab, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {notice && (
        <div
          style={{
            background: '#064e3b',
            color: '#a7f3d0',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '13.5px',
            fontWeight: '600',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 14px rgba(6, 78, 59, 0.25)',
          }}
        >
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: 'transparent', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontSize: '18px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Top Banner / Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '20px',
          padding: '28px 32px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'rgba(234, 88, 12, 0.2)',
                color: '#f97316',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(234, 88, 12, 0.4)',
              }}
            >
              STAFF REQUISITION & EVIDENCE PORTAL
            </span>
            {user.employeeNumber && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.06)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                }}
              >
                ID: {user.employeeNumber}
              </span>
            )}
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '4px 10px',
                borderRadius: '8px',
              }}
            >
              {businessName}
            </span>
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: '850', margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
            Welcome back, {firstName}.
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '14px', maxWidth: '640px', lineHeight: 1.5 }}>
            Submit fund requests, confirm bank disbursement receipts, and retire cash advances within the mandatory 72-hour group SLA window.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/accountability"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '11px 18px',
              fontSize: '13.5px',
              fontWeight: '700',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Upload size={16} /> 72h Evidence Vault
          </Link>

          <Link
            href="/requests/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '11px 20px',
              fontSize: '13.5px',
              fontWeight: '700',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(234, 88, 12, 0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={16} /> New Fund Request
          </Link>
        </div>
      </div>

      {/* Maker-Checker: Incoming Bank Payments Awaiting Confirmation */}
      {disbursementsAwaiting.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, #fff7ed 0%, #ffedd5 100%)',
            border: '2px solid #ea580c',
            borderRadius: '18px',
            padding: '20px 24px',
            boxShadow: '0 4px 16px rgba(234, 88, 12, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <strong style={{ color: '#9a3412', fontSize: '15px', display: 'block' }}>
                Action Required: Bank Payment Awaiting Your Confirmation (Maker-Checker)
              </strong>
              <span style={{ color: '#c2410c', fontSize: '13px' }}>
                Finance has recorded a bank transfer to your account. Confirm funds have arrived to start your 72h evidence window.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {disbursementsAwaiting.map((disb) => (
              <div
                key={disb.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  border: '1px solid #fed7aa',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#ea580c', fontFamily: 'monospace' }}>
                      {disb.request?.requestNumber || 'ADVANCE'}
                    </span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      {disb.request?.title || 'Operational Advance'}
                    </strong>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                    Sent via <strong>{disb.bankName}</strong> · Ref: <span style={{ fontFamily: 'monospace' }}>{disb.externalReference}</span> · Date: {new Date(disb.paidAt).toLocaleDateString('en-GB')}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>
                      {disb.amountFormatted}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: '700' }}>
                      Ready for Confirmation
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleConfirmReceived(disb.id)}
                      disabled={confirmingId === disb.id}
                      style={{
                        background: '#15803d',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Check size={14} />
                      {confirmingId === disb.id ? 'Confirming…' : 'I Received Funds'}
                    </button>

                    <button
                      onClick={() => {
                        setIssueModalDisbursement(disb);
                        setIssueDecision('NOT_RECEIVED');
                        setIssueNote('');
                      }}
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Report Issue
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 72-Hour Evidence Window SLA Warning Banner */}
      {nearestAdvance && (
        <div
          style={{
            background: nearestAdvance.isOverdue
              ? 'linear-gradient(90deg, #fef2f2 0%, #fee2e2 100%)'
              : 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%)',
            border: nearestAdvance.isOverdue ? '2px solid #ef4444' : '1.5px solid #f59e0b',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: nearestAdvance.isOverdue ? '#ef4444' : '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <strong style={{ color: nearestAdvance.isOverdue ? '#991b1b' : '#92400e', fontSize: '14px', display: 'block' }}>
                {nearestAdvance.isOverdue ? '⚠️ 72-Hour Advance Evidence Window OVERDUE' : 'Active Cash Advance: 72-Hour Evidence Clock Running'}
              </strong>
              <span style={{ color: nearestAdvance.isOverdue ? '#b91c1c' : '#b45309', fontSize: '13px' }}>
                Request <strong>{nearestAdvance.case.request?.requestNumber || 'ADVANCE'}</strong>: {nearestAdvance.timeString}. Group policy requires all receipts and invoices uploaded to avoid requisition freezes.
              </span>
            </div>
          </div>

          <Link
            href="/accountability"
            style={{
              background: nearestAdvance.isOverdue ? '#b91c1c' : '#92400e',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: '700',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Upload Receipts Now →
          </Link>
        </div>
      )}

      {/* KPI Bento Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: My Open Requisitions */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '22px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              My Open Requisitions
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ffedd5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ea580c',
              }}
            >
              <FileText size={16} />
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
              {pendingRequests.length}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              {pendingRequests.length === 0 ? 'All requests processed' : `${pendingRequests.length} in approval ladder`}
            </div>
          </div>
        </div>

        {/* Card 2: 72h Advance Compliance */}
        <div
          style={{
            background: activeUnretiredCases.length > 0 ? '#fff7ed' : '#ffffff',
            borderRadius: '18px',
            padding: '22px',
            border: activeUnretiredCases.length > 0 ? '1px solid #fed7aa' : '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: activeUnretiredCases.length > 0 ? '#c2410c' : '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              72h Advance Status
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: activeUnretiredCases.length > 0 ? '#fdba74' : '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeUnretiredCases.length > 0 ? '#9a3412' : '#15803d',
              }}
            >
              {activeUnretiredCases.length > 0 ? <Clock size={16} /> : <ShieldCheck size={16} />}
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div
              style={{
                fontSize: '32px',
                fontWeight: '900',
                color: activeUnretiredCases.length > 0 ? '#ea580c' : '#10b981',
                lineHeight: 1,
              }}
            >
              {activeUnretiredCases.length > 0 ? `${activeUnretiredCases.length} Pending` : '100%'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              {activeUnretiredCases.length > 0 ? 'Receipts pending upload' : 'All cash advances fully retired'}
            </div>
          </div>
        </div>

        {/* Card 3: Ready for Payout */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '22px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Approved / Ready for Payout
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
              {approvedRequests.length}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              {approvedRequests.length === 0 ? 'No requests awaiting payout' : 'Queued on Treasury disbursement desk'}
            </div>
          </div>
        </div>

        {/* Card 4: Lifetime Requisitions */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '22px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Lifetime Requests
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
              }}
            >
              <Receipt size={16} />
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
              {requests.length}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Total requisitions submitted on record
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Requisitions Table (Left) & Support / Channels (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)', gap: '20px' }}>
        {/* Left Column: Requisitions Explorer */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          }}
        >
          {/* Table Header & Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: '850', color: '#0f172a', margin: 0 }}>
                My Fund Requisitions
              </h2>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                Track approval stage progression and disbursement status in real time.
              </p>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search requisitions…"
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'ALL', label: 'All Requests', count: requests.length },
              { id: 'PENDING', label: 'In Review', count: pendingRequests.length },
              { id: 'APPROVED', label: 'Approved', count: approvedRequests.length },
              { id: 'PAID', label: 'Disbursed', count: requests.filter((r) => r.paymentStatus === 'PAID').length },
              { id: 'CLOSED', label: 'Completed', count: requests.filter((r) => r.accountabilityStatus === 'CLOSED').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: activeTab === tab.id ? '1px solid #ea580c' : '1px solid #e2e8f0',
                  background: activeTab === tab.id ? '#fff7ed' : '#f8fafc',
                  color: activeTab === tab.id ? '#ea580c' : '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    background: activeTab === tab.id ? '#ea580c' : '#cbd5e1',
                    color: '#ffffff',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '10.5px',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Requests Content */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Loading your requisitions…
            </div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
              <FileText size={40} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>No requisitions match your filter</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                Create a new fund request to request advances, petty cash, or vendor payments.
              </div>
              <Link
                href="/requests/new"
                style={{
                  display: 'inline-block',
                  marginTop: '16px',
                  background: '#ea580c',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  textDecoration: 'none',
                }}
              >
                + Create New Request
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredRequests.map((req) => {
                const isApproved = req.approvalStatus === 'APPROVED';
                const isRejected = req.approvalStatus === 'REJECTED';
                const isPaid = req.paymentStatus === 'PAID';

                return (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      background: '#f8fafc',
                      borderRadius: '14px',
                      border: '1px solid #f1f5f9',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ maxWidth: '65%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#ea580c', fontFamily: 'monospace' }}>
                          {req.requestNumber || 'REQ'}
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: '750', color: '#0f172a' }}>
                          {req.title}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{req.category || 'General Requisition'}</span>
                        <span>•</span>
                        <span>{new Date(req.createdAt).toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '850', color: '#0f172a' }}>
                        {formatNaira(req.amountMinor || 0)}
                      </div>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: isPaid ? '#dcfce7' : isApproved ? '#e0f2fe' : isRejected ? '#fee2e2' : '#fef3c7',
                          color: isPaid ? '#15803d' : isApproved ? '#0369a1' : isRejected ? '#b91c1c' : '#b45309',
                        }}
                      >
                        {isPaid ? 'PAID & DISBURSED' : req.approvalStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Channels, Vendor Registry & Policies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* WhatsApp / Slack Notification Bridge Card (Workspace Rule) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '22px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a',
                }}
              >
                <MessageSquare size={16} />
              </div>
              <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                WhatsApp & Slack Notification Bridge
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.5 }}>
              Receive real-time notifications when your fund requests are approved or disbursed to your commercial bank account.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>WhatsApp Requisition Bot</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {user.phone ? `Linked: ${user.phone}` : 'Active (+234 Bot Dispatcher)'}
                  </span>
                </div>
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10.5px',
                    fontWeight: '800',
                  }}
                >
                  CONNECTED
                </span>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>Slack Executive Sync</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>#requisitions-{businessName.toLowerCase().replace(/\s+/g, '-')}</span>
                </div>
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10.5px',
                    fontWeight: '800',
                  }}
                >
                  LIVE
                </span>
              </div>
            </div>
          </div>

          {/* Vendor Registry & 3-Way Matching Quick Reference (Workspace Rule) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '22px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={16} color="#ea580c" />
                <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Vendor Registry & 3-Way Match
                </h3>
              </div>
              <Link
                href="/vendors"
                style={{ fontSize: '12px', fontWeight: '700', color: '#ea580c', textDecoration: 'none' }}
              >
                Directory →
              </Link>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.5 }}>
              All third-party procurement requires matching a verified Purchase Order, physical Goods Receipt Note (GRN), and final Vendor Invoice.
            </p>
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                fontSize: '11.5px',
                color: '#475569',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div><strong>1. PO Issued:</strong> Authorized requisition number</div>
              <div><strong>2. Delivery:</strong> Physical goods receipt verified by Store</div>
              <div><strong>3. Payment:</strong> Direct transfer to registered corporate bank</div>
            </div>
          </div>

          {/* Group 72h Compliance Policy Card */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '800', fontSize: '13px' }}>
              <HelpCircle size={16} color="#ea580c" />
              BEMS 72-Hour Evidence Policy
            </div>
            <ul style={{ margin: '10px 0 0 0', paddingLeft: '18px', fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
              <li>Advance retirements require verifiable invoices, receipts, or waybills.</li>
              <li>Requisitions follow the 5-tier review matrix (HOD → Verifier → Finance → GMD).</li>
              <li>New requests are frozen if an advance is overdue beyond 72 hours.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal: Report Issue with Disbursement */}
      {issueModalDisbursement && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <strong style={{ fontSize: '16px', color: '#0f172a' }}>Report Payment Issue</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  {issueModalDisbursement.request?.requestNumber} · {issueModalDisbursement.amountFormatted}
                </p>
              </div>
              <button
                onClick={() => setIssueModalDisbursement(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Issue Type
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIssueDecision('NOT_RECEIVED')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      border: issueDecision === 'NOT_RECEIVED' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                      background: issueDecision === 'NOT_RECEIVED' ? '#fff7ed' : '#f8fafc',
                      color: issueDecision === 'NOT_RECEIVED' ? '#ea580c' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Funds Not Arrived
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueDecision('AMOUNT_MISMATCH')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      border: issueDecision === 'AMOUNT_MISMATCH' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                      background: issueDecision === 'AMOUNT_MISMATCH' ? '#fff7ed' : '#f8fafc',
                      color: issueDecision === 'AMOUNT_MISMATCH' ? '#ea580c' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Amount Mismatch
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Explanation for Finance Desk
                </label>
                <textarea
                  value={issueNote}
                  onChange={(e) => setIssueNote(e.target.value)}
                  placeholder="e.g. Bank statement checked at 10am; credit alert not yet received."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIssueModalDisbursement(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitIssue}
                  disabled={submittingIssue}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {submittingIssue ? 'Submitting…' : 'Submit Issue to Finance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
