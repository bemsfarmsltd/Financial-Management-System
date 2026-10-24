'use client';

import React from 'react';
import Link from 'next/link';
import { Truck, ArrowLeft, ArrowRight, Wallet, MapPin, Fuel, Warehouse } from 'lucide-react';

export default function OperationsPortalPage() {
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
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>OPERATIONS</span>
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
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            border: '1px solid #bbf7d0',
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
              background: '#dcfce7',
              color: '#15803d',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '999px',
              letterSpacing: '0.04em',
              marginBottom: '12px',
            }}
          >
            <Truck size={13} />
            OPERATIONS & FLEET PILLAR · PHASE 2 PIPELINE
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px' }}>
            Operations, Logistics & Fleet Management
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Dedicated operational telemetry, produce distribution manifests, bulk diesel replenishment,
            and cold-chain warehouse intake for <strong style={{ color: '#0f172a' }}>Bems Logistics & Farms Ltd</strong>.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
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
