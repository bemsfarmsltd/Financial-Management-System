'use client';

import React, { useState, useEffect } from 'react';
import { UnifiedAuthScreen } from '@/components/auth/UnifiedAuthScreen';
import { EnterpriseModulesScreen, type EnterpriseUserSummary } from '@/components/dashboard/EnterpriseModulesScreen';
import { AiMotionEntryScreen } from '@/components/ai/AiMotionEntryScreen';

export default function RootPage() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [user, setUser] = useState<EnterpriseUserSummary | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session?_t=' + Date.now(), { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user) {
          setUser({
            id: data.user.id,
            legalName: data.user.legalName || data.user.name || data.user.fullName || 'User',
            role: data.user.role || 'STAFF',
            workEmail: data.user.workEmail || data.user.email || '',
            employeeNumber: data.user.employeeNumber,
            subsidiaryName: data.user.subsidiary?.legalName || data.user.subsidiaryName || 'BEMS Group',
          });
          setAuthStatus('authenticated');
          try {
            if (sessionStorage.getItem('bems_show_welcome') === '1') {
              setShowWelcome(true);
            }
          } catch {}
        } else {
          setAuthStatus('unauthenticated');
        }
      })
      .catch(() => {
        if (active) setAuthStatus('unauthenticated');
      });

    return () => {
      active = false;
    };
  }, []);

  if (authStatus === 'checking') {
    return (
      <div
        role="status"
        aria-label="Loading BEMS ERP"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          gap: '14px',
          fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #fed7aa',
            display: 'grid',
            placeItems: 'center',
            padding: '4px',
            boxShadow: '0 2px 8px rgba(234, 88, 12, 0.08)',
          }}
        >
          <img
            src="/bems-group-logo.png?v=20261024"
            alt="BEMS logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
          Loading BEMS Enterprise Suite...
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated' || !user) {
    return (
      <UnifiedAuthScreen
        onAuthed={(authedUser) => {
          setUser({
            id: authedUser.id,
            legalName: authedUser.fullName || authedUser.name || 'User',
            role: authedUser.role || 'STAFF',
            workEmail: authedUser.email || '',
          });
          setShowWelcome(true);
          setAuthStatus('authenticated');
        }}
      />
    );
  }

  const isExecutive = user.role === 'GMD' || user.role === 'SUPER_ADMIN' || user.role === 'SYSTEM_ADMIN';
  if (showWelcome && isExecutive) {
    return (
      <AiMotionEntryScreen
        onComplete={() => {
          try {
            sessionStorage.removeItem('bems_show_welcome');
            sessionStorage.setItem('bems_welcome_shown_session', '1');
          } catch {}
          setShowWelcome(false);
        }}
        businessName={user.subsidiaryName || 'BEMS Group'}
        userName={user.legalName || 'Executive'}
        userRole={user.role}
        mode="login"
        brandColor="#ea580c"
      />
    );
  }

  return <EnterpriseModulesScreen user={user} />;
}
