import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PublicDownloadPage() {
  const staffGate = await prisma.mobileAppGate.findUnique({
    where: { appId: 'STAFF_APP' },
  });

  const staffVersion = staffGate?.latestVersionAvailable || '1.0.9';

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
      <section style={{ maxWidth: 520, margin: '44px auto 28px', textAlign: 'center', padding: '0 20px' }}>
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
          Official Android App
        </div>
        <h1
          style={{
            fontSize: 'clamp(26px, 4vw, 36px)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            margin: '0 0 8px',
            color: '#0f172a',
          }}
        >
          BEMS Staff Mobile App
        </h1>
        <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.5, margin: 0 }}>
          Submit fund requests, track disbursements, and manage attendance on the go.
        </p>
      </section>

      {/* CENTERED BEMS BRANDED STAFF APP CARD */}
      <main style={{ maxWidth: 440, width: '100%', margin: '0 auto', padding: '0 20px' }}>
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
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: 9999,
                }}
              >
                v{staffVersion}
              </span>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
              BEMS Staff Portal
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.45, margin: '0 0 18px' }}>
              Official BEMS Group mobile workspace.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', fontSize: 13, color: '#334155', fontWeight: 600 }}>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ea580c', fontWeight: 900 }}>✓</span> Fund requests &amp; 72h receipt uploads
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ea580c', fontWeight: 900 }}>✓</span> Real-time disbursement &amp; payslip tracking
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ea580c', fontWeight: 900 }}>✓</span> QR attendance &amp; digital Staff ID
              </li>
            </ul>
          </div>

          <div>
            <a
              href="/download/staff-app.apk"
              download="BemsStaff.apk"
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
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 8px 20px rgba(234, 88, 12, 0.28)',
              }}
            >
              <span>📥 Download Staff App APK</span>
            </a>
            <small style={{ display: 'block', textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 10 }}>
              Android 8.0+ · com.bemsgroup.staff
            </small>
          </div>
        </div>
      </main>

      {/* COMPACT INSTALLATION STEPS */}
      <section style={{ maxWidth: 440, width: '100%', margin: '20px auto 0', padding: '0 20px' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '16px 20px',
            fontSize: 12,
            color: '#475569',
            lineHeight: 1.65,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: '#ea580c' }}>1. Download:</strong> Tap the button above (choose <em>&ldquo;Download anyway&rdquo;</em> if prompted).
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: '#ea580c' }}>2. Install:</strong> Open the downloaded APK and allow installation.
          </div>
          <div>
            <strong style={{ color: '#ea580c' }}>3. Sign In:</strong> Log in with your BEMS staff email and password.
          </div>
        </div>
      </section>
    </div>
  );
}
