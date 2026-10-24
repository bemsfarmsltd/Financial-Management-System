'use client';

import React from 'react';
import Link from 'next/link';
import { Code2, ArrowLeft, ArrowRight, Wallet, Cloud, Bot, Key } from 'lucide-react';

export default function InnovationPortalPage() {
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
      {/* CLEAN TOPBAR */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 28px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/bems-group-logo.png?v=20261024" alt="BEMS logo" style={{ width: 34, height: 34, objectFit: 'contain' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <strong style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>BEMS</strong>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#0284c7' }}>INNOVATION</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={13} />
              <span>ERP Modules Directory</span>
            </Link>
            <Link
              href="/finance"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              <Wallet size={13} />
              <span>Finance Module →</span>
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main style={{ flex: 1, maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '40px 24px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
            border: '1px solid #bae6fd',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '28px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#e0f2fe',
              color: '#0369a1',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '999px',
              letterSpacing: '0.04em',
              marginBottom: '12px',
            }}
          >
            <Code2 size={13} />
            TECH & INNOVATION PILLAR · PHASE 3 PIPELINE
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px' }}>
            Innovation, Cloud Tech & Software R&D
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Central software delivery repository, Hostinger cloud infrastructure orchestration,
            internal API gateways, and digital automation projects for <strong style={{ color: '#0f172a' }}>BemsSoft Hub Ltd</strong>.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            {
              icon: Cloud,
              tag: 'Phase 3.1',
              title: 'Cloud Infrastructure & Deployments',
              desc: 'Hostinger cloud instances, cluster telemetry, CI/CD auto-deploys, and domain DNS routing.',
            },
            {
              icon: Bot,
              tag: 'Phase 3.2',
              title: 'AI Automation & System Workflows',
              desc: 'BEMi ledger intelligence assistant, WhatsApp/Slack webhook bots, and event triggers.',
            },
            {
              icon: Key,
              tag: 'Phase 3.3',
              title: 'Software Client Delivery & Licenses',
              desc: 'Custom enterprise software packages, customer tenant licensing, and SLA compliance logs.',
            },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.title}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      color: '#0284c7',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', background: '#f0f9ff', padding: '2px 8px', borderRadius: '4px' }}>
                    {m.tag}
                  </span>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>{m.title}</h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.4, margin: 0 }}>{m.desc}</p>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} />
            <span>Return to ERP Directory</span>
          </Link>
          <Link
            href="/finance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <Wallet size={14} />
            <span>Switch to Active Finance Module</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </main>
    </div>
  );
}
