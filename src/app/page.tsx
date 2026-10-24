'use client';

import React from 'react';
import Link from 'next/link';
import {
  Wallet,
  Truck,
  Code2,
  Users,
  ArrowRight,
  ShieldCheck,
  Building2,
  ChevronRight,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export default function EnterpriseModulesScreen() {
  const modules = [
    {
      id: 'finance',
      title: 'Finance & Treasury',
      eyebrow: 'EXPENDITURE & ACCOUNTABILITY',
      href: '/finance',
      status: 'Live & Operational',
      statusType: 'live',
      icon: Wallet,
      accentColor: '#ea580c',
      bgLight: '#fff7ed',
      borderLight: '#fed7aa',
      description:
        'Multi-subsidiary expenditure requisitions, tiered approval matrix, bank transfer disbursements, 72-hour receipt retiral, and automated intercompany billing notes.',
      capabilities: [
        '5-tier expenditure approval routing',
        'Maker-checker bank transfer records',
        '72-hour receipt retiral compliance',
        'Intercompany debit & credit notes',
      ],
      ctaText: 'Access Finance Module',
      isPrimary: true,
    },
    {
      id: 'operations',
      title: 'Operations & Fleet',
      eyebrow: 'LOGISTICS & AGRIBUSINESS',
      href: '/operations',
      status: 'Phase 2 · In Pipeline',
      statusType: 'pipeline',
      icon: Truck,
      accentColor: '#059669',
      bgLight: '#ecfdf5',
      borderLight: '#a7f3d0',
      description:
        'Produce transit telemetry, waybill clearing, bulk diesel replenishment, electronic pump meter reconciliation, and cold-chain warehouse intake for Bems Logistics & Farms.',
      capabilities: [
        'Vehicle route tracking & delivery manifests',
        'Bulk diesel tank float & pump logs',
        'Warehouse intake & cold storage monitoring',
        'Fleet maintenance & generator service logs',
      ],
      ctaText: 'View Operations Portal',
      isPrimary: false,
    },
    {
      id: 'innovation',
      title: 'Innovation & Cloud Tech',
      eyebrow: 'SOFTWARE & R&D',
      href: '/innovation',
      status: 'Phase 3 · In Pipeline',
      statusType: 'pipeline',
      icon: Code2,
      accentColor: '#0284c7',
      bgLight: '#f0f9ff',
      borderLight: '#bae6fd',
      description:
        'Enterprise software delivery repositories, Hostinger cloud infrastructure orchestration, webhook notification bridges, and AI automation for BemsSoft Hub.',
      capabilities: [
        'Hostinger server telemetry & deployments',
        'Autonomous ledger intelligence (BEMi)',
        'WhatsApp & Slack webhook bridges',
        'Software client delivery licenses & SLAs',
      ],
      ctaText: 'View Innovation Portal',
      isPrimary: false,
    },
    {
      id: 'hr',
      title: 'Human Capital & HR',
      eyebrow: 'PEOPLE & TALENT',
      href: '/hr',
      status: 'Phase 4 · In Pipeline',
      statusType: 'pipeline',
      icon: Users,
      accentColor: '#7c3aed',
      bgLight: '#faf5ff',
      borderLight: '#e9d5ff',
      description:
        'Group-wide employee directory, self-service onboarding, employment contracts, payroll attendance records, and inter-entity cost-sharing agreements.',
      capabilities: [
        'Central staff registry & credentials',
        'Self-service onboarding & BVN validation',
        'Leave tracking & supervisor approvals',
        'Shared payroll allocation rules',
      ],
      ctaText: 'View HR Portal',
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
      {/* CLEAN CORPORATE TOPBAR */}
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
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* BRAND */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                overflow: 'hidden',
                padding: '2px',
              }}
            >
              <img
                src="/bems-group-logo.png?v=20261024"
                alt="BEMS Group Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <strong style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  BEMS
                </strong>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#ea580c', letterSpacing: '0.02em' }}>
                  GROUP
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                Enterprise Resource Planning (ERP)
              </p>
            </div>
          </div>

          {/* RIGHT ACTION */}
          <Link
            href="/finance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
            }}
          >
            <Wallet size={15} />
            <span>Finance Login & Portal →</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '40px 24px 60px' }}>
        {/* HERO TITLE SECTION */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#c2410c',
              fontSize: '12px',
              fontWeight: 800,
              marginBottom: '14px',
            }}
          >
            <Layers size={13} />
            <span>CENTRAL ERP DEPARTMENT DIRECTORY</span>
          </div>
          <h1
            style={{
              fontSize: '36px',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              margin: '0 0 14px',
              lineHeight: 1.2,
            }}
          >
            BEMS Group Enterprise Modules
          </h1>
          <p style={{ fontSize: '16px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Unified corporate operations for BEMS Group Holdings Ltd. Select a department module
            below to proceed into its dedicated system.
          </p>
        </div>

        {/* SUBSIDIARY BANNER STRIP */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '36px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
            Operating Entities:
          </span>
          {[
            { name: 'BEMS Group Holdings Ltd (HQ)', code: 'BEMS-GROUP', color: '#ea580c' },
            { name: 'BemsSoft Hub Ltd', code: 'BEMS-SOFT', color: '#0284c7' },
            { name: 'Bems Logistics & Farms Ltd', code: 'BEMS-LOG', color: '#059669' },
          ].map((sub) => (
            <div
              key={sub.code}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: sub.color,
                }}
              />
              <strong>{sub.name}</strong>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>({sub.code})</span>
            </div>
          ))}
        </div>

        {/* MODULE CARDS GRID */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {modules.map((m) => {
            const Icon = m.icon;
            const isLive = m.statusType === 'live';

            return (
              <div
                key={m.id}
                style={{
                  background: '#ffffff',
                  border: isLive ? `2px solid ${m.accentColor}` : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isLive
                    ? `0 12px 28px -4px ${m.accentColor}25`
                    : '0 2px 8px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  {/* CARD TOP */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
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
                        fontWeight: 800,
                        letterSpacing: '0.03em',
                        padding: '4px 9px',
                        borderRadius: '6px',
                        background: isLive ? '#dcfce7' : '#f1f5f9',
                        color: isLive ? '#15803d' : '#64748b',
                        border: isLive ? '1px solid #86efac' : '1px solid #e2e8f0',
                      }}
                    >
                      {m.status}
                    </span>
                  </div>

                  <span
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: m.accentColor,
                      letterSpacing: '0.05em',
                      marginBottom: '4px',
                    }}
                  >
                    {m.eyebrow}
                  </span>

                  <h3
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '0 0 10px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {m.title}
                  </h3>

                  <p
                    style={{
                      fontSize: '13px',
                      color: '#64748b',
                      lineHeight: 1.5,
                      margin: '0 0 20px',
                      minHeight: '60px',
                    }}
                  >
                    {m.description}
                  </p>

                  {/* FEATURE BULLETS */}
                  <div
                    style={{
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '16px',
                      marginBottom: '24px',
                    }}
                  >
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {m.capabilities.map((cap) => (
                        <li
                          key={cap}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            fontSize: '12px',
                            color: '#334155',
                            lineHeight: 1.4,
                          }}
                        >
                          <span
                            style={{
                              color: m.accentColor,
                              fontWeight: 900,
                              fontSize: '13px',
                              lineHeight: '16px',
                            }}
                          >
                            ✓
                          </span>
                          <span>{cap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* ACTION CTA */}
                <Link
                  href={m.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 18px',
                    borderRadius: '10px',
                    background: isLive
                      ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'
                      : '#f8fafc',
                    color: isLive ? '#ffffff' : '#334155',
                    border: isLive ? 'none' : '1px solid #e2e8f0',
                    fontSize: '13px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: isLive ? '0 4px 12px rgba(234, 88, 12, 0.25)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{m.ctaText}</span>
                  <ChevronRight size={15} />
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
          color: '#64748b',
        }}
      >
        <p style={{ margin: 0 }}>
          © 2026 <strong>BEMS Group Holdings Limited</strong> · Enterprise Resource Planning System
        </p>
      </footer>
    </div>
  );
}
