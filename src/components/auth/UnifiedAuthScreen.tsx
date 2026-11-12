'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface UnifiedAuthScreenProps {
  redirectUrl?: string;
}

export function UnifiedAuthScreen({ redirectUrl }: UnifiedAuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [targetRedirect, setTargetRedirect] = useState(redirectUrl || '/');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('redirect');
      if (r && r.startsWith('/')) {
        setTargetRedirect(r);
      }
    }
  }, [redirectUrl]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify your credentials.');
      }

      // Successful login - redirect to launchpad or deep link
      window.location.href = targetRedirect;
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in.');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px 16px',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '32px 32px 24px',
            textAlign: 'center',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 14px',
              borderRadius: '12px',
              background: '#ffffff',
              border: '1px solid #fed7aa',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.1)',
              display: 'grid',
              placeItems: 'center',
              padding: '6px',
            }}
          >
            <img
              src="/bems-group-logo.png?v=20261024"
              alt="BEMS Group"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 6px',
            }}
          >
            BEMS <span style={{ color: '#ea580c' }}>ERP</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Enterprise Management & Operational Suite
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} style={{ padding: '28px 32px 32px' }}>
          {error && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '12.5px',
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="auth-email"
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Work Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@bems.group"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 38px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Mail
                size={16}
                color="#94a3b8"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <label
                htmlFor="auth-password"
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                Password
              </label>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Please contact your System Administrator or HR desk to reset your corporate password.');
                }}
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#ea580c',
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 38px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Lock
                size={16}
                color="#94a3b8"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#94a3b8',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: '10px',
              background: busy ? '#94a3b8' : '#ea580c',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.15s ease',
            }}
          >
            {busy ? (
              <span>Verifying credentials...</span>
            ) : (
              <>
                <span>Sign in to Enterprise Suite</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div
            style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid #f1f5f9',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 8px' }}>
              Staff self-service onboarding:
            </p>
            <a
              href="/finance?signup=staff"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#ea580c',
                textDecoration: 'none',
              }}
            >
              New Staff? Complete Self-Registration →
            </a>
          </div>
        </form>
      </div>

      {/* Security Footer Notice */}
      <div
        style={{
          marginTop: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11.5px',
          color: '#94a3b8',
        }}
      >
        <ShieldCheck size={14} color="#059669" />
        <span>Enterprise 256-bit encrypted session · Strict role-based isolation</span>
      </div>
    </div>
  );
}

