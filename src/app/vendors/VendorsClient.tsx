'use client';

import React, { useState } from 'react';

export function VendorsClient({ initialVendors }: { initialVendors: any[] }) {
  const [vendors] = useState(initialVendors);
  const [notice, setNotice] = useState<string | null>(null);

  const handleAddVendor = () => {
    setNotice('Vendor Registration: Enter Legal Name, TIN, and Bank details for verification.');
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <p className="kicker">PROCUREMENT & BENCHMARKS</p>
          <h1>Vendor Registry & 3-Way Matching</h1>
          <p>Approved group suppliers, verified Tax Identification Numbers (TIN), bank details, and historical commodity price benchmarks.</p>
        </div>
        <button
          className="primary-button"
          onClick={handleAddVendor}
        >
          Add Approved Vendor <span>＋</span>
        </button>
      </div>

      {notice && (
        <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', borderRadius: '6px', fontSize: '11px', fontWeight: 600, marginBottom: '14px' }}>
          {notice}
        </div>
      )}

      <div className="customer-summary">
        <article>
          <small>VETTED VENDORS</small>
          <strong>{vendors.length} Active</strong>
          <span>TIN & Bank verified</span>
        </article>
        <article>
          <small>COMMODITY BENCHMARKS</small>
          <strong>4 Categories</strong>
          <span>Diesel, Hosting, Hardware, Agro</span>
        </article>
        <article>
          <small>3-WAY MATCHING</small>
          <strong style={{ color: '#059669' }}>Enforced</strong>
          <span>PO vs Invoice vs Waybill</span>
        </article>
        <article>
          <small>PRICE INTEGRITY</small>
          <strong style={{ color: 'var(--blue)' }}>Strict</strong>
          <span>Zero unauthorized markups</span>
        </article>
      </div>

      <div style={{ marginTop: '28px' }}>
        <h3 style={{ fontSize: '16px', color: 'var(--navy)', marginBottom: '12px' }}>
          Approved Suppliers & Banking Registry
        </h3>
        <section className="card data-register">
          <div className="register-head">
            <span>Vendor Code & Legal Name</span>
            <span>Category</span>
            <span>Bank & Account Number</span>
            <span>TIN</span>
            <span>Quality Rating</span>
            <span />
          </div>
          {vendors.map(v => (
            <div className="register-row" key={v.id}>
              <span>
                <i>🏢</i>
                <strong>{v.name}</strong>
                <small>{v.code}</small>
              </span>
              <span><strong>{v.category}</strong></span>
              <span>
                <strong>{v.bankName || 'Not recorded'}</strong>
                <small>{v.accountNumber || '—'}</small>
              </span>
              <span>{v.taxId || 'Verified TIN'}</span>
              <b className="good">★ {v.rating}.0</b>
              <em>View Ledger ↗</em>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
