import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PublicDownloadPage() {
  const staffGate = await prisma.mobileAppGate.findUnique({
    where: { appId: 'STAFF_APP' },
  });

  const staffVersion = staffGate?.latestVersionAvailable || '1.0.8';

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 10% 10%, #1e1b4b 0%, #090d16 100%)', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: 60 }}>
      {/* Navbar */}
      <nav style={{ maxWidth: 1000, margin: '0 auto', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/bems-group-logo.png?v=20261024" alt="BEMS Group" style={{ width: 38, height: 38, objectFit: 'contain' }} />
          <div>
            <strong style={{ fontSize: 17, letterSpacing: '-0.02em', display: 'block', color: '#fff' }}>BEMS GROUP</strong>
            <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#38bdf8', fontWeight: 800 }}>Mobile Hub</span>
          </div>
        </div>
        <Link
          href="/finance"
          style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', fontSize: 13, fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          Web Portal →
        </Link>
      </nav>

      {/* Hero */}
      <header style={{ maxWidth: 560, margin: '48px auto 32px', textAlign: 'center', padding: '0 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(2,132,199,0.15)', border: '1px solid rgba(56,189,248,0.35)', padding: '5px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 800, color: '#bae6fd', marginBottom: 16 }}>
          <span>📱 OFFICIAL ANDROID APP</span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 4.5vw, 40px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 10px', color: '#fff' }}>
          BEMS Staff Mobile App
        </h1>
        <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.5, margin: '0 auto' }}>
          Submit fund requests, track disbursements, and manage attendance on the go.
        </p>
      </header>

      {/* Centered Staff App Card */}
      <main style={{ maxWidth: 460, margin: '0 auto', padding: '0 20px' }}>
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.9))',
            borderRadius: 20,
            border: '1.5px solid rgba(2, 132, 199, 0.4)',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(2,132,199,0.15)', border: '1px solid #0284c7', display: 'grid', placeItems: 'center', fontSize: 24 }}>
                📱
              </div>
              <span style={{ background: '#0284c7', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 9999 }}>
                v{staffVersion}
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
              BEMS Staff Portal
            </h2>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.45, margin: '0 0 18px' }}>
              Official mobile portal for BEMS Group staff.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', fontSize: 13, color: '#94a3b8' }}>
              <li style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> Fund requests &amp; 72h receipt uploads
              </li>
              <li style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> Real-time disbursement &amp; payslip tracking
              </li>
              <li style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> QR attendance &amp; digital Staff ID
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
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 10px 20px rgba(2,132,199,0.3)',
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

      {/* Compact Installation Steps */}
      <section style={{ maxWidth: 460, margin: '24px auto 0', padding: '0 20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 20px', fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: '#38bdf8' }}>1. Download:</strong> Tap the button above (choose <em>&ldquo;Download anyway&rdquo;</em> if prompted).
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: '#38bdf8' }}>2. Install:</strong> Open the downloaded APK and allow installation.
          </div>
          <div>
            <strong style={{ color: '#38bdf8' }}>3. Sign In:</strong> Log in with your BEMS staff email and password.
          </div>
        </div>
      </section>
    </div>
  );
}
