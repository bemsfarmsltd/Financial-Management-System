'use client';

import React from 'react';
import Link from 'next/link';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { Truck, ArrowLeft, ArrowRight, Wallet, CheckCircle2, MapPin, Fuel, Warehouse } from 'lucide-react';

export default function OperationsPortalPage() {
  return (
    <ConnectAppShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px 8px 48px' }}>
        {/* HEADER CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            border: '1px solid #bbf7d0',
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
                background: '#dcfce7',
                color: '#15803d',
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '999px',
                letterSpacing: '0.04em',
              }}
            >
              <Truck size={13} />
              OPERATIONS & FLEET PILLAR · PHASE 2 PIPELINE
            </span>
          </div>

          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px' }}>
            Operations, Logistics & Fleet Management
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Dedicated operational telemetry, produce distribution manifests, bulk diesel replenishment,
            and cold-chain warehouse intake for <strong style={{ color: '#0f172a' }}>Bems Logistics & Farms Ltd</strong>.
          </p>
        </div>

        {/* ROADMAP MODULES GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            {
              icon: MapPin,
              tag: 'Phase 2.1',
              title: 'Fleet Tracking & GPS Telematics',
              desc: 'Real-time vehicle position, delivery route tracking, driver assignments, and trip manifests.',
            },
            {
              icon: Fuel,
              tag: 'Phase 2.2',
              title: 'Diesel Supply & Pump Meters',
              desc: 'Bulk fuel tank intake, electronic pump reconciliation, and generator consumption loggers.',
            },
            {
              icon: Warehouse,
              tag: 'Phase 2.3',
              title: 'Cold-Chain Warehouse Inventory',
              desc: 'Harvest crates receiving, temperature monitors, and automated customer waybill clearing.',
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
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#059669',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px' }}>
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
