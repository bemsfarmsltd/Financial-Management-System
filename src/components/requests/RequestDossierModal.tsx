'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import { X, MessageSquare, Clock3, Building2, UserRound, FileCheck2, Copy, Check } from 'lucide-react';
import { RequestChatModal } from './RequestChatModal';
import { toSystemRequestId } from '@/lib/request-id';

export type RequestDossier = {
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
  isRecurring: boolean;
  recurringInterval: string | null;
  createdAt: string;
  subsidiary: { id: string; code: string; name: string };
  requester: { id: string; name: string; role: string; employeeNumber: string; department: string };
  vendor: { id: string; code: string; name: string; category: string; taxId: string | null; bankName: string | null; accountNumber: string | null; accountName: string | null; rating: number } | null;
  threeWayMatch: { poMatched: boolean; quoteAttached: boolean; scopeVerified: boolean; status: string };
  budgetImpact: { totalBudget: number; spentSoFar: number; remainingBefore: number; remainingAfter: number; percentOfBudget: number };
  approvalSteps: { id: string; stageIndex: number; assignedRole: string; approverName: string | null; status: string; decidedAt: string | null; decisionReason: string | null }[];
  recentMessages: { id: string; authorName: string; authorRole: string; body: string; createdAt: string }[];
};

const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: number) => `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

export function RequestDossierModal({ request, onClose }: { request: RequestDossier; onClose: () => void }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [copiedSystemId, setCopiedSystemId] = useState(false);
  const systemId = request.systemId || toSystemRequestId(request.id);
  const copySystemId = async () => {
    try { await navigator.clipboard.writeText(systemId); setCopiedSystemId(true); window.setTimeout(() => setCopiedSystemId(false), 1600); } catch { setCopiedSystemId(false); }
  };
  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="request-dossier-overlay" role="presentation" onMouseDown={closeOnBackdrop}>
      <section className="request-dossier-modal" role="dialog" aria-modal="true" aria-labelledby="request-dossier-title">
        <header className="request-dossier-header">
          <div className="request-dossier-heading">
            <div className="request-dossier-meta">
              <span className="request-dossier-ref">{request.requestNumber}</span>
              <span className="request-dossier-tier">{request.tierLabel}</span>
              <span>{request.subsidiary.name} · {humanize(request.category)}</span>
              <button type="button" onClick={() => void copySystemId()} title="Copy system ID" aria-label="Copy system ID" style={{display:'inline-flex',alignItems:'center',gap:4,border:0,background:'transparent',padding:0,color:'#7b8aa1',font:'inherit',cursor:'pointer'}}><span style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'}}>System ID: {systemId}</span>{copiedSystemId?<Check size={13}/>:<Copy size={13}/>}</button>
            </div>
            <h2 id="request-dossier-title">{request.title}</h2>
          </div>
          <div className="request-dossier-header-actions">
            <button type="button" onClick={() => setChatOpen(true)} className="request-dossier-chat">
              <MessageSquare size={14} /> Request chat
            </button>
            <button type="button" className="request-dossier-close" onClick={onClose} aria-label="Close request details"><X size={16} /></button>
          </div>
        </header>

        <div className="request-dossier-body">
          <div className="request-dossier-column">
            <section className="request-dossier-panel">
              <h3>Business justification & operational need</h3>
              <p>{request.justification || 'No justification was provided.'}</p>
            </section>
            <section className="request-dossier-panel">
              <h3>Tangible deliverable & evidence gates</h3>
              <p>{request.deliverable || 'No deliverable was recorded.'}</p>
              <div className="request-dossier-due"><Clock3 size={14} /> Required by <strong>{new Date(request.neededBy).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
            </section>
            <section className="request-dossier-panel">
              <h3>Vendor & verification</h3>
              <div className="request-dossier-vendor-title"><strong>{request.vendor?.name || 'No vendor recorded'}</strong><span>{request.threeWayMatch.status}</span></div>
              {request.vendor && <dl className="request-dossier-facts">
                <div><dt>Vendor code</dt><dd>{request.vendor.code}</dd></div>
                <div><dt>Category</dt><dd>{humanize(request.vendor.category)}</dd></div>
                <div><dt>Tax ID</dt><dd>{request.vendor.taxId || 'Not recorded'}</dd></div>
                <div><dt>Rating</dt><dd>{request.vendor.rating}/5</dd></div>
              </dl>}
              <ul className="request-dossier-checks">
                <li><FileCheck2 size={14} /> {request.threeWayMatch.poMatched ? 'Purchase order recorded' : 'Purchase order not recorded'}</li>
                <li><FileCheck2 size={14} /> {request.threeWayMatch.quoteAttached ? 'Quotation attached' : 'Quotation not recorded'}</li>
                <li><FileCheck2 size={14} /> {request.threeWayMatch.scopeVerified ? 'Scope verified' : 'Scope not verified'}</li>
              </ul>
            </section>
            <section className="request-dossier-requester">
              <span><UserRound size={16} /></span>
              <div><strong>{request.requester.name}</strong><small>{humanize(request.requester.role)} · {request.requester.department} · {request.requester.employeeNumber}</small></div>
            </section>
            <section className="request-dossier-panel">
              <h3>Request conversation</h3>
              {request.recentMessages.length > 0
                ? <div className="request-dossier-messages">{[...request.recentMessages].reverse().slice(-3).map((message) => <article key={message.id}><div><strong>{message.authorName}</strong><time>{new Date(message.createdAt).toLocaleString('en-GB')}</time></div><p>{message.body}</p></article>)}</div>
                : <p>No messages yet.</p>}
              <button type="button" onClick={() => setChatOpen(true)} className="request-dossier-text-link">Open request chat →</button>
            </section>
          </div>

          <div className="request-dossier-column">
            <section className="request-dossier-panel request-dossier-budget">
              <h3>Request & budget position</h3>
              <div className="request-dossier-amount"><strong>{request.amountFormatted}</strong><span>{request.budgetImpact.percentOfBudget}% of annual cap</span></div>
              <div className="request-dossier-progress"><i style={{ width: `${Math.min(100, Math.max(0, Math.round((request.budgetImpact.spentSoFar + request.amount) / Math.max(request.budgetImpact.totalBudget, 1) * 100)))}%` }} /></div>
              <dl className="request-dossier-budget-facts">
                <div><dt>Annual budget cap</dt><dd>{money(request.budgetImpact.totalBudget)}</dd></div>
                <div><dt>Spent before this request</dt><dd>{money(request.budgetImpact.spentSoFar)}</dd></div>
                <div><dt>Remaining after approval</dt><dd>{money(request.budgetImpact.remainingAfter)}</dd></div>
              </dl>
            </section>
            <section className="request-dossier-panel">
              <h3>Request status</h3>
              <div className="request-dossier-statuses">
                <div><span>Approval</span><strong>{humanize(request.approvalStatus)}</strong></div>
                <div><span>Payment</span><strong>{humanize(request.paymentStatus)}</strong></div>
                <div><span>Accountability</span><strong>{humanize(request.accountabilityStatus)}</strong></div>
              </div>
              <div className="request-dossier-facts request-dossier-facts-spaced">
                <div><span>Submitted</span><strong>{new Date(request.createdAt).toLocaleDateString('en-GB')}</strong></div>
                <div><span>Request type</span><strong>{request.isRecurring ? `Recurring · ${humanize(request.recurringInterval || 'unspecified')}` : 'One-time'}</strong></div>
              </div>
            </section>
            <section className="request-dossier-panel">
              <h3>Approval chain & audit history</h3>
              {request.approvalSteps.length > 0 ? <ol className="request-dossier-steps">{request.approvalSteps.map((step) => <li key={step.id}>
                <span className={step.status === 'APPROVED' ? 'request-dossier-step-icon approved' : 'request-dossier-step-icon'}>{step.status === 'APPROVED' ? '✓' : step.stageIndex}</span>
                <div><div className="request-dossier-step-title"><strong>Stage {step.stageIndex}: {humanize(step.assignedRole)}</strong><b>{humanize(step.status)}</b></div>
                  {step.approverName && <small>Reviewer: {step.approverName}</small>}
                  {step.decisionReason && <p>{step.decisionReason}</p>}
                </div>
              </li>)}</ol> : <p>No approval history recorded yet.</p>}
            </section>
            <div className="request-dossier-note"><Building2 size={15} /> Read-only request history. Decisions remain in the Approvals Desk.</div>
          </div>
        </div>
      </section>
      {chatOpen && <RequestChatModal
        requestNumber={request.requestNumber}
        title={request.title}
        initialMessages={request.recentMessages}
        onClose={() => setChatOpen(false)}
      />}
    </div>
  );
}
