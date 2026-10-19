"use client";

import React from "react";
import { MoreVertical } from "lucide-react";

export function CostsByCategory() {
  const categories = [
    { name: "Fuel & Generator AGO", amount: "₦89.2K", percent: 38, color: "bg-emerald-500" },
    { name: "IT Infrastructure & VPS", amount: "₦63.7K", percent: 28, color: "bg-lime-500" },
    { name: "Equipment Calibration", amount: "₦35.2K", percent: 15, color: "bg-amber-500" },
    { name: "Logistics & Transport", amount: "₦25.5K", percent: 10, color: "bg-indigo-500" },
    { name: "Facility Maintenance", amount: "₦17.1K", percent: 7, color: "bg-sky-500" },
    { name: "Software Subscriptions", amount: "₦12.7K", percent: 5, color: "bg-slate-400" },
  ];

  return (
    <div className="sypher-card p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">
          Costs by category
        </h2>
        <button className="text-slate-400 hover:text-slate-600 transition">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      {/* Horizontal Stacked Segmented Progress Bar */}
      <div className="pt-2">
        <div className="h-2.5 rounded-full overflow-hidden flex gap-0.5 bg-slate-100">
          <div style={{ width: "38%" }} className="bg-emerald-500 h-full rounded-l-full" />
          <div style={{ width: "28%" }} className="bg-lime-500 h-full" />
          <div style={{ width: "15%" }} className="bg-amber-500 h-full" />
          <div style={{ width: "10%" }} className="bg-indigo-500 h-full" />
          <div style={{ width: "7%" }} className="bg-sky-500 h-full" />
          <div style={{ width: "5%" }} className="bg-slate-400 h-full rounded-r-full" />
        </div>

        {/* Category List */}
        <div className="mt-4 space-y-2">
          {categories.map((cat, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-xs ${cat.color}`} />
                <span className="text-slate-600 font-medium">{cat.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-slate-900 font-mono">{cat.amount}</span>
                <span className="text-[11px] text-slate-400 font-mono w-7 text-right">{cat.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
