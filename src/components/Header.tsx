"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp, USERS, ORGANIZATIONS } from "@/context/AppContext";
import {
  Building2,
  UserCheck,
  ChevronDown,
  Check,
  Download,
  Search,
  Sparkles,
  Layers,
  ChevronRight,
  Plus,
} from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const { currentUser, setCurrentUser, selectedOrgCode, setSelectedOrgCode } =
    useApp();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  const currentOrg = ORGANIZATIONS.find((o) => o.code === selectedOrgCode);

  const navLinks = [
    { name: "Dashboard", href: "/" },
    { name: "Financials", href: "/disbursements" },
    { name: "Requests & Channels", href: "/requests" },
    { name: "Approvals", href: "/approvals", badge: "1" },
    { name: "Accountability", href: "/accountability" },
    { name: "Hybrid Payroll", href: "/payroll" },
    { name: "Vendors", href: "/vendors" },
    { name: "Intercompany", href: "/intercompany" },
  ];

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-6 py-2.5">
      <div className="max-w-[1760px] mx-auto flex items-center justify-between gap-6">
        {/* Brand & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center bg-slate-900 border border-slate-200/80 shadow-xs">
            <img
              src="/bems-group-logo.png?v=20261024"
              alt="BEMS Group Logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <Link href="/" className="font-extrabold text-slate-900 tracking-tight flex items-center gap-1 font-['Outfit',sans-serif]">
              <span>BEMS</span>
              <span className="text-[#f97316]">GROUP</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            
            {/* Subsidiary selector dropdown trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowOrgDropdown(!showOrgDropdown);
                  setShowUserDropdown(false);
                }}
                className="flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition px-1.5 py-0.5 rounded-md hover:bg-slate-100"
              >
                <span>{currentOrg?.shortName || "Consolidated Group"}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {showOrgDropdown && (
                <div className="absolute left-0 mt-2 w-72 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Operating Subsidiary
                  </div>
                  {ORGANIZATIONS.map((org) => (
                    <button
                      key={org.code}
                      onClick={() => {
                        setSelectedOrgCode(org.code);
                        setShowOrgDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                        selectedOrgCode === org.code
                          ? "text-emerald-600 font-semibold bg-emerald-50/50"
                          : "text-slate-700"
                      }`}
                    >
                      <span>{org.name}</span>
                      {selectedOrgCode === org.code && (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Horizontal Navigation Tabs (Conceptzilla style) */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isActive
                    ? "text-slate-900 font-semibold bg-slate-100/80"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>{link.name}</span>
                {link.badge && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.2 rounded-full">
                    {link.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-slate-900 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Persona Switcher, Report Button & Profile */}
        <div className="flex items-center gap-3">
          {/* Persona Switcher */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowOrgDropdown(false);
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition text-xs text-slate-700"
            >
              <UserCheck className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-medium">{currentUser.name}</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-bold">
                {currentUser.role}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50">
                <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Switch Testing Role</span>
                  <Sparkles className="h-3 w-3 text-amber-500" />
                </div>
                {USERS.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user);
                      setShowUserDropdown(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 transition ${
                      currentUser.id === user.id
                        ? "bg-slate-50 text-slate-900 font-semibold"
                        : "text-slate-600"
                    }`}
                  >
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {user.position}
                      </p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                      {user.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New Request Button */}
          <Link
            href="/requests/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Request</span>
          </Link>

          {/* Generate Report Button (from Dribbble reference) */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition">
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Generate Report</span>
          </button>

          {/* User Avatar */}
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.name}
            className="w-8 h-8 rounded-full object-cover border border-slate-200 ring-2 ring-slate-100"
          />
        </div>
      </div>
    </header>
  );
}
