"use client";

import React from "react";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  ArrowRight,
  CreditCard,
  Building2,
  ChevronRight,
  ShieldCheck,
  Send,
} from "lucide-react";
import { StaffTab } from "./StaffAppShell";

export interface StaffRequestItem {
  number: string;
  title: string;
  category: string;
  amount: string;
  status: "SUBMITTED" | "HOD_REVIEW" | "FINANCE_AUDIT" | "GMD_APPROVED" | "DISBURSED" | "CLOSED";
  statusLabel: string;
  currentStepIndex: number; // 0 to 5
  submittedAt: string;
  subsidiary: string;
  needsRetirement?: boolean;
}

interface StaffDashboardViewProps {
  onTabChange: (tab: StaffTab) => void;
  onRequestNew: () => void;
  onSelectRequest: (req: StaffRequestItem) => void;
  staffName?: string;
  requests: StaffRequestItem[];
}

export function StaffDashboardView({
  onTabChange,
  onRequestNew,
  onSelectRequest,
  staffName = "Temitope Bakare",
  requests,
}: StaffDashboardViewProps) {
  // Check for any advances needing retirement
  const pendingRetirement = requests.find((r) => r.needsRetirement);

  return (
    <div className="space-y-6">
      {/* Hero Welcome & Profile Brief */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border border-blue-700/30 p-5 sm:p-6 shadow-xl">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-semibold mb-2">
              <Building2 className="h-3 w-3" />
              <span>Bems Group Cloud & Technologies Ltd</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome, {staffName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Track your departmental expenditure requests, submit advance retirements, and inspect verified salary disbursements.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            <button
              onClick={onRequestNew}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Request Funds</span>
            </button>
          </div>
        </div>
      </div>

      {/* Urgent Action Banner: Advance Retirement Aging */}
      {pendingRetirement && (
        <div className="rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/40 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Retirement Due
                </span>
                <span className="text-xs text-amber-200/80 font-mono">
                  {pendingRetirement.number}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mt-1">
                {pendingRetirement.title} ({pendingRetirement.amount})
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Funds have been transferred to your account. Under Bems Group policy, please upload expenditure receipts within 72 hours.
              </p>
            </div>
          </div>
          <button
            onClick={() => onTabChange("retirements")}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <span>Retire Advance Now</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Key Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Active Advances</span>
            <Receipt className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white">₦1,200,000</div>
          <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>1 advance awaiting receipts</span>
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Open Requests</span>
            <FileSpreadsheet className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white">2 Active</div>
          <p className="text-[10px] text-slate-400 mt-1">
            <span>1 HOD approval · 1 GMD</span>
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">MTD Disbursed</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white">₦1,650,000</div>
          <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Paid to Access Bank</span>
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Policy Rating</span>
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white">100% SLA</div>
          <p className="text-[10px] text-slate-400 mt-1">
            <span>Zero overdue penalties</span>
          </p>
        </div>
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={onRequestNew}
          className="text-left bg-gradient-to-br from-slate-900 to-slate-900/50 hover:from-slate-850 hover:to-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all group"
        >
          <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
            New Fund Request
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Submit quotes, travel advances, or software licences for fast sign-off.
          </p>
        </button>

        <button
          onClick={() => onTabChange("retirements")}
          className="text-left bg-gradient-to-br from-slate-900 to-slate-900/50 hover:from-slate-850 hover:to-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all group"
        >
          <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <Receipt className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
            Retire Cash Advances
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Upload physical invoices/receipts and balance unspent funds.
          </p>
        </button>

        <button
          onClick={() => onTabChange("payslips")}
          className="text-left bg-gradient-to-br from-slate-900 to-slate-900/50 hover:from-slate-850 hover:to-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all group"
        >
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <CreditCard className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
            My Payslips & Income
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Inspect monthly verified disbursements and download official vouchers.
          </p>
        </button>
      </div>

      {/* Live Fund Requests Tracker Feed */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">Active Requests Tracker</h3>
            <p className="text-xs text-slate-400">Step-by-step progress from submission to verified bank transfer</p>
          </div>
          <button
            onClick={() => onTabChange("requests")}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {requests.map((r) => {
            const steps = ["Submitted", "HOD Review", "Finance Audit", "GMD Signoff", "Disbursed"];
            return (
              <div
                key={r.number}
                onClick={() => onSelectRequest(r)}
                className="cursor-pointer bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{r.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        {r.number}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {r.category} · Submitted {r.submittedAt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-sm sm:text-base font-bold text-slate-100 font-mono">
                      {r.amount}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        r.status === "DISBURSED"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : r.status === "GMD_APPROVED"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {r.statusLabel}
                    </span>
                  </div>
                </div>

                {/* Progress Stepper Bar */}
                <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-800/50">
                  {steps.map((st, idx) => {
                    const isDone = idx <= r.currentStepIndex;
                    const isCurrent = idx === r.currentStepIndex;
                    return (
                      <div key={st} className="flex flex-col items-center text-center">
                        <div
                          className={`h-1.5 w-full rounded-full mb-1 transition-all ${
                            isDone ? "bg-blue-500" : "bg-slate-800"
                          }`}
                        />
                        <span
                          className={`text-[9px] truncate max-w-full ${
                            isCurrent
                              ? "text-blue-400 font-bold"
                              : isDone
                              ? "text-slate-300"
                              : "text-slate-600"
                          }`}
                        >
                          {st}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
