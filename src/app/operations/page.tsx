'use client';

import React from 'react';
import Link from 'next/link';

export default function OperationsPortalPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 0%, #064e3b 0%, #070d17 70%, #030712 100%)',
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
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>OPERATIONS</span>
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
        <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', background: 'rgba(5, 150, 105, 0.15)', border: '1px solid rgba(5, 150, 105, 0.3)', color: '#34d399', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
          OPERATIONAL PILLAR · IN ACTIVE DEVELOPMENT
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: 900, color: '#ffffff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          Operations, Logistics & Fleet Management
        </h1>
        <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 40px' }}>
          Dedicated telemetry, dispatch automation, diesel bulk replenishment, and warehouse supply fulfillment for <strong style={{ color: '#fff' }}>Bems Logistics & Farms Ltd</strong>.
        </p>

        {/* ROADMAP MODULES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', textAlign: 'left', marginBottom: '40px' }}>
          {[
            { title: 'Fleet Tracking & GPS Telematics', desc: 'Real-time transit telemetry, trip manifests, and delivery route tracking.', tag: 'Phase 2.1' },
            { title: 'Diesel Supply & Fuel Consumption', desc: 'Automated float tracking, pump reconciliation, and generator overhaul logs.', tag: 'Phase 2.2' },
            { title: 'Produce & Agritech Cold Chain', desc: 'Farm harvest batches, temperature logs, and customer waybill clearing.', tag: 'Phase 2.3' },
          ].map((m) => (
            <div key={m.title} style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#34d399', background: 'rgba(5, 150, 105, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>{m.tag}</span>
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
