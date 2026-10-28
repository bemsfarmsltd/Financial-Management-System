'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface GateConfig {
  appId: string;
  appName: string;
  packageName: string;
  minimumAllowedVersion: string;
  latestVersionAvailable: string;
  forceUpdate: boolean;
  directDownloadUrl: string;
  upgradePromptNotes: string | null;
}

interface ReleaseItem {
  id: string;
  appId: string;
  version: string;
  fileName: string;
  fileSize: string;
  downloadUrl: string;
  status: string;
  notes: string | null;
  uploadedBy: string;
  createdAt: string;
}

export default function MobileAppsManagementPage() {
  const [gates, setGates] = useState<Record<string, GateConfig>>({
    GMD_APP: {
      appId: 'GMD_APP',
      appName: 'BEMS GMD AI',
      packageName: 'com.bemsgroup.gmd_ai',
      minimumAllowedVersion: '1.0.0',
      latestVersionAvailable: '1.0.0',
      forceUpdate: true,
      directDownloadUrl: 'https://bemserp.work/download/gmd-app.apk',
      upgradePromptNotes: 'Critical executive balance sync and cryptographic maker-checker enhancements.',
    },
    STAFF_APP: {
      appId: 'STAFF_APP',
      appName: 'BEMS Staff App',
      packageName: 'com.bemsgroup.staff',
      minimumAllowedVersion: '1.0.0',
      latestVersionAvailable: '1.0.0',
      forceUpdate: true,
      directDownloadUrl: 'https://bemserp.work/download/staff-app.apk',
      upgradePromptNotes: 'Streamlined expenditure requisitions, offline drafts and receipt uploads.',
    },
  });

  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingGate, setSavingGate] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Upload states
  const [uploadingGmd, setUploadingGmd] = useState(false);
  const [gmdFile, setGmdFile] = useState<File | null>(null);
  const [gmdVersion, setGmdVersion] = useState('1.0.1');
  const [gmdApplyMin, setGmdApplyMin] = useState(true);

  const [uploadingStaff, setUploadingStaff] = useState(false);
  const [staffFile, setStaffFile] = useState<File | null>(null);
  const [staffVersion, setStaffVersion] = useState('1.0.1');
  const [staffApplyMin, setStaffApplyMin] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/mobile-apps');
      if (res.ok) {
        const data = await res.json();
        if (data.gates) {
          setGates(prev => ({
            ...prev,
            ...data.gates,
          }));
        }
        if (data.releases) {
          setReleases(data.releases);
        }
      }
    } catch (err) {
      console.error('Failed to load mobile apps settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGateChange = (appId: string, field: keyof GateConfig, value: any) => {
    setGates(prev => ({
      ...prev,
      [appId]: {
        ...prev[appId],
        [field]: value,
      },
    }));
  };

  const saveGateRules = async () => {
    try {
      setSavingGate(true);
      setNotice(null);

      // Save GMD_APP and STAFF_APP rules
      await Promise.all([
        fetch('/api/admin/mobile-apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gates.GMD_APP),
        }),
        fetch('/api/admin/mobile-apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gates.STAFF_APP),
        }),
      ]);

      setNotice({
        type: 'success',
        message: 'Gate rules saved in real time! All apps below minimum allowed version will immediately be gated with HTTP 426.',
      });
      loadData();
    } catch (err) {
      setNotice({ type: 'error', message: 'Failed to save gate rules. Please check your network connection.' });
    } finally {
      setSavingGate(false);
    }
  };

  const uploadApk = async (appId: 'GMD_APP' | 'STAFF_APP') => {
    const isGmd = appId === 'GMD_APP';
    const file = isGmd ? gmdFile : staffFile;
    const version = isGmd ? gmdVersion : staffVersion;
    const applyAsMin = isGmd ? gmdApplyMin : staffApplyMin;

    if (!file) {
      setNotice({ type: 'error', message: `Please select an APK file for ${isGmd ? 'BEMS GMD AI' : 'BEMS Staff App'}.` });
      return;
    }

    try {
      if (isGmd) setUploadingGmd(true);
      else setUploadingStaff(true);
      setNotice(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('appId', appId);
      formData.append('version', version);
      formData.append('applyAsMin', applyAsMin ? 'true' : 'false');
      formData.append('notes', gates[appId]?.upgradePromptNotes || '');

      const res = await fetch('/api/admin/mobile-apps/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deploy APK');
      }

      setNotice({
        type: 'success',
        message: `✓ Successfully published ${isGmd ? 'BEMS GMD AI' : 'BEMS Staff App'} v${version} (${data.release?.fileSize || 'Done'})! Direct download URL is now active.`,
      });

      if (isGmd) setGmdFile(null);
      else setStaffFile(null);

      loadData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Error uploading APK.' });
    } finally {
      if (isGmd) setUploadingGmd(false);
      else setUploadingStaff(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header bar */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
            <Link href="/finance" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>Settings</Link>
            <span>/</span>
            <span style={{ color: '#334155', fontWeight: 600 }}>Mobile Apps</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Mobile Apps Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Upload and update the official Android APK builds served to executive leadership and field staff.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '6px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            Live Download Gate Active
          </span>
          <Link
            href="/download"
            target="_blank"
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
          >
            Public Download Page ↗
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px' }}>
        {notice && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 8,
              marginBottom: 24,
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: notice.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: notice.type === 'success' ? '#166534' : '#991b1b',
              border: `1px solid ${notice.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            }}
          >
            <span>{notice.message}</span>
            <button onClick={() => setNotice(null)} style={{ background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 800, color: 'inherit' }}>✕</button>
          </div>
        )}

        {/* Card 1: App Version Control & Upgrade Gates */}
        <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ background: '#ffedd5', color: '#c2410c', fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>
                  HTTP 426 GATE
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  App Version Control & Upgrade Gates
                </h2>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 840, lineHeight: 1.5 }}>
                Configure minimum version thresholds in real time. Mobile apps below the minimum version are immediately blocked from placing requisitions, logging in, or querying data until they download the update.
              </p>
            </div>
            <button
              onClick={saveGateRules}
              disabled={savingGate}
              style={{
                background: '#0f172a',
                color: '#fff',
                border: 0,
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {savingGate ? 'Saving Rules…' : 'Save Gate Rules'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            {/* GMD App Rules */}
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ffedd5', color: '#ea580c', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 900 }}>
                    👑
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>GMD AI App Rules</strong>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>com.bemsgroup.gmd_ai</div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={gates.GMD_APP?.forceUpdate ?? true}
                    onChange={e => handleGateChange('GMD_APP', 'forceUpdate', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#ea580c' }}
                  />
                  Force Update
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Minimum Allowed Version <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={gates.GMD_APP?.minimumAllowedVersion || '1.0.0'}
                    onChange={e => handleGateChange('GMD_APP', 'minimumAllowedVersion', e.target.value)}
                    style={{ width: '100%', height: 38, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#ef4444' }}
                  />
                  <small style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 3 }}>
                    Apps below this version will be blocked with 426.
                  </small>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Latest Version Available
                  </label>
                  <input
                    type="text"
                    value={gates.GMD_APP?.latestVersionAvailable || '1.0.0'}
                    onChange={e => handleGateChange('GMD_APP', 'latestVersionAvailable', e.target.value)}
                    style={{ width: '100%', height: 38, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}
                  />
                  <small style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 3 }}>
                    Recommended target version shown in update dialog.
                  </small>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  GMD APK Direct Download URL
                </label>
                <input
                  type="text"
                  value={gates.GMD_APP?.directDownloadUrl || 'https://bemserp.work/download/gmd-app.apk'}
                  onChange={e => handleGateChange('GMD_APP', 'directDownloadUrl', e.target.value)}
                  style={{ width: '100%', height: 38, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 10px', fontSize: 12, color: '#334155' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Upgrade Prompt Notes
                </label>
                <textarea
                  rows={2}
                  value={gates.GMD_APP?.upgradePromptNotes || ''}
                  onChange={e => handleGateChange('GMD_APP', 'upgradePromptNotes', e.target.value)}
                  placeholder="Explain why this upgrade is mandatory (e.g. Critical balance reconciliation fixes)..."
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#334155', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Staff App Rules */}
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#e0f2fe', color: '#0284c7', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 900 }}>
                    📱
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>Staff App Rules</strong>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>com.bemsgroup.staff</div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={gates.STAFF_APP?.forceUpdate ?? true}
                    onChange={e => handleGateChange('STAFF_APP', 'forceUpdate', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#0284c7' }}
                  />
                  Force Update
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Minimum Allowed Version <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={gates.STAFF_APP?.minimumAllowedVersion || '1.0.0'}
                    onChange={e => handleGateChange('STAFF_APP', 'minimumAllowedVersion', e.target.value)}
                    style={{ width: '100%', height: 38, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#ef4444' }}
                  />
                  <small style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 3 }}>
                    Staff below this version are blocked with 426.
                  </small>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Latest Version Available
                  </label>
                  <input
                    type="text"
                    value={gates.STAFF_APP?.latestVersionAvailable || '1.0.0'}
                    onChange={e => handleGateChange('STAFF_APP', 'latestVersionAvailable', e.target.value)}
                    style={{ width: '100%', height: 38, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}
                  />
                  <small style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 3 }}>
                    Recommended target version shown in update dialog.
                  </small>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Staff APK Direct Download URL
                </label>
                <input
                  type="text"
                  value={gates.STAFF_APP?.directDownloadUrl || 'https://bemserp.work/download/staff-app.apk'}
                  onChange={e => handleGateChange('STAFF_APP', 'directDownloadUrl', e.target.value)}
                  style={{ width: '100%', height: 38, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 10px', fontSize: 12, color: '#334155' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Upgrade Prompt Notes
                </label>
                <textarea
                  rows={2}
                  value={gates.STAFF_APP?.upgradePromptNotes || ''}
                  onChange={e => handleGateChange('STAFF_APP', 'upgradePromptNotes', e.target.value)}
                  placeholder="Explain why this upgrade is mandatory (e.g. Offline drafts and camera permissions)..."
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#334155', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Instant Live Effect banner */}
          <div style={{ marginTop: 20, background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <p style={{ margin: 0, fontSize: 12, color: '#0f766e', lineHeight: 1.5 }}>
              <strong>Instant Live Effect:</strong> Whenever you build and upload a new APK (e.g. v1.0.1), simply increment <strong>Minimum Allowed Version</strong> to <code>1.0.1</code> here and click Save. All outdated apps will be immediately gated with HTTP 426 on their next API request.
            </p>
          </div>
        </section>

        {/* Card 2 & 3: APK Direct Upload & Deployment */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* GMD AI Upload */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>GMD AI Mobile App</h3>
                <small style={{ color: '#64748b', fontSize: 12 }}>Target: <code>gmd-app.apk</code></small>
              </div>
              <span style={{ background: '#ffedd5', color: '#c2410c', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 9999 }}>
                For GMD & Executives
              </span>
            </div>

            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 10,
                padding: '24px 16px',
                textAlign: 'center',
                background: '#fafafa',
                marginBottom: 16,
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('gmd-file-input')?.click()}
            >
              <input
                id="gmd-file-input"
                type="file"
                accept=".apk"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files?.[0]) setGmdFile(e.target.files[0]);
                }}
              />
              <div style={{ fontSize: 28, marginBottom: 8 }}>☁️</div>
              <strong style={{ display: 'block', fontSize: 13, color: '#0f172a' }}>
                {gmdFile ? gmdFile.name : 'Click to select or drag and drop new APK'}
              </strong>
              <small style={{ color: '#64748b', fontSize: 11 }}>
                {gmdFile ? `${(gmdFile.size / (1024 * 1024)).toFixed(1)} MB ready to deploy` : 'Accepts Android Application Package (.apk) up to 200MB'}
              </small>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Release Version
                </label>
                <input
                  type="text"
                  value={gmdVersion}
                  onChange={e => setGmdVersion(e.target.value)}
                  placeholder="e.g. 1.0.1"
                  style={{ width: '100%', height: 38, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 10px', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={gmdApplyMin}
                    onChange={e => setGmdApplyMin(e.target.checked)}
                    style={{ accentColor: '#ea580c' }}
                  />
                  Set as Min Version
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
              <a
                href="/download/gmd-app.apk"
                download
                style={{ fontSize: 12, color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
              >
                📥 Test Download Current
              </a>
              <button
                onClick={() => uploadApk('GMD_APP')}
                disabled={uploadingGmd || !gmdFile}
                style={{
                  background: '#ea580c',
                  color: '#fff',
                  border: 0,
                  padding: '9px 16px',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: !gmdFile ? 'not-allowed' : 'pointer',
                  opacity: !gmdFile ? 0.6 : 1,
                }}
              >
                {uploadingGmd ? 'Uploading APK…' : 'Deploy GMD APK'}
              </button>
            </div>
          </div>

          {/* Staff App Upload */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>BEMS Staff App</h3>
                <small style={{ color: '#64748b', fontSize: 12 }}>Target: <code>staff-app.apk</code></small>
              </div>
              <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 9999 }}>
                For Field & Staff
              </span>
            </div>

            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 10,
                padding: '24px 16px',
                textAlign: 'center',
                background: '#fafafa',
                marginBottom: 16,
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('staff-file-input')?.click()}
            >
              <input
                id="staff-file-input"
                type="file"
                accept=".apk"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files?.[0]) setStaffFile(e.target.files[0]);
                }}
              />
              <div style={{ fontSize: 28, marginBottom: 8 }}>☁️</div>
              <strong style={{ display: 'block', fontSize: 13, color: '#0f172a' }}>
                {staffFile ? staffFile.name : 'Click to select or drag and drop new APK'}
              </strong>
              <small style={{ color: '#64748b', fontSize: 11 }}>
                {staffFile ? `${(staffFile.size / (1024 * 1024)).toFixed(1)} MB ready to deploy` : 'Accepts Android Application Package (.apk) up to 200MB'}
              </small>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Release Version
                </label>
                <input
                  type="text"
                  value={staffVersion}
                  onChange={e => setStaffVersion(e.target.value)}
                  placeholder="e.g. 1.0.1"
                  style={{ width: '100%', height: 38, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 10px', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={staffApplyMin}
                    onChange={e => setStaffApplyMin(e.target.checked)}
                    style={{ accentColor: '#0284c7' }}
                  />
                  Set as Min Version
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
              <a
                href="/download/staff-app.apk"
                download
                style={{ fontSize: 12, color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
              >
                📥 Test Download Current
              </a>
              <button
                onClick={() => uploadApk('STAFF_APP')}
                disabled={uploadingStaff || !staffFile}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 0,
                  padding: '9px 16px',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: !staffFile ? 'not-allowed' : 'pointer',
                  opacity: !staffFile ? 0.6 : 1,
                }}
              >
                {uploadingStaff ? 'Uploading APK…' : 'Deploy Staff APK'}
              </button>
            </div>
          </div>
        </section>

        {/* Card 4: Upload & Release History Table */}
        <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Upload & Release History
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Detailed log of every GMD AI and Staff build published to the server.
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
            >
              ↻ Refresh Log
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '10px 12px' }}>Application</th>
                  <th style={{ padding: '10px 12px' }}>Target File</th>
                  <th style={{ padding: '10px 12px' }}>File Size</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Uploaded By</th>
                  <th style={{ padding: '10px 12px' }}>Date & Time</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {releases.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                      No APK builds deployed yet. Use the upload cards above to publish your first mobile releases.
                    </td>
                  </tr>
                ) : (
                  releases.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>
                        {item.appId === 'GMD_APP' ? '👑 BEMS GMD AI' : '📱 BEMS Staff App'}
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>v{item.version}</div>
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: '#ea580c', fontWeight: 600 }}>
                        {item.fileName}
                      </td>
                      <td style={{ padding: '12px', color: '#475569' }}>{item.fileSize}</td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: item.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                            color: item.status === 'ACTIVE' ? '#059669' : '#64748b',
                            border: `1px solid ${item.status === 'ACTIVE' ? '#a7f3d0' : '#e2e8f0'}`,
                          }}
                        >
                          {item.status === 'ACTIVE' ? 'Live Storefront' : 'Replaced / Archive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#475569' }}>{item.uploadedBy}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>
                        {new Date(item.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <a
                          href={item.downloadUrl}
                          download
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#0284c7',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
