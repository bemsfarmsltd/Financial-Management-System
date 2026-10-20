'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Wallet,
  ShieldCheck,
  TrendingDown,
  Clock,
  ArrowRight,
  RefreshCw,
  X,
  Plus,
  Landmark,
  BadgeCheck,
  ExternalLink,
  Lock,
  Trash2
} from 'lucide-react';

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  accountType: string;
  balance: number;
  balanceFormatted: string;
  status: string;
  assignedSubsidiary: string;
  tier: string;
  dailyLimit: number;
  dailyLimitFormatted: string;
}

interface TreasurySummary {
  totalLiquidReserves: number;
  totalLiquidReservesFormatted: string;
  uncommittedReservesFormatted: string;
  pendingPipelineFormatted: string;
  mtdOutflowFormatted: string;
  runwayMonths: string;
  liquidityHealth: string;
}

export function TreasuryAccountsView({
  businessName,
  userName,
  onNavigate,
  onSelectBusiness
}: {
  businessName: string;
  userName: string;
  onNavigate?: (view: string) => void;
  onSelectBusiness?: (id: string) => void;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Add Account Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    bankName: 'Access Bank PLC',
    accountName: '',
    accountNumber: '',
    accountType: 'Corporate Operational',
    currency: 'NGN',
    balance: '0',
    dailyLimit: '25000000',
    assignedSubsidiary: businessName || 'BEMS Group'
  });

  const fetchTreasury = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/treasury');
      const data = await res.json();
      if (data) {
        setAccounts(data.accounts || []);
        setSummary(data.summary || null);
      }
    } catch (e: any) {
      setNotice('Failed to load treasury data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasury();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.accountName.trim()) {
      setFormError('Please enter the account name.');
      return;
    }
    if (!form.accountNumber.trim() || form.accountNumber.trim().length < 10) {
      setFormError('Please enter a valid 10-digit NUBAN account number.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          balance: parseFloat(form.balance) || 0,
          dailyLimit: parseFloat(form.dailyLimit) || 25000000,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add bank account.');
      }
      setShowAddModal(false);
      setForm({
        bankName: 'Access Bank PLC',
        accountName: '',
        accountNumber: '',
        accountType: 'Corporate Operational',
        currency: 'NGN',
        balance: '0',
        dailyLimit: '25000000',
        assignedSubsidiary: businessName || 'BEMS Group'
      });
      setNotice('Company bank account registered successfully.');
      await fetchTreasury();
    } catch (err: any) {
      setFormError(err.message || 'Error saving account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
      const res = await fetch(`/api/treasury?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setNotice('Bank account removed.');
        await fetchTreasury();
      } else {
        const d = await res.json();
        setNotice(d.error || 'Failed to remove account.');
      }
    } catch {
      setNotice('Failed to remove account.');
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100%', color: '#0f172a' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            BANK REGISTRY & CASH POSITION
          </span>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '3px 0 2px', letterSpacing: '-0.3px', color: '#0f172a' }}>
            Treasury Bank Accounts & Balances
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
            Designated company bank accounts, operational floats, and payout disbursement channels.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: '#ea580c',
              fontSize: '11px',
              fontWeight: 700,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)'
            }}
          >
            <Plus size={13} />
            Add Company Bank Account
          </button>

          <button
            onClick={fetchTreasury}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: '10px',
              fontWeight: 600,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '11px',
          fontWeight: 600,
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ border: 0, background: 'none', color: '#991b1b', cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* TOP 4 KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          borderRadius: '10px',
          padding: '12px 14px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '75px',
          boxSizing: 'border-box',
          boxShadow: '0 8px 20px rgba(234, 88, 12, 0.22)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#fed7aa', textTransform: 'uppercase' }}>
              TOTAL LIQUID RESERVES
            </span>
            <Landmark size={12} color="#fed7aa" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1 }}>
              {summary?.totalLiquidReservesFormatted || '₦0'}
            </div>
            <div style={{ fontSize: '9px', color: '#fed7aa', marginTop: '2px' }}>
              {accounts.length} {accounts.length === 1 ? 'Account Registered' : 'Accounts Registered'}
            </div>
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
          minHeight: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              MTD CLEARED TRANSFERS
            </span>
            <TrendingDown size={12} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669', lineHeight: 1.1 }}>
              {summary?.mtdOutflowFormatted || '₦0'}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Current Month Disbursed</div>
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
          minHeight: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              UNCOMMITTED FLOAT
            </span>
            <Wallet size={12} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb', lineHeight: 1.1 }}>
              {summary?.uncommittedReservesFormatted || '₦0'}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>After Pending Approvals</div>
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
          minHeight: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              LIQUIDITY HEALTH
            </span>
            <ShieldCheck size={12} color="#ea580c" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
              {summary?.liquidityHealth || 'Awaiting Account Setup'}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{summary?.runwayMonths || '0.0 Months'} Runway</div>
          </div>
        </div>
      </div>

      {/* ACCOUNT CARDS GRID OR EMPTY STATE */}
      {accounts.length === 0 ? (
        <div style={{
          background: '#fff',
          border: '1px dashed #cbd5e1',
          borderRadius: '12px',
          padding: '36px 20px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: '#fff7ed',
            color: '#ea580c',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <Landmark size={22} />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            No Company Bank Accounts Configured Yet
          </h3>
          <p style={{ margin: '0 auto 16px', maxWidth: '420px', fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
            Register your commercial bank accounts (Operations, Reserve, Payroll) to monitor group cash reserves and record verified disbursement transfers.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#ea580c',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={14} />
            Add First Company Bank Account
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {accounts.map((acc) => (
            <div
              key={acc.id}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                      {acc.accountType}
                    </span>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '3px 0 0' }}>
                      {acc.bankName}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '8px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0'
                    }}>
                      ● {acc.status}
                    </span>
                    <button
                      onClick={() => handleDeleteAccount(acc.id, `${acc.bankName} (${acc.accountNumber})`)}
                      title="Delete account"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '12px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>Account Number</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', letterSpacing: '0.5px' }}>
                    {acc.accountNumber}
                  </div>
                  <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px', fontWeight: 600 }}>
                    {acc.accountName}
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '1px' }}>
                    Entity: {acc.assignedSubsidiary}
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>AVAILABLE BALANCE</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {acc.balanceFormatted}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                  <span>Daily Limit: <strong style={{ color: '#0f172a' }}>{acc.dailyLimitFormatted}</strong></span>
                  <span>Currency: <strong style={{ color: '#ea580c' }}>{acc.currency}</strong></span>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Lock size={10} color="#059669" /> Offline Protocol
                </span>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('Disbursements desk')}
                    style={{
                      border: 0,
                      background: 'none',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#ea580c',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    Disburse From Here →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POLICY INFORMATION */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: '#fff7ed',
            display: 'grid',
            placeItems: 'center',
            color: '#ea580c',
            border: '1px solid #fed7aa',
            flexShrink: 0
          }}>
            <ShieldCheck size={16} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>
              Enterprise Dual-Signoff Protocol
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Transfers are executed via corporate internet banking. Finance or executive records the external transaction reference and the staff member confirms receipt.
            </div>
          </div>
        </div>

        {onNavigate && (
          <button
            onClick={() => onNavigate('Disbursements desk')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #ea580c',
              background: '#fff7ed',
              color: '#ea580c',
              fontSize: '10px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            Open Banking Queue →
          </button>
        )}
      </div>

      {/* ADD BANK ACCOUNT MODAL */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 18, 32, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '14px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Add Company Bank Account
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Register commercial bank details for corporate payouts and liquid reserve tracking.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '11px',
                marginBottom: '14px'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Bank Institution *
                </label>
                <select
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    color: '#0f172a',
                    background: '#fff'
                  }}
                >
                  <option value="Access Bank PLC">Access Bank PLC</option>
                  <option value="Zenith Bank PLC">Zenith Bank PLC</option>
                  <option value="Guaranty Trust Bank (GTBank)">Guaranty Trust Bank (GTBank)</option>
                  <option value="First Bank of Nigeria">First Bank of Nigeria</option>
                  <option value="United Bank for Africa (UBA)">United Bank for Africa (UBA)</option>
                  <option value="Stanbic IBTC Bank">Stanbic IBTC Bank</option>
                  <option value="Fidelity Bank PLC">Fidelity Bank PLC</option>
                  <option value="Sterling Bank PLC">Sterling Bank PLC</option>
                  <option value="Providus Bank">Providus Bank</option>
                  <option value="Wema Bank PLC">Wema Bank PLC</option>
                  <option value="Other Commercial Bank">Other Commercial Bank</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Account Title / Beneficiary Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BEMS Group Holding HQ - Main Operations"
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    10-Digit NUBAN Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="0123456789"
                    value={form.accountNumber}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Account Type
                  </label>
                  <select
                    value={form.accountType}
                    onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a',
                      background: '#fff'
                    }}
                  >
                    <option value="Corporate Operational">Corporate Operational</option>
                    <option value="Reserve & Savings">Reserve & Savings</option>
                    <option value="Payroll Escrow">Payroll Escrow</option>
                    <option value="Project Float">Project Float</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Opening Balance (NGN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={form.balance}
                    onChange={(e) => setForm({ ...form, balance: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Assigned Subsidiary / Entity
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BEMS Group"
                    value={form.assignedSubsidiary}
                    onChange={(e) => setForm({ ...form, assignedSubsidiary: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)'
                  }}
                >
                  {submitting ? 'Saving...' : 'Save Bank Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
