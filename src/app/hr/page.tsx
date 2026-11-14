'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { HrOverviewData, HrSectionId, formatNairaMinor } from '@/components/hr/hrTypes';
import HrOverviewPanel from '@/components/hr/HrOverviewPanel';
import HrEmployeesPanel from '@/components/hr/HrEmployeesPanel';
import HrLeavePanel from '@/components/hr/HrLeavePanel';
import HrPayrollPanel from '@/components/hr/HrPayrollPanel';
import HrRequestsPanel from '@/components/hr/HrRequestsPanel';
import HrDocumentsPanel from '@/components/hr/HrDocumentsPanel';
import HrPerformancePanel from '@/components/hr/HrPerformancePanel';
import HrRelationsPanel from '@/components/hr/HrRelationsPanel';
import HrRecruitmentPanel from '@/components/hr/HrRecruitmentPanel';
import HrReportsPanel from '@/components/hr/HrReportsPanel';
import HrConfigPanel from '@/components/hr/HrConfigPanel';
import AttendanceDeskPage from '../attendance/page';
import { StaffProfilesModule as LiveStaffProfilesModule } from '@/components/dashboard/gmd/BusinessModules';
import { TabErrorBoundary } from '@/components/layout/TabErrorBoundary';
import { useGmdAccess } from '@/components/ai/useGmdAccess';
import { useAiFinancialManager } from '@/components/ai/useAiFinancialManager';
import { AiFinancialManagerDrawer } from '@/components/ai/AiFinancialManagerDrawer';
import { AmbientBottomAiBar } from '@/components/ai/AmbientBottomAiBar';
import { AiChatHistoryDrawer } from '@/components/ai/AiChatHistoryDrawer';
import { AiScreenEdgeGlow, notifyAiInteraction } from '@/components/ai/AiScreenEdgeGlow';
import { AiMotionEntryScreen } from '@/components/ai/AiMotionEntryScreen';
import { KineticOptikkaTorus } from '@/components/ai/KineticOptikkaTorus';
import { UniversalClickToAskProvider } from '@/components/ai/UniversalClickToAskProvider';

type NavItemDef = {
  id: HrSectionId;
  label: string;
  subtitle: string;
  icon: string;
  phaseBadge?: string;
};

const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: 'WORKFORCE',
    items: [
      { id: 'overview', label: 'Overview', subtitle: 'Dashboard, action centre & trends', icon: '⌂' },
      { id: 'employees', label: 'Employees', subtitle: 'Directory, profiles, onboarding & exits', icon: '☷' },
    ],
  },
  {
    label: 'TIME & PAY',
    items: [
      { id: 'attendance', label: 'Attendance & Scheduling', subtitle: 'Daily attendance, shifts & overrides', icon: '◔' },
      { id: 'leave', label: 'Leave Management', subtitle: 'Policies, balances & approvals', icon: '◷' },
      { id: 'payroll', label: 'Payroll & Benefits', subtitle: 'Compensation, payroll, deductions & loans', icon: '∿' },
    ],
  },
  {
    label: 'GROWTH & RELATIONS',
    items: [
      { id: 'performance', label: 'Performance', subtitle: 'KPIs, appraisals, probation & PIPs', icon: '◎' },
      { id: 'recruitment', label: 'Recruitment & Development', subtitle: 'Hiring, training & career growth', icon: '✦' },
      { id: 'relations', label: 'Employee Relations', subtitle: 'Discipline, welfare & grievances', icon: '⚑' },
    ],
  },
  {
    label: 'GOVERNANCE',
    items: [
      { id: 'requests', label: 'Requests & Approvals', subtitle: 'Central request & approval desk', icon: '✓' },
      { id: 'documents', label: 'Documents', subtitle: 'Contracts, letters & signatures', icon: '◫' },
      { id: 'reports', label: 'Reports & Analytics', subtitle: 'Group, company & staff reports', icon: '▤' },
      { id: 'configuration', label: 'Configuration', subtitle: 'Policies, workflows & permissions', icon: '⚙' },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function computeTintHex(hex: string): string {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.slice(1) : 'ea580c';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const tintR = Math.min(255, Math.round(r + (255 - r) * 0.25));
  const tintG = Math.min(255, Math.round(g + (255 - g) * 0.25));
  const tintB = Math.min(255, Math.round(b + (255 - b) * 0.25));
  return `#${tintR.toString(16).padStart(2, '0')}${tintG.toString(16).padStart(2, '0')}${tintB.toString(16).padStart(2, '0')}`;
}

export default function HumanResourcesPortalPage() {
  const [activeSection, setActiveSection] = useState<HrSectionId>('overview');
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('bems_hr_subsidiary_id') || ''; } catch { return ''; }
  });
  const [loaderBrandColor, setLoaderBrandColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#ea580c';
    try { return localStorage.getItem('bems_hr_brand_color') || '#ea580c'; } catch { return '#ea580c'; }
  });
  const [presetFilter, setPresetFilter] = useState<string>('ALL');
  const [overview, setOverview] = useState<HrOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<{ code: number; message: string } | null>(null);
  const [switcher, setSwitcher] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const isSidebarCollapsed = collapsed && !sidebarHovered;
  const [search, setSearch] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [motionKey, setMotionKey] = useState(0);
  const [employeesView, setEmployeesView] = useState<'DIRECTORY' | 'PROFILES'>('DIRECTORY');
  const [visitedSections, setVisitedSections] = useState<HrSectionId[]>(['overview']);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const actorRoleUpper = (overview?.actor?.role || '').toUpperCase();
  const isAiAuthorized = useGmdAccess(actorRoleUpper);
  const userName = overview?.actor?.legalName || 'Executive';

  const loadOverview = useCallback(async () => {
    const cacheKey = `bems_hr_overview_${selectedSubsidiaryId || 'ALL'}`;
    let usedCache = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setOverview(JSON.parse(cached));
          usedCache = true;
          setLoading(false);
        }
      } catch {}
    }

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
        try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
      }
    } catch {
      if (!usedCache) setAuthError({ code: 500, message: 'Unable to reach BEMS HR services.' });
    } finally {
      if (!usedCache) setLoading(false);
    }
  }, [selectedSubsidiaryId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // ⌘K shortcut for search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeSub = useMemo(() => {
    if (!overview) return null;
    if (selectedSubsidiaryId) {
      return overview.subsidiaries.find((s) => s.id === selectedSubsidiaryId) || null;
    }
    return (
      overview.subsidiaries.find((s) => s.type === 'GROUP' || s.code === 'BEMS-GROUP') || null
    );
  }, [overview, selectedSubsidiaryId]);

  const activeBusinessName = activeSub?.name || 'BEMS Group';
  const activeBrandColor = activeSub?.brandColor || loaderBrandColor || '#ea580c';
  const activeTintHex = computeTintHex(activeBrandColor);
  const activeLogoUrl = activeSub?.logoUrl || '/bems-group-logo.png?v=20261024';
  const activeIndustry = activeSub?.industry || 'Human Resources & Workforce Operations';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('bems_hr_subsidiary_id', selectedSubsidiaryId);
      if (activeSub?.brandColor) {
        localStorage.setItem('bems_hr_brand_color', activeSub.brandColor);
        setLoaderBrandColor(activeSub.brandColor);
      } else if (!selectedSubsidiaryId) {
        localStorage.setItem('bems_hr_brand_color', '#ea580c');
        setLoaderBrandColor('#ea580c');
      }
    } catch {}
  }, [selectedSubsidiaryId, activeSub?.brandColor]);

  const aiManager = useAiFinancialManager({
    userName,
    userRole: actorRoleUpper || 'STAFF',
    businessId: activeSub?.id || 'BEMS-GROUP',
    currentPage: `HR · ${ALL_NAV_ITEMS.find((i) => i.id === activeSection)?.label || 'Overview'}`,
    businessName: activeBusinessName,
  });

  const handleNavigate = (section: HrSectionId, filter?: string) => {
    setPresetFilter(filter || 'ALL');
    setActiveSection(section);
    setVisitedSections((prev) => (prev.includes(section) ? prev : [...prev, section]));
    setMotionKey((k) => k + 1);
    setSearch('');
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return ALL_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );
  }, [search]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading BEMS HR" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f2eb', overflow: 'hidden' }}>
        <KineticOptikkaTorus size={460} brandColor={loaderBrandColor} />
      </div>
    );
  }

  if (authError || !overview) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'grid', placeItems: 'center', padding: '24px', fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: '460px', width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '28px', textAlign: 'center' }}>
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

  const activeNav = ALL_NAV_ITEMS.find((n) => n.id === activeSection) || ALL_NAV_ITEMS[0];
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'HR';

  return (
    <UniversalClickToAskProvider
      businessName={activeBusinessName}
      currentPage={`HR · ${activeNav.label}`}
      isInspectMode={isInspectMode}
      onToggleInspectMode={() => setIsInspectMode((v) => !v)}
      onAskContextualQuestion={(question, elementContext) => {
        if (!isAiAuthorized) return;
        notifyAiInteraction();
        aiManager.sendMessage(question, elementContext);
      }}
    >
      <style>{`
        :root, .app-shell, body {
          --brand-primary: ${activeBrandColor} !important;
          --brand-gradient: linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%) !important;
          --brand-shadow-color: ${activeBrandColor}40 !important;
          --brand-tint: ${activeBrandColor}18 !important;
          --brand-soft: ${activeBrandColor}14 !important;
          --brand-light: ${activeBrandColor}28 !important;
          --brand-border: ${activeBrandColor}55 !important;
          --orange: ${activeBrandColor} !important;
          --orange-dark: ${activeBrandColor} !important;
          --orange-soft: ${activeBrandColor}14 !important;
          --orange-light: ${activeBrandColor}28 !important;
        }
        .sidebar {
          background-color: #070c16 !important;
          background: radial-gradient(circle at 18% 10%, ${activeBrandColor}30, transparent 42%),
                      linear-gradient(180deg, #070c16 0%, #0b111e 50%, #050811 100%) !important;
          position: sticky !important;
          top: 0 !important;
          height: 100vh !important;
          overflow-y: auto !important;
        }
        .sidebar-circuit {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.38 !important;
          overflow: hidden;
          z-index: 1;
        }
        .sidebar-circuit:before {
          content: '';
          position: absolute;
          left: -90px;
          top: 165px;
          width: 250px;
          height: 250px;
          border: 1.5px solid ${activeBrandColor}70 !important;
          border-radius: 50%;
          box-shadow: 0 0 0 35px ${activeBrandColor}12, 0 0 0 85px ${activeBrandColor}05 !important;
        }
        .sidebar-circuit:after {
          content: '';
          position: absolute;
          width: 190px;
          height: 380px;
          right: -120px;
          bottom: 30px;
          border: 1px solid ${activeBrandColor}35 !important;
          border-radius: 50%;
          transform: rotate(24deg);
        }
        .nav-item.active {
          background: linear-gradient(90deg, ${activeBrandColor}, ${activeBrandColor}cc) !important;
          box-shadow: inset 3px 0 #ffffff, 0 6px 16px ${activeBrandColor}40 !important;
        }
        .nav-group > p {
          color: ${activeBrandColor} !important;
        }
        .kicker {
          color: ${activeBrandColor} !important;
        }
        .outline-button {
          border-color: ${activeBrandColor}55 !important;
          color: ${activeBrandColor} !important;
        }
        .help-button > span {
          background: ${activeBrandColor} !important;
        }
        .avatar {
          background: ${activeBrandColor}18 !important;
          color: ${activeBrandColor} !important;
          border-color: ${activeBrandColor}45 !important;
        }
        @keyframes hrMotionEnter {
          from { opacity: 0; transform: translateY(8px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .hr-object-motion {
          animation: hrMotionEnter 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>

      {isAiAuthorized && showWelcome && (
        <AiMotionEntryScreen
          userName={userName}
          userRole={actorRoleUpper}
          businessName={activeBusinessName}
          brandColor={activeBrandColor}
          onComplete={() => setShowWelcome(false)}
        />
      )}

      <main className={isSidebarCollapsed ? 'app-shell collapsed' : 'app-shell'}>
        {/* Dark Brand-Tinted Sidebar (collapsed by default, opens on hover) */}
        <aside
          className="sidebar"
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          <div className="sidebar-circuit" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </div>
          <div
            className="side-brand"
            style={{ cursor: 'pointer' }}
            onClick={() => setCollapsed((c) => !c)}
            title="Toggle sidebar"
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#ffffff',
                border: `1.5px solid ${activeBrandColor}50`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: 2,
                flexShrink: 0,
              }}
            >
              <img
                src={activeLogoUrl}
                alt={activeBusinessName}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </span>
            <div className="brand-title-wrap" style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span
                className="brand-name"
                title={activeBusinessName}
                style={{
                  display: 'block',
                  fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
                  fontSize: '15px',
                  fontWeight: 850,
                  letterSpacing: '-0.01em',
                  color: '#ffffff',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 155,
                }}
              >
                {activeBusinessName}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((c) => !c);
              }}
              aria-label="Toggle sidebar"
              title="Collapse or expand sidebar"
            >
              {collapsed ? '»' : '«'}
            </button>
          </div>

          <nav aria-label="HR navigation">
            {NAV_GROUPS.map((group) => (
              <div className="nav-group" key={group.label}>
                <p>{group.label}</p>
                {group.items.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      title={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={isActive ? 'nav-item active' : 'nav-item'}
                      onClick={() => {
                        handleNavigate(item.id, 'ALL');
                        setSwitcher(false);
                      }}
                    >
                      <span>{item.icon}</span>
                      <b>{item.label}</b>
                      {item.phaseBadge && (
                        <small style={{ opacity: 0.78 }}>{item.phaseBadge.replace('Phase ', 'P')}</small>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <button
            type="button"
            className="help-button"
            onClick={() => handleNavigate('configuration')}
          >
            <span>?</span>
            <div>
              <strong>HR Policies</strong>
              <small>Guides &amp; rules</small>
            </div>
          </button>
        </aside>

        {/* Main Workspace */}
        <section className="workspace">
          <header className="topbar">
            {/* Subsidiary Switcher */}
            <div className="business-switch-wrap">
              <button
                type="button"
                className="business-switch"
                onClick={() => setSwitcher((s) => !s)}
              >
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.25 }}>
                    {activeBusinessName}
                  </strong>
                  <small style={{ fontSize: 10.5, color: '#64748b', display: 'block', marginTop: 2 }}>
                    {activeIndustry}
                  </small>
                </div>
                <b style={{ color: '#94a3b8', fontSize: 12, marginLeft: 6 }}>⌄</b>
              </button>

              {switcher && (
                <div
                  className="switch-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 300,
                    padding: 8,
                    borderRadius: 14,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 16px 40px -8px rgba(15, 23, 42, 0.16), 0 0 1px 1px rgba(15, 23, 42, 0.04)',
                    zIndex: 60,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 10, fontWeight: 750, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>
                      Select Workspace
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 650, color: '#94a3b8' }}>
                      {overview.subsidiaries.length} entities
                    </span>
                  </div>

                  <div style={{ maxHeight: 260, overflowY: 'auto', padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubsidiaryId('');
                        setSwitcher(false);
                        setMotionKey((k) => k + 1);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: !selectedSubsidiaryId ? `${activeBrandColor}12` : 'transparent',
                        border: !selectedSubsidiaryId ? `1px solid ${activeBrandColor}35` : '1px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 30, height: 30, borderRadius: 7, background: '#ffffff', border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 2, flexShrink: 0 }}>
                        <img src="/bems-group-logo.png?v=20261024" alt="BEMS Group" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          BEMS Group (All Subsidiaries)
                        </div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>Group Consolidated View</div>
                      </div>
                    </button>

                    {overview.subsidiaries.map((sub) => {
                      const isSelected = selectedSubsidiaryId === sub.id;
                      const subColor = sub.brandColor || '#0d8a70';
                      return (
                        <button
                          type="button"
                          key={sub.id}
                          onClick={() => {
                            setSelectedSubsidiaryId(sub.id);
                            setSwitcher(false);
                            setMotionKey((k) => k + 1);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: isSelected ? `${subColor}12` : 'transparent',
                            border: isSelected ? `1px solid ${subColor}35` : '1px solid transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ width: 30, height: 30, borderRadius: 7, background: '#ffffff', border: `1px solid ${isSelected ? subColor : '#e2e8f0'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 2, flexShrink: 0 }}>
                            {sub.logoUrl ? (
                              <img src={sub.logoUrl} alt={sub.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 900, color: subColor }}>
                                {sub.code.replace('BEMS-', '').slice(0, 3)}
                              </span>
                            )}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sub.name}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b' }}>
                              {sub.code} · {sub.staffCount} staff
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Global Search (⌘ K) */}
            <div className="global-search">
              <span>⌕</span>
              <input
                ref={searchInputRef}
                aria-label="Search HR workspace"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeBusinessName} HR...`}
              />
              <kbd>⌘ K</kbd>
              {search && (
                <div className="search-results">
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                      >
                        <span>→</span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.subtitle}</small>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p>No HR modules matching &ldquo;{search}&rdquo;</p>
                  )}
                </div>
              )}
            </div>

            {/* Top Actions */}
            <div className="top-actions">
              {isAiAuthorized && (
                <button
                  type="button"
                  onClick={() => setShowWelcome(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    height: '28px',
                    borderRadius: '8px',
                    background: `${activeBrandColor}14`,
                    border: `1px solid ${activeBrandColor}40`,
                    color: activeBrandColor,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: '12px' }}>🔊</span>
                  <span>AI Welcome</span>
                </button>
              )}

              <Link
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  height: '28px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: activeBrandColor, fontSize: '12px' }}>❖</span>
                <span>All Systems</span>
              </Link>

              <div className="top-popover-wrap">
                <button
                  type="button"
                  className="top-icon notification"
                  aria-label="HR Notifications"
                  aria-expanded={notificationsOpen}
                  onClick={() => setNotificationsOpen((v) => !v)}
                >
                  🔔
                  {((overview?.metrics.pendingOnboarding || 0) +
                    (overview?.metrics.pendingLeaves || 0) +
                    (overview?.metrics.pendingExcuseRequests || 0)) > 0 && (
                    <i style={{ background: '#ef4444' }} />
                  )}
                </button>
                {notificationsOpen && (
                  <div className="top-popover notifications-panel">
                    <header>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong>HR Action Alerts</strong>
                        {((overview?.metrics.pendingOnboarding || 0) +
                          (overview?.metrics.pendingLeaves || 0) +
                          (overview?.metrics.pendingExcuseRequests || 0)) > 0 && (
                          <span style={{ fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                            {(overview?.metrics.pendingOnboarding || 0) +
                              (overview?.metrics.pendingLeaves || 0) +
                              (overview?.metrics.pendingExcuseRequests || 0)}{' '}
                            pending
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => setNotificationsOpen(false)}>×</button>
                    </header>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          handleNavigate('employees', 'PENDING_APPROVAL');
                          setNotificationsOpen(false);
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>Pending Staff Onboarding</span>
                        <strong style={{ fontSize: '12.5px', color: activeBrandColor }}>{overview?.metrics.pendingOnboarding || 0} →</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleNavigate('leave');
                          setNotificationsOpen(false);
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>Pending Leave Requests</span>
                        <strong style={{ fontSize: '12.5px', color: activeBrandColor }}>{overview?.metrics.pendingLeaves || 0} →</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleNavigate('attendance');
                          setNotificationsOpen(false);
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>Attendance Excuse Reviews</span>
                        <strong style={{ fontSize: '12.5px', color: activeBrandColor }}>{overview?.metrics.pendingExcuseRequests || 0} →</strong>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="avatar" title={`${userName} (${actorRoleUpper})`}>
                {userInitials}
              </div>
            </div>
          </header>

          {/* Content with Object Motion Reload */}
          <div className="content" style={{ paddingBottom: isAiAuthorized ? '96px' : '32px' }}>
            <TabErrorBoundary tabName={activeNav.label} onReset={() => handleNavigate('overview')}>
              <div key={selectedSubsidiaryId || 'ALL'} className="hr-object-motion">
                {activeSection !== 'overview' && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderLeft: `4px solid ${activeBrandColor}`,
                      borderRadius: '16px',
                      padding: '16px 22px',
                      marginBottom: '20px',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: `${activeBrandColor}14`,
                          border: `1px solid ${activeBrandColor}30`,
                          color: activeBrandColor,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '20px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {activeNav.icon}
                      </div>
                      <div>
                        <h1
                          style={{
                            margin: 0,
                            fontSize: '22px',
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            color: '#0f172a',
                            lineHeight: 1.2,
                          }}
                        >
                          {activeNav.label}
                        </h1>
                        <p
                          style={{
                            margin: '3px 0 0',
                            fontSize: '13px',
                            color: '#64748b',
                            fontWeight: 500,
                          }}
                        >
                          {activeNav.subtitle} across <strong style={{ color: '#334155', fontWeight: 600 }}>{activeBusinessName}</strong>
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '6px 12px',
                          borderRadius: '999px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#334155',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: activeBrandColor,
                          }}
                        />
                        {activeBusinessName}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 12px',
                          borderRadius: '999px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#475569',
                        }}
                      >
                        {overview.todayStr}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNavigate('overview')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '999px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#0f172a',
                          cursor: 'pointer',
                        }}
                      >
                        ← Overview
                      </button>
                    </div>
                  </div>
                )}

                {visitedSections.includes('overview') && (
                  <div style={{ display: activeSection === 'overview' ? 'block' : 'none' }}>
                    <HrOverviewPanel
                      data={overview}
                      activeBrandColor={activeBrandColor}
                      activeTintHex={activeTintHex}
                      activeBusinessName={activeBusinessName}
                      roleLabel={actorRoleUpper}
                      userName={userName}
                      onNavigate={handleNavigate}
                      onSelectSubsidiary={setSelectedSubsidiaryId}
                    />
                  </div>
                )}

                {visitedSections.includes('employees') && (
                  <div style={{ display: activeSection === 'employees' ? 'flex' : 'none', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setEmployeesView('DIRECTORY')}
                        style={{ padding: '7px 14px', borderRadius: '999px', border: `1px solid ${employeesView === 'DIRECTORY' ? activeBrandColor : '#cbd5e1'}`, background: employeesView === 'DIRECTORY' ? activeBrandColor : '#ffffff', color: employeesView === 'DIRECTORY' ? '#ffffff' : '#334155', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        HR Employee Directory &amp; 12-Tab Dossier
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmployeesView('PROFILES')}
                        style={{ padding: '7px 14px', borderRadius: '999px', border: `1px solid ${employeesView === 'PROFILES' ? activeBrandColor : '#cbd5e1'}`, background: employeesView === 'PROFILES' ? activeBrandColor : '#ffffff', color: employeesView === 'PROFILES' ? '#ffffff' : '#334155', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Staff Profiles &amp; Compensation Desk
                      </button>
                    </div>
                    {employeesView === 'DIRECTORY' ? (
                      <HrEmployeesPanel
                        subsidiaries={overview.subsidiaries}
                        selectedSubsidiaryId={selectedSubsidiaryId}
                        initialApprovalFilter={presetFilter}
                        activeBrandColor={activeBrandColor}
                        onRefreshOverview={loadOverview}
                      />
                    ) : (
                      <LiveStaffProfilesModule
                        scope={activeSub?.code || 'ALL'}
                        setNotice={() => {}}
                        onNavigate={(tab) => {
                          if (tab.toLowerCase().includes('attendance')) handleNavigate('attendance');
                          if (tab.toLowerCase().includes('payroll')) handleNavigate('payroll');
                        }}
                      />
                    )}
                  </div>
                )}

                {visitedSections.includes('attendance') && (
                  <div style={{ display: activeSection === 'attendance' ? 'block' : 'none', width: '100%' }}>
                    <AttendanceDeskPage />
                  </div>
                )}

                {visitedSections.includes('leave') && (
                  <div style={{ display: activeSection === 'leave' ? 'block' : 'none' }}>
                    <HrLeavePanel
                      initialStatusFilter={presetFilter}
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                      onRefreshOverview={loadOverview}
                    />
                  </div>
                )}

                {visitedSections.includes('payroll') && (
                  <div style={{ display: activeSection === 'payroll' ? 'block' : 'none' }}>
                    <HrPayrollPanel
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                      businessName={activeBusinessName}
                      userName={userName}
                      businessCode={activeSub?.code}
                    />
                  </div>
                )}

                {visitedSections.includes('performance') && (
                  <div style={{ display: activeSection === 'performance' ? 'block' : 'none' }}>
                    <HrPerformancePanel
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                    />
                  </div>
                )}

                {visitedSections.includes('recruitment') && (
                  <div style={{ display: activeSection === 'recruitment' ? 'block' : 'none' }}>
                    <HrRecruitmentPanel
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                    />
                  </div>
                )}

                {visitedSections.includes('relations') && (
                  <div style={{ display: activeSection === 'relations' ? 'block' : 'none' }}>
                    <HrRelationsPanel
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                    />
                  </div>
                )}

                {visitedSections.includes('requests') && (
                  <div style={{ display: activeSection === 'requests' ? 'block' : 'none' }}>
                    <HrRequestsPanel
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                    />
                  </div>
                )}

                {visitedSections.includes('documents') && (
                  <div style={{ display: activeSection === 'documents' ? 'block' : 'none' }}>
                    <HrDocumentsPanel
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                    />
                  </div>
                )}

                {visitedSections.includes('reports') && (
                  <div style={{ display: activeSection === 'reports' ? 'block' : 'none' }}>
                    <HrReportsPanel
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                    />
                  </div>
                )}

                {visitedSections.includes('configuration') && (
                  <div style={{ display: activeSection === 'configuration' ? 'block' : 'none' }}>
                    <HrConfigPanel
                      selectedSubsidiaryId={selectedSubsidiaryId}
                      activeBrandColor={activeBrandColor}
                    />
                  </div>
                )}
              </div>
            </TabErrorBoundary>
          </div>
        </section>

        {/* GMD-Only BEMi Ambient AI Bar & Edge Glow */}
        {isAiAuthorized && (
          <>
            <AiScreenEdgeGlow isActive={true} isProcessing={aiManager.isTyping} brandColor={activeBrandColor} />
            <AmbientBottomAiBar
              currentPage={`HR · ${activeNav.label}`}
              businessName={activeBusinessName}
              userName={userName}
              userRole={actorRoleUpper}
              messages={aiManager.messages}
              isTyping={aiManager.isTyping}
              isInspectMode={isInspectMode}
              agentMode={aiManager.agentMode}
              onSetAgentMode={aiManager.setAgentMode}
              onToggleInspectMode={() => setIsInspectMode((v) => !v)}
              onSendMessage={aiManager.sendMessage}
              onConfirmAction={aiManager.handleConfirmAction}
              onCancelAction={aiManager.handleCancelAction}
              onNewChat={aiManager.startNewChat}
              onOpenHistory={() => aiManager.setIsHistoryOpen(true)}
              onOpenFullCockpit={() => setAiDrawerOpen(true)}
              onNavigate={(tab) => {
                const match = ALL_NAV_ITEMS.find((i) => i.label.toLowerCase() === tab.toLowerCase());
                if (match) handleNavigate(match.id);
              }}
            />
            <AiChatHistoryDrawer
              isOpen={aiManager.isHistoryOpen}
              onClose={() => aiManager.setIsHistoryOpen(false)}
              sessions={aiManager.sessions}
              activeSessionId={aiManager.activeSessionId}
              onSelectSession={(session) => aiManager.loadSession(session)}
              onNewChat={aiManager.startNewChat}
              onDeleteSession={(id) => aiManager.deleteSession(id)}
            />
            <AiFinancialManagerDrawer
              isOpen={aiDrawerOpen}
              onClose={() => setAiDrawerOpen(false)}
              userRole={actorRoleUpper}
              userName={userName}
              businessId={activeSub?.id || 'BEMS-GROUP'}
              currentPage={`HR · ${activeNav.label}`}
              businessName={activeBusinessName}
              sharedMessages={aiManager.messages}
              sharedIsTyping={aiManager.isTyping}
              onSendMessage={aiManager.sendMessage}
              onConfirmAction={aiManager.handleConfirmAction}
              onCancelAction={aiManager.handleCancelAction}
              onNewChat={aiManager.startNewChat}
            />
          </>
        )}
      </main>
    </UniversalClickToAskProvider>
  );
}
