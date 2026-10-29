'use client';

import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, ExternalLink, ArrowRight, Building2, User, CreditCard, ShieldCheck, X } from 'lucide-react';

export interface RequesterDisbursementAccount {
  bankName: string | null;
  accountNumber: string | null;
  accountName: string;
  requesterName?: string;
  amountNaira?: number;
  amountMinor?: string;
  currency?: string;
  title?: string;
  requestNumber?: string;
}

interface InstantTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: RequesterDisbursementAccount;
}

const NIGERIAN_BANKS_WEB = [
  { name: 'GTCO / GTBank', url: 'https://ibank.gtbank.com/', appScheme: 'gtworld://' },
  { name: 'Access Bank', url: 'https://www.accessbankplc.com/online-banking', appScheme: 'accessmore://' },
  { name: 'Zenith Bank', url: 'https://ibanking.zenithbank.com/', appScheme: 'zenith://' },
  { name: 'Kuda Bank', url: 'https://app.kuda.com/', appScheme: 'kuda://' },
  { name: 'OPay', url: 'https://www.opayweb.com/', appScheme: 'opay://' },
  { name: 'Moniepoint', url: 'https://moniepoint.com/', appScheme: 'moniepoint://' },
  { name: 'PalmPay', url: 'https://www.palmpay.com/', appScheme: 'palmpay://' },
  { name: 'FirstBank', url: 'https://www.firstbanknigeria.com/', appScheme: 'firstmobile://' },
  { name: 'UBA', url: 'https://www.ubagroup.com/', appScheme: 'uba://' },
  { name: 'Stanbic IBTC', url: 'https://www.stanbicibtc.com/', appScheme: 'stanbic://' },
];

export const InstantTransferModal: React.FC<InstantTransferModalProps> = ({
  isOpen,
  onClose,
  account,
}) => {
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  if (!isOpen) return null;

  const rawAmount = account.amountNaira ?? (account.amountMinor ? Number(account.amountMinor) / 100 : 0);
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: account.currency || 'NGN',
    minimumFractionDigits: 2,
  }).format(rawAmount);

  const handleCopyAccount = async () => {
    if (!account.accountNumber) return;
    try {
      await navigator.clipboard.writeText(account.accountNumber);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = account.accountNumber;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2500);
    }
  };

  const handleCopyAmount = async () => {
    try {
      await navigator.clipboard.writeText(rawAmount.toString());
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleRedirectToBank = async (bankUrl?: string, appScheme?: string) => {
    // 1. Auto-copy account number
    if (account.accountNumber) {
      try {
        await navigator.clipboard.writeText(account.accountNumber);
        setCopiedAccount(true);
      } catch {}
    }

    // 2. Detect mobile device
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile && appScheme) {
      // Attempt to launch banking app deep link
      window.location.href = appScheme;
      // Fallback timeout to web URL
      setTimeout(() => {
        if (bankUrl) window.open(bankUrl, '_blank', 'noopener,noreferrer');
      }, 750);
    } else if (bankUrl) {
      window.open(bankUrl, '_blank', 'noopener,noreferrer');
    } else {
      setShowBankPicker(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-emerald-500/30 overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Request Approved!</h3>
              <p className="text-xs text-emerald-100 font-medium">Ready for immediate disbursement transfer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Request Header Summary */}
          {account.requestNumber && (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Requisition:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{account.requestNumber}</span>
              {account.title && (
                <span className="truncate max-w-[180px] text-slate-600 dark:text-slate-300 ml-1">
                  • {account.title}
                </span>
              )}
            </div>
          )}

          {/* Amount Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Amount to Transfer
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-300 tracking-tight">
                {formattedAmount}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyAmount}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-lg shadow-sm hover:bg-emerald-50 dark:hover:bg-slate-700 transition"
              title="Copy amount only"
            >
              {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAmount ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Disbursement Banking Dossier */}
          <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800/40">
            {/* Bank Name */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 text-xs font-medium">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Destination Bank</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {account.bankName || 'Not Set / Default Corporate'}
              </span>
            </div>

            {/* Account Number (Highlight) */}
            <div className="p-3.5 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80">
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 text-xs font-medium">
                <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Account Number</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 tracking-wider">
                  {account.accountNumber || '—'}
                </span>
                {account.accountNumber && (
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                      copiedAccount
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                    }`}
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAccount ? 'Copied!' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Account Name */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 text-xs font-medium">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Account Name</span>
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-right">
                {account.accountName || account.requesterName || 'Authorized Staff Beneficiary'}
              </span>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p>
              Account details are pulled from the requester&apos;s verified disbursement profile. Please verify beneficiary name before authorizing in your bank app.
            </p>
          </div>

          {/* Bank App Selector / Redirect Area */}
          {showBankPicker ? (
            <div className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1 pb-1">
                <span>Select Bank to Open:</span>
                <button
                  type="button"
                  onClick={() => setShowBankPicker(false)}
                  className="text-emerald-600 hover:underline"
                >
                  Hide
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NIGERIAN_BANKS_WEB.map((bank) => (
                  <button
                    key={bank.name}
                    type="button"
                    onClick={() => handleRedirectToBank(bank.url, bank.appScheme)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 transition text-left"
                  >
                    <span className="truncate">{bank.name}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 ml-1 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopyAccount}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white active:scale-[0.98] transition shadow-md"
            >
              {copiedAccount ? <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedAccount ? 'Account Number Copied!' : 'Copy Account Number'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRedirectToBank(undefined, undefined)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-[0.98] transition shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Copy &amp; Open Bank App</span>
            </button>
          </div>

          {/* Dismiss Action */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
            >
              Done / Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
