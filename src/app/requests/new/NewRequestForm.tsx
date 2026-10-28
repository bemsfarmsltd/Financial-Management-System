'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  DollarSign,
  Calendar,
  ChevronLeft,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Truck,
  Repeat,
  ShieldCheck,
  X,
  FileCheck,
  Clock,
} from 'lucide-react';

interface Subsidiary {
  id: string;
  legalName: string;
  code: string;
  type?: string;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
}

interface StaffAssignment {
  subsidiaryId: string;
  departmentId?: string | null;
  positionName: string;
  isPrimary: boolean;
  subsidiary?: { id: string; legalName: string; code: string };
  department?: { id: string; name: string };
}

interface CurrentStaff {
  id: string;
  legalName: string;
  workEmail: string;
  employeeNumber: string;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  assignments?: StaffAssignment[];
}

interface NewRequestFormProps {
  subsidiaries: Subsidiary[];
  vendors: Vendor[];
  employees: any[];
  currentStaff?: CurrentStaff | null;
}

const CATEGORIES = [
  'Feed Ingredients & Raw Grain',
  'Machinery & Spares Repair',
  'Fuel & Logistics Haulage',
  'Farm Inputs & Agro-Chemicals',
  'Staff Welfare & Per-Diem',
  'Utility & Operations',
  'IT & Cloud Software (VPS, SaaS)',
  'Office Supplies & Stationeries',
  'General Maintenance',
];

interface UploadedAttachment {
  fileName: string;
  fileUrl: string;
  contentType: string;
  size?: string;
}

export function NewRequestForm({
  subsidiaries,
  vendors,
  employees,
  currentStaff,
}: NewRequestFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-select primary subsidiary if assigned
  const primarySubId =
    currentStaff?.assignments?.find((a) => a.isPrimary)?.subsidiaryId ||
    currentStaff?.assignments?.[0]?.subsidiaryId ||
    subsidiaries[0]?.id ||
    '';

  const [subsidiaryId, setSubsidiaryId] = useState(primarySubId);
  const [requestType, setRequestType] = useState<'ORDINARY' | 'ADVANCE' | 'REIMBURSEMENT'>('ORDINARY');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [payeeType, setPayeeType] = useState<'STAFF_ADVANCE' | 'VENDOR'>('STAFF_ADVANCE');
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [amountNaira, setAmountNaira] = useState('');
  const [title, setTitle] = useState('');
  const [justification, setJustification] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [neededBy, setNeededBy] = useState(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('MONTHLY');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live Policy Tier Computation
  const numericAmount = parseFloat(amountNaira.replace(/,/g, '')) || 0;
  const isItAsset = category.toLowerCase().includes('it') || category.toLowerCase().includes('software');

  let policyTier = {
    badge: 'Tier 1: Department Head Clearance',
    badgeColor: '#15803d',
    badgeBg: '#dcfce7',
    description: 'Expenditures under ₦100,000 route to your Department Head for validation.',
  };

  if (numericAmount > 1000000 || isItAsset) {
    policyTier = {
      badge: 'Tier 3: GMD Executive Clearance Required',
      badgeColor: '#c2410c',
      badgeBg: '#ffedd5',
      description: 'Capital investments, IT infrastructure, or requisitions above ₦1,000,000 require GMD final approval.',
    };
  } else if (numericAmount > 100000) {
    policyTier = {
      badge: 'Tier 2: COO Operational Clearance',
      badgeColor: '#854d0e',
      badgeBg: '#fef9c3',
      description: 'Requisitions between ₦100,001 and ₦1,000,000 route through Chief Operating Officer governance.',
    };
  }

  // Handle Multi-file upload via /api/upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMsg('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          setErrorMsg(`File "${file.name}" exceeds maximum allowed size (10 MB).`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`);

        const sizeKb = Math.round(file.size / 1024);
        const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        setAttachments((prev) => [
          ...prev,
          {
            fileName: file.name,
            fileUrl: data.url,
            contentType: file.type || 'application/octet-stream',
            size: sizeStr,
          },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'File upload failed. Ensure the file is an image or PDF.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || numericAmount <= 0 || !justification.trim() || !deliverable.trim()) {
      setErrorMsg('Please complete all required fields (Title, Amount, Justification, Deliverable).');
      return;
    }

    if (payeeType === 'VENDOR' && !vendorId) {
      setErrorMsg('Please select a registered vendor or switch to Staff Advance.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        subsidiaryId,
        requestType,
        category,
        amountNaira: numericAmount,
        vendorId: payeeType === 'VENDOR' ? vendorId : null,
        title: title.trim(),
        justification: justification.trim(),
        deliverable: deliverable.trim(),
        neededBy,
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
      if (res.ok) {
        router.push(`/requests/${data.requestNumber}`);
      } else {
        setErrorMsg(data.error || 'Failed to submit fund request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link
            href="/requests"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#ea580c',
              textDecoration: 'none',
              marginBottom: 6,
            }}
          >
            <ChevronLeft size={16} /> Cancel &amp; Back to Requests
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Submit New Fund / Expenditure Request
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Create an expenditure requisition with supporting documentation and route through deterministic policy checks.
          </p>
        </div>

        {currentStaff && (
          <div
            style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '12px',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{currentStaff.legalName}</span>
            <span>·</span>
            <span style={{ fontFamily: 'monospace', color: '#ea580c', fontWeight: 700 }}>
              {currentStaff.employeeNumber}
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} color="#dc2626" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Operating Subsidiary & Classification */}
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <Building2 size={16} color="#ea580c" />
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Operating Subsidiary &amp; Request Classification
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Target Operating Subsidiary *
              </label>
              <select
                value={subsidiaryId}
                onChange={(e) => setSubsidiaryId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                {subsidiaries.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.legalName} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Request Type *
              </label>
              <select
                value={requestType}
                onChange={(e) => {
                  const val = e.target.value as 'ORDINARY' | 'ADVANCE' | 'REIMBURSEMENT';
                  setRequestType(val);
                  if (val === 'ADVANCE') setPayeeType('STAFF_ADVANCE');
                  if (val === 'ORDINARY') setPayeeType('VENDOR');
                }}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                <option value="ORDINARY">Ordinary Expenditure (Vendor Goods/Service)</option>
                <option value="ADVANCE">Staff Advance (To be retired post-task)</option>
                <option value="REIMBURSEMENT">Reimbursement (Already incurred out-of-pocket)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Budget Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Section 2: Financial Valuation & Policy Routing */}
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <DollarSign size={16} color="#ea580c" />
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Financial Valuation &amp; Policy Routing
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Amount Requested (NGN Naira) *
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '14px', color: '#ea580c', fontWeight: 700 }}>
                  ₦
                </span>
                <input
                  type="text"
                  value={amountNaira}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0.0-9]/g, '');
                    setAmountNaira(raw);
                  }}
                  placeholder="e.g. 185000"
                  required
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '9px 12px 9px 28px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
              </div>
              {numericAmount > 0 && (
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                  Formatted: <strong>₦{numericAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Funds Needed By (Execution Date) *
              </label>
              <input
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Dynamic Policy Routing Box */}
          <div
            style={{
              background: policyTier.badgeBg,
              border: `1px solid ${policyTier.badgeColor}33`,
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <ShieldCheck size={18} color={policyTier.badgeColor} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: policyTier.badgeColor }}>
                {policyTier.badge}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                {policyTier.description}
              </div>
            </div>
          </div>

          {/* Recurring Option */}
          <div style={{ paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ accentColor: '#ea580c', width: '16px', height: '16px' }}
              />
              <span>Is this a recurring commitment? (e.g. Monthly cloud server, office rent, diesel retainer)</span>
            </label>

            {isRecurring && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '24px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Interval:</span>
                <select
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(e.target.value)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '12.5px',
                    color: '#0f172a',
                  }}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BI_WEEKLY">Bi-Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                </select>
                <span style={{ fontSize: '11.5px', color: '#ea580c', fontWeight: 600 }}>
                  ● 7-day advance automated notice will be dispatched prior to each renewal.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Section 3: Payee & Beneficiary Details */}
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <UserCheck size={16} color="#ea580c" />
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              3. Payee &amp; Beneficiary Details (3-Way Matching)
            </h2>
          </div>

          {/* Toggle Payee Mode */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setPayeeType('STAFF_ADVANCE')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: payeeType === 'STAFF_ADVANCE' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                background: payeeType === 'STAFF_ADVANCE' ? '#fff7ed' : '#ffffff',
                color: payeeType === 'STAFF_ADVANCE' ? '#c2410c' : '#475569',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <UserCheck size={16} /> Staff Advance / Personal Payout
            </button>

            <button
              type="button"
              onClick={() => setPayeeType('VENDOR')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: payeeType === 'VENDOR' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                background: payeeType === 'VENDOR' ? '#fff7ed' : '#ffffff',
                color: payeeType === 'VENDOR' ? '#c2410c' : '#475569',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Truck size={16} /> Registered Vendor / Supplier (3-Way Matching)
            </button>
          </div>

          {payeeType === 'STAFF_ADVANCE' ? (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Verified Staff Disbursement Account
              </div>
              {currentStaff?.bankName ? (
                <div style={{ fontSize: '13.5px', color: '#0f172a', fontWeight: 600 }}>
                  🏦 {currentStaff.bankName} · <span style={{ fontFamily: 'monospace' }}>{currentStaff.accountNumber}</span> ({currentStaff.accountName})
                </div>
              ) : (
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                  Funds will be disbursed to your registered employee profile account upon approval.
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Select Registered Vendor / Contractor *
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.category}) — {v.bankName || 'Bank'} ({v.accountNumber || 'N/A'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Section 4: Operational Justification & Accountability Gate */}
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <FileText size={16} color="#ea580c" />
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              4. Operational Scope, Justification &amp; 72-Hour Deliverable
            </h2>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Request Title / Purpose *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diesel fuel supply for Umuahia generator cluster"
              required
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '13px',
                color: '#0f172a',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Operational Justification (Why is this needed?) *
            </label>
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Provide business background, operational urgency, and impact of approval..."
              required
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '13px',
                color: '#0f172a',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Expected Deliverable &amp; Post-Payment Proof *
            </label>
            <input
              type="text"
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              placeholder="e.g. Official vendor stamped invoice receipt, waybill, and meter log"
              required
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '13px',
                color: '#0f172a',
                outline: 'none',
              }}
            />
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
              ● This defines the 72-hour accountability proof gate. Advances cannot be retired without uploading this proof.
            </div>
          </div>
        </section>

        {/* Section 5: Supporting Proforma & Documents (Attachments) */}
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UploadCloud size={16} color="#ea580c" />
              <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                5. Supporting Invoices &amp; Documents ({attachments.length})
              </h2>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>PDF, JPG, PNG up to 10MB</span>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept=".pdf,image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
          />

          {/* Upload Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '10px',
              padding: '24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#f8fafc',
              transition: 'all 0.2s ease',
            }}
          >
            <UploadCloud size={32} color="#ea580c" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
              {isUploading ? 'Uploading supporting document...' : 'Click or drop files here to upload'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Upload proforma invoice, quote, requisition breakdown, or specs
            </div>
          </div>

          {/* Attached Files List */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileCheck size={16} color="#16a34a" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                        {att.fileName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {att.size} · {att.contentType}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#b91c1c',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Form Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingTop: '10px' }}>
          <Link
            href="/requests"
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isSubmitting ? (
              <>Submitting Requisition...</>
            ) : (
              <>Submit &amp; Launch Dedicated Channel &rarr;</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
