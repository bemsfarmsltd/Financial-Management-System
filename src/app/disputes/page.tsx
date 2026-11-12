'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileQuestion,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MessageSquare,
  ArrowRight,
  Send,
  UploadCloud,
  Check,
  X,
  Building2,
  Calendar,
  DollarSign,
  User,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';

interface DisputeItem {
  id: string;
  disputeNumber: string;
  category: string;
  targetRecordId?: string | null;
  title: string;
  explanation: string;
  evidenceUrls: string[];
  status: 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CLOSED';
  resolutionNotes?: string | null;
  createdAt: string;
  employee: {
    id: string;
    legalName: string;
    employeeNumber: string;
    role: string;
  };
  subsidiary: {
    id: string;
    legalName: string;
    code: string;
  };
  resolvedBy?: {
    legalName: string;
    role: string;
  } | null;
  _count?: {
    messages: number;
  };
}

export default function StaffDisputesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-slate-400">Loading Staff Dispute Center...</div>}>
      <StaffDisputesContent />
    </Suspense>
  );
}

function StaffDisputesContent() {
  const searchParams = useSearchParams();

  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [counts, setCounts] = useState({ all: 0, open: 0, underReview: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status') || 'ALL');

  // File Dispute Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(searchParams?.get('action') === 'new');
  const [newCategory, setNewCategory] = useState(searchParams?.get('category') || 'LATENESS');
  const [newRecordId, setNewRecordId] = useState(searchParams?.get('recordId') || '');
  const [newTitle, setNewTitle] = useState('');
  const [newExplanation, setNewExplanation] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Selected Dispute View / Chat Modal
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(searchParams?.get('id') || null);
  const [selectedDisputeData, setSelectedDisputeData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Resolution Action Modal (HR / Admin)
  const [resolutionAction, setResolutionAction] = useState<'APPROVE_CORRECTION' | 'REJECT' | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const fetchDisputes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/disputes?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = '/?redirect=/disputes';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setDisputes(data.disputes || []);
        if (data.counts) setCounts(data.counts);
      }
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const loadDisputeDetail = useCallback(async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/disputes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDisputeData(data);
      }
    } catch (err) {
      console.error('Failed to load dispute detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDisputeId) {
      loadDisputeDetail(selectedDisputeId);
    }
  }, [selectedDisputeId, loadDisputeDetail]);

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newExplanation.trim()) {
      setSubmitError('Please fill out both the title and a detailed explanation.');
      return;
    }

    try {
      setSubmittingDispute(true);
      setSubmitError('');

      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          targetRecordId: newRecordId.trim() || undefined,
          title: newTitle.trim(),
          explanation: newExplanation.trim(),
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to submit dispute.');
      }

      setIsNewModalOpen(false);
      setNewTitle('');
      setNewExplanation('');
      setNewRecordId('');
      fetchDisputes(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission error.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedDisputeId) return;

    try {
      setSendingMessage(true);
      const res = await fetch(`/api/disputes/${selectedDisputeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: messageText.trim() }),
      });

      if (res.ok) {
        setMessageText('');
        loadDisputeDetail(selectedDisputeId);
      }
    } catch (err) {
      console.error('Error posting message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleResolveDispute = async () => {
    if (!selectedDisputeId || !resolutionAction || !resolutionNotes.trim()) return;

    try {
      setResolving(true);
      const res = await fetch(`/api/disputes/${selectedDisputeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: resolutionAction,
          resolutionNotes: resolutionNotes.trim(),
        }),
      });

      if (res.ok) {
        setResolutionAction(null);
        setResolutionNotes('');
        loadDisputeDetail(selectedDisputeId);
        fetchDisputes(true);
      }
    } catch (err) {
      console.error('Error resolving dispute:', err);
    } finally {
      setResolving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Correction Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Dispute Declined
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            Under Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Open Dispute
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EA580C] shadow-sm">
                <FileQuestion className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Staff Query & Dispute Center</h1>
                <p className="text-xs text-slate-500 font-medium">
                  Structured arbitration for attendance records, lateness penalties, and salary deduction queries.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/notifications"
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition"
              >
                ← Back to Notifications
              </Link>
              <button
                onClick={() => fetchDisputes(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#EA580C] text-white rounded-lg hover:bg-orange-600 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                File New Dispute
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-3 overflow-x-auto">
            {[
              { id: 'ALL', label: `All Disputes (${counts.all})` },
              { id: 'OPEN', label: `Open (${counts.open})` },
              { id: 'UNDER_REVIEW', label: `Under Review (${counts.underReview})` },
              { id: 'APPROVED', label: `Approved (${counts.approved})` },
              { id: 'REJECTED', label: `Declined (${counts.rejected})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main List */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : disputes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto mb-4 text-[#EA580C]">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">No Disputes Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              There are no active attendance or salary deduction disputes matching your current filter.
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#EA580C] text-white rounded-lg hover:bg-orange-600 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              File a Dispute / Query
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {disputes.map(dispute => (
              <div
                key={dispute.id}
                onClick={() => setSelectedDisputeId(dispute.id)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition cursor-pointer hover:border-slate-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      {dispute.disputeNumber}
                    </span>
                    <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                      {dispute.category}
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {dispute.subsidiary.code || dispute.subsidiary.legalName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(dispute.status)}
                    <span className="text-xs text-slate-400 font-medium">
                      {formatDateTime(dispute.createdAt)}
                    </span>
                  </div>
                </div>

                <h4 className="text-sm font-extrabold text-slate-900 mb-1">
                  {dispute.title}
                </h4>

                <p className="text-xs text-slate-600 line-clamp-2 max-w-4xl mb-3">
                  {dispute.explanation}
                </p>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">{dispute.employee.legalName}</span>
                    <span className="text-slate-400">({dispute.employee.employeeNumber})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {dispute._count?.messages ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        {dispute._count.messages} message{dispute._count.messages > 1 ? 's' : ''}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#EA580C]">
                      View Case Details <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL: File New Dispute */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EA580C]">
                  <FileQuestion className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">File a Formal Dispute / Query</h3>
                  <p className="text-xs text-slate-500">HR and Management will review your explanation.</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitError && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {submitError}
              </div>
            )}

            <form onSubmit={handleCreateDispute} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dispute Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                >
                  <option value="LATENESS">Lateness Penalty / Arrival Time</option>
                  <option value="ATTENDANCE">Attendance Punch Record / Absence</option>
                  <option value="DEDUCTION">Salary Deduction / Penalty</option>
                  <option value="PAYROLL">Payroll Calculation Discrepancy</option>
                  <option value="HR_DECISION">HR Policy / Disciplinary Decision</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dispute Subject</label>
                <input
                  type="text"
                  placeholder="e.g., Farm power outage delayed biometric check-in on Nov 12"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Detailed Explanation</label>
                <textarea
                  rows={4}
                  placeholder="Provide full operational facts, station details, or why this deduction/lateness should be excused..."
                  value={newExplanation}
                  onChange={e => setNewExplanation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-400"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="px-5 py-2 text-xs font-bold bg-[#EA580C] text-white rounded-lg hover:bg-orange-600 transition shadow-sm disabled:opacity-50"
                >
                  {submittingDispute ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Dispute Detail & Messaging Timeline */}
      {selectedDisputeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 text-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EA580C]">
                  <FileQuestion className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900">
                      {selectedDisputeData?.dispute?.disputeNumber || 'Loading...'}
                    </span>
                    {selectedDisputeData && getStatusBadge(selectedDisputeData.dispute.status)}
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 line-clamp-1">
                    {selectedDisputeData?.dispute?.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedDisputeId(null);
                  setSelectedDisputeData(null);
                  setResolutionAction(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {loadingDetail ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading dispute case details...</div>
              ) : selectedDisputeData ? (
                <>
                  {/* Case Metadata Banner */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Employee</span>
                      <span className="font-bold text-slate-800">{selectedDisputeData.dispute.employee.legalName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Category</span>
                      <span className="font-bold text-orange-600">{selectedDisputeData.dispute.category}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Subsidiary</span>
                      <span className="font-bold text-slate-800">{selectedDisputeData.dispute.subsidiary.legalName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Filed Date</span>
                      <span className="font-bold text-slate-800">{formatDateTime(selectedDisputeData.dispute.createdAt)}</span>
                    </div>
                  </div>

                  {/* Original Explanation Box */}
                  <div className="p-4 bg-orange-50/40 border border-orange-100 rounded-xl">
                    <span className="text-[10px] font-black text-orange-800 uppercase tracking-wider block mb-1">
                      Staff Explanation & Statement
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selectedDisputeData.dispute.explanation}
                    </p>
                  </div>

                  {/* Resolution Notes if Resolved */}
                  {selectedDisputeData.dispute.resolutionNotes && (
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                          Official Resolution Decision ({selectedDisputeData.dispute.status})
                        </span>
                      </div>
                      <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                        {selectedDisputeData.dispute.resolutionNotes}
                      </p>
                      {selectedDisputeData.dispute.resolvedBy && (
                        <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                          Decided by: {selectedDisputeData.dispute.resolvedBy.legalName} ({selectedDisputeData.dispute.resolvedBy.role})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Discussion Thread */}
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">
                      Case Discussion Timeline ({selectedDisputeData.dispute.messages.length})
                    </h4>
                    {selectedDisputeData.dispute.messages.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No messages yet. Use the input below to ask a question or provide additional proof.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedDisputeData.dispute.messages.map((m: any) => (
                          <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-slate-800">
                                {m.sender.legalName} <span className="text-slate-400 font-normal">({m.senderRole})</span>
                              </span>
                              <span className="text-slate-400">{formatDateTime(m.createdAt)}</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">{m.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer / Reply & Admin Action Controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 space-y-3">
              {/* Message Input Form */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message or response..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !messageText.trim()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-40 transition shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* HR / Admin Resolution Trigger */}
              {selectedDisputeData?.dispute?.status === 'OPEN' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500">Executive Action:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResolutionAction('REJECT')}
                      className="px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition"
                    >
                      Decline Dispute
                    </button>
                    <button
                      onClick={() => setResolutionAction('APPROVE_CORRECTION')}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm"
                    >
                      Approve Correction (Waive Penalty)
                    </button>
                  </div>
                </div>
              )}

              {/* Resolution Notes Input Confirmation */}
              {resolutionAction && (
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 mt-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    {resolutionAction === 'APPROVE_CORRECTION'
                      ? 'Confirm Correction Approval Notes (Will waive penalty & recalculate):'
                      : 'Provide Reason for Declining Dispute:'}
                  </span>
                  <textarea
                    rows={2}
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    placeholder="Enter formal reason..."
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setResolutionAction(null)}
                      className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResolveDispute}
                      disabled={resolving || !resolutionNotes.trim()}
                      className="px-4 py-1 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40"
                    >
                      {resolving ? 'Applying...' : 'Confirm Decision'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
