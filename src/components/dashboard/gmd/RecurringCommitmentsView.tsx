'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarClock, CircleDollarSign, FileText, RefreshCw, Search, X } from 'lucide-react';

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
const formatNaira = (minor: string | number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const approvalLabel = (status: string) => ({ SUBMITTED: 'Submitted', IN_REVIEW: 'In review', CLARIFICATION_REQUESTED: 'Clarification requested', APPROVED: 'Approved' }[status] || status.replaceAll('_', ' ').toLowerCase());

export function RecurringCommitmentsView({ businessName }: { businessName: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selectedRequest, setSelectedRequest] = useState<RecurringRequest | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      let response = await fetch('/api/recurring', { credentials: 'include' });
      if (response.status === 401) {
        await new Promise((r) => setTimeout(r, 350));
        response = await fetch('/api/recurring', { credentials: 'include' });
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('The recurring requests service returned an unexpected response. Refresh the page and sign in again if needed.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load recurring commitments.');
      setData(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load recurring commitments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => (data?.requests || []).filter((request) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery || [request.systemId, request.requestNumber, request.title, request.subsidiary.legalName, request.requester.legalName, request.vendor?.name || ''].some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesStatus = status === 'ALL' || (status === 'APPROVED' ? request.approvalStatus === 'APPROVED' : request.approvalStatus !== 'APPROVED');
    return matchesQuery && matchesStatus;
  }), [data, query, status]);

  const upcoming = (data?.requests || []).filter((request) => request.approvalStatus === 'APPROVED' && new Date(request.neededBy).getTime() >= Date.now()).sort((a, b) => new Date(a.neededBy).getTime() - new Date(b.neededBy).getTime())[0];
  const dueCaption = upcoming ? `Needed by ${formatDate(upcoming.neededBy)}` : 'No upcoming approved request date';

  const openRequest = (request: RecurringRequest) => setSelectedRequest(request);

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%' }}>
      <header>
        <span style={eyebrow}>SUBSCRIPTIONS &amp; CONTRACTS · {businessName}</span>
        <h1 style={{ margin: '5px 0 4px', color: '#102344', fontSize: 24, fontWeight: 650 }}>Recurring Expenditure Commitments</h1>
        <p style={{ margin: 0, color: '#70829b', fontSize: 13 }}>Track recurring fund requests, renewals, and expected annual spend across subsidiaries.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12 }}>
        <Metric label="APPROVED COMMITMENTS" value={data ? String(data.summary.approvedCount) : '—'} detail={`${data?.summary.pendingCount ?? 0} awaiting approval`} icon={<FileText size={16}/>}/>
        <Metric label="ANNUAL RUN-RATE" value={data ? formatNaira(data.summary.annualRunRateMinor) : '—'} detail="Approved monthly, quarterly & annual requests" icon={<CircleDollarSign size={16}/>}/>
        <Metric label="NEXT DUE REQUEST" value={upcoming?.title || 'No upcoming request'} detail={dueCaption} icon={<CalendarClock size={16}/>}/>
        <Metric label="AUTOMATIC PAYMENT" value="Off" detail="Approval and receipt required each time" icon={<RefreshCw size={16}/>}/>
      </section>

      <section style={{ padding: 14, background: '#fff', border: '1px solid #e1e8f0', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: '#172b4d', fontSize: 16 }}>Recurring requests</h2>
            <p style={{ margin: '3px 0 0', color: '#71829a', fontSize: 11 }}>Each request remains individually approved and tracked through payment and accountability.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} style={refreshButton}><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingBottom: 12 }}>
          <label style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#8b9ab0' }}/>
            <input aria-label="Search recurring requests" placeholder="Search system ID, title, request, vendor or subsidiary" value={query} onChange={(event) => setQuery(event.target.value)} style={searchInput}/>
          </label>
          <select aria-label="Filter recurring request status" value={status} onChange={(event) => setStatus(event.target.value)} style={selectStyle}>
            <option value="ALL">All statuses</option><option value="APPROVED">Approved</option><option value="PENDING">Awaiting approval</option>
          </select>
        </div>

        {error ? <div role="alert" style={{ padding: 16, borderRadius: 8, background: '#fff7f5', color: '#a53b31', fontSize: 12 }}>{error} <button type="button" onClick={() => void load()} style={{ ...refreshButton, marginLeft: 8 }}>Try again</button></div> : loading && !data ? <div style={{ padding: 28, textAlign: 'center', color: '#71829a', fontSize: 12 }}>Loading recurring requests…</div> : filtered.length === 0 ? <div style={{ padding: 34, textAlign: 'center', color: '#71829a', fontSize: 12 }}>{data?.requests.length ? 'No recurring requests match these filters.' : 'No recurring fund requests have been submitted yet.'}</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, fontSize: 12 }}>
              <thead><tr style={{ background: '#f4f7fb', color: '#72829a', textAlign: 'left', fontSize: 10, letterSpacing: '.45px' }}>{['REQUEST & COMMITMENT', 'SUBSIDIARY / OWNER', 'AMOUNT & CADENCE', 'NEEDED BY', 'APPROVAL', 'PAYMENT', ''].map((heading) => <th key={heading} style={{ padding: '10px 11px', fontWeight: 750 }}>{heading}</th>)}</tr></thead>
              <tbody>{filtered.map((request) => <tr key={request.id} style={{ borderBottom: '1px solid #e8edf3' }}>
                <td style={{ padding: '12px 11px', maxWidth: 330 }}><button type="button" onClick={() => openRequest(request)} style={requestTitle}><strong>{request.title}</strong><small>{request.requestNumber} · {request.category.replaceAll('_', ' ')}</small><small style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'}}>{request.systemId}</small></button></td>
                <td style={{ padding: '12px 11px', color: '#52647c' }}><strong style={{ display: 'block', color: '#344761', fontWeight: 600 }}>{request.subsidiary.legalName}</strong><span>{request.requester.legalName}{request.vendor ? ` · ${request.vendor.name}` : ''}</span></td>
                <td style={{ padding: '12px 11px', whiteSpace: 'nowrap' }}><strong style={{ display: 'block', color: '#183457' }}>{formatNaira(request.amountMinor)}</strong><span style={{ color: '#72829a' }}>{cadenceLabel[request.recurringInterval || ''] || 'Cadence not specified'}</span></td>
                <td style={{ padding: '12px 11px', whiteSpace: 'nowrap', color: '#52647c' }}>{formatDate(request.neededBy)}</td>
                <td style={{ padding: '12px 11px' }}><StatusBadge text={approvalLabel(request.approvalStatus)} approved={request.approvalStatus === 'APPROVED'}/></td>
                <td style={{ padding: '12px 11px', color: '#52647c' }}>{request.paymentStatus.replaceAll('_', ' ').toLowerCase()}</td>
                <td style={{ padding: '12px 11px' }}><button type="button" onClick={() => openRequest(request)} aria-label={`View ${request.requestNumber} details`} style={openButton}><ArrowUpRight size={15}/></button></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <p style={{ margin: 0, padding: '10px 13px', background: '#eff6ff', borderRadius: 8, color: '#526a89', fontSize: 11, lineHeight: 1.5 }}>Automatic bank payments are off. Recurring requests still require approval, a recorded payment receipt, and confirmation from the requester.</p>

      {selectedRequest && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRequest(null); }} style={modalBackdrop}>
        <section role="dialog" aria-modal="true" aria-labelledby="recurring-request-title" style={modalCard}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '18px 20px', borderBottom: '1px solid #e5ebf2' }}>
            <div><span style={eyebrow}>{selectedRequest.requestNumber} · {selectedRequest.subsidiary.legalName}</span><small style={{display:'block',marginTop:5,color:'#71829a',fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'}}>{selectedRequest.systemId}</small><h2 id="recurring-request-title" style={{ margin: '6px 0 0', color: '#172b4d', fontSize: 19, lineHeight: 1.35 }}>{selectedRequest.title}</h2></div>
            <button type="button" onClick={() => setSelectedRequest(null)} aria-label="Close request details" style={closeButton}><X size={17}/></button>
          </header>
          <div style={{ padding: 20, display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <Detail label="Requested amount" value={formatNaira(selectedRequest.amountMinor)}/>
              <Detail label="Cadence" value={cadenceLabel[selectedRequest.recurringInterval || ''] || 'Not specified'}/>
              <Detail label="Requester" value={`${selectedRequest.requester.legalName} · ${selectedRequest.requester.role.replaceAll('_', ' ')}`}/>
              <Detail label="Vendor" value={selectedRequest.vendor?.name || 'Not specified'}/>
              <Detail label="Needed by" value={formatDate(selectedRequest.neededBy)}/>
              <Detail label="Category" value={selectedRequest.category.replaceAll('_', ' ')}/>
              <Detail label="Approval" value={approvalLabel(selectedRequest.approvalStatus)}/>
              <Detail label="Payment" value={selectedRequest.paymentStatus.replaceAll('_', ' ').toLowerCase()}/>
              <Detail label="Accountability" value={selectedRequest.accountabilityStatus.replaceAll('_', ' ').toLowerCase()}/>
            </div>
            <Detail label="Operational justification" value={selectedRequest.justification || 'No justification provided.'}/>
            {selectedRequest.deliverable && <Detail label="Expected deliverable" value={selectedRequest.deliverable}/>}
          </div>
        </section>
      </div>}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: '11px 12px', border: '1px solid #e1e8f0', borderRadius: 8, background: '#f8fafc' }}><div style={{ color: '#8392a8', fontSize: 10, fontWeight: 700, letterSpacing: '.45px', textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 5, color: '#344761', fontSize: 12, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{value}</div></div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <article style={{ minWidth: 0, minHeight: 94, padding: '14px 16px', background: '#fff', border: '1px solid #e1e8f0', borderRadius: 12, boxShadow: '0 1px 2px rgba(16,35,68,.02)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#92a0b3', fontSize: 10, fontWeight: 700, letterSpacing: '.5px' }}><span>{label}</span><span style={{ color: '#6f86a2' }}>{icon}</span></div>
    <strong title={value} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 7, color: '#183457', fontSize: 20, fontWeight: 700 }}>{value}</strong>
    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3, color: '#8392a8', fontSize: 11 }}>{detail}</span>
  </article>;
}

function StatusBadge({ text, approved }: { text: string; approved: boolean }) {
  return <span style={{ display: 'inline-block', padding: '4px 7px', borderRadius: 6, background: approved ? '#e1f5ee' : '#fff1d9', color: approved ? '#087c60' : '#9a6500', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</span>;
}

const eyebrow: React.CSSProperties = { color: '#8191a7', fontSize: 10, fontWeight: 800, letterSpacing: '1.25px' };
const refreshButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '1px solid #d8e2ee', borderRadius: 7, background: '#fff', color: '#48607e', fontSize: 11, fontWeight: 650, cursor: 'pointer' };
const searchInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', border: '1px solid #d8e2ee', borderRadius: 7, fontSize: 11, color: '#344761', outlineColor: '#9bc2ff' };
const selectStyle: React.CSSProperties = { minWidth: 170, padding: '8px 10px', border: '1px solid #d8e2ee', borderRadius: 7, background: '#fff', color: '#344761', fontSize: 11 };
const requestTitle: React.CSSProperties = { display: 'grid', gap: 4, padding: 0, border: 0, background: 'transparent', textAlign: 'left', color: '#344761', cursor: 'pointer', font: 'inherit' };
const openButton: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 28, height: 28, border: '1px solid #d8e2ee', borderRadius: 7, background: '#fff', color: '#3970c7', cursor: 'pointer' };
const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(13, 29, 53, .48)' };
const modalCard: React.CSSProperties = { width: 'min(680px, 100%)', maxHeight: 'min(85vh, 760px)', overflowY: 'auto', border: '1px solid #dce5ef', borderRadius: 12, background: '#fff', boxShadow: '0 22px 70px rgba(10, 26, 50, .28)' };
const closeButton: React.CSSProperties = { flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 30, height: 30, border: '1px solid #d8e2ee', borderRadius: 8, background: '#fff', color: '#61738b', cursor: 'pointer' };
