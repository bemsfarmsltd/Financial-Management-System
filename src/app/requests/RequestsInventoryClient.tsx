'use client';

import React, { useMemo, useState } from 'react';
import { RequestDossierModal, type RequestDossier } from '@/components/requests/RequestDossierModal';

type RequestRow = {
  id: string;
  systemId: string;
  requestNumber: string;
  title: string;
  requestType: string;
  category: string;
  subsidiaryName: string;
  requesterName: string;
  requesterEmail: string;
  amountMinor: string;
  currency: string;
  approvalStatus: string;
  paymentStatus: string;
  accountabilityStatus: string;
  createdAt: string;
};

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const badgeClass = (value: string) => {
  if (['APPROVED', 'VERIFIED_PAID', 'VERIFIED', 'CLOSED'].includes(value)) return 'good';
  if (['REJECTED', 'OVERDUE'].includes(value)) return 'expired';
  return 'review';
};
const amount = (minor: string, currency: string) => `${currency === 'NGN' ? '₦' : currency} ${(Number(minor) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export function RequestsInventoryClient({ requests }: { requests: RequestRow[] }) {
  const [query, setQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [accountabilityFilter, setAccountabilityFilter] = useState('ALL');
  const [selectedRequest, setSelectedRequest] = useState<RequestDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState('');

  const openRequestDossier = async (identifier: string) => {
    setDossierLoading(true);
    setDossierError('');
    try {
      const response = await fetch('/api/approvals?subsidiary=ALL');
      if (!response.ok) throw new Error('Could not load request details. Please try again.');
      const data = await response.json();
      const request = (data.requests || []).find((item: RequestDossier) => item.requestNumber === identifier || item.systemId === identifier || item.id === identifier);
      if (!request) throw new Error('This request could not be found.');
      setSelectedRequest(request);
    } catch (error) {
      setDossierError(error instanceof Error ? error.message : 'Could not load request details.');
    } finally {
      setDossierLoading(false);
    }
  };

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return requests.filter((request) => {
      const searchable = [request.requestNumber, request.systemId, request.title, request.requestType, request.category, request.subsidiaryName, request.requesterName, request.requesterEmail].join(' ').toLowerCase();
      return (!search || searchable.includes(search))
        && (approvalFilter === 'ALL' || request.approvalStatus === approvalFilter)
        && (paymentFilter === 'ALL' || request.paymentStatus === paymentFilter)
        && (accountabilityFilter === 'ALL' || request.accountabilityStatus === accountabilityFilter);
    });
  }, [requests, query, approvalFilter, paymentFilter, accountabilityFilter]);

  const pendingCount = requests.filter((request) => ['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(request.approvalStatus)).length;
  const approvedCount = requests.filter((request) => request.approvalStatus === 'APPROVED').length;
  const totalValue = requests.reduce((total, request) => total + Number(request.amountMinor) / 100, 0);

  const exportCsv = () => {
    const columns = ['System ID', 'Request number', 'Title', 'Type', 'Category', 'Subsidiary', 'Requester', 'Requester email', 'Amount', 'Approval status', 'Payment status', 'Accountability status', 'Created at'];
    const rows = visible.map((request) => [request.systemId, request.requestNumber, request.title, request.requestType, request.category, request.subsidiaryName, request.requesterName, request.requesterEmail, amount(request.amountMinor, request.currency), request.approvalStatus, request.paymentStatus, request.accountabilityStatus, request.createdAt]);
    const csv = '\uFEFF' + [columns, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'fund-requests.csv';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <p className="kicker">EXPENDITURE INVENTORY</p>
          <h1>Master Fund Requests</h1>
          <p>Review requests across subsidiaries, follow each approval and payment status, and open its private channel.</p>
        </div>
      </div>

      <div className="customer-summary">
        <article><small>TOTAL REQUESTS</small><strong>{requests.length}</strong><span>Across all subsidiaries</span></article>
        <article><small>AWAITING DECISION</small><strong style={{ color: '#d97706' }}>{pendingCount}</strong><span>In the approval pipeline</span></article>
        <article><small>APPROVED</small><strong style={{ color: '#059669' }}>{approvedCount}</strong><span>Payment may still be outstanding</span></article>
        <article><small>TOTAL REQUEST VALUE</small><strong style={{ color: 'var(--navy)' }}>₦{totalValue.toLocaleString('en-NG', { maximumFractionDigits: 2 })}</strong><span>Current request records</span></article>
      </div>

      <section className="card data-register fund-request-inventory" style={{ marginTop: 20 }}>
        <div className="table-tools request-inventory-tools">
          <input aria-label="Search requests" placeholder="Search system ID, reference, title, staff or subsidiary" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="Filter by approval status" value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)}>
            <option value="ALL">All approval statuses</option>
            {[...new Set(requests.map((request) => request.approvalStatus))].sort().map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
          <select aria-label="Filter by payment status" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="ALL">All payment statuses</option>
            {[...new Set(requests.map((request) => request.paymentStatus))].sort().map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
          <select aria-label="Filter by accountability status" value={accountabilityFilter} onChange={(event) => setAccountabilityFilter(event.target.value)}>
            <option value="ALL">All accountability statuses</option>
            {[...new Set(requests.map((request) => request.accountabilityStatus))].sort().map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
          <button type="button" onClick={exportCsv}>Export CSV</button>
          <span className="request-result-count" aria-live="polite">{visible.length} of {requests.length}</span>
        </div>

        <div className="register-head request-inventory-head">
          <span>Request & title</span><span>Subsidiary</span><span>Category</span><span>Amount</span><span>Approval</span><span>Payment</span><span>Accountability</span><span>Requester</span>
        </div>
        {visible.map((request) => (
          <button type="button" onClick={() => openRequestDossier(request.systemId)} key={request.id} className="register-row request-inventory-row" aria-label={`View details for ${request.requestNumber}`}>
            <span><i>▱</i><strong>{request.title}</strong><small>{request.requestNumber} · {request.systemId} · {label(request.requestType)} · {label(request.category)}</small></span>
            <span>{request.subsidiaryName.replace(/\s+Ltd\.?$/i, '')}</span>
            <span>{label(request.category)}</span>
            <strong className="request-inventory-amount">{amount(request.amountMinor, request.currency)}</strong>
            <b className={badgeClass(request.approvalStatus)}>{label(request.approvalStatus)}</b>
            <b className={badgeClass(request.paymentStatus)}>{label(request.paymentStatus)}</b>
            <b className={badgeClass(request.accountabilityStatus)}>{label(request.accountabilityStatus)}</b>
            <span>{request.requesterName}</span>
          </button>
        ))}
        {visible.length === 0 && <div className="inline-status">No requests match those filters.</div>}
        {dossierError && <div className="inline-status error" role="alert">{dossierError}<button type="button" onClick={() => setDossierError('')}>Dismiss</button></div>}
      </section>
      {dossierLoading && <div className="request-dossier-loading" role="status">Loading request history…</div>}
      {selectedRequest && <RequestDossierModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />}
    </>
  );
}
