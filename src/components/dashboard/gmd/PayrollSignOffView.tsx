'use client';

import WalletFlowNotice from '@/components/wallet/WalletFlowNotice';
import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  X,
  FileCheck,
  Building2,
  PieChart,
  ShieldCheck,
  UploadCloud,
  Search,
  Filter,
  Download,
  Calendar,
  UserX,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface PayrollItem {
  id: string;
  employeeId: string;
  employeeNumber?: string;
  employeeName: string;
  role: string;
  email: string;
  avatarUrl?: string | null;
  grossMinor: number;
  grossFormatted: string;
  deductionsMinor: number;
  deductionsFormatted: string;
  employerPensionFormatted: string;
  netMinor: number;
  netFormatted: string;
  status: string;
  paymentStatus: string;
  paymentId: string | null;
  paymentReceiptName: string | null;
  paymentReceiptUrl: string | null;
  recipientDecision: string | null;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  primarySubsidiary?: string;
  isOfflineStaff?: boolean;
  isNewStaff?: boolean;
  salaryDeltaMinor?: number;
  salaryDeltaFormatted?: string | null;
  salaryChangeReason?: string | null;
  attendancePenaltyMinor?: number;
  attendancePenaltyFormatted?: string;
  lateArrivalsCount?: number;
  unexcusedAbsenceCount?: number;
  allocations: Array<{
    subsidiaryId: string;
    subsidiaryName: string;
    allocableCostMinor: number;
    allocableCostFormatted: string;
  }>;
}

interface StaffDetail {
  employee: {
    id: string;
    employeeNumber: string;
    legalName: string;
    role: string;
    status: string;
    workEmail: string;
    phone: string | null;
    createdAt: string;
    assignment: { positionName: string; subsidiaryName: string; departmentName: string | null; startsOn: string } | null;
    employment: { agreementType: string; paymentModel: string; status: string; startDate: string; endDate: string | null } | null;
    salary: { grossFormatted: string; grossMinor: number; currency: string; recurrence: string; effectiveFrom: string; version: number; changeType: string | null; changeReason: string | null } | null;
  };
  payrollHistory: Array<{
    id: string;
    periodName: string;
    batchVersion: number;
    batchStatus: string;
    grossFormatted: string;
    deductionsFormatted: string;
    netFormatted: string;
    paymentStatus: string;
    paidAt: string | null;
    bankName: string | null;
    reference: string | null;
    receipt: { fileName: string; fileUrl: string } | null;
    confirmation: { decision: string; note: string | null; confirmedAt: string } | null;
    allocations: Array<{ subsidiaryName: string; amountFormatted: string }>;
  }>;
  permissions: { canEditSalary: boolean };
}

interface PayrollPeriodOption {
  id: string;
  year: number;
  month: number;
  periodName: string;
  lockStatus: string;
  batchStatus: string;
  batchVersion: number;
  totalNetMinor?: number;
  totalNetFormatted?: string | null;
}

interface PaydayRadarInfo {
  paydayDay: number;
  targetPayday: string;
  daysRemaining: number;
  isRadarActive: boolean;
  periodName: string;
  batchStatus: string | null;
}

interface PayrollBatchData {
  period: {
    id: string;
    year: number;
    month: number;
    periodName: string;
    startsOn: string;
    endsOn: string;
    lockStatus: string;
  };
  batch: {
    id: string;
    version: number;
    status: string;
    approvedAt: string | null;
    disbursementAssignee: { id: string; legalName: string; role: string } | null;
    totalGrossMinor: number;
    totalGrossFormatted: string;
    totalNetMinor: number;
    totalNetFormatted: string;
    totalDeductionsFormatted: string;
    employeeCount: number;
    snapshotHash: string | null;
    costAllocation: {
      totalAllocatedFormatted: string;
      allocations: Array<{ subsidiaryId: string; subsidiaryName: string; amountFormatted: string; amountMinor: number }>;
    };
    payrollCostFormatted: string;
  };
  items: PayrollItem[];
  availablePeriods?: PayrollPeriodOption[];
  radar?: PaydayRadarInfo | null;
  permissions: { canApprove: boolean; canRecordPayments: boolean };
}

function PayrollStaffAvatar({ name, url }: { name: string; url?: string | null }) {
  const [retryCount, setRetryCount] = useState(0);
  const initials = name && name.trim().length > 0 ? name.trim().slice(0, 2).toUpperCase() : 'ST';

  useEffect(() => {
    setRetryCount(0);
  }, [url]);

  const cleanUrl = url && retryCount < 3
    ? (() => {
        const base = url.startsWith('/')
          ? url
          : url
              .replace('https://pink-horse-318730.hostingersite.com', '')
              .replace('https://bemserp.work', '');
        if (retryCount === 0) return base;
        const sep = base.includes('?') ? '&' : '?';
        return retryCount === 1 ? `${base}${sep}v=2` : `${base}${sep}v=3&r=${retryCount}`;
      })()
    : null;

  if (cleanUrl) {
    return (
      <img
        key={cleanUrl}
        src={cleanUrl}
        alt={name || 'Staff avatar'}
        onError={() => setRetryCount((c) => c + 1)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  return <span>{initials}</span>;
}

export function PayrollSignOffView({
  businessName,
  userName,
  onNavigate,
  onSelectBusiness
}: {
  businessName: string;
  userName: string;
  onNavigate?: (view: string) => void;
  onSelectBusiness?: (id: string) => void;
}) {
  const [data, setData] = useState<PayrollBatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [signOffModalOpen, setSignOffModalOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [approving, setApproving] = useState(false);
  const [assignees, setAssignees] = useState<Array<{ id: string; legalName: string; role: string }>>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [paymentItem, setPaymentItem] = useState<PayrollItem | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [staffPayments, setStaffPayments] = useState<Array<{ id: string; amountFormatted: string; periodName: string; bankName: string; reference: string; paidAt: string; status: string; receipt: { fileName: string; url: string } | null; confirmation: { decision: string; note: string | null; confirmedAt: string } | null }> | null>(null);
  const [staffIssuePaymentId, setStaffIssuePaymentId] = useState<string | null>(null);
  const [staffIssueNote, setStaffIssueNote] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<PayrollItem | null>(null);
  const [staffDetail, setStaffDetail] = useState<StaffDetail | null>(null);
  const [staffDetailLoading, setStaffDetailLoading] = useState(false);
  const [staffDetailError, setStaffDetailError] = useState<string | null>(null);
  const [salaryEditorOpen, setSalaryEditorOpen] = useState(false);
  const [salaryChangeType, setSalaryChangeType] = useState<'SET_EXACT' | 'ADDITION' | 'DEDUCTION'>('SET_EXACT');
  const [salaryChangeAmount, setSalaryChangeAmount] = useState('');
  const [salaryChangeReason, setSalaryChangeReason] = useState('');
  const [savingSalaryChange, setSavingSalaryChange] = useState(false);
  const [preparingBatch, setPreparingBatch] = useState(false);
  const [markingBatchPaid, setMarkingBatchPaid] = useState(false);

  // Remove from payroll modal state
  const [removeItem, setRemoveItem] = useState<PayrollItem | null>(null);
  const [removeMode, setRemoveMode] = useState<'BATCH_ONLY' | 'PERMANENT'>('BATCH_ONLY');
  const [removeReason, setRemoveReason] = useState('');
  const [removingStaff, setRemovingStaff] = useState(false);

  // Table filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [subsidiaryCostFilter, setSubsidiaryCostFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const availableCostSubsidiaries = React.useMemo(() => {
    const set = new Set<string>();
    (data?.items || []).forEach(item => {
      item.allocations.forEach(a => set.add(a.subsidiaryName));
    });
    return Array.from(set);
  }, [data]);

  const filteredItems = React.useMemo(() => {
    return (data?.items || []).filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.employeeName.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.allocations.some(a => a.subsidiaryName.toLowerCase().includes(q));

      const matchesSub =
        subsidiaryCostFilter === 'ALL' ||
        item.allocations.some(a => a.subsidiaryName === subsidiaryCostFilter);

      const matchesPayment =
        paymentFilter === 'ALL' ||
        (paymentFilter === 'PAID' ? Boolean(item.paymentId) : !item.paymentId);

      return matchesSearch && matchesSub && matchesPayment;
    });
  }, [data?.items, searchQuery, subsidiaryCostFilter, paymentFilter]);

  const openStaffDetail = async (item: PayrollItem) => {
    setSelectedStaff(item);
    setStaffDetail(null);
    setStaffDetailError(null);
    setStaffDetailLoading(true);
    try {
      const response = await fetch(`/api/payroll/staff/${encodeURIComponent(item.employeeId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load staff details.');
      setStaffDetail(result);
    } catch (error) {
      setStaffDetailError(error instanceof Error ? error.message : 'Could not load staff details.');
    } finally {
      setStaffDetailLoading(false);
    }
  };

  const handleSalaryChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStaff) return;
    try {
      setSavingSalaryChange(true);
      const response = await fetch(`/api/staff/${encodeURIComponent(selectedStaff.employeeId)}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeType: salaryChangeType,
          amount: salaryChangeAmount,
          reason: salaryChangeReason.trim() || 'Executive salary review and update',
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update salary.');
      setNotice(`✓ ${result.message} New gross salary: ${result.newGrossFormatted}.`);
      setSalaryEditorOpen(false);
      setSalaryChangeAmount('');
      setSalaryChangeReason('');
      await fetchPayroll(data?.period?.year, data?.period?.month);
      if (staffDetail) {
        await openStaffDetail(selectedStaff);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update salary.');
    } finally {
      setSavingSalaryChange(false);
    }
  };

  const handleMarkBatchPaid = async () => {
    if (!data?.batch?.id) return;
    try {
      setMarkingBatchPaid(true);
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'MARK_BATCH_PAID',
          batchId: data.batch.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not mark batch as paid.');
      setNotice(`✓ ${json.message || 'Payroll batch marked as Paid.'}`);
      if (json.nextPeriod?.year && json.nextPeriod?.month) {
        setSelectedPeriodKey(`${json.nextPeriod.year}-${json.nextPeriod.month}`);
        await fetchPayroll(json.nextPeriod.year, json.nextPeriod.month);
      } else {
        await fetchPayroll(data?.period?.year, data?.period?.month);
      }
    } catch (err: any) {
      setNotice(err?.message || 'Error marking batch as paid.');
    } finally {
      setMarkingBatchPaid(false);
    }
  };

  const handleConfirmRemoveFromPayroll = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!removeItem) return;
    try {
      setRemovingStaff(true);
      const res = await fetch(`/api/payroll/items/${encodeURIComponent(removeItem.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: removeMode,
          reason: removeReason || (removeMode === 'PERMANENT' ? 'Permanently excluded from salary payroll' : 'Excluded from this payroll run'),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not remove staff from payroll.');
      setNotice(`✓ ${json.message}`);
      setRemoveItem(null);
      setRemoveReason('');
      if (selectedStaff?.id === removeItem.id) {
        setSelectedStaff(null);
      }
      await fetchPayroll();
    } catch (err: any) {
      setNotice(err?.message || 'Error removing staff from payroll.');
    } finally {
      setRemovingStaff(false);
    }
  };

  const handleDownloadBankSheetCSV = () => {
    if (!data || !filteredItems || filteredItems.length === 0) {
      setNotice('No items available in the current register to export.');
      return;
    }
    const headers = [
      'Beneficiary Account Name',
      'Beneficiary Bank Name',
      'Beneficiary Account Number',
      'Net Transfer Amount (NGN)',
      'Narration / Description',
      'Staff ID',
      'Subsidiary',
    ];
    const periodText = data?.period?.periodName || 'Monthly Salary';
    const rows = filteredItems.map((item) => [
      `"${(item.accountName || item.employeeName || '').replace(/"/g, '""')}"`,
      `"${(item.bankName || 'MISSING BANK').replace(/"/g, '""')}"`,
      `"${item.accountNumber || 'MISSING ACCOUNT'}"`,
      (item.netMinor / 100).toFixed(2),
      `"BEMS ${periodText} Salary - ${item.employeeName}"`,
      `"${item.employeeNumber || item.employeeId}"`,
      `"${(item.primarySubsidiary || 'BEMS Group').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const periodLabel = data?.period ? `${data.period.year}_${String(data.period.month).padStart(2, '0')}` : 'payroll';
    link.setAttribute('download', `BEMS_Bank_Bulk_Transfer_Sheet_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('');

  const fetchPayroll = async (year?: number, month?: number) => {
    try {
      setLoading(true);
      const params = year && month ? `?year=${year}&month=${month}` : '';
      const res = await fetch(`/api/payroll${params}`, { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (json && !json.error) {
        setData(json);
        if (json.period) {
          setSelectedPeriodKey(`${json.period.year}-${json.period.month}`);
        }
      } else {
        if (json?.availablePeriods) {
          setData((prev) => ({
            ...(prev || {}),
            availablePeriods: json.availablePeriods,
            radar: json.radar,
            period: json.period || null,
            batch: null as any,
            items: [],
            permissions: { canApprove: false, canRecordPayments: false },
          } as any));
        }
        if (res.status === 403) {
          const mine = await fetch('/api/payroll/my-payments', { credentials: 'include', cache: 'no-store' });
          const mineJson = await mine.json();
          if (mineJson.payments) setStaffPayments(mineJson.payments);
          else setNotice(mineJson.error || json.error || 'Could not load payroll payments.');
        } else {
          setNotice(json.error || 'Failed to load payroll data.');
        }
      }
    } catch (e: any) {
      setNotice('Error loading payroll data.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!data || !filteredItems || filteredItems.length === 0) {
      setNotice('No items available in the current register to download.');
      return;
    }
    const headers = [
      'Staff ID',
      'Legal Name',
      'Email',
      'Role',
      'Primary Subsidiary',
      'Gross Salary (NGN)',
      'Statutory Deductions (NGN)',
      'Attendance Deductions (NGN)',
      'Net Take-Home (NGN)',
      'Salary Bank',
      'Account Number',
      'Account Name',
      'Payment Status',
      'Recipient Decision',
    ];

    const rows = filteredItems.map((item) => [
      `"${item.employeeId}"`,
      `"${(item.employeeName || '').replace(/"/g, '""')}"`,
      `"${item.email || ''}"`,
      `"${item.role || ''}"`,
      `"${(item.primarySubsidiary || 'BEMS Group').replace(/"/g, '""')}"`,
      (item.grossMinor / 100).toFixed(2),
      (item.deductionsMinor / 100).toFixed(2),
      ((item.attendancePenaltyMinor || 0) / 100).toFixed(2),
      (item.netMinor / 100).toFixed(2),
      `"${item.bankName || ''}"`,
      `"${item.accountNumber || ''}"`,
      `"${(item.accountName || item.employeeName || '').replace(/"/g, '""')}"`,
      item.paymentStatus,
      item.recipientDecision || 'PENDING',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const periodLabel = data?.period ? `${data.period.year}_${String(data.period.month).padStart(2, '0')}` : 'payroll';
    link.setAttribute('download', `BEMS_Payroll_Register_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrepareBatch = async () => {
    try {
      setPreparingBatch(true);
      setNotice(null);
      let targetYear = data?.period?.year;
      let targetMonth = data?.period?.month;
      if (selectedPeriodKey) {
        const [y, m] = selectedPeriodKey.split('-').map(Number);
        if (y && m) {
          targetYear = y;
          targetMonth = m;
        }
      }
      const res = await fetch('/api/payroll/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ year: targetYear, month: targetMonth }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotice(`✓ ${json.message || 'Payroll batch prepared successfully.'}`);
        await fetchPayroll(targetYear, targetMonth);
      } else {
        setNotice(json.error || 'Could not prepare payroll batch.');
      }
    } catch (e: any) {
      setNotice(e?.message || 'Error preparing payroll batch.');
    } finally {
      setPreparingBatch(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, []);

  const handleApprovePayroll = async () => {
    if (!data?.batch?.id) return;
    if (!selectedAssigneeId) {
      setNotice('Choose who will record the external payroll payments.');
      return;
    }
    try {
      setApproving(true);
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          batchId: data.batch?.id,
          disbursementAssigneeId: selectedAssigneeId,
          approverEmail: 'gmd@bemsgroup.com',
          comments: comments.trim() || `${monthName} approved for external payment processing.`
        })
      });
      const result = await res.json();
      if (!res.ok) {
        setNotice(result.error || 'Failed to approve payroll batch.');
        return;
      }
      setNotice(`${monthName} approved. The payroll register is now locked for external payment processing.`);
      setSignOffModalOpen(false);
      fetchPayroll();
    } catch (e: any) {
      setNotice('Network error approving payroll batch.');
    } finally {
      setApproving(false);
    }
  };

  const handleRecordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data?.batch?.id || !paymentItem) return;
    const form = new FormData(event.currentTarget);
    form.set('batchId', data.batch?.id || '');
    form.set('payrollItemId', paymentItem.id);
    try {
      setRecordingPayment(true);
      const response = await fetch('/api/payroll/record', { method: 'POST', body: form, credentials: 'include' });
      const result = await response.json();
      if (!response.ok) { setNotice(result.error || 'Could not record payroll payment.'); return; }
      setNotice(result.message);
      setPaymentItem(null);
      await fetchPayroll();
    } catch { setNotice('Could not record payroll payment.'); }
    finally { setRecordingPayment(false); }
  };

  const confirmStaffPayment = async (disbursementId: string, decision: 'RECEIVED' | 'NOT_RECEIVED') => {
    const note = staffIssuePaymentId === disbursementId ? staffIssueNote.trim() : '';
    if (decision === 'NOT_RECEIVED' && !note) { setNotice('Add a note explaining the payment issue.'); return; }
    try {
      const response = await fetch('/api/disbursements/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ disbursementId, decision, note }) });
      const result = await response.json();
      if (!response.ok) { setNotice(result.error || 'Could not save your confirmation.'); return; }
      setNotice(decision === 'RECEIVED' ? 'Receipt confirmed.' : 'Payment issue sent to Finance.');
      await fetchPayroll();
      setStaffIssuePaymentId(null);
      setStaffIssueNote('');
    } catch { setNotice('Could not save your confirmation.'); }
  };

  const isPaidBatch = Boolean(data?.batch && data.batch.status === 'PAID');
  const isApproved = Boolean(data?.batch && (data.batch.status === 'APPROVED' || data.batch.status === 'PAID' || data.batch.status === 'DISBURSED' || data.batch.status === 'WALLET_CREDITED'));
  const monthName = data?.period?.periodName || 'Payroll';

  if (loading && !data && !staffPayments) {
    return (
      <div style={{ width: '100%', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <RefreshCw size={28} className="animate-spin" style={{ color: '#ea580c' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Loading Hybrid Payroll records…</span>
      </div>
    );
  }

  if (staffPayments) return <div style={{ width: '100%', minHeight: '100%', color: '#0f172a' }}>
    <div style={{ marginBottom: 16 }}><span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '.12em' }}>PAYROLL</span><h1 style={{ margin: '4px 0', fontSize: 20 }}>My salary payments</h1><p style={{ margin: 0, color: '#64748b', fontSize: 11 }}>Review the transfer receipt and confirm whether the salary arrived in your account.</p></div>
    {notice && <div style={{ marginBottom: 12, padding: 10, borderRadius: 7, background: '#eff6ff', color: '#1e40af', fontSize: 11 }}>{notice}</div>}
    {staffPayments.length === 0 ? <div style={{ padding: 22, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, color: '#64748b', fontSize: 11 }}>There are no recorded payroll payments for your account yet.</div> : staffPayments.map(payment => <div key={payment.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div><strong style={{ fontSize: 12 }}>{payment.periodName} · {payment.amountFormatted}</strong><div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>{payment.bankName} · Ref {payment.reference} · {new Date(payment.paidAt).toLocaleDateString()}</div>{payment.receipt && <a href={payment.receipt.url} style={{ display: 'inline-block', color: '#ea580c', fontSize: 10, marginTop: 5 }}>View {payment.receipt.fileName}</a>}{payment.confirmation && <div style={{ color: payment.confirmation.decision === 'RECEIVED' ? '#059669' : '#b91c1c', fontSize: 10, marginTop: 4 }}>{payment.confirmation.decision === 'RECEIVED' ? 'You confirmed receipt' : 'You reported a payment issue'}{payment.confirmation.note ? ` · ${payment.confirmation.note}` : ''}</div>}</div>
      {!payment.confirmation && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'end' }}>
        <button onClick={() => confirmStaffPayment(payment.id, 'RECEIVED')} style={{ ...payrollButtonStyle, background: '#059669', color: '#fff', border: '1px solid #059669' }}>I received it</button>
        {staffIssuePaymentId === payment.id ? <><input aria-label="Explain payment issue" value={staffIssueNote} onChange={e => setStaffIssueNote(e.target.value)} placeholder="What is wrong?" style={{ ...payrollInputStyle, width: 150, margin: 0 }}/><button onClick={() => confirmStaffPayment(payment.id, 'NOT_RECEIVED')} style={{ ...payrollButtonStyle, background: '#fff', color: '#b91c1c', border: '1px solid #fecaca' }}>Send issue</button></> : <button onClick={() => setStaffIssuePaymentId(payment.id)} style={{ ...payrollButtonStyle, background: '#fff', color: '#b91c1c', border: '1px solid #fecaca' }}>Report issue</button>}
      </div>}
    </div>)}
  </div>;

  return (
    <div style={{ width: '100%', minHeight: '100%', color: '#0f172a' }}>
      <WalletFlowNotice />
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            PAYROLL & COST SPLITS · SECTION 38 / 42
          </span>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '3px 0 2px', letterSpacing: '-0.3px', color: '#0f172a' }}>
            Hybrid Payroll Sign-off & Intercompany Allocation
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
            Review the prepared payroll, approve the register, and check actual employee cost allocations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Historical Period Archive Selector */}
          {data?.availablePeriods && data.availablePeriods.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #ea580c', borderRadius: 6, padding: '3px 10px', boxShadow: '0 1px 3px rgba(234,88,12,0.1)' }}>
              <Calendar size={12} style={{ color: '#ea580c' }} />
              <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Select Month:
              </span>
              <select
                aria-label="Select Historical Payroll Period"
                value={selectedPeriodKey || (data?.period ? `${data.period.year}-${data.period.month}` : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPeriodKey(val);
                  const [y, m] = val.split('-').map(Number);
                  if (y && m) fetchPayroll(y, m);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#0f172a',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '4px 2px',
                }}
              >
                {(data?.availablePeriods || []).map((p) => (
                  <option key={p.id} value={`${p.year}-${p.month}`}>
                    {p.periodName} — {p.batchStatus === 'PAID' ? `✓ Disbursed${p.totalNetFormatted ? ` (${p.totalNetFormatted})` : ''}` : p.batchStatus === 'APPROVED' ? 'Approved' : p.batchStatus === 'SUBMITTED' ? 'Active / Next Run' : 'Not Prepared'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => {
              if (selectedPeriodKey) {
                const [y, m] = selectedPeriodKey.split('-').map(Number);
                fetchPayroll(y, m);
              } else {
                fetchPayroll();
              }
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: '10px',
              fontWeight: 600,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handlePrepareBatch}
            disabled={preparingBatch}
            style={{
              padding: data?.batch ? '6px 11px' : '6px 14px',
              borderRadius: '6px',
              border: data?.batch ? '1px solid #fed7aa' : '1px solid #ea580c',
              background: data?.batch ? '#fff7ed' : 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: data?.batch ? '#c2410c' : '#fff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: preparingBatch ? 'wait' : 'pointer',
              boxShadow: data?.batch ? 'none' : '0 2px 8px rgba(234, 88, 12, 0.3)',
            }}
          >
            <RefreshCw size={11} className={preparingBatch ? 'animate-spin' : ''} />
            {preparingBatch
              ? 'Regenerating...'
              : data?.batch
                ? 'Regenerate Batch'
                : 'Prepare Monthly Payroll Batch ⚡'}
          </button>

          {data?.batch && data.batch.status !== 'PAID' && data?.permissions?.canApprove && (
            <button
              onClick={handleMarkBatchPaid}
              disabled={markingBatchPaid}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #059669',
                background: '#059669',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: markingBatchPaid ? 'wait' : 'pointer',
              }}
            >
              <CheckCircle2 size={12} />
              {markingBatchPaid ? 'Marking Paid...' : 'Mark Batch as Paid ✓'}
            </button>
          )}

          {data?.batch?.status === 'SUBMITTED' && data?.permissions?.canApprove ? (
            <button
              onClick={async () => {
                setSignOffModalOpen(true);
                try {
                  const response = await fetch('/api/payroll/assignees', { credentials: 'include', cache: 'no-store' });
                  const result = await response.json();
                  if (response.ok) {
                    setAssignees(result.employees || []);
                    setSelectedAssigneeId(result.current?.id || '');
                  } else setNotice(result.error || 'Could not load payment assignees.');
                } catch { setNotice('Could not load payment assignees.'); }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--brand-primary, #0d8a70)',
                background: 'var(--brand-gradient, var(--brand-primary, #0d8a70))',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)'
              }}
            >
              <FileCheck size={12} />
              Approve {monthName} ✍️
            </button>
          ) : (
            <span style={{
              padding: '5px 10px',
              borderRadius: '6px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CheckCircle2 size={12} />
              {isPaidBatch ? 'Paid · Disbursed' : isApproved ? `Approved · ${data?.batch?.disbursementAssignee?.legalName || 'register locked'}` : `Batch ${data?.batch?.status || 'not ready'}`}
            </span>
          )}
        </div>
      </div>

      {/* MONTHLY SALARY RECORDS & PERIOD SWITCHER STRIP */}
      {data?.availablePeriods && data.availablePeriods.length > 0 && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={14} style={{ color: '#ea580c' }} />
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Monthly Salary Runs &amp; Disbursed History:
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {data.availablePeriods.map((p) => {
              const key = `${p.year}-${p.month}`;
              const isCurrentSelected = (selectedPeriodKey || (data?.period ? `${data.period.year}-${data.period.month}` : '')) === key;
              const isPaid = p.batchStatus === 'PAID';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPeriodKey(key);
                    fetchPayroll(p.year, p.month);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isCurrentSelected
                      ? '1.5px solid #ea580c'
                      : isPaid
                        ? '1px solid #a7f3d0'
                        : '1px solid #cbd5e1',
                    background: isCurrentSelected
                      ? '#fff7ed'
                      : isPaid
                        ? '#f0fdf4'
                        : '#f8fafc',
                    color: isCurrentSelected
                      ? '#c2410c'
                      : isPaid
                        ? '#047857'
                        : '#334155',
                    fontSize: '10.5px',
                    fontWeight: isCurrentSelected ? 800 : 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isCurrentSelected ? '0 2px 6px rgba(234,88,12,0.14)' : 'none',
                  }}
                >
                  <span>{p.periodName}</span>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '5px',
                      background: isPaid ? '#d1fae5' : '#ffedd5',
                      color: isPaid ? '#065f46' : '#9a3412',
                    }}
                  >
                    {isPaid
                      ? `✓ Paid${p.totalNetFormatted ? ` · ${p.totalNetFormatted}` : ''}`
                      : 'Active / Next Run'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {notice && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          background: notice.includes('No payroll batch') ? '#fffbeb' : '#f0fdf4',
          border: notice.includes('No payroll batch') ? '1px solid #fde68a' : '1px solid #bbf7d0',
          color: notice.includes('No payroll batch') ? '#92400e' : '#15803d',
          fontSize: '12px',
          fontWeight: 600,
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{notice}</span>
            {notice.includes('No payroll batch') && !data && (
              <button
                onClick={handlePrepareBatch}
                disabled={preparingBatch}
                style={{
                  padding: '4px 10px',
                  borderRadius: '5px',
                  border: 'none',
                  background: '#ea580c',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {preparingBatch ? 'Generating...' : 'Click to Prepare Batch Now ⚡'}
              </button>
            )}
          </div>
          <button onClick={() => setNotice(null)} style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 7-DAY PAYDAY RADAR ALERT BANNER */}
      {data?.radar?.isRadarActive && (
        <div style={{
          marginBottom: '14px',
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          border: '1px solid #fdba74',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: '#ea580c',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 13,
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
            }}>
              3rd
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#9a3412' }}>
                {data?.radar?.daysRemaining === 0
                  ? '🚨 Payday is Today! (3rd of the Month)'
                  : `Upcoming Payday in ${data?.radar?.daysRemaining ?? '—'} Day${data?.radar?.daysRemaining === 1 ? '' : 's'} (Scheduled for the 3rd)`}
              </div>
              <div style={{ fontSize: 11, color: '#7c2d12', marginTop: 2 }}>
                Group policy schedules salary disbursement on the 3rd of each calendar month. Complete GMD sign-off for {data?.radar?.periodName || 'the current period'} so payment execution can proceed on time.
              </div>
            </div>
          </div>
          {data?.batch?.status === 'SUBMITTED' && (
            <span style={{ fontSize: 11, fontWeight: 750, color: '#ea580c', background: '#fff', padding: '5px 12px', borderRadius: 6, border: '1px solid #fed7aa', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              ⚡ Ready for GMD Sign-off
            </span>
          )}
        </div>
      )}

      {/* TOP 4 KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{
          background: 'var(--brand-gradient, linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%))',
          borderRadius: '10px',
          padding: '12px 14px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box',
          boxShadow: '0 8px 20px var(--brand-shadow-color, rgba(37, 99, 235, 0.22))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(255, 255, 255, 0.85)', textTransform: 'uppercase' }}>
              GROSS RUN-RATE
            </span>
            <Users size={12} color="#fed7aa" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1 }}>
              {data?.batch?.totalGrossFormatted || '—'}
            </div>
            <div style={{ fontSize: '9px', color: '#ffedd5', marginTop: '2px' }}>{monthName}</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              LATENESS DEDUCTIONS
            </span>
            <PieChart size={12} color="#d97706" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706', lineHeight: 1.1 }}>
              {data?.batch?.totalDeductionsFormatted || '—'}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Zero tax policy · Lateness penalties only</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              NET PAYROLL
            </span>
            <CheckCircle2 size={12} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669', lineHeight: 1.1 }}>
              {data?.batch?.totalNetFormatted || '—'}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Amount due to employees</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              ACTIVE HEADCOUNT
            </span>
            <ShieldCheck size={12} color="var(--brand-primary, #0d8a70)" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand-primary, #0d8a70)', lineHeight: 1.1 }}>
              {data?.items?.length ?? '—'} Staff
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>In this payroll batch</div>
          </div>
        </div>
      </div>


      {/* PAYROLL COST ALLOCATION SUMMARY */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              PAYROLL COST ALLOCATION
            </span>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>
              Allocation recorded for this batch
            </h4>
          </div>
          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--brand-primary, #0d8a70)', background: 'var(--brand-tint, rgba(13, 138, 112, 0.1))', padding: '3px 8px', borderRadius: '4px' }}>
            {data?.batch?.costAllocation?.totalAllocatedFormatted || 'No allocation recorded'}
          </span>
        </div>

        {data?.batch?.costAllocation?.allocations?.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '10px', color: '#334155', marginTop: '10px' }}>
          {(data?.batch?.costAllocation?.allocations || []).map((allocation) => <div key={allocation.subsidiaryId} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--brand-primary, #0d8a70)' }} />
            <strong>{allocation.subsidiaryName}</strong>: {allocation.amountFormatted}
          </div>)}
        </div> : <p style={{ fontSize: '10px', color: '#64748b', margin: '8px 0 0' }}>This batch has no recorded subsidiary cost allocations.</p>}
      </div>

      {/* PAYROLL REGISTER TABLE */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {monthName} Register · Version {data?.batch?.version ?? '—'}
            </h3>
            <span style={{ fontSize: '9px', color: '#64748b' }}>
              Individual gross-to-net amounts, attendance deductions, and intercompany allocations
            </span>
          </div>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '10px',
            background: isApproved ? '#ecfdf5' : '#fef3c7',
            color: isApproved ? '#059669' : '#b45309'
          }}>
            Status: {data?.batch?.status || 'SUBMITTED'}
          </span>
        </div>

        {/* Table Multi-Filter Toolbar */}
        <div style={{
          padding: '8px 12px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', minWidth: 200, flex: '1 1 200px' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search staff name, role, email, or subsidiary…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 26px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 10,
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {availableCostSubsidiaries.length > 1 && (
              <select
                value={subsidiaryCostFilter}
                onChange={(e) => setSubsidiaryCostFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 10,
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#334155',
                }}
              >
                <option value="ALL">All Cost Entities ({availableCostSubsidiaries.length})</option>
                {availableCostSubsidiaries.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            )}

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 10,
                fontWeight: 600,
                background: '#ffffff',
                color: '#334155',
              }}
            >
              <option value="ALL">All Payout Statuses</option>
              <option value="PAID">Paid / Slip Attached</option>
              <option value="UNPAID">Pending Transfer</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {filteredItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadBankSheetCSV}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: '1px solid #ea580c',
                    background: '#fff7ed',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#c2410c',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <Download size={12} style={{ color: '#ea580c' }} />
                  <span>Export Bank Bulk-Transfer Sheet (CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#0f172a',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <Download size={12} style={{ color: '#0d8a70' }} />
                  <span>Download Register (CSV)</span>
                </button>
              </>
            )}

            {(searchQuery || subsidiaryCostFilter !== 'ALL' || paymentFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSubsidiaryCostFilter('ALL');
                  setPaymentFilter('ALL');
                }}
                style={{
                  border: 0,
                  background: '#e2e8f0',
                  color: '#475569',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
            Loading payroll register…
          </div>
        ) : !data || (data?.items || []).length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
            No payroll items found for current batch.
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
            No employee records match the active filter criteria.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`View payroll and staff details for ${item.employeeName}`}
                onClick={() => openStaffDetail(item)}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openStaffDetail(item);
                  }
                }}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#fff7ed',
                    color: '#ea580c',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '10px',
                    flexShrink: 0,
                    border: '1px solid #fed7aa',
                    overflow: 'hidden',
                  }}>
                    <PayrollStaffAvatar name={item.employeeName} url={item.avatarUrl} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span>{item.employeeName}</span>
                      {item.isNewStaff && (
                        <span style={{ fontSize: '8.5px', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                          🆕 New Staff
                        </span>
                      )}
                      {item.isOfflineStaff && (
                        <span style={{ fontSize: '8.5px', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                          📵 Offline Staff
                        </span>
                      )}
                      {item.salaryDeltaFormatted && (
                        <span
                          title={item.salaryChangeReason || 'Salary changed from previous run'}
                          style={{
                            fontSize: '8.5px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: (item.salaryDeltaMinor || 0) > 0 ? '#ecfdf5' : '#fef2f2',
                            color: (item.salaryDeltaMinor || 0) > 0 ? '#047857' : '#b91c1c',
                            border: `1px solid ${(item.salaryDeltaMinor || 0) > 0 ? '#a7f3d0' : '#fecaca'}`,
                          }}
                        >
                          {(item.salaryDeltaMinor || 0) > 0 ? '↑' : '↓'} {item.salaryDeltaFormatted}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px' }}>
                      {item.role} · {item.email}
                    </div>
                    {item.allocations.length > 0 && <div style={{ fontSize: '9px', color: '#64748b', marginTop: '3px' }}>
                      {item.allocations.map(a => `${a.subsidiaryName} · ${a.allocableCostFormatted}`).join('  /  ')}
                    </div>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>Gross</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>{item.grossFormatted}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>Lateness Deductions</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#d97706' }}>-{item.deductionsFormatted}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>Net Payout</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>{item.netFormatted}</div>
                  </div>

                  {isApproved && data?.permissions?.canRecordPayments && item.paymentStatus === 'UNPAID' && !isPaidBatch ? (
                    <button onClick={(event) => { event.stopPropagation(); setPaymentItem(item); }} style={{ padding: '6px 9px', borderRadius: '6px', border: '1px solid #ea580c', background: '#fff7ed', color: '#ea580c', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>Record payment</button>
                  ) : (item.paymentStatus === 'PAID' || isPaidBatch) ? (
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', fontSize: '9px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      ✓ Paid
                    </span>
                  ) : (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: item.paymentStatus === 'RECIPIENT_CONFIRMED' ? '#059669' : item.paymentStatus === 'AWAITING_RECIPIENT_CONFIRMATION' ? '#b45309' : '#64748b', whiteSpace: 'nowrap' }}>
                      {item.paymentStatus === 'RECIPIENT_CONFIRMED' ? 'Staff confirmed' : item.paymentStatus === 'AWAITING_RECIPIENT_CONFIRMATION' ? 'Awaiting staff' : item.paymentStatus === 'RECIPIENT_REPORTED_ISSUE' ? 'Staff reported issue' : item.allocations.length ? `${item.allocations.length} allocations` : 'No allocation'}
                      {item.paymentReceiptName && item.paymentReceiptUrl && <> · <a href={item.paymentReceiptUrl} onClick={event => event.stopPropagation()} style={{ color: '#ea580c' }}>Receipt</a></>}
                    </span>
                  )}

                  {data?.permissions?.canApprove && (
                    <button
                      type="button"
                      title="Edit staff gross salary"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedStaff(item);
                        setSalaryChangeType('SET_EXACT');
                        setSalaryChangeAmount(String(Math.round((item.grossMinor || 0) / 100)));
                        setSalaryChangeReason('');
                        setSalaryEditorOpen(true);
                      }}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid #fed7aa',
                        background: '#fff7ed',
                        color: '#c2410c',
                        fontSize: '9px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>✎ Edit Salary</span>
                    </button>
                  )}

                  {data?.permissions?.canApprove && (
                    <button
                      type="button"
                      title="Remove staff from salary payment"
                      onClick={(event) => {
                        event.stopPropagation();
                        setRemoveItem(item);
                        setRemoveMode('BATCH_ONLY');
                        setRemoveReason('');
                      }}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        background: '#fff5f5',
                        color: '#dc2626',
                        fontSize: '9px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <UserX size={11} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EXECUTIVE SIGN-OFF MODAL */}
      {signOffModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 26, 66, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 999,
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            width: 'min(460px, 100%)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div>
                <span style={{ fontSize: '8px', fontWeight: 800, color: '#ea580c', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  GMD EXECUTIVE AUTHORIZATION
                </span>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>
                  Approve {monthName}
                </h3>
              </div>
              <button
                onClick={() => setSignOffModalOpen(false)}
                style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Total Gross Payroll:</span>
                  <span style={{ fontWeight: 700 }}>{data?.batch?.totalGrossFormatted || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Total Net Cash Outflow:</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>{data?.batch?.totalNetFormatted || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Staff in register:</span>
                  <span>{data?.items?.length || 0} employees</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Assign payment recording to
                </label>
                <select
                  value={selectedAssigneeId}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '8px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '11px', color: '#0f172a' }}
                >
                  <option value="">Choose a Finance user or executive</option>
                  {assignees.map((person) => <option key={person.id} value={person.id}>{person.legalName} · {person.role.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Executive Approval Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved for bank transfer recording."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setSignOffModalOpen(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={approving}
                  onClick={handleApprovePayroll}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--brand-primary, #0d8a70)',
                    background: 'var(--brand-gradient, var(--brand-primary, #0d8a70))',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: approving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px var(--brand-shadow-color, rgba(0, 0, 0, 0.25))',
                  }}
                >
                  {approving ? 'Signing off…' : 'Confirm Executive Sign-off ✍️'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {paymentItem && <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(6,26,66,.62)', display: 'grid', placeItems: 'center', padding: 16 }}>
        <form onSubmit={handleRecordPayment} style={{ width: 'min(480px,100%)', background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 18px 48px rgba(0,0,0,.24)', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div><div style={{ fontSize: 9, fontWeight: 800, color: 'var(--brand-primary, #0d8a70)', letterSpacing: '.08em' }}>RECORD EXTERNAL TRANSFER</div><h3 style={{ margin: '4px 0', fontSize: 15 }}>{paymentItem.employeeName} · {paymentItem.netFormatted}</h3><p style={{ margin: 0, color: '#64748b', fontSize: 10 }}>Record the completed bank transfer and attach its actual receipt. The employee will be asked to confirm receipt.</p></div>
            <button type="button" onClick={() => setPaymentItem(null)} aria-label="Close" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}><X size={16}/></button>
          </div>
          <label style={{ fontSize: 10, fontWeight: 700 }}>Transfer reference<input name="externalReference" required style={payrollInputStyle}/></label>
          <label style={{ fontSize: 10, fontWeight: 700 }}>Paying bank<input name="bankName" required style={payrollInputStyle}/></label>
          <label style={{ fontSize: 10, fontWeight: 700 }}>Employee’s receiving bank<input name="beneficiaryBank" required style={payrollInputStyle}/></label>
          <label style={{ fontSize: 10, fontWeight: 700 }}>Employee’s account number<input name="beneficiaryAccount" required style={payrollInputStyle}/></label>
          <label style={{ fontSize: 10, fontWeight: 700 }}>Bank transfer receipt (PDF, PNG or JPG)<input name="receipt" type="file" accept="application/pdf,image/png,image/jpeg" required style={{ ...payrollInputStyle, padding: 7 }}/></label>
          <div style={{ display: 'flex', justifyContent: 'end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => setPaymentItem(null)} style={{ ...payrollButtonStyle, background: '#fff', color: '#475569', border: '1px solid #dbe3ef' }}>Cancel</button>
            <button disabled={recordingPayment} type="submit" style={{ ...payrollButtonStyle, background: 'var(--brand-gradient, var(--brand-primary, #0d8a70))', color: '#fff', border: '1px solid var(--brand-primary, #0d8a70)' }}><UploadCloud size={13}/> {recordingPayment ? 'Recording…' : 'Record payment & notify staff'}</button>
          </div>
        </form>
      </div>}

      {selectedStaff && (staffDetailLoading || staffDetailError || staffDetail) && <div
        onClick={event => { if (event.target === event.currentTarget) { setSelectedStaff(null); setStaffDetail(null); } }}
        style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(6,26,66,.62)', display: 'grid', placeItems: 'center', padding: 16 }}
      >
        <section role="dialog" aria-modal="true" aria-labelledby="staff-detail-title" style={{ width: 'min(760px, 100%)', maxHeight: 'min(88vh, 820px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #dbe3ef', borderRadius: 12, boxShadow: '0 22px 60px rgba(0,0,0,.28)' }}>
          <header style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: 'var(--brand-tint, rgba(13, 138, 112, 0.1))', color: 'var(--brand-primary, #0d8a70)', fontSize: 15, fontWeight: 800 }}>{selectedStaff.employeeName.charAt(0)}</div>
              <div style={{ minWidth: 0 }}>
                <h2 id="staff-detail-title" style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 750 }}>{staffDetail?.employee.legalName || selectedStaff.employeeName}</h2>
                <div style={{ marginTop: 3, color: '#64748b', fontSize: 10 }}>{(staffDetail?.employee.role || selectedStaff.role).replace(/_/g, ' ')} · {staffDetail?.employee.employeeNumber || 'Loading staff profile…'}</div>
              </div>
            </div>
            <button type="button" aria-label="Close staff details" onClick={() => setSelectedStaff(null)} style={{ width: 30, height: 30, border: '1px solid #dbe3ef', borderRadius: 7, background: '#fff', color: '#64748b', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={15}/></button>
          </header>

          <div style={{ overflowY: 'auto', padding: 16 }}>
            {staffDetailLoading ? <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Loading staff profile and payment history…</div> : staffDetailError ? <div role="alert" style={{ padding: 12, borderRadius: 8, background: '#fff7ed', color: '#b45309', fontSize: 11 }}>{staffDetailError}</div> : staffDetail && <>
              <div style={{ padding: '11px 12px', marginBottom: 10, border: '1px solid var(--brand-border, rgba(13, 138, 112, 0.25))', borderRadius: 8, background: 'var(--brand-tint, rgba(13, 138, 112, 0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ color: 'var(--brand-primary, #0d8a70)', fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>Current gross salary</div>
                  <div style={{ marginTop: 3, color: '#0f172a', fontSize: 16, fontWeight: 800 }}>{staffDetail.employee.salary?.grossFormatted || 'No active salary record'}{staffDetail.employee.salary && <span style={{ marginLeft: 5, color: '#64748b', fontSize: 10, fontWeight: 600 }}>· {staffDetail.employee.salary.recurrence.toLowerCase()}</span>}</div>
                  {staffDetail.employee.salary?.changeReason && <div style={{ marginTop: 3, color: '#475569', fontSize: 9 }}>Latest change: {staffDetail.employee.salary.changeReason}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {staffDetail.permissions.canEditSalary && (
                    <button
                      type="button"
                      onClick={() => {
                        setSalaryChangeType('SET_EXACT');
                        const currentNaira = Math.round(((staffDetail.employee.salary?.grossMinor ?? selectedStaff.grossMinor) || 0) / 100);
                        setSalaryChangeAmount(currentNaira > 0 ? String(currentNaira) : '');
                        setSalaryChangeReason('');
                        setSalaryEditorOpen(true);
                      }}
                      style={{
                        ...payrollButtonStyle,
                        flexShrink: 0,
                        background: '#fff',
                        color: 'var(--brand-primary, #0d8a70)',
                        border: '1px solid var(--brand-border, #cbd5e1)',
                        cursor: 'pointer',
                      }}
                    >
                      Edit salary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveItem(selectedStaff);
                      setRemoveMode('BATCH_ONLY');
                      setRemoveReason('');
                    }}
                    style={{
                      ...payrollButtonStyle,
                      flexShrink: 0,
                      background: '#fff5f5',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      cursor: 'pointer',
                    }}
                  >
                    <UserX size={12} />
                    Remove from Payroll
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 8, marginBottom: 14 }}>
                {[
                  ['Work email', staffDetail.employee.workEmail],
                  ['Phone', staffDetail.employee.phone || 'Not provided'],
                  ['Staff status', staffDetail.employee.status.replace(/_/g, ' ')],
                  ['Position', staffDetail.employee.assignment?.positionName || staffDetail.employee.role.replace(/_/g, ' ')],
                  ['Department', staffDetail.employee.assignment?.departmentName || 'Not assigned'],
                  ['Business unit', staffDetail.employee.assignment?.subsidiaryName || 'Not assigned'],
                  ['Employment', staffDetail.employee.employment?.agreementType.replace(/_/g, ' ') || 'No active agreement'],
                  ['Pay arrangement', staffDetail.employee.employment?.paymentModel.replace(/_/g, ' ') || 'Not provided'],
                  ['Employment start', staffDetail.employee.employment?.startDate ? new Date(staffDetail.employee.employment.startDate).toLocaleDateString() : 'Not recorded']
                ].map(([label, value]) => <div key={label} style={{ minWidth: 0, padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                  <div style={{ color: '#64748b', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                  <div style={{ color: '#1e293b', fontSize: 11, fontWeight: 600, marginTop: 4, overflowWrap: 'anywhere' }}>{value}</div>
                </div>)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a', fontSize: 13 }}>Payroll & payment history</h3>
                  <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 10 }}>Recorded payroll runs, transfers, receipts and staff confirmations.</p>
                </div>
                <span style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 10 }}>{staffDetail.payrollHistory.length} records</span>
              </div>

              {staffDetail.payrollHistory.length === 0 ? <div style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: 11 }}>No payroll history is recorded for this staff member.</div> : <div style={{ display: 'grid', gap: 8 }}>
                {staffDetail.payrollHistory.map(history => <article key={history.id} style={{ padding: 11, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                    <strong style={{ color: '#1e293b', fontSize: 11 }}>{history.periodName} · Run {history.batchVersion}</strong>
                    <span style={{ padding: '3px 7px', borderRadius: 12, background: history.paymentStatus === 'RECIPIENT_CONFIRMED' || history.paymentStatus === 'PAID' ? '#ecfdf5' : history.paymentStatus === 'UNPAID' ? '#f1f5f9' : '#fffbeb', color: history.paymentStatus === 'RECIPIENT_CONFIRMED' || history.paymentStatus === 'PAID' ? '#047857' : history.paymentStatus === 'UNPAID' ? '#475569' : '#b45309', fontSize: 9, fontWeight: 700 }}>{history.paymentStatus.replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[['Gross', history.grossFormatted], ['Deductions', history.deductionsFormatted], ['Net pay', history.netFormatted]].map(([label, value]) => <div key={label}>
                      <div style={{ color: '#64748b', fontSize: 9 }}>{label}</div><div style={{ color: '#1e293b', fontSize: 10, fontWeight: 700, marginTop: 2 }}>{value}</div>
                    </div>)}
                  </div>
                  {history.paidAt && <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid #f1f5f9', color: '#475569', fontSize: 10 }}>
                    Paid {new Date(history.paidAt).toLocaleDateString()} · {history.bankName || 'Bank not recorded'}{history.reference ? ` · Ref ${history.reference}` : ''}
                  </div>}
                  {history.allocations.length > 0 && <div style={{ marginTop: 7, color: '#64748b', fontSize: 9 }}>{history.allocations.map(allocation => `${allocation.subsidiaryName}: ${allocation.amountFormatted}`).join(' · ')}</div>}
                  {history.confirmation && <div style={{ marginTop: 7, color: history.confirmation.decision === 'RECEIVED' ? '#047857' : '#b91c1c', fontSize: 10 }}>
                    Staff {history.confirmation.decision === 'RECEIVED' ? 'confirmed receipt' : 'reported an issue'}{history.confirmation.note ? ` · ${history.confirmation.note}` : ''}
                  </div>}
                  {history.receipt && <a href={history.receipt.fileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 7, color: '#ea580c', fontSize: 10, fontWeight: 600 }}>View receipt · {history.receipt.fileName}</a>}
                </article>)}
              </div>}
            </>}
          </div>
        </section>
      </div>}

      {salaryEditorOpen && selectedStaff && <div
        onClick={event => { if (event.target === event.currentTarget && !savingSalaryChange) setSalaryEditorOpen(false); }}
        style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(6,26,66,.72)', display: 'grid', placeItems: 'center', padding: 16 }}
      >
        <form onSubmit={handleSalaryChange} role="dialog" aria-modal="true" aria-labelledby="salary-change-title" style={{ width: 'min(440px, 100%)', display: 'grid', gap: 12, padding: 18, border: '1px solid #dbe3ef', borderRadius: 12, background: '#fff', boxShadow: '0 22px 60px rgba(0,0,0,.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
            <div><div style={{ color: 'var(--brand-primary, #0d8a70)', fontSize: 9, fontWeight: 800, letterSpacing: '.08em' }}>GMD SALARY CHANGE</div><h3 id="salary-change-title" style={{ margin: '4px 0 0', color: '#0f172a', fontSize: 15 }}>{selectedStaff.employeeName}</h3><p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 10 }}>Current gross: {staffDetail?.employee.salary?.grossFormatted || selectedStaff.grossFormatted} per {(staffDetail?.employee.salary?.recurrence || 'monthly').toLowerCase()}.</p></div>
            <button type="button" disabled={savingSalaryChange} onClick={() => setSalaryEditorOpen(false)} aria-label="Close salary editor" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}><X size={16}/></button>
          </div>
          <label style={{ color: '#334155', fontSize: 10, fontWeight: 700 }}>Change type
            <select
              value={salaryChangeType}
              onChange={event => {
                const nextType = event.target.value as 'SET_EXACT' | 'ADDITION' | 'DEDUCTION';
                setSalaryChangeType(nextType);
                if (nextType === 'SET_EXACT') {
                  const currentNaira = Math.round(((staffDetail?.employee.salary?.grossMinor ?? selectedStaff.grossMinor) || 0) / 100);
                  setSalaryChangeAmount(currentNaira > 0 ? String(currentNaira) : '');
                } else {
                  setSalaryChangeAmount('');
                }
              }}
              style={{ ...payrollInputStyle, background: '#fff' }}
            >
              <option value="SET_EXACT">Set exact monthly gross salary (₦)</option>
              <option value="ADDITION">Add to gross salary (₦)</option>
              <option value="DEDUCTION">Deduct from gross salary (₦)</option>
            </select>
          </label>
          <label style={{ color: '#334155', fontSize: 10, fontWeight: 700 }}>
            {salaryChangeType === 'SET_EXACT' ? 'New monthly gross salary (₦)' : 'Amount (₦)'}
            <input type="number" min="0.01" step="0.01" required value={salaryChangeAmount} onChange={event => setSalaryChangeAmount(event.target.value)} placeholder={salaryChangeType === 'SET_EXACT' ? 'Enter exact monthly gross salary in NGN' : 'Enter the amount to add or deduct'} style={payrollInputStyle}/>
          </label>
          <label style={{ color: '#334155', fontSize: 10, fontWeight: 700 }}>Reason for this change (Optional)
            <textarea maxLength={1000} value={salaryChangeReason} onChange={event => setSalaryChangeReason(event.target.value)} placeholder="e.g. Executive salary review and adjustment (optional)" rows={3} style={{ ...payrollInputStyle, resize: 'vertical' }}/>
          </label>
          <div style={{ padding: '9px 10px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 10 }}>The new salary persists immediately across the Staff Dossier and active Payroll Register.</div>
          <div style={{ display: 'flex', justifyContent: 'end', gap: 8 }}>
            <button type="button" disabled={savingSalaryChange} onClick={() => setSalaryEditorOpen(false)} style={{ ...payrollButtonStyle, background: '#fff', color: '#475569', border: '1px solid #dbe3ef' }}>Cancel</button>
            <button type="submit" disabled={savingSalaryChange} style={{ ...payrollButtonStyle, background: 'var(--brand-gradient, var(--brand-primary, #0d8a70))', color: '#fff', border: '1px solid var(--brand-primary, #0d8a70)', opacity: savingSalaryChange ? .7 : 1 }}>{savingSalaryChange ? 'Saving…' : 'Save salary change'}</button>
          </div>
        </form>
      </div>}

      {/* REMOVE FROM PAYROLL MODAL */}
      {removeItem && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !removingStaff) setRemoveItem(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1004,
            background: 'rgba(6,26,66,.72)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <form
            onSubmit={handleConfirmRemoveFromPayroll}
            style={{
              width: 'min(460px, 100%)',
              background: '#fff',
              borderRadius: 14,
              padding: 20,
              border: '1px solid #fee2e2',
              boxShadow: '0 24px 64px rgba(220, 38, 38, 0.18)',
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#dc2626', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    PAYROLL REGISTER EXCLUSION
                  </div>
                  <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                    Remove {removeItem.employeeName}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                disabled={removingStaff}
                onClick={() => setRemoveItem(null)}
                style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, fontSize: 11, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ color: '#64748b' }}>Role: </span>
                <strong style={{ color: '#0f172a' }}>{removeItem.role}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Current Net: </span>
                <strong style={{ color: '#dc2626' }}>{removeItem.netFormatted}</strong>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 750, color: '#334155', display: 'block', marginBottom: 6 }}>
                Choose Removal Scope:
              </label>
              <div style={{ display: 'grid', gap: 8 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1.5px solid ${removeMode === 'BATCH_ONLY' ? '#ea580c' : '#e2e8f0'}`,
                    background: removeMode === 'BATCH_ONLY' ? '#fff7ed' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="removeMode"
                    value="BATCH_ONLY"
                    checked={removeMode === 'BATCH_ONLY'}
                    onChange={() => setRemoveMode('BATCH_ONLY')}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      Remove from this month's payroll run only
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                      Deducts {removeItem.netFormatted} from this batch. Recurring monthly salary agreement remains intact for next month.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1.5px solid ${removeMode === 'PERMANENT' ? '#dc2626' : '#e2e8f0'}`,
                    background: removeMode === 'PERMANENT' ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="removeMode"
                    value="PERMANENT"
                    checked={removeMode === 'PERMANENT'}
                    onChange={() => setRemoveMode('PERMANENT')}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#991b1b' }}>
                      Stop salary payment permanently (Set to ₦0)
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                      Removes from this batch AND stops recurring salary. They will not be included in future payroll runs until a new salary is set.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Reason for Removal (Optional audit log)
              </label>
              <input
                type="text"
                placeholder={removeMode === 'PERMANENT' ? 'e.g. Leave of absence, contract ended, or suspension' : 'e.g. Salary withheld this month for query'}
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                style={payrollInputStyle}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                disabled={removingStaff}
                onClick={() => setRemoveItem(null)}
                style={{ ...payrollButtonStyle, background: '#fff', color: '#475569', border: '1px solid #dbe3ef' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={removingStaff}
                style={{
                  ...payrollButtonStyle,
                  background: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #dc2626',
                }}
              >
                {removingStaff ? 'Removing…' : 'Confirm Removal from Payroll'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const payrollInputStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: '8px 9px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 11, boxSizing: 'border-box' };
const payrollButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 11px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' };
