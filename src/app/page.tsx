'use client';

import React from 'react';
import Link from 'next/link';
import {
  Wallet,
  Truck,
  Sprout,
  Factory,
  ShoppingBag,
  Package,
  Briefcase,
  Users,
  Wrench,
  Scale,
  ShieldCheck,
  Code2,
  ArrowRight,
} from 'lucide-react';

export default function EnterpriseModulesScreen() {
  const modules = [
    {
      id: 'finance',
      title: 'Finance & Treasury',
      href: '/finance',
      status: 'Active',
      statusType: 'live',
      icon: Wallet,
      accentColor: '#ea580c',
      bgLight: '#fff7ed',
      borderLight: '#fed7aa',
      ctaText: 'Open Finance',
    },
    {
      id: 'operations',
      title: 'Operations & Fleet',
      href: '/operations',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Truck,
      accentColor: '#059669',
      bgLight: '#ecfdf5',
      borderLight: '#a7f3d0',
      ctaText: 'Open Operations',
    },
    {
      id: 'attendance',
      title: 'Attendance & Timekeeping',
      href: '/attendance',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Users,
      accentColor: '#16a34a',
      bgLight: '#f0fdf4',
      borderLight: '#bbf7d0',
      ctaText: 'Open Attendance',
    },
    {
      id: 'production',
      title: 'Processing & Production',
      href: '/production',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Factory,
      accentColor: '#e11d48',
      bgLight: '#fff1f2',
      borderLight: '#fecdd3',
      ctaText: 'Open Production',
    },
    {
      id: 'procurement',
      title: 'Procurement & Vendors',
      href: '/procurement',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: ShoppingBag,
      accentColor: '#d97706',
      bgLight: '#fffbeb',
      borderLight: '#fde68a',
      ctaText: 'Open Procurement',
    },
    {
      id: 'inventory',
      title: 'Inventory & Warehouse',
      href: '/inventory',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Package,
      accentColor: '#0d9488',
      bgLight: '#f0fdfa',
      borderLight: '#99f6e4',
      ctaText: 'Open Inventory',
    },
    {
      id: 'sales',
      title: 'Sales & Commercial CRM',
      href: '/sales',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Briefcase,
      accentColor: '#2563eb',
      bgLight: '#eff6ff',
      borderLight: '#bfdbfe',
      ctaText: 'Open Sales',
    },
    {
      id: 'hr',
      title: 'Human Resources',
      href: '/hr',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Users,
      accentColor: '#7c3aed',
      bgLight: '#faf5ff',
      borderLight: '#e9d5ff',
      ctaText: 'Open HR',
    },
    {
      id: 'assets',
      title: 'Asset & Facilities (EAM)',
      href: '/assets',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Wrench,
      accentColor: '#475569',
      bgLight: '#f8fafc',
      borderLight: '#cbd5e1',
      ctaText: 'Open Assets',
    },
    {
      id: 'legal',
      title: 'Legal & Compliance',
      href: '/legal',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Scale,
      accentColor: '#4f46e5',
      bgLight: '#eef2ff',
      borderLight: '#c7d2fe',
      ctaText: 'Open Legal',
    },
    {
      id: 'risk-audit',
      title: 'Audit & Risk Assurance',
      href: '/risk-audit',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: ShieldCheck,
      accentColor: '#dc2626',
      bgLight: '#fef2f2',
      borderLight: '#fecaca',
      ctaText: 'Open Audit',
    },
    {
      id: 'innovation',
      title: 'Innovation & Tech',
      href: '/innovation',
      status: 'Coming Soon',
      statusType: 'pipeline',
      icon: Code2,
      accentColor: '#0284c7',
      bgLight: '#f0f9ff',
      borderLight: '#bae6fd',
      ctaText: 'Open Innovation',
    },
  ];

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
          padding: '16px 28px',
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

          <Link
            href="/finance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#ea580c',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <span>Finance Desk</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* MODULE CARDS */}
      <main
        style={{
          flex: 1,
          maxWidth: '1240px',
          margin: '0 auto',
          width: '100%',
          padding: '40px 24px 60px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 8px',
            }}
          >
            Select a Department
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>
            Choose an operational system to continue
          </p>
        </div>

        {/* 12 CLEAN CARDS IN BALANCED GRID */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '18px',
            width: '100%',
          }}
        >
          {modules.map((m) => {
            const Icon = m.icon;
            const isLive = m.statusType === 'live';

            return (
              <Link
                key={m.id}
                href={m.href}
                style={{
                  background: '#ffffff',
                  border: isLive ? `2px solid ${m.accentColor}` : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '22px 20px',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  minHeight: '175px',
                  boxShadow: isLive ? '0 10px 25px -4px rgba(234, 88, 12, 0.15)' : '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{ width: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: m.bgLight,
                        border: `1px solid ${m.borderLight}`,
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
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isLive ? '#dcfce7' : '#f1f5f9',
                        color: isLive ? '#15803d' : '#64748b',
                      }}
                    >
                      {m.status}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: 0,
                    }}
                  >
                    {m.title}
                  </h3>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isLive ? m.accentColor : '#64748b',
                    marginTop: '18px',
                  }}
                >
                  <span>{m.ctaText}</span>
                  <ArrowRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#94a3b8',
        }}
      >
        © 2026 BEMS Group Holdings Limited · Enterprise Resource Planning
      </footer>
    </div>
  );
}
