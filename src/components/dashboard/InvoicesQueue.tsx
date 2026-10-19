"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/formatters";
import {
  MoreVertical,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Building2,
  ExternalLink,
} from "lucide-react";

interface InvoicesQueueProps {
  requests: any[];
}

export function InvoicesQueue({ requests }: InvoicesQueueProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | "UNPAID" | "RECENT" | "PAID">("UNPAID");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRequests = requests.filter((r) => {
    if (activeTab === "UNPAID") {
      return r.paymentStatus === "UNPAID";
    }
    if (activeTab === "PAID") {
      return ["RECIPIENT_CONFIRMED", "RECIPIENT_REPORTED_ISSUE", "AWAITING_RECIPIENT_CONFIRMATION", "VERIFIED_PAID", "RECORDED"].includes(r.paymentStatus);
    }
    if (activeTab === "RECENT") {
      return r.approvalStatus === "IN_REVIEW" || r.approvalStatus === "SUBMITTED";
    }
    return true;
  }).filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.requester.legalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="sypher-card p-5 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">
            Invoices & Fund Requests
          </h2>
          <button className="text-slate-400 hover:text-slate-600 transition">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Top 3 Metric Ribbon (Paid, Recent Request, Unpaid) */}
        <div className="grid grid-cols-3 gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Paid
            </span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              ₦145K
            </p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div style={{ width: "51.5%" }} className="h-full bg-emerald-500 rounded-full" />
            </div>
            <span className="text-[9px] text-slate-400 mt-1 block">51.5%</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Approved
            </span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              ₦2,400K
            </p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div style={{ width: "29%" }} className="h-full bg-lime-500 rounded-full" />
            </div>
            <span className="text-[9px] text-slate-400 mt-1 block">29.0%</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Under Review
            </span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              ₦185K
            </p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div style={{ width: "19.5%" }} className="h-full bg-emerald-300 rounded-full" />
            </div>
            <span className="text-[9px] text-slate-400 mt-1 block">19.5%</span>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 pb-3">
          <div className="flex items-center gap-1 text-xs">
            {(["All", "Unpaid", "Recent", "Paid"] as const).map((tab) => {
              const tabKey = tab.toUpperCase() as "ALL" | "UNPAID" | "RECENT" | "PAID";
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tabKey)}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab === "Recent" ? "Recent request" : tab}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-slate-50 border border-slate-200/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 w-40 sm:w-44"
            />
          </div>
        </div>

        {/* High-Density Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input type="checkbox" className="rounded-xs text-emerald-600 focus:ring-0" />
                </th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Issue date</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3 text-right">Value</th>
                <th className="py-2.5 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  className="hover:bg-slate-50/70 transition group cursor-pointer"
                >
                  <td className="py-3 px-3">
                    <input type="checkbox" className="rounded-xs text-emerald-600 focus:ring-0" />
                  </td>

                  <td className="py-3 px-3">
                    <Link
                      href={`/requests/${req.requestNumber}`}
                      className="font-bold text-slate-900 group-hover:text-emerald-600 transition flex items-center gap-2"
                    >
                      <div className="w-5 h-5 rounded-md bg-slate-900 flex items-center justify-center text-white text-[10px] font-mono shrink-0">
                        {req.subsidiary.code.includes("TECH") ? "T" : req.subsidiary.code.includes("MEDIA") ? "M" : "H"}
                      </div>
                      <span className="truncate max-w-[220px]">{req.title}</span>
                    </Link>
                  </td>

                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {formatDate(req.createdAt)}
                  </td>

                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px] truncate max-w-[140px]">
                    {req.requester.workEmail}
                  </td>

                  <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                    {formatMoney(req.amountMinor, req.currency)}
                  </td>

                  <td className="py-3 px-2 text-right">
                    <Link
                      href={`/requests/${req.requestNumber}`}
                      className="p-1 rounded text-slate-400 hover:text-slate-800 transition inline-block"
                      title="Open Dedicated Channel"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>Show by</span>
          <select className="bg-transparent border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-medium">
            <option>10</option>
            <option>20</option>
            <option>50</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span>1 / 4</span>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-slate-100 text-slate-500">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
