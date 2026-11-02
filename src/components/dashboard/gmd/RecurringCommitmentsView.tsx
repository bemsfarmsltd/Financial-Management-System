'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  FileText,
  RefreshCw,
  Search,
  X,
  Plus,
  Repeat,
  CheckCircle2,
  Clock,
  Building2,
  ShieldAlert,
  Wallet,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { ExecutiveRecurringModal } from '../ExecutiveRecurringModal';

type RecurringRequest = {
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

type Payload = {
  requests: RecurringRequest[];
  summary: { approvedCount: number; pendingCount: number; annualRunRateMinor: string };
};

const cadenceLabel: Record<string, string> = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUAL: 'Annual' };
const formatNaira = (minor: string | number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const approvalLabel = (status: string) =>
  ({ SUBMITTED: 'Submitted', IN_REVIEW: 'In Review', CLARIFICATION_REQUESTED: 'Clarification Needed', APPROVED: 'Approved' }[status] ||
    status.replaceAll('_', ' ').toLowerCase());

function getRelativeDays(dateStr: string) {
  const diffTime = new Date(dateStr).getTime() - Date.now();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

export function RecurringCommitmentsView({ businessName }: { businessName: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [subsidiaryFilter, setSubsidiaryFilter] = useState('ALL');
  const [cadenceFilter, setCadenceFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [selectedRequest, setSelectedRequest] = useState<RecurringRequest | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, attempt * 400));
        }
        const response = await fetch(`/api/recurring?_t=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
        if (response.status === 401) {
          lastError = 'Sign in to view recurring commitments.';
          continue;
        }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          lastError = 'The recurring requests service returned an unexpected response.';
          continue;
        }
        const result = await response.json();
        if (!response.ok) {
          lastError = result.error || 'Could not load recurring commitments.';
          continue;
        }
        setData(result);
        setError('');
        setLoading(false);
        return;
      } catch (reason) {
        lastError = reason instanceof Error ? reason.message : 'Could not load recurring commitments.';
      }
    }
    setError(lastError || 'Could not load recurring commitments.');
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const isGroupView = !businessName || businessName === 'BEMS Group';

  const availableSubsidiaries = useMemo(() => {
    const set = new Set<string>();
    (data?.requests || []).forEach(r => {
      if (r.subsidiary?.legalName) set.add(r.subsidiary.legalName);
    });
    return Array.from(set);
  }, [data]);

  const scopedRequests = useMemo(() => {
    if (isGroupView) return data?.requests || [];
    return (data?.requests || []).filter(r =>
      r.subsidiary.legalName.toLowerCase() === businessName.toLowerCase() ||
      r.subsidiary.code.toLowerCase() === businessName.toLowerCase()
    );
  }, [data, businessName, isGroupView]);

  const filtered = useMemo(
    () =>
      scopedRequests.filter((request) => {
        if (isGroupView && subsidiaryFilter !== 'ALL') {
          if (request.subsidiary.legalName !== subsidiaryFilter) return false;
        }
        const normalizedQuery = query.trim().toLowerCase();
        const matchesQuery =
          !normalizedQuery ||
          [
            request.systemId,
            request.requestNumber,
            request.title,
            request.category,
            request.subsidiary.legalName,
            request.requester.legalName,
            request.vendor?.name || '',
          ].some((value) => value.toLowerCase().includes(normalizedQuery));

        const matchesStatus =
          status === 'ALL' || (status === 'APPROVED' ? request.approvalStatus === 'APPROVED' : request.approvalStatus !== 'APPROVED');

        const matchesCadence =
          cadenceFilter === 'ALL' || request.recurringInterval === cadenceFilter;

        const matchesPayment =
          paymentFilter === 'ALL' ||
          (paymentFilter === 'PAID'
            ? request.paymentStatus === 'RECIPIENT_CONFIRMED' || request.paymentStatus === 'AWAITING_RECIPIENT_CONFIRMATION'
            : request.paymentStatus === 'UNPAID');

        return matchesQuery && matchesStatus && matchesCadence && matchesPayment;
      }),
    [scopedRequests, isGroupView, subsidiaryFilter, query, status, cadenceFilter, paymentFilter],
  );

  const activeApprovedCount = scopedRequests.filter(r => r.approvalStatus === 'APPROVED').length;
  const activePendingCount = scopedRequests.filter(r => r.approvalStatus !== 'APPROVED').length;
  const activeAnnualMinor = scopedRequests
    .filter(r => r.approvalStatus === 'APPROVED')
    .reduce((sum, r) => {
      const amount = Number(r.amountMinor) || 0;
      const mult = r.recurringInterval === 'ANNUAL' ? 1 : r.recurringInterval === 'QUARTERLY' ? 4 : 12;
      return sum + amount * mult;
    }, 0);

  const upcoming = scopedRequests
    .filter((request) => request.approvalStatus === 'APPROVED' && new Date(request.neededBy).getTime() >= Date.now())
    .sort((a, b) => new Date(a.neededBy).getTime() - new Date(b.neededBy).getTime())[0];
  const dueCaption = upcoming ? `Needed by ${formatDate(upcoming.neededBy)} (${getRelativeDays(upcoming.neededBy)})` : 'No upcoming approved request date';

  const openRequest = (request: RecurringRequest) => setSelectedRequest(request);

  const hasActiveFilters = Boolean(
    query || status !== 'ALL' || subsidiaryFilter !== 'ALL' || cadenceFilter !== 'ALL' || paymentFilter !== 'ALL'
  );

  const handleResetFilters = () => {
    setQuery('');
    setStatus('ALL');
    setSubsidiaryFilter('ALL');
    setCadenceFilter('ALL');
    setPaymentFilter('ALL');
  };

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <span style={eyebrow}>SUBSCRIPTIONS &amp; CONTRACTS · {businessName}</span>
          <h1 style={{ margin: '5px 0 4px', color: '#102344', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Recurring Expenditure Commitments
          </h1>
          <p style={{ margin: 0, color: '#70829b', fontSize: 13 }}>
            Monitor automated operational renewals, software subscriptions, facility retainers, and annual run-rates.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => void load()} disabled={loading} style={refreshButton}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <a
            href="/requests/new"
            style={{
              ...primaryButton,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
            }}
          >
            <Plus size={14} /> New Recurring Request
          </a>
        </div>
      </header>

      {/* Top Metric Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <Metric
          label="ACTIVE RUN-RATE COMMITMENTS"
          value={data ? String(activeApprovedCount) : '—'}
          detail={`${activePendingCount} awaiting executive approval`}
          icon={<Repeat size={16} color="var(--brand-primary, #ea580c)" />}
        />
        <Metric
          label="PROJECTED ANNUAL RUN-RATE"
          value={data ? formatNaira(activeAnnualMinor) : '—'}
          detail="Combined recurring monthly & annual spend"
          icon={<CircleDollarSign size={16} color="#059669" />}
        />
        <Metric
          label="NEXT SCHEDULED DUE DATE"
          value={upcoming?.title || 'No upcoming request'}
          detail={dueCaption}
          icon={<CalendarClock size={16} color="#2563eb" />}
        />
        <Metric
          label="TREASURY DISBURSEMENT GATE"
          value="Disbursement Locked"
          detail="Each cycle requires verified payment receipt"
          icon={<ShieldAlert size={16} color="#7c3aed" />}
        />
      </section>

      {/* Main Table Section */}
      <section style={{ padding: 18, background: '#fff', border: '1px solid #e1e8f0', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 800 }}>Recurring Requisitions Queue</h2>
            <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 11 }}>
              Every cycle is individually approved by the Group Managing Director and anchored by 72-hour retiral accountability.
              {scopedRequests.length > 0 && ` Showing ${filtered.length} of ${scopedRequests.length} commitments.`}
            </p>
          </div>
        </div>

        {/* Multi-Dimensional Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                aria-label="Search recurring requests"
                placeholder="Search system ID, title, vendor, or category…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ ...searchInput, paddingLeft: 28, height: 34, fontSize: 11 }}
              />
            </div>

            {isGroupView && availableSubsidiaries.length > 1 && (
              <select
                aria-label="Filter by subsidiary"
                value={subsidiaryFilter}
                onChange={(e) => setSubsidiaryFilter(e.target.value)}
                style={{ ...selectStyle, minWidth: 150, height: 34, fontSize: 11 }}
              >
                <option value="ALL">All Subsidiaries ({availableSubsidiaries.length})</option>
                {availableSubsidiaries.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Filter cadence interval"
              value={cadenceFilter}
              onChange={(e) => setCadenceFilter(e.target.value)}
              style={{ ...selectStyle, minWidth: 120, height: 34, fontSize: 11 }}
            >
              <option value="ALL">All Intervals</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </select>

            <select
              aria-label="Filter approval status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={{ ...selectStyle, minWidth: 130, height: 34, fontSize: 11 }}
            >
              <option value="ALL">All Approvals</option>
              <option value="APPROVED">Approved Commitments</option>
              <option value="PENDING">Awaiting Review</option>
            </select>

            <select
              aria-label="Filter payment status"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              style={{ ...selectStyle, minWidth: 120, height: 34, fontSize: 11 }}
            >
              <option value="ALL">All Payouts</option>
              <option value="PAID">Confirmed Paid</option>
              <option value="UNPAID">Unpaid / In Gate</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                border: 0,
                background: '#e2e8f0',
                color: '#475569',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {error ? (
          <div role="alert" style={{ padding: 16, borderRadius: 8, background: '#fff7f5', color: '#a53b31', fontSize: 12 }}>
            {error}{' '}
            <button type="button" onClick={() => void load()} style={{ ...refreshButton, marginLeft: 8 }}>
              Try again
            </button>
          </div>
        ) : loading && !data ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
            <RefreshCw size={24} color="var(--brand-primary, #0d8a70)" className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
            Loading recurring expenditure commitments...
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: 12,
              border: '1.5px dashed #cbd5e1',
              margin: '10px 0',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'var(--brand-soft, rgba(13, 138, 112, 0.12))',
                color: 'var(--brand-primary, #0d8a70)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 12px',
              }}
            >
              <Repeat size={24} />
            </div>
            <strong style={{ display: 'block', fontSize: 15, color: '#0f172a' }}>
              {query || status !== 'ALL' ? 'No Matching Recurring Commitments' : 'No Recurring Commitments Configured Yet'}
            </strong>
            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 440, margin: '6px auto 16px', lineHeight: 1.5 }}>
              {query || status !== 'ALL'
                ? 'Try broadening your search term or switching the status dropdown.'
                : 'Mark any routine operational requisition (like cloud hosting, Starlink internet, or facility rent) as recurring during submission to track expected annual run-rate.'}
            </p>
            {query || status !== 'ALL' ? (
              <button
                style={refreshButton}
                onClick={() => {
                  setQuery('');
                  setStatus('ALL');
                }}
              >
                Clear Filters
              </button>
            ) : (
              <a
                href="/requests/new"
                style={{
                  ...primaryButton,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                }}
              >
                <Plus size={14} /> Submit Recurring Request
              </a>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>REQUISITION COMMITMENT</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>SUBSIDIARY / OWNER</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>AMOUNT &amp; CADENCE</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>NEXT DUE DATE</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>APPROVAL</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>PAYMENT</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((request) => {
                  const isApproved = request.approvalStatus === 'APPROVED';
                  const cadence = cadenceLabel[request.recurringInterval || ''] || 'Monthly';
                  return (
                    <tr
                      key={request.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Commitment Title */}
                      <td style={{ padding: '12px 14px', maxWidth: 300 }}>
                        <button type="button" onClick={() => openRequest(request)} style={requestTitle}>
                          <strong style={{ color: '#0f172a', fontWeight: 700, fontSize: 13 }}>{request.title}</strong>
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            {request.requestNumber} · {request.category.replaceAll('_', ' ')}
                          </span>
                        </button>
                      </td>

                      {/* Subsidiary & Requester */}
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ display: 'block', color: '#0f172a', fontWeight: 700 }}>{request.subsidiary.legalName}</strong>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          {request.requester.legalName}
                          {request.vendor ? ` · ${request.vendor.name}` : ''}
                        </span>
                      </td>

                      {/* Amount & Cadence */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <strong style={{ display: 'block', color: '#0f172a', fontSize: 13 }}>{formatNaira(request.amountMinor)}</strong>
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: 2,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: cadence === 'Monthly' ? '#eff6ff' : '#faf5ff',
                            color: cadence === 'Monthly' ? '#1d4ed8' : '#7c3aed',
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          {cadence}
                        </span>
                      </td>

                      {/* Needed By */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <strong style={{ display: 'block', color: '#0f172a' }}>{formatDate(request.neededBy)}</strong>
                        <span style={{ fontSize: 10, color: '#64748b' }}>{getRelativeDays(request.neededBy)}</span>
                      </td>

                      {/* Approval Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge text={approvalLabel(request.approvalStatus)} approved={isApproved} />
                      </td>

                      {/* Payment Status */}
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        <span style={{ textTransform: 'capitalize' }}>{request.paymentStatus.replaceAll('_', ' ').toLowerCase()}</span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => openRequest(request)}
                          aria-label={`View ${request.requestNumber} details`}
                          style={openButton}
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: '#eff6ff',
          borderRadius: 10,
          border: '1px solid #bfdbfe',
          color: '#1e40af',
          fontSize: 12,
        }}
      >
        <ShieldAlert size={16} color="#2563eb" />
        <span>
          <strong>Treasury Dual-Custody Enforced:</strong> Recurring requests still require individual executive review, verified bank payment slips,
          and proof-of-performance upload for every cycle.
        </span>
      </div>

      {/* Executive Requisition Inspection Modal */}
      <ExecutiveRecurringModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  );
}

function StepBadge({ step, title, completed, current }: { step: string; title: string; completed: boolean; current: boolean }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '8px 4px',
        borderRadius: 8,
        background: completed ? '#ecfdf5' : current ? '#fff7ed' : '#ffffff',
        border: `1px solid ${completed ? '#a7f3d0' : current ? '#fed7aa' : '#e2e8f0'}`,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          margin: '0 auto 4px',
          background: completed ? '#059669' : current ? 'var(--brand-primary, #0d8a70)' : '#94a3b8',
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 900,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {completed ? '✓' : step}
      </div>
      <span
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 700,
          color: completed ? '#065f46' : current ? 'var(--brand-primary, #0d8a70)' : '#64748b',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </span>
    </div>
  );
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div style={{ padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
      <div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: '.45px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 4, color: highlight || '#0f172a', fontSize: highlight ? 16 : 13, fontWeight: highlight ? 900 : 600, lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <article
      style={{
        padding: '16px 18px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11, fontWeight: 800 }}>
        <span>{label}</span>
        {icon}
      </div>
      <strong title={value} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 6, color: '#0f172a', fontSize: 22, fontWeight: 900 }}>
        {value}
      </strong>
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3, color: '#94a3b8', fontSize: 11 }}>
        {detail}
      </span>
    </article>
  );
}

function StatusBadge({ text, approved }: { text: string; approved: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 6,
        background: approved ? '#ecfdf5' : '#fffbeb',
        color: approved ? '#059669' : '#d97706',
        border: `1px solid ${approved ? '#a7f3d0' : '#fde68a'}`,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

const eyebrow: React.CSSProperties = { color: 'var(--brand-primary, #0d8a70)', fontSize: 11, fontWeight: 900, letterSpacing: '1.25px', textTransform: 'uppercase' };
const refreshButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const primaryButton: React.CSSProperties = { padding: '8px 14px', border: '1px solid var(--brand-primary, #0d8a70)', borderRadius: 8, background: 'var(--brand-gradient, var(--brand-primary, #0d8a70))', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px var(--brand-shadow-color, rgba(0, 0, 0, 0.15))' };
const secondaryButton: React.CSSProperties = { padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const searchInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, color: '#0f172a', background: '#fff' };
const selectStyle: React.CSSProperties = { minWidth: 160, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', fontSize: 12, fontWeight: 600 };
const requestTitle: React.CSSProperties = { display: 'grid', gap: 2, padding: 0, border: 0, background: 'transparent', textAlign: 'left', color: '#0f172a', cursor: 'pointer', font: 'inherit' };
const openButton: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 30, height: 30, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: 'var(--brand-primary, #0d8a70)', cursor: 'pointer' };
const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)' };
const modalCard: React.CSSProperties = { width: 'min(720px, 100%)', maxHeight: 'min(88vh, 800px)', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 16, background: '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' };
const closeButton: React.CSSProperties = { flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#64748b', cursor: 'pointer' };

