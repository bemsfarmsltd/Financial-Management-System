'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  FolderKanban,
  Users,
  Video,
  Truck,
  ShoppingBag,
  Package,
  Factory,
  Sprout,
  Briefcase,
  Wrench,
  Scale,
  ShieldCheck,
  Code2,
  ArrowRight,
  LogOut,
  Bell,
  Search,
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

  const modules = [
    {
      id: 'finance',
      title: 'Finance & Treasury',
      category: 'Financial Management',
      href: '/finance',
      status: 'Active',
      statusType: 'live',
      icon: Wallet,
      accentColor: '#ea580c',
      bgLight: '#fff7ed',
      borderLight: '#fed7aa',
      description: 'Fund requisitions, 72h advance retirements, wallet disbursements, GMD releases, and treasury accounts.',
      ctaText: 'Open Finance Desk',
    },
    {
      id: 'projects',
      title: 'Projects & Capital Works',
      category: 'Capital Execution',
      href: '/projects',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: FolderKanban,
      accentColor: '#0284c7',
      bgLight: '#f0f9ff',
      borderLight: '#bae6fd',
      description: 'Project portfolios, field progress, milestone deliverables, project budgets & closeout accounting.',
      ctaText: 'Open Projects Hub',
    },
    {
      id: 'hr',
      title: 'Human Resources & People',
      category: 'Human Capital',
      href: '/hr',
      status: 'Active',
      statusType: 'live',
      icon: Users,
      accentColor: '#6366f1',
      bgLight: '#eef2ff',
      borderLight: '#c7d2fe',
      description: 'Staff directory, payroll sign-offs, attendance clock-ins, leave administration, and dispute resolution.',
      ctaText: 'Open HR Portal',
    },
    {
      id: 'media',
      title: 'Media & Creative Studio',
      category: 'Media Subsidiary',
      href: '/media',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Video,
      accentColor: '#db2777',
      bgLight: '#fdf2f8',
      borderLight: '#fbcfe8',
      description: 'Content production, shoot schedules, creative digital asset library, and advertising campaigns.',
      ctaText: 'Open Media Studio',
    },
    {
      id: 'operations',
      title: 'Operations & Fleet',
      category: 'Field Operations',
      href: '/operations',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Truck,
      accentColor: '#059669',
      bgLight: '#ecfdf5',
      borderLight: '#a7f3d0',
      description: 'Daily operational shift logs, logistics transit, vehicle fleet tracking, and fuel accountability.',
      ctaText: 'Open Operations',
    },
    {
      id: 'procurement',
      title: 'Procurement & Vendors',
      category: 'Supply Chain',
      href: '/procurement',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: ShoppingBag,
      accentColor: '#d97706',
      bgLight: '#fffbeb',
      borderLight: '#fde68a',
      description: 'Accredited supplier registry, purchase orders (PO), goods intake (GRN), and 3-way matching.',
      ctaText: 'Open Procurement',
    },
    {
      id: 'inventory',
      title: 'Inventory & Warehouse',
      category: 'Supply Chain',
      href: '/inventory',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Package,
      accentColor: '#0d9488',
      bgLight: '#f0fdfa',
      borderLight: '#99f6e4',
      description: 'Multi-location store levels, material requisitions, stock counts, and minimum threshold alerts.',
      ctaText: 'Open Inventory',
    },
    {
      id: 'production',
      title: 'Processing & Production',
      category: 'Manufacturing',
      href: '/production',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Factory,
      accentColor: '#e11d48',
      bgLight: '#fff1f2',
      borderLight: '#fecdd3',
      description: 'Agro-processing operations, feed mill batching, packaging lines, and quality control metrics.',
      ctaText: 'Open Production',
    },
    {
      id: 'agribusiness',
      title: 'Agribusiness & Farm Management',
      category: 'Agriculture',
      href: '/agribusiness',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Sprout,
      accentColor: '#16a34a',
      bgLight: '#f0fdf4',
      borderLight: '#bbf7d0',
      description: 'Crop planting cycles, livestock & poultry monitoring, field inputs, and harvest yield records.',
      ctaText: 'Open Agribusiness',
    },
    {
      id: 'sales',
      title: 'Sales & Commercial CRM',
      category: 'Commercial',
      href: '/sales',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Briefcase,
      accentColor: '#2563eb',
      bgLight: '#eff6ff',
      borderLight: '#bfdbfe',
      description: 'Client registries, commercial sales orders, corporate invoices, and distributor dispatch.',
      ctaText: 'Open Sales & CRM',
    },
    {
      id: 'assets',
      title: 'Asset & Facilities (EAM)',
      category: 'Facilities',
      href: '/assets',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Wrench,
      accentColor: '#475569',
      bgLight: '#f8fafc',
      borderLight: '#cbd5e1',
      description: 'Fixed asset registers, machinery servicing work orders, facility upkeep, and depreciation logs.',
      ctaText: 'Open Assets Hub',
    },
    {
      id: 'legal',
      title: 'Legal & Compliance',
      category: 'Governance',
      href: '/legal',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Scale,
      accentColor: '#4f46e5',
      bgLight: '#eef2ff',
      borderLight: '#c7d2fe',
      description: 'Statutory filings, corporate contracts repository, regulatory licensing, and governance resolutions.',
      ctaText: 'Open Legal Hub',
    },
    {
      id: 'risk-audit',
      title: 'Audit & Risk Assurance',
      category: 'Assurance',
      href: '/risk-audit',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: ShieldCheck,
      accentColor: '#dc2626',
      bgLight: '#fef2f2',
      borderLight: '#fecaca',
      description: 'Pre-payment audit sampling, internal policy compliance, risk registries, and audit logs.',
      ctaText: 'Open Audit Desk',
    },
    {
      id: 'innovation',
      title: 'Innovation & Technology',
      category: 'Technology',
      href: '/innovation',
      status: 'Pipeline',
      statusType: 'pipeline',
      icon: Code2,
      accentColor: '#0284c7',
      bgLight: '#f0f9ff',
      borderLight: '#bae6fd',
      description: 'ERP configuration, mobile build distribution, notification bridges, and API infrastructure.',
      ctaText: 'Open Innovation Desk',
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

            {user?.role === 'STAFF' && (
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
          padding: '36px 24px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '30px',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 8px',
            }}
          >
            Select a Department
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px' }}>
            Choose an operational system to continue in BEMS Enterprise Suite
          </p>

          {/* Search Box */}
          <div style={{ position: 'relative', maxWidth: '420px', margin: '0 auto' }}>
            <input
              type="text"
              placeholder="Search enterprise modules or departments..."
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: '16px',
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
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isLive ? '0 4px 12px -2px rgba(234, 88, 12, 0.06)' : '0 1px 3px rgba(0,0,0,0.02)',
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
                      marginBottom: '14px',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: m.bgLight,
                        color: m.accentColor,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon size={20} />
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 8px',
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
                      fontSize: '15.5px',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '0 0 6px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {m.title}
                  </h2>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
                      lineHeight: 1.45,
                      margin: '0 0 16px',
                    }}
                  >
                    {m.description}
                  </p>
                </div>

                {/* Card CTA */}
                <Link
                  href={m.href}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: m.accentColor,
                    textDecoration: 'none',
                    paddingTop: '10px',
                    borderTop: '1px solid #f8fafc',
                  }}
                >
                  <span>{m.ctaText}</span>
                  <ArrowRight size={13} />
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

