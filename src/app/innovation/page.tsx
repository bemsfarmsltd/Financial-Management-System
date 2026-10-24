'use client';

import React from 'react';
import Link from 'next/link';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { Code2, ArrowLeft, ArrowRight, Wallet, Cloud, Bot, Key } from 'lucide-react';

export default function InnovationPortalPage() {
  return (
    <ConnectAppShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px 8px 48px' }}>
        {/* HEADER CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
            border: '1px solid #bae6fd',
            borderRadius: '16px',
            padding: '28px 32px',
            marginBottom: '24px',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
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
              }}
            >
              <Code2 size={13} />
              TECH & INNOVATION PILLAR · PHASE 3 PIPELINE
            </span>
          </div>

          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px' }}>
            Innovation, Cloud Tech & Software R&D
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Central software delivery repository, Hostinger cloud infrastructure orchestration,
            internal API gateways, and digital automation projects for <strong style={{ color: '#0f172a' }}>BemsSoft Hub Ltd</strong>.
          </p>
        </div>

        {/* ROADMAP MODULES GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
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

        {/* NAVIGATION SHORTCUTS */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
            <span>Return to Department Suite</span>
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
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.2)',
            }}
          >
            <Wallet size={14} />
            <span>Switch to Active Finance Desk</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </ConnectAppShell>
  );
}
