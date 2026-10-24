'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AuthSessionUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export default function ErpSuiteGatewayPage() {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session?_t=' + Date.now(), { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 0%, #172554 0%, #070d17 65%, #030712 100%)',
        color: '#f8fafc',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        padding: '0 0 60px',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* AMBIENT BACKGROUND GLOWS */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, rgba(30, 58, 138, 0.25) 50%, transparent 75%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* TOPBAR NAVIGATION */}
      <header
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(7, 13, 23, 0.75)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* BRAND */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src="/bems-group-logo.png?v=20261024"
                alt="BEMS logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <strong style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>BEMS</strong>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#f97316', letterSpacing: '0.04em' }}>GROUP</span>
              </div>
              <small style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginTop: '-2px' }}>
                Enterprise Resource Planning
              </small>
            </div>
          </Link>

          {/* STATUS & USER ACTIONS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              Cluster Nominal · TLS 1.3
            </div>

            {authChecked && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  {user?.fullName?.slice(0, 2).toUpperCase() || 'EX'}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1 }}>
                    {user?.fullName || 'Executive User'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {user?.role || 'SYSTEM'}
                  </div>
                </div>
              </div>
            )}

            <Link
              href="/finance"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#ffffff',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                transition: 'transform 0.15s ease',
              }}
            >
              Launch Finance Desk <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{ maxWidth: '1280px', margin: '48px auto 36px', padding: '0 24px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: '999px',
            background: 'rgba(249, 115, 22, 0.12)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            color: '#fb923c',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '16px',
          }}
        >
          ENTERPRISE RESOURCE PLANNING SYSTEM
        </div>
        <h1
          style={{
            fontSize: '44px',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: '#ffffff',
            maxWidth: '820px',
            margin: '0 auto 16px',
          }}
        >
          Unified Multi-Subsidiary Operational Control Plane
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#94a3b8',
            maxWidth: '680px',
            margin: '0 auto 32px',
            lineHeight: 1.6,
          }}
        >
          Manage expenditure governance, logistics dispatch, cloud software engineering, and corporate talent across{' '}
          <strong style={{ color: '#f1f5f9' }}>BEMS Group Holdings</strong>,{' '}
          <strong style={{ color: '#f1f5f9' }}>BemsSoft Hub Ltd</strong>, and{' '}
          <strong style={{ color: '#f1f5f9' }}>Bems Logistics & Farms Ltd</strong>.
        </p>

        {/* SUBSIDIARY BADGES */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { name: 'BEMS Group Holdings Ltd (HQ)', code: 'BEMS-GROUP', color: '#f97316' },
            { name: 'BemsSoft Hub Ltd', code: 'BEMS-SOFT', color: '#0284c7' },
            { name: 'Bems Logistics & Farms Ltd', code: 'BEMS-LOG', color: '#059669' },
          ].map((sub) => (
            <div
              key={sub.code}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#cbd5e1',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sub.color }} />
              <strong>{sub.name}</strong>
              <small style={{ color: '#64748b', fontSize: '10px' }}>({sub.code})</small>
            </div>
          ))}
        </div>
      </section>

      {/* CORE DEPARTMENTAL MODULES GRID */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'left', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            Operational Pillars & Systems
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            Select an operational domain to access its dedicated tools, registers, and controls.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {/* 1. FINANCE & TREASURY DESK (ACTIVE) */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(249, 115, 22, 0.1)',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.4)',
                  }}
                >
                  ₦
                </div>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  ACTIVE SYSTEM
                </span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px' }}>
                Finance & Treasury Desk
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 18px' }}>
                Multi-subsidiary expenditure requests, tiered governance approval matrix, treasury banking disbursements, and cryptographic audit accountability.
              </p>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Live Capabilities
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>✓ <strong>Expenditure Requests:</strong> Automated 3-tier approvals</li>
                  <li>✓ <strong>Maker-Checker Banking:</strong> Dual sign-off disbursements</li>
                  <li>✓ <strong>Treasury Accounts:</strong> Off-platform balances & reserves</li>
                  <li>✓ <strong>Intercompany Clearing:</strong> Automated debit/credit notes</li>
                  <li>✓ <strong>Compliance Trail:</strong> Append-only SHA-256 audit ledger</li>
                </ul>
              </div>
            </div>

            <Link
              href="/finance"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
                color: '#ffffff',
                padding: '12px 18px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 800,
                textDecoration: 'none',
                textAlign: 'center',
                display: 'block',
                boxShadow: '0 4px 16px rgba(234, 88, 12, 0.4)',
              }}
            >
              Enter Finance Portal →
            </Link>
          </div>

          {/* 2. OPERATIONS & FLEET LOGISTICS */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                  }}
                >
                  ⛟
                </div>
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                  }}
                >
                  PIPELINE · PHASE 2
                </span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px' }}>
                Operations & Fleet
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 18px' }}>
                Agritech delivery management, fleet telematics, fuel consumption audits, and warehouse cold-chain inventory.
              </p>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Scheduled Scope
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>• Agritech delivery dispatch & waybill validation</li>
                  <li>• Diesel & generator overhaul logs (Bems Logistics)</li>
                  <li>• Heavy equipment & vehicle service intervals</li>
                  <li>• Farm produce tracking & supply fulfillment</li>
                </ul>
              </div>
            </div>

            <Link
              href="/operations"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
                display: 'block',
              }}
            >
              Explore Operations Roadmap ↗
            </Link>
          </div>

          {/* 3. SOFTWARE INNOVATION & CLOUD TECH */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                  }}
                >
                  ⚡
                </div>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                  }}
                >
                  PIPELINE · PHASE 3
                </span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px' }}>
                Innovation & Cloud Tech
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 18px' }}>
                BemsSoft Hub software product engineering, Hostinger cloud infrastructure, and AI workflow automation.
              </p>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Scheduled Scope
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>• Cloud server status & Hostinger VPS monitoring</li>
                  <li>• Software developer license inventories</li>
                  <li>• API microservices and n8n orchestration</li>
                  <li>• Enterprise intelligence & Copilot models</li>
                </ul>
              </div>
            </div>

            <Link
              href="/innovation"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
                display: 'block',
              }}
            >
              Explore Innovation Roadmap ↗
            </Link>
          </div>

          {/* 4. HUMAN CAPITAL & PEOPLE OPERATIONS */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                  }}
                >
                  👥
                </div>
                <span
                  style={{
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#c084fc',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                  }}
                >
                  PIPELINE · PHASE 4
                </span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px' }}>
                Human Capital & HR
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 18px' }}>
                Group-wide employee directory, compensation structures, talent onboarding, and cross-entity transfers.
              </p>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Scheduled Scope
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>• Staff profile management & salary agreements</li>
                  <li>• Paperless onboarding with KYC & verification</li>
                  <li>• Leave administration and clearance sign-offs</li>
                  <li>• Cross-subsidiary shared staff allocation</li>
                </ul>
              </div>
            </div>

            <Link
              href="/hr"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
                display: 'block',
              }}
            >
              Explore HR Roadmap ↗
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          maxWidth: '1280px',
          margin: '60px auto 0',
          padding: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12px',
          color: '#64748b',
        }}
      >
        <div>
          © 2026 <strong>BEMS Group Holdings Ltd</strong> · All rights reserved.
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/finance" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>Finance Desk</Link>
          <Link href="/operations" style={{ color: '#94a3b8', textDecoration: 'none' }}>Operations</Link>
          <Link href="/innovation" style={{ color: '#94a3b8', textDecoration: 'none' }}>Innovation</Link>
          <Link href="/hr" style={{ color: '#94a3b8', textDecoration: 'none' }}>People</Link>
        </div>
      </footer>
    </main>
  );
}
