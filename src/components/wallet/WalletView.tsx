'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  ArrowUpRight,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  AlertTriangle,
  Building2,
  Lock,
} from 'lucide-react';

export function walletMoney(value: string) {
  const n = BigInt(value || '0');
  const a = n < BigInt(0) ? -n : n;
  return (
    (n < BigInt(0) ? '-' : '') +
    '₦' +
    new Intl.NumberFormat('en-NG').format(a / BigInt(100)) +
    '.' +
    (a % BigInt(100)).toString().padStart(2, '0')
  );
}

export function nairaToMinor(value: string) {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter a valid naira amount with at most two decimal places.');
  }
  const [w, f = ''] = value.split('.');
  return (BigInt(w) * BigInt(100) + BigInt((f + '00').slice(0, 2))).toString();
}

export async function walletApi(path: string, body?: any, method = 'POST', idempotencyKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const res = await fetch(`/api/wallet/${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || json.error || 'Operation failed.');
  }
  return json;
}

type DestinationBank = {
  id: string;
  bankCode: string;
  accountNumberMasked: string;
  accountName: string;
  lastFour: string;
};

type CreditLot = {
  id: string;
  sourceType: string;
  category: string;
  availableMinor: string;
  heldMinor: string;
  settledMinor: string;
  createdAt: string;
};

type Withdrawal = {
  id: string;
  amountMinor: string;
  reference: string;
  status: string;
  lastFour: string;
  createdAt: string;
};

type WalletData = {
  employee: { id: string; name: string };
  availableMinor: string;
  heldMinor: string;
  settledMinor: string;
  totalWithdrawnMinor: string;
  environment: string;
  walletMode: boolean;
  withdrawalsEnabled: boolean;
  withdrawalMessage: string;
  banks: DestinationBank[];
  credits: CreditLot[];
  withdrawals: Withdrawal[];
};

export default function WalletView() {
  const [data, setData] = useState<WalletData | null>(null);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  // Form states
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [creditId, setCreditId] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');

  const key = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : 'initial-key');

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const res = await fetch('/api/wallet', { cache: 'no-store' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to load wallet.');
        }
        const json = await res.json();
        if (!cancel) {
          setData(json);
          if (json.credits?.length > 0 && !creditId) {
            setCreditId('ALL');
          }
        }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : 'Failed to load wallet.');
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [version]);

  useEffect(() => {
    async function loadBanks() {
      try {
        const res = await fetch('/api/wallet/banks', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setBanks(json.banks || []);
        }
      } catch {}
    }
    loadBanks();
  }, []);

  async function walletApi(path: string, body: any) {
    const res = await fetch(`/api/wallet/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || json.error || 'Operation failed.');
    }
    return json;
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, paddingBottom: '24px' }}>
      {/* Toast Notice */}
      {message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#e9f7f1',
            color: '#137b62',
            border: '1px solid #c2ebd9',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(19, 123, 98, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={14} />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} style={{ background: 'none', border: 0, color: '#137b62', cursor: 'pointer', padding: '2px' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff1f2',
            color: '#be123c',
            border: '1px solid #fecdd3',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 0, color: '#be123c', cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {data?.walletMode === false && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fffbeb',
            color: '#92400e',
            border: '1px solid #fef3c7',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} color="#d97706" />
            <span>
              <strong>Safe Read-Only Review Active:</strong> Bank verification and transfers are currently disabled pending live Monnify activation. You can inspect all your GMD-approved credits and historical payouts.
            </span>
          </div>
          <span style={{ fontSize: '9px', fontWeight: 800, background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
            READ-ONLY
          </span>
        </div>
      )}

      {/* Executive Header */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#7d8ba1', textTransform: 'uppercase' }}>
            STAFF PORTAL · FINANCIAL SETTLEMENTS
          </span>
          <h1 style={{ fontSize: '18px', letterSpacing: '-0.3px', fontWeight: 700, margin: '4px 0 2px', color: '#17253d' }}>
            My Funded Wallet
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
            Direct access to your GMD-approved funds. Withdrawals transfer directly to your verified personal bank account with zero employee deductions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            disabled={busy}
            onClick={() => setVersion((v) => v + 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '10px',
              fontWeight: 650,
              background: '#fff',
              color: '#263c60',
              border: '1px solid #dce4ef',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {!data && !error && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '48px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', color: '#ea580c' }} />
          <div>Loading your staff wallet…</div>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Top Metric Strip (3 Cards) */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
            {/* Approved Available */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: '#059669', textTransform: 'uppercase' }}>
                  Approved Available
                </span>
                <Wallet size={14} color="#059669" />
              </div>
              <div>
                <strong style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, color: '#059669', display: 'block' }}>
                  {walletMoney(data.availableMinor)}
                </strong>
                <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#64748b' }}>
                  Ready to withdraw immediately
                </p>
              </div>
            </div>

            {/* Pending Withdrawals */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: '#d97706', textTransform: 'uppercase' }}>
                  Pending Settlements
                </span>
                <ArrowUpRight size={14} color="#d97706" />
              </div>
              <div>
                <strong style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, color: '#d97706', display: 'block' }}>
                  {walletMoney(data.heldMinor)}
                </strong>
                <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#64748b' }}>
                  Awaiting provider bank settlement
                </p>
              </div>
            </div>

            {/* Lifetime Settled */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: '#64748b', textTransform: 'uppercase' }}>
                  Total Bank Settled
                </span>
                <Landmark size={14} color="#64748b" />
              </div>
              <div>
                <strong style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, color: '#17253d', display: 'block' }}>
                  {walletMoney(data.settledMinor)}
                </strong>
                <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#64748b' }}>
                  Lifetime completed disbursements
                </p>
              </div>
            </div>
          </section>

          {/* Two-Column Operation Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
            {/* Card 1: Destination Bank Account */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                <Landmark size={16} color="#ea580c" />
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#17253d', margin: 0 }}>Withdrawal Bank Account</h3>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Account name must match your legal staff identity.</p>
                </div>
              </div>

              {data.banks?.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>
                      ✓
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#17253d' }}>{data.banks[0].accountName}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                        Account ending in •••• {data.banks[0].lastFour} (Bank Code: {data.banks[0].bankCode})
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                    Verified
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Select Bank</label>
                      <select
                        value={bankCode}
                        onChange={(e) => setBankCode(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11, background: '#fff', boxSizing: 'border-box' }}
                      >
                        <option value="">Choose bank…</option>
                        {banks.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>10-Digit Account Number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="0123456789"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11, background: '#fff', boxSizing: 'border-box', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Current Password (to authorize verification)
                    </label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter password…"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11, background: '#fff', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button
                    disabled={busy || !password || !/^\d{10}$/.test(accountNumber) || !/^\d{3,6}$/.test(bankCode)}
                    onClick={() =>
                      run(async () => {
                        await walletApi('bank', { bankCode, accountNumber, password });
                        setAccountNumber('');
                        setMessage('Your bank account was verified successfully.');
                      })
                    }
                    style={{ padding: '7px 14px', borderRadius: 6, border: 0, background: '#ea580c', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
                  >
                    Verify Bank Account →
                  </button>
                </div>
              )}
            </div>

            {/* Card 2: Execute Self-Service Withdrawal */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                <ArrowUpRight size={16} color="#059669" />
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#17253d', margin: 0 }}>Execute Self-Service Withdrawal</h3>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{data.withdrawalMessage || 'Instant Monnify payout with zero employee deductions.'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Select Approved Source Credit</label>
                  <select
                    value={creditId}
                    onChange={(e) => setCreditId(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11, background: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="">Choose funding source…</option>
                    <option value="ALL">Combine all approved sources (oldest first)</option>
                    {data.credits
                      ?.filter((c: any) => BigInt(c.availableMinor || '0') > BigInt(0))
                      ?.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.category} · {walletMoney(c.availableMinor)} available
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Withdrawal Amount (₦)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 50000.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11, background: '#fff', boxSizing: 'border-box', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Current Password</label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter password…"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11, background: '#fff', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px', fontSize: 10, color: '#64748b' }}>
                  Destination: {data.banks?.[0] ? `Verified account ending in •••• ${data.banks[0].lastFour}` : 'Please verify your bank account first.'} · 100% principal received, transfer fee covered by company.
                </div>

                <button
                  disabled={busy || !data.withdrawalsEnabled || !data.banks?.length || !creditId || !amount || !password}
                  onClick={() =>
                    run(async () => {
                      const amountMinor = nairaToMinor(amount);
                      const intent =
                        creditId === 'ALL'
                          ? (
                              await walletApi('withdrawal-plan', {
                                amountMinor,
                                bankAccountId: data.banks[0].id,
                                idempotencyKey: key.current,
                              })
                            ).intent
                          : {
                              amountMinor,
                              bankAccountId: data.banks[0].id,
                              idempotencyKey: key.current,
                              creditAllocations: [{ creditLotId: creditId, amountMinor }],
                            };
                      const proof = await walletApi('challenges', {
                        purpose: 'WITHDRAWAL',
                        payload: intent,
                        password,
                      });
                      const result = await walletApi('withdrawals', {
                        intent,
                        challengeId: proof.id,
                        challengeToken: proof.token,
                      });
                      key.current = crypto.randomUUID();
                      setAmount('');
                      setCreditId('');
                      setMessage(`Withdrawal ${result.reference} is queued (${result.status}).`);
                    })
                  }
                  style={{ padding: '7px 14px', borderRadius: 6, border: 0, background: '#059669', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
                >
                  Confirm &amp; Execute Withdrawal →
                </button>
              </div>
            </div>
          </div>

          {/* Source-Linked Credits & Withdrawal History */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
            {/* Source Credits */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#17253d', margin: 0 }}>Approved Source Credits</h3>
              {!data.credits || data.credits.length === 0 ? (
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>No approved wallet credits yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.credits.map((c: any) => (
                    <div key={c.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <strong style={{ color: '#17253d' }}>{c.category}</strong>
                        <span style={{ color: '#059669', fontWeight: 800 }}>{walletMoney(c.availableMinor)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {c.sourceType} · {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Withdrawal History */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#17253d', margin: 0 }}>Bank Withdrawal History</h3>
              {!data.withdrawals || data.withdrawals.length === 0 ? (
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>No withdrawals submitted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.withdrawals.map((w: any) => (
                    <div key={w.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                      <div>
                        <strong style={{ color: '#17253d', display: 'block' }}>{walletMoney(w.amountMinor)}</strong>
                        <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>Ref: {w.reference} · •••• {w.lastFour}</span>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: w.status === 'SETTLED' ? '#ecfdf5' : '#fffbeb',
                          color: w.status === 'SETTLED' ? '#059669' : '#d97706',
                          border: `1px solid ${w.status === 'SETTLED' ? '#a7f3d0' : '#fde68a'}`,
                        }}
                      >
                        {w.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
