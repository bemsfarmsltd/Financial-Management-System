'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  FolderKanban,
  Users,
  Video,
  Truck,
  Code2,
  ArrowRight,
  LogOut,
  Bell,
  Search,
  Smartphone,
  Download,
  ExternalLink,
} from 'lucide-react';

export interface EnterpriseUserSummary {
  id: string;
  legalName: string;
  role: string;
  workEmail: string;
  employeeNumber?: string;
  subsidiaryName?: string;
}

export function EnterpriseModulesScreen({ user }: { user: EnterpriseUserSummary }) {
  const [search, setSearch] = useState('');

  const isStaff = user?.role === 'STAFF';

  const modules = [
    {
      id: 'finance',
      title: 'Financial Management System',
      category: 'Financial Management',
      href: isStaff ? '/staff' : '/finance',
      status: 'Active',
      statusType: 'live',
      icon: Wallet,
      accentColor: '#ea580c',
      bgLight: '#fff7ed',
      borderLight: '#fed7aa',
      description: 'Budgeting, fund requisitions, approvals, treasury, disbursements, and expenditure retirement.',
      ctaText: isStaff ? 'Open Staff Workspace' : 'Open Financial System',
    },
    {
      id: 'projects',
      title: 'Project Management System',
      category: 'Project Execution',
      href: '/projects',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: FolderKanban,
      accentColor: '#0284c7',
      bgLight: '#f0f9ff',
      borderLight: '#bae6fd',
      description: 'Project tracking, milestone execution, deliverables, and capital expenditure oversight.',
      ctaText: 'Open Project System',
    },
    {
      id: 'hr',
      title: 'Human Resource Management System',
      category: 'Human Capital',
      href: '/hr',
      status: 'Active',
      statusType: 'active',
      icon: Users,
      accentColor: '#6366f1',
      bgLight: '#eef2ff',
      borderLight: '#c7d2fe',
      description: 'Staff directory, employee records, attendance monitoring, and workplace administration.',
      ctaText: 'Open HR System',
    },
    {
      id: 'operations',
      title: 'Operations Management System',
      category: 'Field Operations',
      href: '/operations',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Truck,
      accentColor: '#059669',
      bgLight: '#ecfdf5',
      borderLight: '#a7f3d0',
      description: 'Field operations coordination, fleet management, logistics tracking, and facility oversight.',
      ctaText: 'Open Operations System',
    },
    {
      id: 'media',
      title: 'Media Management System',
      category: 'Media & Creative',
      href: '/media',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Video,
      accentColor: '#db2777',
      bgLight: '#fdf2f8',
      borderLight: '#fbcfe8',
      description: 'Media production workflows, studio scheduling, creative deliverables, and digital media archives.',
      ctaText: 'Open Media System',
    },
    {
      id: 'innovation',
      title: 'Innovation Management System',
      category: 'Technology & R&D',
      href: '/innovation',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Code2,
      accentColor: '#0891b2',
      bgLight: '#ecfeff',
      borderLight: '#a5f3fc',
      description: 'Proprietary software technologies, digital platforms, system architecture, and technology R&D.',
      ctaText: 'Open Innovation System',
    },
  ];

  const filteredModules = modules.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  };

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
      {/* TOPBAR */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 28px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                padding: '2px',
              }}
            >
              <img
                src="/bems-group-logo.png?v=20261024"
                alt="BEMS logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
              <strong style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>BEMS</strong>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#ea580c' }}>ERP</span>
            </div>
          </div>

          {/* User Session & Quick Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Download App */}
            <Link
              href="/download"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                color: '#ea580c',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Smartphone size={13} color="#ea580c" />
              <span>Download App</span>
            </Link>

            {/* Quick Links */}
            <Link
              href="/notifications"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Bell size={13} color="#ea580c" />
              <span>Notifications</span>
            </Link>

            {isStaff && (
              <Link
                href="/staff"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#c2410c',
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <span>My Workspace</span>
              </Link>
            )}

            {/* User Profile Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '4px 8px 4px 12px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                  {user?.legalName || 'User'}
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
                  {user?.subsidiaryName || 'BEMS Group'} · <span style={{ color: '#ea580c' }}>{user?.role || 'STAFF'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out of BEMS ERP"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#64748b',
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* HERO & SEARCH */}
      <section
        style={{
          maxWidth: '1240px',
          width: '100%',
          margin: '0 auto',
          padding: '44px 24px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 10px',
            }}
          >
            Enterprise Management Systems
          </h1>
          <p style={{ fontSize: '14.5px', color: '#64748b', margin: '0 0 28px' }}>
            Select an operational management system to continue in BEMS ERP
          </p>

          {/* Search Box */}
          <div style={{ position: 'relative', maxWidth: '420px', margin: '0 auto' }}>
            <input
              type="text"
              placeholder="Search management systems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 16px 11px 40px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '13px',
                color: '#0f172a',
                outline: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                boxSizing: 'border-box',
              }}
            />
            <Search
              size={16}
              color="#94a3b8"
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
          </div>
        </div>
      </section>

      {/* MODULES GRID */}
      <main
        style={{
          maxWidth: '1240px',
          width: '100%',
          margin: '0 auto',
          padding: '12px 24px 60px',
          boxSizing: 'border-box',
          flex: 1,
        }}
      >
        {/* MOBILE APP PROMPT BANNER */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
            border: '1.5px solid #fed7aa',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            boxShadow: '0 4px 16px -2px rgba(234, 88, 12, 0.08)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '680px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: '#ea580c',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
              }}
            >
              <Smartphone size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Download BEMS Mobile App (Android APK)
                </strong>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  Direct APK Available
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.45 }}>
                Get the native Android app for faster fund requisitions, personal wallet tracking, biometric clock-in, and instant push notifications.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href={user?.role === 'GMD' ? '/download/gmd-app.apk' : '/download/staff-app.apk'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                borderRadius: '10px',
                background: '#ea580c',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
              }}
            >
              <Download size={14} />
              <span>{user?.role === 'GMD' ? 'Download GMD Cockpit (APK)' : 'Download Staff App (APK)'}</span>
            </a>
            <Link
              href="/download"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <span>Download Center</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredModules.map((m) => {
            const Icon = m.icon;
            const isLive = m.statusType === 'live';

            return (
              <div
                key={m.id}
                style={{
                  background: '#ffffff',
                  border: isLive ? `1.5px solid ${m.borderLight}` : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isLive ? '0 4px 16px -2px rgba(234, 88, 12, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  {/* Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: m.bgLight,
                        color: m.accentColor,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon size={22} />
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: isLive ? '#ecfdf5' : '#f1f5f9',
                        color: isLive ? '#059669' : '#64748b',
                        border: isLive ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                      }}
                    >
                      {m.status}
                    </span>
                  </div>

                  {/* Title & Desc */}
                  <h2
                    style={{
                      fontSize: '16.5px',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '0 0 8px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {m.title}
                  </h2>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#64748b',
                      lineHeight: 1.5,
                      margin: '0 0 20px',
                    }}
                  >
                    {m.description}
                  </p>
                </div>

                {/* Card CTA */}
                <Link
                  href={m.href}
                  onClick={() => {
                    if (m.id === 'finance') {
                      try {
                        sessionStorage.setItem('bems_show_welcome', '1');
                        sessionStorage.setItem('bems_entry_mode', 'login');
                        sessionStorage.removeItem('bems_welcome_shown_session');
                      } catch {}
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: m.accentColor,
                    textDecoration: 'none',
                    paddingTop: '14px',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <span>{m.ctaText}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      </main>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
          padding: '20px 24px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#94a3b8',
        }}
      >
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>© 2026 BEMS Group. All rights reserved.</span>
          <span style={{ fontWeight: 600 }}>Conglomerate Enterprise Architecture</span>
        </div>
      </footer>
    </div>
  );
}
