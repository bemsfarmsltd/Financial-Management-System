'use client';

import React from 'react';
import Link from 'next/link';
import { Code2, ArrowLeft, ArrowRight } from 'lucide-react';

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
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 28px',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/bems-group-logo.png?v=20261024" alt="BEMS logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <strong style={{ fontSize: '17px', fontWeight: 800 }}>BEMS Innovation & Tech</strong>
          </div>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={13} />
            <span>All Departments</span>
          </Link>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: '#f0f9ff',
            color: '#0284c7',
            display: 'grid',
            placeItems: 'center',
            marginBottom: '20px',
          }}
        >
          <Code2 size={32} />
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px' }}>
          Innovation & Cloud Tech
        </h1>
        <p style={{ fontSize: '15px', color: '#64748b', margin: '0 0 28px' }}>
          This module is currently in development (Phase 3).
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            href="/"
            style={{
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
            ← Back to Departments
          </Link>
          <Link
            href="/finance"
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#ea580c',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Open Finance Module</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </main>
    </div>
  );
}
