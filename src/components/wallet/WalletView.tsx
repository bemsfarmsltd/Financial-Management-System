'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lock,
  RefreshCw,
  Building2,
  Clock,
  ChevronRight,
  ShieldCheck,
  X,
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
  return (BigInt(w) * BigInt(100) + BigInt(f.padEnd(2, '0'))).toString();
}

export async function walletApi(path: string, body?: unknown, method?: string, key?: string) {
  const r = await fetch('/api/wallet/' + path, {
    method: method || (body ? 'POST' : 'GET'),
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Wallet unavailable.');
  return d;
}

export default function WalletView() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  // Bank Form State
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [password, setPassword] = useState('');
  const [banks, setBanks] = useState<any[]>([]);

  // Withdrawal Form State
  const [creditId, setCreditId] = useState('');
  const [amount, setAmount] = useState('');
  const key = useRef(crypto.randomUUID());

  // Return Project Funds State
  const [returnReason, setReturnReason] = useState('');

  // Load Banks
  useEffect(() => {
    let current = true;
    walletApi('banks')
      .then((d) => {
        if (current && d.banks) setBanks(d.banks);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  // Load Own Wallet
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    fetch('/api/wallet/me', { cache: 'no-store', signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!c.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [version]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Breadcrumb Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/staff"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-orange-400 transition"
          >
            ← Back to Staff Portal
          </Link>
          <span className="text-slate-600">/</span>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-bold text-slate-200">Staff Funded Wallet</span>
          </div>
        </div>

        <button
          disabled={busy}
          onClick={() => setVersion((v) => v + 1)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-6 space-y-6">
        {/* Alerts & Messages */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {message && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{message}</div>
            <button onClick={() => setMessage('')} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {data?.walletMode === false && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/30 bg-amber-950/30 text-amber-200 text-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <strong>Read-Only Review Mode:</strong> Bank verification and transfers are currently disabled pending live Monnify activation. You can inspect all your GMD-approved credits and historical payouts.
              </div>
            </div>
            <span className="text-xs font-mono font-semibold bg-amber-900/60 border border-amber-600/40 px-2.5 py-1 rounded-md text-amber-300">
              READ-ONLY
            </span>
          </div>
        )}

        {!data && !error && (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
            <span>Loading your staff wallet…</span>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Wallet Balances Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-orange-400 bg-orange-950/60 border border-orange-800/40 px-2.5 py-0.5 rounded-full">
                    {data.environment === 'sandbox' ? 'Sandbox Environment' : 'Company Funded Wallet'}
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight mt-1">
                    My Approved Funds
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Currency</span>
                  <span className="text-sm font-bold text-slate-300 font-mono">NGN (₦)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/60 border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-transparent rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                    Approved Available
                  </span>
                  <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                    {walletMoney(data.availableMinor)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Ready to withdraw immediately
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-amber-500/30 rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                    Pending Withdrawals
                  </span>
                  <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
                    {walletMoney(data.heldMinor)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Submitted & awaiting provider settlement
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Bank Settled
                  </span>
                  <div className="text-2xl font-black text-slate-300 mt-1 font-mono">
                    {walletMoney(data.settledMinor)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Lifetime completed payouts
                  </span>
                </div>
              </div>
            </div>

            <fieldset disabled={busy || data.walletMode === false} className="space-y-6 disabled:opacity-75">
              {/* Destination Bank Account Section */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Landmark className="w-5 h-5 text-orange-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Withdrawal Bank Account</h3>
                      <p className="text-xs text-slate-400">
                        Verify your own personal salary account. The bank account name must match your legal staff identity.
                      </p>
                    </div>
                  </div>
                </div>

                {data.banks?.length > 0 ? (
                  <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                        ✓
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{data.banks[0].accountName}</div>
                        <div className="text-xs font-mono text-slate-400">
                          Account ending in •••• {data.banks[0].lastFour} (Bank Code: {data.banks[0].bankCode})
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                      Verified
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">Select Bank</label>
                        <select
                          value={bankCode}
                          onChange={(e) => setBankCode(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                        >
                          <option value="">Choose your bank…</option>
                          {banks.map((b) => (
                            <option key={b.code} value={b.code}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">10-Digit Account Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="0123456789"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-semibold block mb-1 text-xs">
                        Current Password (to authorize verification)
                      </label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <button
                      disabled={
                        busy ||
                        !password ||
                        !/^\d{10}$/.test(accountNumber) ||
                        !/^\d{3,6}$/.test(bankCode)
                      }
                      onClick={() =>
                        run(async () => {
                          await walletApi('bank', { bankCode, accountNumber, password });
                          setAccountNumber('');
                          setMessage('Your bank account was verified successfully.');
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      Verify Bank Account →
                    </button>
                  </div>
                )}
              </div>

              {/* Withdraw Approved Funds Section */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Execute Self-Service Withdrawal</h3>
                      <p className="text-xs text-slate-400">{data.withdrawalMessage}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Select Approved Source Credit</label>
                    <select
                      value={creditId}
                      onChange={(e) => setCreditId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
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

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Withdrawal Amount (₦)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 50000.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">
                      Current Password (to authorize transfer)
                    </label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <p>
                      Destination: {data.banks?.[0] ? `verified account ending in •••• ${data.banks[0].lastFour}` : 'Please verify your bank account first.'}
                    </p>
                    <p>
                      You receive the full requested principal. All Monnify transfer fees are 100% paid by the company.
                    </p>
                  </div>

                  <button
                    disabled={
                      busy ||
                      !data.withdrawalsEnabled ||
                      !data.banks?.length ||
                      !creditId ||
                      !amount ||
                      !password
                    }
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
                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    Confirm & Execute Withdrawal →
                  </button>
                </div>
              </div>

              {/* Source-Linked Credits Table */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-3">
                <h3 className="text-sm font-bold text-white">Source-Linked Wallet Credits</h3>
                {(!data.credits || data.credits.length === 0) ? (
                  <p className="text-xs text-slate-500">No approved wallet credits yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.credits.map((c: any) => (
                      <div
                        key={c.id}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 text-xs font-mono"
                      >
                        <div className="flex justify-between items-center font-sans">
                          <strong className="text-slate-200 font-bold">{c.category}</strong>
                          <span className="text-emerald-400 font-black">{walletMoney(c.availableMinor)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {c.sourceType} · {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                          <span>Pending: {walletMoney(c.heldMinor)}</span>
                          <span>Settled: {walletMoney(c.settledMinor)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Withdrawal History Table */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-3">
                <h3 className="text-sm font-bold text-white">Bank Withdrawal History</h3>
                {(!data.withdrawals || data.withdrawals.length === 0) ? (
                  <p className="text-xs text-slate-500">No withdrawals submitted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.withdrawals.map((w: any) => (
                      <div
                        key={w.id}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-emerald-400 block text-sm">
                            {walletMoney(w.amountMinor)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Ref: {w.reference} · Acct ending in •••• {w.lastFour}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              w.status === 'SETTLED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                : 'bg-amber-950 text-amber-400 border border-amber-800/40'
                            }`}
                          >
                            {w.status}
                          </span>

                          {w.status === 'HELD' && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await walletApi('withdrawals/' + w.id + '/cancel', {});
                                  setMessage('Withdrawal canceled; approved funds restored to wallet.');
                                })
                              }
                              className="px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800/40 text-[10px] font-semibold hover:bg-rose-900"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}
