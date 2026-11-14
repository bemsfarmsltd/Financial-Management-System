'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  Users,
  Clock,
  Calendar,
  Wallet,
  Target,
  GraduationCap,
  Shield,
  ClipboardCheck,
  FileText,
  BarChart3,
  Settings,
  ArrowLeft,
  ArrowUpRight,
  Lock,
  Building2,
} from 'lucide-react';
import { HrOverviewData, HrSectionId, formatNairaMinor } from '@/components/hr/hrTypes';
import HrOverviewPanel from '@/components/hr/HrOverviewPanel';
import HrEmployeesPanel from '@/components/hr/HrEmployeesPanel';
import { HrAttendancePanel, HrLeavePanel } from '@/components/hr/HrAttendanceLeavePanels';

const NAV_ITEMS: {
  id: HrSectionId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  phaseBadge?: string;
}[] = [
  { id: 'overview', label: 'Overview', subtitle: 'Dashboard, action centre & trends', icon: LayoutGrid },
  { id: 'employees', label: 'Employees', subtitle: 'Directory, profiles, onboarding & exits', icon: Users },
  { id: 'attendance', label: 'Attendance & Scheduling', subtitle: 'Daily attendance, shifts & overrides', icon: Clock },
  { id: 'leave', label: 'Leave Management', subtitle: 'Policies, balances & approvals', icon: Calendar },
  { id: 'payroll', label: 'Payroll & Benefits', subtitle: 'Compensation, payroll & deductions', icon: Wallet, phaseBadge: 'Phase 2' },
  { id: 'performance', label: 'Performance', subtitle: 'KPIs, appraisals, probation & PIPs', icon: Target, phaseBadge: 'Phase 3' },
  { id: 'recruitment', label: 'Recruitment & Development', subtitle: 'Hiring, training & career growth', icon: GraduationCap, phaseBadge: 'Phase 4' },
  { id: 'relations', label: 'Employee Relations', subtitle: 'Discipline, welfare & grievances', icon: Shield, phaseBadge: 'Phase 3' },
  { id: 'requests', label: 'Requests & Approvals', subtitle: 'Central request & approval desk', icon: ClipboardCheck, phaseBadge: 'Phase 2' },
  { id: 'documents', label: 'Documents', subtitle: 'Contracts, letters & signatures', icon: FileText, phaseBadge: 'Phase 2' },
  { id: 'reports', label: 'Reports & Analytics', subtitle: 'Group, company & staff reports', icon: BarChart3, phaseBadge: 'Phase 3' },
  { id: 'configuration', label: 'Configuration', subtitle: 'Policies, workflows & permissions', icon: Settings, phaseBadge: 'Phase 3' },
];

export default function HumanResourcesPortalPage() {
  const [activeSection, setActiveSection] = useState<HrSectionId>('overview');
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState('');
  const [presetFilter, setPresetFilter] = useState<string>('ALL');
  const [overview, setOverview] = useState<HrOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<{ code: number; message: string } | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSubsidiaryId) params.set('subsidiaryId', selectedSubsidiaryId);
      const res = await fetch(`/api/hr/overview?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setAuthError({ code: res.status, message: data.error || 'Access denied.' });
        setOverview(null);
      } else {
        setAuthError(null);
        setOverview(data);
      }
    } catch {
      setAuthError({ code: 500, message: 'Unable to reach BEMS HR services.' });
    } finally {
      setLoading(false);
    }
  }, [selectedSubsidiaryId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleNavigate = (section: HrSectionId, filter?: string) => {
    setPresetFilter(filter || 'ALL');
    setActiveSection(section);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'grid', placeItems: 'center', color: '#475569', fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
        Loading BEMS Human Resource Management System...
      </div>
    );
  }

  if (authError || !overview) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'grid', placeItems: 'center', padding: '24px', fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: '460px', width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '14px', background: '#fff7ed', color: '#ea580c', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <Lock size={24} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            HR Workspace Access Required
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            {authError?.message || 'Please sign in with an authorized GMD, Super Admin, or HR-capable account.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Link href="/" style={{ padding: '9px 16px', borderRadius: '8px', background: '#f1f5f9', color: '#334155', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              ← Back to Systems
            </Link>
            <Link href="/finance" style={{ padding: '9px 16px', borderRadius: '8px', background: '#ea580c', color: '#ffffff', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              Sign In via Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

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
      {/* Top Header */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/bems-group-logo.png?v=20261024"
              alt="BEMS logo"
              style={{ width: 32, height: 32, objectFit: 'contain' }}
            />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                BEMS ERP / Human Resources
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                Authoritative Workforce, Attendance &amp; Lifecycle Workspace
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '5px 10px' }}>
              <Building2 size={14} color="#ea580c" />
              <select
                value={selectedSubsidiaryId}
                onChange={(e) => setSelectedSubsidiaryId(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0f172a',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">All BEMS Subsidiaries</option>
                {overview.subsidiaries.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} — {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={13} /> All Systems
            </Link>

            <Link
              href="/finance"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                borderRadius: '8px',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                color: '#ea580c',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Finance Desk <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body: 12-Item Sidebar + Content */}
      <div
        style={{
          maxWidth: '1440px',
          width: '100%',
          margin: '0 auto',
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: '270px minmax(0, 1fr)',
          gap: '20px',
          flex: 1,
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '12px',
            alignSelf: 'start',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ padding: '6px 10px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Human Resources (12 Modules)
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id, 'ALL')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '9px 10px',
                  borderRadius: '10px',
                  border: active ? '1px solid #fed7aa' : '1px solid transparent',
                  background: active ? '#fff7ed' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ marginTop: '2px' }}>
                  <Icon size={16} color={active ? '#ea580c' : '#64748b'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: active ? '#ea580c' : '#0f172a' }}>
                      {item.label}
                    </span>
                    {item.phaseBadge && (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: '#f1f5f9', color: '#64748b' }}>
                        {item.phaseBadge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Active Panel */}
        <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                {activeNav.label}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                {activeNav.subtitle}
              </p>
            </div>
          </div>

          {activeSection === 'overview' && (
            <HrOverviewPanel
              data={overview}
              onNavigate={handleNavigate}
              onSelectSubsidiary={setSelectedSubsidiaryId}
            />
          )}

          {activeSection === 'employees' && (
            <HrEmployeesPanel
              subsidiaries={overview.subsidiaries}
              selectedSubsidiaryId={selectedSubsidiaryId}
              initialApprovalFilter={presetFilter}
              onRefreshOverview={loadOverview}
            />
          )}

          {activeSection === 'attendance' && (
            <HrAttendancePanel
              todayStr={overview.todayStr}
              initialStatusFilter={presetFilter}
              onRefreshOverview={loadOverview}
            />
          )}

          {activeSection === 'leave' && (
            <HrLeavePanel
              initialStatusFilter={presetFilter}
              onRefreshOverview={loadOverview}
            />
          )}

          {activeSection === 'payroll' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Payroll Preparation &amp; Finance Payment Handoff
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                HR prepares approved employee compensation, deductions, and attendance exceptions here; Finance &amp; the GMD execute final payment sign-off and Monnify settlement in <Link href="/finance" style={{ color: '#ea580c', fontWeight: 700 }}>/finance</Link>.
              </p>
              {overview.latestPayrollBatch && (
                <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <strong>Latest Batch:</strong> {overview.latestPayrollBatch.yearMonth} (v{overview.latestPayrollBatch.version}) ·{' '}
                  <strong>Status:</strong> {overview.latestPayrollBatch.status} ·{' '}
                  <strong>Gross:</strong> {formatNairaMinor(overview.latestPayrollBatch.totalGrossMinor)} ·{' '}
                  <strong>Net:</strong> {formatNairaMinor(overview.latestPayrollBatch.totalNetMinor)}
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Phase 2 will add draft payroll calculation, prorated joiners/leavers, proposed deductions with employee dispute workflow, and finalized PDF payslips directly in this tab.
              </div>
            </div>
          )}

          {!['overview', 'employees', 'attendance', 'leave', 'payroll'].includes(activeSection) && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px' }}>
              <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', background: '#fff7ed', color: '#ea580c', fontSize: '11px', fontWeight: 800, marginBottom: '10px' }}>
                {activeNav.phaseBadge || 'Planned'}
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                {activeNav.label}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                {activeNav.subtitle}. This module is wired into the BEMS HR sidebar and scheduled for full database &amp; UI implementation in <strong>{activeNav.phaseBadge}</strong> of the approved HR Architecture Plan.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
