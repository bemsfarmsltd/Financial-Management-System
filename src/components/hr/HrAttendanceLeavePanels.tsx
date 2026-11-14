'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { HrAttendanceRecord, HrLeaveRecord } from './hrTypes';

interface HrAttendancePanelProps {
  todayStr: string;
  initialStatusFilter?: string;
  onRefreshOverview: () => void;
}

export function HrAttendancePanel({
  todayStr,
  initialStatusFilter = 'ALL',
  onRefreshOverview,
}: HrAttendancePanelProps) {
  const [records, setRecords] = useState<HrAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/hr/attendance?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecords(data.records || []);
      } else {
        setBanner({ type: 'err', text: data.error || 'Failed to load attendance.' });
      }
    } catch {
      setBanner({ type: 'err', text: 'Network error loading attendance.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, statusFilter]);

  const handleOverride = async (
    attendanceRecordId: string,
    newStatus: 'PRESENT' | 'EXCUSED' | 'LATE' | 'ABSENT'
  ) => {
    setBusyId(attendanceRecordId);
    setBanner(null);
    try {
      const res = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MANUAL_OVERRIDE',
          attendanceRecordId,
          newStatus,
          reason: `HR Desk adjustment to ${newStatus}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'err', text: data.error || 'Failed to update attendance.' });
      } else {
        setBanner({ type: 'ok', text: `Attendance updated to ${newStatus}.` });
        await loadRecords();
        onRefreshOverview();
      }
    } catch {
      setBanner({ type: 'err', text: 'Network error updating attendance.' });
    } finally {
      setBusyId(null);
    }
  };

  const statusPill = (status: string) => {
    if (status === 'PRESENT') return { bg: '#ecfdf5', color: '#059669' };
    if (status === 'LATE') return { bg: '#fffbeb', color: '#d97706' };
    if (status === 'EXCUSED') return { bg: '#eff6ff', color: '#2563eb' };
    return { bg: '#fef2f2', color: '#dc2626' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
            Work Date:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              color: '#0f172a',
              background: '#ffffff',
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              color: '#0f172a',
              background: '#ffffff',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="EXCUSED">Excused</option>
            <option value="ABSENT">Absent</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadRecords}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: '#ea580c',
            color: '#ffffff',
            border: 'none',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Refresh Register
        </button>
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

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
            Attendance Register — {selectedDate} ({records.length} records)
          </strong>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Starlink Wi-Fi · GPS Geofence · Manual Audit Preserved
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Loading attendance records...
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No attendance check-ins recorded for {selectedDate} matching this filter.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Employee</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Clock In / Out</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Station &amp; Telemetry</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>HR Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const pill = statusPill(rec.status);
                  return (
                    <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{rec.employeeName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {rec.employeeNumber} · {rec.department}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: '#0f172a' }}>
                          <Clock size={12} color="#64748b" />
                          {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          {' → '}
                          {rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} color="#ea580c" /> {rec.stationName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {rec.checkInDistanceM != null ? `${Math.round(rec.checkInDistanceM)}m` : '—'} · {rec.clientIp || 'Wi-Fi'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '999px',
                            background: pill.bg,
                            color: pill.color,
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {rec.status}
                        </span>
                        {rec.isManualOverride && (
                          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                            Manual override
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {rec.status !== 'PRESENT' && (
                            <button
                              type="button"
                              disabled={busyId === rec.id}
                              onClick={() => handleOverride(rec.id, 'PRESENT')}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                background: '#ecfdf5',
                                color: '#059669',
                                border: '1px solid #a7f3d0',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Mark Present
                            </button>
                          )}
                          {rec.status !== 'EXCUSED' && (
                            <button
                              type="button"
                              disabled={busyId === rec.id}
                              onClick={() => handleOverride(rec.id, 'EXCUSED')}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                background: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Excuse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface HrLeavePanelProps {
  initialStatusFilter?: string;
  onRefreshOverview: () => void;
}

export function HrLeavePanel({
  initialStatusFilter = 'ALL',
  onRefreshOverview,
}: HrLeavePanelProps) {
  const [leaves, setLeaves] = useState<HrLeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await fetch(`/api/hr/leave?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) {
        setLeaves(data.leaves || []);
      } else {
        setBanner({ type: 'err', text: data.error || 'Failed to fetch leave requests.' });
      }
    } catch {
      setBanner({ type: 'err', text: 'Network error fetching leave requests.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleLeaveDecision = async (leaveId: string, action: 'APPROVE' | 'REJECT') => {
    setBusyId(leaveId);
    setBanner(null);
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          leaveRequestId: leaveId,
          reviewNote: action === 'APPROVE' ? 'Approved via HR Workspace' : 'Declined via HR Workspace',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'err', text: data.error || 'Failed to process leave decision.' });
      } else {
        setBanner({ type: 'ok', text: `Leave request ${action.toLowerCase()}d.` });
        await loadLeaves();
        onRefreshOverview();
      }
    } catch {
      setBanner({ type: 'err', text: 'Network error updating leave.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => {
          const active = statusFilter === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '8px 14px',
                borderRadius: '999px',
                border: active ? '1px solid #ea580c' : '1px solid #e2e8f0',
                background: active ? '#ea580c' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {st === 'ALL' ? 'All Requests' : st}
            </button>
          );
        })}
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

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
            Leave Requests ({leaves.length})
          </strong>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Annual · Sick · Maternity/Paternity · Compassionate · Study · Emergency
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Loading leave requests...
          </div>
        ) : leaves.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No leave requests found for this status.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Employee</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Type &amp; Dates</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Reason / Handover</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '11px 16px', color: '#475569', fontWeight: 700 }}>Decision</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((lv) => {
                  const isPending = lv.status === 'PENDING';
                  return (
                    <tr key={lv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{lv.employeeName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {lv.subsidiary} · {lv.department}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{lv.leaveType}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {lv.startDate} → {lv.endDate}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: '280px', color: '#334155', fontSize: '12px' }}>
                        <div>{lv.reason || '—'}</div>
                        {lv.handoverNotes && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                            Handover: {lv.handoverNotes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background:
                              lv.status === 'APPROVED'
                                ? '#ecfdf5'
                                : lv.status === 'REJECTED'
                                ? '#fef2f2'
                                : '#fff7ed',
                            color:
                              lv.status === 'APPROVED'
                                ? '#059669'
                                : lv.status === 'REJECTED'
                                ? '#dc2626'
                                : '#ea580c',
                          }}
                        >
                          {lv.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isPending ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              disabled={busyId === lv.id}
                              onClick={() => handleLeaveDecision(lv.id, 'APPROVE')}
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
                              <CheckCircle2 size={12} /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === lv.id}
                              onClick={() => handleLeaveDecision(lv.id, 'REJECT')}
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
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {lv.reviewedByName ? `By ${lv.reviewedByName}` : 'Reviewed'}
                          </span>
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
    </div>
  );
}
