'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  ShieldCheck,
  RefreshCw,
  Maximize2,
  Minimize2,
  Wifi,
  Zap,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Radio,
  Search,
  X,
  UserCheck,
  Users,
  Download,
  Laptop,
  Check,
} from 'lucide-react';

interface StationData {
  stationCode: string;
  stationName: string;
  organizationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  qrToken: string;
  qrDataUrl?: string;
  qrSvg?: string;
  expiresInSeconds: number;
  powerOutageMode?: boolean;
  requireStarlinkIp?: boolean;
  earliestCheckInTime?: string;
  resumptionTime?: string;
  gracePeriodMinutes?: number;
}

export default function AttendanceKioskPage() {
  const [stationData, setStationData] = useState<StationData | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isQrOnlyFullscreen, setIsQrOnlyFullscreen] = useState<boolean>(false);
  const [recentPunches, setRecentPunches] = useState<any[]>([]);
  const [totalPresentCount, setTotalPresentCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // PWA Desktop App Installation
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  // Live West Africa Time Clock
  useEffect(() => {
    function tick() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Africa/Lagos',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-GB', {
          timeZone: 'Africa/Lagos',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      );
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Register Service Worker & capture PWA install prompt
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration note:', err);
      });
    }

    // Check if already installed
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      if (isStandalone) {
        setIsInstalled(true);
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Fetch token and pre-rendered QR
  const fetchToken = async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/attendance/station/qr', { cache: 'no-store' });
      if (!res.ok) throw new Error('Unable to connect to station server');
      const data: StationData = await res.json();
      setStationData(data);
      setSecondsRemaining(data.expiresInSeconds || 45);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error loading QR code:', err);
      setLoadError(err?.message || 'Unable to refresh QR code');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
  }, []);

  // 45-second countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          fetchToken();
          return 45;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll recent arrivals & all staff who marked attendance today
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/attendance/timesheet?kiosk=true');
        if (res.ok) {
          const data = await res.json();
          const activeToday = (data.employees || []).filter((e: any) => e.checkInTime && e.role === 'STAFF');
          setRecentPunches(activeToday);
          setTotalPresentCount(activeToday.length);
        }
      } catch (e) {
        // quiet ignore
      }
    };
    fetchRecent();
    const interval = setInterval(fetchRecent, 10000);
    return () => clearInterval(interval);
  }, []);

  // Synchronize System Fullscreen state on fullscreenchange (Esc or browser button)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const activeFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      setIsFullscreen(activeFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle ESC key to exit QR-only fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isQrOnlyFullscreen) {
          setIsQrOnlyFullscreen(false);
        }
        if (showInstallModal) {
          setShowInstallModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQrOnlyFullscreen, showInstallModal]);

  // Toggle System Fullscreen
  const togglePageFullscreen = () => {
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Trigger PWA Installation on PC and start launcher download
  const handleInstallClick = async () => {
    // 1. Immediately trigger the download of the PC launcher file
    try {
      const link = document.createElement('a');
      link.href = '/api/download/kiosk-launcher?type=bat';
      link.download = 'Launch-BEMS-Kiosk-PC.bat';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      // quiet fallback
    }

    // 2. Also trigger PWA prompt if available, or show install modal
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        setShowInstallModal(true);
      }
    } else {
      // Guide user to the browser's native install option in address bar
      setShowInstallModal(true);
    }
  };

  // Filtered staff list for search
  const filteredStaff = recentPunches.filter((p: any) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = (p.legalName || '').toLowerCase().includes(term);
    const roleMatch = (p.role || '').toLowerCase().includes(term);
    const deptMatch = (p.department || '').toLowerCase().includes(term);
    return nameMatch || roleMatch || deptMatch;
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 
        TOP HEADER:
        "this should close on full screen" -> When isFullscreen is active, this header automatically closes/hides.
      */}
      {!isFullscreen && (
        <header
          style={{
            padding: '16px 36px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <img
                src="/bems-mark.png?v=20261024"
                alt="BEMS"
                style={{ width: 26, height: 26, objectFit: 'contain' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.4px' }}>
                  BEMS Attendance Kiosk
                </h1>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 9px',
                    borderRadius: '20px',
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Radio size={11} className="animate-pulse" />
                  LIVE
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                {stationData?.stationName || 'BEMS Group Corporate Headquarters'} · Victoria Island HQ
              </div>
            </div>
          </div>

          {/* Top Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Download/Install on PC Button */}
            <button
              onClick={handleInstallClick}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: isInstalled ? '#f8fafc' : '#eff6ff',
                border: isInstalled ? '1px solid #e2e8f0' : '1px solid #bfdbfe',
                color: isInstalled ? '#475569' : '#1d4ed8',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                transition: 'all 0.15s ease',
              }}
              title="Download & install BEMS Kiosk as standalone software on your PC"
            >
              {isInstalled ? <Check size={14} color="#059669" /> : <Laptop size={14} />}
              <span>{isInstalled ? 'App Installed' : 'Download PC App'}</span>
            </button>

            {/* Refresh Token */}
            <button
              onClick={fetchToken}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#334155',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Refresh QR token"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {/* Fullscreen 1: QR Code Only Fullscreen */}
            <button
              onClick={() => setIsQrOnlyFullscreen(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#059669',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Expand only QR code to full screen"
            >
              <Maximize2 size={14} />
              <span>Fullscreen QR</span>
            </button>

            {/* Fullscreen 2: System Fullscreen (Hides header, fills entire monitor) */}
            <button
              onClick={togglePageFullscreen}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#334155',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Put entire kiosk in full screen"
            >
              <Maximize2 size={14} />
              <span>Kiosk Screen</span>
            </button>
          </div>
        </header>
      )}

      {/* Floating Exit Button for System Fullscreen Mode (Allows clean exit and restores header) */}
      {isFullscreen && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
              fontWeight: 800,
              color: '#059669',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            ● LIVE KIOSK FULLSCREEN
          </span>

          <button
            onClick={togglePageFullscreen}
            style={{
              padding: '9px 18px',
              borderRadius: '12px',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 8px 25px rgba(15, 23, 42, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <Minimize2 size={15} />
            <span>Exit Fullscreen (Esc)</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          maxWidth: '1340px',
          width: '100%',
          margin: '0 auto',
          padding: isFullscreen ? '20px 28px' : '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Top Info & Summary Card (Full Width at Top) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '22px 28px',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '32px',
            alignItems: 'center',
          }}
        >
          {/* Big "Total Clock-Ins" Box */}
          <div
            style={{
              padding: '16px 24px',
              borderRadius: '16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              minWidth: '130px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Clock-Ins
            </div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginTop: '4px' }}>
              {totalPresentCount}
            </div>
            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '4px' }}>
              ● Today's Present
            </div>
          </div>

          {/* Grid of Key Info Parameters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '18px 24px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Official WAT Time</div>
              <strong style={{ fontSize: '15px', color: '#0f172a', fontWeight: 800, display: 'block', marginTop: '2px' }}>
                {currentTime || '--:--'}
              </strong>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{currentDate}</span>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Arrival Window</div>
              <strong style={{ fontSize: '15px', color: '#0284c7', fontWeight: 800, display: 'block', marginTop: '2px' }}>
                {stationData?.earliestCheckInTime || '07:00'} – {stationData?.resumptionTime || '08:00'} AM
              </strong>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Prior to 7 AM locked</span>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Grace Period Limit</div>
              <strong style={{ fontSize: '15px', color: '#d97706', fontWeight: 800, display: 'block', marginTop: '2px' }}>
                08:15 AM
              </strong>
              <span style={{ fontSize: '11px', color: '#dc2626' }}>5% salary deduction after</span>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Network Security</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: stationData?.powerOutageMode ? '#fffbeb' : '#ecfdf5',
                    color: stationData?.powerOutageMode ? '#b45309' : '#059669',
                    border: stationData?.powerOutageMode ? '1px solid #fde68a' : '1px solid #a7f3d0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {stationData?.powerOutageMode ? <Zap size={10} /> : <Wifi size={10} />}
                  {stationData?.powerOutageMode ? 'Outage Mode' : 'Starlink Wi-Fi'}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                {stationData?.radiusMeters || 100}m Geofence
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Main Section: QR Code on the Left, List of Staff on the Right */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(380px, 460px) 1fr',
            gap: '24px',
            alignItems: 'stretch',
          }}
        >
          {/* LEFT COLUMN: Dynamic QR Showcase Card */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              padding: '32px 28px',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Top Prompt Badge */}
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#059669',
                  background: '#ecfdf5',
                  padding: '5px 14px',
                  borderRadius: '20px',
                  border: '1px solid #a7f3d0',
                  letterSpacing: '0.5px',
                }}
              >
                <Sparkles size={12} />
                POINT MOBILE APP CAMERA HERE
              </span>
            </div>

            {/* QR Viewfinder with Corner Bracket Reticles */}
            <div
              style={{
                width: '300px',
                height: '300px',
                position: 'relative',
                display: 'grid',
                placeItems: 'center',
                padding: '12px',
              }}
            >
              {/* Top-Left Bracket Reticle */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '32px',
                  height: '32px',
                  borderTop: '4px solid #10b981',
                  borderLeft: '4px solid #10b981',
                  borderRadius: '10px 0 0 0',
                }}
              />

              {/* Top-Right Bracket Reticle */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '32px',
                  height: '32px',
                  borderTop: '4px solid #10b981',
                  borderRight: '4px solid #10b981',
                  borderRadius: '0 10px 0 0',
                }}
              />

              {/* Bottom-Left Bracket Reticle */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '32px',
                  height: '32px',
                  borderBottom: '4px solid #10b981',
                  borderLeft: '4px solid #10b981',
                  borderRadius: '0 0 0 10px',
                }}
              />

              {/* Bottom-Right Bracket Reticle */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '32px',
                  height: '32px',
                  borderBottom: '4px solid #10b981',
                  borderRight: '4px solid #10b981',
                  borderRadius: '0 0 10px 0',
                }}
              />

              {/* Dynamic QR Display */}
              <div
                style={{
                  width: '264px',
                  height: '264px',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '14px',
                  display: 'grid',
                  placeItems: 'center',
                  background: '#ffffff',
                }}
              >
                {isLoading ? (
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={36} className="animate-spin" color="#10b981" />
                    <div style={{ fontSize: '12px', marginTop: '10px', fontWeight: 700, color: '#334155' }}>
                      Generating secure QR...
                    </div>
                  </div>
                ) : loadError ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#b91c1c' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', fontWeight: 800 }}>{loadError}</div>
                  </div>
                ) : stationData?.qrSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: stationData.qrSvg }}
                    style={{ width: '256px', height: '256px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                ) : stationData?.qrDataUrl ? (
                  <img
                    src={stationData.qrDataUrl}
                    alt="Attendance QR Code"
                    style={{ width: '256px', height: '256px', display: 'block' }}
                  />
                ) : (
                  <div style={{ color: '#64748b', fontSize: '12px' }}>Loading QR...</div>
                )}

                {/* Animated Horizontal Laser Scanning Line */}
                {!isLoading && !loadError && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: 'linear-gradient(90deg, transparent, #10b981, #34d399, transparent)',
                      boxShadow: '0 0 16px 4px rgba(16, 185, 129, 0.65)',
                      animation: 'scanLaser 2.4s ease-in-out infinite alternate',
                      zIndex: 3,
                    }}
                  />
                )}

                {/* Center Brand Emblem Watermark */}
                {!isLoading && !loadError && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: '#ffffff',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                      display: 'grid',
                      placeItems: 'center',
                      border: '3px solid #10b981',
                      zIndex: 4,
                    }}
                  >
                    <img
                      src="/bems-mark.png?v=20261024"
                      alt="BEMS"
                      style={{ width: 28, height: 28, objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Subtitle Under QR */}
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '16px', textAlign: 'center' }}>
              Scan dynamic QR code with BEMS Staff App to record presence
            </div>

            {/* Countdown & Security Status */}
            <div style={{ width: '100%', maxWidth: '300px', marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 800 }}>
                  <ShieldCheck size={14} />
                  HMAC-SHA256 ACTIVE
                </span>
                <span style={{ color: '#64748b', fontWeight: 700 }}>
                  Refreshes in <strong style={{ color: '#059669', fontSize: '13px' }}>{secondsRemaining}s</strong>
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(secondsRemaining / 45) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: '10px',
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            </div>

            {/* Fullscreen 1: QR Only Button */}
            <button
              onClick={() => setIsQrOnlyFullscreen(true)}
              style={{
                marginTop: '18px',
                width: '100%',
                maxWidth: '300px',
                padding: '11px 16px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ecfdf5';
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.color = '#059669';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.color = '#0f172a';
              }}
            >
              <Maximize2 size={15} />
              <span>Fullscreen QR Code</span>
            </button>
          </div>

          {/* RIGHT COLUMN: List of Staff That Have Marked Attendance */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              padding: '24px 28px',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '480px',
            }}
          >
            {/* Header: Title, Count, & Search */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#16a34a',
                  }}
                >
                  <UserCheck size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Marked Attendance Today
                  </h2>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                    Real-time confirmed presence via Starlink Wi-Fi
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Search Filter */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search staff..."
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '12px',
                      color: '#0f172a',
                      outline: 'none',
                      width: '120px',
                    }}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} color="#94a3b8" />
                    </button>
                  )}
                </div>

                {/* Badge Count */}
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  {filteredStaff.length} Present
                </span>
              </div>
            </div>

            {/* Staff List Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: isFullscreen ? '580px' : '420px',
                paddingRight: '4px',
              }}
            >
              {filteredStaff.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#64748b',
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '16px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#94a3b8',
                      marginBottom: '12px',
                    }}
                  >
                    <Users size={24} />
                  </div>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                    {searchTerm ? 'No matching staff found' : 'No attendance recorded yet today'}
                  </strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '300px', marginTop: '4px' }}>
                    {searchTerm
                      ? 'Try searching with a different employee name or role.'
                      : 'Staff clock-ins scanned on the BEMS Staff App will immediately populate here live.'}
                  </p>
                </div>
              ) : (
                filteredStaff.map((staff: any) => {
                  const checkInFormatted = staff.checkInTime
                    ? new Date(staff.checkInTime).toLocaleTimeString('en-US', {
                        timeZone: 'Africa/Lagos',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : '--:--';

                  const isLate = staff.status === 'LATE';
                  const initials = (staff.legalName || 'ST')
                    .split(' ')
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div
                      key={staff.employeeId}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '14px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: isLate ? '#fef2f2' : '#ecfdf5',
                            border: `1px solid ${isLate ? '#fecaca' : '#a7f3d0'}`,
                            color: isLate ? '#dc2626' : '#059669',
                            fontWeight: 800,
                            fontSize: '13px',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                            {staff.legalName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {staff.role} {staff.department ? `· ${staff.department}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={13} color="#64748b" />
                          {checkInFormatted}
                        </span>

                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: isLate ? '#fef2f2' : '#ecfdf5',
                            color: isLate ? '#dc2626' : '#059669',
                            border: `1px solid ${isLate ? '#fecaca' : '#a7f3d0'}`,
                            letterSpacing: '0.4px',
                          }}
                        >
                          {isLate ? 'LATE' : 'ON TIME'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* FULLSCREEN 1: DEDICATED QR ONLY FULLSCREEN OVERLAY */}
      {isQrOnlyFullscreen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        >
          {/* Top Floating Control Bar */}
          <div
            style={{
              position: 'absolute',
              top: '24px',
              left: '32px',
              right: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <img
                  src="/bems-mark.png?v=20261024"
                  alt="BEMS"
                  style={{ width: 24, height: 24, objectFit: 'contain' }}
                />
              </div>
              <div>
                <strong style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                  BEMS Dynamic Presence Kiosk
                </strong>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Official WAT Time: <strong style={{ color: '#0f172a' }}>{currentTime}</strong> · Total Present Today: <strong style={{ color: '#059669' }}>{totalPresentCount}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={fetchToken}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => setIsQrOnlyFullscreen(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)',
                }}
                title="Close QR Fullscreen"
              >
                <X size={16} />
                <span>Exit Fullscreen (Esc)</span>
              </button>
            </div>
          </div>

          {/* Centered Large QR Viewfinder */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '40px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: '#059669',
                background: '#ecfdf5',
                padding: '6px 18px',
                borderRadius: '24px',
                border: '1px solid #a7f3d0',
                letterSpacing: '0.6px',
                marginBottom: '24px',
              }}
            >
              <Sparkles size={14} />
              POINT MOBILE APP CAMERA HERE
            </span>

            {/* Scaled-Up QR Viewfinder with Corner Brackets */}
            <div
              style={{
                width: '390px',
                height: '390px',
                position: 'relative',
                display: 'grid',
                placeItems: 'center',
                padding: '16px',
              }}
            >
              {/* Brackets */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '42px',
                  height: '42px',
                  borderTop: '5px solid #10b981',
                  borderLeft: '5px solid #10b981',
                  borderRadius: '14px 0 0 0',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '42px',
                  height: '42px',
                  borderTop: '5px solid #10b981',
                  borderRight: '5px solid #10b981',
                  borderRadius: '0 14px 0 0',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '42px',
                  height: '42px',
                  borderBottom: '5px solid #10b981',
                  borderLeft: '5px solid #10b981',
                  borderRadius: '0 0 0 14px',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '42px',
                  height: '42px',
                  borderBottom: '5px solid #10b981',
                  borderRight: '5px solid #10b981',
                  borderRadius: '0 0 14px 0',
                }}
              />

              {/* QR Canvas */}
              <div
                style={{
                  width: '344px',
                  height: '344px',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '18px',
                  display: 'grid',
                  placeItems: 'center',
                  background: '#ffffff',
                }}
              >
                {isLoading ? (
                  <RefreshCw size={48} className="animate-spin" color="#10b981" />
                ) : stationData?.qrSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: stationData.qrSvg }}
                    style={{ width: '336px', height: '336px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                ) : stationData?.qrDataUrl ? (
                  <img
                    src={stationData.qrDataUrl}
                    alt="Attendance QR Code"
                    style={{ width: '336px', height: '336px', display: 'block' }}
                  />
                ) : null}

                {/* Animated Horizontal Laser Line */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: '5px',
                    background: 'linear-gradient(90deg, transparent, #10b981, #34d399, transparent)',
                    boxShadow: '0 0 20px 5px rgba(16, 185, 129, 0.7)',
                    animation: 'scanLaser 2.4s ease-in-out infinite alternate',
                    zIndex: 3,
                  }}
                />

                {/* Center Brand Watermark */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '16px',
                    background: '#ffffff',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
                    display: 'grid',
                    placeItems: 'center',
                    border: '3px solid #10b981',
                    zIndex: 4,
                  }}
                >
                  <img
                    src="/bems-mark.png?v=20261024"
                    alt="BEMS"
                    style={{ width: 36, height: 36, objectFit: 'contain' }}
                  />
                </div>
              </div>
            </div>

            {/* Subtitle Under Scaled QR */}
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, marginTop: '22px', textAlign: 'center' }}>
              Scan dynamic QR code with BEMS Staff App to record presence
            </div>

            {/* Countdown & Security Status */}
            <div style={{ width: '100%', maxWidth: '380px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#059669', fontWeight: 800 }}>
                  <ShieldCheck size={16} />
                  HMAC-SHA256 SECURED
                </span>
                <span style={{ color: '#64748b', fontWeight: 700 }}>
                  Refreshes in <strong style={{ color: '#059669', fontSize: '15px' }}>{secondsRemaining}s</strong>
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(secondsRemaining / 45) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: '10px',
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PWA PC SOFTWARE DOWNLOAD & INSTALLATION GUIDE MODAL */}
      {showInstallModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setShowInstallModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '36px 32px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
              position: 'relative',
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInstallModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: '#64748b',
              }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#1d4ed8',
                }}
              >
                <Laptop size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Install BEMS Kiosk as PC Software
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Run as a standalone desktop app on Windows or Mac
                </div>
              </div>
            </div>

            <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6, marginBottom: '20px' }}>
              To install this kiosk as dedicated software on your computer from Google Chrome or Microsoft Edge:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a' }}>
                  Look at the right side of your browser&apos;s address/URL bar at the top of your screen.
                </div>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a' }}>
                  Click the <strong>Install Icon (⊕ or 💻)</strong> in the address bar, or click Browser Menu (⋮) &rarr; <strong>&quot;Save and share&quot; &rarr; &quot;Install BEMS Attendance Kiosk&quot;</strong>.
                </div>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a' }}>
                  Click <strong>Install</strong>. A desktop shortcut will be created and BEMS Kiosk will open in its own clean window without any browser tabs!
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <a
                href="/api/download/kiosk-launcher?type=bat"
                download="Launch-BEMS-Kiosk-PC.bat"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#16a34a',
                  fontWeight: 800,
                  fontSize: '12px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Download size={14} />
                <span>Download Windows .bat</span>
              </a>

              <a
                href="/api/download/kiosk-launcher?type=url"
                download="BEMS-Attendance-Kiosk.url"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  fontWeight: 800,
                  fontSize: '12px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Download size={14} />
                <span>Download Shortcut .url</span>
              </a>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 8%; }
          100% { top: 92%; }
        }
      `}</style>
    </div>
  );
}
