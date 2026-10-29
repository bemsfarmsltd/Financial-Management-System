'use client';

import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, ExternalLink, Building2, User, CreditCard, ShieldCheck, X, ArrowRight } from 'lucide-react';

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
  onProceedToDisbursement?: () => void;
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
  onProceedToDisbursement,
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
    } catch {}
  };

  const handleRedirectToBank = async (bankUrl?: string, appScheme?: string) => {
    if (account.accountNumber) {
      try {
        await navigator.clipboard.writeText(account.accountNumber);
        setCopiedAccount(true);
      } catch {}
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile && appScheme) {
      window.location.href = appScheme;
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Frosted Transparent White Modal Card */}
      <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.18)] border border-white/80 overflow-hidden text-slate-800">
        
        {/* Transparent White / Emerald Frosted Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50/40 border-b border-emerald-100 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Request Approved!</h3>
              <p className="text-xs text-emerald-800 font-medium">Ready for immediate disbursement transfer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Request Header Summary */}
          {account.requestNumber && (
            <div className="flex items-center justify-between bg-slate-50/90 px-4 py-2.5 rounded-xl border border-slate-200/70 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500">Requisition:</span>
                <span className="font-mono font-bold text-slate-900">{account.requestNumber}</span>
              </div>
              {account.title && (
                <span className="truncate max-w-[200px] text-slate-600 font-medium ml-1">
                  • {account.title}
                </span>
              )}
            </div>
          )}

          {/* Amount Card */}
          <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-emerald-50/40 p-4 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Amount to Transfer
              </span>
              <div className="text-3xl font-black text-emerald-950 tracking-tight mt-0.5">
                {formattedAmount}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyAmount}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white border border-emerald-300 text-emerald-800 rounded-xl shadow-sm hover:bg-emerald-50 active:scale-95 transition"
              title="Copy amount only"
            >
              {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAmount ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Disbursement Banking Dossier Card */}
          <div className="border border-slate-200/90 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white/90 shadow-sm">
            {/* Bank Name */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Destination Bank</span>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {account.bankName || 'Not Set / Corporate'}
              </span>
            </div>

            {/* Account Number (Highlight) */}
            <div className="p-4 flex items-center justify-between bg-emerald-50/30">
              <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Account Number</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xl font-black text-emerald-800 tracking-wider">
                  {account.accountNumber || '—'}
                </span>
                {account.accountNumber && (
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
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
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                <User className="w-4 h-4 text-emerald-600" />
                <span>Account Name</span>
              </div>
              <span className="text-sm font-semibold text-slate-900 text-right">
                {account.accountName || account.requesterName || 'Authorized Staff Beneficiary'}
              </span>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-900">
            <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              Account details are pulled from the requester&apos;s verified disbursement profile. Please verify beneficiary name before authorizing in your bank app.
            </p>
          </div>

          {/* Bank App Selector / Redirect Area */}
          {showBankPicker ? (
            <div className="space-y-2 border border-slate-200 rounded-2xl p-3.5 bg-slate-50/90 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1 pb-1">
                <span>Select Bank to Open:</span>
                <button
                  type="button"
                  onClick={() => setShowBankPicker(false)}
                  className="text-emerald-600 hover:underline font-semibold"
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
                    className="flex items-center justify-between px-3 py-2 text-xs font-semibold bg-white hover:bg-emerald-50 border border-slate-200/90 rounded-xl text-slate-800 transition text-left shadow-2xs"
                  >
                    <span className="truncate">{bank.name}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 ml-1 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopyAccount}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white active:scale-[0.98] transition shadow-sm"
            >
              {copiedAccount ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedAccount ? 'Account Copied!' : 'Copy Account Number'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRedirectToBank(undefined, undefined)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white active:scale-[0.98] transition shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Copy &amp; Open Bank App</span>
            </button>
          </div>

          {/* Next Step: Proceed to Record Disbursement */}
          {onProceedToDisbursement && (
            <button
              type="button"
              onClick={onProceedToDisbursement}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 transition shadow-2xs"
            >
              <span>Record Bank Payment &amp; Upload Slip</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          )}

          {/* Dismiss Action */}
          <div className="text-center pt-0.5">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
