'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  X,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  Users,
  Clock,
  Wallet,
  Download,
  RefreshCw,
  MapPin,
  Calendar,
  FileText,
  Award,
  AlertTriangle,
  Laptop,
  HeartHandshake,
  Activity,
  Briefcase,
} from 'lucide-react';
import {
  HrStaffMember,
  HrSubsidiarySummary,
  formatNairaMinor,
} from './hrTypes';

const PROFILE_TABS = [
  'Overview',
  'Employment',
  'Attendance',
  'Payroll',
  'Leave',
  'Performance',
  'Documents',
  'Requests',
  'Discipline',
  'Activity Log',
  'Benefits',
  'Assets',
] as const;

type ProfileTab = (typeof PROFILE_TABS)[number];

interface HrEmployeesPanelProps {
  subsidiaries: HrSubsidiarySummary[];
  selectedSubsidiaryId: string;
  initialApprovalFilter?: string;
  activeBrandColor?: string;
  onRefreshOverview: () => void;
}

interface DossierPayload {
  attendanceRecords: any[];
  leaveRequests: any[];
  payrollItems: any[];
  deductions: any[];
  loans: any[];
  evaluations: any[];
  pips: any[];
  documents: any[];
  requests: any[];
  profileUpdates: any[];
  disciplinaryCases: any[];
  grievances: any[];
  trainings: any[];
  statutoryPolicy?: {
    pensionEmployerRate: number;
    pensionEmployeeRate: number;
    nhfRate: number;
  };
}

export default function HrEmployeesPanel({
  subsidiaries,
  selectedSubsidiaryId,
  initialApprovalFilter = 'ALL',
  activeBrandColor = '#ea580c',
  onRefreshOverview,
}: HrEmployeesPanelProps) {
  const [staff, setStaff] = useState<HrStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState(initialApprovalFilter);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedStaff, setSelectedStaff] = useState<HrStaffMember | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>('Overview');
  const [dossier, setDossier] = useState<DossierPayload | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Finance-parity Admin Controls State (Details Edit, Salary Edit, Exemptions)
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; subsidiaryId?: string }>>([]);
  const [editingCorporate, setEditingCorporate] = useState(false);
  const [corporateSaving, setCorporateSaving] = useState(false);
  const [corpForm, setCorpForm] = useState({
    positionName: '',
    subsidiaryId: '',
    departmentId: '',
    employmentType: 'FULL_TIME',
    staffGrade: '',
    workLocation: '',
    resumptionDate: '',
  });
  const [salaryType, setSalaryType] = useState<'SET_EXACT' | 'ADDITION' | 'DEDUCTION' | 'REMOVE_FROM_PAYROLL'>('SET_EXACT');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryReason, setSalaryReason] = useState('');
  const [salarySaving, setSalarySaving] = useState(false);

  useEffect(() => {
    fetch('/api/departments', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { departments: [] }))
      .then((d) => setDepartments(Array.isArray(d.departments) ? d.departments : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setApprovalFilter(initialApprovalFilter);
  }, [initialApprovalFilter]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (selectedSubsidiaryId) params.set('subsidiaryId', selectedSubsidiaryId);
      if (approvalFilter !== 'ALL') params.set('approvalStatus', approvalFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/hr/staff?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) {
        setStaff(data.staff || []);
      } else {
        setBanner({ type: 'err', text: data.error || 'Failed to load staff directory.' });
      }
    } catch {
      setBanner({ type: 'err', text: 'Network error loading staff directory.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubsidiaryId, approvalFilter, statusFilter]);

  const openDossier = async (member: HrStaffMember) => {
    setSelectedStaff(member);
    setActiveProfileTab('Overview');
    setEditingCorporate(false);
    setSalaryAmount('');
    setSalaryReason('');
    setDossier(null);
    setDossierLoading(true);
    try {
      const res = await fetch(`/api/hr/staff/${encodeURIComponent(member.id)}/dossier`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.dossier) {
        setDossier(data.dossier);
      }
    } catch {
      // Fallback gracefully with base profile fields
    } finally {
      setDossierLoading(false);
    }
  };

  const startEditCorporate = () => {
    if (!selectedStaff) return;
    setCorpForm({
      positionName: selectedStaff.jobTitle || '',
      subsidiaryId: selectedStaff.primaryAssignment?.subsidiary?.id || subsidiaries[0]?.id || '',
      departmentId: selectedStaff.primaryAssignment?.department?.id || '',
      employmentType: selectedStaff.employmentType || 'FULL_TIME',
      staffGrade: selectedStaff.staffGrade || '',
      workLocation: selectedStaff.workLocation || '',
      resumptionDate: selectedStaff.resumptionDate ? new Date(selectedStaff.resumptionDate).toISOString().slice(0, 10) : '',
    });
    setEditingCorporate(true);
    setActiveProfileTab('Employment');
  };

  const saveCorporatePlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setCorporateSaving(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/employees/${encodeURIComponent(selectedStaff.id)}/corporate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(corpForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update employee details.');
      setBanner({ type: 'ok', text: data.message || 'Employee details & corporate placement updated.' });
      setEditingCorporate(false);
      setSelectedStaff((prev) =>
        prev
          ? {
              ...prev,
              jobTitle: corpForm.positionName || prev.jobTitle,
              employmentType: corpForm.employmentType,
              staffGrade: corpForm.staffGrade,
              workLocation: corpForm.workLocation,
              resumptionDate: corpForm.resumptionDate || prev.resumptionDate,
            }
          : null
      );
      await loadStaff();
      onRefreshOverview();
    } catch (err: any) {
      setBanner({ type: 'err', text: err?.message || 'Error updating employee details.' });
    } finally {
      setCorporateSaving(false);
    }
  };

  const handleSalaryChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setSalarySaving(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/staff/${encodeURIComponent(selectedStaff.id)}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          changeType: salaryType,
          amount: salaryType === 'REMOVE_FROM_PAYROLL' ? 0 : salaryAmount,
          reason: salaryReason.trim() || 'Executive HR salary review and update',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update salary.');
      setBanner({
        type: 'ok',
        text: data.pendingApproval
          ? `${data.message} Proposed gross: ${data.proposedGrossFormatted}.`
          : `${data.message}${data.newGrossFormatted ? ` New gross: ${data.newGrossFormatted}.` : ''}`,
      });
      setSalaryAmount('');
      setSalaryReason('');
      await loadStaff();
      onRefreshOverview();
      await openDossier(selectedStaff);
    } catch (err: any) {
      setBanner({ type: 'err', text: err?.message || 'Error updating salary.' });
    } finally {
      setSalarySaving(false);
    }
  };

  const toggleAttendanceExemption = async (employeeId: string, exempt: boolean, name: string) => {
    const confirmPrompt = exempt
      ? `Remove ${name} from attendance signing?\n\nThey will no longer appear in the daily attendance list and will NOT be flagged as absent.`
      : `Require ${name} to sign daily attendance?`;
    if (!window.confirm(confirmPrompt)) return;
    setBusyId(employeeId);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/employees/${encodeURIComponent(employeeId)}/attendance-exemption`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isAttendanceExempt: exempt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update attendance exemption.');
      setBanner({
        type: 'ok',
        text: data.message || (exempt ? `${name} is now exempt from attendance.` : `${name} now requires attendance.`),
      });
      setSelectedStaff((prev) => (prev ? ({ ...prev, isAttendanceExempt: exempt } as any) : null));
      await loadStaff();
      onRefreshOverview();
    } catch (err: any) {
      setBanner({ type: 'err', text: err?.message || 'Error updating attendance exemption.' });
    } finally {
      setBusyId(null);
    }
  };

  const toggleSalaryExemption = async (employeeId: string, currentlyExempt: boolean, name: string) => {
    if (currentlyExempt) {
      setActiveProfileTab('Payroll');
      setSalaryType('SET_EXACT');
      setBanner({ type: 'ok', text: `Enter the monthly gross salary below to re-enroll ${name} on salary payroll.` });
      return;
    }
    if (!window.confirm(`Exempt ${name} from monthly salary payroll?\n\nTheir recurring salary will be set to ₦0 and they will be removed from unpaid payroll batches.`)) {
      return;
    }
    setBusyId(employeeId);
    setBanner(null);
    try {
      const res = await fetch(`/api/staff/${encodeURIComponent(employeeId)}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          changeType: 'REMOVE_FROM_PAYROLL',
          amount: 0,
          reason: `Salary payroll exemption enabled for ${name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payroll exemption.');
      setBanner({ type: 'ok', text: data.message || `${name} is now exempt from salary payroll.` });
      setSelectedStaff((prev) => (prev ? { ...prev, currentGrossMinor: '0' } : null));
      await loadStaff();
      onRefreshOverview();
    } catch (err: any) {
      setBanner({ type: 'err', text: err?.message || 'Error updating payroll exemption.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleAction = async (
    employeeId: string,
    action: 'APPROVE_ONBOARDING' | 'REJECT_ONBOARDING' | 'UPDATE_STATUS',
    extra?: Record<string, string>
  ) => {
    setBusyId(employeeId);
    setBanner(null);
    try {
      const res = await fetch('/api/hr/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, employeeId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'err', text: data.error || 'Action failed.' });
      } else {
        setBanner({ type: 'ok', text: `Updated staff record (${action.replace('_', ' ')}).` });
        await loadStaff();
        onRefreshOverview();
        if (selectedStaff?.id === employeeId && data.employee) {
          setSelectedStaff((prev) => (prev ? { ...prev, ...data.employee } : null));
        }
      }
    } catch {
      setBanner({ type: 'err', text: 'Network error updating staff.' });
    } finally {
      setBusyId(null);
    }
  };

  const metrics = useMemo(() => {
    const total = staff.length;
    const active = staff.filter((s) => s.status === 'ACTIVE').length;
    const pendingOnboarding = staff.filter((s) => s.approvalStatus === 'PENDING_APPROVAL').length;
    const totalGrossMinor = staff.reduce((acc, s) => acc + Number(s.currentGrossMinor || 0), 0);
    return { total, active, pendingOnboarding, totalGrossMinor };
  }, [staff]);

  const exportCsv = () => {
    const rows = [
      ['Staff ID', 'Full Name', 'Email', 'Subsidiary', 'Department', 'Job Title', 'Grade', 'Gross Pay (NGN)', 'Onboarding', 'Status'],
      ...staff.map((s) => [
        s.employeeNumber || '',
        s.legalName,
        s.workEmail,
        s.primaryAssignment?.subsidiary?.legalName || 'BEMS Group',
        s.primaryAssignment?.department?.name || 'General',
        s.jobTitle || '',
        s.staffGrade || '',
        String(Number(s.currentGrossMinor || 0) / 100),
        s.approvalStatus,
        s.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bems_employee_directory.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getTabCount = (tab: ProfileTab): number | null => {
    if (!dossier) return null;
    switch (tab) {
      case 'Attendance':
        return dossier.attendanceRecords.length;
      case 'Payroll':
        return dossier.payrollItems.length;
      case 'Leave':
        return dossier.leaveRequests.length;
      case 'Performance':
        return dossier.evaluations.length + dossier.pips.length;
      case 'Documents':
        return dossier.documents.length;
      case 'Requests':
        return dossier.requests.length + dossier.profileUpdates.length;
      case 'Discipline':
        return dossier.disciplinaryCases.length + dossier.grievances.length;
      case 'Benefits':
        return dossier.trainings.length + dossier.loans.length;
      default:
        return null;
    }
  };

  const activityTimeline = useMemo(() => {
    if (!dossier) return [];
    const events: { date: string; title: string; detail: string; category: string }[] = [];
    dossier.attendanceRecords.slice(0, 5).forEach((a) => {
      events.push({
        date: a.workDate,
        title: `Attendance: ${a.status}`,
        detail: a.station?.name ? `Station: ${a.station.name}` : 'Recorded check-in',
        category: 'Attendance',
      });
    });
    dossier.leaveRequests.slice(0, 5).forEach((l) => {
      events.push({
        date: l.createdAt,
        title: `Leave Request (${l.leaveType})`,
        detail: `${l.startDate} to ${l.endDate} · ${l.status}`,
        category: 'Leave',
      });
    });
    dossier.requests.slice(0, 5).forEach((r) => {
      events.push({
        date: r.createdAt,
        title: `HR Request: ${r.subject}`,
        detail: `${r.category} · ${r.status}`,
        category: 'Requests',
      });
    });
    dossier.documents.slice(0, 5).forEach((d) => {
      events.push({
        date: d.createdAt,
        title: `Document: ${d.title}`,
        detail: `${d.category} · ${d.status}`,
        category: 'Documents',
      });
    });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 12);
  }, [dossier]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {banner && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 600,
            background: banner.type === 'ok' ? '#ecfdf5' : '#fef2f2',
            color: banner.type === 'ok' ? '#047857' : '#b91c1c',
            border: `1px solid ${banner.type === 'ok' ? '#a7f3d0' : '#fecaca'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Workforce</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.total}</div>
          <p className="mt-1 text-xs text-slate-500">Matching current scope & filters</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Roster</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.active}</div>
          <p className="mt-1 text-xs text-slate-500">Operational & cleared for payroll</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Onboarding</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.pendingOnboarding}</div>
          <p className="mt-1 text-xs text-slate-500">Awaiting HR approval sign-off</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Gross Payroll</span>
            <Wallet className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatNairaMinor(metrics.totalGrossMinor)}</div>
          <p className="mt-1 text-xs text-slate-500">Active agreements in directory</p>
        </div>
      </div>

      {/* Quick Filter Sub-Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-3">
        <div className="flex items-center gap-6 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Staff Directory', approval: 'ALL', status: 'ALL' },
            { id: 'ACTIVE', label: 'Active Employees', approval: 'ALL', status: 'ACTIVE' },
            { id: 'PENDING', label: 'Pending Onboarding', approval: 'PENDING_APPROVAL', status: 'ALL' },
            { id: 'SUSPENDED', label: 'Suspended / Offboarded', approval: 'ALL', status: 'SUSPENDED' },
          ].map((t) => {
            const active =
              (t.id === 'ALL' && approvalFilter === 'ALL' && statusFilter === 'ALL') ||
              (t.id === 'ACTIVE' && statusFilter === 'ACTIVE' && approvalFilter === 'ALL') ||
              (t.id === 'PENDING' && approvalFilter === 'PENDING_APPROVAL') ||
              (t.id === 'SUSPENDED' && statusFilter === 'SUSPENDED');
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setApprovalFilter(t.approval);
                  setStatusFilter(t.status);
                }}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  active ? 'text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                style={active ? { borderColor: activeBrandColor, color: activeBrandColor } : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadStaff()}
              placeholder="Search name, staff ID, email, or role..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={loadStaff}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
            style={{ backgroundColor: activeBrandColor }}
          >
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Onboarding States</option>
            <option value="PENDING_APPROVAL">Pending Onboarding</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Employment Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="TERMINATED">Terminated</option>
          </select>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={loadStaff}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Staff Register Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <strong className="text-sm font-bold text-slate-900">
            Employee Directory ({staff.length})
          </strong>
          <span className="text-xs text-slate-500">
            Click any employee row or View Dossier to inspect their 12-tab HR dossier
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Subsidiary & Dept</th>
                <th className="px-4 py-3">Role / Grade</th>
                <th className="px-4 py-3">Gross Pay</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Loading staff directory...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No employees matched your filter criteria.
                  </td>
                </tr>
              ) : (
                staff.map((s) => {
                  const subName = s.primaryAssignment?.subsidiary?.legalName || 'BEMS Group';
                  const deptName = s.primaryAssignment?.department?.name || 'General';
                  const isPending = s.approvalStatus === 'PENDING_APPROVAL';
                  const initials = s.legalName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={s.id}
                      onClick={() => openDossier(s)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {s.avatarUrl ? (
                            <img
                              src={s.avatarUrl}
                              alt={s.legalName}
                              className="h-9 w-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div
                              className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: `${activeBrandColor}18`, color: activeBrandColor }}
                            >
                              {initials}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900">{s.legalName}</div>
                            <div className="text-xs text-slate-500">
                              {s.employeeNumber || 'No ID'} · {s.workEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">{subName}</div>
                        <div className="text-xs text-slate-500">{deptName}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">{s.jobTitle || 'Staff'}</div>
                        <div className="text-xs text-slate-500">
                          {s.employmentType || 'FULL_TIME'} · {s.staffGrade || 'Standard'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {formatNairaMinor(s.currentGrossMinor)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            isPending
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : s.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isPending ? 'Pending Onboarding' : s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === s.id}
                                onClick={() => handleAction(s.id, 'APPROVE_ONBOARDING')}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                <UserCheck size={13} /> Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyId === s.id}
                                onClick={() => handleAction(s.id, 'REJECT_ONBOARDING')}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                <UserX size={13} /> Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => openDossier(s)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View Dossier
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rich 12-Tab Employee Dossier Drawer */}
      {selectedStaff && (
        <div
          onClick={() => setSelectedStaff(null)}
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-slate-50 h-full overflow-y-auto flex flex-col shadow-2xl"
          >
            {/* Hero Profile Header */}
            <div
              className="border-b border-slate-200 p-6"
              style={{
                background: `linear-gradient(135deg, ${activeBrandColor}12 0%, #ffffff 65%)`,
                borderTop: `4px solid ${activeBrandColor}`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {selectedStaff.avatarUrl ? (
                    <img
                      src={selectedStaff.avatarUrl}
                      alt={selectedStaff.legalName}
                      className="h-16 w-16 rounded-2xl object-cover border-2 border-white shadow-md"
                    />
                  ) : (
                    <div
                      className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-extrabold shadow-sm border border-white"
                      style={{ backgroundColor: activeBrandColor, color: '#ffffff' }}
                    >
                      {selectedStaff.legalName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-extrabold text-slate-900">{selectedStaff.legalName}</h2>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          selectedStaff.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {selectedStaff.status}
                      </span>
                      {selectedStaff.approvalStatus === 'PENDING_APPROVAL' && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Pending Onboarding
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      <span className="font-bold text-slate-800">{selectedStaff.employeeNumber}</span> · {selectedStaff.jobTitle || 'Staff'} ·{' '}
                      {selectedStaff.primaryAssignment?.department?.name || 'General'} ·{' '}
                      {selectedStaff.primaryAssignment?.subsidiary?.legalName || 'BEMS Group'}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2.5 py-1 shadow-xs">
                        <Wallet className="h-3.5 w-3.5" style={{ color: activeBrandColor }} />
                        Gross: <strong className="text-slate-900">{formatNairaMinor(selectedStaff.currentGrossMinor)}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2.5 py-1 shadow-xs">
                        <MapPin className="h-3.5 w-3.5 text-blue-500" />
                        {selectedStaff.workLocation || 'Standard Office'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2.5 py-1 shadow-xs">
                        <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                        Resumed: {selectedStaff.resumptionDate ? new Date(selectedStaff.resumptionDate).toLocaleDateString() : 'Not set'}
                      </span>
                    </div>
                    {/* Finance-Parity Quick Executive Actions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={startEditCorporate}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
                        style={{ backgroundColor: activeBrandColor }}
                      >
                        <Briefcase className="h-3.5 w-3.5" /> Edit Details &amp; Placement
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveProfileTab('Payroll');
                          setSalaryType('SET_EXACT');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                      >
                        <Wallet className="h-3.5 w-3.5 text-emerald-600" /> Edit Salary
                      </button>
                      <button
                        type="button"
                        disabled={busyId === selectedStaff.id}
                        onClick={() =>
                          toggleAttendanceExemption(
                            selectedStaff.id,
                            !Boolean((selectedStaff as any).isAttendanceExempt),
                            selectedStaff.legalName
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs ${
                          (selectedStaff as any).isAttendanceExempt
                            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {(selectedStaff as any).isAttendanceExempt ? 'Attendance Exempt (Click to Require)' : 'Exempt from Attendance'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === selectedStaff.id}
                        onClick={() =>
                          toggleSalaryExemption(
                            selectedStaff.id,
                            Number(selectedStaff.currentGrossMinor || 0) <= 0,
                            selectedStaff.legalName
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                        {Number(selectedStaff.currentGrossMinor || 0) <= 0 ? 'Enroll on Payroll' : 'Exempt from Payroll'}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800 shadow-xs"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 12 Profile Tabs */}
              <div className="mt-5 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-4">
                {PROFILE_TABS.map((tab) => {
                  const active = activeProfileTab === tab;
                  const count = getTabCount(tab);
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveProfileTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                        active ? 'text-white shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                      style={active ? { backgroundColor: activeBrandColor, borderColor: activeBrandColor } : undefined}
                    >
                      <span>{tab}</span>
                      {count !== null && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Body */}
            <div className="p-6 space-y-5 flex-1">
              {dossierLoading && activeProfileTab !== 'Overview' && activeProfileTab !== 'Employment' && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs font-medium text-slate-500">
                  Syncing live {activeProfileTab.toLowerCase()} records from BEMS ledger...
                </div>
              )}

              {activeProfileTab === 'Overview' && (
                <div className="space-y-4">
                  {/* Quick Stat Strip with Icons & Color Accents */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2" style={{ borderTopColor: activeBrandColor }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Attendance</span>
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor }}>
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-slate-900">
                        {dossier ? dossier.attendanceRecords.length : selectedStaff.totalAttendancePunches ?? 0}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Recorded punches</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-amber-500">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Leave</span>
                        <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                          <Calendar className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-slate-900">
                        {dossier ? dossier.leaveRequests.length : selectedStaff.totalLeaves ?? 0}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Leave requests</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-emerald-500">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Documents</span>
                        <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-slate-900">{dossier ? dossier.documents.length : 0}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Contracts &amp; letters</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-indigo-500">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Trainings</span>
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Award className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-slate-900">{dossier ? dossier.trainings.length : 0}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Assigned courses</div>
                    </div>
                  </div>

                  {/* Structured Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                      <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor }}>
                          <Mail className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Contact &amp; Personal Identity</h3>
                      </div>
                      <div className="px-5 py-2 divide-y divide-slate-100 text-sm">
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Work Email</span><span className="font-semibold text-slate-900 text-right">{selectedStaff.workEmail}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Phone</span><span className="font-semibold text-slate-900">{selectedStaff.phone || 'Not set'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Gender</span><span className="font-semibold text-slate-900">{selectedStaff.gender || 'Not set'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Marital Status</span><span className="font-semibold text-slate-900">{selectedStaff.maritalStatus || 'Not set'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Education</span><span className="font-semibold text-slate-900">{(selectedStaff as any).highestEducation || 'Not set'}</span></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                      <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Address &amp; Origin</h3>
                      </div>
                      <div className="px-5 py-2 divide-y divide-slate-100 text-sm">
                        <div className="py-2.5 flex justify-between gap-4"><span className="text-slate-500 shrink-0">Address</span><span className="font-semibold text-slate-900 text-right">{selectedStaff.residentialAddress || 'Not set'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">City / State</span><span className="font-semibold text-slate-900 text-right">{selectedStaff.cityState || 'Not set'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">State of Origin</span><span className="font-semibold text-slate-900">{selectedStaff.stateOfOrigin || 'Not set'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">LGA</span><span className="font-semibold text-slate-900">{selectedStaff.lga || 'Not set'}</span></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                      <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                          <Phone className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Emergency &amp; Next of Kin</h3>
                      </div>
                      <div className="px-5 py-2 divide-y divide-slate-100 text-sm">
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Full Name</span><span className="font-semibold text-slate-900">{selectedStaff.nextOfKinName || '—'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Relationship</span><span className="font-semibold text-slate-900">{selectedStaff.nextOfKinRelationship || '—'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Phone</span><span className="font-semibold text-slate-900">{selectedStaff.nextOfKinPhone || '—'}</span></div>
                        <div className="py-2.5 flex justify-between gap-4"><span className="text-slate-500 shrink-0">Address</span><span className="font-semibold text-slate-900 text-right">{selectedStaff.nextOfKinAddress || '—'}</span></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                      <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Salary &amp; Verification Summary</h3>
                      </div>
                      <div className="px-5 py-2 divide-y divide-slate-100 text-sm">
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Bank Name</span><span className="font-semibold text-slate-900 text-right">{selectedStaff.salaryBankName || selectedStaff.bankName || '—'}</span></div>
                        <div className="py-2.5 flex justify-between gap-3"><span className="text-slate-500">Account No.</span><span className="font-semibold text-slate-900">{selectedStaff.salaryAccountNumber || selectedStaff.accountNumber || '—'}</span></div>
                        <div className="py-2.5 flex justify-between items-center gap-3">
                          <span className="text-slate-500">NIN Status</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${(selectedStaff as any).nin ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            {(selectedStaff as any).nin ? 'Verified on File' : 'Pending'}
                          </span>
                        </div>
                        <div className="py-2.5 flex justify-between items-center gap-3">
                          <span className="text-slate-500">BVN Status</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${(selectedStaff as any).bvn ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            {(selectedStaff as any).bvn ? 'Verified on File' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'Employment' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-400" /> Employment Agreement &amp; Placement
                    </h3>
                    {!editingCorporate && (
                      <button
                        type="button"
                        onClick={startEditCorporate}
                        className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: activeBrandColor }}
                      >
                        Edit Details
                      </button>
                    )}
                  </div>

                  {editingCorporate ? (
                    <form onSubmit={saveCorporatePlacement} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Job Title / Position</label>
                          <input
                            type="text"
                            value={corpForm.positionName}
                            onChange={(e) => setCorpForm((p) => ({ ...p, positionName: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Subsidiary</label>
                          <select
                            value={corpForm.subsidiaryId}
                            onChange={(e) => setCorpForm((p) => ({ ...p, subsidiaryId: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          >
                            <option value="">Select subsidiary...</option>
                            {subsidiaries.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Department</label>
                          <select
                            value={corpForm.departmentId}
                            onChange={(e) => setCorpForm((p) => ({ ...p, departmentId: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          >
                            <option value="">Select department...</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Employment Type</label>
                          <select
                            value={corpForm.employmentType}
                            onChange={(e) => setCorpForm((p) => ({ ...p, employmentType: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          >
                            <option value="FULL_TIME">FULL_TIME</option>
                            <option value="PART_TIME">PART_TIME</option>
                            <option value="CONTRACT">CONTRACT</option>
                            <option value="INTERN">INTERN</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Staff Grade / Level</label>
                          <input
                            type="text"
                            value={corpForm.staffGrade}
                            onChange={(e) => setCorpForm((p) => ({ ...p, staffGrade: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Work Location</label>
                          <input
                            type="text"
                            value={corpForm.workLocation}
                            onChange={(e) => setCorpForm((p) => ({ ...p, workLocation: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Resumption Date</label>
                          <input
                            type="date"
                            value={corpForm.resumptionDate}
                            onChange={(e) => setCorpForm((p) => ({ ...p, resumptionDate: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingCorporate(false)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={corporateSaving}
                          className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: activeBrandColor }}
                        >
                          {corporateSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Employment Type</div>
                        <div className="font-bold text-slate-900 mt-0.5">{selectedStaff.employmentType || 'FULL_TIME'}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Staff Grade / Level</div>
                        <div className="font-bold text-slate-900 mt-0.5">{selectedStaff.staffGrade || 'Standard'}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Subsidiary</div>
                        <div className="font-bold text-slate-900 mt-0.5">{selectedStaff.primaryAssignment?.subsidiary?.legalName || 'BEMS Group'}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Department</div>
                        <div className="font-bold text-slate-900 mt-0.5">{selectedStaff.primaryAssignment?.department?.name || 'General'}</div>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    {selectedStaff.approvalStatus === 'PENDING_APPROVAL' && (
                      <button
                        type="button"
                        onClick={() => handleAction(selectedStaff.id, 'APPROVE_ONBOARDING')}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Approve Onboarding
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === selectedStaff.id}
                      onClick={() =>
                        toggleAttendanceExemption(
                          selectedStaff.id,
                          !Boolean((selectedStaff as any).isAttendanceExempt),
                          selectedStaff.legalName
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {(selectedStaff as any).isAttendanceExempt ? 'Require Daily Attendance' : 'Exempt from Daily Attendance'}
                    </button>
                    {selectedStaff.status !== 'SUSPENDED' ? (
                      <button
                        type="button"
                        onClick={() => handleAction(selectedStaff.id, 'UPDATE_STATUS', { newStatus: 'SUSPENDED' })}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Suspend Employee
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(selectedStaff.id, 'UPDATE_STATUS', { newStatus: 'ACTIVE' })}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Reactivate Employee
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeProfileTab === 'Attendance' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-emerald-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">On Time / Present</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.attendanceRecords.filter((a) => a.status === 'PRESENT').length || 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-amber-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Late Arrivals</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.attendanceRecords.filter((a) => a.status === 'LATE').length || 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-blue-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Excused / Off</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.attendanceRecords.filter((a) => a.status === 'EXCUSED' || a.status === 'OFF_DAY').length || 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2" style={{ borderTopColor: activeBrandColor }}>
                      <div className="text-[11px] font-bold uppercase text-slate-400">Policy Mode</div>
                      <div className="mt-1 text-sm font-extrabold text-slate-900">
                        {(selectedStaff as any).isAttendanceExempt ? 'Attendance Exempt' : 'Standard Shift'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor }}>
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Recent Attendance Ledger</h3>
                      </div>
                      <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {dossier?.attendanceRecords.length || 0} punches
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-2.5">Date</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5">Check In</th>
                            <th className="px-4 py-2.5">Check Out</th>
                            <th className="px-4 py-2.5">Station</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {!dossier || dossier.attendanceRecords.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-10 text-center">
                                <Clock className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                                <div className="text-xs font-semibold text-slate-700">No attendance logs recorded yet</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {(selectedStaff as any).isAttendanceExempt
                                    ? 'This employee is currently exempt from daily attendance signing.'
                                    : 'Daily kiosk or mobile app punches will appear here automatically.'}
                                </div>
                              </td>
                            </tr>
                          ) : (
                            dossier.attendanceRecords.map((a) => (
                              <tr key={a.id} className="hover:bg-slate-50/70">
                                <td className="px-4 py-2.5 font-semibold text-slate-900">{a.workDate}</td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`rounded-full border px-2 py-0.5 font-semibold ${
                                      a.status === 'PRESENT'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : a.status === 'LATE'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {a.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600">{a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString() : '—'}</td>
                                <td className="px-4 py-2.5 text-slate-600">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '—'}</td>
                                <td className="px-4 py-2.5 text-slate-600">{a.station?.name || 'Office'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'Payroll' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2" style={{ borderTopColor: activeBrandColor }}>
                      <div className="text-[11px] font-bold uppercase text-slate-400">Monthly Gross</div>
                      <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatNairaMinor(selectedStaff.currentGrossMinor)}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Active compensation agreement</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-emerald-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Salary Bank</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{selectedStaff.salaryBankName || selectedStaff.bankName || 'Not set'}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{selectedStaff.salaryAccountName || selectedStaff.accountName || 'Account holder'}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-blue-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Account Number</div>
                      <div className="mt-1 text-lg font-extrabold text-slate-900 tracking-wide">{selectedStaff.salaryAccountNumber || selectedStaff.accountNumber || '—'}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Disbursement destination</div>
                    </div>
                  </div>

                  {/* Finance-Parity Salary Edit & Payroll Exemption Form */}
                  <form id="staff-salary-form" onSubmit={handleSalaryChange} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor }}>
                          <Wallet className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Salary Edit &amp; Compensation Adjustment</h3>
                      </div>
                      <span className="text-xs text-slate-500">Syncs with BEMS Payroll Engine</span>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Adjustment Type</label>
                          <select
                            value={salaryType}
                            onChange={(e) => setSalaryType(e.target.value as any)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          >
                            <option value="SET_EXACT">Set Exact Monthly Gross</option>
                            <option value="ADDITION">Salary Addition / Raise</option>
                            <option value="DEDUCTION">Salary Reduction</option>
                            <option value="REMOVE_FROM_PAYROLL">Exempt from Payroll (₦0)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₦)</label>
                          <input
                            type="number"
                            min={0}
                            disabled={salaryType === 'REMOVE_FROM_PAYROLL'}
                            required={salaryType !== 'REMOVE_FROM_PAYROLL'}
                            value={salaryType === 'REMOVE_FROM_PAYROLL' ? '0' : salaryAmount}
                            onChange={(e) => setSalaryAmount(e.target.value)}
                            placeholder="e.g. 150000"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Audit Note</label>
                          <input
                            type="text"
                            value={salaryReason}
                            onChange={(e) => setSalaryReason(e.target.value)}
                            placeholder="e.g. Annual review or confirmation"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={salarySaving}
                          className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: activeBrandColor }}
                        >
                          {salarySaving ? 'Updating Salary...' : 'Apply Salary Update'}
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
                      Payslip &amp; Batch History
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2.5">Period</th>
                          <th className="px-4 py-2.5">Gross</th>
                          <th className="px-4 py-2.5">Deductions</th>
                          <th className="px-4 py-2.5">Net Pay</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {!dossier || dossier.payrollItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center">
                              <Wallet className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                              <div className="text-xs font-semibold text-slate-700">No payroll runs recorded yet</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Monthly payslips will appear here once a batch is generated.</div>
                            </td>
                          </tr>
                        ) : (
                          dossier.payrollItems.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-2.5 font-semibold text-slate-900">{p.batch?.period ? `${p.batch.period.year}-${String(p.batch.period.month).padStart(2, '0')}` : 'Cycle'}</td>
                              <td className="px-4 py-2.5">{formatNairaMinor(p.grossMinor)}</td>
                              <td className="px-4 py-2.5 text-rose-600">{formatNairaMinor(p.employeeDeductionsMinor)}</td>
                              <td className="px-4 py-2.5 font-bold text-emerald-700">{formatNairaMinor(p.netMinor)}</td>
                              <td className="px-4 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{p.status}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeProfileTab === 'Leave' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-emerald-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Approved</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.leaveRequests.filter((l) => l.status === 'APPROVED').length || 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-amber-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Pending</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.leaveRequests.filter((l) => l.status === 'PENDING').length || 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-rose-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Rejected</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.leaveRequests.filter((l) => l.status === 'REJECTED').length || 0}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Calendar className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Leave History</h3>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Dates</th>
                          <th className="px-4 py-2.5">Reason</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {!dossier || dossier.leaveRequests.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center">
                              <Calendar className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                              <div className="text-xs font-semibold text-slate-700">No leave requests on file</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Annual, sick, and casual leave requests appear here.</div>
                            </td>
                          </tr>
                        ) : (
                          dossier.leaveRequests.map((l) => (
                            <tr key={l.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-2.5 font-semibold text-slate-900">{l.leaveType}</td>
                              <td className="px-4 py-2.5">{l.startDate} → {l.endDate}</td>
                              <td className="px-4 py-2.5 text-slate-600">{l.reason}</td>
                              <td className="px-4 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{l.status}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeProfileTab === 'Performance' && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Award className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Appraisals &amp; Performance Improvement Plans</h3>
                  </div>
                  <div className="p-5">
                    {!dossier || (dossier.evaluations.length === 0 && dossier.pips.length === 0) ? (
                      <div className="py-8 text-center">
                        <Award className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                        <div className="text-xs font-semibold text-slate-700">No performance appraisals or PIPs recorded yet</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">KPI scores and quarterly review cycles will appear here.</div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dossier.evaluations.map((e) => (
                          <div key={e.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-slate-900">{e.cycle?.title || 'Review Cycle'}</div>
                              <div className="text-slate-500 mt-0.5">{e.managerComments || 'Evaluation logged'}</div>
                            </div>
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 font-bold text-slate-900">{e.overallScore ?? '—'}% · {e.status}</span>
                          </div>
                        ))}
                        {dossier.pips.map((pip) => (
                          <div key={pip.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs">
                            <div className="font-bold text-amber-900">PIP: {pip.title}</div>
                            <div className="text-amber-800 mt-0.5">{pip.status}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeProfileTab === 'Documents' && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Employee Documents &amp; Contracts</h3>
                  </div>
                  <div className="p-5">
                    {!dossier || dossier.documents.length === 0 ? (
                      <div className="py-8 text-center">
                        <FileText className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                        <div className="text-xs font-semibold text-slate-700">No contracts or HR letters issued yet</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Offer letters, NDAs, and signed HR documents appear here.</div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dossier.documents.map((d) => (
                          <div key={d.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-slate-900">{d.title}</div>
                              <div className="text-slate-500 mt-0.5">{d.category}</div>
                            </div>
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 font-semibold text-slate-700">{d.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeProfileTab === 'Requests' && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Mail className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">HR Requests &amp; Profile Updates</h3>
                  </div>
                  <div className="p-5">
                    {!dossier || (dossier.requests.length === 0 && dossier.profileUpdates.length === 0) ? (
                      <div className="py-8 text-center">
                        <Mail className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                        <div className="text-xs font-semibold text-slate-700">No HR request tickets on file</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Profile edits, letters, and support requests appear here.</div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dossier.requests.map((r) => (
                          <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-slate-900">{r.subject}</div>
                              <div className="text-slate-500 mt-0.5">{r.category} · {r.priority}</div>
                            </div>
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 font-semibold">{r.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeProfileTab === 'Discipline' && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Disciplinary &amp; Grievance Cases</h3>
                  </div>
                  <div className="p-5">
                    {!dossier || (dossier.disciplinaryCases.length === 0 && dossier.grievances.length === 0) ? (
                      <div className="py-8 text-center">
                        <ShieldCheck className="h-7 w-7 text-emerald-400 mx-auto mb-2" />
                        <div className="text-xs font-semibold text-slate-700">Clean Disciplinary Record</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">No disciplinary queries, warnings, or grievances on file.</div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dossier.disciplinaryCases.map((c) => (
                          <div key={c.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs">
                            <div className="font-bold text-rose-900">{c.title} ({c.severity})</div>
                            <div className="text-rose-700 mt-0.5">{c.status}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeProfileTab === 'Activity Log' && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor }}>
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Chronological Activity Timeline</h3>
                  </div>
                  <div className="p-5">
                    {activityTimeline.length === 0 ? (
                      <div className="py-8 text-center">
                        <Activity className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                        <div className="text-xs font-semibold text-slate-700">No recent HR activity events</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Attendance, leave, request, and document events appear here chronologically.</div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {activityTimeline.map((ev, i) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-slate-900">{ev.title}</div>
                              <div className="text-slate-500 mt-0.5">{ev.detail}</div>
                            </div>
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-slate-500 font-medium">{new Date(ev.date).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeProfileTab === 'Benefits' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-emerald-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Employer Pension</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.statutoryPolicy?.pensionEmployerRate ?? 10}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-blue-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Employee Pension</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.statutoryPolicy?.pensionEmployeeRate ?? 8}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2 border-t-amber-500">
                      <div className="text-[11px] font-bold uppercase text-slate-400">NHF Statutory</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {dossier?.statutoryPolicy?.nhfRate ?? 2.5}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs border-t-2" style={{ borderTopColor: activeBrandColor }}>
                      <div className="text-[11px] font-bold uppercase text-slate-400">Loans &amp; Advances</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">{dossier?.loans.length || 0}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 flex items-center justify-between">
                    <span>Statutory rates are synced from <strong>HR → Configuration → Statutory &amp; Payroll Rules</strong>.</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(null)}
                      className="font-semibold hover:underline"
                      style={{ color: activeBrandColor }}
                    >
                      Close to Edit in Configuration
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <HeartHandshake className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Training Certifications &amp; Welfare</h3>
                    </div>
                    <div className="p-5">
                      {!dossier || dossier.trainings.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500">No training courses assigned to this employee yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {dossier.trainings.map((t) => (
                            <div key={t.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-900">{t.course?.title || 'Course'}</span>
                              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 font-semibold">{t.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'Assets' && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                      <Laptop className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Assigned Workstations &amp; Access</h3>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-slate-500">Primary Work Location</div>
                      <div className="font-bold text-slate-900 text-sm mt-1">{selectedStaff.workLocation || 'Standard Office'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-slate-500">BEMS Staff App Provisioning</div>
                      <div className="font-bold text-emerald-700 text-sm mt-1">
                        {selectedStaff.isOfflineStaff ? 'Offline Kiosk Mode' : 'Mobile & Web Portal Active'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-slate-500">Attendance Requirement</div>
                      <div className="font-bold text-slate-900 text-sm mt-1">
                        {(selectedStaff as any).isAttendanceExempt ? 'Exempt from Daily Signing' : 'Required (GPS + Starlink)'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-slate-500">Onboarding Clearance</div>
                      <div className="font-bold text-slate-900 text-sm mt-1">{selectedStaff.approvalStatus}</div>
                    </div>
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
