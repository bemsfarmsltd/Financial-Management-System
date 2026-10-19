"use client";

import React from "react";
import { MoreVertical } from "lucide-react";

export function OperationalMetrics() {
  return (
    <div className="sypher-card p-5">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">
          Expenditure Operations
        </h2>
        <button className="text-slate-400 hover:text-slate-600 transition">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* Metric 1 */}
        <div className="space-y-1.5 sm:pr-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Approval Turnaround
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">2.4h</span>
            <span className="text-xs font-semibold text-emerald-600">95.1%</span>
          </div>

          {/* Mini Bar Sparkline */}
          <div className="flex items-end gap-1 h-6 pt-1">
            <div className="w-1.5 h-3 bg-emerald-300 rounded-xs" />
            <div className="w-1.5 h-4 bg-emerald-400 rounded-xs" />
            <div className="w-1.5 h-2 bg-emerald-300 rounded-xs" />
            <div className="w-1.5 h-5 bg-emerald-500 rounded-xs" />
            <div className="w-1.5 h-6 bg-emerald-500 rounded-xs" />
            <div className="w-1.5 h-4 bg-emerald-400 rounded-xs" />
            <div className="w-1.5 h-5 bg-emerald-600 rounded-xs" />
            <div className="w-1.5 h-2 bg-emerald-200 rounded-xs" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="space-y-1.5 pt-4 sm:pt-0 sm:px-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            On-Time SLA Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">97.9%</span>
          </div>

          {/* Gradient Horizontal Meter */}
          <div className="pt-2">
            <div className="h-2 rounded-full w-full bg-slate-100 overflow-hidden flex">
              <div style={{ width: "97.9%" }} className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500 rounded-full" />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
              <span>0%</span>
              <span>Target: 95%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="space-y-1.5 pt-4 sm:pt-0 sm:pl-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Total Commitments
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">₦3,435k</span>
            <span className="text-xs font-semibold text-emerald-600">+3.5%</span>
          </div>

          {/* Mini Line Sparkline */}
          <div className="pt-1">
            <svg className="w-full h-6" viewBox="0 0 100 24" fill="none">
              <path
                d="M0 18 Q 20 22, 35 14 T 70 8 T 100 4"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M0 18 Q 20 22, 35 14 T 70 8 T 100 4 L 100 24 L 0 24 Z"
                fill="url(#greenGradient)"
                opacity="0.15"
              />
              <defs>
                <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
