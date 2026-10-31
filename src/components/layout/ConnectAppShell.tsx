'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type SystemRole = 'GMD' | 'SystemAdmin' | 'Staff';

interface RoleProfile {
  role: SystemRole;
  title: string;
  badge: string;
  platform: string;
  avatarColor: string;
}

export const roleProfiles: Record<SystemRole, RoleProfile> = {
  GMD: { role: 'GMD', title: 'The Group Managing Director', badge: 'Executive Governance', platform: 'Web (Full) & Mobile', avatarColor: '#ea580c' },
  SystemAdmin: { role: 'SystemAdmin', title: 'Super admin', badge: 'Workspace Control', platform: 'Web Dashboard', avatarColor: '#0f172a' },
  Staff: { role: 'Staff', title: 'Staff', badge: 'Staff Operations', platform: 'Mobile App View', avatarColor: '#a76400' },
};

interface Subsidiary {
  id: string;
  name: string;
  code: string;
  industry: string;
  initials: string;
  color: string;
  status: string;
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  linkUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}

const defaultSubsidiaries: Subsidiary[] = [
  { id: 'bems-group-hq', name: 'BEMS Group', code: 'BEMS-GROUP', industry: 'Conglomerate & Holding HQ', initials: 'BG', color: '#0b1220', status: 'Live' },
];

export function ConnectAppShell({ children, initialRole }: { children: React.ReactNode; initialRole?: SystemRole }) {
  const pathname = usePathname();
  const [currentRole, setCurrentRole] = useState<SystemRole>(() => {
    if (initialRole) return initialRole;
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/staff')) return 'Staff';
    return 'GMD';
  });
  const [collapsed, setCollapsed] = useState(false);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>(defaultSubsidiaries);
  const [currentSubId, setCurrentSubId] = useState('bems-group-hq');
  const [subSwitcherOpen, setSubSwitcherOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubIndustry, setNewSubIndustry] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentSub = subsidiaries.find(s => s.id === currentSubId) || subsidiaries[0];

  useEffect(() => {
    if (!initialRole) {
      fetch('/api/auth/session')
        .then(r => r.json())
        .then(d => {
          if (d?.user?.role) {
            const r = d.user.role;
            if (r === 'STAFF') setCurrentRole('Staff');
            else if (r === 'SYSTEM_ADMIN' || r === 'SUPER_ADMIN') setCurrentRole('SystemAdmin');
            else if (r === 'GMD') setCurrentRole('GMD');
            else setCurrentRole('Staff');
          }
        })
        .catch(() => {});
    }

    fetch('/api/organizations')
      .then(r => r.json())
      .then(d => {
        if (d && d.organizations && d.organizations.length > 0) {
          setSubsidiaries(d.organizations);
          setCurrentSubId(d.organizations[0].id);
        } else {
          setSubsidiaries(defaultSubsidiaries);
          setCurrentSubId('bems-group-hq');
        }
      })
      .catch(() => {});
  }, [initialRole]);

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* notifications are optional while signed out */ }
  };

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const markNotificationRead = async (notificationId: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    await loadNotifications();
  };

  const markAllNotificationsRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    await loadNotifications();
  };

  const handleCreateSubsidiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName) return;
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubName, industry: newSubIndustry || 'Enterprise Technology' }),
      });
      const data = await res.json();
      if (data && data.organization) {
        setSubsidiaries(prev => [...prev, data.organization]);
        setCurrentSubId(data.organization.id);
        setAddModalOpen(false);
        setNewSubName('');
        setNewSubIndustry('');
      }
    } catch (err) {
      alert('Could not create subsidiary');
    }
  };

  const gmdNav = [
    {
      label: 'EXECUTIVE',
      items: [
        ['Finance Overview', '/finance', '⌂'],
        ['Subsidiary portfolio', '/finance?tab=Subsidiary+portfolio', '▦'],
        ['Executive briefing', '/briefing', '✦'],
      ]
    },
    {
      label: 'FUND FLOW',
      items: [
        ['Fund requests', '/requests', '▱'],
        ['Approvals & payments', '/approvals', '✓'],
        ['Budgets & commitments', '/budgets', '◫'],
        ['Treasury accounts', '/finance?tab=Treasury+accounts', '🏦'],
        ['Recurring commitments', '/finance?tab=Recurring+commitments', '◌'],
        ['Hybrid payroll', '/payroll', '⌁'],
        ['Intercompany notes', '/intercompany', '▥'],
        ['Request channels', '/finance?tab=Request+channels', '◎'],
      ]
    },
    {
      label: 'PEOPLE & REPORTS',
      items: [
        ['Staff profiles', '/finance?tab=Staff+profiles', '👥'],
        ['Staff onboarding', '/finance?tab=Staff+onboarding', '✓'],
        ['Audit logs', '/audit', '≡'],
        ['Settings', '/finance?tab=Settings', '⚙'],
      ]
    },
  ];

  const sysAdminNav = [
    {
      label: 'EXECUTIVE',
      items: [
        ['Finance Overview', '/finance', '⌂'],
        ['Subsidiary portfolio', '/finance?tab=Subsidiary+portfolio', '▦'],
        ['Executive briefing', '/briefing', '✦'],
      ]
    },
    {
      label: 'FUND FLOW',
      items: [
        ['Fund requests', '/requests', '▱'],
        ['Approvals & payments', '/approvals', '✓'],
        ['Budgets & commitments', '/budgets', '◫'],
        ['Treasury accounts', '/finance?tab=Treasury+accounts', '🏦'],
        ['Recurring commitments', '/finance?tab=Recurring+commitments', '◌'],
        ['Hybrid payroll', '/payroll', '⌁'],
        ['Intercompany notes', '/intercompany', '▥'],
        ['Vendors & suppliers', '/vendors', '▦'],
      ]
    },
    {
      label: 'ADMINISTRATION & PEOPLE',
      items: [
        ['Staff profiles', '/finance?tab=Staff+profiles', '👥'],
        ['Staff onboarding', '/finance?tab=Staff+onboarding', '✓'],
        ['Audit logs', '/audit', '≡'],
        ['Settings', '/finance?tab=Settings', '⚙'],
      ]
    },
  ];


  const staffNav = [
    {
      label: 'MY WORKSPACE',
      items: [
        ['Staff Dashboard', '/staff', '⌂'],
        ['My Attendance', '/staff?tab=attendance', '⏱'],
        ['My Fund Requests', '/requests', '▱'],
        ['Submit New Request', '/requests/new', '＋'],
        ['72h Evidence Vault', '/accountability', '◈'],
      ],
    },
  ];

  const isExecutiveAdmin = currentRole === 'GMD' || currentRole === 'SystemAdmin';
  const navGroups = currentRole === 'GMD' ? gmdNav : currentRole === 'SystemAdmin' ? sysAdminNav : staffNav;

  return (
    <main className={`app-shell ${currentRole === 'Staff' ? 'staff-view' : 'gmd-view'} ${collapsed ? 'collapsed' : ''}`}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-circuit" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
        <div className="side-brand">
          <img src="/bems-group-logo.png?v=20261024" alt="BEMS Logo" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
          <div className="brand-title-wrap" style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: '6px', whiteSpace: 'nowrap' }}>
            <span className="brand-name" style={{ display: 'inline-block', fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 850, letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1 }}>BEMS</span>
            <span className="brand-sub" style={{ display: 'inline-block', fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif", fontSize: '15px', fontWeight: 800, letterSpacing: '0.04em', color: '#f97316', lineHeight: 1 }}>GROUP</span>
          </div>
          <button aria-label="Toggle navigation" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* RETURN TO ERP GATEWAY */}
        <div style={{ padding: '4px 16px 12px' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '11px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <span>←</span>
            <span>ERP Suite Gateway</span>
          </Link>
        </div>

        <nav aria-label="Product navigation">
          {navGroups.map(group => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([name, url, icon]) => {
                const isActive = pathname === url || (url.startsWith('/finance?tab=') && pathname === '/finance' && typeof window !== 'undefined' && window.location.search.includes(url.replace('/finance?tab=', ''))) || (url === '/finance' && pathname === '/finance' && typeof window !== 'undefined' && (!window.location.search || window.location.search === '?org=ALL' || window.location.search === ''));
                return (
                  <Link
                    href={url}
                    key={name}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    title={name}
                  >
                    <span>{icon}</span>
                    <b>{name}</b>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <button className="help-button" onClick={() => alert('BEMS Group Internal Help & Governance desk.')}>
          <span>?</span>
          <div>
            <strong>Need help?</strong>
            <small>Expenditure SOP & Rules</small>
          </div>
        </button>
      </aside>

      {/* MAIN WORKSPACE CONTENT */}
      <section className="workspace">
        {/* TOPBAR */}
        <header className="topbar">
          {/* SUBSIDIARY SWITCHER */}
          <div className="business-switch-wrap">
            <button
              className="business-switch"
              onClick={() => setSubSwitcherOpen(!subSwitcherOpen)}
            >
              <span style={{ background: currentSub.color }}>{currentSub.initials}</span>
              <div>
                <strong>{currentSub.name}</strong>
                <small>{currentSub.industry}</small>
              </div>
              <b>⌄</b>
            </button>
            {subSwitcherOpen && (
              <div className="switch-menu">
                <p>SWITCH SUBSIDIARY WORKSPACE</p>
                {subsidiaries.map(s => (
                  <button
                    className={s.id === currentSub.id ? 'selected' : ''}
                    key={s.id}
                    onClick={() => { setCurrentSubId(s.id); setSubSwitcherOpen(false); }}
                  >
                    <span style={{ background: s.color }}>{s.initials}</span>
                    <div>
                      <strong>{s.name}</strong>
                      <small>{s.industry} · {s.status}</small>
                    </div>
                    {s.id === currentSub.id && <b>✓</b>}
                  </button>
                ))}
                {isExecutiveAdmin && (
                  <button
                    className="switch-add"
                    onClick={() => { setSubSwitcherOpen(false); setAddModalOpen(true); }}
                  >
                    ＋ Create New Subsidiary
                  </button>
                )}
              </div>
            )}
          </div>

          {/* GLOBAL SEARCH */}
          <div className="global-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${currentSub.name} requests, transfers...`}
            />
            <kbd>⌘ K</kbd>
          </div>

          {/* TOP ACTIONS */}
          <div className="top-actions">
            {currentRole === 'Staff' && (
              <Link href="/requests/new" className="top-action-btn" style={{ textDecoration: 'none' }}>
                <span className="btn-icon">📁</span>
                <div className="btn-text">
                  <strong>Fund Request Desk</strong>
                  <small>New Request +</small>
                </div>
              </Link>
            )}

            <div className="top-popover-wrap">
              <button className="top-icon-btn" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(value => !value); loadNotifications(); }}>
                {unreadCount > 0 && <span className="notification-dot" />}
                🔔
              </button>
              {notificationsOpen && (
                <div className="top-popover notifications-panel" role="dialog" aria-label="Notifications">
                  <header>
                    <strong>Notifications{unreadCount ? ` · ${unreadCount} unread` : ''}</strong>
                    {unreadCount > 0 && <button type="button" onClick={markAllNotificationsRead}>Mark all read</button>}
                  </header>
                  {notifications.length === 0 ? (
                    <p className="notification-empty">You’re all caught up.</p>
                  ) : notifications.map(notification => (
                    <Link
                      href={notification.linkUrl || '/'}
                      key={notification.id}
                      className={`notification-item${notification.readAt ? ' read' : ''}`}
                      onClick={() => { setNotificationsOpen(false); if (!notification.readAt) void markNotificationRead(notification.id); }}
                    >
                      <span aria-hidden="true">{notification.readAt ? '•' : '!'}</span>
                      <div><strong>{notification.title}</strong><small>{notification.body}</small></div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <div className="avatar" title="Account Menu">HN</div>
              </button>
              {profileOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '46px',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    minWidth: '200px',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                    zIndex: 1000,
                  }}
                >
                  <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>Account Session</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Role: {currentRole}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof document !== 'undefined') {
                        document.cookie = 'bems_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
                      }
                      try {
                        await fetch('/api/auth/logout', { method: 'POST' });
                      } catch {}
                      if (typeof window !== 'undefined') window.location.replace('/');
                    }}
                    style={{
                      width: '100%',
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    Sign Out ⎋
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* BODY CONTENT */}
        <div className="content">
          {children}
        </div>
      </section>

      {/* ADD SUBSIDIARY MODAL */}
      {addModalOpen && (
        <div className="template-modal" role="dialog" aria-modal="true">
          <div className="template-modal-card">
            <button className="modal-close" onClick={() => setAddModalOpen(false)}>×</button>
            <div className="modal-title">
              <span>▦</span>
              <div>
                <p className="kicker">BEMS GROUP HOLDINGS</p>
                <h2>Create New Subsidiary</h2>
                <small>Multi-tenant isolated workspace for finance, payroll & accountability</small>
              </div>
            </div>
            <form onSubmit={handleCreateSubsidiary}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                <label className="import-name">
                  Subsidiary Legal Name
                  <input
                    required
                    placeholder="e.g. Bems Energy & Infrastructure Ltd"
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                  />
                </label>
                <label className="import-name">
                  Industry / Business Line
                  <input
                    placeholder="e.g. Power, Mining, Software, Agriculture"
                    value={newSubIndustry}
                    onChange={e => setNewSubIndustry(e.target.value)}
                  />
                </label>
              </div>
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button">Create Workspace →</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE STAFF BOTTOM NAVIGATION */}
      {currentRole === 'Staff' && (
        <nav className="mobile-staff-bottom-bar" aria-label="Staff Mobile Navigation">
          <Link
            href="/staff"
            className={`bottom-nav-link ${pathname === '/staff' && typeof window !== 'undefined' && !window.location.search.includes('tab=attendance') ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">⌂</span>
            <span className="bottom-nav-label">Home</span>
          </Link>
          <Link
            href="/staff?tab=attendance"
            className={`bottom-nav-link ${pathname === '/staff' && typeof window !== 'undefined' && window.location.search.includes('tab=attendance') ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">⏱</span>
            <span className="bottom-nav-label">Attendance</span>
          </Link>
          <Link
            href="/requests/new"
            className="bottom-nav-link bottom-nav-action-highlight"
          >
            <span className="bottom-nav-action-circle">＋</span>
            <span className="bottom-nav-label">New Req</span>
          </Link>
          <Link
            href="/requests"
            className={`bottom-nav-link ${pathname.startsWith('/requests') && pathname !== '/requests/new' ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">▱</span>
            <span className="bottom-nav-label">Requests</span>
          </Link>
          <Link
            href="/accountability"
            className={`bottom-nav-link ${pathname.startsWith('/accountability') ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">◈</span>
            <span className="bottom-nav-label">72h Vault</span>
          </Link>
        </nav>
      )}
    </main>
  );
}
