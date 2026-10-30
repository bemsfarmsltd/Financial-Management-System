"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  LayoutDashboard,
  FileSpreadsheet,
  CheckCircle2,
  Receipt,
  ShieldCheck,
  Users2,
  UserCheck,
  Building2,
  FileText,
  History,
  Layers,
  ChevronRight,
  Smartphone,
  Settings,
  Clock,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser } = useApp();

  const navItems = [
    {
      name: "Finance Desk",
      href: "/finance",
      icon: LayoutDashboard,
      roles: ["GMD", "HR", "SYSTEM_ADMIN", "STAFF"],
    },
    {
      name: "Requests & Channels",
      href: "/requests",
      icon: FileSpreadsheet,
      roles: ["GMD", "SYSTEM_ADMIN"],
      badge: "Active",
    },
    {
      name: "Staff Onboarding & Approvals",
      href: "/finance?tab=Staff+onboarding",
      icon: UserCheck,
      roles: ["GMD", "SYSTEM_ADMIN"],
    },
    {
      name: "Approvals Console",
      href: "/approvals",
      icon: CheckCircle2,
      roles: ["GMD", "SYSTEM_ADMIN"],
      badge: "GMD Signoff",
      badgeColor: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    },
    {
      name: "Disbursements & Bank Proof",
      href: "/disbursements",
      icon: Receipt,
      roles: ["GMD", "SYSTEM_ADMIN"],
    },
    {
      name: "Accountability & Closure",
      href: "/accountability",
      icon: ShieldCheck,
      roles: ["GMD", "HR", "SYSTEM_ADMIN", "STAFF"],
      badge: "Receipts",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    },
    {
      name: "Hybrid Payroll & Splits",
      href: "/payroll",
      icon: Users2,
      roles: ["GMD", "HR", "SYSTEM_ADMIN"],
    },
    {
      name: "Attendance & Timekeeping",
      href: "/attendance",
      icon: Clock,
      roles: ["GMD", "HR", "SYSTEM_ADMIN", "STAFF"],
      badge: "Kiosk",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    },
    {
      name: "Vendors & Benchmark Rates",
      href: "/vendors",
      icon: Building2,
      roles: ["GMD", "HR", "SYSTEM_ADMIN", "STAFF"],
    },
    {
      name: "Intercompany Notes",
      href: "/intercompany",
      icon: FileText,
      roles: ["GMD", "SYSTEM_ADMIN"],
    },
    {
      name: "Audit Trail & Compliance",
      href: "/audit",
      icon: History,
      roles: ["GMD", "SYSTEM_ADMIN"],
    },
    {
      name: "Admin Settings",
      href: "/finance?tab=Settings",
      icon: Settings,
      roles: ["GMD", "SYSTEM_ADMIN"],
    },
    {
      name: "Mobile App Gates",
      href: "/finance?tab=Mobile+App+Settings",
      icon: Smartphone,
      roles: ["GMD", "SYSTEM_ADMIN"],
      badge: "HTTP 426",
      badgeColor: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    },
  ];

  const allowedItems = navItems.filter((item) =>
    (currentUser.role === 'SYSTEM_ADMIN' || item.roles.includes(currentUser.role))
  );

  return (
    <aside className="w-72 bg-[#0d1322] border-r border-slate-800/80 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="p-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg shadow-orange-500/10 flex items-center justify-center bg-slate-900 border border-slate-700/60">
            <img
              src="/bems-group-logo.png?v=20261024"
              alt="BEMS Group Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-100 tracking-tight text-base font-['Outfit',sans-serif] flex items-center gap-1.5">
              <span>BEMS</span>
              <span className="text-[#f97316]">GROUP</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Expenditure & Accountability
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800 transition-all"
        >
          <span>←</span>
          <span>ERP Suite Gateway</span>
        </Link>
        <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Operations & Governance
        </p>
        {allowedItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/finance' && pathname === '/finance');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-orange-500/15 text-orange-400 border border-orange-500/25 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? "text-orange-400" : "text-slate-400"
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    item.badgeColor || "bg-slate-800 text-slate-400"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* User Status Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.name}
            className="w-10 h-10 rounded-full object-cover border border-slate-700 ring-2 ring-orange-500/20"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {currentUser.name}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {currentUser.position}
            </p>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
            {currentUser.role}
          </span>
        </div>
      </div>
    </aside>
  );
}
