'use client';

import React, { useState } from 'react';
import {
  Smartphone,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Users,
  Maximize2,
  Columns,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  userName: string;
  userRole: string;
}

type ViewMode = 'both' | 'gmd' | 'staff';
type DeviceSize = 'iphone' | 'compact';

export function MobileAppsViewerClient({ userName, userRole }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('iphone');
  const [gmdKey, setGmdKey] = useState(0);
  const [staffKey, setStaffKey] = useState(0);

  const dimensions =
    deviceSize === 'iphone'
      ? { width: 393, height: 800 }
      : { width: 360, height: 740 };

  const reloadGmd = () => setGmdKey((k) => k + 1);
  const reloadStaff = () => setStaffKey((k) => k + 1);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 40 }}>
      {/* 1. HEADER SECTION */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <span
            style={{
              fontSize: '8px',
              letterSpacing: '1.2px',
              fontWeight: 800,
              color: '#ea580c',
              textTransform: 'uppercase',
            }}
          >
            BEMS ENTERPRISE MOBILE ECOSYSTEM · LIVE WEB SIMULATOR
          </span>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              margin: '4px 0 2px',
              letterSpacing: '-0.3px',
              color: '#0f172a',
            }}
          >
            Mobile Applications Web Suite
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
            Interact with, test, and preview the live Flutter Web builds of both BEMS mobile apps on any desktop browser.
          </p>
        </div>

        {/* View Mode & Dimension Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Mode Switcher */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('both')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                border: 0,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: viewMode === 'both' ? '#ffffff' : 'transparent',
                color: viewMode === 'both' ? '#ea580c' : '#64748b',
                boxShadow: viewMode === 'both' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Columns size={12} /> Side-by-Side Dual View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gmd')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                border: 0,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: viewMode === 'gmd' ? '#ffffff' : 'transparent',
                color: viewMode === 'gmd' ? '#ea580c' : '#64748b',
                boxShadow: viewMode === 'gmd' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={12} /> BEMS GMD AI
            </button>
            <button
              type="button"
              onClick={() => setViewMode('staff')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                border: 0,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: viewMode === 'staff' ? '#ffffff' : 'transparent',
                color: viewMode === 'staff' ? '#ea580c' : '#64748b',
                boxShadow: viewMode === 'staff' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={12} /> BEMS Staff App
            </button>
          </div>

          {/* Device Dimension Toggle */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={() => setDeviceSize('iphone')}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: 0,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: deviceSize === 'iphone' ? '#ffffff' : 'transparent',
                color: deviceSize === 'iphone' ? '#0f172a' : '#64748b',
                boxShadow: deviceSize === 'iphone' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              iPhone 16 Pro
            </button>
            <button
              type="button"
              onClick={() => setDeviceSize('compact')}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: 0,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: deviceSize === 'compact' ? '#ffffff' : 'transparent',
                color: deviceSize === 'compact' ? '#0f172a' : '#64748b',
                boxShadow: deviceSize === 'compact' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Compact Mobile
            </button>
          </div>
        </div>
      </div>

      {/* 2. STATS & OVERVIEW CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              EXECUTIVE APP
            </span>
            <Sparkles size={14} color="#ea580c" />
          </div>
          <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>
            BEMS GMD AI Mobile
          </strong>
          <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>
            Voice memo approval, AI budget analytics, Monnify releases &amp; group oversight.
          </p>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              EMPLOYEE PORTAL
            </span>
            <Users size={14} color="#2563eb" />
          </div>
          <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>
            BEMS Staff Requisition App
          </strong>
          <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>
            Self-service onboarding, fund requests, digital wallet withdrawals &amp; QR attendance.
          </p>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              RUNTIME ENGINE
            </span>
            <CheckCircle2 size={14} color="#16a34a" />
          </div>
          <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>
            Flutter Web 3.24.5 Bundle
          </strong>
          <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>
            Direct backend API integration with live session cookies and zero CORS barriers.
          </p>
        </div>
      </div>

      {/* 3. SIMULATOR FRAMES CONTAINER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 32,
          padding: '24px 16px',
          background: '#f8fafc',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
        }}
      >
        {/* FRAME 1: BEMS GMD AI */}
        {(viewMode === 'both' || viewMode === 'gmd') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* Device Action Bar */}
            <div
              style={{
                width: dimensions.width,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>BEMS GMD AI</span>
                <span style={{ fontSize: 10, background: '#fff7ed', color: '#ea580c', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid #fed7aa' }}>
                  v1.3.5
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={reloadGmd}
                  title="Reload App"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={11} /> Reload
                </button>
                <a
                  href="/gmd-app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Fullscreen"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#475569',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ExternalLink size={11} /> Fullscreen
                </a>
              </div>
            </div>

            {/* Phone Chassis */}
            <div
              style={{
                width: dimensions.width,
                height: dimensions.height,
                background: '#0f172a',
                borderRadius: 44,
                padding: '12px 10px',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {/* Dynamic Island / Notch */}
              <div
                style={{
                  width: 100,
                  height: 22,
                  background: '#000000',
                  borderRadius: 14,
                  position: 'absolute',
                  top: 18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              />

              {/* Iframe Viewport */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 34,
                  overflow: 'hidden',
                  background: '#ffffff',
                  position: 'relative',
                }}
              >
                <iframe
                  key={gmdKey}
                  src="/gmd-app/"
                  title="BEMS GMD AI Mobile App"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 0,
                    display: 'block',
                  }}
                />
              </div>

              {/* Home Indicator */}
              <div
                style={{
                  width: 120,
                  height: 4,
                  background: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: 2,
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              />
            </div>
          </div>
        )}

        {/* FRAME 2: BEMS STAFF APP */}
        {(viewMode === 'both' || viewMode === 'staff') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* Device Action Bar */}
            <div
              style={{
                width: dimensions.width,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>BEMS Staff App</span>
                <span style={{ fontSize: 10, background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                  v1.3.5
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={reloadStaff}
                  title="Reload App"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={11} /> Reload
                </button>
                <a
                  href="/staff-app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Fullscreen"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#475569',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ExternalLink size={11} /> Fullscreen
                </a>
              </div>
            </div>

            {/* Phone Chassis */}
            <div
              style={{
                width: dimensions.width,
                height: dimensions.height,
                background: '#0f172a',
                borderRadius: 44,
                padding: '12px 10px',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {/* Dynamic Island / Notch */}
              <div
                style={{
                  width: 100,
                  height: 22,
                  background: '#000000',
                  borderRadius: 14,
                  position: 'absolute',
                  top: 18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              />

              {/* Iframe Viewport */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 34,
                  overflow: 'hidden',
                  background: '#ffffff',
                  position: 'relative',
                }}
              >
                <iframe
                  key={staffKey}
                  src="/staff-app/"
                  title="BEMS Staff Mobile App"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 0,
                    display: 'block',
                  }}
                />
              </div>

              {/* Home Indicator */}
              <div
                style={{
                  width: 120,
                  height: 4,
                  background: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: 2,
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
