'use client';

import React, { useEffect, useState } from 'react';
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
  HelpCircle
} from 'lucide-react';

interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeNumber?: string;
}

interface StaffWorkspaceProps {
  user: StaffUser;
  businessName: string;
  onNavigate: (tab: string) => void;
  setNotice: (msg: string) => void;
}

export function StaffWorkspaceModule({
  user,
  businessName,
  onNavigate,
  setNotice,
}: StaffWorkspaceProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadStaffData() {
      setLoading(true);
      try {
        const [reqRes, caseRes] = await Promise.all([
          fetch('/api/requests').then(r => r.ok ? r.json() : { requests: [] }),
          fetch('/api/accountability').then(r => r.ok ? r.json() : { cases: [] }),
        ]);

        // Filter requests submitted by this staff member
        const allRequests = reqRes.requests || [];
        const myRequests = allRequests.filter((r: any) => 
          r.requestedById === user.id || 
          r.requester?.workEmail?.toLowerCase() === user.email.toLowerCase()
        );
        setRequests(myRequests);

        // Filter open accountability cases for this staff member
        const allCases = caseRes.cases || [];
        const myCases = allCases.filter((c: any) => 
          c.ownerUserId === user.id || 
          c.owner?.workEmail?.toLowerCase() === user.email.toLowerCase() ||
          c.request?.requestedById === user.id
        );
        setCases(myCases);
      } catch (e) {
        console.error('Failed to load staff data:', e);
      } finally {
        setLoading(false);
      }
    }

    loadStaffData();
  }, [user.id, user.email]);

  const activeAdvanceCount = cases.filter(c => c.status !== 'CLOSED').length;
  const pendingRequests = requests.filter(r => ['SUBMITTED', 'IN_REVIEW', 'PENDING'].includes(r.approvalStatus));
  const firstName = user.fullName ? user.fullName.split(' ')[0] : 'Staff Member';

  const formatNaira = (minor: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(minor / 100);
  };

  const handleConfirmReceipt = (disbursementId: string) => {
    setConfirmingId(disbursementId);
    setTimeout(() => {
      setConfirmingId(null);
      setNotice('Payment receipt confirmed successfully. Advance is now active under 72h evidence SLA.');
    }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div
            style={{
              color: '#ea580c',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            STAFF REQUISITION & ACCOUNTABILITY PORTAL · {businessName.toUpperCase()}
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Welcome back, {firstName}.
          </h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Submit fund requests, track live multi-stage approvals, and retire cash advances within the mandatory 72-hour window.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/requests/new';
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 18px',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={16} /> New Fund Request
          </button>
        </div>
      </div>

      {/* 72-Hour Advance SLA Warning Banner (If active unretired advances exist) */}
      {activeAdvanceCount > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1.5px solid #fcd34d',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#f59e0b',
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
              <strong style={{ color: '#92400e', fontSize: '14px', display: 'block' }}>
                Active Cash Advance: 72-Hour Evidence Window Active
              </strong>
              <span style={{ color: '#b45309', fontSize: '13px' }}>
                You have {activeAdvanceCount} advance{activeAdvanceCount > 1 ? 's' : ''} awaiting receipt upload. Group policy requires invoices or receipts uploaded within 72 hours of disbursement.
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('72h Evidence Vault')}
            style={{
              background: '#92400e',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Upload Receipts →
          </button>
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
        {/* Card 1: My Requisitions */}
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
              {pendingRequests.length === 0 ? 'All requests processed' : `${pendingRequests.length} currently in approval ladder`}
            </div>
          </div>
        </div>

        {/* Card 2: 72h Evidence Status */}
        <div
          style={{
            background: activeAdvanceCount > 0 ? '#fff7ed' : '#ffffff',
            borderRadius: '18px',
            padding: '22px',
            border: activeAdvanceCount > 0 ? '1px solid #fed7aa' : '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: activeAdvanceCount > 0 ? '#c2410c' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              72h Advance Compliance
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: activeAdvanceCount > 0 ? '#fdba74' : '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeAdvanceCount > 0 ? '#9a3412' : '#15803d',
              }}
            >
              {activeAdvanceCount > 0 ? <Clock size={16} /> : <ShieldCheck size={16} />}
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '32px', fontWeight: '900', color: activeAdvanceCount > 0 ? '#ea580c' : '#10b981', lineHeight: 1 }}>
              {activeAdvanceCount > 0 ? `${activeAdvanceCount} Open` : '100%'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              {activeAdvanceCount > 0 ? 'Receipts pending submission' : 'All past advances fully retired'}
            </div>
          </div>
        </div>

        {/* Card 3: Cleared Requisitions */}
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
              <CheckCircle2 size={16} />
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

      {/* Main Content Split: Recent Requests & 72h Upload Desk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px' }}>
        {/* Left: My Recent Fund Requests */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                My Recent Requisitions
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Track approval stage progression and disbursement status in real time.
              </p>
            </div>
            <button
              onClick={() => onNavigate('My Requisitions')}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#ea580c',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              View all →
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Loading your requisitions…
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <FileText size={36} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>No fund requests submitted yet</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                When you create an operational expenditure or cash advance request, it will appear here.
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.href = '/requests/new';
                }}
                style={{
                  marginTop: '16px',
                  background: '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                + Create First Request
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {requests.slice(0, 5).map((req) => {
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
                      padding: '14px 16px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#ea580c', fontFamily: 'monospace' }}>
                          {req.requestNumber || 'REQ'}
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                          {req.title}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                        {req.category || 'General Requisition'} · {new Date(req.createdAt).toLocaleDateString('en-GB')}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                        {formatNaira(req.amountMinor || 0)}
                      </div>
                      <div style={{ marginTop: '3px' }}>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: 72-Hour Evidence Desk & Quick Help */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Evidence Upload Desk */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              padding: '22px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              72-Hour Evidence Vault
            </h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 14px 0' }}>
              Upload vendor receipts, invoices, or delivery waybills for unretired advances.
            </p>

            {cases.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '12px',
                }}
              >
                <CheckCircle2 size={24} color="#10b981" style={{ margin: '0 auto 6px' }} />
                <strong>No pending retirements</strong>
                <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '11px' }}>
                  When funds are disbursed to your account, upload your proof here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cases.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: '#fffbeb',
                      border: '1px solid #fef3c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '12px', color: '#92400e', display: 'block' }}>
                        {c.request?.requestNumber || 'ADVANCE'}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#b45309' }}>
                        Due: {new Date(c.dueAt).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') window.location.href = '/accountability';
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#ea580c',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      <Upload size={12} /> Upload
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Policy Reminder Card */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '18px',
              padding: '20px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '800', fontSize: '13px' }}>
              <HelpCircle size={16} color="#ea580c" />
              Staff Policy Reminder
            </div>
            <ul style={{ margin: '10px 0 0 0', paddingLeft: '18px', fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
              <li>Advance retirements require verifiable invoices or receipts.</li>
              <li>Requisitions follow the 5-tier review matrix.</li>
              <li>New requests are locked if an advance is overdue beyond 72 hours.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
