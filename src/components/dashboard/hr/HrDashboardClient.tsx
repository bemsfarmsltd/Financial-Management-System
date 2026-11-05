'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  Plus,
  ChevronRight,
  X,
  MessageSquare,
  Send,
  RefreshCw,
  FileText,
  Briefcase,
  Building2,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  UserX,
  CreditCard,
  DollarSign,
  ArrowRight,
  Sparkles,
  ChevronDown,
  Info,
  LogOut,
} from 'lucide-react';

interface HrUser {
  id: string;
  name: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

type TabType = 'OVERVIEW' | 'DIRECTORY' | 'ATTENDANCE' | 'LEAVE' | 'PAYROLL' | 'CHAT';

export function HrDashboardClient({ user }: { user: HrUser }) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Overview data
  const [overview, setOverview] = useState<any>(null);

  // Staff directory state
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffSubFilter, setStaffSubFilter] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // Attendance state
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attDate, setAttDate] = useState('');
  const [attStatusFilter, setAttStatusFilter] = useState('ALL');
  const [selectedRecordForExcuse, setSelectedRecordForExcuse] = useState<any | null>(null);
  const [excuseNoteInput, setExcuseNoteInput] = useState('');
  const [isExcuseSubmitting, setIsExcuseSubmitting] = useState(false);
  const [isManualOverrideOpen, setIsManualOverrideOpen] = useState(false);
  const [manualOverrideData, setManualOverrideData] = useState({
    employeeId: '',
    workDate: '',
    status: 'PRESENT',
    reason: '',
  });

  // Leave management state
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveFilter, setLeaveFilter] = useState('ALL');
  const [isNewLeaveModalOpen, setIsNewLeaveModalOpen] = useState(false);
  const [newLeaveForm, setNewLeaveForm] = useState({
    employeeId: '',
    leaveType: 'ANNUAL',
    startDate: '',
    endDate: '',
    reason: '',
    handoverNotes: '',
  });

  // Payroll preparation state
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollPrepareNotice, setPayrollPrepareNotice] = useState<string | null>(null);
  const [payrollSearch, setPayrollSearch] = useState('');

  // Chat state
  const [chatThreads, setChatThreads] = useState<any[]>([]);
  const [activeChatStaffId, setActiveChatStaffId] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
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
  const [activeChatMessages, setActiveChatMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Profile update request modal state
  const [isProfileReqModalOpen, setIsProfileReqModalOpen] = useState(false);
  const [profileReqFields, setProfileReqFields] = useState<string[]>(['nin', 'bvn', 'bankDetails']);
  const [profileReqNote, setProfileReqNote] = useState('');

  // Initial Load
  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/hr/overview');
      if (!res.ok) {
        throw new Error('Failed to load HR overview data');
      }
      const data = await res.json();
      setOverview(data);
      if (data.todayStr) {
        setAttDate(data.todayStr);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error communicating with HR services');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch staff list when switching to DIRECTORY tab
  const fetchStaffList = async () => {
    try {
      const params = new URLSearchParams();
      if (staffSearch) params.set('q', staffSearch);
      if (staffSubFilter) params.set('subsidiaryId', staffSubFilter);
      if (staffStatusFilter) params.set('status', staffStatusFilter);
      const res = await fetch(`/api/hr/staff?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      }
    } catch (err) {
      console.error('Error fetching staff list:', err);
    }
  };

  // Fetch attendance records when switching to ATTENDANCE tab
  const fetchAttendanceRecords = async (dateOverride?: string) => {
    try {
      const targetDate = dateOverride !== undefined ? dateOverride : attDate;
      const params = new URLSearchParams();
      if (targetDate) params.set('date', targetDate);
      if (attStatusFilter && attStatusFilter !== 'ALL') params.set('status', attStatusFilter);

      const res = await fetch(`/api/hr/attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAttendanceRecords(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching attendance records:', err);
    }
  };

  // Fetch leave requests when switching to LEAVE tab
  const fetchLeaveRequests = async () => {
    try {
      const params = new URLSearchParams();
      if (leaveFilter && leaveFilter !== 'ALL') params.set('status', leaveFilter);
      const res = await fetch(`/api/hr/leave?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeaveRequests(data.leaves || []);
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    }
  };

  // Fetch chat threads when switching to CHAT tab
  const fetchChatThreads = async () => {
    try {
      const res = await fetch('/api/staff/chat/admin?channel=HR');
      if (res.ok) {
        const data = await res.json();
        setChatThreads(data.threads || []);
        if (data.threads && data.threads.length > 0 && !activeChatStaffId) {
          selectChatThread(data.threads[0].employee?.id);
        }
      }
    } catch (err) {
      console.error('Error fetching chat threads:', err);
    }
  };

  const selectChatThread = async (staffId: string) => {
    setActiveChatStaffId(staffId);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/staff/chat/admin?employeeId=${staffId}&channel=HR`);
      if (res.ok) {
        const data = await res.json();
        setActiveChatMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error loading thread messages:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInputText.trim() || !activeChatStaffId) return;
    const msg = chatInputText.trim();
    setChatInputText('');
    try {
      const res = await fetch('/api/staff/chat/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: activeChatStaffId,
          channel: 'HR',
          message: msg,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveChatMessages((prev) => [...prev, data.message]);
        fetchChatThreads();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Handlers for Staff Actions
  const handleApproveStaff = async (staffId: string) => {
    try {
      const res = await fetch('/api/hr/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE_ONBOARDING', employeeId: staffId }),
      });
      if (res.ok) {
        fetchStaffList();
        fetchOverview();
        if (selectedStaff?.id === staffId) {
          setSelectedStaff((prev: any) => ({ ...prev, approvalStatus: 'APPROVED', status: 'ACTIVE' }));
        }
      }
    } catch (err) {
      console.error('Error approving staff:', err);
    }
  };

  const handleRejectStaff = async (staffId: string) => {
    const reason = prompt('Please enter reason for rejecting this onboarding profile:');
    if (reason === null) return;
    try {
      const res = await fetch('/api/hr/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT_ONBOARDING', employeeId: staffId, rejectionReason: reason }),
      });
      if (res.ok) {
        fetchStaffList();
        fetchOverview();
        if (selectedStaff?.id === staffId) {
          setSelectedStaff((prev: any) => ({ ...prev, approvalStatus: 'REJECTED', status: 'TERMINATED' }));
        }
      }
    } catch (err) {
      console.error('Error rejecting staff:', err);
    }
  };

  const handleSendProfileUpdateRequest = async () => {
    if (!selectedStaff) return;
    try {
      const res = await fetch('/api/hr/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REQUEST_PROFILE_UPDATE',
          employeeId: selectedStaff.id,
          requestedFields: profileReqFields,
          instructions: profileReqNote,
        }),
      });
      if (res.ok) {
        alert('Compliance update request dispatched to employee.');
        setIsProfileReqModalOpen(false);
        fetchStaffList();
      }
    } catch (err) {
      console.error('Error sending profile request:', err);
    }
  };

  // Handlers for Attendance Excuse
  const handleSubmitExcuseRequest = async () => {
    if (!selectedRecordForExcuse || !excuseNoteInput.trim()) return;
    setIsExcuseSubmitting(true);
    try {
      const res = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_EXCUSE_REQUEST',
          attendanceRecordId: selectedRecordForExcuse.id,
          excuseNote: excuseNoteInput.trim(),
        }),
      });
      if (res.ok) {
        alert('Excuse & waiver request submitted to GMD / Super Admin for sign-off.');
        setSelectedRecordForExcuse(null);
        setExcuseNoteInput('');
        fetchAttendanceRecords();
        fetchOverview();
      }
    } catch (err) {
      console.error('Error submitting excuse:', err);
    } finally {
      setIsExcuseSubmitting(false);
    }
  };

  const handleManualOverride = async () => {
    if (!manualOverrideData.employeeId || !manualOverrideData.workDate) return;
    try {
      const res = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MANUAL_OVERRIDE',
          targetEmployeeId: manualOverrideData.employeeId,
          targetDate: manualOverrideData.workDate,
          newStatus: manualOverrideData.status,
          reason: manualOverrideData.reason,
        }),
      });
      if (res.ok) {
        setIsManualOverrideOpen(false);
        fetchAttendanceRecords();
        fetchOverview();
      }
    } catch (err) {
      console.error('Error saving manual punch:', err);
    }
  };

  // Handlers for Leave
  const handleApproveLeave = async (leaveId: string) => {
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', leaveId }),
      });
      if (res.ok) {
        fetchLeaveRequests();
        fetchOverview();
      }
    } catch (err) {
      console.error('Error approving leave:', err);
    }
  };

  const handleRejectLeave = async (leaveId: string) => {
    const note = prompt('Reason for rejecting leave request:');
    if (note === null) return;
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', leaveId, reviewNote: note }),
      });
      if (res.ok) {
        fetchLeaveRequests();
        fetchOverview();
      }
    } catch (err) {
      console.error('Error rejecting leave:', err);
    }
  };

  const handleCreateLeave = async () => {
    if (!newLeaveForm.employeeId || !newLeaveForm.startDate || !newLeaveForm.endDate || !newLeaveForm.reason) {
      alert('Please fill all required leave fields.');
      return;
    }
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          ...newLeaveForm,
        }),
      });
      if (res.ok) {
        setIsNewLeaveModalOpen(false);
        setNewLeaveForm({ employeeId: '', leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '', handoverNotes: '' });
        fetchLeaveRequests();
        fetchOverview();
      }
    } catch (err) {
      console.error('Error creating leave:', err);
    }
  };

  // Handlers for Payroll Preparation
  const handlePreparePayroll = async () => {
    setPayrollLoading(true);
    setPayrollPrepareNotice(null);
    try {
      const now = new Date();
      const res = await fetch('/api/payroll/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to prepare payroll batch');
      }
      setPayrollPrepareNotice(
        `Draft Payroll Batch ${data.batch?.batchNumber || ''} generated successfully! ${data.itemsCreated || 0} staff records rolled up. Ready for GMD review.`
      );
      fetchOverview();
    } catch (err: any) {
      setPayrollPrepareNotice(`Error: ${err.message}`);
    } finally {
      setPayrollLoading(false);
    }
  };

  // Tab switch listener
  useEffect(() => {
    if (activeTab === 'DIRECTORY' || activeTab === 'PAYROLL') fetchStaffList();
    if (activeTab === 'ATTENDANCE') fetchAttendanceRecords();
    if (activeTab === 'LEAVE') fetchLeaveRequests();
    if (activeTab === 'CHAT') fetchChatThreads();
  }, [activeTab]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Top HR Header Bar */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Brand & Workspace Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#1e1b4b', letterSpacing: '-0.02em' }}>
                  BEMS Human Resources
                </h1>
                <span
                  style={{
                    background: '#e0e7ff',
                    color: '#4338ca',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Operations Desk
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Staff Dossiers, Live Timekeeping, Leave Approvals & Payroll Prep
              </p>
            </div>
          </div>

          {/* User profile & Global Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link
              href="/"
              style={{
                fontSize: '12px',
                color: '#64748b',
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#f1f5f9',
                fontWeight: 600,
              }}
            >
              Back to Portal
            </Link>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#6366f1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {user.fullName.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{user.fullName}</div>
                <div style={{ fontSize: '10px', color: '#4f46e5', fontWeight: 600 }}>{user.role}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out of BEMS HR Workspace"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#dc2626',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '7px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LogOut size={14} />
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation */}
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            gap: '8px',
            borderTop: '1px solid #f1f5f9',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'OVERVIEW', label: 'Overview & Radar', icon: Sparkles },
            { id: 'DIRECTORY', label: 'Staff Directory', icon: Users, badge: overview?.metrics?.pendingOnboarding },
            { id: 'ATTENDANCE', label: 'Live Attendance', icon: Clock, badge: overview?.metrics?.pendingExcuseRequests },
            { id: 'LEAVE', label: 'Leave Requests', icon: Calendar, badge: overview?.metrics?.pendingLeaves },
            { id: 'PAYROLL', label: 'Payroll Prep', icon: DollarSign },
            { id: 'CHAT', label: 'Staff Helpdesk Chat', icon: MessageSquare },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabType)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: active ? '3px solid #4f46e5' : '3px solid transparent',
                  color: active ? '#4f46e5' : '#64748b',
                  fontSize: '13px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                <span>{t.label}</span>
                {Boolean(t.badge) && t.badge > 0 && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      minWidth: 16,
                      textAlign: 'center',
                    }}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div>
            {/* Top Metrics Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {/* Total Active Staff */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>TOTAL ACTIVE STAFF</span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: '#e0e7ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4338ca',
                    }}
                  >
                    <Users size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginTop: '10px' }}>
                  {overview?.metrics?.totalStaff ?? '—'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Across all operating entities</div>
              </div>

              {/* Present Today */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>PRESENT TODAY</span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#15803d',
                    }}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#15803d', marginTop: '10px' }}>
                  {overview?.metrics?.presentToday ?? '0'}
                </div>
                <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
                  Punctual check-ins verified
                </div>
              </div>

              {/* Lateness / Flagged */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>LATE PUNCTURES</span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: '#fee2e2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#b91c1c',
                    }}
                  >
                    <Clock size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#b91c1c', marginTop: '10px' }}>
                  {overview?.metrics?.lateToday ?? '0'}
                </div>
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                  {overview?.metrics?.pendingExcuseRequests || 0} waiver requests pending GMD
                </div>
              </div>

              {/* Pending Approvals */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>PENDING ONBOARDING</span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: '#fef3c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#b45309',
                    }}
                  >
                    <UserCheck size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#b45309', marginTop: '10px' }}>
                  {overview?.metrics?.pendingOnboarding ?? '0'}
                </div>
                <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>
                  Awaiting HR verification
                </div>
              </div>
            </div>

            {/* Subsidiary Workforce Breakdown */}
            <div
              style={{
                background: '#ffffff',
                padding: '24px',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                marginBottom: '24px',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
                Workforce Distribution by Subsidiary
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {overview?.subsidiaries?.map((sub: any) => (
                  <div
                    key={sub.id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid #f1f5f9',
                      background: '#fafafa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{sub.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Code: {sub.code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '18px',
                          fontWeight: 800,
                          color: '#4f46e5',
                          background: '#e0e7ff',
                          padding: '4px 12px',
                          borderRadius: '8px',
                        }}
                      >
                        {sub.staffCount}
                      </span>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>staff enrolled</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Bento */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '20px',
              }}
            >
              {/* Payroll Preparation Quick Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                  color: '#ffffff',
                  padding: '24px',
                  borderRadius: '14px',
                  boxShadow: '0 4px 12px rgba(30, 27, 75, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', fontSize: '12px', fontWeight: 700 }}>
                  <DollarSign size={16} /> MONTHLY PAYROLL CYCLE
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 12px 0' }}>
                  {overview?.latestPayrollBatch
                    ? `Batch #${overview.latestPayrollBatch.batchNumber} (${overview.latestPayrollBatch.yearMonth})`
                    : 'Current Month Draft Preparation'}
                </h3>
                <p style={{ fontSize: '13px', color: '#c7d2fe', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                  Aggregate live attendance, compute lateness deductions, and prepare draft payroll batch for the GMD’s final sign-off and disbursement authorization.
                </p>
                <button
                  onClick={() => setActiveTab('PAYROLL')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    background: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Go to Payroll Cockpit <ArrowRight size={14} />
                </button>
              </div>

              {/* Attendance & Excuses Quick Card */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '24px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4f46e5', fontSize: '12px', fontWeight: 700 }}>
                  <Clock size={16} /> ATTENDANCE RADAR & WAIVERS
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '8px 0 8px 0', color: '#0f172a' }}>
                  {overview?.metrics?.pendingExcuseRequests || 0} Excuse Requests Pending
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                  Review staff check-ins, Starlink/GPS logs, and forward valid medical or operational excuses to executive leadership.
                </p>
                <button
                  onClick={() => setActiveTab('ATTENDANCE')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#1e293b',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Open Attendance Desk <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STAFF DIRECTORY */}
        {activeTab === 'DIRECTORY' && (
          <div>
            {/* Filter and Search Bar */}
            <div
              style={{
                background: '#ffffff',
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ position: 'relative', flex: '1 1 240px' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search staff by name, email, staff ID or job title..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchStaffList()}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Subsidiary filter */}
              <select
                value={staffSubFilter}
                onChange={(e) => {
                  setStaffSubFilter(e.target.value);
                  setTimeout(fetchStaffList, 50);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#ffffff',
                }}
              >
                <option value="">All Operating Entities</option>
                {overview?.subsidiaries?.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={staffStatusFilter}
                onChange={(e) => {
                  setStaffStatusFilter(e.target.value);
                  setTimeout(fetchStaffList, 50);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#ffffff',
                }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="TERMINATED">Terminated</option>
              </select>

              <button
                onClick={fetchStaffList}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Search size={14} /> Filter
              </button>
            </div>

            {/* Staff Table */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>STAFF MEMBER</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>ROLE / DESIGNATION</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>SUBSIDIARY</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>ONBOARDING STATUS</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>COMPENSATION</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                        No staff members found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((st) => (
                      <tr
                        key={st.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onClick={() => {
                          setSelectedStaff(st);
                          setIsDossierOpen(true);
                        }}
                      >
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '14px',
                              }}
                            >
                              {st.legalName.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{st.legalName}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {st.employeeNumber} • {st.workEmail}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#334155' }}>
                          <div style={{ fontWeight: 600 }}>{st.jobTitle || 'Staff Officer'}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{st.staffGrade || 'General Grade'}</div>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#334155' }}>
                          {st.primaryAssignment?.subsidiary?.legalName || 'BEMS Group'}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {st.approvalStatus === 'APPROVED' ? (
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#15803d',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Approved
                            </span>
                          ) : st.approvalStatus === 'PENDING_APPROVAL' ? (
                            <span
                              style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Pending Approval
                            </span>
                          ) : (
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Rejected
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0f172a' }}>
                          {st.currentGrossMinor && st.currentGrossMinor !== '0'
                            ? `₦${(Number(st.currentGrossMinor) / 100).toLocaleString()}`
                            : 'Pending Setup'}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStaff(st);
                              setIsDossierOpen(true);
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            View Dossier
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Staff Dossier Slide-Over Drawer */}
            {isDossierOpen && selectedStaff && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  maxWidth: '540px',
                  background: '#ffffff',
                  boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                }}
              >
                {/* Drawer Header */}
                <div
                  style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    background: '#ffffff',
                    zIndex: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#e0e7ff',
                        color: '#4338ca',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '18px',
                      }}
                    >
                      {selectedStaff.legalName.charAt(0)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                        {selectedStaff.legalName}
                      </h3>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {selectedStaff.employeeNumber} • {selectedStaff.jobTitle || 'Staff'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDossierOpen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '6px',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Drawer Body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Onboarding Approval Callout */}
                  {selectedStaff.approvalStatus === 'PENDING_APPROVAL' && (
                    <div
                      style={{
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        padding: '16px',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 700, fontSize: '13px' }}>
                        <AlertTriangle size={16} /> Action Required: Onboarding Approval
                      </div>
                      <p style={{ fontSize: '12px', color: '#92400e', margin: '6px 0 12px 0' }}>
                        Staff self-registered. Please verify bank credentials, identity information, and approve or reject.
                      </p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleApproveStaff(selectedStaff.id)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            background: '#15803d',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Approve Staff Member
                        </button>
                        <button
                          onClick={() => handleRejectStaff(selectedStaff.id)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            background: '#b91c1c',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Reject Registration
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section: Employment & Statutory */}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#4f46e5', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                      Enterprise Details
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ color: '#64748b' }}>Work Location</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                          {selectedStaff.workLocation || 'Lagos HQ'}
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ color: '#64748b' }}>Staff Grade</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                          {selectedStaff.staffGrade || 'Officer'}
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ color: '#64748b' }}>National ID (NIN)</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                          {selectedStaff.nin || 'Not provided'}
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ color: '#64748b' }}>BVN Verification</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                          {selectedStaff.bvn || 'Not provided'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Banking Credentials */}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#4f46e5', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                      Disbursement & Salary Banking
                    </h4>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b' }}>Primary Bank:</span>
                        <strong style={{ color: '#0f172a' }}>{selectedStaff.bankName || 'Not Set'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b' }}>Account Number:</span>
                        <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>
                          {selectedStaff.accountNumber || '—'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Account Name:</span>
                        <strong style={{ color: '#0f172a' }}>{selectedStaff.accountName || '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Section: Emergency & Next of Kin */}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#4f46e5', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                      Next of Kin / Emergency Contact
                    </h4>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: '#64748b' }}>Name:</span>
                        <strong style={{ color: '#0f172a' }}>{selectedStaff.nextOfKinName || 'Not recorded'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: '#64748b' }}>Phone:</span>
                        <strong style={{ color: '#0f172a' }}>{selectedStaff.nextOfKinPhone || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Relationship:</span>
                        <strong style={{ color: '#0f172a' }}>{selectedStaff.nextOfKinRelationship || '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setIsProfileReqModalOpen(true)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        background: '#e0e7ff',
                        color: '#4338ca',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Request Info Update
                    </button>
                    <button
                      onClick={() => {
                        setIsDossierOpen(false);
                        setActiveTab('CHAT');
                        selectChatThread(selectedStaff.id);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        background: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Direct Message
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE ATTENDANCE RADAR */}
        {activeTab === 'ATTENDANCE' && (
          <div>
            {/* Filter controls */}
            <div
              style={{
                background: '#ffffff',
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Select Date:</span>
                <input
                  type="date"
                  value={attDate}
                  onChange={(e) => {
                    setAttDate(e.target.value);
                    fetchAttendanceRecords(e.target.value);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <select
                value={attStatusFilter}
                onChange={(e) => {
                  setAttStatusFilter(e.target.value);
                  setTimeout(fetchAttendanceRecords, 50);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#ffffff',
                }}
              >
                <option value="ALL">All Punctuality Statuses</option>
                <option value="PRESENT">Present (On Time)</option>
                <option value="LATE">Late Check-Ins</option>
                <option value="EXCUSED">Excused / Waived</option>
              </select>

              <button
                onClick={() => fetchAttendanceRecords()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} /> Refresh Roster
              </button>

              <button
                onClick={() => setIsManualOverrideOpen(true)}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Record Manual Punch
              </button>
            </div>

            {/* Attendance Roster Table */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>EMPLOYEE</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>CHECK-IN TIME</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>PUNCTUALITY STATUS</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>STATION & GEOFENCE</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700 }}>EXCUSE / WAIVER STATUS</th>
                    <th style={{ padding: '12px 18px', fontWeight: 700, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                        No attendance records logged for {attDate || 'selected date'}.
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.employeeName}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {r.employeeNumber} • {r.subsidiary?.legalName || 'BEMS'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </div>
                          {r.isManualOverride && (
                            <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: 700 }}>[Manual Override]</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {r.status === 'PRESENT' ? (
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#15803d',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              On Time
                            </span>
                          ) : r.status === 'LATE' ? (
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Late Arrival
                            </span>
                          ) : (
                            <span
                              style={{
                                background: '#e0e7ff',
                                color: '#4338ca',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              {r.status}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', color: '#334155' }}>
                          <div>{r.stationName}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {r.checkInDistanceM !== null && r.checkInDistanceM !== undefined
                              ? `${Math.round(r.checkInDistanceM)}m from station`
                              : 'Kiosk / Manual'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {r.excuseStatus === 'PENDING_GMD_APPROVAL' ? (
                            <span
                              style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Pending GMD Sign-Off
                            </span>
                          ) : r.excuseStatus === 'APPROVED' ? (
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#15803d',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Penalty Waived
                            </span>
                          ) : r.excuseStatus === 'REJECTED' ? (
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Waiver Declined
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>None</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          {r.status === 'LATE' && r.excuseStatus === 'NONE' && (
                            <button
                              onClick={() => setSelectedRecordForExcuse(r)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Request Excuse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Excuse Request Modal */}
            {selectedRecordForExcuse && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 60,
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    maxWidth: '480px',
                    width: '100%',
                    padding: '24px',
                  }}
                >
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Request Lateness Waiver for GMD
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
                    Submit an official waiver justification on behalf of{' '}
                    <strong>{selectedRecordForExcuse.employeeName}</strong> for arrival on {selectedRecordForExcuse.workDate}.
                  </p>
                  <textarea
                    rows={4}
                    placeholder="Provide operational reason (e.g. Field emergency, official transit delay, medical certificate submitted)..."
                    value={excuseNoteInput}
                    onChange={(e) => setExcuseNoteInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      marginBottom: '16px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setSelectedRecordForExcuse(null)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitExcuseRequest}
                      disabled={isExcuseSubmitting || !excuseNoteInput.trim()}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isExcuseSubmitting ? 'Submitting...' : 'Submit to GMD'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LEAVE REQUESTS */}
        {activeTab === 'LEAVE' && (
          <div>
            {/* Header and Actions */}
            <div
              style={{
                background: '#ffffff',
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setLeaveFilter(st);
                      setTimeout(fetchLeaveRequests, 50);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: leaveFilter === st ? '#4f46e5' : '#f1f5f9',
                      color: leaveFilter === st ? '#ffffff' : '#475569',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {st === 'ALL' ? 'All Requests' : st}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsNewLeaveModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Record Staff Leave
              </button>
            </div>

            {/* Leave Applications Queue */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: '16px',
              }}
            >
              {leaveRequests.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    background: '#ffffff',
                    padding: '48px',
                    borderRadius: '14px',
                    textAlign: 'center',
                    color: '#94a3b8',
                  }}
                >
                  No leave requests found for filter: {leaveFilter}.
                </div>
              ) : (
                leaveRequests.map((lv) => (
                  <div
                    key={lv.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                          {lv.employeeName}
                        </h4>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {lv.employeeNumber} • {lv.subsidiary}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background:
                            lv.status === 'APPROVED' ? '#dcfce7' : lv.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                          color:
                            lv.status === 'APPROVED' ? '#15803d' : lv.status === 'PENDING' ? '#b45309' : '#b91c1c',
                        }}
                      >
                        {lv.status}
                      </span>
                    </div>

                    <div style={{ margin: '14px 0', padding: '10px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#64748b' }}>Leave Type:</span>
                        <strong style={{ color: '#4f46e5' }}>{lv.leaveType}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Duration:</span>
                        <strong style={{ color: '#0f172a' }}>
                          {lv.startDate} to {lv.endDate}
                        </strong>
                      </div>
                    </div>

                    <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                      <strong>Reason:</strong> {lv.reason}
                    </p>

                    {lv.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                        <button
                          onClick={() => handleApproveLeave(lv.id)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            background: '#15803d',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Approve Leave
                        </button>
                        <button
                          onClick={() => handleRejectLeave(lv.id)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            color: '#b91c1c',
                            border: '1px solid #fee2e2',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* New Leave Modal */}
            {isNewLeaveModalOpen && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 60,
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    maxWidth: '480px',
                    width: '100%',
                    padding: '24px',
                  }}
                >
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Record Staff Leave Application
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Select Staff Member</label>
                      <select
                        value={newLeaveForm.employeeId}
                        onChange={(e) => setNewLeaveForm({ ...newLeaveForm, employeeId: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          marginTop: '4px',
                        }}
                      >
                        <option value="">Select an employee...</option>
                        {staffList.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.legalName} ({st.employeeNumber})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Leave Type</label>
                      <select
                        value={newLeaveForm.leaveType}
                        onChange={(e) => setNewLeaveForm({ ...newLeaveForm, leaveType: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          marginTop: '4px',
                        }}
                      >
                        <option value="ANNUAL">Annual Leave</option>
                        <option value="SICK">Sick / Medical Leave</option>
                        <option value="CASUAL">Casual Leave</option>
                        <option value="MATERNITY">Maternity Leave</option>
                        <option value="PATERNITY">Paternity Leave</option>
                        <option value="COMPASSIONATE">Compassionate Leave</option>
                        <option value="STUDY">Study / Examination Leave</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Start Date</label>
                        <input
                          type="date"
                          value={newLeaveForm.startDate}
                          onChange={(e) => setNewLeaveForm({ ...newLeaveForm, startDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            marginTop: '4px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>End Date</label>
                        <input
                          type="date"
                          value={newLeaveForm.endDate}
                          onChange={(e) => setNewLeaveForm({ ...newLeaveForm, endDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            marginTop: '4px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Reason</label>
                      <textarea
                        rows={3}
                        value={newLeaveForm.reason}
                        onChange={(e) => setNewLeaveForm({ ...newLeaveForm, reason: e.target.value })}
                        placeholder="Purpose of leave..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          marginTop: '4px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button
                      onClick={() => setIsNewLeaveModalOpen(false)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateLeave}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Submit Leave Request
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PAYROLL PREPARATION */}
        {activeTab === 'PAYROLL' && (() => {
          const enrolledStaffList = staffList.filter((s: any) => {
            if (!payrollSearch.trim()) return true;
            const q = payrollSearch.toLowerCase();
            const nameMatch = (s.legalName || '').toLowerCase().includes(q);
            const idMatch = (s.employeeNumber || '').toLowerCase().includes(q);
            const subMatch = (s.primaryAssignment?.subsidiary?.legalName || '').toLowerCase().includes(q);
            const deptMatch = (s.primaryAssignment?.department?.name || '').toLowerCase().includes(q);
            const jobMatch = (s.jobTitle || '').toLowerCase().includes(q);
            return nameMatch || idMatch || subMatch || deptMatch || jobMatch;
          });

          const eligibleStaffCount = staffList.filter((s: any) => Number(s.currentGrossMinor || 0) > 0).length;
          const totalBasePayroll = staffList.reduce((acc: number, s: any) => {
            return acc + (Number(s.currentGrossMinor || 0) / 100);
          }, 0);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  padding: '32px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '12px',
                      background: '#e0e7ff',
                      color: '#4338ca',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <DollarSign size={26} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      Monthly Payroll Preparation Desk
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Roll up verified attendance logs, compute lateness deductions, and assemble draft batch for GMD sign-off.
                    </p>
                  </div>
                </div>

                {payrollPrepareNotice && (
                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: '10px',
                      background: payrollPrepareNotice.startsWith('Error') ? '#fee2e2' : '#dcfce7',
                      color: payrollPrepareNotice.startsWith('Error') ? '#b91c1c' : '#15803d',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '20px',
                    }}
                  >
                    {payrollPrepareNotice}
                  </div>
                )}

                {/* Status Box */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>LAST BATCH STATUS</span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                        {overview?.latestPayrollBatch?.status || 'No Active Batch'}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>HEADCOUNT ENROLLED</span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#4f46e5', marginTop: '4px' }}>
                        {overview?.latestPayrollBatch
                          ? `${overview.latestPayrollBatch.totalHeadcount} Staff`
                          : `${eligibleStaffCount || 0} Staff (Ready)`}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>ESTIMATED NET TOTAL</span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                        {overview?.latestPayrollBatch?.totalNetMinor
                          ? `₦${(Number(overview.latestPayrollBatch.totalNetMinor) / 100).toLocaleString()}`
                          : totalBasePayroll > 0
                          ? `₦${totalBasePayroll.toLocaleString()} (Est. Base)`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step Process Description */}
                <div style={{ marginBottom: '28px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>
                    HR Preparation Workflow:
                  </h4>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '6px' }}>
                      <strong>Verify Attendance Logs:</strong> Ensure lateness excuses have been reviewed and forwarded to GMD.
                    </li>
                    <li style={{ marginBottom: '6px' }}>
                      <strong>Generate Draft Batch:</strong> Click below to roll up active employee agreements and compute statutory & lateness deductions.
                    </li>
                    <li>
                      <strong>GMD Sign-Off & Disbursement:</strong> The GMD will inspect the draft batch on their Executive App/Dashboard, adjust individual pay if needed, and authorize the disbursement batch.
                    </li>
                  </ol>
                </div>

                {/* Preparation Trigger Button */}
                <button
                  onClick={handlePreparePayroll}
                  disabled={payrollLoading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                  }}
                >
                  {payrollLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Preparing Draft Batch...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} /> Run Payroll Calculation & Submit Batch to GMD
                    </>
                  )}
                </button>
              </div>

              {/* ITEMIZE STAFF PAYROLL ROSTER */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    background: '#f8fafc',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Enrolled Staff Payroll Roster Preview
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Verified active staff agreements eligible for monthly payroll calculation
                    </p>
                  </div>

                  {/* Search Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '8px 14px',
                      width: '280px',
                    }}
                  >
                    <Search size={15} color="#64748b" />
                    <input
                      type="text"
                      placeholder="Search roster by name, ID, title..."
                      value={payrollSearch}
                      onChange={(e) => setPayrollSearch(e.target.value)}
                      style={{
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '13px',
                        width: '100%',
                        color: '#0f172a',
                      }}
                    />
                    {payrollSearch && (
                      <button
                        onClick={() => setPayrollSearch('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={14} color="#94a3b8" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary Strip */}
                <div
                  style={{
                    padding: '12px 24px',
                    background: '#f1f5f9',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                  }}
                >
                  <span>
                    Enrolled Roster: <strong style={{ color: '#4f46e5' }}>{eligibleStaffCount} Active Staff</strong>
                  </span>
                  <span>
                    Live Monthly Base Total:{' '}
                    <strong style={{ color: '#15803d' }}>
                      ₦{totalBasePayroll.toLocaleString()}
                    </strong>
                  </span>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <th style={{ padding: '12px 20px', width: '50px' }}>#</th>
                        <th style={{ padding: '12px 20px' }}>Staff Member</th>
                        <th style={{ padding: '12px 20px' }}>Department / Subsidiary</th>
                        <th style={{ padding: '12px 20px' }}>Role / Job Title</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}>Monthly Base Salary</th>
                        <th style={{ padding: '12px 20px', textAlign: 'center' }}>Compensation Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolledStaffList.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                            No staff records matching your search.
                          </td>
                        </tr>
                      ) : (
                        enrolledStaffList.map((staff: any, idx: number) => {
                          const grossMinor = Number(staff.currentGrossMinor || 0);
                          const hasSalary = grossMinor > 0;
                          const salaryFormatted = hasSalary
                            ? `₦${(grossMinor / 100).toLocaleString()}`
                            : 'Not Configured';

                          const initials = (staff.legalName || 'ST')
                            .split(' ')
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();

                          return (
                            <tr
                              key={staff.id}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      background: '#e0e7ff',
                                      color: '#4338ca',
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontWeight: 800,
                                      fontSize: '11px',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {initials}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{staff.legalName}</div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{staff.employeeNumber || 'ID Pending'}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                  {staff.primaryAssignment?.department?.name || 'Operations'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {staff.primaryAssignment?.subsidiary?.legalName || 'BEMS Group'}
                                </div>
                              </td>
                              <td style={{ padding: '14px 20px', color: '#475569' }}>
                                {staff.jobTitle || 'Staff Member'}
                              </td>
                              <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: hasSalary ? '#0f172a' : '#94a3b8' }}>
                                {salaryFormatted}
                              </td>
                              <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                {hasSalary ? (
                                  <span
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: '#ecfdf5',
                                      color: '#059669',
                                      border: '1px solid #a7f3d0',
                                    }}
                                  >
                                    Enrolled
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: '#fef2f2',
                                      color: '#dc2626',
                                      border: '1px solid #fecaca',
                                    }}
                                  >
                                    No Salary Set
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 6: STAFF HELPDESK CHAT */}
        {activeTab === 'CHAT' && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              height: '75vh',
            }}
          >
            {/* Thread list sidebar */}
            <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '14px' }}>
                Staff Conversations
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {chatThreads.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No messages logged yet.
                  </div>
                ) : (
                  chatThreads.map((th) => {
                    const isSelected = activeChatStaffId === th.employee?.id;
                    return (
                      <div
                        key={th.employee?.id}
                        onClick={() => selectChatThread(th.employee?.id)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          background: isSelected ? '#eef2ff' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: '#e0e7ff',
                            color: '#4338ca',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        >
                          {th.employee?.legalName?.charAt(0) || 'S'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {th.employee?.legalName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {th.lastMessage?.message || 'Started chat'}
                          </div>
                        </div>
                        {th.unreadCount > 0 && (
                          <span
                            style={{
                              background: '#ef4444',
                              color: '#ffffff',
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '999px',
                            }}
                          >
                            {th.unreadCount}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Conversation view */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {activeChatStaffId ? (
                <>
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    Direct Message Thread
                  </div>
                  {/* Messages list */}
                  <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeChatMessages.map((msg) => {
                      const isMe = msg.senderId === user.id || msg.senderRole !== 'STAFF';
                      return (
                        <div
                          key={msg.id}
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '70%',
                            background: isMe ? '#4f46e5' : '#f1f5f9',
                            color: isMe ? '#ffffff' : '#0f172a',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            lineHeight: 1.4,
                          }}
                        >
                          <div style={{ fontSize: '10px', color: isMe ? '#c7d2fe' : '#64748b', marginBottom: '2px', fontWeight: 600 }}>
                            {msg.senderName}
                          </div>
                          <div>{msg.message}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Chat input box */}
                  <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Type official message or inquiry response to staff..."
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleSendChatMessage}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        background: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Send size={14} /> Send
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  Select a staff conversation to start messaging.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

