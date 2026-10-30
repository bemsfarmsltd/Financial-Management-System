'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  UserX,
  Calendar,
  Settings,
  ShieldCheck,
  Search,
  Filter,
  MapPin,
  QrCode,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Edit3,
  Save,
  Check,
  X,
  RefreshCw,
  Wifi,
  Zap,
  Globe,
} from 'lucide-react';

interface AttendanceRow {
  employeeId: string;
  legalName: string;
  employeeNumber: string;
  role: string;
  workLocation: string;
  organizationName: string;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'OFF_DAY' | 'ABSENT' | 'EXCUSED';
  checkInTime?: string;
  checkOutTime?: string;
  distanceMeters?: number;
  stationName?: string;
  isManualOverride: boolean;
  overrideReason?: string;
  deductionPercent: number;
  recordId?: string;
}

interface AttendancePolicy {
  earliestCheckInTime: string;
  resumptionTime: string;
  closingTime: string;
  gracePeriodMinutes: number;
  latenessDeductionPercent: number;
  absenceDeductionPercent: number;
  requireGeofence: boolean;
  requireQrScan: boolean;
  requireStarlinkIp: boolean;
  starlinkIpAddresses: string;
  starlinkPowerOutageMode: boolean;
}

interface RosterMember {
  employeeId: string;
  legalName: string;
  employeeNumber: string;
  role: string;
  workLocation: string;
  organizationName: string;
  weeklyOffDays: string; // e.g. "0,6"
  customShiftIn: string;
  customShiftOut: string;
  isExempt: boolean;
  notes: string | null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ALLOWED_ADMIN_ROLES = ['GMD', 'SYSTEM_ADMIN', 'HR', 'COO', 'FINANCE_CONTROLLER', 'SUPER_ADMIN'];

export default function AttendanceDeskPage() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'unauthorized'>('checking');
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'roster' | 'policy' | 'payroll'>('live');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTogglingPower, setIsTogglingPower] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [callerIp, setCallerIp] = useState<string>('');

  // Live board data
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [counts, setCounts] = useState<any>({ total: 0, present: 0, late: 0, absent: 0, offDay: 0, excused: 0 });
  const [employees, setEmployees] = useState<AttendanceRow[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Policy data
  const [policy, setPolicy] = useState<AttendancePolicy>({
    earliestCheckInTime: '07:00',
    resumptionTime: '08:00',
    closingTime: '17:00',
    gracePeriodMinutes: 15,
    latenessDeductionPercent: 5.0,
    absenceDeductionPercent: 100.0,
    requireGeofence: true,
    requireQrScan: true,
    requireStarlinkIp: true,
    starlinkIpAddresses: '',
    starlinkPowerOutageMode: false,
  });

  // Roster data
  const [roster, setRoster] = useState<RosterMember[]>([]);

  // Company Location Station State
  const [station, setStation] = useState<{
    id?: string;
    name: string;
    code: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }>({
    name: 'BEMS Group Corporate Headquarters',
    code: 'BEMS-HQ-MAIN',
    latitude: 6.4281,
    longitude: 3.4219,
    radiusMeters: 100,
  });
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [isSavingStation, setIsSavingStation] = useState<boolean>(false);

  // Manual Override Modal state
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    employee: AttendanceRow | null;
    status: 'PRESENT' | 'EXCUSED';
    reason: string;
  }>({
    isOpen: false,
    employee: null,
    status: 'PRESENT',
    reason: '',
  });

  // Load timesheet & live attendance
  const loadTimesheet = async (dateStr?: string) => {
    try {
      setIsLoading(true);
      const url = dateStr ? `/api/attendance/timesheet?date=${dateStr}` : '/api/attendance/timesheet';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load timesheet');
      const data = await res.json();
      setCounts(data.counts || {});
      setEmployees(data.employees || []);
      if (!selectedDate && data.date) setSelectedDate(data.date);
      if (data.policy) {
        setPolicy(prev => ({ ...prev, ...data.policy }));
      }
      setIsLoading(false);
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
    }
  };

  // Load roster
  const loadRoster = async () => {
    try {
      const res = await fetch('/api/attendance/admin/roster');
      if (res.ok) {
        const data = await res.json();
        setRoster(data.roster || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load policy
  const loadPolicy = async () => {
    try {
      const res = await fetch('/api/attendance/admin/policy');
      if (res.ok) {
        const data = await res.json();
        if (data.policy) setPolicy(data.policy);
        if (data.callerIp) setCallerIp(data.callerIp);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Quick 1-click Power Outage Mode toggle
  const handleTogglePowerOutage = async () => {
    try {
      setIsTogglingPower(true);
      const res = await fetch('/api/attendance/admin/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ togglePowerOutage: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle power mode');
      if (data.policy) setPolicy(data.policy);
      setNotice(data.message);
      setTimeout(() => setNotice(null), 5000);
      setIsTogglingPower(false);
    } catch (err: any) {
      alert(err.message);
      setIsTogglingPower(false);
    }
  };

  // Load primary company station
  const loadStation = async () => {
    try {
      const res = await fetch('/api/attendance/admin/station');
      if (res.ok) {
        const data = await res.json();
        if (data.station) setStation(data.station);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-capture live high-precision GPS coordinates from browser
  const handleCaptureGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setStation(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        setNotice(`📍 High-precision GPS detected: [${lat}, ${lng}]. Click "Save Company Location" to apply!`);
        setTimeout(() => setNotice(null), 6000);
        setIsCapturingGps(false);
      },
      error => {
        alert(`Unable to acquire GPS coordinates: ${error.message}. Please allow location permissions in your browser.`);
        setIsCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Save company location station coordinates
  const handleSaveStation = async () => {
    try {
      setIsSavingStation(true);
      const res = await fetch('/api/attendance/admin/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(station),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save station coordinates');
      if (data.station) setStation(data.station);
      setNotice(data.message || 'Office location successfully calibrated!');
      setTimeout(() => setNotice(null), 5000);
      setIsSavingStation(false);
    } catch (err: any) {
      alert(err.message);
      setIsSavingStation(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session?_t=' + Date.now(), { credentials: 'include', cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        const user = data?.user;
        if (user && ALLOWED_ADMIN_ROLES.includes(user.role)) {
          setAuthenticatedUser(user);
          setAuthStatus('authorized');
          loadTimesheet();
          loadRoster();
          loadPolicy();
          loadStation();
        } else {
          setAuthStatus('unauthorized');
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setAuthStatus('unauthorized');
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Save Policy
  const handleSavePolicy = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/attendance/admin/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save policy');
      setNotice('Attendance policy & lateness deduction percentages updated successfully!');
      setTimeout(() => setNotice(null), 4000);
      setIsSaving(false);
    } catch (err: any) {
      alert(err.message);
      setIsSaving(false);
    }
  };

  // Toggle Off-Day for an employee
  const handleToggleOffDay = (empId: string, dayIndex: number) => {
    setRoster(prev =>
      prev.map(item => {
        if (item.employeeId !== empId) return item;
        const currentDays = item.weeklyOffDays
          .split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n));
        let nextDays: number[];
        if (currentDays.includes(dayIndex)) {
          nextDays = currentDays.filter(d => d !== dayIndex);
        } else {
          nextDays = [...currentDays, dayIndex].sort((a, b) => a - b);
        }
        return {
          ...item,
          weeklyOffDays: nextDays.join(','),
        };
      })
    );
  };

  // Save specific staff schedule
  const handleSaveStaffSchedule = async (member: RosterMember) => {
    try {
      const res = await fetch('/api/attendance/admin/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: member.employeeId,
          weeklyOffDays: member.weeklyOffDays,
          customShiftIn: member.customShiftIn,
          customShiftOut: member.customShiftOut,
          isExempt: member.isExempt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update roster');
      setNotice(`Updated work schedule for ${member.legalName}!`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Manual Override
  const handleSubmitOverride = async () => {
    if (!overrideModal.employee) return;
    try {
      setIsSaving(true);
      const res = await fetch('/api/attendance/admin/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: overrideModal.employee.employeeId,
          workDate: selectedDate,
          status: overrideModal.status,
          reason: overrideModal.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply manual override');
      setOverrideModal({ isOpen: false, employee: null, status: 'PRESENT', reason: '' });
      setNotice(data.message);
      setTimeout(() => setNotice(null), 4000);
      loadTimesheet(selectedDate);
      setIsSaving(false);
    } catch (err: any) {
      alert(err.message);
      setIsSaving(false);
    }
  };

  // Filtered live rows
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (authStatus === 'checking') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#040711',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f8fafc',
          fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ marginTop: 18, fontSize: '12px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>
          VERIFYING EXECUTIVE ACCESS CREDENTIALS...
        </p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (authStatus === 'unauthorized') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #070b19 0%, #030712 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#f8fafc',
          fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '40px 32px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(20px)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '68px',
              height: '68px',
              margin: '0 auto 20px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.05))',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <ShieldCheck size={36} />
          </div>

          <span
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '14px',
            }}
          >
            Executive Security Barrier
          </span>

          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px', color: '#ffffff' }}>
            Executive Authentication Required
          </h1>

          <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 28px' }}>
            The <strong>Attendance & Timekeeping Management Desk</strong> contains sensitive personnel presence, biometric coordinates, lateness deduction policies, and payroll penalty controls. Access is strictly restricted to GMD, COO, HR, and System Administrators.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link
              href="/finance"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '14px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                textDecoration: 'none',
                boxShadow: '0 10px 20px -5px rgba(249, 115, 22, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <span>Sign In to BEMS ERP Portal</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              href="/attendance/kiosk"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '13px 24px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <QrCode size={16} />
              <span>Launch Reception Kiosk Screen (For Clock-In)</span>
            </Link>
          </div>

          <div
            style={{
              marginTop: '28px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            BEMS Group Enterprise Infrastructure · All unauthorized access attempts are logged and monitored.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Banner / Toast Notice */}
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '10px',
            background: '#0f172a',
            color: '#34d399',
            fontSize: '13px',
            fontWeight: 700,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src="/bems-group-logo.png?v=20261024"
            alt="BEMS logo"
            style={{ width: 34, height: 34, objectFit: 'contain' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '18px', fontWeight: 800 }}>Attendance & Timekeeping Desk</strong>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                }}
              >
                LIVE TELEMETRY
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Biometric Presence · Geofenced Mobile Punch · Payroll Penalty Sync · Executive Coverage
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/attendance/kiosk"
            target="_blank"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              background: '#ea580c',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
            }}
          >
            <QrCode size={14} />
            <span>Open Reception Kiosk Screen</span>
            <ExternalLink size={12} />
          </Link>
          <Link
            href="/"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            All Modules
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '24px 32px', flex: 1 }}>
        {/* Starlink Wi-Fi & Power Outage Emergency Control Strip */}
        <div
          style={{
            marginBottom: '20px',
            padding: '16px 20px',
            borderRadius: '12px',
            border: policy.starlinkPowerOutageMode ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
            background: policy.starlinkPowerOutageMode
              ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
              : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: policy.starlinkPowerOutageMode ? '0 4px 14px rgba(245, 158, 11, 0.15)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: policy.starlinkPowerOutageMode ? '#f59e0b' : '#059669',
                color: '#ffffff',
                boxShadow: policy.starlinkPowerOutageMode
                  ? '0 2px 8px rgba(245, 158, 11, 0.4)'
                  : '0 2px 8px rgba(5, 150, 105, 0.3)',
              }}
            >
              {policy.starlinkPowerOutageMode ? <Zap size={22} /> : <Wifi size={22} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: policy.starlinkPowerOutageMode ? '#b45309' : '#047857',
                  }}
                >
                  {policy.starlinkPowerOutageMode
                    ? '⚡ POWER OUTAGE FALLBACK MODE ACTIVE'
                    : '🟢 NORMAL STARLINK WI-FI ENFORCED'}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: policy.starlinkPowerOutageMode ? '#fde68a' : '#d1fae5',
                    color: policy.starlinkPowerOutageMode ? '#92400e' : '#065f46',
                  }}
                >
                  {policy.starlinkPowerOutageMode ? 'Location GPS Only' : 'Strict 3-Way Security'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                {policy.starlinkPowerOutageMode
                  ? 'Starlink connection requirement is temporarily bypassed because office power is down. Staff can scan with GPS location alone.'
                  : `Staff must be connected to company Starlink Wi-Fi and inside office geofence to scan attendance.`}
              </p>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Arrival Window: <strong>{policy.earliestCheckInTime || '07:00'} AM – {policy.resumptionTime} AM</strong> (Grace up to 08:15 AM) · No check-in permitted before {policy.earliestCheckInTime || '07:00'} AM
              </div>
            </div>
          </div>

          <button
            onClick={handleTogglePowerOutage}
            disabled={isTogglingPower}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: policy.starlinkPowerOutageMode ? '#059669' : '#ea580c',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              boxShadow: policy.starlinkPowerOutageMode
                ? '0 2px 8px rgba(5, 150, 105, 0.3)'
                : '0 2px 8px rgba(234, 88, 12, 0.3)',
            }}
          >
            {isTogglingPower ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : policy.starlinkPowerOutageMode ? (
              <Wifi size={14} />
            ) : (
              <Zap size={14} />
            )}
            <span>
              {policy.starlinkPowerOutageMode
                ? 'Restore Starlink Wi-Fi Mode'
                : 'Activate Power Outage Mode (Starlink Off)'}
            </span>
          </button>
        </div>

        {/* KPI Stats Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '14px',
            marginBottom: '24px',
          }}
        >
          <div style={{ padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>
              <Users size={14} color="#64748b" />
              <span>TOTAL PERSONNEL</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
              {counts.total}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>All Staff, COO & GMD</div>
          </div>

          <div style={{ padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '11px', fontWeight: 700 }}>
              <CheckCircle2 size={14} color="#059669" />
              <span>ON-TIME PRESENT</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669', marginTop: '6px' }}>
              {counts.present}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Checked in $\le$ 08:15 AM
            </div>
          </div>

          <div style={{ padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ea580c', fontSize: '11px', fontWeight: 700 }}>
              <AlertTriangle size={14} color="#ea580c" />
              <span>LATE ARRIVALS</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
              {counts.late}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Flagged for {policy.latenessDeductionPercent}% salary deduction
            </div>
          </div>

          <div style={{ padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontSize: '11px', fontWeight: 700 }}>
              <Calendar size={14} color="#2563eb" />
              <span>OFF-DUTY ROSTER</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb', marginTop: '6px' }}>
              {counts.offDay}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Scheduled off-day in week</div>
          </div>

          <div style={{ padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '11px', fontWeight: 700 }}>
              <UserX size={14} color="#dc2626" />
              <span>UNEXCUSED ABSENT</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#dc2626', marginTop: '6px' }}>
              {counts.absent}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Pending punch or override</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'live', label: "Today's Live Presence Board", icon: Clock },
              { id: 'roster', label: 'Staff Weekly Off-Day Roster', icon: Calendar },
              { id: 'policy', label: 'Shift Hours & Lateness Deductions', icon: Settings },
              { id: 'payroll', label: 'Payroll Impact & Penalties', icon: ShieldCheck },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 18px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: isActive ? '2px solid #ea580c' : '2px solid transparent',
                    color: isActive ? '#ea580c' : '#64748b',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === 'live' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  loadTimesheet(e.target.value);
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#ffffff',
                }}
              />
              <button
                onClick={() => loadTimesheet(selectedDate)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
                title="Refresh"
              >
                <RefreshCw size={14} color="#64748b" />
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Live Presence Board */}
        {activeTab === 'live' && (
          <div>
            {/* Filter & Search Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ position: 'relative', width: '320px' }}>
                <Search
                  size={15}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Search staff name, ID, or role..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {['ALL', 'PRESENT', 'LATE', 'OFF_DAY', 'ABSENT', 'EXCUSED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: statusFilter === st ? '#ea580c' : '#e2e8f0',
                      background: statusFilter === st ? '#fff7ed' : '#ffffff',
                      color: statusFilter === st ? '#ea580c' : '#64748b',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '12px 16px' }}>Employee</th>
                    <th style={{ padding: '12px 16px' }}>Role / Level</th>
                    <th style={{ padding: '12px 16px' }}>Assigned Station</th>
                    <th style={{ padding: '12px 16px' }}>Check In</th>
                    <th style={{ padding: '12px 16px' }}>Check Out</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Deduction</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                        No personnel found matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(emp => {
                      const checkInFormatted = emp.checkInTime
                        ? new Date(emp.checkInTime).toLocaleTimeString('en-US', {
                            timeZone: 'Africa/Lagos',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—';
                      const checkOutFormatted = emp.checkOutTime
                        ? new Date(emp.checkOutTime).toLocaleTimeString('en-US', {
                            timeZone: 'Africa/Lagos',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—';

                      let badgeBg = '#f1f5f9';
                      let badgeColor = '#475569';
                      if (emp.status === 'PRESENT') {
                        badgeBg = '#ecfdf5';
                        badgeColor = '#059669';
                      } else if (emp.status === 'LATE') {
                        badgeBg = '#fff7ed';
                        badgeColor = '#ea580c';
                      } else if (emp.status === 'ABSENT') {
                        badgeBg = '#fef2f2';
                        badgeColor = '#dc2626';
                      } else if (emp.status === 'OFF_DAY') {
                        badgeBg = '#eff6ff';
                        badgeColor = '#2563eb';
                      } else if (emp.status === 'EXCUSED') {
                        badgeBg = '#f5f3ff';
                        badgeColor = '#7c3aed';
                      }

                      return (
                        <tr key={emp.employeeId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{emp.legalName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{emp.employeeNumber}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{emp.role}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{emp.organizationName}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={12} color="#059669" />
                              <span>{emp.stationName || emp.workLocation}</span>
                            </div>
                            {emp.distanceMeters !== undefined && (
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                Geofence: {emp.distanceMeters}m
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                            {checkInFormatted}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                            {checkOutFormatted}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: badgeBg,
                                color: badgeColor,
                                fontSize: '10px',
                                fontWeight: 800,
                              }}
                            >
                              {emp.status}
                            </span>
                            {emp.isManualOverride && (
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '9px',
                                  color: '#7c3aed',
                                  fontWeight: 700,
                                  marginTop: '2px',
                                }}
                              >
                                Manual Override
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {emp.deductionPercent > 0 ? (
                              <span style={{ color: '#dc2626', fontWeight: 800 }}>-{emp.deductionPercent}%</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0%</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() =>
                                setOverrideModal({
                                  isOpen: true,
                                  employee: emp,
                                  status: 'PRESENT',
                                  reason: '',
                                })
                              }
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#334155',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Manual Override
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Staff Roster & Weekly Off-Days */}
        {activeTab === 'roster' && (
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>
                Weekly Work Rosters & Configurable Off-Days
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Configure individual days off for each staff member. Staff will not be penalized or marked absent on their scheduled off-days.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {roster.map(member => {
                const offDays = member.weeklyOffDays
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n));

                return (
                  <div
                    key={member.employeeId}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                        {member.legalName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {member.employeeNumber} · {member.role} · {member.workLocation}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginRight: '6px' }}>
                          Off-Days:
                        </span>
                        {DAY_NAMES.map((name, idx) => {
                          const isOff = offDays.includes(idx);
                          return (
                            <button
                              key={name}
                              onClick={() => handleToggleOffDay(member.employeeId, idx)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: isOff ? '#2563eb' : '#cbd5e1',
                                background: isOff ? '#2563eb' : '#ffffff',
                                color: isOff ? '#ffffff' : '#475569',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                              title={isOff ? 'Scheduled Day Off' : 'Working Day'}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handleSaveStaffSchedule(member)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          background: '#0f172a',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Save size={13} />
                        <span>Save Roster</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Shift Hours & Lateness Deductions */}
        {activeTab === 'policy' && (
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px', maxWidth: '720px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px' }}>
              Shift Resumption, Grace Period & Deduction Policies
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 24px' }}>
              Adjust general resumption parameters and lateness deduction penalties that directly feed into the monthly payroll module.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 1. Official Company Location Calibration Section */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: '#ea580c',
                        color: '#ffffff',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                        Official Company Attendance Location
                      </h4>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Primary office station coordinates & geofence perimeter for all employee check-ins
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isCapturingGps}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: '#0f172a',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)',
                    }}
                  >
                    {isCapturingGps ? <RefreshCw size={13} className="animate-spin" /> : <MapPin size={13} color="#ea580c" />}
                    <span>{isCapturingGps ? 'Acquiring GPS...' : '📍 Capture Current Office GPS'}</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                      OFFICE LOCATION NAME
                    </label>
                    <input
                      type="text"
                      value={station.name}
                      onChange={e => setStation(prev => ({ ...prev, name: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                      GEOFENCE RADIUS (METERS)
                    </label>
                    <input
                      type="number"
                      min="20"
                      max="1000"
                      step="10"
                      value={station.radiusMeters}
                      onChange={e => setStation(prev => ({ ...prev, radiusMeters: Number(e.target.value) }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                      LATITUDE (GPS)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={station.latitude}
                      onChange={e => setStation(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                      LONGITUDE (GPS)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={station.longitude}
                      onChange={e => setStation(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Current Pin: <strong>{station.latitude.toFixed(6)}° N, {station.longitude.toFixed(6)}° E</strong> (Perimeter: <strong>{station.radiusMeters}m</strong>)
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveStation}
                    disabled={isSavingStation}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: '#ea580c',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Save size={13} />
                    <span>{isSavingStation ? 'Saving Location...' : 'Save Company Location'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Shift Resumption & Timing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                    EARLIEST ARRIVAL CHECK-IN (LOCK TIME)
                  </label>
                  <input
                    type="time"
                    value={policy.earliestCheckInTime}
                    onChange={e => setPolicy(prev => ({ ...prev, earliestCheckInTime: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    No check-in permitted before this time (07:00 AM)
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    SHIFT RESUMPTION TIME
                  </label>
                  <input
                    type="time"
                    value={policy.resumptionTime}
                    onChange={e => setPolicy(prev => ({ ...prev, resumptionTime: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    Standard corporate start (08:00 AM)
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    SHIFT CLOSING TIME
                  </label>
                  <input
                    type="time"
                    value={policy.closingTime}
                    onChange={e => setPolicy(prev => ({ ...prev, closingTime: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    Standard corporate close (05:00 PM)
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    GRACE PERIOD (MINUTES)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={policy.gracePeriodMinutes}
                    onChange={e => setPolicy(prev => ({ ...prev, gracePeriodMinutes: Number(e.target.value) }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    Check-in up to 08:15 AM is logged ON_TIME
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#ea580c', marginBottom: '6px' }}>
                    LATENESS DEDUCTION PERCENTAGE (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={policy.latenessDeductionPercent}
                    onChange={e => setPolicy(prev => ({ ...prev, latenessDeductionPercent: Number(e.target.value) }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #ea580c',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#ea580c',
                    }}
                  />
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    Deducted from daily pro-rated wage in payroll
                  </span>
                </div>
              </div>

              {/* Starlink Wi-Fi Settings Section */}
              <div style={{ padding: '20px', borderRadius: '10px', background: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e0f2fe', color: '#0369a1', display: 'grid', placeItems: 'center' }}>
                      <Wifi size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                        Require Company Starlink Wi-Fi Connection
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Staff device must be connected to the company Starlink router to unlock the QR code scanner
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.requireStarlinkIp}
                    onChange={e => setPolicy(prev => ({ ...prev, requireStarlinkIp: e.target.checked }))}
                    style={{ width: 20, height: 20, accentColor: '#ea580c' }}
                  />
                </div>

                {policy.requireStarlinkIp && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                      COMPANY STARLINK PUBLIC IP ADDRESSES OR SUBNETS
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="e.g. 102.89.44.12, 197.210.55.0/24 (or leave empty to allow any connected office IP)"
                        value={policy.starlinkIpAddresses}
                        onChange={e => setPolicy(prev => ({ ...prev, starlinkIpAddresses: e.target.value }))}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                        }}
                      />
                      {callerIp && (
                        <button
                          type="button"
                          onClick={() => setPolicy(prev => ({ ...prev, starlinkIpAddresses: callerIp }))}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: '#0284c7',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 800,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Globe size={13} />
                          <span>Use My Current IP ({callerIp})</span>
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'block' }}>
                      Current detected IP: <strong style={{ color: '#0f172a' }}>{callerIp || '127.0.0.1'}</strong>. If you are on the office Starlink right now, click "Use My Current IP" to lock the network.
                    </span>
                  </div>
                )}
              </div>

              <div style={{ padding: '16px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                      Require Device Geofence Verification
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Staff must be physically within the office station perimeter (100m)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.requireGeofence}
                    onChange={e => setPolicy(prev => ({ ...prev, requireGeofence: e.target.checked }))}
                    style={{ width: 18, height: 18 }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                      Require Dynamic QR Scan
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Staff must scan the active rotating QR displayed on the kiosk
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.requireQrScan}
                    onChange={e => setPolicy(prev => ({ ...prev, requireQrScan: e.target.checked }))}
                    style={{ width: 18, height: 18 }}
                  />
                </div>
              </div>

              <button
                onClick={handleSavePolicy}
                disabled={isSaving}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  background: '#ea580c',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Save size={16} />
                <span>{isSaving ? 'Saving Changes...' : 'Save Attendance Policy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Payroll Impact & Penalties */}
        {activeTab === 'payroll' && (
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px' }}>
              Monthly Payroll Linkage & Deduction Clearing
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px' }}>
              Attendance penalties automatically feed into monthly payroll runs. Daily pro-rated deductions apply for unexcused lateness and absences.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>ACTIVE PAYROLL CYCLE</span>
                <strong style={{ display: 'block', fontSize: '18px', color: '#0f172a', marginTop: '4px' }}>
                  October 2026 Regular Batch
                </strong>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '2px', display: 'block' }}>
                  ● Cycle Open
                </span>
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>ACTIVE LATENESS PENALTY RATE</span>
                <strong style={{ display: 'block', fontSize: '18px', color: '#ea580c', marginTop: '4px' }}>
                  {policy.latenessDeductionPercent}% of Daily Base Wage
                </strong>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Grace window: {policy.gracePeriodMinutes} mins (08:15 AM)
                </span>
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>UNEXCUSED ABSENCE PENALTY</span>
                <strong style={{ display: 'block', fontSize: '18px', color: '#dc2626', marginTop: '4px' }}>
                  100% of Daily Wage
                </strong>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Full daily pay forfeiture
                </span>
              </div>
            </div>

            <Link
              href="/payroll"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              <span>Review Current Payroll Register</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </main>

      {/* Manual Override Modal */}
      {overrideModal.isOpen && overrideModal.employee && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Manual Attendance Override
              </h3>
              <button
                onClick={() => setOverrideModal({ isOpen: false, employee: null, status: 'PRESENT', reason: '' })}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', background: '#f8fafc', marginBottom: '16px', fontSize: '12px' }}>
              <div><strong>Staff:</strong> {overrideModal.employee.legalName} ({overrideModal.employee.employeeNumber})</div>
              <div><strong>Role:</strong> {overrideModal.employee.role} · {overrideModal.employee.workLocation}</div>
              <div><strong>Work Date:</strong> {selectedDate}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                OVERRIDE STATUS
              </label>
              <select
                value={overrideModal.status}
                onChange={e => setOverrideModal(prev => ({ ...prev, status: e.target.value as any }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <option value="PRESENT">PRESENT (Official Duty / Clocked-In)</option>
                <option value="EXCUSED">EXCUSED (Approved Leave / Sickness)</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                MANDATORY AUDIT REASON *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Off-site client briefing with bank auditors; approved by Head of Admin"
                value={overrideModal.reason}
                onChange={e => setOverrideModal(prev => ({ ...prev, reason: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOverrideModal({ isOpen: false, employee: null, status: 'PRESENT', reason: '' })}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitOverride}
                disabled={isSaving || overrideModal.reason.trim().length < 5}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ea580c',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: overrideModal.reason.trim().length < 5 ? 0.6 : 1,
                }}
              >
                {isSaving ? 'Submitting...' : 'Confirm Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
          padding: '14px 32px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#94a3b8',
        }}
      >
        © 2026 BEMS Group Holdings Limited · Enterprise Attendance & Accountability Network
      </footer>
    </div>
  );
}
