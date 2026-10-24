'use client';

import React from 'react';
import Link from 'next/link';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
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
  Sparkles,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';

export default function EnterpriseGatewayPage() {
  const departments = [
    {
      id: 'finance',
      title: 'Finance & Treasury Desk',
      shortTitle: 'Finance',
      href: '/finance',
      status: 'LIVE & ACTIVE',
      statusType: 'active',
      icon: Wallet,
      color: '#ea580c',
      bgLight: '#fff7ed',
      borderLight: '#fed7aa',
      description:
        'Multi-subsidiary expenditure requests, tiered governance approval matrix, treasury banking disbursements, and cryptographic audit accountability.',
      features: [
        'Automated 3-tier expenditure approval routing',
        'Direct maker-checker bank disbursement tracking',
        'Strict 72-hour receipt retirement evidence',
        'Automated intercompany debit/credit note generator',
      ],
      primaryCta: 'Launch Finance Desk →',
    },
    {
      id: 'operations',
      title: 'Operations & Fleet Management',
      shortTitle: 'Operations',
      href: '/operations',
      status: 'PIPELINE · PHASE 2',
      statusType: 'pipeline',
      icon: Truck,
      color: '#059669',
      bgLight: '#ecfdf5',
      borderLight: '#a7f3d0',
      description:
        'Agritech delivery management, fleet telematics, fuel consumption audits, and warehouse cold-chain inventory for Bems Logistics & Farms.',
      features: [
        'Produce transit manifests & route GPS tracking',
        'Bulk diesel tank replenishment and pump meter logs',
        'Generator overhaul and fleet maintenance logs',
        'Customer waybill clearing and cold room intake',
      ],
      primaryCta: 'Open Operations Portal →',
    },
    {
      id: 'innovation',
      title: 'Innovation & Cloud Tech',
      shortTitle: 'Innovation',
      href: '/innovation',
      status: 'PIPELINE · PHASE 3',
      statusType: 'pipeline',
      icon: Code2,
      color: '#0284c7',
      bgLight: '#f0f9ff',
      borderLight: '#bae6fd',
      description:
        'Software product engineering, Hostinger cloud infrastructure, WhatsApp/Slack notification bridges, and AI workflow automation for BemsSoft Hub.',
      features: [
        'Cloud server status & Hostinger deployment triggers',
        'API gateway monitoring and telemetry logging',
        'BEMi AI Assistant and autonomous ledger audit bots',
        'Software client delivery licenses & support contracts',
      ],
      primaryCta: 'Open Tech Portal →',
    },
    {
      id: 'hr',
      title: 'Human Capital & HR',
      shortTitle: 'Human Resources',
      href: '/hr',
      status: 'PIPELINE · PHASE 4',
      statusType: 'pipeline',
      icon: Users,
      color: '#7c3aed',
      bgLight: '#f5f3ff',
      borderLight: '#ddd6fe',
      description:
        'Group-wide employee directory, compensation structures, talent onboarding, and cross-entity staff allocation rules.',
      features: [
        'Staff profile management & salary agreements',
        'Seamless onboarding with BVN & account validation',
        'Annual leave tracker and attendance audits',
        'Cross-subsidiary shared employee cost-sharing rules',
      ],
      primaryCta: 'Open HR Portal →',
    },
  ];

  return (
    <ConnectAppShell>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '16px 8px 48px' }}>
        {/* EXECUTIVE HEADER BANNER */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '28px 32px',
            marginBottom: '28px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
          }}
        >
          <div style={{ maxWidth: '700px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffedd5',
                  color: '#c2410c',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  letterSpacing: '0.04em',
                }}
              >
                <Layers size={13} />
                BEMS GROUP ENTERPRISE ERP
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#ecfdf5',
                  color: '#047857',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '999px',
                }}
              >
                <CheckCircle2 size={12} />
                Multi-Subsidiary Gateway
              </span>
            </div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: '0 0 8px',
              }}
            >
              Enterprise Departmental Suite
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Central access portal for BEMS Group Holdings Ltd. Select an operational department
              below to enter its live registers, governance tools, and workflow systems.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/finance"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 22px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)',
                transition: 'transform 0.15s ease',
              }}
            >
              <Wallet size={16} />
              <span>Enter Finance Desk</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* SUBSIDIARY ROSTER PILL STRIP */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
            Active Subsidiaries:
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
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
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

        {/* 4 DEPARTMENT CARDS GRID */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {departments.map((dept) => {
            const Icon = dept.icon;
            const isLive = dept.statusType === 'active';

            return (
              <div
                key={dept.id}
                style={{
                  background: '#ffffff',
                  border: isLive ? `2px solid ${dept.color}` : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isLive
                    ? `0 10px 25px -4px ${dept.color}20`
                    : '0 2px 8px rgba(0,0,0,0.03)',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  {/* CARD HEADER */}
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
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: dept.bgLight,
                        border: `1px solid ${dept.borderLight}`,
                        color: dept.color,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon size={24} />
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isLive ? '#dcfce7' : '#f1f5f9',
                        color: isLive ? '#15803d' : '#64748b',
                        border: isLive ? '1px solid #86efac' : '1px solid #e2e8f0',
                      }}
                    >
                      {dept.status}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '0 0 8px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {dept.title}
                  </h3>

                  <p
                    style={{
                      fontSize: '13px',
                      color: '#64748b',
                      lineHeight: 1.5,
                      margin: '0 0 18px',
                      minHeight: '58px',
                    }}
                  >
                    {dept.description}
                  </p>

                  {/* FEATURE LIST */}
                  <div
                    style={{
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '14px',
                      marginBottom: '20px',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#94a3b8',
                        letterSpacing: '0.05em',
                        margin: '0 0 10px',
                      }}
                    >
                      Key Capabilities & Scope
                    </p>
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
                      {dept.features.map((feat) => (
                        <li
                          key={feat}
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
                              color: dept.color,
                              fontSize: '14px',
                              lineHeight: '16px',
                              fontWeight: 900,
                            }}
                          >
                            ✓
                          </span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* ACTION CTA BUTTON */}
                <Link
                  href={dept.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px 16px',
                    borderRadius: '10px',
                    background: isLive
                      ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'
                      : '#f8fafc',
                    color: isLive ? '#ffffff' : '#334155',
                    border: isLive ? 'none' : '1px solid #e2e8f0',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: isLive ? '0 4px 10px rgba(234, 88, 12, 0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{dept.primaryCta}</span>
                  <ChevronRight size={15} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </ConnectAppShell>
  );
}
