'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { NewRequestModal } from '@/components/requests/NewRequestModal';
import { StaffAdminChatModal } from '@/components/chat/StaffAdminChatModal';
import {
  Home,
  Receipt,
  Plus,
  Timer,
  User,
  MapPin,
  Clock,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building,
  Upload,
  Calendar,
  Send,
  Zap,
  Wallet,
  RefreshCw,
  Search,
  Filter,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  CreditCard,
  ShieldCheck,
  Lock,
  ArrowRight,
  TrendingUp,
  FileText,
  DollarSign,
  AlertCircle,
  Info,
} from 'lucide-react';

interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeNumber?: string;
  phone?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  salaryBankName?: string | null;
  salaryAccountNumber?: string | null;
  salaryAccountName?: string | null;
}

interface StaffDashboardClientProps {
  user: StaffUser;
  businessName: string;
  subsidiaries?: any[];
  vendors?: any[];
  currentStaff?: any;
}

type TabType = 'HOME' | 'REQUESTS' | 'RETIREMENT' | 'PROFILE';

export function StaffDashboardClient({
  user,
  businessName,
  subsidiaries = [],
  vendors = [],
  currentStaff,
}: StaffDashboardClientProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('HOME');

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [accountabilityCases, setAccountabilityCases] = useState<any[]>([]);
  const [disbursementsAwaiting, setDisbursementsAwaiting] = useState<any[]>([]);
  const [allDisbursements, setAllDisbursements] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<StaffUser>(user);

  // Compensation & Payslips Data
  const [compensationData, setCompensationData] = useState<any>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);

  // Attendance State
  const [attendanceMonth, setAttendanceMonth] = useState<number>(new Date().getMonth() + 1);
  const [attendanceYear, setAttendanceYear] = useState<number>(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [punching, setPunching] = useState(false);
  const [punchStatusMessage, setPunchStatusMessage] = useState<string | null>(null);

  // Requisitions Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PAID' | 'RECURRING'>('ALL');

  // Modals & Sheets Visibility
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isPayslipsModalOpen, setIsPayslipsModalOpen] = useState(false);
  const [isAttendancePunchOpen, setIsAttendancePunchOpen] = useState(false);
  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false);
  const [isAdminChatOpen, setIsAdminChatOpen] = useState(false);
  const [isDualBankingOpen, setIsDualBankingOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [activeRetirementCase, setActiveRetirementCase] = useState<any | null>(null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<any | null>(null);

  // Dual Banking Form State
  const [bankName, setBankName] = useState(user.bankName || '');
  const [accountNumber, setAccountNumber] = useState(user.accountNumber || '');
  const [accountName, setAccountName] = useState(user.accountName || '');
  const [salaryBankName, setSalaryBankName] = useState(user.salaryBankName || user.bankName || '');
  const [salaryAccountNumber, setSalaryAccountNumber] = useState(user.salaryAccountNumber || user.accountNumber || '');
  const [salaryAccountName, setSalaryAccountName] = useState(user.salaryAccountName || user.accountName || '');
  const [savingBanking, setSavingBanking] = useState(false);
  const [bankingNotice, setBankingNotice] = useState<string | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Retirement Evidence Form State
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [actualSpentAmount, setActualSpentAmount] = useState<number>(0);
  const [refundReturnedAmount, setRefundReturnedAmount] = useState<number>(0);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceNotice, setEvidenceNotice] = useState<string | null>(null);

  // Maker-Checker Disbursement Confirmation
  const [confirmingDisbursementId, setConfirmingDisbursementId] = useState<string | null>(null);
  const [confirmingPayslipId, setConfirmingPayslipId] = useState<string | null>(null);

  // Notification Banner
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Load Main Data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const now = Date.now();
      const [reqRes, caseRes, disbRes, payRes] = await Promise.all([
        fetch(`/api/requests?_t=${now}`).then((r) => (r.ok ? r.json() : { requests: [] })),
        fetch(`/api/accountability?_t=${now}`).then((r) => (r.ok ? r.json() : { cases: [] })),
        fetch(`/api/staff/disbursements?_t=${now}`).then((r) => (r.ok ? r.json() : { awaitingConfirmation: [], recentDisbursements: [] })),
        fetch(`/api/payroll/my-payments?_t=${now}`).then((r) => (r.ok ? r.json() : { compensation: null, payslips: [] })),
      ]);

      const rawRequests = Array.isArray(reqRes) ? reqRes : reqRes?.requests || [];
      const myReqs = rawRequests.filter(
        (r: any) =>
          r.requestedById === user.id ||
          r.requester?.workEmail?.toLowerCase() === user.email.toLowerCase() ||
          r.requesterId === user.id
      );
      setRequests(myReqs);

      const rawCases = Array.isArray(caseRes) ? caseRes : caseRes?.cases || [];
      const myCases = rawCases.filter(
        (c: any) =>
          c.ownerUserId === user.id ||
          c.owner?.workEmail?.toLowerCase() === user.email.toLowerCase() ||
          c.request?.requestedById === user.id
      );
      setAccountabilityCases(myCases);

      setDisbursementsAwaiting(disbRes.awaitingConfirmation || []);
      setAllDisbursements(disbRes.recentDisbursements || []);

      if (payRes?.compensation) {
        setCompensationData(payRes.compensation);
        setPayslips(payRes.payslips || []);
        if (payRes.compensation.salaryBankName) {
          setSalaryBankName(payRes.compensation.salaryBankName);
          setSalaryAccountNumber(payRes.compensation.salaryAccountNumber || '');
          setSalaryAccountName(payRes.compensation.salaryAccountName || '');
        }
      }
    } catch (err) {
      console.error('Failed to load staff data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  // Load Attendance
  const loadAttendance = async (m: number, y: number) => {
    try {
      setLoadingAttendance(true);
      const res = await fetch(`/api/attendance/timesheet?employeeId=${user.id}&month=${m}&year=${y}`);
      if (res.ok) {
        const data = await res.json();
        setAttendanceData(data?.calendar || null);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    if (isTimesheetModalOpen) {
      loadAttendance(attendanceMonth, attendanceYear);
    }
  }, [attendanceMonth, attendanceYear, isTimesheetModalOpen]);

  // Computed Values
  const firstName = user.fullName ? user.fullName.split(' ')[0] : 'Staff';

  const pendingRetirements = useMemo(() => {
    return accountabilityCases.filter(
      (c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW' || c.status === 'OVERDUE'
    );
  }, [accountabilityCases]);

  const activeAdvanceAmount = useMemo(() => {
    return pendingRetirements.reduce((sum, c) => {
      const amt = Number(c.request?.amountMinor || c.amountMinor || 0) / 100;
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  }, [pendingRetirements]);

  const mostUrgentAdvance = useMemo(() => {
    if (pendingRetirements.length === 0) return null;
    return [...pendingRetirements].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  }, [pendingRetirements]);

  // Live countdown calculation for most urgent advance
  const [timeLeftStr, setTimeLeftStr] = useState<string>('72h remaining');
  const [isOverdue, setIsOverdue] = useState<boolean>(false);

  useEffect(() => {
    if (!mostUrgentAdvance) return;
    const updateCountdown = () => {
      const now = new Date().getTime();
      const due = new Date(mostUrgentAdvance.dueAt).getTime();
      const diff = due - now;
      if (diff <= 0) {
        setIsOverdue(true);
        const overdueHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
        setTimeLeftStr(`${overdueHours}h OVERDUE`);
      } else {
        setIsOverdue(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeftStr(`${hours}h ${minutes}m left`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [mostUrgentAdvance]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = r.requestNumber?.toLowerCase().includes(q);
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchPayee = r.payeeName?.toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchPayee) return false;
      }
      if (statusFilter === 'PENDING') return r.approvalStatus === 'SUBMITTED';
      if (statusFilter === 'APPROVED') return r.approvalStatus === 'APPROVED';
      if (statusFilter === 'PAID') return r.paymentStatus === 'PAID';
      if (statusFilter === 'RECURRING') return r.isRecurring === true;
      return true;
    });
  }, [requests, searchQuery, statusFilter]);

  // Handlers
  const handlePunchAttendance = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    setPunching(true);
    setPunchStatusMessage(null);
    try {
      let lat = 6.4281;
      let lng = 3.4219;
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        try {
          const pos: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (_) {}
      }

      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.id,
          qrToken: 'BEMS_HQ_STATION_VALID:1',
          latitude: lat,
          longitude: lng,
          type,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to punch attendance.');
      }
      setPunchStatusMessage(`✓ Success! Punched ${type === 'CHECK_IN' ? 'Check In' : 'Check Out'} at ${new Date().toLocaleTimeString()}`);
      setTimeout(() => {
        setIsAttendancePunchOpen(false);
        setPunchStatusMessage(null);
      }, 2000);
    } catch (err: any) {
      setPunchStatusMessage(`✕ Error: ${err.message}`);
    } finally {
      setPunching(false);
    }
  };

  const handleSaveBanking = async () => {
    setSavingBanking(true);
    setBankingNotice(null);
    try {
      const res = await fetch(`/api/staff/${user.id}/banking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName,
          accountNumber,
          accountName,
          salaryBankName,
          salaryAccountNumber,
          salaryAccountName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save corporate banking configuration.');
      setUserProfile((prev) => ({
        ...prev,
        bankName,
        accountNumber,
        accountName,
        salaryBankName,
        salaryAccountNumber,
        salaryAccountName,
      }));
      setBankingNotice('✓ Banking configuration saved successfully!');
      setTimeout(() => {
        setIsDualBankingOpen(false);
        setBankingNotice(null);
      }, 1500);
    } catch (err: any) {
      setBankingNotice(`✕ Error: ${err.message}`);
    } finally {
      setSavingBanking(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', msg: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordNotice({ type: 'error', msg: 'Password must be at least 6 characters.' });
      return;
    }
    setSavingPassword(true);
    setPasswordNotice(null);
    try {
      const res = await fetch(`/api/staff/${user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password.');
      setPasswordNotice({ type: 'success', msg: '✓ Password changed successfully!' });
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordNotice(null);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (err: any) {
      setPasswordNotice({ type: 'error', msg: err.message });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSubmitRetirement = async () => {
    if (!activeRetirementCase) return;
    if (!evidenceDescription.trim()) {
      setEvidenceNotice('Please provide an expense summary or itemized description.');
      return;
    }
    setUploadingEvidence(true);
    setEvidenceNotice(null);
    try {
      let attachmentUrl = '';
      if (evidenceFile) {
        const formData = new FormData();
        formData.append('file', evidenceFile);
        const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const upData = await upRes.json();
        if (upRes.ok && upData.url) {
          attachmentUrl = upData.url;
        }
      }

      const res = await fetch('/api/accountability/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: activeRetirementCase.id,
          description: evidenceDescription,
          actualSpentAmountMinor: Math.round(actualSpentAmount * 100),
          refundAmountMinor: Math.round(refundReturnedAmount * 100),
          attachmentUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit retirement proof.');
      setEvidenceNotice('✓ Clearance submitted successfully for GMD verification!');
      setTimeout(() => {
        setActiveRetirementCase(null);
        setEvidenceFile(null);
        setEvidenceDescription('');
        setEvidenceNotice(null);
        loadData(true);
      }, 1500);
    } catch (err: any) {
      setEvidenceNotice(`✕ Error: ${err.message}`);
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleConfirmDisbursement = async (disbursementId: string) => {
    setConfirmingDisbursementId(disbursementId);
    try {
      const res = await fetch('/api/disbursements/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disbursementId, action: 'CONFIRM' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Confirmation failed');
      }
      setAlertNotice('✓ Receipt of funds confirmed successfully!');
      setTimeout(() => setAlertNotice(null), 3000);
      loadData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConfirmingDisbursementId(null);
    }
  };

  const handleConfirmPayslip = async (payslipId: string) => {
    setConfirmingPayslipId(payslipId);
    try {
      const res = await fetch('/api/disbursements/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disbursementId: payslipId, action: 'CONFIRM' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Payslip receipt confirmation failed');
      }
      setAlertNotice('✓ Salary payout confirmed! Your payslip voucher has been updated.');
      setTimeout(() => setAlertNotice(null), 3000);
      loadData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConfirmingPayslipId(null);
    }
  };

  const formatNaira = (n: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(n);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex justify-center pb-24 md:pb-8 selection:bg-orange-100 selection:text-orange-900">
      {/* Mobile App Canvas Container */}
      <div className="w-full max-w-md md:max-w-xl bg-white shadow-xl min-h-screen flex flex-col border-x border-slate-200/70 relative">
        
        {/* TOP APP BAR (Identical to Flutter AppBar) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-orange-500/20">
              B
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wider uppercase bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200/60">
                  {businessName || 'BEMS Group'}
                </span>
              </div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight">
                Hello, {firstName} 👋
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Attendance Check-In Launcher */}
            <button
              onClick={() => setIsAttendancePunchOpen(true)}
              className="p-2 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Attendance Check-In"
            >
              <MapPin className="w-4 h-4 text-emerald-600" />
            </button>

            {/* Direct Admin Chat Launcher */}
            <button
              onClick={() => setIsAdminChatOpen(true)}
              className="p-2 rounded-xl text-slate-600 hover:text-orange-600 hover:bg-orange-50 transition-colors relative"
              title="Message Admin / Help Desk"
            >
              <MessageSquare className="w-4 h-4 text-orange-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-600 ring-2 ring-white"></span>
            </button>

            {/* Reload Data Button */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-600' : ''}`} />
            </button>
          </div>
        </header>

        {/* Global Toast Alert Notice */}
        {alertNotice && (
          <div className="mx-4 mt-3 p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in z-20">
            <span>{alertNotice}</span>
            <button onClick={() => setAlertNotice(null)} className="opacity-80 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MAIN BODY AREA (Tab Switcher) */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4">
          
          {/* ========================================================= */}
          {/* TAB 0: HOME WORKSPACE                                     */}
          {/* ========================================================= */}
          {activeTab === 'HOME' && (
            <div className="space-y-4 animate-fade-in">
              {/* HERO CARD: 72H SLA ADVANCE CLEARANCE */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-5 shadow-xl shadow-slate-900/10">
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-orange-500/20 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/15 rounded-full blur-xl"></div>

                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-orange-400" />
                      72H Operational Advance Balance
                    </span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                        pendingRetirements.length === 0
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : isOverdue
                          ? 'bg-red-500/20 text-red-300 border-red-500/30'
                          : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                      }`}
                    >
                      {pendingRetirements.length === 0 ? '✓ ALL CLEARED' : timeLeftStr}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white">
                      {formatNaira(activeAdvanceAmount)}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {pendingRetirements.length === 0
                        ? 'No outstanding cash advances. You are in full compliance.'
                        : `${pendingRetirements.length} advance(s) awaiting proof of expense submission.`}
                    </p>
                  </div>

                  {pendingRetirements.length > 0 && (
                    <div className="pt-1 flex gap-2">
                      <button
                        onClick={() => setActiveTab('RETIREMENT')}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs rounded-xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/30"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Liquidate / Upload Receipts
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* QUICK CARD: MY SALARY & PAYSLIPS */}
              <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-orange-50/70 p-4 shadow-sm hover:border-orange-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20 font-black">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-orange-950">
                        Monthly Compensation & Payslips
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Payday fixed to 3rd of each calendar month
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPayslipsModalOpen(true)}
                    className="px-3 py-1.5 bg-white border border-orange-200 text-orange-700 hover:bg-orange-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    View Vouchers
                  </button>
                </div>

                {compensationData && (
                  <div className="mt-3 pt-3 border-t border-orange-200/50 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Base Contract Gross</span>
                      <span className="font-extrabold text-slate-900">{compensationData.grossFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Est. Take-Home Net</span>
                      <span className="font-extrabold text-emerald-700">{compensationData.netFormatted}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 6 PASTEL QUICK ACTION TILES (Exact replica of Flutter Mobile App) */}
              <div>
                <h3 className="text-xs font-black tracking-wider uppercase text-slate-400 mb-2 px-1">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* 1. Punch In / Attendance */}
                  <button
                    onClick={() => setIsAttendancePunchOpen(true)}
                    className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100 hover:bg-emerald-100/80 active:scale-[0.98] transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-emerald-950 leading-tight">Clock In / Out</h4>
                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Timekeeping punch</p>
                    </div>
                  </button>

                  {/* 2. New Fund Request */}
                  <button
                    onClick={() => setIsNewRequestOpen(true)}
                    className="p-3.5 rounded-2xl bg-orange-50/80 border border-orange-100 hover:bg-orange-100/80 active:scale-[0.98] transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-xl bg-orange-600 text-white shadow-sm shadow-orange-600/30">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-orange-950 leading-tight">New Request</h4>
                      <p className="text-[10px] text-orange-700 font-semibold mt-0.5">Procurement fund</p>
                    </div>
                  </button>

                  {/* 3. Upload Receipt / 72h Clearance */}
                  <button
                    onClick={() => setActiveTab('RETIREMENT')}
                    className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 hover:bg-indigo-100/80 active:scale-[0.98] transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-indigo-950 leading-tight">Retire Advance</h4>
                      <p className="text-[10px] text-indigo-700 font-semibold mt-0.5">Upload receipts</p>
                    </div>
                  </button>

                  {/* 4. Dual Banking Config */}
                  <button
                    onClick={() => setIsDualBankingOpen(true)}
                    className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-100 hover:bg-purple-100/80 active:scale-[0.98] transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-600/30">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-purple-950 leading-tight">Dual Banking</h4>
                      <p className="text-[10px] text-purple-700 font-semibold mt-0.5">Salary vs Advance</p>
                    </div>
                  </button>

                  {/* 5. Monthly Timesheet Log */}
                  <button
                    onClick={() => setIsTimesheetModalOpen(true)}
                    className="p-3.5 rounded-2xl bg-cyan-50/80 border border-cyan-100 hover:bg-cyan-100/80 active:scale-[0.98] transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-xl bg-cyan-600 text-white shadow-sm shadow-cyan-600/30">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-cyan-950 leading-tight">Timesheet Log</h4>
                      <p className="text-[10px] text-cyan-700 font-semibold mt-0.5">Monthly punches</p>
                    </div>
                  </button>

                  {/* 6. Message Admin / Help Desk */}
                  <button
                    onClick={() => setIsAdminChatOpen(true)}
                    className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-100 hover:bg-rose-100/80 active:scale-[0.98] transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-xl bg-rose-600 text-white shadow-sm shadow-rose-600/30">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-rose-950 leading-tight">Message Admin</h4>
                      <p className="text-[10px] text-rose-700 font-semibold mt-0.5">HR / Finance Help</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 72H SLA CLEARANCE WARNING BANNER (If Urgent) */}
              {pendingRetirements.length > 0 && (
                <div
                  onClick={() => setActiveTab('RETIREMENT')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    isOverdue
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`} />
                  <div className="text-xs">
                    <p className="font-extrabold">
                      {isOverdue ? 'Action Critical: Advance Overdue' : '72h SLA Clearance Warning'}
                    </p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Cash advance for <b>{mostUrgentAdvance?.request?.title || 'Operational Work'}</b> is scheduled for liquidation ({timeLeftStr}). Tap to upload your expense receipts.
                    </p>
                  </div>
                </div>
              )}

              {/* RECENT ACTIVITY FEED */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-black tracking-wider uppercase text-slate-400">
                    Recent Requisitions
                  </h3>
                  <button
                    onClick={() => setActiveTab('REQUESTS')}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700"
                  >
                    View All ({requests.length})
                  </button>
                </div>

                {requests.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-8 text-center text-xs text-slate-500">
                    No requisitions recorded yet. Tap "+ New Request" to create your first fund request.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {requests.slice(0, 4).map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRequestDetail(r)}
                        className="p-3.5 bg-white border border-slate-200/80 rounded-2xl hover:border-orange-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400">{r.requestNumber}</span>
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                r.approvalStatus === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : r.paymentStatus === 'PAID'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : r.approvalStatus === 'REJECTED'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {r.paymentStatus === 'PAID' ? 'DISBURSED' : r.approvalStatus}
                            </span>
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-900 line-clamp-1">{r.title}</h4>
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900 block">
                            {formatNaira(Number(r.amountMinor) / 100)}
                          </span>
                          <span className="text-[10px] font-semibold text-orange-600 flex items-center gap-0.5 justify-end mt-0.5">
                            Details <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: REQUISITIONS DESK                                  */}
          {/* ========================================================= */}
          {activeTab === 'REQUESTS' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Requisitions Desk</h2>
                  <p className="text-xs text-slate-500">Track approvals and disbursements</p>
                </div>
                <button
                  onClick={() => setIsNewRequestOpen(true)}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-orange-700"
                >
                  <Plus className="w-3.5 h-3.5" /> New
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by code, title, payee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {(['ALL', 'PENDING', 'APPROVED', 'PAID', 'RECURRING'] as const).map((code) => (
                  <button
                    key={code}
                    onClick={() => setStatusFilter(code)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                      statusFilter === code
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {code === 'ALL'
                      ? `All (${requests.length})`
                      : code === 'PENDING'
                      ? 'In Review'
                      : code === 'APPROVED'
                      ? 'Approved'
                      : code === 'PAID'
                      ? 'Disbursed'
                      : '🔁 Recurring'}
                  </button>
                ))}
              </div>

              {/* Requisitions List */}
              {filteredRequests.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center text-xs text-slate-500">
                  No requisitions match your filter criteria.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRequests.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRequestDetail(r)}
                      className="p-4 bg-white border border-slate-200/80 rounded-2xl hover:border-orange-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-slate-400 tracking-wider">
                          {r.requestNumber}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            r.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.paymentStatus === 'PAID'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : r.approvalStatus === 'REJECTED'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {r.paymentStatus === 'PAID' ? 'DISBURSED' : r.approvalStatus}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{r.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{r.justification || 'No description provided'}</p>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {formatNaira(Number(r.amountMinor) / 100)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: 72H SLA & RETIREMENT DESK                          */}
          {/* ========================================================= */}
          {activeTab === 'RETIREMENT' && (
            <div className="space-y-3.5 animate-fade-in">
              <div>
                <h2 className="text-lg font-black text-slate-900">72h SLA Clearance Desk</h2>
                <p className="text-xs text-slate-500">Liquidate cash advances and upload receipt vouchers</p>
              </div>

              {pendingRetirements.length === 0 ? (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-3xl p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20 font-black">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-extrabold text-emerald-950">100% Cleared & Compliant</h3>
                  <p className="text-xs text-emerald-700 max-w-xs mx-auto">
                    You have no outstanding operational cash advances awaiting retirement. Your payroll standing is clear!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRetirements.map((c) => {
                    const amount = Number(c.request?.amountMinor || c.amountMinor || 0) / 100;
                    return (
                      <div
                        key={c.id}
                        className="bg-white border-2 border-orange-200 rounded-3xl p-4 shadow-sm hover:border-orange-400 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                            {c.request?.requestNumber || 'ADVANCE'}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                            Due: {new Date(c.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-slate-900">{c.request?.title || 'Operational Cash Advance'}</h4>
                          <span className="text-xl font-black text-slate-900 block mt-1">{formatNaira(amount)}</span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex gap-2">
                          <button
                            onClick={() => {
                              setActiveRetirementCase(c);
                              setActualSpentAmount(amount);
                              setRefundReturnedAmount(0);
                            }}
                            className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 hover:bg-orange-700 active:scale-[0.98] transition-all"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload Receipts & Liquidate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cleared History */}
              <div>
                <h3 className="text-xs font-black tracking-wider uppercase text-slate-400 mb-2 px-1">
                  Cleared Advances History
                </h3>
                {accountabilityCases.filter((c) => c.status === 'CLEARED' || c.status === 'APPROVED').length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-1">No cleared historical certificates yet.</p>
                ) : (
                  <div className="space-y-2">
                    {accountabilityCases
                      .filter((c) => c.status === 'CLEARED' || c.status === 'APPROVED')
                      .map((c) => (
                        <div
                          key={c.id}
                          className="p-3 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-slate-900 block">{c.request?.title || 'Cleared Advance'}</span>
                            <span className="text-[10px] text-slate-400">{c.request?.requestNumber}</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            ✓ Cleared
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: PROFILE & DUAL BANKING                             */}
          {/* ========================================================= */}
          {activeTab === 'PROFILE' && (
            <div className="space-y-3.5 animate-fade-in">
              {/* Profile Header */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-xl flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                  {user.fullName ? user.fullName[0].toUpperCase() : 'S'}
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h2 className="text-base font-extrabold text-white truncate">{user.fullName}</h2>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    {user.employeeNumber || 'STAFF'} • {businessName}
                  </span>
                </div>
              </div>

              {/* Dual Banking Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-orange-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Corporate Dual Banking
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsDualBankingOpen(true)}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700"
                  >
                    Configure
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">1. Operational Advance NUBAN</span>
                    <span className="font-extrabold text-slate-900 block">{userProfile.bankName || 'Not Set'}</span>
                    <span className="text-slate-600 text-[11px]">{userProfile.accountNumber || '—'} ({userProfile.accountName || user.fullName})</span>
                  </div>

                  <div className="p-3 bg-orange-50/50 rounded-2xl border border-orange-100">
                    <span className="text-[10px] font-extrabold text-orange-600 uppercase block">2. Monthly Payroll Salary NUBAN</span>
                    <span className="font-extrabold text-slate-900 block">{userProfile.salaryBankName || userProfile.bankName || 'Not Set'}</span>
                    <span className="text-slate-600 text-[11px]">{userProfile.salaryAccountNumber || userProfile.accountNumber || '—'} ({userProfile.salaryAccountName || userProfile.accountName || user.fullName})</span>
                  </div>
                </div>
              </div>

              {/* Compensation Summary Button */}
              <div
                onClick={() => setIsPayslipsModalOpen(true)}
                className="p-4 bg-white border border-slate-200 rounded-3xl hover:border-orange-300 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Salary & Payslips Vouchers</h4>
                    <p className="text-[11px] text-slate-500">View contract gross, deductions, and payout history</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              {/* Security & Password */}
              <div
                onClick={() => setIsPasswordModalOpen(true)}
                className="p-4 bg-white border border-slate-200 rounded-3xl hover:border-orange-300 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Security & Password</h4>
                    <p className="text-[11px] text-slate-500">Change your staff portal password</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              {/* Logout Button */}
              <div className="pt-2">
                <Link
                  href="/"
                  className="w-full py-3 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
                >
                  Sign Out from Portal
                </Link>
              </div>
            </div>
          )}
        </main>

        {/* ========================================================= */}
        {/* BOTTOM NAVIGATION BAR (Exact Replica of Flutter App)      */}
        {/* ========================================================= */}
        <nav className="fixed md:sticky bottom-0 left-0 right-0 max-w-md md:max-w-xl mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-3 py-2 flex items-center justify-around z-40 shadow-lg">
          {/* Home Tab */}
          <button
            onClick={() => setActiveTab('HOME')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'HOME' ? 'text-orange-600 font-extrabold' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Home</span>
          </button>

          {/* Requisitions Tab */}
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
              activeTab === 'REQUESTS' ? 'text-orange-600 font-extrabold' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px]">Requests</span>
            {requests.length > 0 && (
              <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-orange-600 ring-2 ring-white"></span>
            )}
          </button>

          {/* CENTER ELEVATED BUTTON: NEW REQUEST */}
          <button
            onClick={() => setIsNewRequestOpen(true)}
            className="w-12 h-12 -mt-5 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all"
            title="Create New Requisition"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* 72h SLA Tab */}
          <button
            onClick={() => setActiveTab('RETIREMENT')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
              activeTab === 'RETIREMENT' ? 'text-orange-600 font-extrabold' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <Timer className="w-5 h-5" />
            <span className="text-[10px]">72h SLA</span>
            {pendingRetirements.length > 0 && (
              <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white animate-pulse"></span>
            )}
          </button>

          {/* Profile Tab */}
          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'PROFILE' ? 'text-orange-600 font-extrabold' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profile</span>
          </button>
        </nav>

        {/* ========================================================= */}
        {/* MODAL 1: ATTENDANCE CLOCK IN / CHECK-OUT                  */}
        {/* ========================================================= */}
        {isAttendancePunchOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Attendance Timekeeping</h3>
                    <p className="text-[10px] text-slate-500">Corporate Station GPS & Time Window Verification</p>
                  </div>
                </div>
                <button onClick={() => setIsAttendancePunchOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-center space-y-1">
                <span className="text-2xl font-black text-emerald-950 block">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-900">
                  Status: Standard Duty Shift
                </span>
              </div>

              {punchStatusMessage && (
                <div className="p-3 bg-slate-100 rounded-xl text-xs font-bold text-center">
                  {punchStatusMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  disabled={punching}
                  onClick={() => handlePunchAttendance('CHECK_IN')}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  {punching ? 'Verifying...' : '✓ Punch Check-In'}
                </button>
                <button
                  disabled={punching}
                  onClick={() => handlePunchAttendance('CHECK_OUT')}
                  className="py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-slate-800/20 active:scale-95 transition-all"
                >
                  {punching ? 'Verifying...' : '⇥ Punch Check-Out'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 2: MONTHLY ATTENDANCE TIMESHEET                     */}
        {/* ========================================================= */}
        {isTimesheetModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-black">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Monthly Timesheet</h3>
                    <p className="text-[10px] text-slate-500">Punches for {attendanceMonth}/{attendanceYear}</p>
                  </div>
                </div>
                <button onClick={() => setIsTimesheetModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingAttendance ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading timesheet records...</div>
              ) : attendanceData ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-600 block uppercase">Present</span>
                      <span className="text-sm font-extrabold text-emerald-950">{attendanceData.summary?.presentDays || 0}</span>
                    </div>
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                      <span className="text-[10px] font-bold text-amber-600 block uppercase">Late</span>
                      <span className="text-sm font-extrabold text-amber-950">{attendanceData.summary?.lateDays || 0}</span>
                    </div>
                    <div className="p-2.5 bg-red-50 rounded-xl border border-red-100">
                      <span className="text-[10px] font-bold text-red-600 block uppercase">Absent</span>
                      <span className="text-sm font-extrabold text-red-950">{attendanceData.summary?.absentDays || 0}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Days Log</h4>
                    {attendanceData.days && attendanceData.days.length > 0 ? (
                      attendanceData.days.slice(0, 10).map((d: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-slate-900">{d.date}</span>
                            <span className="text-[10px] text-slate-500 block">In: {d.checkIn || '—'} | Out: {d.checkOut || '—'}</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              d.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.status === 'LATE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4">No attendance activity recorded for this period.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No attendance records found for this month.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 3: DUAL BANKING CONFIGURATION                       */}
        {/* ========================================================= */}
        {isDualBankingOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Corporate Dual Banking</h3>
                    <p className="text-[10px] text-slate-500">Separate accounts for advances vs salary</p>
                  </div>
                </div>
                <button onClick={() => setIsDualBankingOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {bankingNotice && (
                <div className="p-3 bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold">
                  {bankingNotice}
                </div>
              )}

              {/* ADVANCE ACCOUNT */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                  1. Operational Advance Account (72h Petty Cash)
                </span>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Access Bank PLC"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">NUBAN Account Number (10 Digits)</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="0123456789"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Beneficiary Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder={user.fullName}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
              </div>

              {/* SALARY ACCOUNT */}
              <div className="p-3.5 bg-orange-50/60 rounded-2xl border border-orange-200 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-800 block">
                  2. Monthly Salary Account (3rd of Month Payroll)
                </span>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Salary Bank Name</label>
                  <input
                    type="text"
                    value={salaryBankName}
                    onChange={(e) => setSalaryBankName(e.target.value)}
                    placeholder="e.g. Zenith Bank PLC"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Salary NUBAN Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={salaryAccountNumber}
                    onChange={(e) => setSalaryAccountNumber(e.target.value)}
                    placeholder="0123456789"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Salary Account Name</label>
                  <input
                    type="text"
                    value={salaryAccountName}
                    onChange={(e) => setSalaryAccountName(e.target.value)}
                    placeholder={user.fullName}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
              </div>

              <button
                disabled={savingBanking}
                onClick={handleSaveBanking}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-orange-500/20 active:scale-95 transition-all"
              >
                {savingBanking ? 'Saving Configuration...' : 'Save Corporate Accounts'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 4: PAYSLIPS & SALARY VOUCHERS SHEET                 */}
        {/* ========================================================= */}
        {isPayslipsModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Salary & Payslips Vouchers</h3>
                    <p className="text-[10px] text-slate-500">Corporate contract breakdown & payouts</p>
                  </div>
                </div>
                <button onClick={() => setIsPayslipsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Compensation Breakdown Card */}
              {compensationData && (
                <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Monthly Compensation</span>
                    <span className="text-[10px] font-black bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30">
                      Payday 3rd
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Agreed Gross</span>
                      <span className="text-base font-extrabold text-white">{compensationData.grossFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Est. Take-Home</span>
                      <span className="text-base font-extrabold text-emerald-400">{compensationData.netFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Pension (8%)</span>
                      <span className="font-extrabold text-slate-300">{compensationData.pensionFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">PAYE Tax (~5%)</span>
                      <span className="font-extrabold text-slate-300">{compensationData.taxFormatted}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 flex items-center justify-between">
                    <span>Disbursing To:</span>
                    <span className="font-bold">{compensationData.salaryBankName} ({compensationData.salaryAccountNumber})</span>
                  </div>
                </div>
              )}

              {/* Monthly Vouchers List */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Payment Vouchers & Receipts
                </h4>
                {payslips.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-slate-200/70 rounded-2xl text-center text-xs text-slate-500">
                    No payment vouchers generated yet. Monthly payroll is prepared on the 3rd.
                  </div>
                ) : (
                  payslips.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">{p.period}</span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            p.confirmed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {p.confirmed ? '✓ RECEIVED' : 'AWAITING RECEIPT'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Net Paid: <b className="text-slate-900">{p.amountFormatted}</b></span>
                        <span className="text-[10px] text-slate-400">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'Pending'}</span>
                      </div>
                      {!p.confirmed && (
                        <div className="pt-2 flex gap-2">
                          <button
                            disabled={confirmingPayslipId === p.id}
                            onClick={() => handleConfirmPayslip(p.id)}
                            className="flex-1 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                          >
                            {confirmingPayslipId === p.id ? 'Confirming...' : '✓ Confirm Received'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 5: 72H RETIREMENT EVIDENCE UPLOAD                   */}
        {/* ========================================================= */}
        {activeRetirementCase && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Upload Retirement Proof</h3>
                    <p className="text-[10px] text-slate-500">Liquidate advance {activeRetirementCase.request?.requestNumber}</p>
                  </div>
                </div>
                <button onClick={() => setActiveRetirementCase(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {evidenceNotice && (
                <div className="p-3 bg-orange-50 text-orange-900 border border-orange-200 rounded-xl text-xs font-bold">
                  {evidenceNotice}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Expense Itemization & Summary</label>
                  <textarea
                    rows={3}
                    value={evidenceDescription}
                    onChange={(e) => setEvidenceDescription(e.target.value)}
                    placeholder="List purchases, vendor items, receipts breakdown..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Actual Spent (₦)</label>
                    <input
                      type="number"
                      value={actualSpentAmount || ''}
                      onChange={(e) => setActualSpentAmount(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Refund Returned (₦)</label>
                    <input
                      type="number"
                      value={refundReturnedAmount || ''}
                      onChange={(e) => setRefundReturnedAmount(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Attach Receipts / Proof (Photo or PDF)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setEvidenceFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                  />
                </div>
              </div>

              <button
                disabled={uploadingEvidence}
                onClick={handleSubmitRetirement}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-orange-500/20 active:scale-95 transition-all"
              >
                {uploadingEvidence ? 'Submitting Proof...' : 'Submit for GMD Clearance'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 6: REQUISITION DETAILS & REQUEST-LEVEL CHAT         */}
        {/* ========================================================= */}
        {selectedRequestDetail && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black text-slate-400">{selectedRequestDetail.requestNumber}</span>
                  <h3 className="text-sm font-extrabold text-slate-900">{selectedRequestDetail.title}</h3>
                </div>
                <button onClick={() => setSelectedRequestDetail(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Requested</span>
                  <span className="text-xl font-black text-slate-900">
                    {formatNaira(Number(selectedRequestDetail.amountMinor) / 100)}
                  </span>
                  <p className="text-slate-600 text-[11px] mt-1">{selectedRequestDetail.justification || 'No justification provided'}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block">Approval Status</span>
                    <span className="font-extrabold text-slate-900">{selectedRequestDetail.approvalStatus}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block">Disbursement</span>
                    <span className="font-extrabold text-slate-900">{selectedRequestDetail.paymentStatus}</span>
                  </div>
                </div>

                {selectedRequestDetail.paymentStatus === 'PAID' && (
                  <button
                    onClick={() => {
                      const caseItem = accountabilityCases.find((c) => c.requestId === selectedRequestDetail.id);
                      if (caseItem) {
                        setActiveRetirementCase(caseItem);
                      } else {
                        setActiveTab('RETIREMENT');
                      }
                      setSelectedRequestDetail(null);
                    }}
                    className="w-full py-2.5 bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Receipts for this Advance
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 7: SECURITY & PASSWORD CHANGE                       */}
        {/* ========================================================= */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Change Password</h3>
                    <p className="text-[10px] text-slate-500">Update your account security credential</p>
                  </div>
                </div>
                <button onClick={() => setIsPasswordModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {passwordNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    passwordNotice.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {passwordNotice.msg}
                </div>
              )}

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <button
                disabled={savingPassword}
                onClick={handleChangePassword}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-extrabold shadow-md active:scale-95 transition-all"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 8: DIRECT ADMIN CHAT DESK                           */}
        {/* ========================================================= */}
        {isAdminChatOpen && (
          <StaffAdminChatModal
            employeeId={user.id}
            employeeName={user.fullName}
            employeeNumber={user.employeeNumber}
            subsidiary={businessName}
            onClose={() => setIsAdminChatOpen(false)}
          />
        )}

        {/* ========================================================= */}
        {/* MODAL 9: NEW FUND REQUISITION MODAL                       */}
        {/* ========================================================= */}
        <NewRequestModal
          isOpen={isNewRequestOpen}
          onClose={() => {
            setIsNewRequestOpen(false);
            loadData(true);
          }}
          subsidiaries={subsidiaries}
          vendors={vendors}
          currentStaff={currentStaff}
        />
      </div>
    </div>
  );
}
