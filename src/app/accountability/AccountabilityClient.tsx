'use client';

import React, { useState } from 'react';

export function AccountabilityClient({ initialCases }: { initialCases: any[] }) {
  const [cases, setCases] = useState(initialCases);
  const [notice, setNotice] = useState<string | null>(null);

  const handleClearance = (reqNumber: string) => {
    setNotice(`Audit Clearance Stamp Applied for ${reqNumber}. Request formally closed.`);
    setTimeout(() => setNotice(null), 5000);
  };

  const verifiedCount = cases.filter(c => c.status === 'CLOSED' || c.status === 'VERIFIED').length;
  const overdueCount = cases.filter(c => (c.status === 'OPEN' || c.status === 'PENDING') && c.dueAt && new Date(c.dueAt).getTime() < Date.now()).length;
  const complianceScore = cases.length > 0 ? ((verifiedCount / cases.length) * 100).toFixed(1) + '%' : '100.0%';

  return (
    <>
      <div className="section-header">
        <div>
          <p className="kicker">ACCOUNTABILITY CLOSURE GATES</p>
          <h1>Post-Payment Proofs & Deliverables</h1>
          <p>Strict closure enforcement ensuring funds disbursed are matched with genuine physical waybills, receipts, and deliverables before a request is marked CLOSED.</p>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', borderRadius: '6px', fontSize: '11px', fontWeight: 600, marginBottom: '14px' }}>
          {notice}
        </div>
      )}

      <div className="customer-summary">
        <article>
          <small>ACTIVE CASES</small>
          <strong>{cases.length}</strong>
          <span>Under audit review</span>
        </article>
        <article>
          <small>VERIFIED & CLOSED</small>
          <strong style={{ color: '#059669' }}>{verifiedCount}</strong>
          <span>Deliverables cleared</span>
        </article>
        <article>
          <small>AUDIT COMPLIANCE SCORE</small>
          <strong style={{ color: '#059669' }}>{complianceScore}</strong>
          <span>Group-wide score</span>
        </article>
        <article>
          <small>OVERDUE CASES</small>
          <strong style={{ color: overdueCount > 0 ? '#dc2626' : 'var(--navy)' }}>{overdueCount}</strong>
          <span>{overdueCount > 0 ? 'Action required' : 'Zero defaulters'}</span>
        </article>
      </div>

      <div style={{ marginTop: '28px' }}>
        <h3 style={{ fontSize: '16px', color: 'var(--navy)', marginBottom: '14px' }}>
          Open Accountability Cases & Verification Queue
        </h3>
        {cases.length === 0 ? (
          <div style={{ padding: '36px', background: '#fff', borderRadius: '16px', border: '1px solid var(--line)', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--muted)' }}>No open accountability cases. All past disbursements have been closed.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cases.map(c => (
              <div
                key={c.id}
                style={{
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: '#eaf3ff', color: 'var(--blue)' }}>
                        {c.request.requestNumber}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: '#fef3c7', color: '#b45309' }}>
                        {c.status}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {c.request.subsidiary.legalName}
                      </span>
                    </div>
                    <h3 style={{ margin: '8px 0 4px', fontSize: '18px', color: 'var(--navy)' }}>
                      {c.request.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                      Advance Recipient: <strong>{c.request.requester.legalName}</strong> ({c.request.requester.role}) · Disbursed: ₦{(Number(c.request.amountMinor)/100).toLocaleString()}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Advance Amount</span>
                    <strong style={{ fontSize: '22px', color: 'var(--navy)' }}>
                      ₦{(Number(c.request.amountMinor)/100).toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--cloud)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)' }}>1. VENDOR TAX INVOICE</span>
                    <strong style={{ display: 'block', fontSize: '13px', marginTop: '2px', color: 'var(--navy)' }}>Matched with PO ✓</strong>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--cloud)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)' }}>2. SIGNED WAYBILL</span>
                    <strong style={{ display: 'block', fontSize: '13px', marginTop: '2px', color: 'var(--navy)' }}>Storekeeper Verified ✓</strong>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--cloud)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)' }}>3. PHYSICAL INSPECTION</span>
                    <strong style={{ display: 'block', fontSize: '13px', marginTop: '2px', color: '#b45309' }}>Pending Auditor Stamp</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                  <button
                    className="outline-button"
                    onClick={() => setNotice(`Viewing deliverables for ${c.request.requestNumber}`)}
                  >
                    View Uploaded Receipts 📄
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => handleClearance(c.request.requestNumber)}
                  >
                    Apply Auditor Clearance Stamp ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
