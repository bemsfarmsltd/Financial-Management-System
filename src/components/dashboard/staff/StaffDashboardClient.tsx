'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { StaffNewFundRequestModal } from '@/components/requests/StaffNewFundRequestModal';
import { StaffAdminChatModal } from '@/components/chat/StaffAdminChatModal';
import { InAppChatPushToast } from '@/components/chat/InAppChatPushToast';
import { StaffInformationUpdateGateModal } from '@/components/dashboard/staff/StaffInformationUpdateGateModal';
import { StaffWalletTab } from '@/components/dashboard/staff/StaffWalletTab';
import { walletApi } from '@/lib/wallet/client';
import {
  Home,
  LayoutGrid,
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
  Building2,
  Users,
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
  ArrowLeft,
  Truck,
  Lightbulb,
  Sparkles,
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
  Target,
  Archive,
  PieChart,
  BarChart2,
  Trash2,
  Wifi,
  QrCode,
  Download,
  Smartphone,
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
  gender?: string | null;
  dateOfBirth?: string | null;
  residentialAddress?: string | null;
  cityState?: string | null;
  maritalStatus?: string | null;
  stateOfOrigin?: string | null;
  lga?: string | null;
  employmentType?: string | null;
  resumptionDate?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  nextOfKinRelationship?: string | null;
  nextOfKinAddress?: string | null;
}

interface StaffDashboardClientProps {
  user: StaffUser;
  businessName: string;
  subsidiaries?: any[];
  vendors?: any[];
  currentStaff?: any;
}

type TabType = 'HOME' | 'REQUESTS' | 'WALLET' | 'RETIREMENT' | 'PROFILE';
export type ModuleWorkstation = 'HUB' | 'FINANCE' | 'HR' | 'ACCOUNTABILITY' | 'OPERATIONS' | 'INNOVATION' | 'PROJECTS';

export function StaffDashboardClient({
  user,
  businessName,
  subsidiaries = [],
  vendors = [],
  currentStaff,
}: StaffDashboardClientProps) {
  // Navigation State - STRICTLY DEFAULTS TO HOME
  const [activeTab, setActiveTab] = useState<TabType>('HOME');

  // Workstation Module Gallery Navigation - STRICTLY DEFAULTS TO 'HUB' (Gallery Landing)
  const [activeWorkstation, setActiveWorkstation] = useState<ModuleWorkstation>('HUB');
  // 4-Slide Financial Card Carousel Index (0: Ever Requested, 1: Approved Undisbursed, 2: Yet To Be Approved, 3: Total Salary Ever Collected)
  const [financialSlideIndex, setFinancialSlideIndex] = useState<number>(0);

  // Innovation Module State (Direct Pitch to GMD)
  const [submittedIdeas, setSubmittedIdeas] = useState<any[]>([
    {
      id: 'idea-1',
      title: 'Solar & Inverter Micro-Grid at Studio Arella',
      summary: 'Automate switchover during grid drops to cut Starlink downtime & generator diesel expense by 40%.',
      category: 'OPERATIONS & ENERGY',
      status: 'UNDER_REVIEW',
      submittedAt: 'Today, 09:30 AM',
    },
    {
      id: 'idea-2',
      title: 'Client Proofing Portal for Media Delivery',
      summary: 'Direct client review pipeline with watermarked video drafts to shorten approval cycles.',
      category: 'TECH & MEDIA',
      status: 'APPROVED_FOR_PILOT',
      submittedAt: '2 days ago',
    },
  ]);
  const [isNewIdeaModalOpen, setIsNewIdeaModalOpen] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaCategory, setNewIdeaCategory] = useState('OPERATIONS & PROCESS');
  const [newIdeaProposal, setNewIdeaProposal] = useState('');
  const [submittingIdea, setSubmittingIdea] = useState(false);
  const [ideaNotice, setIdeaNotice] = useState<string | null>(null);

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
  const [hideAppBanner, setHideAppBanner] = useState(false);

  // Administrator-triggered mandatory information update gate
  const [pendingUpdateData, setPendingUpdateData] = useState<{
    request: any;
    currentData: any;
  } | null>(null);
  const [isUpdateGateOpen, setIsUpdateGateOpen] = useState(false);

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

  // Wallet Live State (Matching Mobile Digital Wallet)
  const [walletData, setWalletData] = useState<any>(null);

  // Mobile-grade Scanner Modal State
  const [isAttendanceScanModalOpen, setIsAttendanceScanModalOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'CAMERA' | 'PIN'>('CAMERA');
  const [kioskPinInput, setKioskPinInput] = useState('');
  const [scannerCameraError, setScannerCameraError] = useState<string | null>(null);
  const [scannerFacingMode, setScannerFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannerTorchOn, setScannerTorchOn] = useState(false);
  const [scannerManualTokenOpen, setScannerManualTokenOpen] = useState(false);
  const [scannerManualTokenInput, setScannerManualTokenInput] = useState('');
  const [scannerPunchSuccessRecord, setScannerPunchSuccessRecord] = useState<any | null>(null);
  const [scannerGpsCoords, setScannerGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [scannerGpsStatus, setScannerGpsStatus] = useState<'ACQUIRING' | 'READY' | 'ERROR'>('ACQUIRING');
  const [scannerGpsAccuracy, setScannerGpsAccuracy] = useState<number | null>(null);
  const [scannerGpsError, setScannerGpsError] = useState<string | null>(null);
  const [scannerDetectedCode, setScannerDetectedCode] = useState<string | null>(null);
  const [scannerIsScanning, setScannerIsScanning] = useState<boolean>(true);
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const scannerFileInputRef = useRef<HTMLInputElement>(null);

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
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneNotice, setPhoneNotice] = useState<string | null>(null);
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

  // Monnify Real-Time Verification State
  const [isVerifyingAdvance, setIsVerifyingAdvance] = useState(false);
  const [advanceVerifiedName, setAdvanceVerifiedName] = useState<string | null>(null);
  const [advanceVerifyError, setAdvanceVerifyError] = useState<string | null>(null);
  const [isVerifyingSalary, setIsVerifyingSalary] = useState(false);
  const [salaryVerifiedName, setSalaryVerifiedName] = useState<string | null>(null);
  const [salaryVerifyError, setSalaryVerifyError] = useState<string | null>(null);

  useEffect(() => {
    const clean = accountNumber.trim().replace(/\D/g, '');
    if (clean.length === 10 && bankName) {
      setIsVerifyingAdvance(true);
      setAdvanceVerifyError(null);
      fetch('/api/banking/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: clean, bankName }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.isValid && d.accountName) {
            setAdvanceVerifiedName(d.accountName);
            setAccountName(d.accountName);
          } else {
            setAdvanceVerifiedName(null);
            setAdvanceVerifyError(d.message || 'Could not verify account.');
          }
        })
        .catch(() => {
          setAdvanceVerifiedName(null);
          setAdvanceVerifyError('Verification failed. Check network.');
        })
        .finally(() => setIsVerifyingAdvance(false));
    } else {
      setAdvanceVerifiedName(null);
      setAdvanceVerifyError(null);
    }
  }, [accountNumber, bankName]);

  useEffect(() => {
    const clean = salaryAccountNumber.trim().replace(/\D/g, '');
    if (clean.length === 10 && salaryBankName) {
      setIsVerifyingSalary(true);
      setSalaryVerifyError(null);
      fetch('/api/banking/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: clean, bankName: salaryBankName }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.isValid && d.accountName) {
            setSalaryVerifiedName(d.accountName);
            setSalaryAccountName(d.accountName);
          } else {
            setSalaryVerifiedName(null);
            setSalaryVerifyError(d.message || 'Could not verify salary account.');
          }
        })
        .catch(() => {
          setSalaryVerifiedName(null);
          setSalaryVerifyError('Salary verification failed. Check network.');
        })
        .finally(() => setIsVerifyingSalary(false));
    } else {
      setSalaryVerifiedName(null);
      setSalaryVerifyError(null);
    }
  }, [salaryAccountNumber, salaryBankName]);

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

      // Check for pending administrator profile update action
      fetch('/api/staff/profile/pending-update')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.hasPendingUpdate && d.request) {
            setPendingUpdateData({ request: d.request, currentData: d.currentData });
            setIsUpdateGateOpen(true);
          } else {
            setIsUpdateGateOpen(false);
            setPendingUpdateData(null);
          }
        })
        .catch(() => {});

      const rawRequests = Array.isArray(reqRes) ? reqRes : reqRes?.requests || [];
      const myReqs = rawRequests.filter(
        (r: any) =>
          r.requestedById === user.id ||
          r.requester?.workEmail?.toLowerCase() === user.email.toLowerCase() ||
          r.requesterId === user.id
      );
      setRequests(myReqs);

      const rawCases = Array.isArray(caseRes) ? caseRes : caseRes?.cases || [];
      const myReqIds = new Set(myReqs.map((r: any) => r.id));
      const myCases = rawCases.filter(
        (c: any) =>
          c.ownerUserId === user.id ||
          c.owner?.workEmail?.toLowerCase() === user.email.toLowerCase() ||
          c.request?.requestedById === user.id ||
          (c.requestId && myReqIds.has(c.requestId))
      );

      // Ensure all paid advances have an accountability item in staff workspace
      for (const r of myReqs) {
        if (
          r.paymentStatus === 'PAID' ||
          r.paymentStatus === 'RECIPIENT_CONFIRMED' ||
          r.accountabilityStatus === 'OPEN' ||
          r.accountabilityStatus === 'EVIDENCE_SUBMITTED' ||
          r.approvalStatus === 'APPROVED'
        ) {
          const alreadyHasCase = myCases.some(
            (c: any) => c.requestId === r.id || c.request?.requestNumber === r.requestNumber
          );
          if (!alreadyHasCase && (r.paymentStatus === 'PAID' || r.paymentStatus === 'RECIPIENT_CONFIRMED' || r.accountabilityStatus === 'OPEN' || r.accountabilityStatus === 'EVIDENCE_SUBMITTED')) {
            myCases.push({
              id: `case-${r.id}`,
              requestId: r.id,
              requestNumber: r.requestNumber,
              title: r.title,
              request: r,
              amountMinor: r.amountMinor,
              amountNaira: Number(r.amountMinor) / 100,
              requiredDeliverables: r.deliverable || 'Itemized receipt and proof of delivery',
              bankReference: r.bankReference || 'BEMS-TRX-AUTO',
              status: r.accountabilityStatus || 'OPEN',
              dueAt: r.dueDate || new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
            });
          }
        }
      }
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

      if (attRes) {
        const todayPrefix = new Date().toISOString().split('T')[0];
        const match =
          attRes.today ||
          attRes.calendar?.today ||
          (attRes.records && attRes.records.find((r: any) => r.workDate === todayPrefix)) ||
          (attRes.days && attRes.days.find((d: any) => d.date === todayPrefix && (d.checkInTime || d.status !== 'UPCOMING')));
        setTodayAttendance(match || null);
      }

      // Load wallet balance & accounts
      try {
        const wRes = await walletApi('me');
        if (wRes) setWalletData(wRes);
      } catch (e) {
        // wallet load optional
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

  // Auto-prompt attendance modal if staff is not clocked in today (Strictly Staff only, never Executive)
  useEffect(() => {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'STAFF' && !todayAttendance && !loading) {
      const timer = setTimeout(() => {
        setIsAttendanceScanModalOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [todayAttendance, loading, user?.role]);

  // Load Attendance
  const loadAttendance = async (m: number, y: number) => {
    try {
      setLoadingAttendance(true);
      const res = await fetch(`/api/attendance/timesheet?employeeId=${user.id}&month=${m}&year=${y}`);
      if (res.ok) {
        const data = await res.json();
        setAttendanceData(data?.calendar || data || null);
        const todayPrefix = new Date().toISOString().split('T')[0];
        const match =
          data.today ||
          data.calendar?.today ||
          (data.records && data.records.find((r: any) => r.workDate === todayPrefix)) ||
          (data.days && data.days.find((d: any) => d.date === todayPrefix && (d.checkInTime || d.status !== 'UPCOMING')));
        if (match) {
          setTodayAttendance(match);
        }
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

  // Requisition chart toggle: 'Category' | 'Status'
  const [requisitionChartMetric, setRequisitionChartMetric] = useState<'Category' | 'Status'>('Category');
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      if (typeof document !== 'undefined') {
        document.cookie = 'bems_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
        document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
      }
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      if (typeof window !== 'undefined') {
        window.location.replace('/');
      }
    }
  };

  // Active advances requiring accountability (Disbursed advances not yet verified/closed by Finance)
  const activeAdvanceCases = useMemo(() => {
    return accountabilityCases.filter((c: any) => {
      const s = String(c.status || '').toUpperCase();
      const acc = String(c.request?.accountabilityStatus || '').toUpperCase();
      return (
        s !== 'CLOSED' &&
        s !== 'VERIFIED' &&
        s !== 'CLEARED' &&
        s !== 'RECONCILED' &&
        acc !== 'CLOSED' &&
        acc !== 'VERIFIED'
      );
    });
  }, [accountabilityCases]);

  // Unsubmitted advances (Still waiting for staff to upload receipts within 72h)
  const pendingRetirements = useMemo(() => {
    return activeAdvanceCases.filter((c: any) => {
      const s = String(c.status || '').toUpperCase();
      const acc = String(c.request?.accountabilityStatus || '').toUpperCase();
      return s !== 'EVIDENCE_SUBMITTED' && acc !== 'EVIDENCE_SUBMITTED';
    });
  }, [activeAdvanceCases]);

  // Advances where staff has submitted evidence, now awaiting Finance clearance
  const submittedUnderReviewCases = useMemo(() => {
    return activeAdvanceCases.filter((c: any) => {
      const s = String(c.status || '').toUpperCase();
      const acc = String(c.request?.accountabilityStatus || '').toUpperCase();
      return s === 'EVIDENCE_SUBMITTED' || acc === 'EVIDENCE_SUBMITTED';
    });
  }, [activeAdvanceCases]);

  // Cleared / Archived retirements (Only cases verified and closed by Finance)
  const clearedRetirements = useMemo(() => {
    const list: any[] = [];
    for (const c of accountabilityCases) {
      const s = String(c.status || '').toUpperCase();
      const acc = String(c.request?.accountabilityStatus || '').toUpperCase();
      if (
        s === 'CLOSED' ||
        s === 'VERIFIED' ||
        s === 'CLEARED' ||
        acc === 'CLOSED' ||
        acc === 'VERIFIED'
      ) {
        list.push(c);
      }
    }
    for (const r of requests) {
      const acc = String(r.accountabilityStatus || '').toUpperCase();
      if (acc === 'CLOSED' || acc === 'VERIFIED') {
        if (!list.some((c: any) => c.request?.requestNumber === r.requestNumber)) {
          list.push({
            id: `req-${r.id}`,
            request: r,
            amountMinor: r.amountMinor,
            amountNaira: Number(r.amountMinor) / 100,
            status: acc,
            requiredDeliverables: r.deliverable || 'Itemized receipt and proof of delivery',
            dueAt: r.updatedAt || r.createdAt,
          });
        }
      }
    }
    return list;
  }, [accountabilityCases, requests]);

  // Total active advance amount held (All disbursed advances not yet verified/closed by Finance)
  const activeAdvanceAmount = useMemo(() => {
    return activeAdvanceCases.reduce((sum, c) => {
      const amt = Number(c.request?.amountMinor || c.amountMinor || c.amount || c.amountNaira || 0);
      const normalizedAmt = amt > 100000000 && !c.amountNaira ? amt / 100 : (c.amountNaira || amt);
      return sum + (isNaN(normalizedAmt) ? 0 : normalizedAmt);
    }, 0);
  }, [activeAdvanceCases]);

  const nearestAdvanceCase = useMemo(() => {
    const candidateList = pendingRetirements.length > 0 ? pendingRetirements : activeAdvanceCases;
    if (candidateList.length === 0) return null;
    return [...candidateList].sort((a: any, b: any) => {
      const timeA = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const timeB = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return timeA - timeB;
    })[0];
  }, [pendingRetirements]);

  const { slaHoursRemaining, slaHoursElapsed, isSlaOverdue } = useMemo(() => {
    if (!nearestAdvanceCase) return { slaHoursRemaining: 0, slaHoursElapsed: 0, isSlaOverdue: false };
    const dueTime = nearestAdvanceCase.dueAt
      ? new Date(nearestAdvanceCase.dueAt).getTime()
      : Date.now() + 72 * 3600 * 1000;
    const now = Date.now();
    const diffHours = Math.round((dueTime - now) / (1000 * 60 * 60));
    const rem = Math.max(0, diffHours);
    const elapsed = Math.min(72, Math.max(0, 72 - rem));
    return {
      slaHoursRemaining: rem > 0 ? rem : 0,
      slaHoursElapsed: elapsed,
      isSlaOverdue: diffHours < 0,
    };
  }, [nearestAdvanceCase]);

  const clearedCount = clearedRetirements.length;
  const inGraceCount = pendingRetirements.filter((c: any) => {
    const dueTime = c.dueAt ? new Date(c.dueAt).getTime() : Date.now() + 1000;
    return dueTime > Date.now();
  }).length;
  const overdueCount = pendingRetirements.filter((c: any) => {
    const dueTime = c.dueAt ? new Date(c.dueAt).getTime() : Date.now() + 1000;
    return dueTime <= Date.now();
  }).length;
  const totalSlaCases = clearedCount + inGraceCount + overdueCount;
  const compliancePct = overdueCount > 0 ? Math.round(((clearedCount + inGraceCount) / totalSlaCases) * 100) : 100;

  // Expenditure Distribution Segments
  const expenditureSegments = useMemo(() => {
    if (requests.length === 0) return [];
    const colorPalette = ['#EA580C', '#F97316', '#FB923C', '#FDBA74', '#334155', '#475569', '#0F172A'];
    if (requisitionChartMetric === 'Category') {
      const catMap: Record<string, { value: number; count: number }> = {};
      for (const r of requests) {
        const cat = r.category || 'Office Expense';
        const amt = Number(r.amountMinor || 0) / 100;
        if (!catMap[cat]) catMap[cat] = { value: 0, count: 0 };
        catMap[cat].value += amt;
        catMap[cat].count += 1;
      }
      return Object.entries(catMap)
        .sort((a, b) => b[1].value - a[1].value)
        .map(([label, data], idx) => ({
          label,
          value: data.value,
          count: data.count,
          color: colorPalette[idx % colorPalette.length],
        }));
    } else {
      let inReviewVal = 0, inReviewCount = 0;
      let approvedVal = 0, approvedCount = 0;
      let disbursedVal = 0, disbursedCount = 0;
      let rejectedVal = 0, rejectedCount = 0;

      for (const r of requests) {
        const amt = Number(r.amountMinor || 0) / 100;
        const isDisbursed =
          r.paymentStatus === 'PAID' ||
          r.paymentStatus === 'RECIPIENT_CONFIRMED' ||
          r.accountabilityStatus === 'EVIDENCE_SUBMITTED' ||
          r.accountabilityStatus === 'CLOSED' ||
          r.accountabilityStatus === 'VERIFIED';

        if (isDisbursed) {
          disbursedVal += amt;
          disbursedCount++;
        } else if (r.approvalStatus === 'APPROVED') {
          approvedVal += amt;
          approvedCount++;
        } else if (r.approvalStatus === 'REJECTED') {
          rejectedVal += amt;
          rejectedCount++;
        } else {
          inReviewVal += amt;
          inReviewCount++;
        }
      }

      const segs = [];
      if (inReviewCount > 0) segs.push({ label: 'In Review', value: inReviewVal, count: inReviewCount, color: '#EA580C' });
      if (approvedCount > 0) segs.push({ label: 'Approved', value: approvedVal, count: approvedCount, color: '#3B82F6' });
      if (disbursedCount > 0) segs.push({ label: 'Disbursed', value: disbursedVal, count: disbursedCount, color: '#10B981' });
      if (rejectedCount > 0) segs.push({ label: 'Declined', value: rejectedVal, count: rejectedCount, color: '#EF4444' });
      return segs;
    }
  }, [requests, requisitionChartMetric]);

  const totalExpenditureValue = useMemo(() => {
    return requests.reduce((sum, r) => sum + Number(r.amountMinor || 0) / 100, 0);
  }, [requests]);

  const compactExpenditureTotal = useMemo(() => {
    if (totalExpenditureValue >= 1000000000000) {
      return `₦${(totalExpenditureValue / 1000000000000).toFixed(1)}T`;
    } else if (totalExpenditureValue >= 1000000000) {
      return `₦${(totalExpenditureValue / 1000000000).toFixed(1)}B`;
    } else if (totalExpenditureValue >= 1000000) {
      return `₦${(totalExpenditureValue / 1000000).toFixed(1)}M`;
    } else if (totalExpenditureValue >= 1000) {
      return `₦${(totalExpenditureValue / 1000).toFixed(0)}K`;
    }
    return `₦${totalExpenditureValue.toFixed(0)}`;
  }, [totalExpenditureValue]);

  // =========================================================================
  // 4-SLIDE FINANCIAL CAROUSEL COMPUTATIONS
  // Slide 0: Total Amount Ever Requested
  // Slide 1: Approved Yet To Be Disbursed (Approved by GMD, awaiting treasury payment)
  // Slide 2: Yet To Be Approved (Pending Review in workflow)
  // Slide 3: Total Salary Ever Collected + Next Pending Salary
  // =========================================================================
  const financialSlideMetrics = useMemo(() => {
    // 1. Total Ever Requested
    const totalEverRequestedAmount = requests.reduce((sum, r) => sum + (Number(r.amountMinor || 0) / 100), 0);
    const totalEverRequestedCount = requests.length;

    // 2. Approved Yet To Be Disbursed
    const approvedUndisbursedList = requests.filter(r => {
      const isApproved = r.approvalStatus === 'APPROVED' || r.status === 'APPROVED';
      const isDisbursed =
        r.paymentStatus === 'PAID' ||
        r.paymentStatus === 'RECIPIENT_CONFIRMED' ||
        r.accountabilityStatus === 'EVIDENCE_SUBMITTED' ||
        r.accountabilityStatus === 'CLOSED' ||
        r.accountabilityStatus === 'VERIFIED';
      return isApproved && !isDisbursed;
    });
    const approvedUndisbursedAmount = approvedUndisbursedList.reduce((sum, r) => sum + (Number(r.amountMinor || 0) / 100), 0);
    const approvedUndisbursedCount = approvedUndisbursedList.length;

    // 3. Yet To Be Approved (Pending Review)
    const pendingApprovalList = requests.filter(r => {
      const isApproved = r.approvalStatus === 'APPROVED' || r.status === 'APPROVED';
      const isRejected = r.approvalStatus === 'REJECTED' || r.status === 'REJECTED';
      return !isApproved && !isRejected;
    });
    const pendingApprovalAmount = pendingApprovalList.reduce((sum, r) => sum + (Number(r.amountMinor || 0) / 100), 0);
    const pendingApprovalCount = pendingApprovalList.length;

    // 4. Total Salary Ever Collected & Next Pending Salary
    let salaryCollected = 0;
    if (payslips && payslips.length > 0) {
      salaryCollected = payslips.reduce((sum, p) => sum + (Number(p.netMinor || p.grossMinor || 0) / 100), 0);
    } else if (allDisbursements && allDisbursements.length > 0) {
      const salaryDisbs = allDisbursements.filter(d => d.type === 'SALARY' || d.category === 'SALARY');
      salaryCollected = salaryDisbs.reduce((sum, d) => sum + (Number(d.amountMinor || 0) / 100), 0);
    }

    // Base Monthly Salary from Employment Agreement
    const baseMinor = Number(compensationData?.grossMinor || currentStaff?.grossMinor || 0);
    const baseMonthly = baseMinor > 0 ? baseMinor / 100 : 0;
    const activeDeductionPct = todayAttendance?.deductionPercent || 0;
    const estDailyDeduction = (activeDeductionPct / 100) * (baseMonthly / 22);
    const nextPendingSalary = Math.max(0, baseMonthly - estDailyDeduction);

    return {
      totalEverRequestedAmount,
      totalEverRequestedCount,
      approvedUndisbursedAmount,
      approvedUndisbursedCount,
      pendingApprovalAmount,
      pendingApprovalCount,
      salaryCollected,
      nextPendingSalary: nextPendingSalary > 0 ? nextPendingSalary : baseMonthly,
      baseMonthly,
    };
  }, [requests, payslips, allDisbursements, userProfile, currentStaff, todayAttendance]);

  // Smart Attendance Visibility:
  // 1. If not checked in today -> SHOW (to clock in)
  // 2. If checked in today:
  //    - Before 5:00 PM (17:00) -> HIDE (user already clocked in in the morning)
  //    - From 5:00 PM (17:00) onwards -> SHOW (to clock out / sign out)
  // 3. If checked out today -> HIDE (workday completed)
  const shouldShowAttendanceCard = useMemo(() => {
    if (!todayAttendance) {
      return true; // Not checked in yet -> show clock-in card
    }
    const hasCheckedOut = !!todayAttendance.checkOutTime;
    if (hasCheckedOut) {
      return false; // Workday complete -> hide
    }
    // Checked in, but not checked out:
    // Only show if it's 5:00 PM (17:00) or later
    const currentHour = new Date().getHours();
    return currentHour >= 17;
  }, [todayAttendance]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = r.requestNumber?.toLowerCase().includes(q);
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchPayee = r.payeeName?.toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchPayee) return false;
      }
      const isDisbursed =
        r.paymentStatus === 'PAID' ||
        r.paymentStatus === 'RECIPIENT_CONFIRMED' ||
        r.accountabilityStatus === 'EVIDENCE_SUBMITTED' ||
        r.accountabilityStatus === 'CLOSED' ||
        r.accountabilityStatus === 'VERIFIED';

      if (statusFilter === 'PENDING') return r.approvalStatus === 'SUBMITTED' || r.approvalStatus === 'IN_REVIEW';
      if (statusFilter === 'APPROVED') return r.approvalStatus === 'APPROVED' && !isDisbursed;
      if (statusFilter === 'PAID') return isDisbursed;
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

  // Camera Stream Lifecycle & High-Precision GPS for Attendance Scanner
  useEffect(() => {
    if (!isAttendanceScanModalOpen) {
      setScannerDetectedCode(null);
      setScannerIsScanning(true);
      return;
    }
    let currentStream: MediaStream | null = null;
    let geoWatchId: number | null = null;

    async function initCamera() {
      setScannerCameraError(null);
      setScannerDetectedCode(null);
      setScannerIsScanning(true);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not supported on this device/browser');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: scannerFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        currentStream = stream;
        if (scannerVideoRef.current) {
          scannerVideoRef.current.srcObject = stream;
          scannerVideoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        setScannerCameraError(err.message || 'Camera permission denied or camera not found');
      }
    }

    initCamera();

    // Acquire high-precision GPS position for geofence verification
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setScannerGpsStatus('ACQUIRING');
      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          setScannerGpsCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setScannerGpsAccuracy(Math.round(pos.coords.accuracy));
          setScannerGpsStatus('READY');
          setScannerGpsError(null);
        },
        (err) => {
          setScannerGpsStatus('ERROR');
          setScannerGpsError(err.message || 'Location permission required to verify office perimeter');
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
      );
    } else {
      setScannerGpsStatus('ERROR');
      setScannerGpsError('Geolocation is not supported by your browser');
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      if (geoWatchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
    };
  }, [isAttendanceScanModalOpen, scannerFacingMode]);

  // Continuous Video Frame QR Decoding Engine (Native BarcodeDetector + jsQR fallback)
  useEffect(() => {
    if (!isAttendanceScanModalOpen || !scannerIsScanning || punching || scannerPunchSuccessRecord) {
      return;
    }

    let animationFrameId: number;
    let lastScanTime = 0;
    let isCancelled = false;

    // Detect BarcodeDetector API availability
    let barcodeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        barcodeDetector = null;
      }
    }

    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    async function scanLoop(timestamp: number) {
      if (isCancelled) return;

      const video = scannerVideoRef.current;
      // Scan every 180ms to keep CPU minimal while providing instant response
      if (video && video.readyState >= 2 && video.videoWidth > 0 && timestamp - lastScanTime > 180) {
        lastScanTime = timestamp;
        try {
          let detectedToken: string | null = null;

          // Priority 1: Hardware-accelerated BarcodeDetector
          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(video);
              if (barcodes && barcodes.length > 0) {
                for (const b of barcodes) {
                  const val = b.rawValue?.trim();
                  if (val && (val.startsWith('BEMSQR:') || val.length >= 8)) {
                    detectedToken = val;
                    break;
                  }
                }
              }
            } catch {
              // Ignore and fall through to jsQR
            }
          }

          // Priority 2: jsQR Canvas Frame Analysis
          if (!detectedToken && offscreenCtx) {
            const scale = Math.min(1, 480 / video.videoWidth);
            const w = Math.floor(video.videoWidth * scale);
            const h = Math.floor(video.videoHeight * scale);

            if (offscreenCanvas.width !== w || offscreenCanvas.height !== h) {
              offscreenCanvas.width = w;
              offscreenCanvas.height = h;
            }

            offscreenCtx.drawImage(video, 0, 0, w, h);
            const imgData = offscreenCtx.getImageData(0, 0, w, h);
            const code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code && code.data) {
              const val = code.data.trim();
              if (val.startsWith('BEMSQR:') || val.length >= 8) {
                detectedToken = val;
              }
            }
          }

          if (detectedToken && !isCancelled) {
            setScannerDetectedCode(detectedToken);
            setScannerIsScanning(false);
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate([40, 50, 40]); } catch {}
            }
            // Auto punch attendance immediately
            handlePunchAttendance(todayAttendance ? 'CHECK_OUT' : 'CHECK_IN', detectedToken);
            return;
          }
        } catch {
          // ignore scan frame exception and continue next tick
        }
      }

      if (!isCancelled) {
        animationFrameId = requestAnimationFrame(scanLoop);
      }
    }

    animationFrameId = requestAnimationFrame(scanLoop);

    return () => {
      isCancelled = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isAttendanceScanModalOpen, scannerIsScanning, punching, scannerPunchSuccessRecord, todayAttendance]);

  const toggleScannerTorch = async () => {
    if (!scannerVideoRef.current || !scannerVideoRef.current.srcObject) return;
    try {
      const stream = scannerVideoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities?.() || {};
      if (capabilities.torch) {
        await (track as any).applyConstraints({
          advanced: [{ torch: !scannerTorchOn }],
        });
        setScannerTorchOn(!scannerTorchOn);
      } else {
        setScannerTorchOn(!scannerTorchOn);
      }
    } catch {
      setScannerTorchOn(!scannerTorchOn);
    }
  };

  // Upload Photo / Screenshot QR Code Fallback
  const handleImageFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPunchStatusMessage(null);
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, canvas.width, canvas.height);
          if (code && code.data && code.data.trim()) {
            const token = code.data.trim();
            setScannerDetectedCode(token);
            setScannerIsScanning(false);
            handlePunchAttendance(todayAttendance ? 'CHECK_OUT' : 'CHECK_IN', token);
          } else {
            setPunchStatusMessage('✕ No valid BEMS QR code found in the uploaded image. Please ensure the QR code on the kiosk is clearly visible.');
          }
        }
      };
      img.onerror = () => {
        setPunchStatusMessage('✕ Failed to read image file.');
      };
      img.src = objectUrl;
    } catch (err: any) {
      setPunchStatusMessage(`✕ Error loading image: ${err.message}`);
    }
  };

  // Handlers
  const handlePunchAttendance = async (type: 'CHECK_IN' | 'CHECK_OUT', customToken?: string) => {
    setPunching(true);
    setPunchStatusMessage(null);
    try {
      // 1. Determine token: customToken -> scannerDetectedCode -> fetch station token fallback
      let tokenToUse = customToken?.trim() || scannerDetectedCode?.trim();

      if (!tokenToUse) {
        const qrRes = await fetch('/api/attendance/station/qr');
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          if (qrData.qrToken) {
            tokenToUse = qrData.qrToken;
          }
        }
      }

      if (!tokenToUse) {
        throw new Error('No QR code detected. Point camera at the reception kiosk screen or enter code manually.');
      }

      // 2. Acquire real live device GPS coordinates
      let lat: number | null = scannerGpsCoords?.lat ?? null;
      let lng: number | null = scannerGpsCoords?.lng ?? null;

      if (lat === null || lng === null) {
        if (typeof window !== 'undefined' && 'geolocation' in navigator) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 5000,
              });
            });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            setScannerGpsCoords({ lat, lng });
            setScannerGpsAccuracy(Math.round(pos.coords.accuracy));
            setScannerGpsStatus('READY');
          } catch {
            throw new Error('Real GPS location required to verify office perimeter. Please allow location access in your browser.');
          }
        } else {
          throw new Error('Geolocation is not supported by your browser.');
        }
      }

      // 3. Post punch request to API
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.id,
          qrToken: tokenToUse,
          latitude: lat,
          longitude: lng,
          type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to punch attendance.');
      }

      const record = data.record || {};
      const statusText = record.status || (type === 'CHECK_IN' ? 'PRESENT' : 'COMPLETED');
      const timeStr = record.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setScannerPunchSuccessRecord({
        type,
        status: statusText,
        time: timeStr,
        date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      });

      setTodayAttendance({
        status: statusText,
        checkInTime: record.checkInTime || new Date().toISOString(),
        checkOutTime: type === 'CHECK_OUT' ? (record.checkOutTime || new Date().toISOString()) : null,
      });

      setScannerManualTokenOpen(false);
      setScannerManualTokenInput('');
    } catch (err: any) {
      setPunchStatusMessage(`✕ ${err.message || 'Failed to verify attendance'}`);
      // Resume scanning on failure so staff can re-align immediately
      setScannerIsScanning(true);
      setScannerDetectedCode(null);
    } finally {
      setPunching(false);
    }
  };

  const handleKioskPinPunch = async () => {
    if (!kioskPinInput || kioskPinInput.trim().length < 4) {
      setPunchStatusMessage('✕ Please enter your 4-digit Kiosk PIN.');
      return;
    }
    setPunching(true);
    setPunchStatusMessage(null);
    try {
      const res = await fetch('/api/attendance/kiosk-punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeNumber: displayEmployeeNumber,
          pin: kioskPinInput.trim(),
          type: todayAttendance ? 'CHECK_OUT' : 'CHECK_IN',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to punch attendance with PIN.');
      }
      const record = data.record || {};
      const statusText = record.status || (todayAttendance ? 'COMPLETED' : 'PRESENT');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setScannerPunchSuccessRecord({
        type: todayAttendance ? 'CHECK_OUT' : 'CHECK_IN',
        status: statusText,
        time: timeStr,
        date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      });
      setTodayAttendance({
        status: statusText,
        checkInTime: record.checkInTime || new Date().toISOString(),
        checkOutTime: todayAttendance ? (record.checkOutTime || new Date().toISOString()) : null,
      });
      setKioskPinInput('');
    } catch (err: any) {
      setPunchStatusMessage(`✕ ${err.message || 'Failed to verify PIN'}`);
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

  const handleSavePhone = async () => {
    if (!phoneInput || phoneInput.trim().length < 8) {
      setPhoneNotice('Please enter a valid telephone number.');
      return;
    }
    setSavingPhone(true);
    setPhoneNotice(null);
    try {
      const res = await fetch(`/api/staff/${user.id}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update phone number.');
      setUserProfile((prev) => ({ ...prev, phone: phoneInput.trim() }));
      setAlertNotice('✓ Phone number updated successfully!');
      setTimeout(() => setAlertNotice(null), 3000);
      setIsPhoneModalOpen(false);
    } catch (err: any) {
      setPhoneNotice(err.message);
    } finally {
      setSavingPhone(false);
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col selection:bg-orange-100 selection:text-orange-900 font-sans w-full">
      {/* ========================================================= */}
      {/* TOP HEADER: SPANS FROM LEFT TO RIGHT ACROSS ENTIRE SCREEN */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-sm w-full">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          {/* Left: Avatar + Identity */}
          <div className="flex items-center gap-3">
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

          {/* Center: Desktop Navigation Tabs (Spreads Across from Left to Right) */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => {
                setActiveTab('HOME');
                setActiveWorkstation('HUB');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'HOME' && activeWorkstation === 'HUB'
                  ? 'bg-white text-[#EA580C] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Module Gallery</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('HOME');
                setActiveWorkstation('FINANCE');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all relative ${
                activeTab === 'HOME' && activeWorkstation === 'FINANCE'
                  ? 'bg-white text-[#EA580C] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Financial Hub</span>
              {requests.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black">
                  {requests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsNewRequestOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md shadow-orange-500/25 hover:opacity-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Request</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('HOME');
                setActiveWorkstation('ACCOUNTABILITY');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'HOME' && activeWorkstation === 'ACCOUNTABILITY'
                  ? 'bg-white text-[#EA580C] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>72h SLA</span>
              {pendingRetirements.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('WALLET')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'WALLET'
                  ? 'bg-white text-[#EA580C] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Wallet</span>
            </button>

            <button
              onClick={() => setActiveTab('PROFILE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === 'PROFILE'
                  ? 'bg-white text-[#EA580C] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Shift Attendance Top-Bar Pill (Staff Only, Executives Exempt) */}
            {String(user?.role || '').toUpperCase() === 'STAFF' && (
              todayAttendance ? (
                <button
                  onClick={() => {
                    setPunchStatusMessage(null);
                    setScannerPunchSuccessRecord(null);
                    setIsAttendanceScanModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black shadow-sm hover:bg-emerald-100 transition-all active:scale-[0.98] cursor-pointer"
                  title="Shift Active - Click to Check Out"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">
                    {todayAttendance.checkInTime
                      ? `${new Date(todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Check Out`
                      : 'Active Shift · Check Out'}
                  </span>
                  <span className="sm:hidden">Check Out</span>
                  <LogOut className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setPunchStatusMessage(null);
                    setScannerPunchSuccessRecord(null);
                    setIsAttendanceScanModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:opacity-95 text-white text-xs font-black shadow-md shadow-orange-500/20 transition-all active:scale-[0.98] cursor-pointer"
                  title="Clock in via reception kiosk scanner or PIN"
                >
                  <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Clock In</span>
                </button>
              )
            )}

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

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Toast Alert Notice */}
      {alertNotice && (
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 mt-3">
          <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in z-20">
            <span>{alertNotice}</span>
            <button onClick={() => setAlertNotice(null)} className="opacity-80 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN BODY AREA: FULL WIDTH ACROSS SCREEN FROM LEFT TO RIGHT */}
      {/* ========================================================= */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-28 md:pb-12">
          {/* ========================================================= */}
          {/* TAB 0: HOME SCREEN (Exact Mobile Replica: Carousel & Actions) */}
          {/* ========================================================= */}
          {activeTab === 'HOME' && (
            <div className="animate-fade-in space-y-6">
              {activeWorkstation === 'HUB' && (
                <div className="space-y-6 animate-fade-in">

              {/* CARD 1: 4-SLIDE FINANCIAL CAROUSEL (Exact 1-to-1 Replica of Flutter Mobile _buildMultiMetricFinancialCarousel) */}
              <div className="relative rounded-[26px] overflow-hidden shadow-xl border border-slate-800/10">
                {/* SLIDE 0: BEMS DIGITAL WALLET & ADVANCES (Vibrant Orange Gradient) */}
                {financialSlideIndex === 0 && (
                  <div className="rounded-t-[26px] bg-gradient-to-br from-[#EA580C] via-[#C2410C] to-[#9A3412] text-white p-5 sm:p-6 relative overflow-hidden transition-all duration-300">
                    <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/95 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                          SLIDE 1/4 · BEMS DIGITAL WALLET &amp; ADVANCES
                        </span>
                        <button
                          onClick={() => setHideBalance(!hideBalance)}
                          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white cursor-pointer"
                          title={hideBalance ? 'Show Balance' : 'Hide Balance'}
                        >
                          {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-white/80 block mb-1">
                          Available Wallet Balance &amp; Held Operational Advances
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          {hideBalance
                            ? '₦ ••••••••'
                            : (walletData?.balance?.availableMinor != null
                                ? formatNaira(Number(walletData.balance.availableMinor) / 100)
                                : formatNaira(activeAdvanceAmount))}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/90">
                          <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm font-bold border border-white/20">
                            Avail: {walletData?.balance?.availableMinor != null ? formatNaira(Number(walletData.balance.availableMinor) / 100) : '₦0'}
                          </span>
                          <span className="text-white/80">· Adv. Held: {formatNaira(activeAdvanceAmount)}</span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <button
                          onClick={() => setActiveTab('WALLET')}
                          className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-[#EA580C] font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <ArrowRight className="w-4 h-4 -rotate-45 text-[#EA580C]" />
                          <span>Withdraw to Bank</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SLIDE 1: LIFETIME REQUISITIONS RAISED (Slate Gradient) */}
                {financialSlideIndex === 1 && (
                  <div className="rounded-t-[26px] bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#334155] text-white p-5 sm:p-6 relative overflow-hidden transition-all duration-300">
                    <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-slate-400/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-pulse" />
                          SLIDE 2/4 · LIFETIME REQUISITIONS RAISED
                        </span>
                        <button
                          onClick={() => setHideBalance(!hideBalance)}
                          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white cursor-pointer"
                          title={hideBalance ? 'Show Balance' : 'Hide Balance'}
                        >
                          {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-slate-300 block mb-1">
                          All-Time Operational &amp; Expense Requisitions
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          {hideBalance ? '₦ ••••••••' : formatNaira(financialSlideMetrics.totalEverRequestedAmount)}
                        </h2>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-500/30 backdrop-blur-sm font-bold border border-slate-400/30">
                            {financialSlideMetrics.totalEverRequestedCount} Requisitions
                          </span>
                          <span className="text-slate-300/80">· Lifetime Submissions in Career</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          onClick={() => setIsNewRequestOpen(true)}
                          className="py-3 px-3 bg-white hover:bg-slate-50 text-[#0F172A] font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-[#0F172A]" />
                          <span>New Request</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('REQUESTS')}
                          className="py-3 px-3 bg-white/15 hover:bg-white/25 text-white font-black text-xs rounded-xl border border-white/20 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <span>View History →</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SLIDE 2: PENDING PIPELINE VALUE (Ocean Blue Gradient) */}
                {financialSlideIndex === 2 && (
                  <div className="rounded-t-[26px] bg-gradient-to-br from-[#0369A1] via-[#0284C7] to-[#0EA5E9] text-white p-5 sm:p-6 relative overflow-hidden transition-all duration-300">
                    <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-200 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-300 animate-pulse" />
                          SLIDE 3/4 · PENDING PIPELINE VALUE
                        </span>
                        <button
                          onClick={() => setHideBalance(!hideBalance)}
                          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white cursor-pointer"
                          title={hideBalance ? 'Show Balance' : 'Hide Balance'}
                        >
                          {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-sky-200 block mb-1">
                          In Transit Awaiting GMD / Treasury Action
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          {hideBalance ? '₦ ••••••••' : formatNaira(financialSlideMetrics.pendingApprovalAmount)}
                        </h2>
                        <div className="mt-2 flex items-center gap-2 text-xs text-sky-200">
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/30 backdrop-blur-sm font-bold border border-sky-400/30">
                            {financialSlideMetrics.pendingApprovalCount} Requisitions In Review
                          </span>
                          <span className="text-sky-300/80">· Workflow In Progress</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          onClick={() => setActiveTab('REQUESTS')}
                          className="py-3 px-3 bg-white hover:bg-slate-50 text-[#0284C7] font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <span>Track Pipeline</span>
                        </button>
                        <button
                          onClick={() => setIsAdminChatOpen(true)}
                          className="py-3 px-3 bg-white/15 hover:bg-white/25 text-white font-black text-xs rounded-xl border border-white/20 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <span>Finance Chat →</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SLIDE 3: MONTHLY REMUNERATION & PAYROLL (Emerald Gradient) */}
                {financialSlideIndex === 3 && (
                  <div className="rounded-t-[26px] bg-gradient-to-br from-[#065F46] via-[#047857] to-[#059669] text-white p-5 sm:p-6 relative overflow-hidden transition-all duration-300">
                    <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse" />
                          SLIDE 4/4 · MONTHLY REMUNERATION &amp; PAYROLL
                        </span>
                        <button
                          onClick={() => setHideBalance(!hideBalance)}
                          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white cursor-pointer"
                          title={hideBalance ? 'Show Balance' : 'Hide Balance'}
                        >
                          {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-emerald-200 block mb-1">
                          Verified Monthly Payroll &amp; Scheduled Payday
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          Payday: 3rd
                        </h2>
                        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-200">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 backdrop-blur-sm font-bold border border-emerald-400/30">
                            Bank: {user.salaryBankName || user.bankName || 'Verified Payroll Account'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          onClick={() => setIsPayslipsModalOpen(true)}
                          className="py-3 px-3 bg-white hover:bg-slate-50 text-[#047857] font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <span>View Payslips</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('WALLET')}
                          className="py-3 px-3 bg-white/15 hover:bg-white/25 text-white font-black text-xs rounded-xl border border-white/20 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <span>Update Bank →</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* CAROUSEL BOTTOM CONTROLS: PREV / NEXT ARROWS & 4 DOTS */}
                <div className="px-5 py-3 bg-white text-slate-700 flex items-center justify-between border-t border-slate-200">
                  <button
                    onClick={() => setFinancialSlideIndex((prev) => (prev > 0 ? prev - 1 : 3))}
                    className="p-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition-all text-slate-700 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  {/* 4 Interactive Dot Indicators */}
                  <div className="flex items-center gap-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <button
                        key={idx}
                        onClick={() => setFinancialSlideIndex(idx)}
                        className={`transition-all rounded-full cursor-pointer ${
                          financialSlideIndex === idx
                            ? 'w-6 h-2 bg-[#EA580C]'
                            : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                        }`}
                        title={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setFinancialSlideIndex((prev) => (prev < 3 ? prev + 1 : 0))}
                    className="p-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition-all text-slate-700 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* CARD 2: MONTHLY SALARY & PAYSLIPS QUICK CARD (Exact Mobile Replica) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 text-[#EA580C] flex items-center justify-center shrink-0 shadow-sm">
                    <Wallet className="w-5 h-5 text-[#EA580C]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-[#0F172A]">Monthly Salary &amp; Payslips</h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Scheduled Payday: 3rd · Bank: {user.salaryBankName || user.bankName || 'Corporate Payroll'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPayslipsModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Breakdown</span>
                </button>
              </div>

              {/* CARD 3: QUICK ACTIONS GRID (6 Core Executive Cards matching Mobile) */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-[#0F172A] tracking-tight">Quick Actions</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* 1. New Request */}
                  <button
                    onClick={() => setIsNewRequestOpen(true)}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#EA580C] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0F172A]">New Request</div>
                      <div className="text-[10.5px] text-slate-500 font-medium">Operational</div>
                    </div>
                  </button>

                  {/* 2. Confirm Funds */}
                  <button
                    onClick={() => {
                      if (disbursementsAwaiting.length > 0) {
                        handleConfirmDisbursement(disbursementsAwaiting[0].id);
                      } else {
                        setAlertNotice('No pending disbursements to confirm at this time.');
                      }
                    }}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#EA580C] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-5 h-5 text-[#EA580C]" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0F172A]">Confirm Funds</div>
                      <div className="text-[10.5px] text-slate-500 font-medium">Dual-Key Auth</div>
                    </div>
                  </button>

                  {/* 3. 72h Evidence */}
                  <button
                    onClick={() => setActiveTab('RETIREMENT')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <Receipt className="w-5 h-5 text-slate-700" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0F172A]">72h Evidence</div>
                      <div className="text-[10.5px] text-slate-500 font-medium">Retire Advance</div>
                    </div>
                  </button>

                  {/* 4. Requisitions */}
                  <button
                    onClick={() => setActiveTab('REQUESTS')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5 text-slate-700" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0F172A]">Requisitions</div>
                      <div className="text-[10.5px] text-slate-500 font-medium">View All &amp; Chat</div>
                    </div>
                  </button>

                  {/* 5. Enterprise Hub */}
                  <button
                    onClick={() => {
                      const el = document.getElementById('workstation-gallery');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#EA580C] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <LayoutGrid className="w-5 h-5 text-[#EA580C]" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0F172A]">Enterprise Hub</div>
                      <div className="text-[10.5px] text-slate-500 font-medium">All 8 Workstations</div>
                    </div>
                  </button>

                  {/* 6. Admin Helpdesk */}
                  <button
                    onClick={() => setIsAdminChatOpen(true)}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#EA580C] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <MessageSquare className="w-5 h-5 text-[#EA580C]" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0F172A]">Admin Helpdesk</div>
                      <div className="text-[10.5px] text-slate-500 font-medium">Chat With Admin</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* DUAL-KEY MAKER-CHECKER (If disbursements awaiting confirmation) */}
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
                          className="flex-1 py-2 bg-[#059669] hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs cursor-pointer"
                        >
                          {confirmingDisbursementId === disb.id ? 'Confirming...' : 'Confirm Received'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION: REQUISITIONS & SPEND ANALYTICS */}
              <div className="p-5 bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-[#0F172A]">Requisitions &amp; Spend Analytics</h3>
                    <p className="text-[11px] text-[#64748B]">Dynamic Requisition Volume &amp; Spend Trend</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-lg text-[9.5px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                    ANALYTICS
                  </span>
                </div>

                {requests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <BarChart2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    No requisition data recorded yet.
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {/* Bar Chart */}
                    <div className="h-40 flex items-end justify-around gap-2 px-2 pb-2 border-b border-slate-100">
                      {requests.slice(0, 5).reverse().map((r: any, idx: number, arr: any[]) => {
                        const amt = Number(r.amountMinor || 0) / 100;
                        const maxVal = Math.max(...arr.map((item) => Number(item.amountMinor || 0) / 100), 1);
                        const heightPct = Math.max(20, Math.min(100, Math.round((amt / maxVal) * 100)));
                        const isLast = idx === arr.length - 1;
                        const labelAmt =
                          amt >= 1000000
                            ? `₦${(amt / 1000000).toFixed(1)}M`
                            : amt >= 1000
                            ? `₦${Math.round(amt / 1000)}k`
                            : `₦${amt}`;

                        return (
                          <div key={r.id || idx} className="flex-1 flex flex-col items-center justify-end h-full">
                            <span className={`text-[9px] font-black mb-1 truncate max-w-[70px] ${
                              isLast ? 'text-[#EA580C]' : 'text-slate-400'
                            }`}>
                              {labelAmt}
                            </span>
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full max-w-[36px] rounded-t-lg transition-all ${
                                isLast
                                  ? 'bg-gradient-to-t from-[#EA580C] to-[#FB923C] shadow-sm shadow-orange-800/20'
                                  : 'bg-gradient-to-t from-slate-400 to-slate-300'
                              }`}
                            />
                            <span className={`text-[10px] font-black mt-1.5 truncate max-w-[60px] ${
                              isLast ? 'text-[#EA580C]' : 'text-slate-500'
                            }`}>
                              {r.requestNumber ? r.requestNumber.slice(-4) : `REQ-${idx + 1}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Category Distribution Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <span>Category Distribution</span>
                        <span className="text-[#0F172A] font-extrabold">{formatNaira(totalExpenditureValue)}</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100">
                        {expenditureSegments.map((seg, i) => {
                          const pct = totalExpenditureValue > 0 ? (seg.value / totalExpenditureValue) * 100 : 0;
                          return (
                            <div
                              key={i}
                              style={{ width: `${pct}%` }}
                              className={seg.color}
                              title={`${seg.label}: ${pct.toFixed(1)}%`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ENTERPRISE MODULE GALLERY (Dedicated Workstations Anchor) */}
              <div id="workstation-gallery" className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-[#0F172A] tracking-tight">
                      Enterprise Module Gallery
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select a department module workstation to enter your dedicated workspace
                    </p>
                  </div>
                </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* CARD 1: FINANCE & REQUISITIONS */}
                      <div
                        onClick={() => {
                          setActiveWorkstation('FINANCE');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-orange-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 group-hover:bg-[#EA580C] text-[#EA580C] group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                            <Wallet className="w-6 h-6 stroke-[2.2]" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-100 text-orange-800 border border-orange-200">
                            {requests.length} REQUISITIONS
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-base font-black text-[#0F172A] group-hover:text-[#EA580C] transition-colors">
                            Finance & Requisitions Desk
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Operational fund requests, vendor budgets, approval pipeline & disbursement claims.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#EA580C]">
                          <span>Enter Workstation</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* CARD 2: HUMAN RESOURCES & ATTENDANCE */}
                      <div
                        onClick={() => {
                          setActiveWorkstation('HR');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                            <Clock className="w-6 h-6 stroke-[2.2]" />
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            todayAttendance
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}>
                            {todayAttendance ? 'CHECKED IN' : 'CLOCK-IN DUE'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-base font-black text-[#0F172A] group-hover:text-emerald-700 transition-colors">
                            HR & Attendance Desk
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Starlink & GPS timekeeping scanner, shift roster, leaves, timesheets & monthly payslips.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                          <span>Enter Workstation</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* CARD 3: ACCOUNTABILITY & 72H VAULT */}
                      <div
                        onClick={() => {
                          setActiveWorkstation('ACCOUNTABILITY');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-rose-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 group-hover:bg-rose-600 text-rose-600 group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                            <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            72H POLICY · {activeAdvanceCases.length} ADVANCES
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-base font-black text-[#0F172A] group-hover:text-rose-600 transition-colors">
                            Accountability & 72h Vault
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Retire operational cash advances, photograph store receipts & vendor invoices to prevent SLA lock.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-600">
                          <span>Enter Workstation</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* CARD 4: OPERATIONS & FLEET */}
                      <div
                        onClick={() => {
                          setActiveWorkstation('OPERATIONS');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-sky-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 group-hover:bg-sky-600 text-sky-600 group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                            <Truck className="w-6 h-6 stroke-[2.2]" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200">
                            LOGISTICS & FLEET
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-base font-black text-[#0F172A] group-hover:text-sky-600 transition-colors">
                            Operations & Fleet Desk
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Field task assignments, equipment allocation, fleet vehicle tracking & operational checklists.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-600">
                          <span>Enter Workstation</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* CARD 5: INNOVATION & R&D INCUBATOR */}
                      <div
                        onClick={() => {
                          setActiveWorkstation('INNOVATION');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-purple-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 group-hover:bg-purple-600 text-purple-600 group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                            <Lightbulb className="w-6 h-6 stroke-[2.2]" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                            DIRECT TO GMD
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-base font-black text-[#0F172A] group-hover:text-purple-600 transition-colors">
                            Innovation & R&D Incubator
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Pitch disruptive ideas, operational optimizations & tech improvements directly to Group Leadership.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-600">
                          <span>Enter Workstation</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* CARD 6: PROJECTS & DELIVERABLES */}
                      <div
                        onClick={() => {
                          setActiveWorkstation('PROJECTS');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 group-hover:bg-teal-600 text-teal-600 group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                            <Target className="w-6 h-6 stroke-[2.2]" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">
                            DELIVERABLES & SLA
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-base font-black text-[#0F172A] group-hover:text-teal-600 transition-colors">
                            Projects & Deliverables
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Client engagements, task deadlines, cross-subsidiary milestones & deliverable sign-offs.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-teal-600">
                          <span>Enter Workstation</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* VIEW 1: INSIDE THE FINANCIAL HUB WORKSTATION              */}
              {/* --------------------------------------------------------- */}
              {activeWorkstation === 'FINANCE' && (
                <div className="space-y-6 animate-fade-in">

                  {/* DUAL-KEY MAKER-CHECKER (If disbursements awaiting confirmation) */}
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

                  {/* SECTION: REQUISITIONS & SPEND ANALYTICS */}
                  <div className="p-5 bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-[#0F172A]">Requisitions & Spend Analytics</h3>
                        <p className="text-[11px] text-[#64748B]">Dynamic Requisition Volume & Spend Trend</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-lg text-[9.5px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                        ANALYTICS
                      </span>
                    </div>

                    {requests.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        <BarChart2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        No requisition data recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2">
                        {/* Bar Chart */}
                        <div className="h-40 flex items-end justify-around gap-2 px-2 pb-2 border-b border-slate-100">
                          {requests.slice(0, 5).reverse().map((r: any, idx: number, arr: any[]) => {
                            const amt = Number(r.amountMinor || 0) / 100;
                            const maxVal = Math.max(...arr.map((item) => Number(item.amountMinor || 0) / 100), 1);
                            const heightPct = Math.max(20, Math.min(100, Math.round((amt / maxVal) * 100)));
                            const isLast = idx === arr.length - 1;
                            const labelAmt =
                              amt >= 1000000
                                ? `₦${(amt / 1000000).toFixed(1)}M`
                                : amt >= 1000
                                ? `₦${Math.round(amt / 1000)}k`
                                : `₦${amt}`;

                            return (
                              <div key={r.id || idx} className="flex-1 flex flex-col items-center justify-end h-full">
                                <span className={`text-[9px] font-black mb-1 truncate max-w-[70px] ${
                                  isLast ? 'text-[#EA580C]' : 'text-slate-400'
                                }`}>
                                  {labelAmt}
                                </span>
                                <div
                                  style={{ height: `${heightPct}%` }}
                                  className={`w-full max-w-[36px] rounded-t-lg transition-all ${
                                    isLast
                                      ? 'bg-gradient-to-t from-[#EA580C] to-[#FB923C] shadow-sm shadow-orange-800/20'
                                      : 'bg-gradient-to-t from-slate-400 to-slate-300'
                                  }`}
                                />
                                <span className={`text-[10px] font-black mt-1.5 truncate max-w-[60px] ${
                                  isLast ? 'text-[#EA580C]' : 'text-slate-500'
                                }`}>
                                  {r.requestNumber ? r.requestNumber.slice(-4) : `REQ-${idx + 1}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Category Distribution Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <span>Category Distribution</span>
                            <span className="text-[#0F172A] font-extrabold">{formatNaira(totalExpenditureValue)}</span>
                          </div>
                          <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100">
                            {expenditureSegments.map((seg, i) => {
                              const pct = totalExpenditureValue > 0 ? (seg.value / totalExpenditureValue) * 100 : 0;
                              return (
                                <div
                                  key={i}
                                  style={{ width: `${pct}%`, backgroundColor: seg.color }}
                                  title={`${seg.label}: ${formatNaira(seg.value)} (${pct.toFixed(0)}%)`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION: UPLOAD PROOF OF EXPENDITURE BANNER */}
                  <div className="p-5 bg-white rounded-[24px] border border-slate-200/90 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#EA580C] flex items-center justify-center font-black">
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-[#0F172A]">Upload Proof of Expenditure</h4>
                          <p className="text-[11px] text-[#64748B]">Photograph physical receipts or attach vendor invoice PDFs</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-50 text-[#EA580C] border border-orange-200">
                        🛡️ 72H POLICY
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      Photograph original physical store receipts or attach vendor invoice PDFs to retire outstanding advances and clear your SLA window.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={() => {
                          if (pendingRetirements.length > 0) {
                            setActiveRetirementCase(pendingRetirements[0]);
                            setActualSpentAmount(Number(pendingRetirements[0].request?.amountMinor || 0) / 100);
                          } else {
                            setActiveTab('RETIREMENT');
                          }
                        }}
                        className="py-2.5 px-3 bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-xs rounded-xl shadow-md shadow-[#EA580C]/20 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Snap Picture</span>
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
                        className="py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Upload Doc / PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION: EXPENDITURE REQUISITIONS DESK */}
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-[#0F172A] tracking-tight">Requisition Registry</h3>
                        <p className="text-xs text-[#64748B]">Procurement & operational fund requests ({requests.length})</p>
                      </div>
                      <button
                        onClick={() => setIsNewRequestOpen(true)}
                        className="px-3.5 py-1.5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>New</span>
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        placeholder="Search by REQ code, vendor, or item..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-[#E2E8F0] rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-sm"
                      />
                    </div>

                    {/* Status Filter Chips */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
                      {(['ALL', 'PENDING', 'APPROVED', 'PAID', 'RECURRING'] as const).map((code) => {
                        const isSelected = statusFilter === code;
                        const label =
                          code === 'ALL'
                            ? `All Requests (${requests.length})`
                            : code === 'PENDING'
                            ? 'In Review'
                            : code === 'APPROVED'
                            ? 'Approved'
                            : code === 'PAID'
                            ? 'Disbursed'
                            : '🔁 Recurring';
                        return (
                          <button
                            key={code}
                            onClick={() => setStatusFilter(code)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                              isSelected
                                ? 'bg-[#EA580C] text-white shadow-sm shadow-orange-500/25 border border-[#EA580C]'
                                : 'bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Requisitions List Cards */}
                    {filteredRequests.length === 0 ? (
                      <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#EA580C] flex items-center justify-center mx-auto font-black">
                          <Receipt className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-black text-slate-800">No requisitions match your filter</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Submit an operational expenditure or project fund request using the button below.
                        </p>
                        <button
                          onClick={() => setIsNewRequestOpen(true)}
                          className="px-4 py-2 bg-[#EA580C] text-white font-black text-xs rounded-xl shadow-md inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create Requisition</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredRequests.map((r: any) => {
                          const amt = Number(r.amountMinor || 0) / 100;
                          const isDisbursed = r.status === 'DISBURSED' || r.status === 'PAID';
                          const isApproved = r.status === 'APPROVED';
                          const isRejected = r.status === 'REJECTED';

                          return (
                            <div
                              key={r.id}
                              onClick={() => setSelectedRequestDetail(r)}
                              className="p-4 bg-white rounded-2xl border border-slate-200/90 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer space-y-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-black text-[#EA580C]">
                                      {r.requestNumber || 'REQ'}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                      {r.category || 'EXPENSE'}
                                    </span>
                                    {r.isUrgent && (
                                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                        URGENT
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-black text-sm text-[#0F172A] truncate">
                                    {r.title}
                                  </h4>
                                  <p className="text-xs text-slate-500 line-clamp-1">
                                    {r.description || 'No description provided'}
                                  </p>
                                </div>

                                <div className="text-right flex-shrink-0">
                                  <span className="font-black text-sm text-[#0F172A]">{formatNaira(amt)}</span>
                                  <div className="flex items-center justify-end gap-1 mt-1">
                                    {isDisbursed ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>DISBURSED</span>
                                      </span>
                                    ) : isApproved ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                        <span>Approved</span>
                                      </span>
                                    ) : isRejected ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                        <span>Declined</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                        <span>In Review</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAdminChatOpen(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] text-[#EA580C] text-[11px] font-extrabold flex items-center gap-1.5 hover:bg-orange-100 transition-all"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Request Chat</span>
                                </button>

                                <button
                                  onClick={() => setSelectedRequestDetail(r)}
                                  className="text-xs font-bold text-slate-400 hover:text-[#EA580C] flex items-center gap-1 transition-all"
                                >
                                  <span>Details & Audit</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* VIEW 2: HR & ATTENDANCE WORKSTATION                       */}
              {/* --------------------------------------------------------- */}
              {activeWorkstation === 'HR' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setActiveWorkstation('HUB');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200"
                        title="Back to Module Gallery"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Module Gallery</span>
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            👥 HR &amp; TIMEKEEPING
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight mt-1">
                          HR &amp; Attendance Desk
                        </h2>
                        <p className="text-xs text-slate-500">
                          Starlink Wi-Fi &amp; GPS geofenced clock-in, shift calendar, and monthly payslips.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-[#0F172A]">Real-Time Attendance Clock-In</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        todayAttendance ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {todayAttendance ? '● Clocked In' : 'Pending Arrival'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      Scan the corporate reception kiosk QR code or click below to launch your camera scanner.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => {
                          setPunchStatusMessage(null);
                          setScannerPunchSuccessRecord(null);
                          setIsAttendanceScanModalOpen(true);
                        }}
                        className="py-3 px-4 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
                      >
                        <MapPin className="w-4 h-4" />
                        <span>{todayAttendance ? 'CLOCK OUT (SCANNER)' : 'CLOCK IN (SCANNER)'}</span>
                      </button>
                      <button
                        onClick={() => setIsPayslipsModalOpen(true)}
                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 border border-slate-200 active:scale-[0.98] transition-all"
                      >
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>View Monthly Payslips</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* VIEW 3: ACCOUNTABILITY & 72H VAULT WORKSTATION            */}
              {/* --------------------------------------------------------- */}
              {activeWorkstation === 'ACCOUNTABILITY' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setActiveWorkstation('HUB');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200"
                        title="Back to Module Gallery"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Module Gallery</span>
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            🛡️ ACCOUNTABILITY VAULT
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight mt-1">
                          Accountability &amp; 72h SLA Vault
                        </h2>
                        <p className="text-xs text-slate-500">
                          Retire operational cash advances, photograph store receipts &amp; vendor invoices.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-[#0F172A]">Outstanding Operational Advances</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                        {activeAdvanceCases.length} Active Advances
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      All cash advances must be settled within 72 hours of disbursement to keep your account in good standing.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => {
                          const targetCase = pendingRetirements.length > 0 ? pendingRetirements[0] : activeAdvanceCases[0];
                          if (targetCase) {
                            setActiveRetirementCase(targetCase);
                            setActualSpentAmount(Number(targetCase.request?.amountMinor || targetCase.amountMinor || 0) / 100);
                          } else {
                            setActiveTab('RETIREMENT');
                          }
                        }}
                        className="py-3 px-4 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Retire Outstanding Advance</span>
                      </button>
                      <button
                        onClick={() => setIsAdminChatOpen(true)}
                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 border border-slate-200 active:scale-[0.98] transition-all"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Request SLA Extension</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* VIEW 4: OPERATIONS & FLEET WORKSTATION                    */}
              {/* --------------------------------------------------------- */}
              {activeWorkstation === 'OPERATIONS' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setActiveWorkstation('HUB');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200"
                        title="Back to Module Gallery"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Module Gallery</span>
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200">
                            ⚡ OPERATIONS & FLEET
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight mt-1">
                          Operations & Fleet Desk
                        </h2>
                        <p className="text-xs text-slate-500">
                          Field task assignments, equipment allocation, fleet vehicle tracking & operational checklists.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <Truck className="w-5 h-5 text-sky-600" />
                      <span>Active Field Operations Log</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Field vehicles, generator diesel requisitions, and equipment dispatch are coordinated via the Operations Desk.
                    </p>
                    <button
                      onClick={() => setIsNewRequestOpen(true)}
                      className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md active:scale-[0.98] transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Operations Requisition</span>
                    </button>
                  </div>
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* VIEW 5: INNOVATION & R&D INCUBATOR WORKSTATION            */}
              {/* --------------------------------------------------------- */}
              {activeWorkstation === 'INNOVATION' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setActiveWorkstation('HUB');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200"
                        title="Back to Module Gallery"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Module Gallery</span>
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            💡 INNOVATION INCUBATOR
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight mt-1">
                          Innovation & R&D Incubator
                        </h2>
                        <p className="text-xs text-slate-500">
                          Pitch disruptive ideas and operational optimizations directly to Group Leadership.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsNewIdeaModalOpen(true)}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Pitch Idea to GMD</span>
                    </button>
                  </div>

                  {ideaNotice && (
                    <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 rounded-2xl text-xs font-bold">
                      {ideaNotice}
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="text-sm font-black text-[#0F172A]">Submitted Ideas & Concepts</h3>
                    {submittedIdeas.length === 0 ? (
                      <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                        No idea pitched yet. Click "Pitch Idea to GMD" to submit your concept.
                      </div>
                    ) : (
                      submittedIdeas.map((idea) => (
                        <div key={idea.id} className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">{idea.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                              {idea.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{idea.summary}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* VIEW 6: PROJECTS & DELIVERABLES WORKSTATION               */}
              {/* --------------------------------------------------------- */}
              {activeWorkstation === 'PROJECTS' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setActiveWorkstation('HUB');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200"
                        title="Back to Module Gallery"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Module Gallery</span>
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                            🎯 PROJECTS & DELIVERABLES
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight mt-1">
                          Projects & Deliverables Desk
                        </h2>
                        <p className="text-xs text-slate-500">
                          Client engagements, task deadlines, cross-subsidiary milestones & deliverable sign-offs.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Media Production & Conglomerate Client Deliverables</span>
                      <span className="text-teal-600 font-extrabold">80% COMPLETE</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: '80%' }} />
                    </div>
                    <p className="text-slate-500 text-[11.5px]">
                      Task deliverables are synced with executive sign-off workflows.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: REQUISITIONS DESK (Exact Mobile App Replica)        */}
          {/* ========================================================= */}
          {activeTab === 'REQUESTS' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#0F172A] tracking-tight">Expenditure Requisitions</h2>
                  <p className="text-xs text-[#64748B]">Manage & inspect your procurement requests ({requests.length})</p>
                </div>
                <button
                  onClick={() => setIsNewRequestOpen(true)}
                  className="px-4 py-2 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>New</span>
                </button>
              </div>

              {/* Search Bar (Matching Mobile placeholder: Search by REQ code, vendor, or item...) */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search by REQ code, vendor, or item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#E2E8F0] rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-sm"
                />
              </div>

              {/* Status Filter Chips */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
                {(['ALL', 'PENDING', 'APPROVED', 'PAID', 'RECURRING'] as const).map((code) => {
                  const isSelected = statusFilter === code;
                  const label =
                    code === 'ALL'
                      ? `All Requests (${requests.length})`
                      : code === 'PENDING'
                      ? 'In Review'
                      : code === 'APPROVED'
                      ? 'Approved'
                      : code === 'PAID'
                      ? 'Disbursed'
                      : '🔁 Recurring';
                  return (
                    <button
                      key={code}
                      onClick={() => setStatusFilter(code)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                        isSelected
                          ? 'bg-[#EA580C] text-white shadow-sm shadow-orange-500/25 border border-[#EA580C]'
                          : 'bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Expenditure Distribution Donut Card (Exact Mobile Replica) */}
              {requests.length > 0 && (
                <div className="p-5 bg-white rounded-3xl border border-[#E2E8F0] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#EA580C]">
                        <PieChart className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#0F172A]">Expenditure Distribution</h4>
                        <p className="text-[10px] text-[#64748B]">
                          Allocation by {requisitionChartMetric.toLowerCase()} ({requests.length} requests total)
                        </p>
                      </div>
                    </div>

                    {/* Toggle: [ Category | Status ] */}
                    <div className="flex p-0.5 bg-slate-100 rounded-xl text-[10.5px]">
                      {(['Category', 'Status'] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setRequisitionChartMetric(opt)}
                          className={`px-3 py-1 rounded-lg font-extrabold transition-all ${
                            requisitionChartMetric === opt
                              ? 'bg-white text-[#EA580C] shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                    {/* Donut Chart */}
                    <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F1F5F9" strokeWidth="12" />
                        {(() => {
                          const circumference = 2 * Math.PI * 38; // ~238.76
                          let accumulatedPct = 0;
                          return expenditureSegments.map((seg, idx) => {
                            const pct = totalExpenditureValue > 0 ? seg.value / totalExpenditureValue : 0;
                            const strokeDasharray = `${(pct * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
                            const strokeDashoffset = (-accumulatedPct * circumference).toFixed(2);
                            accumulatedPct += pct;
                            return (
                              <circle
                                key={idx}
                                cx="50"
                                cy="50"
                                r="38"
                                fill="transparent"
                                stroke={seg.color}
                                strokeWidth="12"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
                        <span className="text-xs font-black text-[#0F172A] leading-tight truncate max-w-[80px]">
                          {compactExpenditureTotal}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                          TOTAL VALUE
                        </span>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-2 flex-1 w-full text-xs">
                      {expenditureSegments.map((seg, i) => {
                        const pct = totalExpenditureValue > 0 ? Math.round((seg.value / totalExpenditureValue) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                              <span className="font-bold text-slate-700 text-xs truncate">{seg.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-extrabold text-[#0F172A] text-xs">{formatNaira(seg.value)}</span>
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded border" style={{ color: seg.color, backgroundColor: `${seg.color}15`, borderColor: `${seg.color}35` }}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Requisitions List (Exact Mobile Card Structure) */}
              {filteredRequests.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] rounded-3xl p-12 text-center text-xs text-slate-500 shadow-sm">
                  No requisitions match your filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((r: any) => {
                    const amt = Number(r.amountMinor || 0) / 100;
                    const dueDateStr = r.dueDate
                      ? r.dueDate
                      : new Date(new Date(r.createdAt).getTime() + 7 * 24 * 3600 * 1000).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        });

                    const isDisbursed =
                      r.paymentStatus === 'PAID' ||
                      r.paymentStatus === 'RECIPIENT_CONFIRMED' ||
                      r.accountabilityStatus === 'EVIDENCE_SUBMITTED' ||
                      r.accountabilityStatus === 'CLOSED' ||
                      r.accountabilityStatus === 'VERIFIED';

                    const isApproved = r.approvalStatus === 'APPROVED' && !isDisbursed;
                    const isRejected = r.approvalStatus === 'REJECTED';

                    return (
                      <div
                        key={r.id}
                        className={`p-4 bg-white border rounded-2xl hover:shadow-md transition-all space-y-3 ${
                          isDisbursed
                            ? 'border-emerald-300 ring-1 ring-emerald-100 hover:border-emerald-400'
                            : 'border-[#E2E8F0] hover:border-orange-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              isDisbursed
                                ? 'bg-emerald-50 border-emerald-200 text-[#059669]'
                                : isApproved
                                ? 'bg-blue-50 border-blue-200 text-[#2563EB]'
                                : 'bg-orange-50 border-orange-100 text-[#EA580C]'
                            }`}>
                              {isDisbursed ? <CheckCircle2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-extrabold text-[#0F172A] truncate">{r.title}</h4>
                              <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                                {r.requestNumber} · {r.subsidiary?.legalName || user.subsidiary} · Due: {dueDateStr}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.isRecurring && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  🔁 RECURRING
                                </span>
                              )}
                              <span className="font-black text-sm text-[#0F172A]">{formatNaira(amt)}</span>
                            </div>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              {isDisbursed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>DISBURSED</span>
                                </span>
                              ) : isApproved ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  <span>Approved</span>
                                </span>
                              ) : isRejected ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  <span>Declined</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                  <span>In Review</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsAdminChatOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] text-[#EA580C] text-[11px] font-extrabold flex items-center gap-1.5 hover:bg-orange-100 transition-all"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Request Chat</span>
                          </button>

                          <button
                            onClick={() => setSelectedRequestDetail(r)}
                            className="text-xs font-bold text-slate-400 hover:text-[#EA580C] flex items-center gap-1 transition-all"
                          >
                            <span>Details & Audit</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: 72H SLA COMMAND CENTER (Exact Mobile App Replica)   */}
          {/* ========================================================= */}
          {activeTab === 'RETIREMENT' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-black text-[#0F172A] tracking-tight">72-Hour SLA Command Center</h2>
                <p className="text-xs text-[#64748B]">Expense receipt retirement & deliverable compliance tracking</p>
              </div>

              {/* 1. ACTIVE SLA RADAR CARD */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C]">
                    ACTIVE SLA RADAR
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[9.5px] font-black ${
                      nearestAdvanceCase
                        ? isSlaOverdue
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'bg-orange-50 text-[#EA580C] border border-orange-200'
                        : 'bg-orange-50 text-[#EA580C] border border-orange-200'
                    }`}
                  >
                    {nearestAdvanceCase ? (isSlaOverdue ? 'OVERDUE ADVANCE' : 'ACTIVE ADVANCE') : 'POLICY COMPLIANT'}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Radial Ring */}
                  <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" fill="transparent" stroke="#F1F5F9" strokeWidth="6" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        fill="transparent"
                        stroke={nearestAdvanceCase ? (isSlaOverdue ? '#EF4444' : '#EA580C') : '#EA580C'}
                        strokeWidth="6"
                        strokeDasharray="163.36"
                        strokeDashoffset={nearestAdvanceCase ? 163.36 - 163.36 * (slaHoursElapsed / 72) : 0}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <span className="absolute text-sm font-black text-[#0F172A]">
                      {nearestAdvanceCase ? `${slaHoursRemaining}h` : '0h'}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h4 className="text-xs font-black text-[#0F172A] leading-tight">
                      {nearestAdvanceCase
                        ? `${slaHoursElapsed} Hours Elapsed · ${slaHoursRemaining} Hours Left`
                        : '100% Policy Compliant · 0 Advances Due'}
                    </h4>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      {nearestAdvanceCase
                        ? `Physical receipts for ${nearestAdvanceCase.request?.requestNumber || nearestAdvanceCase.requestNumber || 'advance'} must be photographed and submitted before deadline.`
                        : 'All operational funds are fully accounted for. Great job maintaining company compliance!'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. 72H SLA COMPLIANCE RADAR (DONUT ANALYTICS CARD) */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#EA580C]">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#0F172A]">72h SLA Compliance Radar</h4>
                      <p className="text-[10px] text-[#64748B]">Expense retirement compliance & deliverable audit score</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 pt-1">
                  <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F1F5F9" strokeWidth="12" />
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={overdueCount > 0 ? '#EF4444' : '#EA580C'}
                        strokeWidth="12"
                        strokeDasharray="238.76"
                        strokeDashoffset={0}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-base font-black text-[#0F172A]">{compliancePct}%</span>
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">COMPLIANCE</span>
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 w-full text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C] shrink-0" />
                        <span className="font-bold text-slate-700 text-xs">Active in 72h Grace</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#0F172A]">{inGraceCount || (nearestAdvanceCase ? 1 : 0)}</span>
                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                          100%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ACTIVE ADVANCES REQUIRING PROOF SECTION */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-[#0F172A]">Active Advances Requiring Proof</h3>

                {activeAdvanceCases.length === 0 ? (
                  <div className="bg-white border border-[#E2E8F0] rounded-3xl p-8 text-center shadow-sm space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-[#EA580C] flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#0F172A]">Zero Advance Liabilities</h4>
                      <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 leading-relaxed">
                        All your past cash advances are 100% reconciled and cleared by Finance.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeAdvanceCases.map((c: any) => {
                      const amount = Number(c.request?.amountMinor || c.amountMinor || 0) / 100;
                      const reqNum = c.request?.requestNumber || c.requestNumber || 'ADVANCE';
                      const reqTitle = c.request?.title || c.title || 'Operational Advance';
                      const deliverables = c.requiredDeliverables || c.request?.deliverable || 'Itemized receipt and proof of delivery.';
                      const dueTime = c.dueAt ? new Date(c.dueAt).getTime() : Date.now() + 72 * 3600 * 1000;
                      const remHours = Math.max(0, Math.round((dueTime - Date.now()) / (1000 * 60 * 60)));
                      const isOver = dueTime <= Date.now();
                      const isSubmitted = c.status === 'EVIDENCE_SUBMITTED' || c.request?.accountabilityStatus === 'EVIDENCE_SUBMITTED';

                      return (
                        <div
                          key={c.id}
                          className={`bg-white rounded-3xl p-5 border shadow-sm space-y-3 transition-all ${
                            isSubmitted
                              ? 'border-orange-300 bg-orange-50/20 hover:border-orange-400'
                              : 'border-amber-200/80 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl border border-orange-100 bg-orange-50 text-[#EA580C] flex items-center justify-center">
                                <Receipt className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-black text-[#EA580C]">{reqNum}</span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${
                              isSubmitted
                                ? 'bg-orange-50 text-[#EA580C] border-orange-200'
                                : 'bg-[#FEF3C7] text-[#D97706] border-amber-200'
                            }`}>
                              {isSubmitted ? '● Evidence Submitted (Review)' : isOver ? '24h Overdue' : `${remHours}h Left`}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-black text-[#0F172A]">{reqTitle}</h4>
                            <p className="text-xs text-[#64748B] mt-0.5">
                              Disbursed Amount: <span className="font-bold text-[#0F172A]">{formatNaira(amount)}</span> · Ref: {c.bankReference || c.request?.bankReference || ''}
                            </p>
                          </div>

                          {/* Required Proof Box */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                            <Receipt className="w-4 h-4 shrink-0 mt-0.5 text-[#EA580C]" />
                            <span><strong>Required Proof:</strong> {deliverables}</span>
                          </div>

                          <button
                            onClick={() => {
                              setActiveRetirementCase(c);
                              setActualSpentAmount(amount);
                              setRefundReturnedAmount(0);
                            }}
                            className="w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md bg-[#EA580C] hover:bg-orange-700 text-white shadow-orange-500/20 active:scale-[0.98] transition-all"
                          >
                            <Camera className="w-4 h-4" />
                            <span>{isSubmitted ? 'Evidence Submitted (Update Proof)' : 'Upload Physical Receipts & GRN'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. CLEARED RETIREMENT ARCHIVE SECTION */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-black text-[#0F172A]">Cleared Retirement Archive</h3>

                {clearedRetirements.length === 0 ? (
                  <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex items-center gap-3 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <Archive className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      No retired advances archived yet. Completed accountability reconciliations will be archived here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clearedRetirements.map((c: any) => {
                      const amt = Number(c.request?.amountMinor || c.amountMinor || 0) / 100;
                      const reqNum = c.request?.requestNumber || c.requestNumber || 'ADVANCE';
                      const reqTitle = c.request?.title || c.title || 'Data Center Project';
                      const dept = c.request?.department || user.department || 'Commercial Growth & Sales';

                      return (
                        <div
                          key={c.id}
                          className="p-4 bg-white border border-[#E2E8F0] rounded-2xl flex items-center justify-between shadow-sm hover:border-slate-300 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 border border-orange-200">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-black text-[#0F172A] truncate">
                                {reqNum} · {reqTitle}
                              </h5>
                              <p className="text-[10px] text-slate-400 truncate">
                                {formatNaira(amt)} · {dept}
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-lg text-[9.5px] font-black bg-[#FFF7ED] text-[#EA580C] border border-orange-200 shrink-0">
                            {c.status || 'EVIDENCE_SUBMITTED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: ENTERPRISE WALLET & LEDGER (Exact Mobile Replica)   */}
          {/* ========================================================= */}
          {activeTab === 'WALLET' && (
            <StaffWalletTab
              user={user}
              payslips={payslips}
              onRequestFunds={() => setIsNewRequestOpen(true)}
              onNavigateToTab={setActiveTab}
            />
          )}

          {/* ========================================================= */}
          {/* TAB 4: COMPLETE STAFF PROFILE (Exact Flutter Replica)     */}
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

              {/* SHIFT ATTENDANCE CARD (Image 2 Replica - Placed Under Profile) */}
              {String(user?.role || '').toUpperCase() === 'STAFF' && (
                todayAttendance ? (
                  <div className="p-4 sm:p-5 bg-[#F0FDF4] rounded-[22px] border border-[#BBF7D0] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600/12 text-[#16A34A] flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
                      </div>
                      <div>
                        <h4 className="text-[13px] font-black text-[#15803D]">Shift Active - Clocked In</h4>
                        <p className="text-[11px] text-[#166534] font-medium">
                          {todayAttendance.checkInTime
                            ? `Registered at ${new Date(todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Office station verified`
                            : 'Registered · Office station verified'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsAttendanceScanModalOpen(true)}
                      className="px-4 py-2 bg-white border border-[#86EFAC] text-[#15803D] hover:bg-emerald-50 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Check Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 bg-[#FFF7ED] rounded-[22px] border border-[#FED7AA] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-orange-600/12 text-[#EA580C] flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-[#EA580C]" />
                      </div>
                      <div>
                        <h4 className="text-[13px] font-black text-[#0F172A]">Shift Attendance Pending</h4>
                        <p className="text-[11px] text-[#64748B] font-medium">Clock in to verify physical presence</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsAttendanceScanModalOpen(true)}
                      className="px-4 py-2 bg-[#EA580C] text-white hover:bg-orange-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-orange-500/20 shrink-0 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Clock In</span>
                    </button>
                  </div>
                )
              )}

              {/* 2-COLUMN PROFILE DESKTOP GRID (Exact Flutter Mobile Replica) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* LEFT COLUMN: IDENTITY, EMPLOYMENT & NEXT OF KIN */}
                <div className="space-y-6">

                  {/* 1. PERSONAL IDENTITY & CONTACT */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] mb-2 px-1">
                      PERSONAL IDENTITY & CONTACT
                    </h4>
                    <div className="p-4 sm:p-5 bg-white rounded-[22px] border border-[#E2E8F0] space-y-3.5 text-xs shadow-sm">
                      {/* Corporate Email */}
                      <div className="flex items-start gap-3">
                        <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10.5px] font-bold text-slate-500 block">Corporate Email</span>
                          <span className="font-extrabold text-[#0F172A] break-all">{user.email}</span>
                        </div>
                      </div>

                      {/* Phone Number with Edit Button */}
                      <div className="border-t border-slate-100 pt-3 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[10.5px] font-bold text-slate-500 block">Phone Number</span>
                            <span className="font-extrabold text-[#0F172A]">{userProfile.phone || user.phone || '9065451734'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setPhoneInput(userProfile.phone || user.phone || '');
                            setIsPhoneModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-extrabold text-[#EA580C] bg-[#FFF7ED] border border-[#FED7AA] hover:bg-orange-600 hover:text-white rounded-lg transition-all"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Gender & Date of Birth */}
                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Gender & Date of Birth</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.gender || user.gender || 'FEMALE'} · {userProfile.dateOfBirth || user.dateOfBirth || '2002-05-12'}</span>
                        </div>
                      </div>

                      {/* Residential Address */}
                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <Home className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Residential Address</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.residentialAddress || user.residentialAddress || 'Oyo Central Base'}{userProfile.cityState || user.cityState ? `, ${userProfile.cityState || user.cityState}` : ''}</span>
                        </div>
                      </div>

                      {/* Origin & Statutory */}
                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <Building className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Origin & Statutory</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.lga || user.lga || 'Ibadan North'}, {userProfile.stateOfOrigin || user.stateOfOrigin || 'Oyo State'} · Marital: {userProfile.maritalStatus || user.maritalStatus || 'SINGLE'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. CORPORATE & EMPLOYMENT DETAILS */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] mb-2 px-1">
                      CORPORATE & EMPLOYMENT DETAILS
                    </h4>
                    <div className="p-4 sm:p-5 bg-white rounded-[22px] border border-[#E2E8F0] space-y-3.5 text-xs shadow-sm">
                      <div className="flex items-start gap-3">
                        <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Subsidiary Entity</span>
                          <span className="font-extrabold text-[#0F172A]">{displaySubsidiary}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Department Unit</span>
                          <span className="font-extrabold text-[#0F172A]">{displayDepartment}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Employment Type & Grade</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.employmentType || user.employmentType || 'FULL_TIME'} ({userProfile.staffGrade || user.staffGrade || 'Level 06 - Operational Specialist'})</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Work Location & Resumption</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.workLocation || user.workLocation || 'Oyo Logistics & Farm Hub'} · Resumed: {userProfile.resumptionDate || user.resumptionDate || '2026-10-28'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. EMERGENCY CONTACT & NEXT OF KIN */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] mb-2 px-1">
                      EMERGENCY CONTACT & NEXT OF KIN
                    </h4>
                    <div className="p-4 sm:p-5 bg-white rounded-[22px] border border-[#E2E8F0] space-y-3.5 text-xs shadow-sm">
                      <div className="flex items-start gap-3">
                        <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Next of Kin Name</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.nextOfKinName || user.nextOfKinName || 'heh3hh'}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Relationship</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.nextOfKinRelationship || user.nextOfKinRelationship || 'Family / Next of Kin'}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Contact Phone</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.nextOfKinPhone || user.nextOfKinPhone || '646464'}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10.5px] font-bold text-slate-500 block">Address</span>
                          <span className="font-extrabold text-[#0F172A]">{userProfile.nextOfKinAddress || user.nextOfKinAddress || 'hdhdhe'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN: SALARY, BANKING & SECURITY */}
                <div className="space-y-6">

                  {/* 4. DISBURSEMENT & SALARY BANK ACCOUNTS */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] mb-2 px-1">
                      DISBURSEMENT & SALARY BANK ACCOUNTS
                    </h4>
                    <div className="p-5 bg-white rounded-[22px] border border-[#E2E8F0] space-y-4 text-xs shadow-sm">
                      {/* Operational Advance */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#EA580C]">
                            PRIMARY DISBURSAL ACCOUNT (ADVANCES)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold">
                            VERIFIED
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-[#0F172A]">
                          {userProfile.bankName || user.bankName || 'Access Bank PLC'}
                        </h4>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          Account: {userProfile.accountNumber || user.accountNumber || '9152777306'} · {userProfile.accountName || user.accountName || user.fullName}
                        </p>
                      </div>

                      <div className="border-t border-slate-100 pt-3.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                            PAYROLL / SALARY ACCOUNT
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-extrabold">
                            ACTIVE
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-[#0F172A]">
                          {userProfile.salaryBankName || user.salaryBankName || userProfile.bankName || 'Access Bank PLC'}
                        </h4>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          Account: {userProfile.salaryAccountNumber || user.salaryAccountNumber || userProfile.accountNumber || '9152777306'} · {userProfile.salaryAccountName || user.salaryAccountName || user.fullName}
                        </p>
                      </div>

                      <button
                        onClick={() => setIsDualBankingOpen(true)}
                        className="w-full py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C] hover:bg-orange-600 hover:text-white transition-all text-xs font-extrabold flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Change / Update Bank Accounts</span>
                      </button>
                    </div>
                  </div>

                  {/* 5. MONTHLY SALARY & PAYSLIP VOUCHERS */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] mb-2 px-1">
                      MONTHLY SALARY & PAYSLIP VOUCHERS
                    </h4>
                    <div className="p-5 bg-white rounded-[22px] border border-[#E2E8F0] space-y-3.5 text-xs shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#EA580C]">
                          OFFICIAL MONTHLY SALARY
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] text-[9.5px] font-black">
                          PAYDAY: 3RD
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Review statutory gross-to-net salary breakdown, past payment vouchers, and confirm bank transfer receipt.
                      </p>

                      <button
                        onClick={() => setIsPayslipsModalOpen(true)}
                        className="w-full py-2.5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <Wallet className="w-4 h-4 text-white" />
                        <span>View My Salary & Payslips</span>
                      </button>
                    </div>
                  </div>

                  {/* 6. SECURITY & CREDENTIALS (Exact Flutter ListTiles) */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] mb-2 px-1">
                      SECURITY & CREDENTIALS
                    </h4>
                    <div className="p-4 bg-white rounded-[22px] border border-[#E2E8F0] space-y-1 text-xs shadow-sm divide-y divide-slate-100">
                      
                      {/* Tile 1: Admin Helpdesk */}
                      <div
                        onClick={() => setIsAdminChatOpen(true)}
                        className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-extrabold text-[#0F172A]">Finance & Admin Helpdesk Chat</h5>
                            <p className="text-[11px] text-slate-500">Direct messaging with Executive Admin & GMD</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>

                      {/* Tile 2: Change Password */}
                      <div
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-extrabold text-[#0F172A]">Change Password</h5>
                            <p className="text-[11px] text-slate-500">Update your corporate login credentials</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>

                      {/* Tile 3: Update Contact Phone */}
                      <div
                        onClick={() => {
                          setPhoneInput(userProfile.phone || user.phone || '');
                          setIsPhoneModalOpen(true);
                        }}
                        className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Phone className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-extrabold text-[#0F172A]">Update Contact Phone Number</h5>
                            <p className="text-[11px] text-slate-500">Current: {userProfile.phone || user.phone || '9065451734'}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>

                      {/* Tile 4: Change Bank Account Details */}
                      <div
                        onClick={() => setIsDualBankingOpen(true)}
                        className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-extrabold text-[#0F172A]">Change Bank Account Details</h5>
                            <p className="text-[11px] text-slate-500">Advance: {userProfile.bankName || user.bankName || 'Access Bank PLC'} · {userProfile.accountNumber || user.accountNumber || '9152777306'}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>

                    </div>
                  </div>

                </div>

              </div>

              {/* 7. LOGOUT (Exact Flutter Outlined Red Button) */}
              <div className="pt-2">
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full py-3.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>{signingOut ? 'Signing Out...' : 'Sign Out of Staff Workspace'}</span>
                </button>
              </div>
            </div>
          )}

        </main>

        {/* ========================================================= */}
        {/* BOTTOM NAVIGATION BAR (Exact Flutter Replica)              */}
        {/* ========================================================= */}
        <nav className="fixed md:hidden bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-3 py-2 flex items-center justify-around z-40 shadow-lg">
          {/* Home */}
          <button
            onClick={() => {
              setActiveTab('HOME');
              setActiveWorkstation('HUB');
            }}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              activeTab === 'HOME' ? 'text-[#EA580C] font-black' : 'text-[#94A3B8] font-bold hover:text-slate-600'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10.5px]">Home</span>
          </button>

          {/* Requisitions */}
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all relative ${
              activeTab === 'REQUESTS' ? 'text-[#EA580C] font-black' : 'text-[#94A3B8] font-bold hover:text-slate-600'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10.5px]">Requisitions</span>
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
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all relative ${
              activeTab === 'RETIREMENT' ? 'text-[#EA580C] font-black' : 'text-[#94A3B8] font-bold hover:text-slate-600'
            }`}
          >
            <Timer className="w-5 h-5" />
            <span className="text-[10.5px]">72h SLA</span>
            {pendingRetirements.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#EF4444] animate-pulse"></span>
            )}
          </button>

          {/* Wallet */}
          <button
            onClick={() => setActiveTab('WALLET')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all relative ${
              activeTab === 'WALLET' ? 'text-[#EA580C] font-black' : 'text-[#94A3B8] font-bold hover:text-slate-600'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10.5px]">Wallet</span>
          </button>
        </nav>

        {/* ========================================================= */}
        {/* ALL MODALS & DRAWERS (ATTENDANCE, CHAT, PAYSLIPS, ETC)    */}
        {/* ========================================================= */}

        {/* Modal: Full Attendance Scanner & Quick Web Punch (Matches Mobile Flutter AttendanceScanScreen 1-to-1) */}
        {isAttendanceScanModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-[#0F172A]/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fade-in">
            <div className="w-full max-w-sm bg-[#F1F5F9] rounded-[32px] p-5 shadow-2xl border border-slate-200/80 space-y-4 relative overflow-hidden">
              {/* Header Bar */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setIsAttendanceScanModalOpen(false);
                    setScannerPunchSuccessRecord(null);
                    setScannerManualTokenOpen(false);
                  }}
                  className="w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center text-[#0F172A] hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="text-center">
                  <h3 className="text-sm font-extrabold text-[#0F172A] leading-tight">
                    {todayAttendance ? 'Check-Out Desk' : 'Attendance Clock-In'}
                  </h3>
                  <p className="text-[10px] font-medium text-[#64748B]">
                    BEMS Enterprise Timekeeping
                  </p>
                </div>

                <div className="w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center text-[#EA580C]">
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              {/* Mode Switcher: QR Camera vs Quick Web Punch */}
              <div className="flex bg-slate-200/90 p-1 rounded-2xl gap-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setScannerMode('CAMERA')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    scannerMode === 'CAMERA'
                      ? 'bg-white text-[#EA580C] shadow-sm font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📷 Kiosk Scanner
                </button>
                <button
                  type="button"
                  onClick={() => setScannerMode('PIN')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    scannerMode === 'PIN'
                      ? 'bg-white text-[#EA580C] shadow-sm font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚡ Quick Web Punch
                </button>
              </div>

              {scannerMode === 'CAMERA' ? (
                /* Mode 1: Camera Scanner */
                <div className="space-y-4">
                  {/* Airplane Window Squircle Viewport */}
                  <div className="flex flex-col items-center pt-1">
                    <div className="relative flex items-center justify-center">
                      {/* Outer Aircraft Beveled Rim */}
                      <div className="w-[260px] h-[310px] rounded-[78px] p-3.5 bg-gradient-to-br from-white via-[#E2E8F0] to-[#CBD5E1] shadow-[0_20px_45px_rgba(15,23,42,0.2)] flex items-center justify-center relative">
                        {/* Inner Aircraft Dark Chamber */}
                        <div className="w-full h-full rounded-[66px] bg-[#040711] shadow-inner relative overflow-hidden flex items-center justify-center">
                          {/* Live Camera Stream */}
                          <video
                            ref={scannerVideoRef}
                            playsInline
                            muted
                            autoPlay
                            className="w-full h-full object-cover rounded-[66px]"
                          />

                          {/* Camera Fallback Viewport */}
                          {scannerCameraError && (
                            <div className="absolute inset-0 bg-[#0F172A] p-4 flex flex-col items-center justify-center text-center">
                              <Camera className="w-9 h-9 text-white/50 mb-2" />
                              <span className="text-xs font-bold text-white">Camera Viewfinder</span>
                              <span className="text-[10px] text-white/60 mt-1 max-w-[190px]">
                                {scannerCameraError}
                              </span>
                            </div>
                          )}

                          {/* Animated Laser Beam (Active while scanning) */}
                          {scannerIsScanning && !scannerDetectedCode && (
                            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#EA580C] to-transparent shadow-[0_0_14px_3px_rgba(234,88,12,0.8)] animate-pulse pointer-events-none" style={{ top: '45%' }} />
                          )}

                          {/* Corner Reticles */}
                          <div className={`absolute w-36 h-36 rounded-2xl pointer-events-none transition-all duration-300 flex items-center justify-center ${
                            scannerDetectedCode
                              ? 'border-2 border-emerald-400 bg-emerald-500/20 shadow-[0_0_24px_rgba(16,185,129,0.7)]'
                              : 'border-2 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]'
                          }`}>
                            {scannerDetectedCode && (
                              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
                            )}
                          </div>

                          {/* Upper Aircraft Glass Glare */}
                          <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-[66px]" />

                          {/* Punching Overlay */}
                          {punching && (
                            <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center text-white z-20">
                              <RefreshCw className="w-7 h-7 text-[#EA580C] animate-spin mb-2" />
                              <span className="text-xs font-black">
                                {scannerDetectedCode ? 'QR Recognized! Clocking In...' : 'Verifying Dynamic QR...'}
                              </span>
                              <span className="text-[10px] text-white/70 mt-0.5">Matching Office Geofence & Starlink</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Hidden file input for Photo / Image QR Scan */}
                      <input
                        ref={scannerFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileScan}
                      />

                      {/* Camera Controls Overlapping the Rim */}
                      <div className="absolute -bottom-3 flex items-center gap-3 z-10">
                        <button
                          onClick={toggleScannerTorch}
                          className={`w-9 h-9 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-all ${
                            scannerTorchOn ? 'bg-[#EA580C] text-white' : 'bg-white text-slate-700'
                          }`}
                          title="Torch"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setScannerFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                          className="w-9 h-9 rounded-full border-2 border-white shadow-md bg-white text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-all cursor-pointer"
                          title="Flip Camera"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => scannerFileInputRef.current?.click()}
                          className="w-9 h-9 rounded-full border-2 border-white shadow-md bg-white text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-all cursor-pointer"
                          title="Scan QR from Photo / Upload"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Title & Instructions */}
                  <div className="text-center pt-4 space-y-1">
                    <h4 className="text-sm font-black text-[#0F172A] tracking-tight">
                      {scannerDetectedCode ? 'QR Code Recognized!' : 'Align Reception Kiosk QR'}
                    </h4>
                    <p className="text-[11px] text-[#64748B] max-w-[260px] mx-auto leading-relaxed">
                      {scannerDetectedCode
                        ? 'Submitting high-precision geofence verification...'
                        : 'Point camera at reception lobby screen or switch to Quick Web Punch.'}
                    </p>
                  </div>
                </div>
              ) : (
                /* Mode 2: Quick Web Punch & PIN */
                <div className="space-y-4 py-2">
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 text-center shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-[#EA580C] flex items-center justify-center mx-auto shadow-sm">
                      <Clock className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#0F172A]">{user.fullName}</h4>
                      <p className="text-xs text-slate-500 font-bold">{displayEmployeeNumber} · {displaySubsidiary}</p>
                    </div>

                    <div className={`p-3 rounded-xl text-xs font-black ${
                      todayAttendance
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {todayAttendance ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Shift Active · Clocked In at {todayAttendance.checkInTime ? new Date(todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '07:45 AM'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span>🕒 Shift Not Started · Ready to Clock In</span>
                        </div>
                      )}
                    </div>

                    {/* Direct 1-Click Office Web Punch Button */}
                    <button
                      disabled={punching}
                      onClick={() => handlePunchAttendance(todayAttendance ? 'CHECK_OUT' : 'CHECK_IN')}
                      className={`w-full py-3.5 rounded-2xl font-black text-xs text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer ${
                        todayAttendance
                          ? 'bg-gradient-to-r from-red-600 to-rose-700 shadow-rose-500/25'
                          : 'bg-gradient-to-r from-orange-600 to-amber-500 shadow-orange-500/25'
                      }`}
                    >
                      {punching ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                      <span>
                        {punching
                          ? 'Verifying Geofence...'
                          : todayAttendance
                          ? 'Check Out Now (Office Perimeter)'
                          : 'Clock In Now (Office Perimeter)'}
                      </span>
                    </button>
                  </div>

                  {/* Kiosk PIN Form */}
                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2 shadow-sm">
                    <span className="text-[11px] font-black text-[#0F172A] block">
                      Or Punch With Kiosk PIN
                    </span>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Enter your 4-digit staff kiosk PIN to check in or out instantly.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="4-digit PIN"
                        value={kioskPinInput}
                        onChange={(e) => setKioskPinInput(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                      />
                      <button
                        type="button"
                        disabled={punching || kioskPinInput.trim().length < 4}
                        onClick={handleKioskPinPunch}
                        className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                      >
                        {punching ? '...' : 'Submit PIN'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Real-Time Security Telemetry Status Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {/* Dynamic GPS Pill */}
                {scannerGpsStatus === 'READY' ? (
                  <div className="px-2.5 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm">
                    <MapPin className="w-3 h-3 text-[#059669]" />
                    <span>GPS Locked {scannerGpsAccuracy ? `(±${scannerGpsAccuracy}m)` : ''}</span>
                  </div>
                ) : scannerGpsStatus === 'ACQUIRING' ? (
                  <div className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                    <span>Acquiring GPS...</span>
                  </div>
                ) : (
                  <div className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>Location Access Denied</span>
                  </div>
                )}

                {/* Starlink Network Pill */}
                <div className="px-2.5 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm">
                  <Wifi className="w-3 h-3" />
                  <span>Network Access Active</span>
                </div>
              </div>

              {/* Status or Error Banner with Instant Retry */}
              {punchStatusMessage && (
                <div className={`p-3 rounded-2xl text-[11px] font-bold text-center border space-y-1.5 shadow-sm ${
                  punchStatusMessage.startsWith('✕')
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <div>{punchStatusMessage}</div>
                  {punchStatusMessage.startsWith('✕') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPunchStatusMessage(null);
                        setScannerDetectedCode(null);
                        setScannerIsScanning(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-rose-200 rounded-lg text-rose-700 font-extrabold hover:bg-rose-100 transition-all text-[10px] shadow-sm cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Scan Again</span>
                    </button>
                  )}
                </div>
              )}

              {/* Camera Mode Action Buttons */}
              {scannerMode === 'CAMERA' && (
                <div className="space-y-2 pt-1">
                  <button
                    disabled={punching}
                    onClick={() => handlePunchAttendance(todayAttendance ? 'CHECK_OUT' : 'CHECK_IN')}
                    className={`w-full py-3.5 rounded-2xl font-extrabold text-xs text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer ${
                      todayAttendance
                        ? 'bg-gradient-to-r from-[#EA580C] to-orange-700 shadow-orange-500/25'
                        : 'bg-gradient-to-r from-[#059669] to-emerald-700 shadow-emerald-500/25'
                    }`}
                  >
                    {punching ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4" />
                    )}
                    <span>
                      {punching
                        ? 'Cryptographic Verification...'
                        : scannerDetectedCode
                        ? 'Re-submit Scanned QR'
                        : todayAttendance
                        ? 'Verify Dynamic QR & Clock Out'
                        : 'Verify Dynamic QR & Clock In'}
                    </span>
                  </button>

                  {/* Manual Token Trigger */}
                  <div className="text-center pt-1">
                    <button
                      onClick={() => setScannerManualTokenOpen(!scannerManualTokenOpen)}
                      className="text-[11px] font-bold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
                    >
                      Camera issue? Enter token manually
                    </button>
                  </div>

                  {/* Manual Token Drawer */}
                  {scannerManualTokenOpen && (
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2 mt-2 animate-fade-in shadow-sm">
                      <span className="text-[11px] font-extrabold text-[#0F172A] block">Manual Token Entry</span>
                      <p className="text-[10px] text-[#64748B]">Enter or paste the rotating code from the kiosk.</p>
                      <input
                        type="text"
                        placeholder="e.g. BEMSQR:STATION:..."
                        value={scannerManualTokenInput}
                        onChange={(e) => setScannerManualTokenInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                      />
                      <button
                        disabled={punching || !scannerManualTokenInput.trim()}
                        onClick={() => handlePunchAttendance(todayAttendance ? 'CHECK_OUT' : 'CHECK_IN', scannerManualTokenInput.trim())}
                        className="w-full py-2 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                      >
                        Submit Token
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Attendance Punch Success Sheet (Matches Mobile Sheet 1-to-1) */}
            {scannerPunchSuccessRecord && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
                <div className="w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-6 text-center space-y-4 shadow-2xl animate-slide-up border border-slate-100">
                  <div className="w-16 h-16 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-[#0F172A] tracking-tight">
                      {scannerPunchSuccessRecord.type === 'CHECK_IN' ? 'Clock-In Registered!' : 'Clock-Out Registered!'}
                    </h3>
                    <p className="text-xs text-[#64748B] mt-1">
                      Dynamic QR & Starlink Geofence verified successfully.
                    </p>
                  </div>

                  {/* Summary Details Box */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl grid grid-cols-2 gap-3 text-left">
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] block">
                        {scannerPunchSuccessRecord.type === 'CHECK_IN' ? 'Check-In Time' : 'Check-Out Time'}
                      </span>
                      <span className="text-sm font-extrabold text-[#0284C7] mt-0.5 block">
                        {scannerPunchSuccessRecord.time}
                      </span>
                    </div>
                    <div className="border-l border-[#E2E8F0] pl-3">
                      <span className="text-[10px] font-bold text-[#64748B] block">Shift Status</span>
                      <span className="text-xs font-black text-[#059669] mt-0.5 block">
                        {scannerPunchSuccessRecord.status}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setScannerPunchSuccessRecord(null);
                      setIsAttendanceScanModalOpen(false);
                    }}
                    className="w-full py-3.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-md transition-all active:scale-[0.98]"
                  >
                    Done & Return
                  </button>
                </div>
              </div>
            )}
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
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold font-mono"
                  />
                </div>
                {isVerifyingAdvance && (
                  <div className="p-2 bg-orange-50 text-[#EA580C] border border-orange-200 rounded-lg text-[11px] font-semibold flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin" />
                    <span>Verifying account with Monnify &amp; NIBSS...</span>
                  </div>
                )}
                {advanceVerifiedName && (
                  <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>✓ Monnify Verified: {advanceVerifiedName}</span>
                  </div>
                )}
                {advanceVerifyError && (
                  <div className="p-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-medium flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-red-500" />
                    <span>{advanceVerifyError}</span>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Beneficiary Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder={user.fullName}
                    className={`w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold ${advanceVerifiedName ? 'bg-slate-50 text-slate-700' : 'bg-white'}`}
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
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold font-mono"
                  />
                </div>
                {isVerifyingSalary && (
                  <div className="p-2 bg-orange-50 text-[#EA580C] border border-orange-200 rounded-lg text-[11px] font-semibold flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin" />
                    <span>Verifying salary account with Monnify &amp; NIBSS...</span>
                  </div>
                )}
                {salaryVerifiedName && (
                  <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>✓ Monnify Verified: {salaryVerifiedName}</span>
                  </div>
                )}
                {salaryVerifyError && (
                  <div className="p-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-medium flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-red-500" />
                    <span>{salaryVerifyError}</span>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Salary Account Name</label>
                  <input
                    type="text"
                    value={salaryAccountName}
                    onChange={(e) => setSalaryAccountName(e.target.value)}
                    placeholder={user.fullName}
                    className={`w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold ${salaryVerifiedName ? 'bg-slate-50 text-slate-700' : 'bg-white'}`}
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

        {/* Modal: Update Phone Number */}
        {isPhoneModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#0F172A]">Update Contact Phone</h3>
                    <p className="text-[10px] text-slate-500">Corporate communication & SMS dispatch</p>
                  </div>
                </div>
                <button onClick={() => setIsPhoneModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {phoneNotice && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
                  {phoneNotice}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="e.g. 09065451734"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPhoneModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={savingPhone}
                    onClick={handleSavePhone}
                    className="flex-1 py-2.5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-extrabold disabled:opacity-50"
                  >
                    {savingPhone ? 'Saving...' : 'Save Phone Number'}
                  </button>
                </div>
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

        {/* Modal: New Fund Requisition Modal (Mobile-Identical) */}
        <StaffNewFundRequestModal
          isOpen={isNewRequestOpen}
          onClose={() => {
            setIsNewRequestOpen(false);
            loadData(true);
          }}
          user={user}
          subsidiaries={subsidiaries}
          vendors={vendors}
          currentStaff={currentStaff}
          onSubmitted={() => {
            setIsNewRequestOpen(false);
            loadData(true);
          }}
        />

        {/* Mandatory Administrator Information Update Gate */}
        {isUpdateGateOpen && pendingUpdateData && (
          <StaffInformationUpdateGateModal
            isOpen={isUpdateGateOpen}
            request={pendingUpdateData.request}
            currentData={pendingUpdateData.currentData}
            onSuccess={(updatedEmp) => {
              setIsUpdateGateOpen(false);
              setPendingUpdateData(null);
              setUserProfile((prev) => ({
                ...prev,
                ...updatedEmp,
              }));
              loadData(true);
            }}
          />
        )}
        {/* Innovation Modal: Pitch Idea Directly to GMD */}
        {isNewIdeaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-purple-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Pitch Idea Directly to GMD</h3>
                    <p className="text-[11px] text-slate-500">Executive innovation incubator & proposal desk</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewIdeaModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newIdeaTitle.trim() || !newIdeaProposal.trim()) return;
                  setSubmittingIdea(true);
                  setTimeout(() => {
                    setSubmittedIdeas((prev) => [
                      {
                        id: `idea-${Date.now()}`,
                        title: newIdeaTitle,
                        summary: newIdeaProposal,
                        category: newIdeaCategory,
                        status: 'UNDER_REVIEW',
                        submittedAt: 'Just now',
                      },
                      ...prev,
                    ]);
                    setNewIdeaTitle('');
                    setNewIdeaProposal('');
                    setSubmittingIdea(false);
                    setIsNewIdeaModalOpen(false);
                    setIdeaNotice('Your proposal has been securely dispatched directly to the GMD executive review desk!');
                    setTimeout(() => setIdeaNotice(null), 6000);
                  }, 600);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">PROPOSAL TITLE</label>
                  <input
                    type="text"
                    required
                    value={newIdeaTitle}
                    onChange={(e) => setNewIdeaTitle(e.target.value)}
                    placeholder="e.g. Solar inverter microgrid at Studio Arella..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">DEPARTMENT / CATEGORY</label>
                  <select
                    value={newIdeaCategory}
                    onChange={(e) => setNewIdeaCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  >
                    <option value="OPERATIONS & LOGISTICS">Operations & Logistics</option>
                    <option value="TECH & MEDIA">Tech, Studio & Media</option>
                    <option value="ENERGY & COST-SAVING">Energy & Cost-Saving</option>
                    <option value="CLIENT ACQUISITION">Client Acquisition & Sales</option>
                    <option value="INTERNAL PROCESS">Internal Process & Governance</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">EXECUTIVE SUMMARY & EXPECTED IMPACT</label>
                  <textarea
                    rows={4}
                    required
                    value={newIdeaProposal}
                    onChange={(e) => setNewIdeaProposal(e.target.value)}
                    placeholder="Describe how this improves conglomerate revenue, cuts downtime, or boosts staff efficiency..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-600 leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsNewIdeaModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingIdea}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/25 flex items-center gap-1.5 transition-all"
                  >
                    {submittingIdea ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Submit to GMD</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        <InAppChatPushToast />
      </div>
    );
  }
