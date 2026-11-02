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
  Eye,
  EyeOff,
  Bell,
  Camera,
  LogOut,
  Maximize2,
  Minimize2,
  Phone,
  Mail,
  Briefcase,
  CheckCheck,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeNumber?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  salaryBankName?: string | null;
  salaryAccountNumber?: string | null;
  salaryAccountName?: string | null;
  jobTitle?: string;
  department?: string;
  subsidiary?: string;
  workLocation?: string;
  staffGrade?: string;
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
  // Navigation State - STRICTLY DEFAULTS TO HOME
  const [activeTab, setActiveTab] = useState<TabType>('HOME');

  // Desktop View Toggle: 'MOBILE' (exact phone frame) or 'EXPANDED' (full desktop width)
  const [isExpandedView, setIsExpandedView] = useState(false);

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [accountabilityCases, setAccountabilityCases] = useState<any[]>([]);
  const [disbursementsAwaiting, setDisbursementsAwaiting] = useState<any[]>([]);
  const [allDisbursements, setAllDisbursements] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<StaffUser>(user);
  const [hideBalance, setHideBalance] = useState(false);

  // Compensation & Payslips Data
  const [compensationData, setCompensationData] = useState<any>(null);
  const [payslips, setPayslips] = useState<any[]>([]);

  // Attendance State
  const [attendanceMonth, setAttendanceMonth] = useState<number>(new Date().getMonth() + 1);
  const [attendanceYear, setAttendanceYear] = useState<number>(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any | null>(null);
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Load Main Data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const now = Date.now();
      const [reqRes, caseRes, disbRes, payRes, attRes] = await Promise.all([
        fetch(`/api/requests?_t=${now}`).then((r) => (r.ok ? r.json() : { requests: [] })),
        fetch(`/api/accountability?_t=${now}`).then((r) => (r.ok ? r.json() : { cases: [] })),
        fetch(`/api/staff/disbursements?_t=${now}`).then((r) => (r.ok ? r.json() : { awaitingConfirmation: [], recentDisbursements: [] })),
        fetch(`/api/payroll/my-payments?_t=${now}`).then((r) => (r.ok ? r.json() : { compensation: null, payslips: [] })),
        fetch(`/api/attendance/timesheet?employeeId=${user.id}&_t=${now}`).then((r) => (r.ok ? r.json() : null)),
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

      if (attRes?.calendar?.today) {
        setTodayAttendance(attRes.calendar.today);
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
  const displaySubsidiary = user.subsidiary || businessName || 'BEMS Group';
  const displayJobTitle = user.jobTitle || 'Staff Personnel';
  const displayDepartment = user.department || 'Operations';
  const displayEmployeeNumber = user.employeeNumber || 'STAFF';

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

  // Format Naira Currency
  const formatNaira = (n: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(n);
  };

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
      if (!res.ok) throw new Error(data.error || 'Failed to punch attendance.');
      setPunchStatusMessage(`✓ Success! Punched ${type === 'CHECK_IN' ? 'Check In' : 'Check Out'} at ${new Date().toLocaleTimeString()}`);
      setTodayAttendance({
        status: 'ON_TIME',
        checkInTime: new Date().toISOString(),
        checkOutTime: type === 'CHECK_OUT' ? new Date().toISOString() : null,
      });
      setTimeout(() => {
        setIsAttendancePunchOpen(false);
        setPunchStatusMessage(null);
      }, 1500);
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
      setBankingNotice('✓ Corporate banking configuration saved successfully!');
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
      setPasswordNotice({ type: 'success', msg: '✓ Password updated successfully!' });
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
        if (upRes.ok && upData.url) attachmentUrl = upData.url;
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

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 flex justify-center py-0 md:py-6 selection:bg-orange-100 selection:text-orange-900 font-sans">
      {/* Mobile App Viewport Shell (with Desktop Expander Toggle) */}
      <div
        className={`w-full bg-[#F8FAFC] min-h-screen md:min-h-[92vh] flex flex-col relative transition-all duration-300 ${
          isExpandedView
            ? 'max-w-5xl shadow-2xl md:rounded-[32px] border border-slate-200 overflow-hidden'
            : 'max-w-md md:max-w-lg shadow-2xl md:rounded-[36px] border border-slate-200/90 overflow-hidden'
        }`}
      >
        {/* DESKTOP VIEW EXPANDER BAR */}
        <div className="hidden md:flex items-center justify-between px-5 py-2 bg-slate-900 text-white text-[11px] font-bold border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>BEMS Staff Enterprise Portal · Connected</span>
          </div>
          <button
            onClick={() => setIsExpandedView(!isExpandedView)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all font-semibold"
            title="Toggle between Mobile Simulator Frame and Full Desktop Expander"
          >
            {isExpandedView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isExpandedView ? 'Mobile Frame' : 'Expand Desktop View'}</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TOP BAR: AVATAR + NAME + SUBSIDIARY + NOTIFICATIONS       */}
        {/* ========================================================= */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar with Orange Border / Picture */}
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-black text-base flex items-center justify-center shadow-md shadow-orange-500/20 overflow-hidden">
                {user.avatarUrl && user.avatarUrl.startsWith('http') ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span>{user.fullName ? user.fullName[0].toUpperCase() : 'S'}</span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-[#0F172A] tracking-tight">
                  {user.fullName}
                </h1>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-600 text-white text-[9px] font-black">
                  ✓
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#64748B] tracking-tight">
                {displayEmployeeNumber} · {displaySubsidiary}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="w-9 h-9 rounded-full bg-white border border-[#E2E8F0] text-[#0F172A] flex items-center justify-center hover:bg-slate-50 transition-all relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-600 ring-2 ring-white"></span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="w-9 h-9 rounded-full bg-white border border-[#E2E8F0] text-[#0F172A] flex items-center justify-center hover:bg-slate-50 transition-all"
              title="Refresh Data"
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

        {/* ========================================================= */}
        {/* MAIN BODY AREA                                            */}
        {/* ========================================================= */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4 pb-28">

          {/* ========================================================= */}
          {/* TAB 0: HOME SCREEN                                        */}
          {/* ========================================================= */}
          {activeTab === 'HOME' && (
            <div className="space-y-4 animate-fade-in">
              
              {/* CARD 1: DAILY ATTENDANCE & PRESENCE (Exact Flutter Replica) */}
              <div className="p-4 bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl flex items-center justify-center ${
                        todayAttendance ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FFF7ED] text-[#EA580C]'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748B] block">
                        DAILY ATTENDANCE & PRESENCE
                      </span>
                      <span
                        className={`text-sm font-black ${
                          todayAttendance ? 'text-[#059669]' : 'text-[#0F172A]'
                        }`}
                      >
                        {todayAttendance
                          ? todayAttendance.checkOutTime
                            ? 'Workday Completed'
                            : 'Clocked In (ON TIME)'
                          : 'Not Checked In Today'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                      todayAttendance
                        ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                        : 'bg-[#FFF7ED] text-[#EA580C] border-[#FED7AA]'
                    }`}
                  >
                    {todayAttendance ? 'ON TIME' : 'UNPUNCHED'}
                  </span>
                </div>

                {/* Attendance Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    disabled={punching}
                    onClick={() => handlePunchAttendance(todayAttendance ? 'CHECK_OUT' : 'CHECK_IN')}
                    className={`w-full py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] ${
                      todayAttendance
                        ? 'bg-[#EA580C] hover:bg-orange-700 text-white'
                        : 'bg-[#059669] hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {punching ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                    <span>
                      {punching
                        ? 'Verifying Location...'
                        : todayAttendance
                        ? 'CLOCK OUT'
                        : 'CLOCK IN (GPS + QR)'}
                    </span>
                  </button>

                  <button
                    onClick={() => setIsTimesheetModalOpen(true)}
                    className="w-full py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-slate-100 text-[#0F172A] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#0F172A]" />
                    <span>View Monthly Attendance Calendar</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: HERO ADVANCE CARD (DEEP EMERALD GREEN GRADIENT) */}
              <div className="rounded-[26px] bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#047857] text-white p-5 shadow-xl shadow-[#064E3B]/25 relative overflow-hidden">
                {/* Ambient Glow */}
                <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-[#EA580C]/20 rounded-full blur-2xl pointer-events-none"></div>

                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white"></span>
                      OPERATIONAL ADVANCE HELD
                    </span>

                    <button
                      onClick={() => setHideBalance(!hideBalance)}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white"
                      title={hideBalance ? 'Show Balance' : 'Hide Balance'}
                    >
                      {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                      {hideBalance ? '₦ ••••••••' : formatNaira(activeAdvanceAmount)}
                    </h2>
                    <p className="text-[11.5px] text-white/85 mt-1 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-white/70" />
                      Bank: {userProfile.bankName || 'Access Bank'} ({userProfile.accountNumber || '—'})
                    </p>
                  </div>

                  {/* Two Buttons: Request Funds (White) & Retire 72h (Orange) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => setIsNewRequestOpen(true)}
                      className="py-3 px-3 bg-white hover:bg-slate-50 text-[#064E3B] font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                    >
                      <ArrowUpRight className="w-4 h-4 text-[#064E3B]" />
                      <span>Request Funds</span>
                    </button>

                    <button
                      onClick={() => {
                        if (pendingRetirements.length > 0) {
                          setActiveRetirementCase(pendingRetirements[0]);
                          setActualSpentAmount(Number(pendingRetirements[0].request?.amountMinor || 0) / 100);
                        } else {
                          setActiveTab('RETIREMENT');
                        }
                      }}
                      className="py-3 px-3 bg-[#EA580C] hover:bg-orange-700 text-white font-black text-xs rounded-2xl shadow-md shadow-[#EA580C]/40 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                    >
                      <ArrowDownLeft className="w-4 h-4 text-white" />
                      <span>Retire 72h</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 3: MONTHLY SALARY & PAYSLIPS QUICK CARD */}
              <div className="p-4 bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-100 text-[#EA580C] flex items-center justify-center font-black">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A] leading-tight">
                      Monthly Salary & Payslips
                    </h3>
                    <p className="text-[11px] font-medium text-[#64748B] mt-0.5">
                      Scheduled Payday: 3rd · Bank: {userProfile.salaryBankName || userProfile.bankName || 'Corporate NUBAN'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsPayslipsModalOpen(true)}
                  className="px-3.5 py-2 bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] hover:bg-orange-600 hover:text-white rounded-xl text-xs font-black transition-all shadow-sm"
                >
                  View Slips
                </button>
              </div>

              {/* CARD 4: DUAL-KEY MAKER-CHECKER (If disbursements awaiting confirmation) */}
              {disbursementsAwaiting.length > 0 && (
                <div className="space-y-2.5">
                  {disbursementsAwaiting.map((disb: any) => (
                    <div
                      key={disb.id}
                      className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[20px] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#065F46] text-xs">
                          Treasury Payout Received
                        </span>
                        <span className="font-black text-[#065F46] text-sm">
                          {formatNaira(Number(disb.amountMinor || 0) / 100)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#047857] font-medium">
                        {disb.request?.title || 'Advance Disbursement'} (Ref: {disb.externalReference})
                      </p>
                      <div className="pt-2 flex gap-2">
                        <button
                          disabled={confirmingDisbursementId === disb.id}
                          onClick={() => handleConfirmDisbursement(disb.id)}
                          className="flex-1 py-2 bg-[#059669] hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs"
                        >
                          {confirmingDisbursementId === disb.id ? 'Confirming...' : 'Confirm Received'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION: 6 QUICK ACTION PASTEL TILES (Exact Flutter Colors & Typography) */}
              <div>
                <h3 className="text-sm font-black text-[#0F172A] mb-3">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* 1. New Request */}
                  <div
                    onClick={() => setIsNewRequestOpen(true)}
                    className="p-4 rounded-[20px] bg-[#FFF7ED] border border-[#FFEDD5] hover:border-orange-300 transition-all cursor-pointer space-y-2.5 shadow-sm hover:shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#EA580C]">
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#0F172A]">New Request</h4>
                      <p className="text-[10.5px] font-semibold text-[#64748B]">Operational</p>
                    </div>
                  </div>

                  {/* 2. Confirm Funds */}
                  <div
                    onClick={() => {
                      if (disbursementsAwaiting.length > 0) {
                        handleConfirmDisbursement(disbursementsAwaiting[0].id);
                      } else {
                        setAlertNotice('No pending disbursements to confirm at this time.');
                        setTimeout(() => setAlertNotice(null), 3000);
                      }
                    }}
                    className="p-4 rounded-[20px] bg-[#ECFDF5] border border-[#A7F3D0] hover:border-emerald-300 transition-all cursor-pointer space-y-2.5 shadow-sm hover:shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#059669]">
                      <CheckCheck className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#0F172A]">Confirm Funds</h4>
                      <p className="text-[10.5px] font-semibold text-[#64748B]">Dual-Key Auth</p>
                    </div>
                  </div>

                  {/* 3. 72h Evidence */}
                  <div
                    onClick={() => setActiveTab('RETIREMENT')}
                    className="p-4 rounded-[20px] bg-[#FFF1F2] border border-[#FECDD3] hover:border-rose-300 transition-all cursor-pointer space-y-2.5 shadow-sm hover:shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#E11D48]">
                      <Receipt className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#0F172A]">72h Evidence</h4>
                      <p className="text-[10.5px] font-semibold text-[#64748B]">Retire Advance</p>
                    </div>
                  </div>

                  {/* 4. My Profile */}
                  <div
                    onClick={() => setActiveTab('PROFILE')}
                    className="p-4 rounded-[20px] bg-[#EFF6FF] border border-[#BFDBFE] hover:border-blue-300 transition-all cursor-pointer space-y-2.5 shadow-sm hover:shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#2563EB]">
                      <User className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#0F172A]">My Profile</h4>
                      <p className="text-[10.5px] font-semibold text-[#64748B]">Bank Details</p>
                    </div>
                  </div>

                  {/* 5. Admin Helpdesk */}
                  <div
                    onClick={() => setIsAdminChatOpen(true)}
                    className="p-4 rounded-[20px] bg-[#F0FDF4] border border-[#A7F3D0] hover:border-emerald-300 transition-all cursor-pointer space-y-2.5 shadow-sm hover:shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#047857]">
                      <MessageSquare className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#0F172A]">Admin Helpdesk</h4>
                      <p className="text-[10.5px] font-semibold text-[#64748B]">Chat With Admin</p>
                    </div>
                  </div>

                  {/* 6. Requisitions */}
                  <div
                    onClick={() => setActiveTab('REQUESTS')}
                    className="p-4 rounded-[20px] bg-[#FFF7ED] border border-[#FED7AA] hover:border-orange-300 transition-all cursor-pointer space-y-2.5 shadow-sm hover:shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#EA580C]">
                      <FileText className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#0F172A]">Requisitions</h4>
                      <p className="text-[10.5px] font-semibold text-[#64748B]">View All & Chat</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: DEDICATED PROOF OF UTILIZATION BANNER CARD */}
              <div
                onClick={() => {
                  if (pendingRetirements.length > 0) {
                    setActiveRetirementCase(pendingRetirements[0]);
                  } else {
                    setActiveTab('RETIREMENT');
                  }
                }}
                className="p-4 bg-white rounded-[22px] border-2 border-[#FED7AA] shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center font-black">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#0F172A]">Proof of Utilization Card</h4>
                    <p className="text-[11px] text-[#64748B]">Snap picture or attach invoice document</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              {/* SECTION: RECENT REQUISITIONS */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-sm font-black text-[#0F172A]">Recent Requisitions</h3>
                  <button
                    onClick={() => setActiveTab('REQUESTS')}
                    className="text-xs font-bold text-[#EA580C] hover:underline"
                  >
                    See More
                  </button>
                </div>

                {requests.length === 0 ? (
                  <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    No requisitions recorded yet. Tap "+ New Request" to create your first fund request.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {requests.slice(0, 3).map((r: any) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRequestDetail(r)}
                        className="p-3.5 bg-white border border-[#E2E8F0] rounded-2xl hover:border-orange-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10.5px] font-black text-slate-400">{r.requestNumber}</span>
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
                          <h4 className="text-xs font-extrabold text-[#0F172A] line-clamp-1">{r.title}</h4>
                          <span className="text-[10px] text-[#64748B] block">
                            {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-[#0F172A] block">
                            {formatNaira(Number(r.amountMinor) / 100)}
                          </span>
                          <span className="text-[10px] font-bold text-[#EA580C] flex items-center gap-0.5 justify-end mt-0.5">
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
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#0F172A]">Expenditure Requisitions</h2>
                  <p className="text-xs text-[#64748B]">Manage & inspect your procurement requests ({requests.length})</p>
                </div>
                <button
                  onClick={() => setIsNewRequestOpen(true)}
                  className="px-3.5 py-2 bg-[#EA580C] text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md shadow-orange-500/20 hover:bg-orange-700"
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
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {/* Status Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {(['ALL', 'PENDING', 'APPROVED', 'PAID', 'RECURRING'] as const).map((code) => (
                  <button
                    key={code}
                    onClick={() => setStatusFilter(code)}
                    className={`px-3 py-1 rounded-full text-[11px] font-black whitespace-nowrap transition-all ${
                      statusFilter === code
                        ? 'bg-[#0F172A] text-white shadow-sm'
                        : 'bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {code === 'ALL'
                      ? `All Requests (${requests.length})`
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
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center text-xs text-slate-500">
                  No requisitions match your filter.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRequests.map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRequestDetail(r)}
                      className="p-4 bg-white border border-[#E2E8F0] rounded-2xl hover:border-orange-300 hover:shadow-md transition-all cursor-pointer"
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

                      <h3 className="text-sm font-extrabold text-[#0F172A] leading-snug">{r.title}</h3>
                      <p className="text-xs text-[#64748B] line-clamp-1 mt-0.5">{r.justification || 'No description provided'}</p>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-[#0F172A] text-sm">
                          {formatNaira(Number(r.amountMinor) / 100)}
                        </span>
                        <span className="text-[11px] text-[#64748B]">
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
          {/* TAB 2: 72H SLA & RETIREMENT DESK                          */}
          {/* ========================================================= */}
          {activeTab === 'RETIREMENT' && (
            <div className="space-y-3.5 animate-fade-in">
              <div>
                <h2 className="text-lg font-black text-[#0F172A]">72h SLA & Retirement Desk</h2>
                <p className="text-xs text-[#64748B]">Active advances and expense proof audit clearance</p>
              </div>

              {pendingRetirements.length === 0 ? (
                <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-3xl p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#059669] text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20 font-black">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black text-[#065F46]">100% Cleared & Compliant</h3>
                  <p className="text-xs text-[#047857] max-w-xs mx-auto">
                    You have no outstanding operational cash advances awaiting retirement. Your payroll standing is clear!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRetirements.map((c: any) => {
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
                          <span className="text-[10px] font-extrabold text-[#64748B] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                            Due: {new Date(c.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-[#0F172A]">{c.request?.title || 'Operational Cash Advance'}</h4>
                          <span className="text-xl font-black text-[#0F172A] block mt-1">{formatNaira(amount)}</span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex gap-2">
                          <button
                            onClick={() => {
                              setActiveRetirementCase(c);
                              setActualSpentAmount(amount);
                              setRefundReturnedAmount(0);
                            }}
                            className="w-full py-2.5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all"
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
              <div className="pt-2">
                <h3 className="text-xs font-black tracking-wider uppercase text-slate-400 mb-2 px-1">
                  Cleared Advances History
                </h3>
                {accountabilityCases.filter((c: any) => c.status === 'CLEARED' || c.status === 'APPROVED').length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-1">No cleared historical certificates yet.</p>
                ) : (
                  <div className="space-y-2">
                    {accountabilityCases
                      .filter((c: any) => c.status === 'CLEARED' || c.status === 'APPROVED')
                      .map((c: any) => (
                        <div
                          key={c.id}
                          className="p-3 bg-white border border-[#E2E8F0] rounded-2xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-[#0F172A] block">{c.request?.title || 'Cleared Advance'}</span>
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
          {/* TAB 3: COMPLETE STAFF PROFILE (Exact Flutter Replica)     */}
          {/* ========================================================= */}
          {activeTab === 'PROFILE' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-lg font-black text-[#0F172A]">Staff Identity & Credentials</h2>
                <p className="text-xs text-[#64748B]">Personal details, corporate placement & authorized disbursal accounts</p>
              </div>

              {/* 1. EMPLOYEE IDENTITY CARD (Exact Flutter White Card Replica) */}
              <div className="p-5 bg-white rounded-3xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-orange-500/25 overflow-hidden">
                    {user.avatarUrl && user.avatarUrl.startsWith('http') ? (
                      <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{user.fullName ? user.fullName[0].toUpperCase() : 'S'}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#EA580C] text-white flex items-center justify-center shadow">
                    <Camera className="w-3 h-3" />
                  </div>
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <h3 className="text-base font-black text-[#0F172A] truncate">{user.fullName}</h3>
                  <p className="text-xs font-bold text-[#EA580C]">{displayJobTitle}</p>
                  <p className="text-[11px] font-semibold text-[#64748B]">{displaySubsidiary} · {displayDepartment}</p>
                  <span className="inline-block px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-[9.5px] font-black uppercase">
                    EMP CODE: {displayEmployeeNumber}
                  </span>
                </div>
              </div>

              {/* 2. PERSONAL IDENTITY & CONTACT */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[#64748B] mb-2 px-1">
                  PERSONAL IDENTITY & CONTACT
                </h4>
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>Corporate Email</span>
                    </div>
                    <span className="font-extrabold text-[#0F172A]">{user.email}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>Phone Number</span>
                    </div>
                    <span className="font-extrabold text-[#0F172A]">{user.phone || '080-000-0000'}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Building className="w-4 h-4 text-slate-400" />
                      <span>Station Location</span>
                    </div>
                    <span className="font-extrabold text-[#0F172A]">{user.workLocation || 'Lagos HQ Station'}</span>
                  </div>
                </div>
              </div>

              {/* 3. COMPENSATION & STATUTORY PAYROLL */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[#64748B] mb-2 px-1">
                  COMPENSATION & STATUTORY PAYROLL
                </h4>
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-3 text-xs">
                  {compensationData ? (
                    <div className="grid grid-cols-2 gap-2 pb-2">
                      <div>
                        <span className="text-[10px] text-[#64748B] uppercase font-bold block">Base Gross Salary</span>
                        <span className="font-extrabold text-sm text-[#0F172A]">{compensationData.grossFormatted}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] uppercase font-bold block">Est. Take-Home Net</span>
                        <span className="font-extrabold text-sm text-[#059669]">{compensationData.netFormatted}</span>
                      </div>
                    </div>
                  ) : null}

                  <button
                    onClick={() => setIsPayslipsModalOpen(true)}
                    className="w-full py-2.5 bg-[#FFF7ED] border border-[#FED7AA] hover:bg-orange-600 hover:text-white text-[#EA580C] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>View Monthly Payslip Vouchers</span>
                  </button>
                </div>
              </div>

              {/* 4. CORPORATE DISBURSEMENT ACCOUNTS (DUAL BANKING) */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                    CORPORATE DISBURSEMENT ACCOUNTS
                  </h4>
                  <button
                    onClick={() => setIsDualBankingOpen(true)}
                    className="text-xs font-bold text-[#EA580C] hover:underline"
                  >
                    Configure
                  </button>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-extrabold uppercase text-[#64748B] block">
                      1. Operational Advance Account (72h Petty Cash)
                    </span>
                    <span className="font-black text-[#0F172A] block">
                      {userProfile.bankName || 'Not Set'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {userProfile.accountNumber || '—'} ({userProfile.accountName || user.fullName})
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-0.5">
                    <span className="text-[10px] font-extrabold uppercase text-[#EA580C] block">
                      2. Monthly Salary Account (3rd of Month Payroll)
                    </span>
                    <span className="font-black text-[#0F172A] block">
                      {userProfile.salaryBankName || userProfile.bankName || 'Not Set'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {userProfile.salaryAccountNumber || userProfile.accountNumber || '—'} ({userProfile.salaryAccountName || userProfile.accountName || user.fullName})
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. PORTAL SECURITY & CREDENTIALS */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[#64748B] mb-2 px-1">
                  PORTAL SECURITY & CREDENTIALS
                </h4>
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#0F172A]">Password & Security</h4>
                      <p className="text-[11px] text-[#64748B]">Update portal login credentials</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="px-3 py-1.5 bg-[#F1F5F9] hover:bg-slate-200 text-[#0F172A] rounded-xl text-xs font-bold transition-all"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* SIGN OUT */}
              <div className="pt-2">
                <Link
                  href="/finance"
                  className="w-full py-3 bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-red-50 hover:text-red-600 text-slate-600 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out from Portal</span>
                </Link>
              </div>
            </div>
          )}

        </main>

        {/* ========================================================= */}
        {/* BOTTOM NAVIGATION BAR (Exact Flutter Replica)              */}
        {/* ========================================================= */}
        <nav className="fixed md:absolute bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-2 flex items-center justify-around z-40 shadow-lg">
          {/* Home */}
          <button
            onClick={() => setActiveTab('HOME')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'HOME' ? 'text-[#EA580C] font-black' : 'text-[#94A3B8] font-bold hover:text-slate-600'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px]">Home</span>
          </button>

          {/* Requests */}
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
              activeTab === 'REQUESTS' ? 'text-[#EA580C] font-black' : 'text-[#94A3B8] font-bold hover:text-slate-600'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[11px]">Requests</span>
            {requests.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#EA580C]"></span>
            )}
          </button>

          {/* Center Elevated Action: New Request */}
          <button
            onClick={() => setIsNewRequestOpen(true)}
            className="w-12 h-12 -mt-5 rounded-full bg-gradient-to-tr from-[#EA580C] to-[#FB923C] text-white flex items-center justify-center shadow-lg shadow-[#EA580C]/40 hover:scale-105 active:scale-95 transition-all"
            title="Create New Requisition"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* 72h SLA */}
          <button
            onClick={() => setActiveTab('RETIREMENT')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
              activeTab === 'RETIREMENT' ? 'text-[#EA580C] font-black' : 'text-[#94A3B8] font-bold hover:text-slate-600'
            }`}
          >
            <Timer className="w-5 h-5" />
            <span className="text-[11px]">72h SLA</span>
            {pendingRetirements.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#EF4444] animate-pulse"></span>
            )}
          </button>

          {/* Profile */}
          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === 'PROFILE' ? 'text-[#EA580C] font-black' : 'text-[#94A3B8] font-bold hover:text-slate-600'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[11px]">Profile</span>
          </button>
        </nav>

        {/* ========================================================= */}
        {/* ALL MODALS & DRAWERS (ATTENDANCE, CHAT, PAYSLIPS, ETC)    */}
        {/* ========================================================= */}

        {/* Modal: Attendance Punch */}
        {isAttendancePunchOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Attendance Timekeeping</h3>
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
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  {punching ? 'Verifying...' : '✓ Punch Check-In'}
                </button>
                <button
                  disabled={punching}
                  onClick={() => handlePunchAttendance('CHECK_OUT')}
                  className="py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-black shadow-md shadow-slate-800/20 active:scale-95 transition-all"
                >
                  {punching ? 'Verifying...' : '⇥ Punch Check-Out'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Monthly Timesheet Calendar */}
        {isTimesheetModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-black">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Monthly Timesheet</h3>
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
                      <span className="text-sm font-black text-emerald-950">{attendanceData.summary?.presentDays || 0}</span>
                    </div>
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                      <span className="text-[10px] font-bold text-amber-600 block uppercase">Late</span>
                      <span className="text-sm font-black text-amber-950">{attendanceData.summary?.lateDays || 0}</span>
                    </div>
                    <div className="p-2.5 bg-red-50 rounded-xl border border-red-100">
                      <span className="text-[10px] font-bold text-red-600 block uppercase">Absent</span>
                      <span className="text-sm font-black text-red-950">{attendanceData.summary?.absentDays || 0}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Days Log</h4>
                    {attendanceData.days && attendanceData.days.length > 0 ? (
                      attendanceData.days.slice(0, 10).map((d: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-[#0F172A]">{d.date}</span>
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

        {/* Modal: Dual Banking Configuration */}
        {isDualBankingOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#0F172A]">Corporate Dual Banking</h3>
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
                <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] block">
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
                className="w-full py-3 bg-[#EA580C] hover:bg-orange-700 text-white rounded-2xl text-xs font-black shadow-md shadow-orange-500/20 active:scale-95 transition-all"
              >
                {savingBanking ? 'Saving Configuration...' : 'Save Corporate Accounts'}
              </button>
            </div>
          </div>
        )}

        {/* Modal: Payslips & Salary Vouchers Sheet */}
        {isPayslipsModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center font-black">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#0F172A]">Salary & Payslips Vouchers</h3>
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
                      <span className="text-base font-black text-white">{compensationData.grossFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Est. Take-Home</span>
                      <span className="text-base font-black text-emerald-400">{compensationData.netFormatted}</span>
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
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  Payment Vouchers & Receipts
                </h4>
                {payslips.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-slate-200/70 rounded-2xl text-center text-xs text-slate-500">
                    No payment vouchers generated yet. Monthly payroll is prepared on the 3rd.
                  </div>
                ) : (
                  payslips.map((p: any) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[#0F172A]">{p.period}</span>
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
                        <span>Net Paid: <b className="text-[#0F172A] font-black">{p.amountFormatted}</b></span>
                        <span className="text-[10px] text-slate-400">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'Pending'}</span>
                      </div>
                      {!p.confirmed && (
                        <div className="pt-2 flex gap-2">
                          <button
                            disabled={confirmingPayslipId === p.id}
                            onClick={() => handleConfirmPayslip(p.id)}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm"
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

        {/* Modal: 72h Retirement Evidence Upload */}
        {activeRetirementCase && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center font-black">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#0F172A]">Upload Retirement Proof</h3>
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
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-[#EA580C] hover:file:bg-orange-100"
                  />
                </div>
              </div>

              <button
                disabled={uploadingEvidence}
                onClick={handleSubmitRetirement}
                className="w-full py-3 bg-[#EA580C] hover:bg-orange-700 text-white rounded-2xl text-xs font-black shadow-md shadow-orange-500/20 active:scale-95 transition-all"
              >
                {uploadingEvidence ? 'Submitting Proof...' : 'Submit for GMD Clearance'}
              </button>
            </div>
          </div>
        )}

        {/* Modal: Requisition Details & Request-Level Chat */}
        {selectedRequestDetail && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black text-slate-400">{selectedRequestDetail.requestNumber}</span>
                  <h3 className="text-sm font-black text-[#0F172A]">{selectedRequestDetail.title}</h3>
                </div>
                <button onClick={() => setSelectedRequestDetail(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Requested</span>
                  <span className="text-xl font-black text-[#0F172A]">
                    {formatNaira(Number(selectedRequestDetail.amountMinor) / 100)}
                  </span>
                  <p className="text-[#64748B] text-[11px] mt-1">{selectedRequestDetail.justification || 'No justification provided'}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block">Approval Status</span>
                    <span className="font-extrabold text-[#0F172A]">{selectedRequestDetail.approvalStatus}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block">Disbursement</span>
                    <span className="font-extrabold text-[#0F172A]">{selectedRequestDetail.paymentStatus}</span>
                  </div>
                </div>

                {selectedRequestDetail.paymentStatus === 'PAID' && (
                  <button
                    onClick={() => {
                      const caseItem = accountabilityCases.find((c: any) => c.requestId === selectedRequestDetail.id);
                      if (caseItem) {
                        setActiveRetirementCase(caseItem);
                      } else {
                        setActiveTab('RETIREMENT');
                      }
                      setSelectedRequestDetail(null);
                    }}
                    className="w-full py-2.5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl font-black flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Receipts for this Advance
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Change Password */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#0F172A]">Change Password</h3>
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
                className="w-full py-3 bg-[#0F172A] hover:bg-slate-800 text-white rounded-2xl text-xs font-black shadow-md active:scale-95 transition-all"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        )}

        {/* Modal: Notifications Dialog */}
        {isNotificationsOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#EA580C]" />
                  <h3 className="text-sm font-black text-[#0F172A]">System Notifications</h3>
                </div>
                <button onClick={() => setIsNotificationsOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                <p className="font-extrabold text-[#0F172A]">All caught up!</p>
                <p>You have no unread high-priority notifications.</p>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Direct Admin Chat Desk */}
        {isAdminChatOpen && (
          <StaffAdminChatModal
            employeeId={user.id}
            employeeName={user.fullName}
            employeeNumber={user.employeeNumber}
            subsidiary={displaySubsidiary}
            onClose={() => setIsAdminChatOpen(false)}
          />
        )}

        {/* Modal: New Fund Requisition Modal */}
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
