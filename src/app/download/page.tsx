import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PublicDownloadPage() {
  const [staffGate, gmdGate] = await Promise.all([
    prisma.mobileAppGate.findUnique({ where: { appId: 'STAFF_APP' } }),
    prisma.mobileAppGate.findUnique({ where: { appId: 'GMD_APP' } }),
  ]);

  const staffVersion = staffGate?.latestVersionAvailable || '1.3.5';
  const gmdVersion = gmdGate?.latestVersionAvailable || '1.3.5';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 60,
      }}
    >
      {/* TOPBAR */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#ffffff',
                border: '1px solid #fed7aa',
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                padding: 2,
              }}
            >
              <img
                src="/bems-group-logo.png?v=20261024"
                alt="BEMS Group"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <strong style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                BEMS
              </strong>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#ea580c' }}>GROUP</span>
            </div>
          </div>

          <Link
            href="/finance"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#ea580c',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Web Portal →
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 680, margin: '40px auto 24px', textAlign: 'center', padding: '0 20px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            padding: '5px 14px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 800,
            color: '#ea580c',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Official BEMS Android Suite
        </div>
        <h1
          style={{
            fontSize: 'clamp(28px, 4vw, 38px)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            margin: '0 0 10px',
            color: '#0f172a',
          }}
        >
          Download BEMS Mobile Applications
        </h1>
        <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.5, margin: 0 }}>
          Dedicated native Android applications for the Group Managing Director and BEMS Workforce across all subsidiaries.
        </p>
      </section>

      {/* TWO APPS SIDE BY SIDE */}
      <main
        style={{
          maxWidth: 960,
          width: '100%',
          margin: '0 auto',
          padding: '0 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}
      >
        {/* CARD 1: GMD EXECUTIVE COCKPIT */}
        <div
          style={{
            background: 'linear-gradient(180deg, #09131f 0%, #050b12 100%)',
            borderRadius: 20,
            border: '2px solid #10b981',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 16px 36px -6px rgba(16, 185, 129, 0.22)',
            color: '#ffffff',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 6,
                }}
              >
                <img
                  src="/bems-group-logo.png?v=20261024"
                  alt="BEMS Group"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <span
                style={{
                  background: '#10b981',
                  color: '#022c22',
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '4px 12px',
                  borderRadius: 9999,
                  letterSpacing: '0.04em',
                }}
              >
                v{gmdVersion} · EXECUTIVE
              </span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 6px', color: '#ffffff', letterSpacing: '-0.02em' }}>
              BEMS GMD AI Cockpit
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45, margin: '0 0 18px' }}>
              Executive approvals, wallet management and AI assistance for the GMD and temporarily authorized Super Admins.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981', fontWeight: 900 }}>✓</span> Secure request approvals &amp; wallet funding
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981', fontWeight: 900 }}>✓</span> Live Financial Copilot with 120s Deep Ledger Reasoning
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981', fontWeight: 900 }}>✓</span> Consolidated Treasury, Bilateral Netting &amp; Payroll Sign-off
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981', fontWeight: 900 }}>✓</span> 8-Module Workstation Hub spanning SmartAIRS, Agribusiness, Tech
              </li>
            </ul>
          </div>

          <div>
            <a
              href="/download/gmd-app.apk"
              download={`BEMS-GMD-Executive-Cockpit-v${gmdVersion}.apk`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 900,
                textDecoration: 'none',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
              }}
            >
              <span>📥 Download GMD App APK (v{gmdVersion})</span>
            </a>
            <small style={{ display: 'block', textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 10 }}>
              Android 8.0+ · com.bemsgroup.bems_gmd_ai
            </small>
          </div>
        </div>

        {/* CARD 2: BEMS STAFF APP */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '2px solid #ea580c',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 12px 30px -4px rgba(234, 88, 12, 0.14)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 6,
                }}
              >
                <img
                  src="/bems-group-logo.png?v=20261024"
                  alt="BEMS Group"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <span
                style={{
                  background: '#ea580c',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '4px 12px',
                  borderRadius: 9999,
                }}
              >
                v{staffVersion} · STAFF
              </span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 6px', color: '#0f172a', letterSpacing: '-0.02em' }}>
              BEMS Staff Portal
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.45, margin: '0 0 18px' }}>
              Self-service workspace for staff across all BEMS Group operating entities.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', fontSize: 13, color: '#334155', fontWeight: 600 }}>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ea580c', fontWeight: 900 }}>✓</span> Fund requests &amp; 72h receipt uploads
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ea580c', fontWeight: 900 }}>✓</span> Personal wallet, approved withdrawals &amp; payslips
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ea580c', fontWeight: 900 }}>✓</span> Starlink Wi-Fi &amp; GPS geofenced attendance
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ea580c', fontWeight: 900 }}>✓</span> Enterprise Workstation Gallery switcher
              </li>
            </ul>
          </div>

          <div>
            <a
              href="/download/staff-app.apk"
              download={`BEMS-Staff-Portal-v${staffVersion}.apk`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 900,
                textDecoration: 'none',
                boxShadow: '0 8px 20px rgba(234, 88, 12, 0.28)',
              }}
            >
              <span>📥 Download Staff App APK (v{staffVersion})</span>
            </a>
            <small style={{ display: 'block', textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 10 }}>
              Android 8.0+ · com.bemsfarms.bems_staff_app
            </small>
          </div>
        </div>
      </main>

      {/* COMPACT INSTALLATION STEPS */}
      <section style={{ maxWidth: 680, width: '100%', margin: '28px auto 0', padding: '0 20px' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '20px 24px',
            fontSize: 13,
            color: '#475569',
            lineHeight: 1.7,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            📱 Installation Instructions
          </h3>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: '#0f172a' }}>1. Download:</strong> Tap the download button for your app above (select <em>&ldquo;Download anyway&rdquo;</em> if Chrome displays an unknown source warning).
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: '#0f172a' }}>2. Install:</strong> Tap the completed download notification or find it in your Files app and allow package installation.
          </div>
          <p>When replacing an older debug-signed build, Android may require you to uninstall the old app first. You will need to sign in again; your company records remain on the server.</p>
          <div>
            <strong style={{ color: '#0f172a' }}>3. Access:</strong> Authorized executives and staff log in with their existing work credentials.
          </div>
        </div>
      </section>
    </div>
  );
}
