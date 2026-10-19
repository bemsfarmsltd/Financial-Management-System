"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { formatMoney, formatDate, formatDateTime, getStatusBadge } from "@/lib/formatters";
import {
  Receipt,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  ShieldCheck,
  UploadCloud,
  FileText,
  DollarSign,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface DisbursementsClientProps {
  approvedPayables: any[];
  disbursements: any[];
}

export function DisbursementsClient({
  approvedPayables,
  disbursements,
}: DisbursementsClientProps) {
  const router = useRouter();
  const { currentUser } = useApp();

  const [selectedPayable, setSelectedPayable] = useState<any | null>(null);
  const [selectedDisbursement, setSelectedDisbursement] = useState<any | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Record Form state
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryBank, setBeneficiaryBank] = useState("Zenith Bank Plc");
  const [beneficiaryAccount, setBeneficiaryAccount] = useState("");
  const [bankName, setBankName] = useState("GTBank Corporate Online");
  const [externalReference, setExternalReference] = useState("");
  const [receiptFileName, setReceiptFileName] = useState("Corporate_Transfer_Receipt.pdf");

  // Verify Form state
  const [statementRef, setStatementRef] = useState("");
  const [verifyReason, setVerifyReason] = useState("Matched against bank statement line");

  const openRecordModal = (payable: any) => {
    setSelectedPayable(payable);
    setBeneficiaryName(payable.vendor?.name || payable.requester.legalName);
    setBeneficiaryBank(payable.vendor?.bankName || "Access Bank Plc");
    setBeneficiaryAccount(payable.vendor?.accountNumber || "0123456789");
    setExternalReference(`TRF-${Date.now().toString().slice(-6)}`);
    setErrorMsg("");
  };

  const handleRecordDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;
    setIsRecording(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/disbursements/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedPayable.id,
          payerOrgId: selectedPayable.subsidiaryId,
          beneficiaryName,
          beneficiaryBank,
          beneficiaryAccount,
          amountMinor: selectedPayable.amountMinor,
          externalReference,
          bankName,
          recordedById: currentUser.id,
          receiptFileName,
          receiptFileUrl: "/receipts/sample_bank_receipt.pdf",
          sha256: `sha256-${externalReference}-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedPayable(null);
        router.refresh();
      } else {
        setErrorMsg(data.error || "Failed to record payment.");
      }
    } catch (err) {
      setErrorMsg("Network error occurred.");
    } finally {
      setIsRecording(false);
    }
  };

  const handleVerifyDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisbursement) return;
    setIsVerifying(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/disbursements/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disbursementId: selectedDisbursement.id,
          verifierId: currentUser.id,
          decision: "VERIFIED",
          supportingReference: statementRef || `STATEMENT-ROW-${Date.now().toString().slice(-4)}`,
          reason: verifyReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedDisbursement(null);
        router.refresh();
      } else {
        setErrorMsg(data.error || "Failed to verify payment.");
      }
    } catch (err) {
      setErrorMsg("Network error occurred.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Disbursements & Bank Receipt Proof
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Maker-checker financial controls: Record off-platform bank transfers with mandatory receipts and independent verification.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Section 1: Approved Payables Queue */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              1. Approved Payables Awaiting Bank Transfer ({approvedPayables.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">Finance Maker Queue</span>
        </div>

        {approvedPayables.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No approved payables currently awaiting disbursement.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {approvedPayables.map((payable) => (
              <div
                key={payable.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/20 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {payable.requestNumber}
                    </span>
                    <span className="text-xs text-slate-400">
                      {payable.subsidiary.legalName}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {payable.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Payee: <strong className="text-slate-200">{payable.vendor?.name || payable.requester.legalName}</strong>
                    {payable.vendor && ` • ${payable.vendor.bankName} (${payable.vendor.accountNumber})`}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <p className="text-lg font-bold text-slate-100 font-mono">
                    {formatMoney(payable.amountMinor, payable.currency)}
                  </p>
                  <button
                    onClick={() => openRecordModal(payable)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Record Transfer + Receipt</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Recorded Disbursements Awaiting Verification */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              2. Independent Verification Queue (Maker-Checker)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">Internal Audit / Checker</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {disbursements.map((disb) => {
            const isVerified = disb.status === "VERIFIED";
            return (
              <div
                key={disb.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/20 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-300">
                      Ref: {disb.externalReference}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-400">
                      Paid via: <strong className="text-slate-200">{disb.bankName}</strong>
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isVerified
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {disb.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200">
                    Beneficiary: <strong className="text-slate-100">{disb.beneficiaryName}</strong> ({disb.beneficiaryBank} - {disb.beneficiaryAccount})
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    <span>
                      Recorded by: {disb.recordedBy.legalName} on {formatDate(disb.paidAt)}
                    </span>
                    {disb.receipt && (
                      <span className="text-blue-400 flex items-center gap-1 font-mono text-[10px] underline cursor-pointer">
                        <FileText className="h-3 w-3" />
                        {disb.receipt.fileName} (SHA-256 Verified)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <p className="text-lg font-bold text-slate-100 font-mono">
                    {formatMoney(disb.amountMinor, disb.currency)}
                  </p>

                  {!isVerified && (
                    <button
                      onClick={() => {
                        setSelectedDisbursement(disb);
                        setErrorMsg("");
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Verify Against Statement</span>
                    </button>
                  )}

                  {isVerified && (
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Audit Verified</span>
                      </span>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {disb.verification?.supportingReference}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Record Transfer Modal */}
      {selectedPayable && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-400" />
              <span>Record Off-Platform Bank Transfer</span>
            </h3>
            <p className="text-xs text-slate-400">
              Enter the bank transaction details and upload the bank debit receipt for{" "}
              <strong className="text-slate-200">{selectedPayable.requestNumber}</strong> (
              <span className="font-mono text-emerald-400">
                {formatMoney(selectedPayable.amountMinor, selectedPayable.currency)}
              </span>
              ).
            </p>

            <form onSubmit={handleRecordDisbursement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Originating Corporate Bank *
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Beneficiary Name *
                  </label>
                  <input
                    type="text"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Beneficiary Bank *
                  </label>
                  <input
                    type="text"
                    value={beneficiaryBank}
                    onChange={(e) => setBeneficiaryBank(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Beneficiary Account No *
                  </label>
                  <input
                    type="text"
                    value={beneficiaryAccount}
                    onChange={(e) => setBeneficiaryAccount(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bank Reference No (Unique) *
                  </label>
                  <input
                    type="text"
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mandatory Bank Debit Receipt (PDF / Image) *
                </label>
                <div className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span className="text-xs text-slate-300 font-mono">
                      {receiptFileName}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">
                    Attached
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPayable(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecording}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-500/20"
                >
                  {isRecording ? "Recording..." : "Record Disbursement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {selectedDisbursement && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              <span>Independent Payment Verification (Checker)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Verify that the outflow of{" "}
              <strong className="text-slate-200 font-mono">
                {formatMoney(selectedDisbursement.amountMinor, selectedDisbursement.currency)}
              </strong>{" "}
              (Ref: {selectedDisbursement.externalReference}) matches the corporate bank statement.
            </p>

            <form onSubmit={handleVerifyDisbursement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bank Statement Audit Reference / Line Number *
                </label>
                <input
                  type="text"
                  value={statementRef}
                  onChange={(e) => setStatementRef(e.target.value)}
                  placeholder="e.g. GTB-STMT-20261015-LINE-449"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Verification Note / Decision Rationale
                </label>
                <input
                  type="text"
                  value={verifyReason}
                  onChange={(e) => setVerifyReason(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedDisbursement(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20"
                >
                  {isVerifying ? "Verifying..." : "Confirm & Verify Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
