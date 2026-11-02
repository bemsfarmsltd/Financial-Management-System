'use client';

import React, { useState, useMemo } from 'react';
import { Search, Filter, Building2, CheckCircle2 } from 'lucide-react';

export function VendorsClient({ initialVendors }: { initialVendors: any[] }) {
  const [vendors] = useState(initialVendors);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const categories = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach(v => {
      if (v.category) set.add(v.category);
    });
    return Array.from(set);
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.code && v.code.toLowerCase().includes(q)) ||
        (v.taxId && v.taxId.toLowerCase().includes(q)) ||
        (v.bankName && v.bankName.toLowerCase().includes(q)) ||
        (v.accountNumber && v.accountNumber.toLowerCase().includes(q));

      const matchesCategory = categoryFilter === 'ALL' || v.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [vendors, searchQuery, categoryFilter]);

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
          <strong>{categories.length || 4} Categories</strong>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 style={{ fontSize: '16px', color: 'var(--navy)', margin: 0 }}>
            Approved Suppliers & Banking Registry
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Showing {filteredVendors.length} of {vendors.length} vendors
          </span>
        </div>

        {/* Multi-Filter Toolbar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search vendor name, code, bank, or TIN…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 11,
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#334155',
                }}
              >
                <option value="ALL">All Categories ({categories.length})</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {(searchQuery || categoryFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('ALL');
              }}
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

        {filteredVendors.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px dashed #cbd5e1', color: '#64748b', fontSize: 12 }}>
            No approved suppliers match your current search and filter criteria.
          </div>
        ) : (
          <section className="card data-register">
            <div className="register-head">
              <span>Vendor Code & Legal Name</span>
              <span>Category</span>
              <span>Bank & Account Number</span>
              <span>TIN</span>
              <span>Quality Rating</span>
              <span />
            </div>
            {filteredVendors.map(v => (
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
        )}
      </div>
    </>
  );
}
