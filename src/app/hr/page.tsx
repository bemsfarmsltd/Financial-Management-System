'use client';

import React from 'react';
import Link from 'next/link';

export default function HumanResourcesPortalPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 0%, #581c87 0%, #070d17 70%, #030712 100%)',
        color: '#f8fafc',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        padding: '0 0 60px',
      }}
    >
      {/* HEADER */}
      <header
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(7, 13, 23, 0.75)',
          backdropFilter: 'blur(16px)',
          padding: '16px 24px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src="/bems-group-logo.png?v=20261024" alt="BEMS logo" style={{ width: 34, height: 34, background: '#fff', borderRadius: 8, padding: 2 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <strong style={{ fontSize: '17px', fontWeight: 900, color: '#fff' }}>BEMS</strong>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#a855f7' }}>HUMAN RESOURCES</span>
              </div>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/" style={{ padding: '7px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
              ← ERP Suite Hub
            </Link>
            <Link href="/finance" style={{ padding: '7px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
              Finance Desk →
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div style={{ maxWidth: '900px', margin: '60px auto 0', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#c084fc', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
          PEOPLE & TALENT PILLAR · IN ACTIVE DEVELOPMENT
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: 900, color: '#ffffff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          Human Resources & Talent Management
        </h1>
        <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 40px' }}>
          Unified staff records, employee self-service onboarding, payroll attendance synchronizer, and role-based permissions across all BEMS Group entities.
        </p>

        {/* ROADMAP MODULES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', textAlign: 'left', marginBottom: '40px' }}>
          {[
            { title: 'Employee Directory & Contracts', desc: 'Centralized staff credentials, designations, and subsidiary re-allocations.', tag: 'Phase 4.1' },
            { title: 'Leave & Attendance Management', desc: 'Real-time clock-in audits, annual leave requests, and supervisor approvals.', tag: 'Phase 4.2' },
            { title: 'Payroll Disbursals & Compliance', desc: 'Automated tax allowances, pension remittances, and pay-slip distribution.', tag: 'Phase 4.3' },
          ].map((m) => (
            <div key={m.title} style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#c084fc', background: 'rgba(168, 85, 247, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>{m.tag}</span>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '10px 0 6px' }}>{m.title}</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>{m.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
          <Link href="/" style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
            Return to ERP Suite Gateway
          </Link>
          <Link href="/finance" style={{ padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
            Switch to Active Finance Desk →
          </Link>
        </div>
      </div>
    </main>
  );
}
