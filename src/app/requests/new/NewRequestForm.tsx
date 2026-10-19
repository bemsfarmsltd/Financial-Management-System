"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  FileSpreadsheet,
  Building2,
  DollarSign,
  Calendar,
  Layers,
  ChevronLeft,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface NewRequestFormProps {
  subsidiaries: any[];
  vendors: any[];
  employees: any[];
}

export function NewRequestForm({
  subsidiaries,
  vendors,
  employees,
}: NewRequestFormProps) {
  const router = useRouter();
  const { currentUser } = useApp();

  const [subsidiaryId, setSubsidiaryId] = useState(subsidiaries[0]?.id || "");
  const [requestType, setRequestType] = useState("ORDINARY");
  const [category, setCategory] = useState("IT_SOFTWARE");
  const [vendorId, setVendorId] = useState(vendors[0]?.id || "");
  const [amountNaira, setAmountNaira] = useState("");
  const [title, setTitle] = useState("");
  const [justification, setJustification] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [neededBy, setNeededBy] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("MONTHLY");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amountNaira || !justification || !deliverable) {
      setErrorMsg("Please complete all required fields.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // Find employee record for current user or default to first staff
      const matchingEmployee =
        employees.find((e) => e.workEmail === currentUser.email) ||
        employees[employees.length - 1];

      const res = await fetch("/api/requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subsidiaryId,
          requestedById: matchingEmployee.id,
          vendorId: vendorId || null,
          requestType,
          category,
          amountNaira,
          title,
          justification,
          deliverable,
          neededBy,
          isRecurring,
          recurringInterval,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/requests/${data.requestNumber}`);
      } else {
        setErrorMsg(data.error || "Failed to submit request.");
      }
    } catch (err) {
      setErrorMsg("An unexpected network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentUser.role === 'GMD') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-xl font-bold text-slate-900">Fund requests are submitted by staff</h1>
        <p className="text-sm text-slate-600">As GMD, you can review requests, approve them, and track payment and accountability from the request register.</p>
        <Link href="/requests" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white no-underline">Open Fund Requests <span>→</span></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <Link
            href="/requests"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition mb-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Cancel & Back</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">
            Submit New Fund / Expenditure Request
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Create an expenditure request with supporting documentation and route through deterministic policy checks.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Organizational Scope & Classification */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>1. Operating Entity & Request Classification</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Target Operating Subsidiary *
              </label>
              <select
                value={subsidiaryId}
                onChange={(e) => setSubsidiaryId(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {subsidiaries.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.legalName} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Request Type *
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="ORDINARY">Ordinary Expenditure (Vendor Goods/Service)</option>
                <option value="ADVANCE">Cash Advance (To be retired post-task)</option>
                <option value="REIMBURSEMENT">Reimbursement (Already incurred out-of-pocket)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Budget Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="IT_SOFTWARE">IT & Cloud Software (e.g. VPS, SaaS)</option>
                <option value="OFFICE_EXPENSE">Office Supplies & Utilities (e.g. Diesel)</option>
                <option value="ASSET">Equipment & Capital Assets</option>
                <option value="LOGISTICS">Transport & Field Logistics</option>
                <option value="TRAVEL">Corporate Travel & Per Diem</option>
                <option value="MARKETING">Marketing & Advertising</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Amount & Recurrence */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span>2. Financial Valuation & Commitments</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Amount Requested (NGN Naira) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-mono">
                  ₦
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={amountNaira}
                  onChange={(e) => setAmountNaira(e.target.value)}
                  placeholder="e.g. 185000.00"
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-8 pr-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Policy rule: Requests &gt; ₦100k require COO; &gt; ₦1M or critical IT require GMD.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Funds Needed By (Execution Date) *
              </label>
              <input
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Recurrence Checkbox */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="isRecurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-0"
              />
              <label
                htmlFor="isRecurring"
                className="text-xs font-medium text-slate-200 cursor-pointer"
              >
                Is this a recurring commitment? (e.g. Monthly VPS hosting, office rent, retainers)
              </label>
            </div>

            {isRecurring && (
              <select
                value={recurringInterval}
                onChange={(e) => setRecurringInterval(e.target.value)}
                className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-100"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            )}
          </div>
        </div>

        {/* Step 3: Beneficiary Vendor */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>3. Payee / Beneficiary Details</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select Registered Vendor (or Staff for Advance)
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">None / Direct Staff Payout</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.bankName} - {v.accountNumber})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 4: Request Justification & Deliverable */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span>4. Scope, Operational Justification & Accountability Gate</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Request Title / Purpose *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hostinger Cloud VPS Server Renewal (Production Cluster)"
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Operational Justification (Why is this needed?) *
            </label>
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Provide background, business impact of approval/denial, and budget context..."
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Expected Deliverable & Post-Payment Proof *
            </label>
            <input
              type="text"
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              placeholder="e.g. Active server uptime with renewed SSL certificate and invoice receipt"
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Note: This defines the post-payment gate. Request will not close until this deliverable is verified.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/requests"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-blue-500/25 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isSubmitting ? "Submitting..." : "Submit & Launch Dedicated Channel"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
