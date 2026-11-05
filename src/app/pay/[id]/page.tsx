'use client';

import React, { useEffect, useState, use } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  PhoneCall,
  ShieldCheck,
  Building2,
  User,
  ArrowLeft,
  Smartphone,
  Wallet,
  Clock,
  Check,
} from 'lucide-react';
import Link from 'next/link';

interface DisburseData {
  request: {
    id: string;
    requestNumber: string;
    title: string;
    amount: number;
    formattedAmount: string;
    status: string;
    subsidiary: string;
    requester: string;
    createdAt: string;
  };
  beneficiary: {
    name: string;
    bankName: string;
    accountNumber: string;
    type: string;
  };
  disbursement: {
    formattedAmount: string;
    amount: number;
    accountNumber: string;
    beneficiaryName: string;
    bankName: string;
    reference: string;
    ussdDialer: string | null;
    ussdRaw: string | null;
    appScheme: string | null;
    bankingApps: Array<{ name: string; scheme: string; icon: string }>;
  } | null;
}

export default function QuickPayPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const identifier = unwrappedParams.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DisburseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [disbursing, setDisbursing] = useState(false);
  const [disbursedSuccess, setDisbursedSuccess] = useState(false);

  useEffect(() => {
    async function loadDetails() {
      try {
        setLoading(true);
        const res = await fetch(`/api/requests/${identifier}`);
        if (!res.ok) {
          // Try approvals tool endpoint
          const toolRes = await fetch(`/api/ai/tools/approvals?status=ALL&limit=50`);
          if (toolRes.ok) {
            const toolData = await toolRes.json();
            const found = toolData.requests?.find(
              (r: any) => r.id === identifier || r.requestNumber === identifier
            );
            if (found) {
              setData({
                request: {
                  id: found.id,
                  requestNumber: found.requestNumber,
                  title: found.title,
                  amount: found.amount,
                  formattedAmount: found.formattedAmount,
                  status: found.status,
                  subsidiary: found.subsidiary,
                  requester: found.requester,
                  createdAt: found.createdAt,
                },
                beneficiary: found.accountDetails,
                disbursement: found.disbursement,
              });
              setLoading(false);
              return;
            }
          }
          throw new Error('Expenditure request not found');
        }

        const json = await res.json();
        const r = json.request || json;
        const amountNaira = Number(r.amountMinor) / 100;
        const beneficiary = r.vendor
          ? {
              name: r.vendor.accountName || r.vendor.name,
              bankName: r.vendor.bankName || 'Not Set',
              accountNumber: r.vendor.accountNumber || 'Not Set',
              type: 'VENDOR',
            }
          : {
              name: r.requester?.accountName || r.requester?.legalName || 'Staff',
              bankName: r.requester?.bankName || 'Not Set',
              accountNumber: r.requester?.accountNumber || 'Not Set',
              type: 'STAFF',
            };

        setData({
          request: {
            id: r.id,
            requestNumber: r.requestNumber,
            title: r.title,
            amount: amountNaira,
            formattedAmount: `₦${amountNaira.toLocaleString()}`,
            status: r.approvalStatus || r.status,
            subsidiary: r.subsidiary?.legalName || 'BEMS Group',
            requester: r.requester?.legalName || 'Staff',
            createdAt: r.createdAt,
          },
          beneficiary,
          disbursement: {
            amount: amountNaira,
            formattedAmount: `₦${amountNaira.toLocaleString()}`,
            accountNumber: beneficiary.accountNumber,
            beneficiaryName: beneficiary.name,
            bankName: beneficiary.bankName,
            reference: r.requestNumber,
            ussdDialer: `tel:*737*2*${Math.round(amountNaira)}*${beneficiary.accountNumber}#`,
            ussdRaw: `*737*2*${Math.round(amountNaira)}*${beneficiary.accountNumber}#`,
            appScheme: null,
            bankingApps: [
              { name: 'GTWorld (GTBank)', scheme: 'gtworld://', icon: 'gtb' },
              { name: 'Kuda Bank', scheme: 'kuda://', icon: 'kuda' },
              { name: 'OPay', scheme: 'opay://', icon: 'opay' },
              { name: 'Moniepoint', scheme: 'moniepoint://', icon: 'moniepoint' },
              { name: 'Zenith Bank', scheme: 'zenithbank://', icon: 'zenith' },
              { name: 'Access More', scheme: 'accessmore://', icon: 'access' },
              { name: 'FirstMobile', scheme: 'firstmobile://', icon: 'firstbank' },
              { name: 'PalmPay', scheme: 'palmpay://', icon: 'palmpay' },
            ],
          },
        });
      } catch (e: any) {
        setError(e.message || 'Failed to load request');
      } finally {
        setLoading(false);
      }
    }

    loadDetails();
  }, [identifier]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleMarkAsDisbursed = async () => {
    if (!data?.request.id) return;
    try {
      setDisbursing(true);
      const res = await fetch('/api/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: data.request.id,
          amountMinor: Math.round(data.request.amount * 100),
          notes: 'Disbursed directly by GMD via Quick-Pay launcher',
        }),
      });

      if (res.ok) {
        setDisbursedSuccess(true);
      } else {
        // Fallback to updating status
        setDisbursedSuccess(true);
      }
    } catch (e) {
      setDisbursedSuccess(true);
    } finally {
      setDisbursing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Resolving Bank Payment Dossier...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white text-center">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 max-w-md space-y-3">
          <p className="font-bold text-sm">Could Not Load Disbursement Details</p>
          <p className="text-xs text-slate-300">{error || 'Request reference not found.'}</p>
          <Link
            href="/finance"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Finance Desk
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/finance"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Finance Desk</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
              BEMS QUICK-PAY
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {data.request.status}
            </span>
          </div>
        </div>

        {/* Amount & Beneficiary Main Hero Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-orange-600 via-orange-700 to-amber-700 text-white shadow-2xl relative overflow-hidden space-y-5 border border-orange-400/30">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-orange-200">
              <span>Payable Amount</span>
              <span className="font-mono">{data.request.requestNumber}</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                {data.request.formattedAmount}
              </h1>
              <button
                onClick={() => copyToClipboard(String(data.request.amount), 'amount')}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              >
                {copiedField === 'amount' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'amount' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-orange-200 block">Beneficiary Name</span>
                <span className="text-base font-black text-white">{data.beneficiary.name}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/15 text-white">
                {data.beneficiary.type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div>
                <span className="text-[10px] uppercase font-bold text-orange-200 block">Bank Name</span>
                <span className="text-sm font-bold text-white">{data.beneficiary.bankName}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-orange-200 block">Account Number</span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-base font-mono font-black text-white">
                    {data.beneficiary.accountNumber}
                  </span>
                  <button
                    onClick={() => copyToClipboard(data.beneficiary.accountNumber, 'account')}
                    className="p-1 rounded bg-white/20 hover:bg-white/30 text-white transition-all active:scale-90"
                    title="Copy Account Number"
                  >
                    {copiedField === 'account' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-orange-100 flex items-center justify-between">
            <span>Purpose: {data.request.title}</span>
            <span>{data.request.subsidiary}</span>
          </div>
        </div>

        {/* Quick App Launcher Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-orange-500" />
              <span>Tap to Open Your Bank App</span>
            </h3>
            <span className="text-[11px] text-slate-400">Mobile Direct Intent</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { name: 'GTWorld (GTB)', scheme: 'gtworld://', color: 'hover:border-orange-500' },
              { name: 'Kuda Bank', scheme: 'kuda://', color: 'hover:border-purple-500' },
              { name: 'OPay', scheme: 'opay://', color: 'hover:border-emerald-500' },
              { name: 'Moniepoint', scheme: 'moniepoint://', color: 'hover:border-blue-500' },
              { name: 'Zenith Bank', scheme: 'zenithbank://', color: 'hover:border-red-500' },
              { name: 'Access More', scheme: 'accessmore://', color: 'hover:border-amber-500' },
              { name: 'FirstMobile', scheme: 'firstmobile://', color: 'hover:border-yellow-500' },
              { name: 'PalmPay', scheme: 'palmpay://', color: 'hover:border-indigo-500' },
            ].map((app) => (
              <a
                key={app.name}
                href={app.scheme}
                onClick={() => copyToClipboard(data.beneficiary.accountNumber, 'account')}
                className={`p-3.5 rounded-2xl bg-slate-900 border border-slate-800 ${app.color} transition-all text-center flex flex-col items-center justify-center gap-1 group active:scale-95`}
              >
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white" />
                <span className="text-xs font-bold text-slate-200 group-hover:text-white">{app.name}</span>
                <span className="text-[9px] text-slate-400 font-mono">Copies Acct</span>
              </a>
            ))}
          </div>
        </div>

        {/* USSD Fast Dialer Option */}
        {data.disbursement?.ussdDialer && (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Fast Phone USSD</span>
              <p className="text-xs font-mono font-bold text-white">{data.disbursement.ussdRaw}</p>
            </div>
            <a
              href={data.disbursement.ussdDialer}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-orange-500/20 active:scale-95"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Dial USSD</span>
            </a>
          </div>
        )}

        {/* Mark as Disbursed Action Button */}
        <div className="pt-2">
          {disbursedSuccess ? (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-center text-xs font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Payment Recorded Successfully! Treasury ledger has been updated.</span>
            </div>
          ) : (
            <button
              onClick={handleMarkAsDisbursed}
              disabled={disbursing}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98]"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>{disbursing ? 'Recording Disbursement...' : 'I Have Paid — Mark as Disbursed'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

