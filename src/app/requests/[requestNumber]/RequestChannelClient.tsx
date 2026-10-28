"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { formatMoney, formatDate, formatDateTime, getStatusBadge } from "@/lib/formatters";
import {
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Send,
  FileText,
  Paperclip,
  Download,
  Clock,
  ShieldCheck,
  Receipt,
  User,
  AlertCircle,
  Layers,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";

interface RequestChannelClientProps {
  request: any;
}

export function RequestChannelClient({ request }: RequestChannelClientProps) {
  const router = useRouter();
  const { currentUser } = useApp();
  const [messages, setMessages] = useState<any[]>(request.channel?.messages || []);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [clarificationText, setClarificationText] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvalReason, setApprovalReason] = useState("Approved within standard operating budget.");
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [receiptIssue, setReceiptIssue] = useState("");
  const [showReceiptIssue, setShowReceiptIssue] = useState(false);

  const appBadge = getStatusBadge(request.approvalStatus);
  const payBadge = getStatusBadge(request.paymentStatus);
  const accBadge = getStatusBadge(request.accountabilityStatus);
  const pendingReceipt = (request.disbursements || []).find((payment: any) =>
    ["AWAITING_RECIPIENT_CONFIRMATION", "PENDING_VERIFICATION"].includes(payment.status) && !payment.recipientConfirmation
  );
  const canConfirmReceipt = currentUser.id === request.requestedById;

  const submitReceiptConfirmation = async (decision: "RECEIVED" | "NOT_RECEIVED" | "AMOUNT_MISMATCH") => {
    if (!pendingReceipt || confirmingReceipt) return;
    if (decision !== "RECEIVED" && !receiptIssue.trim()) return;
    setConfirmingReceipt(true);
    try {
      const response = await fetch("/api/disbursements/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disbursementId: pendingReceipt.id, decision, note: receiptIssue.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        setReceiptIssue(result.error || "Could not save the confirmation.");
        return;
      }
      setReceiptIssue("");
      setShowReceiptIssue(false);
      router.refresh();
    } catch {
      setReceiptIssue("Could not save the confirmation. Please try again.");
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const canApprove =
    ["GMD", "COO", "HEAD_OF_ADMIN"].includes(currentUser.role) &&
    (request.approvalStatus === "IN_REVIEW" ||
      request.approvalStatus === "SUBMITTED" ||
      request.approvalStatus === "CLARIFICATION_REQUESTED");

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const newMsg = {
      id: "temp-" + Date.now(),
      authorName: currentUser.name,
      authorRole: currentUser.role,
      messageType: "USER",
      body: inputText.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(request.systemId || request.requestNumber)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SEND_MESSAGE",
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          text: newMsg.body,
        }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(request.systemId || request.requestNumber)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE",
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          decisionReason: approvalReason,
        }),
      });

      if (res.ok) {
        setShowApproveModal(false);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestClarification = async () => {
    if (!clarificationText.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(request.systemId || request.requestNumber)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_CLARIFICATION",
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          text: clarificationText,
        }),
      });

      if (res.ok) {
        setShowClarificationModal(false);
        setClarificationText("");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back Link & Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/requests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to All Requests</span>
        </Link>
        <span className="font-mono text-xs text-slate-600" title="Stable system-wide request identifier">
          System ID: {request.systemId || `SYS-${String(request.id).toUpperCase()}`}
        </span>
      </div>

      {/* Request Header Card */}
      <div className="glass-panel bg-white p-6 rounded-2xl border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-mono text-xs font-bold border border-blue-500/20">
                {request.requestNumber}
              </span>
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                {request.subsidiary.legalName}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-600">
                Needed by: <strong className="text-slate-800">{formatDate(request.neededBy)}</strong>
              </span>
              {request.isRecurring && (
                <span className="text-[11px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-medium">
                  Recurring ({request.recurringInterval})
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              {request.title}
            </h1>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Requested by:</span>
              <span className="font-semibold text-slate-800">
                {request.requester.legalName}
              </span>
              <span>({request.requester.workEmail})</span>
            </div>
          </div>

          {/* Amount Box */}
          <div className="lg:text-right shrink-0 bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-[11px] uppercase font-semibold text-slate-600 tracking-wider">
              Total Requested Amount
            </p>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-0.5">
              {formatMoney(request.amountMinor, request.currency)}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Category: <span className="font-semibold text-slate-700">{request.category.replace("_", " ")}</span>
            </p>
          </div>
        </div>

        {/* 3 Status Axes Ribbon */}
        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-600 tracking-wider">
                1. Approval State
              </p>
              <div className="mt-0.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${appBadge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${appBadge.dot}`} />
                  {appBadge.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-600 tracking-wider">
                2. Payment Transfer
              </p>
              <div className="mt-0.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${payBadge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${payBadge.dot}`} />
                  {payBadge.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-600 tracking-wider">
                3. Accountability Gate
              </p>
              <div className="mt-0.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${accBadge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${accBadge.dot}`} />
                  {accBadge.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Decision Action Toolbar */}
      {canApprove && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 via-white to-white border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Executive Action Required: Decision Pending
              </p>
              <p className="text-xs text-slate-600">
                You have executive authority ({currentUser.role}) to approve, request clarification, or decline this request.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowClarificationModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-300"
            >
              <HelpCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>Ask Clarification</span>
            </button>
            <button
              onClick={() => setShowApproveModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Approve for Payment</span>
            </button>
          </div>
        </div>
      )}

      {/* Payment record and requester receipt confirmation */}
      {(request.disbursements || []).length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3" aria-label="Payment records">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Payment and receipt confirmation</h2>
              <p className="text-xs text-slate-600">The requester confirms receipt after Finance or the GMD records the payment.</p>
            </div>
            {pendingReceipt && canConfirmReceipt && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Your confirmation is needed</span>
            )}
          </div>
          {(request.disbursements || []).map((payment: any) => {
            const confirmed = payment.status === "RECIPIENT_CONFIRMED";
            const issue = payment.status === "RECIPIENT_REPORTED_ISSUE";
            const receipt = payment.receipt;
            return (
              <div key={payment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{payment.externalReference} · {formatMoney(payment.amountMinor, request.currency)}</p>
                    <p className="mt-1 text-xs text-slate-600">Recorded by {payment.recordedBy?.legalName || "Finance"} · {formatDateTime(payment.paidAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${confirmed ? "bg-emerald-100 text-emerald-800" : issue ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                    {confirmed ? "Receipt confirmed" : issue ? "Issue reported" : "Awaiting your confirmation"}
                  </span>
                </div>
                {receipt && (
                  <a href={receipt.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">
                    <Paperclip className="h-3.5 w-3.5" /> Review payment receipt: {receipt.fileName}
                  </a>
                )}
                {payment.recipientConfirmation?.note && <p className="text-xs text-rose-800">Staff note: {payment.recipientConfirmation.note}</p>}
                {pendingReceipt?.id === payment.id && canConfirmReceipt && (
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    {!showReceiptIssue ? (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => submitReceiptConfirmation("RECEIVED")} disabled={confirmingReceipt} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                          {confirmingReceipt ? "Saving…" : "I received the funds"}
                        </button>
                        <button onClick={() => setShowReceiptIssue(true)} disabled={confirmingReceipt} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">
                          I didn’t receive them / amount is wrong
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700" htmlFor={`receipt-issue-${payment.id}`}>Tell Finance what is wrong</label>
                        <textarea id={`receipt-issue-${payment.id}`} rows={3} value={receiptIssue} onChange={(event) => setReceiptIssue(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900" placeholder="For example: the funds have not arrived, or the amount received was different." />
                        {receiptIssue && <p className="text-xs text-rose-700">{receiptIssue}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => submitReceiptConfirmation("NOT_RECEIVED")} disabled={confirmingReceipt || !receiptIssue.trim()} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Report funds not received</button>
                          <button onClick={() => submitReceiptConfirmation("AMOUNT_MISMATCH")} disabled={confirmingReceipt || !receiptIssue.trim()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Report amount mismatch</button>
                          <button onClick={() => { setShowReceiptIssue(false); setReceiptIssue(""); }} className="px-3 py-2 text-xs text-slate-600">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Main Grid: Channel Feed (Left) vs Request Details (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Dedicated Collaboration Channel */}
        <div className="lg:col-span-2 glass-panel bg-white rounded-2xl border border-slate-200 flex flex-col h-[650px]">
          {/* Channel Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Dedicated Request Channel
                </h2>
                <p className="text-[11px] text-slate-600">
                  Canonical collaboration feed & audit event timeline
                </p>
              </div>
            </div>
            <span className="text-[11px] text-slate-600 font-mono">
              {messages.length} Events / Messages
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => {
              const isSystem = msg.messageType === "AUDIT_EVENT" || msg.authorRole === "SYSTEM";
              const isClarification = msg.messageType === "CLARIFICATION";

              if (isSystem) {
                return (
                  <div
                    key={msg.id || i}
                    className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
                      <span className="uppercase font-bold tracking-wider text-blue-400 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        System Audit Event
                      </span>
                      <span>{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-slate-700 font-medium">{msg.body}</p>
                  </div>
                );
              }

              if (isClarification) {
                return (
                  <div
                    key={msg.id || i}
                    className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5" />
                        {msg.authorName} ({msg.authorRole})
                      </span>
                      <span className="text-[10px] text-slate-600 font-mono">
                        {formatDateTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-purple-200 mt-1 font-medium">{msg.body}</p>
                  </div>
                );
              }

              const isMe = msg.authorName === currentUser.name;

              return (
                <div
                  key={msg.id || i}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[11px] font-bold text-slate-700">
                      {msg.authorName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-medium">
                      {msg.authorRole}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {formatDateTime(msg.createdAt)}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs space-y-2 ${
                      isMe
                        ? "bg-blue-600 text-white rounded-br-xs"
                        : "bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-xs"
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>

                    {/* Attachment if present */}
                    {msg.attachmentName && (
                      <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-100 p-2 rounded-lg">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate font-mono text-[11px]">
                            {msg.attachmentName}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase underline shrink-0 cursor-pointer hover:opacity-80">
                          View
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Message Input Box */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message in channel as ${currentUser.name} (${currentUser.role})...`}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>

        {/* Right Column: Request Details & Policy Trace */}
        <div className="space-y-6">
          {/* Deliverables & Justification */}
          <div className="glass-panel bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Operational Justification
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {request.justification}
            </p>

            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Expected Deliverable
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {request.deliverable}
            </p>

            {/* Supporting Document Attachments */}
            {Array.isArray(request.attachments) && request.attachments.length > 0 && (
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Supporting Documents ({request.attachments.length})
                </h4>
                <div className="space-y-1.5">
                  {request.attachments.map((att: any) => (
                    <a
                      key={att.id}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-blue-700 transition"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Paperclip className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate font-semibold">{att.fileName}</span>
                      </span>
                      <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Vendor Details */}
          {request.vendor && (
            <div className="glass-panel bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Beneficiary Vendor
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  {request.vendor.code}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {request.vendor.name}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Category: {request.vendor.category}
                </p>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
                <p>
                  Bank: <strong className="text-slate-800">{request.vendor.bankName}</strong>
                </p>
                <p>
                  Account: <strong className="text-slate-800 font-mono">{request.vendor.accountNumber}</strong>
                </p>
                <p>
                  Name: <strong className="text-slate-800">{request.vendor.accountName}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Approval Audit Trail */}
          <div className="glass-panel bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Approval Chain Evaluation
            </h3>
            <div className="space-y-2.5">
              {request.approvalSteps.map((step: any, index: number) => {
                const isStepApproved = step.status === "APPROVED";
                return (
                  <div
                    key={step.id || index}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3"
                  >
                    <div
                      className={`p-1.5 rounded-full shrink-0 ${
                        isStepApproved
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {isStepApproved ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-800">
                          Stage {step.stageIndex}: {step.assignedRole}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            isStepApproved ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                      {step.approverName && (
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Assigned: {step.approverName}
                        </p>
                      )}
                      {step.decisionReason && (
                        <p className="text-[11px] text-slate-700 italic mt-1">
                          "{step.decisionReason}"
                        </p>
                      )}
                      {step.decidedAt && (
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                          {formatDateTime(step.decidedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Clarification Modal */}
      {showClarificationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-amber-400" />
              <span>Request Clarification from Requester</span>
            </h3>
            <p className="text-xs text-slate-600">
              This will pause the approval countdown and post a clarification event into the dedicated channel.
            </p>
            <textarea
              rows={4}
              value={clarificationText}
              onChange={(e) => setClarificationText(e.target.value)}
              placeholder="Specify the information, quotes, or deliverable details needed..."
              className="w-full bg-slate-100 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-amber-400 transition"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClarificationModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestClarification}
                disabled={isLoading || !clarificationText.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                Submit Clarification Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span>Confirm Executive Approval</span>
            </h3>
            <p className="text-xs text-slate-600">
              You are approving <strong className="text-slate-800">{request.requestNumber}</strong> for{" "}
              <strong className="text-emerald-400 font-mono">
                {formatMoney(request.amountMinor, request.currency)}
              </strong>
              . This will authorize Finance to execute the bank transfer.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Approval Note / Justification
              </label>
              <input
                type="text"
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-400 transition"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20"
              >
                Sign Off & Authorize Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
