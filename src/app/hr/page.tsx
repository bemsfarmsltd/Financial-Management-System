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

  // Strict HR role segregation: Only HR personnel can access the HR workspace.
  // GMD and Super Admin are intentionally segregated and operate via their executive cockpits.
  const isAuthorized = user.role === 'HR' || user.role === 'HR_ADMIN' || user.isHrAuthorized;

  if (!isAuthorized) {
    const isExecutiveOrAdmin =
      user.role === 'GMD' || user.role === 'SYSTEM_ADMIN' || user.role === 'SUPER_ADMIN';

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0d14',
          padding: '24px',
          fontFamily: "'Outfit', system-ui, sans-serif",
          textAlign: 'center',
          color: '#f8fafc',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <ShieldAlert size={36} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
          HR Role Isolated Workspace
        </h2>
        <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '520px', margin: '0 0 28px 0', lineHeight: 1.6 }}>
          The Human Resources dashboard is strictly isolated to designated HR administrators.
          {isExecutiveOrAdmin ? (
            <>
              {' '}As <strong>{user.fullName} ({user.role})</strong>, your administrative domain is located in the Executive Leadership cockpit.
            </>
          ) : (
            <>
              {' '}Your account (<strong>{user.fullName}</strong>) is not assigned to the HR administrative role.
            </>
          )}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {isExecutiveOrAdmin ? (
            <Link
              href="/finance"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 22px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Open Executive Dashboard
            </Link>
          ) : (
            <Link
              href="/staff"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 22px',
                borderRadius: '10px',
                background: '#4f46e5',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Open Staff Workspace
            </Link>
          )}
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 20px',
              borderRadius: '10px',
              background: '#1e293b',
              color: '#cbd5e1',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              border: '1px solid #334155',
            }}
          >
            <ArrowLeft size={14} /> Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  return <HrDashboardClient user={user} />;
}
