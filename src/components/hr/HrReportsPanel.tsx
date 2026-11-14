'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  Wallet,
  ShieldAlert,
  Search,
  Download,
  RefreshCw,
  FileBarChart2,
  CalendarCheck,
  GraduationCap,
} from 'lucide-react';

interface HrReportsPanelProps {
  selectedSubsidiaryId: string;
  activeBrandColor: string;
}

interface ReportSummary {
  totalStaff: number;
  activeStaff: number;
  pendingOnboarding: number;
  evaluationCount: number;
  disciplinaryCount: number;
  requestCount: number;
}

interface DirectoryRow {
  id: string;
  fullName: string;
  staffCode?: string | null;
  department?: string | null;
  designation?: string | null;
  employmentType?: string | null;
  status?: string | null;
  onboardingStatus?: string | null;
  grossSalary?: number | null;
  subsidiary?: { name: string } | null;
}

interface StatusCount {
  status: string;
  _count?: { _all?: number };
  count?: number;
}

interface PayrollBatchRow {
  id: string;
  cycleName?: string | null;
  month?: number | null;
  year?: number | null;
  status?: string | null;
  totalNet?: number | null;
  totalGross?: number | null;
  headcount?: number | null;
  createdAt: string;
}

export default function HrReportsPanel({
  selectedSubsidiaryId,
  activeBrandColor,
}: HrReportsPanelProps) {
  const [subTab, setSubTab] = useState<'summary' | 'directory' | 'attendance' | 'payroll' | 'training'>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [summary, setSummary] = useState<ReportSummary>({
    totalStaff: 0,
    activeStaff: 0,
    pendingOnboarding: 0,
    evaluationCount: 0,
    disciplinaryCount: 0,
    requestCount: 0,
  });
  const [staffDirectory, setStaffDirectory] = useState<DirectoryRow[]>([]);
  const [attendanceByStatus, setAttendanceByStatus] = useState<StatusCount[]>([]);
  const [leaveSummary, setLeaveSummary] = useState<StatusCount[]>([]);
  const [payrollBatches, setPayrollBatches] = useState<PayrollBatchRow[]>([]);
  const [trainingSummary, setTrainingSummary] = useState<StatusCount[]>([]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/reports${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load HR reports');
      setSummary(data.summary || {
        totalStaff: 0,
        activeStaff: 0,
        pendingOnboarding: 0,
        evaluationCount: 0,
        disciplinaryCount: 0,
        requestCount: 0,
      });
      setStaffDirectory(Array.isArray(data.staffDirectory) ? data.staffDirectory : []);
      setAttendanceByStatus(Array.isArray(data.attendanceByStatus) ? data.attendanceByStatus : []);
      setLeaveSummary(Array.isArray(data.leaveSummary) ? data.leaveSummary : []);
      setPayrollBatches(Array.isArray(data.payrollBatches) ? data.payrollBatches : []);
      setTrainingSummary(Array.isArray(data.trainingSummary) ? data.trainingSummary : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }, [selectedSubsidiaryId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredDirectory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffDirectory.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        (s.staffCode || '').toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q) ||
        (s.subsidiary?.name || '').toLowerCase().includes(q)
      );
    });
  }, [staffDirectory, searchQuery, statusFilter]);

  const totalPayrollDisbursed = useMemo(() => {
    return payrollBatches.reduce((acc, b) => acc + Number(b.totalNet || 0), 0);
  }, [payrollBatches]);

  const getCount = (item: StatusCount) => Number(item._count?._all ?? item.count ?? 0);

  const exportCsv = () => {
    let rows: string[][] = [];
    let filename = 'hr_executive_report.csv';
    if (subTab === 'directory') {
      filename = 'hr_staff_directory.csv';
      rows = [
        ['Staff Code', 'Full Name', 'Subsidiary', 'Department', 'Designation', 'Type', 'Status', 'Gross Salary'],
        ...filteredDirectory.map((s) => [
          s.staffCode || '',
          s.fullName,
          s.subsidiary?.name || '',
          s.department || '',
          s.designation || '',
          s.employmentType || '',
          s.status || '',
          String(s.grossSalary || 0),
        ]),
      ];
    } else if (subTab === 'payroll') {
      filename = 'hr_payroll_batches.csv';
      rows = [
        ['Cycle', 'Status', 'Headcount', 'Total Gross', 'Total Net', 'Created'],
        ...payrollBatches.map((b) => [
          b.cycleName || `${b.year}-${b.month}`,
          b.status || '',
          String(b.headcount || 0),
          String(b.totalGross || 0),
          String(b.totalNet || 0),
          new Date(b.createdAt).toLocaleDateString(),
        ]),
      ];
    } else {
      rows = [
        ['Metric', 'Value'],
        ['Total Staff', String(summary.totalStaff)],
        ['Active Staff', String(summary.activeStaff)],
        ['Pending Onboarding', String(summary.pendingOnboarding)],
        ['Evaluations', String(summary.evaluationCount)],
        ['Disciplinary Cases', String(summary.disciplinaryCount)],
        ['HR Requests', String(summary.requestCount)],
      ];
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* 5 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Staff</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{summary.totalStaff}</div>
          <p className="mt-1 text-xs text-slate-500">Registered workforce</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Roster</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{summary.activeStaff}</div>
          <p className="mt-1 text-xs text-slate-500">Approved & operational</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Onboarding</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{summary.pendingOnboarding}</div>
          <p className="mt-1 text-xs text-slate-500">Awaiting HR sign-off</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payroll Disbursed</span>
            <Wallet className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">₦{totalPayrollDisbursed.toLocaleString()}</div>
          <p className="mt-1 text-xs text-slate-500">{payrollBatches.length} recent batches</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Governance Cases</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {summary.disciplinaryCount + summary.requestCount}
          </div>
          <p className="mt-1 text-xs text-slate-500">{summary.evaluationCount} performance reviews</p>
        </div>
      </div>

      {/* Underline Report-Category Sub-Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-3">
        <div className="flex items-center gap-6 overflow-x-auto">
          {[
            { id: 'summary', label: 'Executive Summary' },
            { id: 'directory', label: 'Staff Directory Register' },
            { id: 'attendance', label: 'Attendance & Leave' },
            { id: 'payroll', label: 'Payroll Batches' },
            { id: 'training', label: 'Training Compliance' },
          ].map((t) => {
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id as typeof subTab)}
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

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
          {subTab === 'directory' && (
            <>
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff, code, or department..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </>
          )}
          {subTab !== 'directory' && (
            <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <FileBarChart2 className="h-4 w-4 text-slate-400" />
              Live cross-module HR audit telemetry synced from Prisma register
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={fetchReports}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* View Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Compiling enterprise HR analytics...
        </div>
      ) : subTab === 'summary' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <CalendarCheck className="h-4 w-4 text-slate-500" /> Attendance Distribution
            </h3>
            <div className="space-y-3">
              {attendanceByStatus.length === 0 ? (
                <p className="text-xs text-slate-500">No attendance telemetry recorded yet.</p>
              ) : (
                attendanceByStatus.map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{row.status}</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-900">
                      {getCount(row)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-slate-500" /> Leave Request Breakdown
            </h3>
            <div className="space-y-3">
              {leaveSummary.length === 0 ? (
                <p className="text-xs text-slate-500">No leave requests recorded yet.</p>
              ) : (
                leaveSummary.map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{row.status}</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-900">
                      {getCount(row)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <GraduationCap className="h-4 w-4 text-slate-500" /> Training Compliance
            </h3>
            <div className="space-y-3">
              {trainingSummary.length === 0 ? (
                <p className="text-xs text-slate-500">No training assignments recorded yet.</p>
              ) : (
                trainingSummary.map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{row.status}</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-900">
                      {getCount(row)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : subTab === 'directory' ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Subsidiary & Dept</th>
                  <th className="px-4 py-3">Role / Type</th>
                  <th className="px-4 py-3">Gross Pay</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDirectory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No staff records match your search.
                    </td>
                  </tr>
                ) : (
                  filteredDirectory.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{s.fullName}</div>
                        <div className="text-xs text-slate-500">{s.staffCode || 'UNASSIGNED'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{s.subsidiary?.name || 'BEMS Group'}</div>
                        <div className="text-xs text-slate-500">{s.department || 'General'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{s.designation || 'Staff'}</div>
                        <div className="text-xs text-slate-500">{s.employmentType || 'FULL_TIME'}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        ₦{Number(s.grossSalary || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {s.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : subTab === 'attendance' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">Attendance Status Breakdown</h3>
            <div className="space-y-3">
              {attendanceByStatus.map((row) => (
                <div key={row.status} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">{row.status}</span>
                  <span className="text-base font-bold text-slate-900">{getCount(row)}</span>
                </div>
              ))}
              {attendanceByStatus.length === 0 && <p className="text-xs text-slate-500">No attendance logs found.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">Leave Governance Breakdown</h3>
            <div className="space-y-3">
              {leaveSummary.map((row) => (
                <div key={row.status} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">{row.status}</span>
                  <span className="text-base font-bold text-slate-900">{getCount(row)}</span>
                </div>
              ))}
              {leaveSummary.length === 0 && <p className="text-xs text-slate-500">No leave requests found.</p>}
            </div>
          </div>
        </div>
      ) : subTab === 'payroll' ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Payroll Cycle</th>
                  <th className="px-4 py-3">Headcount</th>
                  <th className="px-4 py-3">Gross Total</th>
                  <th className="px-4 py-3">Net Disbursement</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollBatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No payroll batches recorded yet.
                    </td>
                  </tr>
                ) : (
                  payrollBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {b.cycleName || `${b.year}-${String(b.month || 1).padStart(2, '0')}`}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{b.headcount || 0} staff</td>
                      <td className="px-4 py-3 text-slate-700">₦{Number(b.totalGross || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">₦{Number(b.totalNet || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          {b.status || 'DRAFT'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4">Training Compliance Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {trainingSummary.map((row) => (
              <div key={row.status} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">{row.status}</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{getCount(row)}</div>
              </div>
            ))}
            {trainingSummary.length === 0 && (
              <p className="text-xs text-slate-500 col-span-full">No training assignments recorded yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
