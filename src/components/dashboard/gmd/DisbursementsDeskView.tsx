'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Building2,
  FileText,
  AlertTriangle,
  X,
  Plus,
  Send,
  Eye,
  Lock,
  Layers,
  Check,
  RotateCcw
} from 'lucide-react';

interface RequestItem {
  id: string;
  requestNumber: string;
  title: string;
  category: string;
  amountMinor: number;
  amountFormatted: string;
  deliverable: string;
  createdAt: string;
  subsidiary: { id: string; legalName: string; code: string };
  requester: {
    id: string;
    legalName: string;
    workEmail: string;
    role: string;
    bankName?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
    salaryBankName?: string | null;
    salaryAccountNumber?: string | null;
    salaryAccountName?: string | null;
  };
  disbursementAssignee?: { id: string; legalName: string; role: string } | null;
  canRecord?: boolean;
  vendor?: {
    id: string;
    name: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  } | null;
}

interface DisbursementItem {
  id: string;
  externalReference: string;
  bankName: string;
  beneficiaryName: string;
  beneficiaryBank: string;
  beneficiaryAccount: string;
  amountMinor: number;
  amountFormatted: string;
  status: string;
  paidAt: string;
  idempotencyKey: string;
  payerOrg: { id: string; legalName: string; code: string };
  recordedBy: { id: string; legalName: string; workEmail?: string };
  receipt?: { fileName: string; fileUrl: string; sha256: string } | null;
  verification?: {
    decision: string;
    supportingReference?: string;
    reason?: string;
    verifiedAt: string;
    verifier: { legalName: string; role: string };
  } | null;
  recipientConfirmation?: {
    decision: string;
    note?: string | null;
    confirmedAt: string;
    employee: { id: string; legalName: string; role?: string };
  } | null;
  request?: RequestItem | null;
}

interface SummaryData {
  pendingPayoutTotalFormatted: string;
  awaitingConfirmationTotalFormatted: string;
  totalDisbursedFormatted: string;
  pendingCount: number;
  awaitingCount: number;
  verifiedCount: number;
}

export function DisbursementsDeskView({
  businessName,
  userName,
  scope,
  businessId,
  businessCode,
  onNavigate,
  onSelectBusiness,
  requestToRecordId,
  onRequestToRecordOpened,
}: {
  businessName: string;
  userName: string;
  scope?: string;
  businessId?: string;
  businessCode?: string;
  onNavigate?: (view: string) => void;
  onSelectBusiness?: (id: string) => void;
  requestToRecordId?: string | null;
  onRequestToRecordOpened?: () => void;
}) {
  const [readyRequests, setReadyRequests] = useState<RequestItem[]>([]);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<DisbursementItem[]>([]);
  const [verifiedDisbursements, setVerifiedDisbursements] = useState<DisbursementItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    pendingPayoutTotalFormatted: '₦0',
    awaitingConfirmationTotalFormatted: '₦0',
    totalDisbursedFormatted: '₦0',
    pendingCount: 0,
    awaitingCount: 0,
    verifiedCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'AWAITING_TRANSFER' | 'AWAITING_CONFIRMATION' | 'CLEARED'>('AWAITING_TRANSFER');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Maker Recording Modal State
  const [makerModalOpen, setMakerModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [availableBanks, setAvailableBanks] = useState<{ id: string; bankName: string; accountNumber: string; balanceFormatted: string }[]>([]);
  const [payerBank, setPayerBank] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [makerModalError, setMakerModalError] = useState<string | null>(null);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Legacy state retained for old disbursement rows; new confirmation is completed by the requester.
  const [checkerModalOpen, setCheckerModalOpen] = useState(false);
  const [selectedDisbursement, setSelectedDisbursement] = useState<DisbursementItem | null>(null);
  const [checkerReason, setCheckerReason] = useState('');
  const [supportingRef, setSupportingRef] = useState('CBN-NIP-CONFIRMATION');
  const [verifying, setVerifying] = useState(false);

  const activeScope = scope || (businessCode && businessCode !== 'BEMS-GROUP' ? businessCode : 'ALL');

  const fetchDisbursements = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/disbursements?subsidiary=${encodeURIComponent(activeScope)}`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (data) {
        setReadyRequests(data.readyForTransfer || []);
        setAwaitingConfirmation(data.awaitingChecker || []);
        setVerifiedDisbursements(data.verifiedDisbursements || []);
        if (data.summary) setSummary({
          ...data.summary,
          awaitingConfirmationTotalFormatted: data.summary.awaitingCheckerTotalFormatted || '₦0',
        });
      }
    } catch (e: any) {
      setNotice('Failed to load disbursements data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisbursements();
    fetch(`/api/treasury?subsidiary=${encodeURIComponent(activeScope)}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && Array.isArray(d.accounts)) {
          setAvailableBanks(d.accounts);
          if (d.accounts.length > 0) {
            setPayerBank(`${d.accounts[0].bankName} (${d.accounts[0].accountNumber})`);
          }
        }
      })
      .catch(() => {});
  }, [activeScope]);

  const openMakerModal = (req: RequestItem) => {
    setSelectedRequest(req);
    const targetBank = req.requester?.bankName || req.requester?.salaryBankName || req.vendor?.bankName || '';
    const targetAccount = req.requester?.accountNumber || req.requester?.salaryAccountNumber || req.vendor?.accountNumber || '';
    const targetName = req.requester?.accountName || req.requester?.salaryAccountName || req.requester?.legalName || req.vendor?.accountName || req.vendor?.name || '';

    setBeneficiaryName(targetName);
    setBeneficiaryBank(targetBank);
    setBeneficiaryAccount(targetAccount);
    setExternalRef(`TRF-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setReceiptFile(null);
    setReceiptFileName('');
    setMakerModalError(null);
    setMakerModalOpen(true);
  };

  useEffect(() => {
    if (requestToRecordId) void fetchDisbursements();
  }, [requestToRecordId]);

  useEffect(() => {
    if (!requestToRecordId || loading) return;
    const request = readyRequests.find((item) => item.id === requestToRecordId);
    if (request) {
      openMakerModal(request);
      onRequestToRecordOpened?.();
    }
  }, [requestToRecordId, loading, readyRequests, onRequestToRecordOpened]);

  const handleRecordTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMakerModalError(null);

    if (!selectedRequest) {
      setMakerModalError('No request selected.');
      return;
    }
    if (!externalRef.trim()) {
      setMakerModalError('Please enter the bank transfer reference (e.g. TRF-2026-XXXX).');
      return;
    }

    try {
      setSubmittingTransfer(true);
      const formData = new FormData();
      formData.set('requestId', selectedRequest.id);
      formData.set('payerOrgId', selectedRequest.subsidiary.id);
      formData.set('beneficiaryName', beneficiaryName || selectedRequest.requester?.legalName || 'Beneficiary');
      formData.set('beneficiaryBank', beneficiaryBank || selectedRequest.requester?.bankName || 'Corporate Bank');
      formData.set('beneficiaryAccount', beneficiaryAccount || selectedRequest.requester?.accountNumber || '0000000000');
      formData.set('amountMinor', String(selectedRequest.amountMinor));
      formData.set('externalReference', externalRef.trim());
      formData.set('bankName', payerBank || 'Primary Corporate Operational Account');
      if (receiptFile) {
        formData.set('receipt', receiptFile);
      }

      const res = await fetch('/api/disbursements', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = result.error || 'Failed to record bank transfer.';
        setMakerModalError(errorMsg);
        setNotice(errorMsg);
        return;
      }

      setNotice(`Transfer ${externalRef} recorded successfully. The requester has been notified to confirm receipt.`);
      setMakerModalOpen(false);
      setSelectedRequest(null);
      fetchDisbursements();
      setActiveTab('AWAITING_CONFIRMATION');
    } catch (e: any) {
      const errorMsg = e.message || 'Error recording transfer.';
      setMakerModalError(errorMsg);
      setNotice(errorMsg);
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleCheckerDecision = async (decision: 'VERIFIED' | 'REJECTED') => {
    if (!selectedDisbursement) return;

    try {
      setVerifying(true);
      const res = await fetch('/api/disbursements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          disbursementId: selectedDisbursement.id,
          decision,
          reason: checkerReason.trim() || (decision === 'VERIFIED' ? 'Verified against bank transaction feed.' : 'Rejected due to mismatch.'),
          supportingReference: supportingRef.trim(),
          checkerEmail: 'gmd@bemsgroup.com'
        })
      });

      const result = await res.json();
      if (!res.ok) {
        setNotice(result.error || 'Failed to submit checker verification.');
        return;
      }

      setNotice(decision === 'VERIFIED' ? 'Disbursement verified and signed off!' : 'Disbursement rejected and returned to Maker queue.');
      setCheckerModalOpen(false);
      setSelectedDisbursement(null);
      fetchDisbursements();
    } catch (e: any) {
      setNotice('Network error submitting verification.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100%', color: '#0f172a' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            TREASURY & BANKING · PAYMENT FOLLOW-THROUGH
          </span>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '3px 0 2px', letterSpacing: '-0.3px', color: '#0f172a' }}>
            Disbursements Desk
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
            Record off-platform payments and follow up until the requesting staff member confirms receipt.
          </p>
        </div>

        <button
          onClick={fetchDisbursements}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            fontSize: '10px',
            fontWeight: 600,
            color: '#334155',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh Desk
        </button>
      </div>

      {notice && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          fontSize: '11px',
          fontWeight: 600,
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ border: 0, background: 'none', color: '#15803d', cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* TOP 4 KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          borderRadius: '10px',
          padding: '12px 14px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box',
          boxShadow: '0 8px 20px rgba(234, 88, 12, 0.22)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#fed7aa', textTransform: 'uppercase' }}>
              APPROVED READY FOR TRANSFER
            </span>
            <Wallet size={12} color="#fed7aa" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1 }}>{summary.pendingPayoutTotalFormatted}</div>
            <div style={{ fontSize: '9px', color: '#bfdbfe', marginTop: '2px' }}>{summary.pendingCount} Pending Maker Recording</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              AWAITING STAFF CONFIRMATION
            </span>
            <Clock size={12} color="#d97706" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706', lineHeight: 1.1 }}>
              {summary.awaitingConfirmationTotalFormatted}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{summary.awaitingCount} Requesters to confirm receipt</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              STAFF-CONFIRMED PAYMENTS
            </span>
            <CheckCircle2 size={12} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669', lineHeight: 1.1 }}>
              {summary.totalDisbursedFormatted}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{summary.verifiedCount} Cleared Corporate Transfers</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              DUPLICATE PROTECTION
            </span>
            <ShieldCheck size={12} color="#ea580c" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c', lineHeight: 1.1 }}>100% SHA-256</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Cryptographic Duplicate Guard</div>
          </div>
        </div>
      </div>

      {/* QUEUE TABS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '12px',
        paddingBottom: '8px'
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('AWAITING_TRANSFER')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 0,
              background: activeTab === 'AWAITING_TRANSFER' ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#f1f5f9',
              color: activeTab === 'AWAITING_TRANSFER' ? '#fff' : '#475569',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Awaiting Bank Transfer
            <span style={{
              background: activeTab === 'AWAITING_TRANSFER' ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '9px'
            }}>
              {readyRequests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('AWAITING_CONFIRMATION')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 0,
              background: activeTab === 'AWAITING_CONFIRMATION' ? '#d97706' : '#f1f5f9',
              color: activeTab === 'AWAITING_CONFIRMATION' ? '#fff' : '#475569',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Awaiting Staff Confirmation
            <span style={{
              background: activeTab === 'AWAITING_CONFIRMATION' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '9px'
            }}>
              {awaitingConfirmation.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('CLEARED')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 0,
              background: activeTab === 'CLEARED' ? '#059669' : '#f1f5f9',
              color: activeTab === 'CLEARED' ? '#fff' : '#475569',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Staff-Confirmed Payments
            <span style={{
              background: activeTab === 'CLEARED' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '9px'
            }}>
              {verifiedDisbursements.length}
            </span>
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', top: '7px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search reference, vendor or amount…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '5px 10px 5px 26px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '10px',
              width: '200px'
            }}
          />
        </div>
      </div>

      {/* TAB CONTENT */}
      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
          Loading disbursements queue…
        </div>
      ) : activeTab === 'AWAITING_TRANSFER' ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          {readyRequests.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <CheckCircle2 size={24} color="#059669" style={{ margin: '0 auto 8px' }} />
              <h4 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>All Approved Payouts Recorded</h4>
              <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>No approved requests are currently waiting for Maker bank transfer recording.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {readyRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: '#fff7ed',
                      color: '#ea580c',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0
                    }}>
                      <Wallet size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{req.requestNumber}</span>
                        <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                          {req.subsidiary.legalName}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {req.title}
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                        Beneficiary: {req.vendor?.name || req.requester.legalName} · Bank: {req.vendor?.bankName || 'Not recorded'} · Acc: {req.vendor?.accountNumber || '—'}
                      </div>
                      {req.disbursementAssignee && <div style={{ fontSize: '9px', color: '#ea580c', fontWeight: '600', marginTop: '3px' }}>Payment recording assigned to {req.disbursementAssignee.legalName}</div>}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{req.amountFormatted}</div>
                    <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', display: 'inline-block', marginTop: '3px' }}>
                      Approved · Ready to Pay
                    </span>
                  </div>

                  <button
                    onClick={() => openMakerModal(req)}
                    disabled={req.canRecord === false}
                    title={req.canRecord === false ? `Assigned to ${req.disbursementAssignee?.legalName || 'another executive'}` : 'Record the off-platform payment and upload its receipt'}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid #ea580c',
                      background: 'linear-gradient(135deg, #f97316, #ea580c)',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: req.canRecord === false ? 'not-allowed' : 'pointer',
                      opacity: req.canRecord === false ? 0.55 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {req.canRecord === false ? 'Assigned to another executive' : 'Record Transfer ↗'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'AWAITING_CONFIRMATION' ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          {awaitingConfirmation.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <CheckCircle2 size={24} color="#059669" style={{ margin: '0 auto 8px' }} />
              <h4 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>No payments awaiting confirmation</h4>
              <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>Requesters will appear here after a payment is recorded.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {awaitingConfirmation.map((disb) => (
                <div
                  key={disb.id}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: '#fffbeb',
                      color: '#d97706',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0
                    }}>
                      <Clock size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>Ref: {disb.externalReference}</span>
                        <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                          {disb.payerOrg.legalName}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                        To: {disb.beneficiaryName} · {disb.beneficiaryBank} ({disb.beneficiaryAccount})
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                        Requested by: {disb.request?.requester?.legalName || 'Staff member'} · Recorded by: {disb.recordedBy.legalName}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{disb.amountFormatted}</div>
                    <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fffbeb', color: '#b45309', display: 'inline-block', marginTop: '3px' }}>
                      {disb.status === 'RECIPIENT_REPORTED_ISSUE' ? 'Staff reported a payment issue' : 'Awaiting staff confirmation'}
                    </span>
                  </div>

                  <button
                    disabled
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid #d97706',
                      background: '#fffbeb',
                      color: '#b45309',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Waiting for requester
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          {verifiedDisbursements.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>No payments have been confirmed by requesters yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {verifiedDisbursements.map((disb) => (
                <div
                  key={disb.id}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: '#ecfdf5',
                      color: '#059669',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0
                    }}>
                      <CheckCircle2 size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{disb.externalReference}</span>
                        <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#ecfdf5', color: '#059669', fontWeight: 700 }}>
                        STAFF CONFIRMED
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                        {disb.beneficiaryName} · {disb.amountFormatted}
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                        Confirmed by: {disb.recipientConfirmation?.employee?.legalName || 'Requester'} · Paid: {new Date(disb.paidAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#059669' }}>{disb.amountFormatted}</div>
                    <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                      SHA-256: {disb.receipt?.sha256.substring(0, 12)}…
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MAKER RECORD TRANSFER MODAL */}
      {makerModalOpen && selectedRequest && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 26, 66, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 999,
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            width: 'min(500px, 100%)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div>
                <span style={{ fontSize: '8px', fontWeight: 800, color: '#ea580c', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  MAKER INITIATION GATE
                </span>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>
                  Record Off-Platform Bank Transfer
                </h3>
              </div>
              <button
                onClick={() => setMakerModalOpen(false)}
                style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordTransfer} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {makerModalError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#b91c1c',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>⚠️ {makerModalError}</span>
                </div>
              )}
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Request Ref:</span>
                  <span style={{ fontWeight: 700 }}>{selectedRequest.requestNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ color: '#64748b' }}>Approved Amount:</span>
                  <span style={{ fontWeight: 700, color: '#ea580c' }}>{selectedRequest.amountFormatted}</span>
                </div>
              </div>

              <p style={{ margin: 0, padding: '8px 10px', borderRadius: 6, background: '#fff7ed', color: '#9a3412', fontSize: 10, lineHeight: 1.5 }}>
                Make the bank transfer outside this system first. Then enter its reference and upload the actual slip here; the requester will be notified to confirm receipt.
              </p>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Corporate Payer Account *
                </label>
                <select
                  value={payerBank}
                  onChange={(e) => setPayerBank(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    color: '#0f172a',
                    background: '#fff'
                  }}
                >
                  {availableBanks.length > 0 ? (
                    availableBanks.map((acc) => (
                      <option key={acc.id} value={`${acc.bankName} (${acc.accountNumber})`}>
                        {acc.bankName} · {acc.accountNumber} ({acc.balanceFormatted})
                      </option>
                    ))
                  ) : (
                    <option value="Primary Corporate Account">Primary Corporate Operational Account</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  External Bank Transfer Reference (TRF/NIP) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TRF-2026-9481"
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Beneficiary Bank
                  </label>
                  <input
                    type="text"
                    value={beneficiaryBank}
                    onChange={(e) => setBeneficiaryBank(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      color: '#0f172a',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Beneficiary Account No
                  </label>
                  <input
                    type="text"
                    value={beneficiaryAccount}
                    onChange={(e) => setBeneficiaryAccount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      color: '#0f172a',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Attach Bank Slip Receipt (Optional · e-voucher generated if omitted)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 10 * 1024 * 1024) {
                      e.target.value = '';
                      setReceiptFile(null);
                      setReceiptFileName('');
                      setMakerModalError('The bank slip must be 10 MB or smaller.');
                      return;
                    }
                    setReceiptFile(file);
                    setReceiptFileName(file?.name || '');
                    setMakerModalError(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px dashed #94a3b8',
                    fontSize: '11px',
                    color: '#0f172a',
                    background: '#f8fafc',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ display: 'block', marginTop: '4px', fontSize: '9px', color: receiptFileName ? '#15803d' : '#64748b', fontWeight: receiptFileName ? 700 : 400 }}>
                  {receiptFileName ? `✓ Slip selected: ${receiptFileName}` : 'PDF, PNG or JPG · Up to 10 MB. If omitted, an electronic audit voucher will be created.'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setMakerModalOpen(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTransfer}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: '1px solid #ea580c',
                    background: submittingTransfer ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: submittingTransfer ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submittingTransfer ? 'Recording & Notifying…' : 'Record & Notify Requester →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECKER VERIFY MODAL */}
      {checkerModalOpen && selectedDisbursement && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 26, 66, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 999,
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            width: 'min(500px, 100%)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fefce8'
            }}>
              <div>
                <span style={{ fontSize: '8px', fontWeight: 800, color: '#ca8a04', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  INDEPENDENT CHECKER SIGN-OFF
                </span>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#854d0e', margin: '2px 0 0' }}>
                  Verify Bank Transfer: {selectedDisbursement.externalReference}
                </h3>
              </div>
              <button
                onClick={() => setCheckerModalOpen(false)}
                style={{ border: 0, background: 'none', color: '#854d0e', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Transfer Amount:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedDisbursement.amountFormatted}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Beneficiary:</span>
                  <span style={{ fontWeight: 600 }}>{selectedDisbursement.beneficiaryName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Destination Bank:</span>
                  <span>{selectedDisbursement.beneficiaryBank} ({selectedDisbursement.beneficiaryAccount})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Corporate Payer:</span>
                  <span>{selectedDisbursement.bankName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Maker Officer:</span>
                  <span style={{ color: '#ea580c', fontWeight: 600 }}>{selectedDisbursement.recordedBy.legalName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>SHA-256 Hash:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '9px' }}>{selectedDisbursement.receipt?.sha256.substring(0, 24)}…</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  CBN / NIP Transaction Reference *
                </label>
                <input
                  type="text"
                  value={supportingRef}
                  onChange={(e) => setSupportingRef(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Verification / Audit Notes
                </label>
                <input
                  type="text"
                  placeholder="Verified against corporate daily bank statement."
                  value={checkerReason}
                  onChange={(e) => setCheckerReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => handleCheckerDecision('REJECTED')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: verifying ? 'not-allowed' : 'pointer'
                  }}
                >
                  Reject to Maker
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setCheckerModalOpen(false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleCheckerDecision('VERIFIED')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid #059669',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: verifying ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {verifying ? 'Signing off…' : 'Sign & Verify Payment ✓'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
