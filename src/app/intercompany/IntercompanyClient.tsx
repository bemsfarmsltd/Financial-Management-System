'use client';

import React, { useState, useEffect } from 'react';

export function IntercompanyClient({ initialNotes, scope }: { initialNotes?: any[]; scope?: string }) {
  const [notes, setNotes] = useState(initialNotes || []);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const query = scope ? `?subsidiary=${encodeURIComponent(scope)}` : '';
    fetch(`/api/intercompany${query}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d && d.notes) setNotes(d.notes); })
      .catch(() => {});
  }, [scope]);

  const handleGenerate = () => {
    setNotice('Generated New Intercompany Note: ICN-2026-0014 for October DevOps recharge (70/30 split).');
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <p className="kicker">LEGAL & INTER-ENTITY RECONCILIATION</p>
          <h1>Automated Intercompany Debit / Credit Notes</h1>
          <p>Formal inter-subsidiary billing, shared payroll recharges, and monthly clearing for tax and governance compliance.</p>
        </div>
        <button
          className="primary-button"
          onClick={handleGenerate}
        >
          Generate Debit Note <span>＋</span>
        </button>
      </div>

      {notice && (
        <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', borderRadius: '6px', fontSize: '11px', fontWeight: 600, marginBottom: '14px' }}>
          {notice}
        </div>
      )}

      <div className="customer-summary">
        <article>
          <small>TOTAL ACTIVE NOTES</small>
          <strong>{notes.length}</strong>
          <span>Recorded this quarter</span>
        </article>
        <article>
          <small>NET RECEIVABLE (BemsSoft)</small>
          <strong style={{ color: '#059669' }}>₦1,425,000</strong>
          <span>Due from Bems Farms Ltd</span>
        </article>
        <article>
          <small>NET PAYABLE</small>
          <strong>₦0</strong>
          <span>Zero outstanding debts</span>
        </article>
        <article>
          <small>CLEARING CYCLE</small>
          <strong style={{ color: 'var(--blue)' }}>Monthly (30th)</strong>
          <span>Reconciliation schedule</span>
        </article>
      </div>

      <div style={{ marginTop: '28px' }}>
        <h3 style={{ fontSize: '16px', color: 'var(--navy)', marginBottom: '12px' }}>
          Intercompany Billing & Settlement Register
        </h3>
        <section className="card data-register">
          <div className="register-head">
            <span>Note Reference & Title</span>
            <span>Billing Entity</span>
            <span>Recipient Entity</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Settlement Date</span>
            <span />
          </div>
          {notes.map(n => (
            <div className="register-row" key={n.id}>
              <span>
                <i>▥</i>
                <strong>{n.noteNumber}</strong>
                <small>{n.description}</small>
              </span>
              <span><strong>{n.sourceEntity.code}</strong></span>
              <span><strong>{n.targetEntity.code}</strong></span>
              <strong style={{ color: 'var(--navy)', fontSize: '14px' }}>₦{(Number(n.totalAmountMinor)/100).toLocaleString()}</strong>
              <b className={n.status === 'SETTLED' ? 'good' : 'review'}>{n.status}</b>
              <span>{new Date(n.generatedAt).toLocaleDateString()}</span>
              <em>Download Note ↗</em>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
