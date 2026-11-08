'use client';

import React, { useState } from 'react';
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Building2,
  User,
  ArrowRight,
  X,
  ShieldCheck,
} from 'lucide-react';

export interface StaffWalletReleaseData {
  requestId: string;
  requestNumber: string;
  title: string;
  amountFormatted: string;
  amountMinor?: string;
  staffName: string;
  staffNumber: string;
  staffRole?: string;
  subsidiaryName: string;
  subsidiaryId?: string;
  brandColor?: string;
}

interface ReleaseToStaffWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  data: StaffWalletReleaseData | null;
}

export const ReleaseToStaffWalletModal: React.FC<ReleaseToStaffWalletModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  data,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);

  if (!isOpen || !data) return null;

  const walletNumber = `WLT-${data.staffNumber || 'STAFF'}`;
  const themeColor = data.brandColor || '#059669';

  const handleCopyWalletNumber = () => {
    navigator.clipboard.writeText(walletNumber);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleAuthorizeRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your GMD password to authorize release.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/wallet/releases/approve-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: data.requestId,
          password,
          note: note.trim() || undefined,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to authorize wallet release.');
      }

      setSuccessReceipt(resJson);
    } catch (err: any) {
      setError(err?.message || 'Authorization failed. Check your password and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    setPassword('');
    setNote('');
    setError(null);
    setSuccessReceipt(null);
    onSuccess();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50/40 border-b border-emerald-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 shadow-sm">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Release to Staff Wallet
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  GMD Authorization
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Requisition {data.requestNumber} · {data.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {successReceipt ? (
          /* STATE 2: SUCCESS RECEIPT */
          <div className="p-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-slate-900 tracking-tight">
                Funds Successfully Credited!
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                <strong className="text-slate-900">{successReceipt.amountFormatted}</strong> has been released from{' '}
                <span className="font-semibold">{successReceipt.subsidiary?.name}</span>'s funded budget into{' '}
                <strong className="text-slate-900">{successReceipt.staff?.name}</strong>'s internal wallet.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Beneficiary Staff</span>
                <span className="font-bold text-slate-900">{successReceipt.staff?.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Staff Wallet Number</span>
                <span className="font-mono font-bold text-emerald-700">{successReceipt.staff?.walletNumber}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Source Budget Envelope</span>
                <span className="font-medium text-slate-700">{successReceipt.subsidiary?.envelopeLabel || 'Operational Budget'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Requisition Number</span>
                <span className="font-mono font-bold text-slate-900">{successReceipt.requestNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Credited Timestamp</span>
                <span className="text-slate-600">{successReceipt.timestamp || 'Just now'}</span>
              </div>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>
                The staff member has been notified via their staff portal. They can now withdraw to their verified bank account at their own convenience without a second business approval.
              </span>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              Done / Return to Approvals
            </button>
          </div>
        ) : (
          /* STATE 1: AUTHORIZATION FORM */
          <form onSubmit={handleAuthorizeRelease} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount to Release Card */}
            <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  Amount to Credit Staff Wallet
                </span>
                <div className="text-2xl font-black text-emerald-950 tracking-tight mt-0.5">
                  {data.amountFormatted}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-500 block">Subsidiary Source</span>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1 justify-end mt-0.5">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  {data.subsidiaryName}
                </span>
              </div>
            </div>

            {/* Staff Dossier Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Beneficiary Staff Member
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-500">
                  ID: {data.staffNumber}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-xs">
                    {data.staffName.charAt(0)}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 leading-tight">{data.staffName}</h5>
                    <span className="text-[10px] text-slate-500">
                      {data.staffRole || 'Staff Member'} · {data.subsidiaryName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Staff Wallet Identifier */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Staff Wallet No:</span>
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {walletNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWalletNumber}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 transition px-2 py-1 rounded hover:bg-slate-200/70"
                >
                  {copiedWallet ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Policy Info Notice */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-amber-900 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <span>
                Authorized funds will be credited immediately to the staff internal wallet from the subsidiary's funded budget envelope. The staff member can then withdraw to their verified bank account at their own time.
              </span>
            </div>

            {/* Executive Directive Note (Optional) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Executive Directive / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Authorized within Q4 operational plan."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800 transition"
              />
            </div>

            {/* GMD Password Verification */}
            <div>
              <label className="block text-[11px] font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                Enter Current GMD Password to Authorize Release *
              </label>
              <div className="relative">
                <input
                  autoFocus
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your executive password…"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900 font-mono transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !password}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  'Authenticating & Crediting…'
                ) : (
                  <>
                    Authorize &amp; Credit Staff Wallet
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
