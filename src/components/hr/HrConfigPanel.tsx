'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Percent,
  Clock,
  CalendarDays,
  ShieldCheck,
  Save,
  RefreshCw,
  CheckCircle2,
  X,
  UserCheck,
  Sliders,
} from 'lucide-react';

interface HrConfigPanelProps {
  selectedSubsidiaryId: string;
  activeBrandColor: string;
}

interface HrPolicyConfig {
  pensionEmployerRate: number;
  pensionEmployeeRate: number;
  nhfRate: number;
  lateGraceMinutes: number;
  lateDeductionPercent: number;
  annualLeaveDays: number;
  sickLeaveDays: number;
  workStartTime: string;
  workEndTime: string;
  requireGpsAttendance: boolean;
  requireStarlinkWifi: boolean;
}

interface CapabilityGrant {
  id?: string;
  userId: string;
  canManagePayroll: boolean;
  canApproveLeave: boolean;
  canManageRelations: boolean;
  canManageRecruitment: boolean;
  canConfigurePolicies: boolean;
}

interface EmployeeOption {
  id: string;
  userId?: string | null;
  fullName: string;
  email?: string | null;
  staffCode?: string | null;
  role?: string | null;
}

const DEFAULT_POLICY: HrPolicyConfig = {
  pensionEmployerRate: 10,
  pensionEmployeeRate: 8,
  nhfRate: 2.5,
  lateGraceMinutes: 15,
  lateDeductionPercent: 5,
  annualLeaveDays: 20,
  sickLeaveDays: 10,
  workStartTime: '08:00',
  workEndTime: '17:00',
  requireGpsAttendance: true,
  requireStarlinkWifi: true,
};

export default function HrConfigPanel({
  selectedSubsidiaryId,
  activeBrandColor,
}: HrConfigPanelProps) {
  const [subTab, setSubTab] = useState<'statutory' | 'attendance' | 'capabilities'>('statutory');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [policy, setPolicy] = useState<HrPolicyConfig>(DEFAULT_POLICY);
  const [grants, setGrants] = useState<CapabilityGrant[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/config${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load HR configuration');
      if (data.policy) {
        setPolicy({ ...DEFAULT_POLICY, ...data.policy });
      }
      setGrants(Array.isArray(data.capabilityGrants) ? data.capabilityGrants : []);
      setEmployees(Array.isArray(data.employees) ? data.employees : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load configuration');
    } finally {
      setLoading(false);
    }
  }, [selectedSubsidiaryId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSavePolicy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_POLICY',
          subsidiaryId: selectedSubsidiaryId || undefined,
          policy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save policy');
      showNotice('HR policy configuration saved.');
      await fetchConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGrant = async (userId: string, field: keyof Omit<CapabilityGrant, 'id' | 'userId'>, value: boolean) => {
    const existing = grants.find((g) => g.userId === userId) || {
      userId,
      canManagePayroll: false,
      canApproveLeave: false,
      canManageRelations: false,
      canManageRecruitment: false,
      canConfigurePolicies: false,
    };
    const updated = { ...existing, [field]: value };
    setSaving(true);
    try {
      const res = await fetch('/api/hr/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_CAPABILITY_GRANT',
          subsidiaryId: selectedSubsidiaryId || undefined,
          grant: updated,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update capability grant');
      showNotice('HR capability permission updated.');
      await fetchConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const grantedAdminCount = useMemo(() => {
    return grants.filter(
      (g) =>
        g.canManagePayroll ||
        g.canApproveLeave ||
        g.canManageRelations ||
        g.canManageRecruitment ||
        g.canConfigurePolicies
    ).length;
  }, [grants]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {toast}
          </span>
          <button onClick={() => setToast(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pension Rate</span>
            <Percent className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {policy.pensionEmployerRate}% / {policy.pensionEmployeeRate}%
          </div>
          <p className="mt-1 text-xs text-slate-500">Employer / Employee split · NHF {policy.nhfRate}%</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grace Window</span>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{policy.lateGraceMinutes} mins</div>
          <p className="mt-1 text-xs text-slate-500">{policy.lateDeductionPercent}% late deduction rule</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Annual Leave Days</span>
            <CalendarDays className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{policy.annualLeaveDays} days</div>
          <p className="mt-1 text-xs text-slate-500">Plus {policy.sickLeaveDays} sick leave days</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Granted Admins</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{grantedAdminCount}</div>
          <p className="mt-1 text-xs text-slate-500">Strict 3-role RBAC capability matrix</p>
        </div>
      </div>

      {/* Underline Sub-Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6 overflow-x-auto">
            {[
              { id: 'statutory', label: 'Statutory & Payroll Rules' },
              { id: 'attendance', label: 'Attendance & Leave Policies' },
              { id: 'capabilities', label: 'Granular HR Capability Grants' },
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

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={fetchConfig}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
            </button>
            {subTab !== 'capabilities' && (
              <button
                onClick={() => handleSavePolicy()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                style={{ backgroundColor: activeBrandColor }}
              >
                <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading HR policies and capability grants...
        </div>
      ) : subTab === 'statutory' ? (
        <form onSubmit={handleSavePolicy} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-slate-500" />
              <h3 className="text-base font-bold text-slate-900">Nigerian Statutory Deductions</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employer Pension (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={policy.pensionEmployerRate}
                  onChange={(e) => setPolicy((p) => ({ ...p, pensionEmployerRate: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Pension (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={policy.pensionEmployeeRate}
                  onChange={(e) => setPolicy((p) => ({ ...p, pensionEmployeeRate: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NHF Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={policy.nhfRate}
                  onChange={(e) => setPolicy((p) => ({ ...p, nhfRate: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Applied automatically during monthly payroll batch calculations alongside PAYE tax brackets.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Disciplinary & Lateness Penalty</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Late Grace Window (Minutes)</label>
                <input
                  type="number"
                  value={policy.lateGraceMinutes}
                  onChange={(e) => setPolicy((p) => ({ ...p, lateGraceMinutes: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Late Salary Deduction (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={policy.lateDeductionPercent}
                  onChange={(e) => setPolicy((p) => ({ ...p, lateDeductionPercent: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Synced with the Attendance Desk & Payroll Deduction Adjustments register.
            </p>
          </div>
        </form>
      ) : subTab === 'attendance' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Shift & Leave Entitlements</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Start Time</label>
                <input
                  type="time"
                  value={policy.workStartTime}
                  onChange={(e) => setPolicy((p) => ({ ...p, workStartTime: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shift End Time</label>
                <input
                  type="time"
                  value={policy.workEndTime}
                  onChange={(e) => setPolicy((p) => ({ ...p, workEndTime: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Annual Leave Quota (Days)</label>
                <input
                  type="number"
                  value={policy.annualLeaveDays}
                  onChange={(e) => setPolicy((p) => ({ ...p, annualLeaveDays: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sick Leave Quota (Days)</label>
                <input
                  type="number"
                  value={policy.sickLeaveDays}
                  onChange={(e) => setPolicy((p) => ({ ...p, sickLeaveDays: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Biometric, GPS & Starlink Enforcement</h3>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-slate-900">Require GPS Geofence Verification</div>
                <div className="text-xs text-slate-500">Staff must clock in within the designated site radius</div>
              </div>
              <input
                type="checkbox"
                checked={policy.requireGpsAttendance}
                onChange={(e) => setPolicy((p) => ({ ...p, requireGpsAttendance: e.target.checked }))}
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-slate-900">Require Company Starlink Wi-Fi</div>
                <div className="text-xs text-slate-500">Enforce office network check during mobile clock-in</div>
              </div>
              <input
                type="checkbox"
                checked={policy.requireStarlinkWifi}
                onChange={(e) => setPolicy((p) => ({ ...p, requireStarlinkWifi: e.target.checked }))}
                className="h-4 w-4"
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-slate-500" /> Granular HR Capability Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Assign fine-grained HR operational capabilities under the strict 3-role architecture (SUPER_ADMIN, GMD, STAFF).
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Staff / Admin</th>
                  <th className="px-4 py-3 text-center">Payroll</th>
                  <th className="px-4 py-3 text-center">Leave</th>
                  <th className="px-4 py-3 text-center">Relations</th>
                  <th className="px-4 py-3 text-center">Recruitment</th>
                  <th className="px-4 py-3 text-center">Policies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No eligible staff user accounts found.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const uid = emp.userId || emp.id;
                    const grant = grants.find((g) => g.userId === uid);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{emp.fullName}</div>
                          <div className="text-xs text-slate-500">
                            {emp.staffCode || ''} {emp.role ? `· ${emp.role}` : ''}
                          </div>
                        </td>
                        {(
                          [
                            'canManagePayroll',
                            'canApproveLeave',
                            'canManageRelations',
                            'canManageRecruitment',
                            'canConfigurePolicies',
                          ] as const
                        ).map((field) => (
                          <td key={field} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={saving}
                              checked={Boolean(grant?.[field])}
                              onChange={(e) => handleToggleGrant(uid, field, e.target.checked)}
                              className="h-4 w-4 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
