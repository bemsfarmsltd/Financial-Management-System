"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import {
  Home,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  User,
  PlusCircle,
  Bell,
  ArrowLeft,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export type StaffTab = "overview" | "requests" | "retirements" | "payslips" | "profile";

interface StaffAppShellProps {
  children: ReactNode;
  activeTab: StaffTab;
  onTabChange: (tab: StaffTab) => void;
  onRequestNew: () => void;
  staffName?: string;
  staffRole?: string;
  staffEmail?: string;
  subsidiaryName?: string;
  pendingRetirementsCount?: number;
  notice?: string | null;
  onDismissNotice?: () => void;
}

export function StaffAppShell({
  children,
  activeTab,
  onTabChange,
  onRequestNew,
  staffName = "Temitope Bakare",
  staffRole = "Lead DevOps Engineer",
  staffEmail = "temitope@bemsgroup.com",
  subsidiaryName = "Bems Group Cloud & Technologies Ltd",
  pendingRetirementsCount = 1,
  notice,
  onDismissNotice,
}: StaffAppShellProps) {
  const navTabs = [
    { id: "overview" as StaffTab, label: "Home", icon: Home },
    { id: "requests" as StaffTab, label: "My Requests", icon: FileSpreadsheet, badge: 2 },
    {
      id: "retirements" as StaffTab,
      label: "Retirements",
      icon: Receipt,
      badge: pendingRetirementsCount > 0 ? pendingRetirementsCount : undefined,
      urgent: pendingRetirementsCount > 0,
    },
    { id: "payslips" as StaffTab, label: "Payslips", icon: CreditCard },
    { id: "profile" as StaffTab, label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Banner Alert / Notice */}
      {notice && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-between shadow-md transition-all">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
            <span>{notice}</span>
          </div>
          {onDismissNotice && (
            <button
              onClick={onDismissNotice}
              className="text-emerald-200 hover:text-white text-sm font-bold ml-4"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Main App Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 px-2 rounded-md hover:bg-slate-800"
              title="Return to Executive Portal"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Executive Portal</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center bg-slate-900 border border-slate-700 shadow-md shadow-orange-500/10">
                <img
                  src="/bems-group-logo.png?v=20261024"
                  alt="BEMS Group Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-sm sm:text-base tracking-tight text-white leading-tight">
                    BEMS Staff
                  </h1>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    Mobile Desk
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-xs">
                  {subsidiaryName}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onRequestNew}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>New Request</span>
            </button>

            {/* Profile Avatar Badge */}
            <button
              onClick={() => onTabChange("profile")}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
            >
              <div className="h-7 w-7 rounded-lg bg-indigo-600/40 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                {staffName.charAt(0)}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-200 leading-none">{staffName}</p>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">{staffRole}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Desktop Tab Strip */}
        <div className="hidden sm:block max-w-5xl mx-auto mt-3 pt-2 border-t border-slate-800/60">
          <nav className="flex items-center gap-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-slate-800 text-white shadow-sm border border-slate-700/80"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-orange-400" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        tab.urgent
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 sm:py-6 pb-24 sm:pb-12">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2 flex items-center justify-around shadow-2xl">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                isActive ? "text-orange-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? "text-orange-400" : "text-slate-400"}`} />
                {tab.badge && (
                  <span
                    className={`absolute -top-1 -right-2.5 px-1 py-0.2 rounded-full text-[9px] font-bold ${
                      tab.urgent ? "bg-amber-500 text-slate-950" : "bg-orange-600 text-white"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? "text-white font-semibold" : ""}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
