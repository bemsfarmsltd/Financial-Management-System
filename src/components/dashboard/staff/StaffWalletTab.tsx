'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Landmark,
  X,
  CreditCard,
  History,
  FileText,
  Users,
  CornerDownLeft,
  HelpCircle,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { walletApi } from '@/lib/wallet/client';

export function formatNaira(minorUnits: string | number | bigint) {
  const n = BigInt(minorUnits?.toString() || '0');
  const a = n < BigInt(0) ? -n : n;
  const major = a / BigInt(100);
  const kobo = a % BigInt(100);
  return (
    (n < BigInt(0) ? '-' : '') +
    '₦' +
    new Intl.NumberFormat('en-NG').format(major) +
    '.' +
    kobo.toString().padStart(2, '0')
  );
}

export function parseNairaToMinor(value: string) {
  const clean = value.replace(/,/g, '').trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(clean)) {
    throw new Error('Enter a valid amount with up to 2 decimal places.');
  }
  const [w, f = ''] = clean.split('.');
  return (BigInt(w) * BigInt(100) + BigInt((f + '00').slice(0, 2))).toString();
}

interface StaffWalletTabProps {
  user: any;
  payslips?: any[];
  onRequestFunds?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

export function StaffWalletTab({ user, payslips = [], onRequestFunds }: StaffWalletTabProps) {
  const [wallet, setWallet] = useState<any>(null);
  const [banksList, setBanksList] = useState<{ code: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active ledger filters
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'INFLOWS' | 'OUTFLOWS' | 'PENDING'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'MONTH' | '30DAYS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Modals
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isBeneficiariesModalOpen, setIsBeneficiariesModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isReturnSurplusModalOpen, setIsReturnSurplusModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isPayslipsModalOpen, setIsPayslipsModalOpen] = useState(false);
  const [isInsufficientBalanceOpen, setIsInsufficientBalanceOpen] = useState(false);
  const [insufficientDetails, setInsufficientDetails] = useState({ requested: '0', available: '0' });

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNarration, setWithdrawNarration] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [withdrawalReceipt, setWithdrawalReceipt] = useState<any>(null);

  // Add Bank form
  const [newBankCode, setNewBankCode] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [resolvedAccountName, setResolvedAccountName] = useState('');
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [addBankPassword, setAddBankPassword] = useState('');
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Return Surplus form
  const [surplusLotId, setSurplusLotId] = useState('');
  const [surplusAmount, setSurplusAmount] = useState('');
  const [surplusReason, setSurplusReason] = useState('');
  const [surplusPassword, setSurplusPassword] = useState('');
  const [isSubmittingSurplus, setIsSubmittingSurplus] = useState(false);

  const idempotencyRef = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : 'init');

  const loadWalletData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await walletApi('me');
      setWallet(data);
      if (data?.banks?.length > 0 && !selectedBankId) {
        setSelectedBankId(data.banks[0].id);
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Failed to load wallet data' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWalletData();
    // Load banks catalog for adding new account
    fetch('/api/wallet/banks', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { banks: [] }))
      .then((d) => setBanksList(d.banks || []))
      .catch(() => {});
  }, []);

  const copyToClipboard = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedRef(text);
      setTimeout(() => setCopiedRef(null), 2000);
    }
  };

  // Resolve account name when 10 digits are typed
  useEffect(() => {
    if (newBankCode && newAccountNumber.length === 10) {
      setIsResolvingAccount(true);
      setResolvedAccountName('');
      fetch(
        `/api/wallet/banks/resolve?accountNumber=${encodeURIComponent(newAccountNumber)}&bankCode=${encodeURIComponent(newBankCode)}`
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.accountName) setResolvedAccountName(d.accountName);
          else setResolvedAccountName('');
        })
        .catch(() => setResolvedAccountName(''))
        .finally(() => setIsResolvingAccount(false));
    } else {
      setResolvedAccountName('');
    }
  }, [newBankCode, newAccountNumber]);

  const handleStartWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const requestedMinor = parseNairaToMinor(withdrawAmount);
      const availableMinor = wallet?.availableMinor?.toString() || '0';
      const reqInt = BigInt(requestedMinor);
      const availInt = BigInt(availableMinor);

      // Graceful Insufficient Balance Check BEFORE Password
      if (reqInt > availInt || availInt <= BigInt(0)) {
        setInsufficientDetails({ requested: requestedMinor, available: availableMinor });
        setIsInsufficientBalanceOpen(true);
        return;
      }

      // Sufficient balance -> Proceed to Password Authorization
      setIsAuthModalOpen(true);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPassword) return;
    setIsSubmittingWithdrawal(true);
    try {
      const amountMinor = parseNairaToMinor(withdrawAmount);
      const bank = wallet.banks.find((b: any) => b.id === selectedBankId) || wallet.banks[0];

      let candidate: any = {
        amountMinor,
        bankAccountId: bank.id,
        idempotencyKey: `web-${Date.now()}-${idempotencyRef.current}`,
        creditAllocations: [{ creditLotId: 'ALL', amountMinor }],
      };

      // 1. Withdrawal plan
      const plan = await walletApi('withdrawal-plan', candidate, 'POST');
      if (plan?.intent) {
        candidate = plan.intent;
      }

      // 2. Security challenge
      const proof = await walletApi('challenges', {
        purpose: 'WITHDRAWAL',
        payload: candidate,
        password: authPassword,
      });

      // 3. Execution
      const result = await walletApi('withdrawals', {
        intent: candidate,
        challengeId: proof.id,
        challengeToken: proof.token,
      });

      idempotencyRef.current = crypto.randomUUID();
      setIsAuthModalOpen(false);
      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');
      setWithdrawNarration('');
      setAuthPassword('');
      setWithdrawalReceipt({ result, bank, amountMinor });
      loadWalletData(true);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Withdrawal failed.' });
      setIsAuthModalOpen(false);
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankCode || !newAccountNumber || !addBankPassword) return;
    setIsSavingBank(true);
    try {
      await walletApi('banks', {
        bankCode: newBankCode,
        accountNumber: newAccountNumber,
        password: addBankPassword,
      });
      setNotice({ type: 'success', message: 'Bank account verified & saved successfully.' });
      setIsAddAccountModalOpen(false);
      setNewBankCode('');
      setNewAccountNumber('');
      setResolvedAccountName('');
      setAddBankPassword('');
      loadWalletData(true);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Could not verify bank account.' });
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleReturnSurplus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surplusLotId || !surplusAmount || !surplusPassword) return;
    setIsSubmittingSurplus(true);
    try {
      const amountMinor = parseNairaToMinor(surplusAmount);
      const intent = {
        creditLotId: surplusLotId,
        amountMinor,
        reason: surplusReason || 'Return unspent operational funds',
      };
      const proof = await walletApi('challenges', {
        purpose: 'WITHDRAWAL',
        payload: intent,
        password: surplusPassword,
      });
      await walletApi('surplus', {
        intent,
        challengeId: proof.id,
        challengeToken: proof.token,
      });
      setNotice({ type: 'success', message: 'Unused funds returned to Treasury successfully.' });
      setIsReturnSurplusModalOpen(false);
      setSurplusAmount('');
      setSurplusReason('');
      setSurplusPassword('');
      loadWalletData(true);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to return surplus funds.' });
    } finally {
      setIsSubmittingSurplus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
        <RefreshCw className="w-8 h-8 text-[#EA580C] animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-600">Loading your enterprise wallet & ledger...</p>
      </div>
    );
  }

  const availableMinor = wallet?.availableMinor?.toString() || '0';
  const heldMinor = wallet?.heldMinor?.toString() || '0';
  const settledMinor = wallet?.settledMinor?.toString() || '0';
  const primaryBank = wallet?.banks && wallet.banks.length > 0 ? wallet.banks[0] : null;

  // Build unified transaction ledger
  const credits = (wallet?.credits || []).map((c: any) => ({
    ...c,
    type: 'CREDIT',
    timestamp: new Date(c.createdAt).getTime(),
  }));
  const withdrawals = (wallet?.withdrawals || []).map((w: any) => ({
    ...w,
    type: 'WITHDRAWAL',
    timestamp: new Date(w.createdAt).getTime(),
  }));
  const allLedgerItems = [...credits, ...withdrawals].sort((a, b) => b.timestamp - a.timestamp);

  // Apply filters
  const filteredLedger = allLedgerItems.filter((item) => {
    if (activeFilter === 'INFLOWS' && item.type !== 'CREDIT') return false;
    if (activeFilter === 'OUTFLOWS' && item.type !== 'WITHDRAWAL') return false;
    if (activeFilter === 'PENDING' && item.type === 'WITHDRAWAL' && item.status === 'SETTLED') return false;

    if (timeFilter === 'MONTH') {
      const itemMonth = new Date(item.timestamp).getMonth();
      const nowMonth = new Date().getMonth();
      if (itemMonth !== nowMonth) return false;
    } else if (timeFilter === '30DAYS') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (item.timestamp < thirtyDaysAgo) return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchCat = (item.category || item.sourceType || '').toLowerCase().includes(query);
      const matchRef = (item.reference || item.id || '').toLowerCase().includes(query);
      const matchAcc = (item.accountName || item.lastFour || '').toLowerCase().includes(query);
      return matchCat || matchRef || matchAcc;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notice */}
      {notice && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="text-xs font-bold">{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP: HERO BANKING CARD (OPay Style) */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#EA580C] via-[#F97316] to-[#C2410C] text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-orange-100 tracking-wider uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-white" />
                Available Balance
              </span>
              <button
                onClick={() => setHideBalance(!hideBalance)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title={hideBalance ? 'Show balance' : 'Hide balance'}
              >
                {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white backdrop-blur-sm border border-white/30">
                ● Monnify Backed
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight font-mono">
              {hideBalance ? '₦ ••••••••••' : formatNaira(availableMinor)}
            </h2>

            <div className="flex items-center gap-4 text-xs text-orange-100 font-semibold pt-1">
              <span>Held in Transit: <strong>{hideBalance ? '••••' : formatNaira(heldMinor)}</strong></span>
              <span>·</span>
              <span>Settled: <strong>{hideBalance ? '••••' : formatNaira(settledMinor)}</strong></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            {primaryBank ? (
              <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 text-xs space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-bold text-orange-200 uppercase">Primary Payout Bank</span>
                  <span className="text-[10px] font-extrabold text-emerald-300">Zero Fee Guarantee</span>
                </div>
                <div className="font-black text-white text-sm truncate max-w-[240px]">
                  {primaryBank.accountName}
                </div>
                <div className="text-[11px] text-orange-100 font-mono">
                  •••• {primaryBank.lastFour}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 text-xs text-orange-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-300" />
                <span>No verified withdrawal bank account yet.</span>
              </div>
            )}

            <button
              onClick={() => loadWalletData(true)}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all self-start md:self-end"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Balance</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6-SERVICES GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <button
          onClick={() => setIsWithdrawModalOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all group text-left flex flex-col justify-between h-28"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#EA580C] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-[#0F172A]">To Bank</div>
            <div className="text-[10.5px] text-slate-500">Instant withdrawal</div>
          </div>
        </button>

        <button
          onClick={() => setIsBeneficiariesModalOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all group text-left flex flex-col justify-between h-28"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-[#0F172A]">Beneficiaries</div>
            <div className="text-[10.5px] text-slate-500">Verified accounts ({wallet?.banks?.length || 0})</div>
          </div>
        </button>

        <button
          onClick={() => setIsReturnSurplusModalOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all group text-left flex flex-col justify-between h-28"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CornerDownLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-[#0F172A]">Return Surplus</div>
            <div className="text-[10.5px] text-slate-500">To Central Treasury</div>
          </div>
        </button>

        <button
          onClick={() => setIsPayslipsModalOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-lg transition-all group text-left flex flex-col justify-between h-28"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-[#0F172A]">Payslips</div>
            <div className="text-[10.5px] text-slate-500">Monthly vouchers ({payslips.length})</div>
          </div>
        </button>

        <button
          onClick={() => setIsStatementModalOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-lg transition-all group text-left flex flex-col justify-between h-28"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-[#0F172A]">Statement</div>
            <div className="text-[10.5px] text-slate-500">Ledger audit trail</div>
          </div>
        </button>

        <a
          href="https://wa.me/2348000000000?text=Hello%20BEMS%20Treasury%20Support"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all group text-left flex flex-col justify-between h-28"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-[#0F172A]">Helpdesk</div>
            <div className="text-[10.5px] text-slate-500">Finance support</div>
          </div>
        </a>
      </div>

      {/* TREASURY ASSURANCE BANNER */}
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-emerald-900">BEMS Central Treasury Assurance</div>
            <div className="text-[11.5px] text-emerald-700">Zero transfer fees · Monnify instant settlement · Company sponsored</div>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-600 text-white uppercase tracking-wider shrink-0">
          Active
        </span>
      </div>

      {/* ACTIVITY & LEDGER */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-[#0F172A]">Activity &amp; Ledger</h3>
            <p className="text-xs text-slate-500">Real-time audit trail of all approved inflows and bank settlements</p>
          </div>

          {/* Time Filters */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setTimeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${timeFilter === 'ALL' ? 'bg-white text-[#EA580C] shadow-sm font-black' : 'hover:text-slate-900'}`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeFilter('MONTH')}
              className={`px-3 py-1.5 rounded-lg transition-all ${timeFilter === 'MONTH' ? 'bg-white text-[#EA580C] shadow-sm font-black' : 'hover:text-slate-900'}`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeFilter('30DAYS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${timeFilter === '30DAYS' ? 'bg-white text-[#EA580C] shadow-sm font-black' : 'hover:text-slate-900'}`}
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* Tab Filters + Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${activeFilter === 'ALL' ? 'bg-[#EA580C] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All Transactions ({allLedgerItems.length})
            </button>
            <button
              onClick={() => setActiveFilter('INFLOWS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${activeFilter === 'INFLOWS' ? 'bg-[#EA580C] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Inflows (Credits)
            </button>
            <button
              onClick={() => setActiveFilter('OUTFLOWS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${activeFilter === 'OUTFLOWS' ? 'bg-[#EA580C] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Outflows (Payouts)
            </button>
            <button
              onClick={() => setActiveFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${activeFilter === 'PENDING' ? 'bg-[#EA580C] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Pending
            </button>
          </div>

          <input
            type="text"
            placeholder="Search reference, category, bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#EA580C]"
          />
        </div>

        {/* Transactions List */}
        {filteredLedger.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
            No transactions match the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLedger.map((item: any) => {
              const isCredit = item.type === 'CREDIT';
              const amount = isCredit
                ? item.amountMinor || item.availableMinor
                : item.amountMinor;
              return (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : 'bg-red-50 text-red-600 border border-red-100'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0F172A] flex items-center gap-2">
                        <span>{isCredit ? item.category || 'Treasury Funding Credit' : `Withdrawal to •••• ${item.lastFour || 'Bank'}`}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCredit
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'SETTLED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isCredit ? 'CREDITED' : item.status || 'SUBMITTED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-0.5">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        <span>·</span>
                        <span className="font-mono text-[10.5px]">
                          Ref: {item.reference || item.id?.slice(0, 8)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(item.reference || item.id)}
                          className="p-0.5 hover:text-slate-800 text-slate-400"
                          title="Copy reference"
                        >
                          {copiedRef === (item.reference || item.id) ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-black font-mono ${
                        isCredit ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isCredit ? '+' : '-'}{formatNaira(amount)}
                    </div>
                    {isCredit && (
                      <div className="text-[10.5px] text-slate-500">
                        Avail: {formatNaira(item.availableMinor)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WITHDRAW MODAL */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#EA580C] border border-orange-100 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0F172A]">Withdraw Approved Funds</h3>
                  <p className="text-xs text-slate-500">Instant Monnify transfer to your verified account</p>
                </div>
              </div>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-2xl text-xs text-orange-900 space-y-1">
              <div className="font-black">Available Balance: {formatNaira(availableMinor)}</div>
              <div className="text-[11px] text-orange-700">Company pays Monnify transfer fees. Zero deduction to principal.</div>
            </div>

            <form onSubmit={handleStartWithdrawal} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  AMOUNT TO WITHDRAW (₦)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base font-mono font-bold focus:outline-none focus:border-[#EA580C]"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black text-slate-700">
                    DESTINATION BENEFICIARY
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddAccountModalOpen(true)}
                    className="text-xs font-bold text-[#EA580C] hover:underline"
                  >
                    + Add New Account
                  </button>
                </div>

                {wallet?.banks?.length > 0 ? (
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-[#EA580C]"
                  >
                    {wallet.banks.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.accountName} (•••• {b.lastFour})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    No bank accounts verified yet. Tap &quot;+ Add New Account&quot; above.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  TRANSFER NARRATION (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved operational advance"
                  value={withdrawNarration}
                  onChange={(e) => setWithdrawNarration(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#EA580C]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!wallet?.banks?.length}
                  className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black shadow-md shadow-orange-500/20 disabled:opacity-50"
                >
                  Proceed to Authorization →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSUFFICIENT BALANCE DIALOG (OPay Style) */}
      {isInsufficientBalanceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 border border-slate-200 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-[#0F172A]">Insufficient Wallet Balance</h3>
              <p className="text-xs text-slate-600">
                You requested <strong>{formatNaira(insufficientDetails.requested)}</strong>, but your available GMD-approved balance is <strong>{formatNaira(insufficientDetails.available)}</strong>.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500">
              Submit an operational or project expense requisition to receive approved Treasury funds.
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsInsufficientBalanceOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Dismiss
              </button>
              {onRequestFunds && (
                <button
                  onClick={() => {
                    setIsInsufficientBalanceOpen(false);
                    setIsWithdrawModalOpen(false);
                    onRequestFunds();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black shadow-sm"
                >
                  + Request Funds
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD AUTHORIZATION DIALOG */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#EA580C]" />
                <h3 className="text-sm font-black text-[#0F172A]">Authorize Transfer</h3>
              </div>
              <button onClick={() => setIsAuthModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Transfer <strong>₦{withdrawAmount}</strong>. Instant Monnify settlement.
            </p>

            <form onSubmit={handleExecuteWithdrawal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account Password or PIN
                </label>
                <input
                  type="password"
                  placeholder="Enter login password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#EA580C]"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWithdrawal || !authPassword}
                  className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingWithdrawal && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>Authorize</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WITHDRAWAL RECEIPT MODAL */}
      {withdrawalReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 border border-slate-200 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-[#0F172A]">Transfer Submitted!</h3>
              <p className="text-xs text-slate-600">Your withdrawal has been queued for instant settlement.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-black text-slate-900">{formatNaira(withdrawalReceipt.amountMinor)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiary</span>
                <span className="font-bold text-slate-900">{withdrawalReceipt.bank.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Number</span>
                <span className="font-mono text-slate-900">•••• {withdrawalReceipt.bank.lastFour}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference</span>
                <span className="font-mono text-slate-900">{withdrawalReceipt.result.reference}</span>
              </div>
            </div>
            <button
              onClick={() => setWithdrawalReceipt(null)}
              className="w-full py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* BENEFICIARIES MODAL */}
      {isBeneficiariesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0F172A]">Verified Bank Accounts</h3>
                  <p className="text-xs text-slate-500">Designated disbursement accounts matching your legal identity</p>
                </div>
              </div>
              <button onClick={() => setIsBeneficiariesModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {!wallet?.banks || wallet.banks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
                  No verified accounts added yet.
                </div>
              ) : (
                wallet.banks.map((b: any, idx: number) => (
                  <div key={b.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>{b.accountName}</span>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 rounded text-[9.5px] font-black bg-emerald-100 text-emerald-800">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Account: •••• {b.lastFour}
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsBeneficiariesModalOpen(false);
                  setIsAddAccountModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black shadow-sm"
              >
                + Add Another Account
              </button>
              <button
                type="button"
                onClick={() => setIsBeneficiariesModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ACCOUNT MODAL */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#EA580C]" />
                <h3 className="text-sm font-black text-[#0F172A]">Add &amp; Verify Bank Account</h3>
              </div>
              <button onClick={() => setIsAddAccountModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Bank</label>
                <select
                  value={newBankCode}
                  onChange={(e) => setNewBankCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-[#EA580C]"
                  required
                >
                  <option value="">-- Choose destination bank --</option>
                  {banksList.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Number (10 Digits)</label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="0123456789"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-[#EA580C]"
                  required
                />
              </div>

              {/* Resolved Name Preview */}
              {isResolvingAccount ? (
                <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#EA580C]" />
                  <span>Verifying account with Monnify...</span>
                </div>
              ) : resolvedAccountName ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{resolvedAccountName}</span>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Login Password to Confirm</label>
                <input
                  type="password"
                  placeholder="Enter login password"
                  value={addBankPassword}
                  onChange={(e) => setAddBankPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#EA580C]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBank || !newBankCode || newAccountNumber.length !== 10 || !addBankPassword}
                  className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black disabled:opacity-50"
                >
                  {isSavingBank ? 'Verifying...' : 'Save & Verify Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN SURPLUS MODAL */}
      {isReturnSurplusModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CornerDownLeft className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-[#0F172A]">Return Surplus Advance</h3>
              </div>
              <button onClick={() => setIsReturnSurplusModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Return unspent funds from approved operational allocations back to BEMS Central Treasury.
            </p>

            <form onSubmit={handleReturnSurplus} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Credit Allocation</label>
                <select
                  value={surplusLotId}
                  onChange={(e) => setSurplusLotId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-[#EA580C]"
                  required
                >
                  <option value="">-- Choose allocation --</option>
                  {(wallet?.credits || [])
                    .filter((c: any) => BigInt(c.availableMinor || '0') > BigInt(0))
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.category} · Available: {formatNaira(c.availableMinor)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount to Return (₦)</label>
                <input
                  type="text"
                  placeholder="e.g. 15000"
                  value={surplusAmount}
                  onChange={(e) => setSurplusAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-[#EA580C]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Justification</label>
                <input
                  type="text"
                  placeholder="e.g. Unspent balance on site trip"
                  value={surplusReason}
                  onChange={(e) => setSurplusReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#EA580C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Login Password to Confirm</label>
                <input
                  type="password"
                  placeholder="Enter login password"
                  value={surplusPassword}
                  onChange={(e) => setSurplusPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#EA580C]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReturnSurplusModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSurplus || !surplusLotId || !surplusAmount || !surplusPassword}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50"
                >
                  {isSubmittingSurplus ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYSLIPS MODAL */}
      {isPayslipsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-black text-[#0F172A]">Confidential Payslips &amp; Vouchers</h3>
              </div>
              <button onClick={() => setIsPayslipsModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {payslips.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
                  No monthly salary payslips generated yet.
                </div>
              ) : (
                payslips.map((p: any) => (
                  <div key={p.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-slate-900">{p.period || p.title || 'Monthly Salary'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">Voucher: {p.id?.slice(0, 10)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-emerald-700">
                        {formatNaira(p.netMinor || p.grossMinor || p.amountMinor || 0)}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600">CONFIRMED</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setIsPayslipsModalOpen(false)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* STATEMENT AUDIT MODAL */}
      {isStatementModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#0F172A]">Official Wallet Statement</h3>
                <p className="text-xs text-slate-500">{user.fullName} · {user.employeeNumber}</p>
              </div>
              <button onClick={() => setIsStatementModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 text-[11px]">Total Available</span>
                <div className="font-mono font-black text-slate-900 text-sm">{formatNaira(availableMinor)}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Held in Transit</span>
                <div className="font-mono font-black text-slate-900 text-sm">{formatNaira(heldMinor)}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Total Settled</span>
                <div className="font-mono font-black text-emerald-700 text-sm">{formatNaira(settledMinor)}</div>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
              {allLedgerItems.map((item: any) => (
                <div key={item.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <strong className="text-slate-900">{item.type === 'CREDIT' ? item.category || 'Credit' : 'Bank Settlement'}</strong>
                    <div className="text-[10.5px] text-slate-500">{new Date(item.timestamp).toLocaleString()} · Ref: {item.reference || item.id?.slice(0, 8)}</div>
                  </div>
                  <span className={`font-mono font-bold ${item.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {item.type === 'CREDIT' ? '+' : '-'}{formatNaira(item.amountMinor || item.availableMinor)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                🖨️ Print Statement
              </button>
              <button
                onClick={() => setIsStatementModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

