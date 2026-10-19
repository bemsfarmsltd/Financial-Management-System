'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface BudgetLine {
  id: string;
  departmentName: string;
  category: string;
  expenseType: string;
  allocatedAmount: number;
  committedAmount: number;
  spentAmount: number;
  status: string;
}

interface Budget {
  id: string;
  organizationId: string;
  organization: {
    id: string;
    legalName: string;
    code: string;
  };
  fiscalYear: number;
  fiscalPeriod: string;
  periodName: string;
  totalAmount: number;
  committedAmount: number;
  spentAmount: number;
  status: string;
  warningThreshold: number;
  createdAt: string;
  lines: BudgetLine[];
}

interface Org {
  id: string;
  legalName: string;
  code: string;
}

export function BudgetsClient({
  initialBudgets,
  organizations: initialOrgs
}: {
  initialBudgets?: Budget[];
  organizations?: Org[];
}) {
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets || []);
  const [orgs, setOrgs] = useState<Org[]>(initialOrgs || []);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialBudgets || initialBudgets.length === 0) {
      fetch('/api/budgets')
        .then(r => r.json())
        .then(d => { if (d && d.budgets) setBudgets(d.budgets); })
        .catch(() => {});
    }
    if (!initialOrgs || initialOrgs.length === 0) {
      fetch('/api/organizations')
        .then(r => r.json())
        .then(d => {
          if (d && d.organizations) {
            const mapped = d.organizations.map((o: any) => ({
              id: o.id,
              legalName: o.legalName || o.name,
              code: o.code
            }));
            setOrgs(mapped);
            if (mapped[0]) setOrgId(mapped[0].id);
          }
        })
        .catch(() => {});
    }
  }, [initialBudgets, initialOrgs]);

  // Form state
  const [orgId, setOrgId] = useState(initialOrgs?.[0]?.id || '');
  const [periodName, setPeriodName] = useState('Q4 2026 - Digital & Infrastructure');
  const [fiscalYear, setFiscalYear] = useState(2026);
  const [fiscalPeriod, setFiscalPeriod] = useState('Q4');
  const [totalAmount, setTotalAmount] = useState(30000000);
  const [warningThreshold, setWarningThreshold] = useState(80);
  const [lines, setLines] = useState<Array<{ departmentName: string; category: string; expenseType: string; allocatedAmount: number }>>([
    { departmentName: 'Engineering & Cloud', category: 'Cloud Infrastructure & Hosting', expenseType: 'OPEX', allocatedAmount: 12000000 },
    { departmentName: 'IT Operations', category: 'Workstations & Network Hardware', expenseType: 'CAPEX', allocatedAmount: 8000000 },
    { departmentName: 'Fleet Operations', category: 'Diesel & Logistics', expenseType: 'OPEX', allocatedAmount: 6000000 },
    { departmentName: 'Administration', category: 'Office Operations & Utilities', expenseType: 'OPEX', allocatedAmount: 4000000 },
  ]);

  const filteredBudgets = selectedOrgId === 'all'
    ? budgets
    : budgets.filter(b => b.organizationId === selectedOrgId);

  const totalAllocated = filteredBudgets.reduce((acc, b) => acc + b.totalAmount, 0);
  const totalCommitted = filteredBudgets.reduce((acc, b) => acc + b.committedAmount, 0);
  const totalSpent = filteredBudgets.reduce((acc, b) => acc + b.spentAmount, 0);
  const totalRemaining = totalAllocated - totalCommitted - totalSpent;
  const overallUtilization = totalAllocated > 0
    ? Math.round(((totalCommitted + totalSpent) / totalAllocated) * 100)
    : 0;

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      { departmentName: 'Operations', category: 'Operational Expenses', expenseType: 'OPEX', allocatedAmount: 1000000 }
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    setLines(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          periodName,
          fiscalYear,
          fiscalPeriod,
          totalAmount,
          warningThreshold,
          lines
        })
      });
      const data = await res.json();
      if (data && data.budget) {
        setBudgets(prev => [data.budget, ...prev]);
        setCreateModalOpen(false);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* SECTION HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            EXECUTIVE FINANCIAL CONTROL · BUD-01 / BUD-05
          </span>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '3px 0 2px', letterSpacing: '-0.3px', color: '#0f172a' }}>
            Budgets & Commitments Desk
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
            Establish fiscal periods, allocate department spending caps, track pre-approved commitments, and enforce over-budget escalation rules.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: 'none',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)'
          }}
        >
          <span>＋</span> Create Fiscal Budget
        </button>
      </div>

      {/* KPI RIBBON */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
          borderRadius: '10px',
          padding: '12px 14px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box',
          boxShadow: '0 3px 12px rgba(234, 88, 12, 0.25)'
        }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#ffedd5', textTransform: 'uppercase' }}>
            TOTAL BUDGET CAP
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1 }}>₦{totalAllocated.toLocaleString()}</div>
            <div style={{ fontSize: '9px', color: '#ffedd5', marginTop: '2px' }}>Approved Envelopes</div>
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
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
            COMMITTED (PIPELINE)
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706', lineHeight: 1.1 }}>₦{totalCommitted.toLocaleString()}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Approved Pending Payout</div>
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
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
            ACTUAL DISBURSED
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0d8a70', lineHeight: 1.1 }}>₦{totalSpent.toLocaleString()}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Realized Cash Outflows</div>
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
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
            HEADROOM AVAILABLE
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c', lineHeight: 1.1 }}>₦{Math.max(0, totalRemaining).toLocaleString()}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{overallUtilization}% Total Consumed</div>
          </div>
        </div>
      </div>

      {/* SUBSIDIARY FILTER TABS */}
      <div style={{ display: 'flex', gap: '6px', margin: '0 0 14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
        <button
          onClick={() => setSelectedOrgId('all')}
          style={{
            border: 0,
            background: selectedOrgId === 'all' ? '#ea580c' : '#f1f5f9',
            color: selectedOrgId === 'all' ? '#fff' : '#475569',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          All Entities ({budgets.length})
        </button>
        {orgs.map(org => (
          <button
            key={org.id}
            onClick={() => setSelectedOrgId(org.id)}
            style={{
              border: 0,
              background: selectedOrgId === org.id ? '#ea580c' : '#f1f5f9',
              color: selectedOrgId === org.id ? '#fff' : '#475569',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {org.legalName}
          </button>
        ))}
      </div>

      {/* BUDGET ENVELOPES & DEPARTMENT LINES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {filteredBudgets.length === 0 ? (
          <div style={{ padding: '60px 20px', background: '#fff', borderRadius: '16px', textAlign: 'center', border: '1px dashed var(--line)' }}>
            <h3 style={{ margin: 0, color: 'var(--navy)' }}>No Fiscal Budgets Configured</h3>
            <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '13px' }}>
              Create an operating or capital budget envelope for this subsidiary to begin tracking committed funds.
            </p>
            <button
              className="primary-button"
              onClick={() => setCreateModalOpen(true)}
              style={{ marginTop: '14px' }}
            >
              ＋ Create First Budget
            </button>
          </div>
        ) : (
          filteredBudgets.map(budget => {
            const consumed = budget.committedAmount + budget.spentAmount;
            const pct = budget.totalAmount > 0 ? Math.round((consumed / budget.totalAmount) * 100) : 0;
            const isWarning = pct >= budget.warningThreshold;

            return (
              <section key={budget.id} className="card" style={{ padding: '16px', borderRadius: '10px' }}>
                {/* BUDGET HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '800', background: '#fff7ed', color: '#ea580c', padding: '2px 6px', borderRadius: '4px' }}>
                        {budget.organization.code}
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: '800', background: '#e7f8ef', color: '#0d8a70', padding: '2px 6px', borderRadius: '4px' }}>
                        {budget.fiscalPeriod} {budget.fiscalYear}
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: '700', background: isWarning ? '#fee2e2' : '#f0fdf4', color: isWarning ? '#b91c1c' : '#15803d', padding: '2px 6px', borderRadius: '4px' }}>
                        {pct}% Utilized {isWarning ? '⚠️ Alert Threshold' : '✓ Normal'}
                      </span>
                    </div>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '6px 0 2px', color: 'var(--navy)' }}>
                      {budget.periodName}
                    </h2>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                      Entity: <strong>{budget.organization.legalName}</strong> · Alert Threshold: {budget.warningThreshold}%
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '9px', color: 'var(--muted)', display: 'block', fontWeight: 700 }}>TOTAL ENVELOPE</span>
                    <strong style={{ fontSize: '18px', color: 'var(--navy)', fontWeight: 700 }}>
                      ₦{budget.totalAmount.toLocaleString()}
                    </strong>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                      Committed: <b style={{ color: '#d97706' }}>₦{budget.committedAmount.toLocaleString()}</b> · Disbursed: <b style={{ color: '#0d8a70' }}>₦{budget.spentAmount.toLocaleString()}</b>
                    </div>
                  </div>
                </div>

                {/* VISUAL UTILIZATION BAR */}
                <div style={{ background: '#e8edf3', height: '10px', borderRadius: '6px', overflow: 'hidden', display: 'flex', marginBottom: '22px' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (budget.spentAmount / budget.totalAmount) * 100)}%`,
                      background: '#0d8a70'
                    }}
                    title={`Spent: ₦${budget.spentAmount.toLocaleString()}`}
                  />
                  <div
                    style={{
                      width: `${Math.min(100, (budget.committedAmount / budget.totalAmount) * 100)}%`,
                      background: '#d97706'
                    }}
                    title={`Committed: ₦${budget.committedAmount.toLocaleString()}`}
                  />
                </div>

                {/* DEPARTMENT LINES TABLE */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                        <th style={{ padding: '8px 12px' }}>DEPARTMENT</th>
                        <th style={{ padding: '8px 12px' }}>CATEGORY</th>
                        <th style={{ padding: '8px 12px' }}>TYPE</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>ALLOCATED</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>COMMITTED</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>DISBURSED</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>REMAINING</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.lines.map(line => {
                        const lineConsumed = line.committedAmount + line.spentAmount;
                        const lineRem = line.allocatedAmount - lineConsumed;
                        const linePct = line.allocatedAmount > 0 ? Math.round((lineConsumed / line.allocatedAmount) * 100) : 0;
                        const lineDanger = linePct >= 90;
                        const lineWarn = linePct >= 75 && linePct < 90;

                        return (
                          <tr key={line.id} style={{ borderBottom: '1px solid #f0f4f9' }}>
                            <td style={{ padding: '12px', fontWeight: '700', color: 'var(--navy)' }}>
                              {line.departmentName}
                            </td>
                            <td style={{ padding: '12px', color: 'var(--muted)' }}>
                              {line.category}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: line.expenseType === 'CAPEX' ? '#f3e8ff' : '#fff7ed',
                                color: line.expenseType === 'CAPEX' ? '#6b21a8' : '#ea580c'
                              }}>
                                {line.expenseType}
                              </span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700' }}>
                              ₦{line.allocatedAmount.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#d97706' }}>
                              ₦{line.committedAmount.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#0d8a70' }}>
                              ₦{line.spentAmount.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: lineRem < 0 ? '#b91c1c' : 'var(--navy)' }}>
                              ₦{lineRem.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: lineDanger ? '#fee2e2' : lineWarn ? '#fef3c7' : '#dcfce7',
                                color: lineDanger ? '#b91c1c' : lineWarn ? '#b45309' : '#15803d'
                              }}>
                                {linePct}% {lineDanger ? 'CRITICAL' : lineWarn ? 'WARNING' : 'HEALTHY'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* OVER BUDGET POLICY NOTICE */}
                <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🛡️</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      <strong>BUD-05 Exception Routing:</strong> Any request submitted against these lines exceeding available allocation automatically escalates to GMD Level-3 Emergency Sign-Off.
                    </span>
                  </div>
                  <Link
                    href="/requests"
                    style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: '700', textDecoration: 'none' }}
                  >
                    View Requests →
                  </Link>
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* CREATE BUDGET MODAL */}
      {createModalOpen && (
        <div className="template-modal" role="dialog" aria-modal="true" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(6,26,66,0.6)', zIndex: 100, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '700px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', padding: '28px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <p className="kicker" style={{ margin: 0 }}>GMD EXECUTIVE ACTION</p>
                <h2 style={{ margin: '4px 0 0', color: 'var(--navy)', fontSize: '20px' }}>Create New Fiscal Budget</h2>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{ border: 0, background: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateBudget}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>Subsidiary Entity</label>
                  <select
                    value={orgId}
                    onChange={e => setOrgId(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}
                    required
                  >
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.legalName} ({o.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>Budget Period Name</label>
                  <input
                    type="text"
                    value={periodName}
                    onChange={e => setPeriodName(e.target.value)}
                    placeholder="e.g. Q4 2026 - Innovation & Growth"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>Fiscal Year</label>
                  <input
                    type="number"
                    value={fiscalYear}
                    onChange={e => setFiscalYear(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>Period</label>
                  <select
                    value={fiscalPeriod}
                    onChange={e => setFiscalPeriod(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                    <option value="ANNUAL">Annual Envelope</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>Total Approved Cap (₦)</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={e => setTotalAmount(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                    required
                  />
                </div>
              </div>

              {/* DEPARTMENT ALLOCATION LINES */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--navy)' }}>Department Allocations</label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    style={{ border: 0, background: '#eaf2ff', color: 'var(--blue)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    ＋ Add Department Line
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lines.map((l, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 2fr 30px', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Department"
                        value={l.departmentName}
                        onChange={e => handleLineChange(i, 'departmentName', e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px' }}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Category"
                        value={l.category}
                        onChange={e => handleLineChange(i, 'category', e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px' }}
                        required
                      />
                      <select
                        value={l.expenseType}
                        onChange={e => handleLineChange(i, 'expenseType', e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px', background: '#fff' }}
                      >
                        <option value="OPEX">OPEX</option>
                        <option value="CAPEX">CAPEX</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Allocated ₦"
                        value={l.allocatedAmount}
                        onChange={e => handleLineChange(i, 'allocatedAmount', Number(e.target.value))}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(i)}
                        style={{ border: 0, background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', height: '32px', cursor: 'pointer', fontWeight: '700' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* MODAL ACTIONS */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{ border: '1px solid var(--line)', background: '#fff', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="primary-button"
                  style={{ padding: '10px 22px', fontSize: '12px', fontWeight: '700' }}
                >
                  {saving ? 'Creating Budget...' : 'Confirm & Activate Budget Envelope'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
