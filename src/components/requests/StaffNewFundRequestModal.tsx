'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Calendar,
  Clock,
  Building,
  Tag,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  Repeat,
  Store,
  User,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

interface StaffNewFundRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  subsidiaries: any[];
  vendors: any[];
  currentStaff?: any;
  onSubmitted?: () => void;
}

const CATEGORIES = [
  'Operational Materials & Consumables',
  'Equipment & Spares Repair',
  'Fuel & Logistics Haulage',
  'General Procurement & Supplies',
  'Staff Welfare & Per-Diem',
  'Utility & Operations',
  'Feed Ingredients & Raw Grain',
];

const RECURRING_INTERVALS = [
  { value: 'WEEKLY', label: 'Weekly Cycle' },
  { value: 'BI_WEEKLY', label: 'Bi-Weekly (Every 2 Weeks)' },
  { value: 'MONTHLY', label: 'Monthly Cycle' },
  { value: 'QUARTERLY', label: 'Quarterly (Every 3 Months)' },
];

export function StaffNewFundRequestModal({
  isOpen,
  onClose,
  user,
  subsidiaries = [],
  vendors = [],
  currentStaff,
  onSubmitted,
}: StaffNewFundRequestModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [amountInput, setAmountInput] = useState('');
  const [title, setTitle] = useState('');
  const [justification, setJustification] = useState('');
  const [deliverable, setDeliverable] = useState('');

  // Target Subsidiary
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string>('');

  // Category
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);

  // Urgency
  const [selectedUrgency, setSelectedUrgency] = useState<'NORMAL' | 'HIGH' | 'CRITICAL'>('HIGH');

  // Due Date & Time
  const defaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  };
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [dueTime, setDueTime] = useState('14:00');

  // Recurring Controls
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('MONTHLY');

  // Payee / Beneficiary Destination
  const [payeeType, setPayeeType] = useState<'STAFF_ADVANCE' | 'VENDOR'>('STAFF_ADVANCE');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // Attachments
  const [attachments, setAttachments] = useState<
    Array<{ fileName: string; fileUrl: string; contentType: string; size?: string }>
  >([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize Subsidiary Selection
  useEffect(() => {
    if (subsidiaries.length > 0 && !selectedSubsidiaryId) {
      // Find matching user subsidiary or default to first
      const match =
        subsidiaries.find(
          (s) =>
            s.legalName === user?.subsidiary ||
            s.code === user?.subsidiary ||
            s.id === currentStaff?.assignments?.[0]?.subsidiaryId
        ) || subsidiaries[0];
      setSelectedSubsidiaryId(match.id);
    }
  }, [subsidiaries, user, currentStaff, selectedSubsidiaryId]);

  // Initialize Vendor Selection
  useEffect(() => {
    if (vendors.length > 0 && !selectedVendorId) {
      setSelectedVendorId(vendors[0].id);
    }
  }, [vendors, selectedVendorId]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'REQUEST_ATTACHMENT');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload document');

      const sizeKb = Math.round(file.size / 1024);
      const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

      setAttachments((prev) => [
        ...prev,
        {
          fileName: file.name,
          fileUrl: data.url || data.fileUrl,
          contentType: file.type || 'application/octet-stream',
          size: sizeStr,
        },
      ]);
    } catch (err: any) {
      setErrorMessage(`Upload error: ${err.message}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanAmount = amountInput.replace(/,/g, '').trim();
    const numericAmount = parseFloat(cleanAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Please enter a valid requisition amount.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please enter an expenditure title / purpose.');
      return;
    }

    if (!justification.trim()) {
      setErrorMessage('Please provide a business justification.');
      return;
    }

    if (payeeType === 'VENDOR' && !selectedVendorId) {
      setErrorMessage('Please select a registered vendor or switch to My Advance Bank.');
      return;
    }

    setSubmitting(true);
    try {
      const dueDateTimeIso = new Date(`${dueDate}T${dueTime || '14:00'}:00`).toISOString();

      const payload = {
        subsidiaryId: selectedSubsidiaryId,
        requestType: payeeType === 'VENDOR' ? 'ORDINARY' : 'ADVANCE',
        category: selectedCategory,
        amountNaira: numericAmount,
        vendorId: payeeType === 'VENDOR' ? selectedVendorId : null,
        title: title.trim(),
        justification: justification.trim(),
        deliverable: deliverable.trim(),
        neededBy: dueDateTimeIso,
        dueDate: `${dueDate}, ${dueTime}`,
        urgency: selectedUrgency,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : null,
        attachments: attachments.map((a) => ({
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          contentType: a.contentType,
        })),
      };

      const res = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit fund requisition.');
      }

      onSubmitted?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-[#0F172A]/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#F8FAFC] rounded-t-[32px] sm:rounded-[28px] shadow-2xl border border-slate-200/80 max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Top Header Bar matching mobile AppBar */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-black text-[#0F172A] leading-tight">
                New Fund Requisition
              </h3>
              <p className="text-[10px] font-semibold text-[#64748B]">
                BEMS Corporate Expenditure Gateway
              </p>
            </div>
          </div>

          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-[#EA580C] border border-orange-200">
            Staff Portal
          </span>
        </div>

        {/* Form Body matching mobile NewFundRequestScreen layout */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1">
          {/* Card 1: Requisition Amount (Hero Card matching mobile) */}
          <div className="p-4 bg-white rounded-2xl border border-orange-200 shadow-sm shadow-orange-500/5 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] block">
              REQUISITION AMOUNT (NGN)
            </span>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-2xl font-black text-[#EA580C]">₦</span>
              <input
                type="text"
                autoFocus
                placeholder="0"
                value={amountInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setAmountInput(val);
                }}
                className="w-full text-2xl font-black text-[#0F172A] bg-transparent focus:outline-none placeholder:text-slate-300 font-mono"
              />
            </div>
          </div>

          {/* Card 2: Main Form Fields Container matching mobile layout */}
          <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
            {/* Field: Purpose / Title */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1.5">
                EXPENDITURE PURPOSE
              </label>
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] focus-within:border-[#EA580C] transition-all">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. Bulk procurement of yellow maize (Batch 43)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-[#0F172A] focus:outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Field: Due Date & Time Picker */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1.5">
                WHEN FUND IS DUE (REQUIRED BY DATE)
              </label>
              <div className="p-3 bg-[#FFF7ED] rounded-xl border border-[#FED7AA] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-[#EA580C] shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-[#9A3412] block">
                      Disbursement Target Due Date
                    </span>
                    <span className="text-xs font-black text-[#0F172A]">
                      {new Date(dueDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      , {dueTime}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="px-2 py-1 bg-white border border-[#FED7AA] rounded-lg text-xs font-bold text-[#0F172A] focus:outline-none"
                  />
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="px-2 py-1 bg-white border border-[#FED7AA] rounded-lg text-xs font-bold text-[#0F172A] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Field: Recurring Fund Request Toggle */}
            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Repeat className="w-4 h-4 text-[#2563EB]" />
                  <div>
                    <span className="text-xs font-extrabold text-[#0F172A] block leading-tight">
                      Recurring Fund Request
                    </span>
                    <span className="text-[10px] font-medium text-[#64748B]">
                      Auto-renew request periodically
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 accent-[#2563EB] rounded cursor-pointer"
                />
              </div>

              {isRecurring && (
                <div className="pt-2 border-t border-[#E2E8F0] space-y-2 animate-fade-in">
                  <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block">
                    RECURRENCE FREQUENCY
                  </label>
                  <select
                    value={recurringInterval}
                    onChange={(e) => setRecurringInterval(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none"
                  >
                    {RECURRING_INTERVALS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <div className="p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl flex items-start gap-2 text-[11px] text-[#1E40AF]">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Admin & Treasury will automatically receive notifications 7 days prior to each recurring cycle for budget reservation.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Field: Payee / Beneficiary Destination matching mobile */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1.5">
                PAYEE / BENEFICIARY DESTINATION
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayeeType('STAFF_ADVANCE')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                    payeeType === 'STAFF_ADVANCE'
                      ? 'bg-[#FFF7ED] border-[#EA580C] text-[#EA580C] shadow-xs'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-slate-100'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>My Advance Bank</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPayeeType('VENDOR')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                    payeeType === 'VENDOR'
                      ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] shadow-xs'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-slate-100'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Registered Vendor</span>
                </button>
              </div>

              {payeeType === 'VENDOR' && (
                <div className="mt-2 animate-fade-in">
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none"
                  >
                    <option value="">Select registered vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Field: Target Subsidiary */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1.5">
                TARGET SUBSIDIARY ENTITY
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <Building className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedSubsidiaryId}
                  onChange={(e) => setSelectedSubsidiaryId(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-[#0F172A] focus:outline-none"
                >
                  {subsidiaries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.legalName} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Field: Expense Category */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1.5">
                BUDGET EXPENSE CATEGORY
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-[#0F172A] focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Field: Business Justification */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1.5">
                BUSINESS JUSTIFICATION
              </label>
              <textarea
                rows={3}
                placeholder="Explain why this expenditure is required and operational impact..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] focus:outline-none placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Field: Mandatory Verification Proof */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1.5">
                MANDATORY VERIFICATION PROOF (72H RETIREMENT)
              </label>
              <input
                type="text"
                placeholder="e.g. Weighbridge ticket, physical GRN note, mechanic receipt"
                value={deliverable}
                onChange={(e) => setDeliverable(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] focus:outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Field: Operational Urgency Chips matching mobile */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1.5">
                OPERATIONAL URGENCY
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'NORMAL', label: 'Normal (48h)', color: '#10B981', bg: '#ECFDF5' },
                  { id: 'HIGH', label: 'High (24h)', color: '#EA580C', bg: '#FFF7ED' },
                  { id: 'CRITICAL', label: 'Emergency', color: '#EF4444', bg: '#FEF2F2' },
                ].map((chip) => {
                  const isSelected = selectedUrgency === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setSelectedUrgency(chip.id as any)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-extrabold border text-center transition-all ${
                        isSelected
                          ? 'border-transparent shadow-xs'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-slate-100'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: chip.bg, color: chip.color, borderColor: chip.color }
                          : {}
                      }
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field: Supporting Quotation / Proofs */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#64748B] block mb-1">
                SUPPORTING QUOTATION / INVOICE PROOFS (OPTIONAL)
              </label>
              <p className="text-[10px] text-[#64748B] mb-2">
                Attach vendor quotation, proforma invoice or physical quotation photo for 3-way matching.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="w-full py-2.5 px-3 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-bold text-[#0F172A] flex items-center justify-center gap-2 shadow-xs transition-all"
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#EA580C]" />
                    <span>Uploading quotation...</span>
                  </>
                ) : (
                  <>
                    <Paperclip className="w-4 h-4 text-[#EA580C]" />
                    <span>Attach Quote or Invoice</span>
                  </>
                )}
              </button>

              {/* Uploaded attachments list */}
              {attachments.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                        <span className="font-semibold text-[#0F172A] truncate">
                          {att.fileName} ({att.size || 'Attached'})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button matching mobile elevated orange button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-[#EA580C] hover:bg-orange-700 text-white rounded-2xl font-black text-sm shadow-md shadow-orange-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Requisition...</span>
              </>
            ) : (
              <span>
                {isRecurring
                  ? 'Schedule Recurring Requisition'
                  : 'Submit Requisition for Approval'}
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
