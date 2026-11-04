'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Lock, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { HrDashboardClient } from '@/components/dashboard/hr/HrDashboardClient';

export default function HumanResourcesPortalPage() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#64748b',
          fontFamily: "'Outfit', system-ui, sans-serif",
          gap: '12px',
        }}
      >
        <RefreshCw size={28} className="animate-spin text-indigo-600" />
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Authenticating BEMS HR Workspace...</span>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '24px',
          fontFamily: "'Outfit', system-ui, sans-serif",
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '16px',
            background: '#e0e7ff',
            color: '#4338ca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <Lock size={32} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
          Authentication Required
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '420px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          Please sign in with your corporate account to access the BEMS Human Resources & Timekeeping Workspace.
        </p>
        <Link
          href="/"
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            background: '#4f46e5',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  // Not authorized
  const isAuthorized =
    user.isHrAuthorized || user.role === 'GMD' || user.role === 'SYSTEM_ADMIN' || user.role === 'SUPER_ADMIN';

  if (!isAuthorized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '24px',
          fontFamily: "'Outfit', system-ui, sans-serif",
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '16px',
            background: '#fee2e2',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <ShieldAlert size={32} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
          Access Restricted: HR Authority Required
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '480px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          The Human Resources workspace is restricted to HR Department personnel and Executive Leadership. Your current
          account (<strong>{user.fullName}</strong>) is not assigned to the Human Resources unit.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} /> Back to Portal
          </Link>
          <Link
            href="/staff"
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Open Staff Workspace
          </Link>
        </div>
      </div>
    );
  }

  return <HrDashboardClient user={user} />;
}
