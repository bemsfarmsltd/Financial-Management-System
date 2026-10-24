'use client';

import React from 'react';
import Link from 'next/link';
import { Wallet, Truck, Code2, Users, ArrowRight } from 'lucide-react';

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
      isPrimary: true,
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
      isPrimary: false,
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
      isPrimary: false,
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
      isPrimary: false,
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
            maxWidth: '1100px',
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
          maxWidth: '1100px',
          margin: '0 auto',
          width: '100%',
          padding: '60px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
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

        {/* 4 CLEAN CARDS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
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
                  padding: '28px 24px',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  minHeight: '200px',
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
                      marginBottom: '20px',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: m.bgLight,
                        border: `1px solid ${m.borderLight}`,
                        color: m.accentColor,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon size={24} />
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
                      fontSize: '18px',
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
                    marginTop: '24px',
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
        © 2026 BEMS Group Holdings Limited
      </footer>
    </div>
  );
}
