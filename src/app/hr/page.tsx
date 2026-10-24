'use client';

import React from 'react';
import Link from 'next/link';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { Users, ArrowLeft, ArrowRight, Wallet, UserCheck, CalendarDays, Coins } from 'lucide-react';

export default function HumanResourcesPortalPage() {
  return (
    <ConnectAppShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px 8px 48px' }}>
        {/* HEADER CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
            border: '1px solid #e9d5ff',
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
                background: '#f3e8ff',
                color: '#7e22ce',
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '999px',
                letterSpacing: '0.04em',
              }}
            >
              <Users size={13} />
              PEOPLE & HR PILLAR · PHASE 4 PIPELINE
            </span>
          </div>

          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px' }}>
            Human Resources & Talent Operations
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Unified staff credentials, employee self-service onboarding, payroll attendance synchronizer,
            and role-based permissions across all BEMS Group entities.
          </p>
        </div>

        {/* ROADMAP MODULES GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            {
              icon: UserCheck,
              tag: 'Phase 4.1',
              title: 'Employee Directory & Contracts',
              desc: 'Centralized staff credentials, designations, employment contracts, and subsidiary re-allocations.',
            },
            {
              icon: CalendarDays,
              tag: 'Phase 4.2',
              title: 'Leave & Attendance Management',
              desc: 'Real-time clock-in audits, annual leave requests, sick leave approvals, and holiday calendars.',
            },
            {
              icon: Coins,
              tag: 'Phase 4.3',
              title: 'Payroll Disbursals & Compliance',
              desc: 'Automated tax allowances, pension remittances, gross-to-net calculators, and pay-slip distribution.',
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
                      background: '#faf5ff',
                      border: '1px solid #e9d5ff',
                      color: '#7c3aed',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#7c3aed', background: '#faf5ff', padding: '2px 8px', borderRadius: '4px' }}>
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
