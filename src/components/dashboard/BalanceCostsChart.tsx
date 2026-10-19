"use client";

import React from "react";
import { MoreVertical } from "lucide-react";

export function BalanceCostsChart() {
  // 18 alternating days of bars (green and rose)
  const barData = [
    { green: 40, rose: 25 },
    { green: 55, rose: 30 },
    { green: 35, rose: 40 },
    { green: 65, rose: 20 },
    { green: 70, rose: 45 },
    { green: 50, rose: 35 },
    { green: 80, rose: 25 },
    { green: 60, rose: 40 },
    { green: 45, rose: 50 },
    { green: 75, rose: 30 },
    { green: 85, rose: 20 },
    { green: 90, rose: 35 },
    { green: 65, rose: 45 },
    { green: 80, rose: 25 },
    { green: 70, rose: 30 },
    { green: 60, rose: 40 },
    { green: 85, rose: 35 },
    { green: 95, rose: 20 },
  ];

  return (
    <div className="sypher-card p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">
          Balance and costs
        </h2>
        <button className="text-slate-400 hover:text-slate-600 transition">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="pt-2">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Cash Balance
            </span>
            <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">
              ₦125K
            </p>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Target: &gt;₦100K
          </span>
        </div>

        {/* Dual Color Vertical Bar Chart */}
        <div className="flex items-end justify-between gap-1.5 h-28 pt-2 border-b border-dashed border-slate-200">
          {barData.map((b, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 h-full justify-end flex-1">
              <div
                style={{ height: `${b.green}%` }}
                className="w-full bg-emerald-400 rounded-xs"
              />
              <div
                style={{ height: `${b.rose}%` }}
                className="w-full bg-rose-400/80 rounded-xs"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1.5">
          <span>Week 1</span>
          <span>Week 2</span>
          <span>Week 3</span>
          <span>Week 4</span>
        </div>
      </div>
    </div>
  );
}
