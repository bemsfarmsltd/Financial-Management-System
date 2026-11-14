'use client';

import React, { useEffect, useState } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  X,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
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
  onRefreshOverview: () => void;
}

export default function HrEmployeesPanel({
  subsidiaries,
  selectedSubsidiaryId,
  initialApprovalFilter = 'ALL',
  onRefreshOverview,
}: HrEmployeesPanelProps) {
  const [staff, setStaff] = useState<HrStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState(initialApprovalFilter);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedStaff, setSelectedStaff] = useState<HrStaffMember | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>('Overview');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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

  const statusBadge = (status: string, approval: string) => {
    if (approval === 'PENDING_APPROVAL') {
      return { bg: '#fff7ed', color: '#ea580c', label: 'Pending Onboarding' };
    }
    if (status === 'ACTIVE') return { bg: '#ecfdf5', color: '#059669', label: 'Active' };
    if (status === 'SUSPENDED') return { bg: '#fef2f2', color: '#dc2626', label: 'Suspended' };
    return { bg: '#f1f5f9', color: '#475569', label: status };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filter Bar */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flex: '1 1 260px', maxWidth: '420px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={15}
              color="#94a3b8"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadStaff()}
              placeholder="Search name, staff ID, email, or role..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                borderRadius: '9px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
                background: '#f8fafc',
              }}
            />
          </div>
          <button
            type="button"
            onClick={loadStaff}
            style={{
              padding: '9px 14px',
              borderRadius: '9px',
              background: '#ea580c',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '9px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              background: '#ffffff',
              color: '#0f172a',
            }}
          >
            <option value="ALL">All Onboarding States</option>
            <option value="PENDING_APPROVAL">Pending Onboarding</option>
            <option value="APPROVED">Approved Staff</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '9px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              background: '#ffffff',
              color: '#0f172a',
            }}
          >
            <option value="ALL">All Employment Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
      </div>

      {banner && (
        <div
          style={{
            padding: '11px 14px',
            borderRadius: '10px',
            background: banner.type === 'ok' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${banner.type === 'ok' ? '#a7f3d0' : '#fecaca'}`,
            color: banner.type === 'ok' ? '#065f46' : '#991b1b',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {banner.text}
        </div>
      )}

      {/* Staff Table */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
            Employee Directory ({staff.length})
          </strong>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Click any employee to open their 12-tab HR dossier
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Loading employee records...
          </div>
        ) : staff.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No employees match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Employee</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Subsidiary &amp; Dept</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Role / Grade</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Gross Pay</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((emp) => {
                  const badge = statusBadge(emp.status, emp.approvalStatus);
                  const subName = emp.primaryAssignment?.subsidiary?.legalName || 'BEMS Group';
                  const deptName = emp.primaryAssignment?.department?.name || 'General';
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => {
                        setSelectedStaff(emp);
                        setActiveProfileTab('Overview');
                      }}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.legalName}
                              style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: '#fff7ed',
                                color: '#ea580c',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 800,
                                fontSize: '12px',
                              }}
                            >
                              {emp.legalName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{emp.legalName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {emp.employeeNumber} · {emp.workEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{subName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{deptName}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{emp.jobTitle || 'Staff'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {emp.employmentType || 'FULL_TIME'} {emp.staffGrade ? `· ${emp.staffGrade}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {formatNairaMinor(emp.currentGrossMinor)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '999px',
                            background: badge.bg,
                            color: badge.color,
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td
                        style={{ padding: '12px 16px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {emp.approvalStatus === 'PENDING_APPROVAL' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              disabled={busyId === emp.id}
                              onClick={() => handleAction(emp.id, 'APPROVE_ONBOARDING')}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '7px',
                                background: '#059669',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <UserCheck size={12} /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === emp.id}
                              onClick={() => handleAction(emp.id, 'REJECT_ONBOARDING', { rejectionReason: 'Declined by HR' })}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '7px',
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <UserX size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaff(emp);
                              setActiveProfileTab('Overview');
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '7px',
                              background: '#f8fafc',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            View Dossier
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 12-Tab Employee Profile Modal */}
      {selectedStaff && (
        <div
          onClick={() => setSelectedStaff(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 60,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              background: '#ffffff',
              height: '100%',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {selectedStaff.avatarUrl ? (
                  <img
                    src={selectedStaff.avatarUrl}
                    alt={selectedStaff.legalName}
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: '#fff7ed',
                      color: '#ea580c',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: '16px',
                    }}
                  >
                    {selectedStaff.legalName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    {selectedStaff.legalName}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    {selectedStaff.employeeNumber} · {selectedStaff.jobTitle || 'Staff'} ·{' '}
                    {selectedStaff.primaryAssignment?.department?.name || 'General'} · {selectedStaff.status}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                style={{
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <X size={16} color="#475569" />
              </button>
            </div>

            {/* 12 Profile Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PROFILE_TABS.map((tab) => {
                const active = activeProfileTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveProfileTab(tab)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: active ? '1px solid #ea580c' : '1px solid #e2e8f0',
                      background: active ? '#fff7ed' : '#f8fafc',
                      color: active ? '#ea580c' : '#334155',
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px',
                fontSize: '13px',
                color: '#334155',
                lineHeight: 1.6,
              }}
            >
              {activeProfileTab === 'Overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div><Mail size={13} /> <strong>Email:</strong> {selectedStaff.workEmail}</div>
                  <div><Phone size={13} /> <strong>Phone:</strong> {selectedStaff.phone || 'Not set'}</div>
                  <div><Building2 size={13} /> <strong>Subsidiary:</strong> {selectedStaff.primaryAssignment?.subsidiary?.legalName || 'BEMS Group'}</div>
                  <div><ShieldCheck size={13} /> <strong>Work Location:</strong> {selectedStaff.workLocation || 'Office'}</div>
                  <div><strong>Next of Kin:</strong> {selectedStaff.nextOfKinName || '—'} ({selectedStaff.nextOfKinRelationship || '—'})</div>
                  <div><strong>NOK Phone:</strong> {selectedStaff.nextOfKinPhone || '—'}</div>
                </div>
              )}

              {activeProfileTab === 'Employment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div><strong>Employment Type:</strong> {selectedStaff.employmentType || 'FULL_TIME'}</div>
                  <div><strong>Grade / Level:</strong> {selectedStaff.staffGrade || 'Standard'}</div>
                  <div><strong>Resumption Date:</strong> {selectedStaff.resumptionDate ? new Date(selectedStaff.resumptionDate).toLocaleDateString() : '—'}</div>
                  <div><strong>City / State:</strong> {selectedStaff.cityState || '—'} · <strong>Origin:</strong> {selectedStaff.stateOfOrigin || '—'}</div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedStaff.status !== 'SUSPENDED' ? (
                      <button
                        type="button"
                        onClick={() => handleAction(selectedStaff.id, 'UPDATE_STATUS', { newStatus: 'SUSPENDED' })}
                        style={{ padding: '7px 12px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                      >
                        Suspend Employee
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(selectedStaff.id, 'UPDATE_STATUS', { newStatus: 'ACTIVE' })}
                        style={{ padding: '7px 12px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                      >
                        Reactivate Employee
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeProfileTab === 'Attendance' && (
                <div>
                  <strong>Recorded Attendance Punches:</strong> {selectedStaff.totalAttendancePunches ?? 0} total check-ins recorded in BEMS Attendance Ledger.
                </div>
              )}

              {activeProfileTab === 'Payroll' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div><strong>Current Monthly Gross:</strong> {formatNairaMinor(selectedStaff.currentGrossMinor)}</div>
                  <div><strong>Salary Bank:</strong> {selectedStaff.salaryBankName || selectedStaff.bankName || '—'}</div>
                  <div><strong>Account Number:</strong> {selectedStaff.salaryAccountNumber || selectedStaff.accountNumber || '—'}</div>
                  <div><strong>Account Name:</strong> {selectedStaff.salaryAccountName || selectedStaff.accountName || '—'}</div>
                </div>
              )}

              {activeProfileTab === 'Leave' && (
                <div>
                  <strong>Total Leave Requests Logged:</strong> {selectedStaff.totalLeaves ?? 0} requests on file.
                </div>
              )}

              {!['Overview', 'Employment', 'Attendance', 'Payroll', 'Leave'].includes(activeProfileTab) && (
                <div>
                  <strong>{activeProfileTab}</strong> tab is scaffolded in the 12-tab Employee Dossier and will connect to its dedicated ledger in Phases 2–4 (<em>Documents, Requests, Performance, Discipline, Activity Log, Benefits, Assets</em>).
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
