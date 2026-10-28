import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PublicDownloadPage() {
  const [gmdGate, staffGate] = await Promise.all([
    prisma.mobileAppGate.findUnique({ where: { appId: 'GMD_APP' } }),
    prisma.mobileAppGate.findUnique({ where: { appId: 'STAFF_APP' } }),
  ]);

  const gmdVersion = gmdGate?.latestVersionAvailable || '1.0.0';
  const staffVersion = staffGate?.latestVersionAvailable || '1.0.0';

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 10% 10%, #1e1b4b 0%, #090d16 100%)', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: 60 }}>
      {/* Navbar */}
      <nav style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/bems-group-logo.png?v=20261024" alt="BEMS Group" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div>
            <strong style={{ fontSize: 18, letterSpacing: '-0.02em', display: 'block', color: '#fff' }}>BEMS GROUP</strong>
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#f97316', fontWeight: 800 }}>Mobile Hub</span>
          </div>
        </div>
        <Link
          href="/finance"
          style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fed7aa', fontSize: 13, fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(249,115,22,0.3)' }}
        >
          Staff & Admin Portal →
        </Link>
      </nav>

      {/* Hero */}
      <header style={{ maxWidth: 840, margin: '60px auto 40px', textAlign: 'center', padding: '0 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)', padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 800, color: '#ffedd5', marginBottom: 20 }}>
          <span>🚀 OFFICIAL ANDROID BUILDS</span>
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 16px', color: '#fff' }}>
          Download BEMS Mobile Apps
        </h1>
        <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.6, maxWidth: 640, margin: '0 auto' }}>
          Install the official, production-verified Android applications for corporate governance, executive fund approvals, and staff expenditure requisitions.
        </p>
      </header>

      {/* Download Grid */}
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* Card 1: GMD AI Mobile App */}
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.9))',
            borderRadius: 20,
            border: '1.5px solid rgba(249, 115, 22, 0.35)',
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, background: 'rgba(249,115,22,0.15)', border: '1px solid #f97316', display: 'grid', placeItems: 'center', fontSize: 26 }}>
                👑
              </div>
              <span style={{ background: '#ea580c', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 9999 }}>
                v{gmdVersion}
              </span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>
              BEMS GMD AI Mobile App
            </h2>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 20px' }}>
              Executive command desk for the Group Managing Director and leadership. Review real-time treasury balances, approve requisitions, and audit operations with the BEMI AI Copilot.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', fontSize: 12, color: '#94a3b8' }}>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> Real-time multi-bank treasury pool
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> 1-Tap cryptographic maker-checker approvals
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> Grounded AI Financial Copilot
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> Biometric hardware fingerprint / Face ID
              </li>
            </ul>
          </div>

          <div>
            <a
              href="/download/gmd-app.apk"
              download="BemsGmdAi.apk"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 10px 20px rgba(234,88,12,0.3)',
              }}
            >
              <span>📥 Download GMD AI APK</span>
            </a>
            <small style={{ display: 'block', textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 10 }}>
              Package: com.bemsgroup.gmd_ai · Android 8.0+
            </small>
          </div>
        </div>

        {/* Card 2: Staff Mobile App */}
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.9))',
            borderRadius: 20,
            border: '1.5px solid rgba(2, 132, 199, 0.35)',
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, background: 'rgba(2,132,199,0.15)', border: '1px solid #0284c7', display: 'grid', placeItems: 'center', fontSize: 26 }}>
                📱
              </div>
              <span style={{ background: '#0284c7', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 9999 }}>
                v{staffVersion}
              </span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>
              BEMS Staff Mobile App
            </h2>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 20px' }}>
              Official mobile app for BEMS subsidiary personnel. Submit expense requisitions, track disbursement progress into your verified bank account, and upload camera receipts within 72h.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', fontSize: 12, color: '#94a3b8' }}>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> Rapid fund request submission with camera proof
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> Direct bank disbursement tracking
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> 72-Hour accountability evidence close-out
              </li>
              <li style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> Official Unique Staff ID dossier
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
                gap: 10,
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
              Package: com.bemsgroup.staff · Android 8.0+
            </small>
          </div>
        </div>
      </main>

      {/* Installation Instructions */}
      <section style={{ maxWidth: 1000, margin: '48px auto 0', padding: '0 20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px 28px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>
            📱 Android Installation Instructions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            <div>
              <strong style={{ color: '#f97316' }}>1. Download File:</strong> Tap the download button above. If Chrome shows a security warning, tap <em>"Download anyway"</em>.
            </div>
            <div>
              <strong style={{ color: '#f97316' }}>2. Enable Installs:</strong> Tap the downloaded file. If prompted, allow your browser to install unknown apps from this source.
            </div>
            <div>
              <strong style={{ color: '#f97316' }}>3. Sign In:</strong> Launch the app and sign in with your verified BEMS email and password.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
