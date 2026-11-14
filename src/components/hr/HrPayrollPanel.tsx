'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, ArrowUpRight, Plus, Check, X } from 'lucide-react';
import { TreasuryFinanceHubView } from '@/components/dashboard/gmd/TreasuryFinanceHubView';
import { formatNairaMinor } from './hrTypes';

interface HrPayrollPanelProps {
  selectedSubsidiaryId: string;
  activeBrandColor?: string;
  businessName?: string;
  userName?: string;
  businessCode?: string;
}

const PIPELINE_STAGES = [
  '1. HR Prepares',
  '2. Draft Calculation',
  '3. Exception Review',
  '4. Management Approves',
  '5. Finance Pays',
  '6. Payslips Published',
];

export default function HrPayrollPanel({
  selectedSubsidiaryId,
  activeBrandColor = '#ea580c',
  businessName = 'BEMS Group',
  userName = 'Executive',
  businessCode,
}: HrPayrollPanelProps) {
  const [tab, setTab] = useState<'ENGINE' | 'BATCHES' | 'DEDUCTIONS' | 'LOANS'>('ENGINE');
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Forms
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [dedForm, setDedForm] = useState({ employeeId: '', category: 'LATENESS', direction: 'DEDUCTION', amountNaira: '', reason: '' });

  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanForm, setLoanForm] = useState({ employeeId: '', loanType: 'SALARY_ADVANCE', principalNaira: '', tenureMonths: '3', reason: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/payroll${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setBatches(data.batches || []);
        setDeductions(data.deductions || []);
        setLoans(data.loans || []);
        setStaffOptions(data.staffOptions || []);
      }
    } catch {
      setBanner({ type: 'err', text: 'Failed to load payroll data.' });
    } finally {
      setLoading(false);
    }
  }, [selectedSubsidiaryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitAction = async (payload: Record<string, unknown>) => {
    setBanner(null);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/payroll${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'err', text: data.error || 'Action failed.' });
      } else {
        setBanner({ type: 'ok', text: 'Payroll update saved.' });
        setShowDeductionForm(false);
        setShowLoanForm(false);
        await loadData();
      }
    } catch {
      setBanner({ type: 'err', text: 'Network error processing payroll action.' });
    }
  };

  const latest = batches[0];
  const activeStageIdx = !latest
    ? 0
    : latest.status === 'DISBURSED'
      ? 5
      : latest.status === 'APPROVED'
        ? 4
        : latest.status === 'SUBMITTED'
          ? 3
          : 1;

  const approvedDeductionsTotal = deductions
    .filter((d) => d.status === 'APPROVED' && d.direction === 'DEDUCTION')
    .reduce((acc, d) => acc + Number(d.amountMinor || 0), 0);

  const activeLoansBalance = loans
    .filter((l) => l.status === 'ACTIVE' || l.status === 'APPROVED')
    .reduce((acc, l) => acc + Number(l.remainingBalanceMinor || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {banner && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12.5px',
            fontWeight: 700,
            background: banner.type === 'ok' ? '#ecfdf5' : '#fef2f2',
            color: banner.type === 'ok' ? '#047857' : '#b91c1c',
            border: `1px solid ${banner.type === 'ok' ? '#a7f3d0' : '#fecaca'}`,
          }}
        >
          {banner.text}
        </div>
      )}

      {/* Clean Underline Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {[
            { id: 'ENGINE', label: 'Hybrid Payroll Engine & Sign-off' },
            { id: 'DEDUCTIONS', label: `Deductions & Adjustments (${deductions.length})` },
            { id: 'LOANS', label: `Loans & Advances (${loans.length})` },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as any)}
                style={{
                  padding: '10px 4px',
                  border: 'none',
                  borderBottom: `2.5px solid ${active ? activeBrandColor : 'transparent'}`,
                  background: 'transparent',
                  color: active ? activeBrandColor : '#64748b',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingBottom: '8px' }}>
          <Link
            href="/finance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: `${activeBrandColor}14`,
              color: activeBrandColor,
              fontSize: '11.5px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Open Finance Payment Sign-Off <ArrowUpRight size={13} />
          </Link>
          {tab === 'DEDUCTIONS' && (
            <button
              type="button"
              onClick={() => setShowDeductionForm((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeBrandColor,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Propose Adjustment
            </button>
          )}
          {tab === 'LOANS' && (
            <button
              type="button"
              onClick={() => setShowLoanForm((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeBrandColor,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Record Loan / Advance
            </button>
          )}
        </div>
      </div>

      {/* Deduction Proposal Form */}
      {tab === 'DEDUCTIONS' && showDeductionForm && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <select value={dedForm.employeeId} onChange={(e) => setDedForm({ ...dedForm, employeeId: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
            <option value="">Select Employee...</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.legalName} ({s.employeeNumber})</option>
            ))}
          </select>
          <select value={dedForm.direction} onChange={(e) => setDedForm({ ...dedForm, direction: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
            <option value="DEDUCTION">Deduction</option>
            <option value="EARNING">Bonus / Allowance</option>
          </select>
          <select value={dedForm.category} onChange={(e) => setDedForm({ ...dedForm, category: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
            {['LATENESS', 'ABSENCE', 'DAMAGE', 'LOAN_REPAYMENT', 'TAX_ADJUSTMENT', 'BONUS', 'ALLOWANCE', 'OTHER'].map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input type="number" placeholder="Amount (₦)" value={dedForm.amountNaira} onChange={(e) => setDedForm({ ...dedForm, amountNaira: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
          <input type="text" placeholder="Reason / Evidence note" value={dedForm.reason} onChange={(e) => setDedForm({ ...dedForm, reason: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
          <button type="button" onClick={() => submitAction({ action: 'PROPOSE_DEDUCTION', ...dedForm })} style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', background: activeBrandColor, color: '#ffffff', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
            Submit Proposal
          </button>
        </div>
      )}

      {/* Loan Form */}
      {tab === 'LOANS' && showLoanForm && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <select value={loanForm.employeeId} onChange={(e) => setLoanForm({ ...loanForm, employeeId: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
            <option value="">Select Employee...</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.legalName} ({s.employeeNumber})</option>
            ))}
          </select>
          <select value={loanForm.loanType} onChange={(e) => setLoanForm({ ...loanForm, loanType: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
            <option value="SALARY_ADVANCE">Salary Advance</option>
            <option value="STAFF_LOAN">Staff Loan</option>
            <option value="EMERGENCY">Emergency Loan</option>
          </select>
          <input type="number" placeholder="Principal (₦)" value={loanForm.principalNaira} onChange={(e) => setLoanForm({ ...loanForm, principalNaira: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
          <input type="number" placeholder="Tenure (Months)" value={loanForm.tenureMonths} onChange={(e) => setLoanForm({ ...loanForm, tenureMonths: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
          <input type="text" placeholder="Purpose / Reason" value={loanForm.reason} onChange={(e) => setLoanForm({ ...loanForm, reason: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
          <button type="button" onClick={() => submitAction({ action: 'CREATE_LOAN', ...loanForm })} style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', background: activeBrandColor, color: '#ffffff', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
            Create Loan
          </button>
        </div>
      )}

      {/* Main Register Card */}
      {tab === 'ENGINE' ? (
        <div style={{ width: '100%' }}>
          <TreasuryFinanceHubView
            initialTab="payroll"
            businessName={businessName}
            userName={userName}
            businessId={selectedSubsidiaryId || undefined}
            businessCode={businessCode}
            onNavigate={() => {}}
            onSelectBusiness={() => {}}
          />
        </div>
      ) : (
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading payroll register...</div>
        ) : tab === 'BATCHES' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11.5px', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Period</th>
                  <th style={{ padding: '12px 16px' }}>Type / Ver</th>
                  <th style={{ padding: '12px 16px' }}>Headcount</th>
                  <th style={{ padding: '12px 16px' }}>Gross Pay</th>
                  <th style={{ padding: '12px 16px' }}>Net Disbursement</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No payroll batches found.</td></tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {b.period?.year}-{String(b.period?.month).padStart(2, '0')}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{b.payrollType} (v{b.version})</td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{b.items?.length || 0} staff</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{formatNairaMinor(b.totalGrossMinor)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#059669' }}>{formatNairaMinor(b.totalNetMinor)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: `${activeBrandColor}15`, color: activeBrandColor }}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : tab === 'DEDUCTIONS' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11.5px', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Employee</th>
                  <th style={{ padding: '12px 16px' }}>Category &amp; Direction</th>
                  <th style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px' }}>Reason</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deductions.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No deductions or adjustments recorded.</td></tr>
                ) : (
                  deductions.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{d.employee?.legalName}</td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{d.direction} · {d.category.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: d.direction === 'DEDUCTION' ? '#dc2626' : '#059669' }}>
                        {formatNairaMinor(d.amountMinor)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>{d.reason}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#334155' }}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {(d.status === 'PROPOSED' || d.status === 'DISPUTED') && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" onClick={() => submitAction({ action: 'REVIEW_DEDUCTION', id: d.id, decision: 'APPROVED' })} style={{ padding: '5px 8px', borderRadius: '7px', border: 'none', background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={12} /> Approve
                            </button>
                            <button type="button" onClick={() => submitAction({ action: 'REVIEW_DEDUCTION', id: d.id, decision: 'REJECTED' })} style={{ padding: '5px 8px', borderRadius: '7px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <X size={12} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11.5px', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Employee</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Principal</th>
                  <th style={{ padding: '12px 16px' }}>Monthly Deduction</th>
                  <th style={{ padding: '12px 16px' }}>Remaining</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No employee loans or salary advances recorded.</td></tr>
                ) : (
                  loans.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{l.employee?.legalName}</td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{l.loanType.replace(/_/g, ' ')} ({l.tenureMonths}m)</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{formatNairaMinor(l.principalMinor)}</td>
                      <td style={{ padding: '12px 16px' }}>{formatNairaMinor(l.monthlyInstallmentMinor)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: activeBrandColor }}>{formatNairaMinor(l.remainingBalanceMinor)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#334155' }}>
                          {l.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {l.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" onClick={() => submitAction({ action: 'REVIEW_LOAN', id: l.id, decision: 'ACTIVE' })} style={{ padding: '5px 8px', borderRadius: '7px', border: 'none', background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                              Approve
                            </button>
                            <button type="button" onClick={() => submitAction({ action: 'REVIEW_LOAN', id: l.id, decision: 'REJECTED' })} style={{ padding: '5px 8px', borderRadius: '7px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

