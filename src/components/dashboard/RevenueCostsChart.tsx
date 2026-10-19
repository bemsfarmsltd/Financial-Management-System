"use client";

import React, { useState } from "react";
import { MoreVertical } from "lucide-react";

export function RevenueCostsChart() {
  const [showRevenue, setShowRevenue] = useState(true);
  const [showCosts, setShowCosts] = useState(true);
  const [showNet, setShowNet] = useState(true);
  const [hoverX, setHoverX] = useState<number | null>(340); // default around Aug 15

  return (
    <div className="sypher-card p-5">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Revenue and costs
          </h2>
          <p className="text-[11px] text-slate-400">
            Approved allocations vs actual recorded disbursements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">Costs, ₦</span>
          <button className="text-slate-400 hover:text-slate-600 transition">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main SVG Chart Area */}
      <div
        className="relative h-64 w-full select-none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          setHoverX(Math.max(40, Math.min(x, rect.width - 40)));
        }}
        onMouseLeave={() => setHoverX(340)}
      >
        <svg
          className="w-full h-full overflow-visible"
          viewBox="0 0 540 220"
          preserveAspectRatio="none"
        >
          {/* Horizontal Grid lines */}
          <line x1="30" y1="30" x2="520" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1="30" y1="75" x2="520" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1="30" y1="120" x2="520" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1="30" y1="165" x2="520" y2="165" stroke="#f1f5f9" strokeDasharray="3 3" />

          {/* Y Axis Labels */}
          <text x="5" y="34" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">10k</text>
          <text x="5" y="79" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">8k</text>
          <text x="5" y="124" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">6k</text>
          <text x="5" y="169" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">2k</text>

          {/* Curve 1: Revenue (Green) */}
          {showRevenue && (
            <path
              d="M 30 110 C 80 80, 110 95, 150 70 C 200 45, 240 85, 290 60 C 340 40, 390 65, 440 45 C 480 30, 505 50, 520 40"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Curve 2: Net Profit / Capital Savings (Dark Slate) */}
          {showNet && (
            <path
              d="M 30 140 C 70 120, 110 135, 160 110 C 210 90, 240 140, 290 125 C 330 115, 370 95, 420 120 C 470 140, 495 105, 520 115"
              fill="none"
              stroke="#0f172a"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Curve 3: Costs / Recorded Outflow (Coral / Pink) */}
          {showCosts && (
            <path
              d="M 30 170 C 70 160, 110 125, 150 145 C 190 165, 230 130, 280 150 C 330 170, 370 115, 420 130 C 470 145, 500 160, 520 150"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Vertical Dotted Inspection Line */}
          {hoverX !== null && (
            <>
              <line
                x1={hoverX}
                y1="15"
                x2={hoverX}
                y2="195"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle cx={hoverX} cy="50" r="4" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
              <circle cx={hoverX} cy="118" r="4" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
              <circle cx={hoverX} cy="148" r="4" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
            </>
          )}

          {/* X Axis Date Labels */}
          <text x="35" y="210" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">20</text>
          <text x="180" y="210" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">Aug</text>
          <text x="340" y="210" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">10</text>
          <text x="500" y="210" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">20</text>
        </svg>

        {/* Floating Tooltip Card (positioned dynamically around inspection line) */}
        {hoverX !== null && (
          <div
            style={{
              left: `${Math.min(Math.max(hoverX - 70, 10), 380)}px`,
              top: "30px",
            }}
            className="absolute z-20 pointer-events-none bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-xl p-3 shadow-lg text-[11px] space-y-1 w-36"
          >
            <p className="font-bold text-slate-800 text-[10px] pb-1 border-b border-slate-100">
              Aug 15, 2026
            </p>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Revenue
              </span>
              <span className="font-bold text-slate-900 font-mono">₦4,231k</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                Net profit
              </span>
              <span className="font-bold text-slate-900 font-mono">₦2,354k</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Costs
              </span>
              <span className="font-bold text-slate-900 font-mono">₦2,145k</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Legend and Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 mt-1 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={showRevenue}
              onChange={(e) => setShowRevenue(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 accent-emerald-500"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Revenue
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={showCosts}
              onChange={(e) => setShowCosts(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-rose-500 focus:ring-0 accent-rose-500"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Costs
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={showNet}
              onChange={(e) => setShowNet(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-0 accent-slate-900"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-900" />
              Net profit
            </span>
          </label>
        </div>

        <span className="text-[11px] text-slate-400 font-medium">
          Vs. previous period
        </span>
      </div>
    </div>
  );
}
