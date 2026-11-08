'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Wallet,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Users,
  BookOpen,
  FileText,
  Layers,
  ExternalLink,
  TrendingUp,
  Coins,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { walletApi as api, walletMoney, nairaToMinor } from './WalletView';

type TabKey = 'envelopes' | 'releases' | 'vendors' | 'transfers' | 'staff';

export default function FundingView() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('envelopes');
  const [selectedSubId, setSelectedSubId] = useState<string>('ALL');

  // Allocation Modal State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [parentId, setParentId] = useState('');
  const allocationKey = useRef(crypto.randomUUID());

  // Adjustment Modal State
  const [adjustment, setAdjustment] = useState<any>(null);
  const [adjustOperation, setAdjustOperation] = useState('INCREASE');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [targetEnvelopeId, setTargetEnvelopeId] = useState('');

  // Vendor Bank Modal State
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [vendorBankCode, setVendorBankCode] = useState('');
  const [vendorAccount, setVendorAccount] = useState('');
  const [vendorPassword, setVendorPassword] = useState('');
  const [bankList, setBankList] = useState<any[]>([]);

  // Release Preview Preparation State
  const [sourceType, setSourceType] = useState('REQUEST');
  const [sourceId, setSourceId] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Confirmation Modal State (GMD Password-proven approval / Issue Ack / Pool Pause)
  const [confirmation, setConfirmation] = useState<any>(null);
  const [password, setPassword] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerSubTab, setLedgerSubTab] = useState<'transfers' | 'journals'>('transfers');

  // Read initial subsidiary from localStorage or URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bems_active_org');
      const urlOrg = new URLSearchParams(window.location.search).get('org');
      if (urlOrg) setSelectedSubId(urlOrg);
      else if (stored) setSelectedSubId(stored);
    }
  }, []);

  // Fetch banks list
  useEffect(() => {
    let current = true;
    api('banks')
      .then((d) => {
        if (current && d.banks) setBankList(d.banks);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  // Load funding dashboard data
  const load = useCallback(async () => {
    try {
      const d = await api('funding');
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wallet dashboard.');
    }
  }, []);

  useEffect(() => {
    let current = true;
    load();
    return () => {
      current = false;
    };
  }, [load]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
      setPassword('');
      setConfirmation(null);
    }
  }

  // Active subsidiary info
  const activeSubsidiary = useMemo(() => {
    if (!data?.organizations || selectedSubId === 'ALL') return null;
    return data.organizations.find((o: any) => o.id === selectedSubId || o.code === selectedSubId) || null;
  }, [data?.organizations, selectedSubId]);

  // Filtered Envelopes by active subsidiary
  const filteredEnvelopes = useMemo(() => {
    if (!data?.envelopes) return [];
    let list = data.envelopes;
    if (activeSubsidiary) {
      list = list.filter((e: any) => e.organizationId === activeSubsidiary.id);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e: any) =>
          e.label.toLowerCase().includes(q) ||
          e.organizationName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.envelopes, activeSubsidiary, searchQuery]);

  // Filtered Proposals (Pending GMD Release Previews)
  const filteredProposals = useMemo(() => {
    if (!data?.proposals) return [];
    if (!activeSubsidiary) return data.proposals;
    return data.proposals.filter((p: any) =>
      p.items?.some((i: any) => i.organizationId === activeSubsidiary.id)
    );
  }, [data?.proposals, activeSubsidiary]);

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    if (!data?.transfers) return [];
    let list = data.transfers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t: any) =>
          t.beneficiaryName?.toLowerCase().includes(q) ||
          t.reference?.toLowerCase().includes(q) ||
          t.status?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.transfers, searchQuery]);

  // Filtered Staff Wallets
  const filteredStaffWallets = useMemo(() => {
    if (!data?.staffWallets) return [];
    let list = data.staffWallets;
    if (activeSubsidiary) {
      list = list.filter((s: any) => s.subsidiaryId === activeSubsidiary.id);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s: any) =>
          s.legalName?.toLowerCase().includes(q) ||
          s.employeeNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.staffWallets, activeSubsidiary, searchQuery]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    if (!data?.vendors) return [];
    let list = data.vendors;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v: any) =>
          v.name?.toLowerCase().includes(q) ||
          v.accountName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.vendors, searchQuery]);

  // Release preparation helpers
  const selectedPaymentSource =
    sourceType === 'REQUEST'
      ? data?.requests?.find((r: any) => r.id === sourceId)
      : data?.payrollBatches?.find((r: any) => r.id === sourceId);

  const releaseOrganizations: string[] =
    sourceType === 'REQUEST'
      ? selectedPaymentSource
        ? [selectedPaymentSource.subsidiaryId]
        : []
      : [
          ...new Set<string>(
            (selectedPaymentSource?.items || []).flatMap((i: any) =>
              (i.allocations || []).map((a: any) => a.subsidiaryId)
            )
          ),
        ];

  async function handleConfirmAction() {
    await run(async () => {
      if (confirmation.operation) {
        const payload =
          confirmation.operation === 'ACKNOWLEDGE_ISSUE'
            ? { operation: confirmation.operation, issueId: confirmation.issueId, note: confirmation.note }
            : { operation: confirmation.operation };
        const proof = await api('challenges', { purpose: 'POOL_CONTROL', payload, password });
        if (confirmation.operation === 'ACKNOWLEDGE_ISSUE') {
          await api('issues/' + confirmation.issueId + '/ack', {
            note: confirmation.note,
            challengeId: proof.id,
            challengeToken: proof.token,
          });
          setMessage('Funding control issue acknowledged.');
        } else {
          await api('pool-control', { ...payload, challengeId: proof.id, challengeToken: proof.token });
          setMessage('Funding pool controls updated successfully.');
        }
      } else {
        const payload = { id: confirmation.id, confirmationHash: confirmation.confirmationHash };
        const proof = await api('challenges', { purpose: 'RELEASE', payload, password });
        await api('releases/' + confirmation.id + '/approve', {
          confirmationHash: confirmation.confirmationHash,
          challengeId: proof.id,
          challengeToken: proof.token,
        });
        setMessage(
          confirmation.category === 'VENDOR'
            ? 'Vendor payment approved and queued for direct Monnify transfer.'
            : 'GMD-approved funds credited once to staff wallets. Staff can withdraw anytime.'
        );
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Banner Navigation / Breadcrumb */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/finance"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-orange-400 transition"
          >
            ← Back to Dashboard
          </Link>
          <span className="text-slate-600">/</span>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-bold text-slate-200">Wallet Management & Subsidiary Treasury</span>
          </div>
        </div>

        {/* Subsidiary Workspace Switcher Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-orange-400" /> Workspace:
          </label>
          <select
            value={selectedSubId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedSubId(val);
              if (typeof window !== 'undefined') {
                localStorage.setItem('bems_active_org', val);
                const url = new URL(window.location.href);
                if (val === 'ALL') url.searchParams.delete('org');
                else url.searchParams.set('org', val);
                window.history.replaceState(null, '', url.toString());
              }
            }}
            className="bg-slate-900 border border-slate-700 text-xs font-semibold rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="ALL">🏢 All Subsidiaries (Holding HQ View)</option>
            {data?.organizations?.map((org: any) => (
              <option key={org.id} value={org.id}>
                {org.type === 'GROUP' ? '🏛️' : '🏢'} {org.legalName} ({org.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Alerts & Notifications */}
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
                <strong>Safe Read-Only Review Active:</strong> Monnify live transfer execution is guarded until sandbox testing and opening reconciliation are finalized. All balances, envelopes, and release previews remain 100% reviewable.
              </div>
            </div>
            <span className="text-xs font-mono font-semibold bg-amber-900/60 border border-amber-600/40 px-2.5 py-1 rounded-md text-amber-300">
              SANDBOX MODE
            </span>
          </div>
        )}

        {/* Central Monnify Master Pool Liquidity Deck */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-orange-400 bg-orange-950/60 border border-orange-800/40 px-2.5 py-0.5 rounded-full">
                  Central Liquidity Pool
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {data?.funding ? `Acct •••• ${data.funding.sourceLastFour}` : 'Unconfigured'}
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
                Monnify Corporate Master Account
              </h2>
              <p className="text-xs text-slate-400">
                One Monnify funding account backs all subsidiary budget envelopes and staff internal wallets.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api('funding/refresh', {});
                    setMessage('Provider balance verified and updated from Monnify.');
                  })
                }
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                Refresh Monnify Balance
              </button>

              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const result = await api('reconcile', {});
                    setMessage(result.message || 'Reconciliation completed.');
                  })
                }
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Reconcile Provider
              </button>

              {data?.funding && (
                <button
                  disabled={busy}
                  onClick={() => setConfirmation({ operation: data.funding.paused ? 'RESUME' : 'PAUSE' })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 text-xs font-semibold border border-amber-800/40 transition disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {data.funding.paused ? 'Resume Pool' : 'Pause Pool'}
                </button>
              )}
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Monnify Verified Available
              </span>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {data?.funding ? walletMoney(data.funding.availableMinor) : '₦0.00'}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {data?.funding?.fresh ? '● Real-time verified' : '○ Refresh required'}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Funded Budget Envelopes
              </span>
              <div className="text-xl font-black text-slate-200 mt-1">
                {data?.funding ? walletMoney(data.funding.envelopeMinor) : '₦0.00'}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {data?.envelopes?.length || 0} active subsidiary envelopes
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Unsettled Staff Liabilities
              </span>
              <div className="text-xl font-black text-amber-400 mt-1">
                {data?.funding ? walletMoney(data.funding.liabilityMinor) : '₦0.00'}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                GMD-approved funds in staff wallets
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Company Fee Reserve
              </span>
              <div className="text-xl font-black text-slate-300 mt-1">
                {data?.funding ? walletMoney(data.funding.feeReserveMinor) : '₦0.00'}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Monnify transfer fees (Company pays)
              </span>
            </div>

            <div className="bg-slate-950/60 border border-orange-500/20 bg-gradient-to-b from-orange-950/20 to-transparent rounded-xl p-4">
              <span className="text-[11px] font-semibold text-orange-300 uppercase tracking-wider block">
                Unallocated Capacity
              </span>
              <div className="text-xl font-black text-orange-400 mt-1">
                {data?.funding ? walletMoney(data.funding.freeMinor) : '₦0.00'}
              </div>
              <span className="text-[10px] text-orange-300/60 mt-1 block">
                Available to allocate to subsidiaries
              </span>
            </div>
          </div>
        </div>

        {/* Active Subsidiary Scope Bar (if filtered) */}
        {activeSubsidiary && (
          <div className="bg-gradient-to-r from-orange-950/30 via-slate-900 to-slate-900 border border-orange-500/30 rounded-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center font-bold text-orange-400 text-xs">
                {activeSubsidiary.code?.slice(0, 2) || 'SUB'}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {activeSubsidiary.legalName}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {activeSubsidiary.code}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Showing budget envelopes, staff liabilities, and payment releases scoped to this entity.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedSubId('ALL')}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              Reset to Group HQ View
            </button>
          </div>
        )}

        {/* Tab Navigation & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { key: 'envelopes', label: 'Subsidiary Budget Envelopes', icon: Layers, count: filteredEnvelopes.length },
              { key: 'releases', label: 'Fund Release Previews', icon: ArrowUpRight, count: filteredProposals.length },
              { key: 'vendors', label: 'Verified Suppliers', icon: Landmark, count: filteredVendors.length },
              { key: 'transfers', label: 'Transfers & Ledger', icon: BookOpen, count: filteredTransfers.length },
              { key: 'staff', label: 'Staff Wallets Directory', icon: Users, count: filteredStaffWallets.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-orange-700 text-orange-100' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by label, entity, staff, or reference…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* TAB 1: SUBSIDIARY BUDGET ENVELOPES */}
        {activeTab === 'envelopes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Subsidiary Funded Budget Envelopes</h3>
                <p className="text-xs text-slate-400">
                  Pre-funded allocations backed by the corporate Monnify pool. No disbursements can exceed remaining envelope capacity.
                </p>
              </div>

              <button
                disabled={busy}
                onClick={() => {
                  setOrganizationId(activeSubsidiary?.id || '');
                  setLabel('');
                  setAmount('');
                  setParentId('');
                  setShowAllocateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-lg shadow-orange-600/20"
              >
                <Plus className="w-4 h-4" /> Allocate Funded Budget
              </button>
            </div>

            {filteredEnvelopes.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
                No funded budget envelopes found for this workspace. Click &ldquo;Allocate Funded Budget&rdquo; to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEnvelopes.map((e: any) => {
                  const allocated = BigInt(e.allocatedMinor || '0');
                  const remaining = BigInt(e.remainingMinor || '0');
                  const utilized = allocated - remaining;
                  const pct = allocated > BigInt(0) ? Number((remaining * BigInt(100)) / allocated) : 0;

                  return (
                    <div
                      key={e.id}
                      className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg space-y-4 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">
                            {e.organizationName}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-0.5">{e.label}</h4>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            e.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {e.status}
                        </span>
                      </div>

                      {/* Financial Balances */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Remaining Buffer</span>
                          <span className="text-base font-black text-emerald-400">{walletMoney(e.remainingMinor)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Allocated</span>
                          <span className="text-sm font-bold text-slate-300">{walletMoney(e.allocatedMinor)}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Capacity remaining</span>
                          <span className="font-mono font-semibold">{pct}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              pct > 30 ? 'bg-emerald-500' : pct > 10 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      {e.status === 'ACTIVE' && (
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            disabled={busy}
                            onClick={() => {
                              setAdjustment(e);
                              setAdjustAmount('');
                              setTargetEnvelopeId('');
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition text-center"
                          >
                            Adjust / Reallocate
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api('envelopes/' + e.id, { operation: 'CLOSE', expectedVersion: e.version }, 'PATCH');
                                setMessage('Budget closed. Unused funds returned to the central Monnify pool.');
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-950/50 hover:text-rose-300 text-slate-400 text-xs font-semibold border border-slate-700/60 transition"
                          >
                            Close
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FUND RELEASE PREVIEWS & QUEUE */}
        {activeTab === 'releases' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Pending GMD Release Previews</h3>
                <p className="text-xs text-slate-400">
                  Exact preview verification required prior to fund credit. Only the designated Group Managing Director can execute release.
                </p>
              </div>
            </div>

            {filteredProposals.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
                No pending release proposals in queue. Generate a preview below to stage a payment.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProposals.map((p: any) => (
                  <div
                    key={p.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center font-black text-orange-400">
                          ₦
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-300">{p.requestNumber}</span>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-orange-950 text-orange-300 border border-orange-800/40">
                              {p.category}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-0.5">{p.title}</h4>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Total Release Amount</span>
                        <span className="text-xl font-black text-emerald-400">{walletMoney(p.amountMinor)}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300">{p.purpose}</p>

                    {/* Beneficiary Breakdown */}
                    <div className="bg-slate-950/60 rounded-xl p-3 space-y-2 border border-slate-800/60">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Beneficiaries & Destination Bank Snapshots ({p.items?.length || 0})
                      </span>
                      {p.items?.map((item: any) => {
                        let bankDetails = null;
                        try {
                          if (item.bankSnapshot) bankDetails = JSON.parse(item.bankSnapshot);
                        } catch {}
                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-900 last:border-0"
                          >
                            <div>
                              <strong className="text-slate-200">{item.employeeName}</strong>
                              <span className="text-slate-500 text-[11px] ml-1.5">
                                ({item.employeeNumber}) · {item.organizationName}
                              </span>
                              {bankDetails && (
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  🏦 {bankDetails.accountName} · ending in •••• {bankDetails.accountNumber?.slice(-4)} (Code: {bankDetails.bankCode})
                                </div>
                              )}
                            </div>
                            <span className="font-bold font-mono text-slate-300">{walletMoney(item.amountMinor)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Approval Action */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Expires {new Date(p.expiresAt).toLocaleTimeString()}
                      </span>

                      <button
                        disabled={busy || !data?.canApprove}
                        onClick={() => setConfirmation(p)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg ${
                          data?.canApprove
                            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/30'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {data?.canApprove ? 'Review & Execute Approval' : 'GMD Authorization Required'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Prepare Release Preview Form */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-400" /> Prepare New Release Preview
              </h4>
              <p className="text-xs text-slate-400">
                Link an approved fund request or salary batch to subsidiary budget envelopes to generate a preview for GMD sign-off.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Payment Category</label>
                  <select
                    value={sourceType}
                    onChange={(e) => {
                      setSourceType(e.target.value);
                      setSourceId('');
                      setMapping({});
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="REQUEST">Staff Request / Project / Allowance</option>
                    <option value="PAYROLL_BATCH">Whole Salary Net Batch</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Approved Source</label>
                  <select
                    value={sourceId}
                    onChange={(e) => {
                      setSourceId(e.target.value);
                      setMapping({});
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Select approved payment source…</option>
                    {(sourceType === 'REQUEST' ? data?.requests : data?.payrollBatches)?.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {sourceType === 'REQUEST'
                          ? `${r.vendor?.name || r.requester?.legalName} — ${r.title} — ${walletMoney(r.amountMinor)}`
                          : `Salary ${r.period?.year}-${r.period?.month} · ${walletMoney(r.totalNetMinor)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Envelope Mapping */}
              {releaseOrganizations.length > 0 && (
                <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-3">
                  <span className="text-xs font-bold text-slate-300 block">
                    Map to Subsidiary Budget Envelopes
                  </span>
                  {releaseOrganizations.map((orgId) => {
                    const org = data?.organizations?.find((o: any) => o.id === orgId);
                    const orgEnvelopes = data?.envelopes?.filter(
                      (e: any) => e.organizationId === orgId && e.status === 'ACTIVE'
                    );

                    return (
                      <div key={orgId} className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <span className="text-slate-300 font-semibold">{org?.legalName || 'Subsidiary'}:</span>
                        <select
                          value={mapping[orgId] || ''}
                          onChange={(e) => setMapping({ ...mapping, [orgId]: e.target.value })}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 min-w-[280px]"
                        >
                          <option value="">Choose funded budget envelope…</option>
                          {orgEnvelopes?.map((env: any) => (
                            <option key={env.id} value={env.id}>
                              {env.label} · {walletMoney(env.remainingMinor)} available
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                disabled={
                  busy ||
                  !sourceId ||
                  !releaseOrganizations.length ||
                  releaseOrganizations.some((o) => !mapping[o])
                }
                onClick={() =>
                  run(async () => {
                    await api('releases', { sourceType, sourceId, envelopesByOrganization: mapping });
                    setMessage('Release preview staged. Awaiting designated GMD approval.');
                    setSourceId('');
                    setMapping({});
                  })
                }
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Prepare GMD Preview →
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: VERIFIED SUPPLIERS & VENDORS */}
        {activeTab === 'vendors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Verified Supplier Banking Registry</h3>
                <p className="text-xs text-slate-400">
                  Approved commercial suppliers with verified NIBSS accounts for direct Monnify settlements.
                </p>
              </div>

              <button
                onClick={() => {
                  setVendorId('');
                  setVendorBankCode('');
                  setVendorAccount('');
                  setVendorPassword('');
                  setShowVendorModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
              >
                <Plus className="w-4 h-4 text-orange-400" /> Verify Supplier Bank
              </button>
            </div>

            {filteredVendors.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
                No vendors found matching your filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVendors.map((v: any) => (
                  <div
                    key={v.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-white">{v.name}</h4>
                        <span className="text-[11px] font-mono text-slate-400">
                          {v.accountName || 'No bank recorded'}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          v.verifiedBankAt
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            : 'bg-amber-950 text-amber-400 border border-amber-800/40'
                        }`}
                      >
                        {v.verifiedBankAt ? 'Verified' : 'Pending Verification'}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 rounded-xl p-3 text-xs space-y-1 font-mono text-slate-300">
                      <div>Bank Code: {v.bankCode || '—'}</div>
                      <div>Account: •••• {v.lastFour || '—'}</div>
                      {v.verifiedBankAt && (
                        <div className="text-[10px] text-slate-500">
                          Verified {new Date(v.verifiedBankAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TRANSFERS & DOUBLE-ENTRY LEDGER */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Financial Audit Trail & Transfer Ledger</h3>
                <p className="text-xs text-slate-400">
                  Every disbursement and budget transfer has immutable double-entry journal records.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLedgerSubTab('transfers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    ledgerSubTab === 'transfers'
                      ? 'bg-slate-800 text-orange-400 border border-orange-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Monnify Bank Transfers
                </button>
                <button
                  onClick={() => setLedgerSubTab('journals')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    ledgerSubTab === 'journals'
                      ? 'bg-slate-800 text-orange-400 border border-orange-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Double-Entry Journal
                </button>
              </div>
            </div>

            {ledgerSubTab === 'transfers' ? (
              <div className="space-y-3">
                {filteredTransfers.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
                    No Monnify bank transfers recorded yet.
                  </div>
                ) : (
                  filteredTransfers.map((t: any) => (
                    <div
                      key={t.id}
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-100 text-sm">{t.beneficiaryName}</strong>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {t.targetType}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Ref: {t.reference} · Acct ending in •••• {t.lastFour}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-400 block font-mono">
                            {walletMoney(t.amountMinor)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Company Fee: {walletMoney(t.feeMinor)}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            t.status === 'SETTLED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : t.status === 'HELD'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {(!data?.journals || data.journals.length === 0) ? (
                  <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
                    No double-entry journal postings found.
                  </div>
                ) : (
                  data.journals.map((j: any) => (
                    <div
                      key={j.id}
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-orange-400 font-mono">{j.kind}</span>
                          <span className="text-[11px] text-slate-500 font-mono">Ref: {j.reference}</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(j.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                        {j.entries?.map((entry: any) => {
                          const amt = BigInt(entry.amountMinor || '0');
                          const isCredit = amt >= BigInt(0);
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/60"
                            >
                              <span className="text-slate-400">{entry.accountKey}</span>
                              <span className={isCredit ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                {isCredit ? '+' : ''}{walletMoney(entry.amountMinor)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: STAFF WALLETS DIRECTORY */}
        {activeTab === 'staff' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Staff Wallet Balances</h3>
                <p className="text-xs text-slate-400">
                  Approved staff wallet balances and lifetime settlements per subsidiary.
                </p>
              </div>
            </div>

            {filteredStaffWallets.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
                No staff members found in this subsidiary workspace.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Employee</th>
                      <th className="p-4">Subsidiary</th>
                      <th className="p-4 text-right">Available Balance</th>
                      <th className="p-4 text-right">Pending Withdrawals</th>
                      <th className="p-4 text-right">Settled Lifetime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredStaffWallets.map((staff: any) => (
                      <tr key={staff.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-sans font-medium text-slate-200">
                          <div>{staff.legalName}</div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {staff.employeeNumber} · {staff.role}
                          </span>
                        </td>
                        <td className="p-4 font-sans text-slate-400">{staff.organizationName}</td>
                        <td className="p-4 text-right font-black text-emerald-400">
                          {walletMoney(staff.availableMinor)}
                        </td>
                        <td className="p-4 text-right text-amber-400">
                          {walletMoney(staff.heldMinor)}
                        </td>
                        <td className="p-4 text-right text-slate-300">
                          {walletMoney(staff.settledMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: ALLOCATE FUNDED BUDGET */}
      {showAllocateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-500" /> Allocate Funded Budget Envelope
              </h3>
              <button
                onClick={() => setShowAllocateModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Allocating a budget locks central Monnify backing to this subsidiary. No staff wallet funds are credited until individual requests are approved.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Target Subsidiary *</label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select subsidiary…</option>
                  {data?.organizations?.map((org: any) => (
                    <option key={org.id} value={org.id}>
                      {org.legalName} ({org.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Budget Envelope Label *</label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Logistics & Fleet Fuel Allocation"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Allocation Amount (₦) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 5000000.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Parent Budget (Optional)</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">Allocate directly from Central Unallocated Pool</option>
                  {data?.envelopes
                    ?.filter((e: any) => e.status === 'ACTIVE')
                    ?.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.organizationName} · {e.label} ({walletMoney(e.remainingMinor)} remaining)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !organizationId || !label || !amount}
                onClick={() =>
                  run(async () => {
                    await api(
                      'envelopes',
                      {
                        organizationId,
                        label,
                        parentId: parentId || undefined,
                        amountMinor: nairaToMinor(amount),
                      },
                      undefined,
                      allocationKey.current
                    );
                    allocationKey.current = crypto.randomUUID();
                    setShowAllocateModal(false);
                    setMessage('Funded budget envelope allocated successfully.');
                  })
                }
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Confirm Allocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST / REALLOCATE ENVELOPE */}
      {adjustment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Adjust Budget: {adjustment.label}</h3>
              <button onClick={() => setAdjustment(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Current Available Buffer: <strong>{walletMoney(adjustment.remainingMinor)}</strong>
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Adjustment Operation</label>
                <select
                  value={adjustOperation}
                  onChange={(e) => setAdjustOperation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="INCREASE">Increase from Central Unallocated Pool</option>
                  <option value="REDUCE">Return Unused Funds to Central Pool</option>
                  <option value="REALLOCATE">Reallocate Unused Funds to Another Envelope</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Adjustment Amount (₦) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 1000000.00"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              {adjustOperation === 'REALLOCATE' && (
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Destination Target Envelope *</label>
                  <select
                    value={targetEnvelopeId}
                    onChange={(e) => setTargetEnvelopeId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Select destination envelope…</option>
                    {data?.envelopes
                      ?.filter((e: any) => e.status === 'ACTIVE' && e.id !== adjustment.id)
                      ?.map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.organizationName} · {e.label}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAdjustment(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !adjustAmount || (adjustOperation === 'REALLOCATE' && !targetEnvelopeId)}
                onClick={() =>
                  run(async () => {
                    await api(
                      'envelopes/' + adjustment.id,
                      {
                        operation: adjustOperation,
                        amountMinor: nairaToMinor(adjustAmount),
                        targetEnvelopeId: targetEnvelopeId || undefined,
                        expectedVersion: adjustment.version,
                      },
                      'PATCH'
                    );
                    setAdjustment(null);
                    setMessage('Budget envelope adjusted successfully.');
                  })
                }
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VERIFY SUPPLIER BANK */}
      {showVendorModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Landmark className="w-4 h-4 text-orange-500" /> Verify Commercial Supplier Bank Account
              </h3>
              <button onClick={() => setShowVendorModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              NIBSS bank resolution checks verified legal supplier account names. Executive password verification is required.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Approved Supplier *</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select supplier…</option>
                  {data?.vendors?.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.verifiedBankAt ? '· (Verified)' : '· (Needs verification)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Bank *</label>
                <select
                  value={vendorBankCode}
                  onChange={(e) => setVendorBankCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select bank…</option>
                  {bankList.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">10-Digit NUBAN Account Number *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="0123456789"
                  value={vendorAccount}
                  onChange={(e) => setVendorAccount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Your Executive Password *</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={vendorPassword}
                  onChange={(e) => setVendorPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowVendorModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  !vendorId ||
                  !vendorBankCode ||
                  !vendorPassword ||
                  !/^\d{10}$/.test(vendorAccount)
                }
                onClick={() =>
                  run(async () => {
                    try {
                      await api('vendors/' + vendorId + '/verify-bank', {
                        accountNumber: vendorAccount,
                        bankCode: vendorBankCode,
                        password: vendorPassword,
                      });
                      setShowVendorModal(false);
                      setMessage('Supplier bank account successfully verified.');
                    } finally {
                      setVendorPassword('');
                      setVendorAccount('');
                    }
                  })
                }
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Verify & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: GMD SECURE APPROVAL & SIGN-OFF */}
      {confirmation && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <div className="w-full max-w-xl bg-slate-900 border border-orange-500/40 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-black text-white">
                  {confirmation.operation ||
                    (confirmation.category === 'VENDOR'
                      ? 'Approve Verified Supplier Payment'
                      : 'Executive Release Approval (GMD)')}
                </h3>
              </div>
              <button
                onClick={() => {
                  setConfirmation(null);
                  setPassword('');
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {confirmation.amountMinor && (
              <div className="bg-orange-950/30 border border-orange-500/30 rounded-xl p-4 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-semibold">Exact Total Authorized:</span>
                  <span className="text-base font-black font-mono text-emerald-400">
                    {walletMoney(confirmation.amountMinor)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {confirmation.category === 'VENDOR'
                    ? 'Reserves funded envelope capacity and queues direct provider transfer to the verified vendor account.'
                    : 'GMD-authorized funds will be credited to staff internal wallets. Staff can execute self-service withdrawals anytime without additional approval.'}
                </p>
              </div>
            )}

            {confirmation.items && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Beneficiary Breakdown
                </span>
                {confirmation.items.map((i: any) => (
                  <div
                    key={i.id}
                    className="flex justify-between items-center p-2 rounded bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div>
                      <strong className="text-slate-200">{i.employeeName}</strong>
                      <span className="text-slate-500 text-[11px] ml-1">
                        ({i.employeeNumber}) · {i.organizationName}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-300">{walletMoney(i.amountMinor)}</span>
                  </div>
                ))}
              </div>
            )}

            {confirmation.operation === 'ACKNOWLEDGE_ISSUE' && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Reconciliation Note (min 10 characters) *
                </label>
                <input
                  type="text"
                  value={confirmation.note || ''}
                  onChange={(e) => setConfirmation({ ...confirmation, note: e.target.value })}
                  placeholder="Detail the verified provider resolution…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-orange-400 block mb-1">
                Enter Current GMD Password to Authorize *
              </label>
              <input
                autoFocus
                type="password"
                autoComplete="current-password"
                placeholder="Enter password…"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-orange-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  setPassword('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  !password ||
                  (confirmation.operation === 'ACKNOWLEDGE_ISSUE' &&
                    (confirmation.note || '').trim().length < 10)
                }
                onClick={handleConfirmAction}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition disabled:opacity-50 shadow-lg shadow-orange-600/30"
              >
                {busy ? 'Authenticating & Signing…' : 'Authorize Release Transaction →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
