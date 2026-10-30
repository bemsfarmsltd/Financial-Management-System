'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Building2,
  Wifi,
  Zap,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Sparkles,
  Radio,
  Calendar,
  Users,
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
  const [recentPunches, setRecentPunches] = useState<any[]>([]);
  const [totalPresentCount, setTotalPresentCount] = useState<number>(0);

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

  // Poll recent arrivals
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/attendance/timesheet?kiosk=true');
        if (res.ok) {
          const data = await res.json();
          const activeToday = (data.employees || []).filter((e: any) => e.checkInTime);
          setRecentPunches(activeToday.slice(0, 6));
          setTotalPresentCount(activeToday.length);
        }
      } catch (e) {
        // quiet ignore
      }
    };
    fetchRecent();
    const interval = setInterval(fetchRecent, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

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
      {/* Top Header (Simple & Clean from Reference) */}
      <header
        style={{
          padding: '16px 36px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            href="/attendance"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              display: 'grid',
              placeItems: 'center',
              color: '#334155',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
            title="Return to Attendance Desk"
          >
            <ArrowLeft size={18} />
          </Link>

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

        {/* Top Right Action Buttons (Matching Reference Design) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={toggleFullscreen}
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
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <Link
            href="/attendance"
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '13px',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            }}
          >
            Attendance Desk
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Top Info & Summary Card (Directly from Reference Image) */}
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
          {/* Big "Total Clock-Ins" Box (like "Total Scans 50" in reference) */}
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

        {/* Center Stage: The Simple Clean QR Card with Bracket Reticles and Scanning Laser Line */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 0',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '28px',
              border: '1px solid #e2e8f0',
              padding: '36px 48px',
              boxShadow: '0 15px 40px rgba(15, 23, 42, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: '480px',
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Top Prompt */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
                  padding: '5px 14px',
                  borderRadius: '20px',
                  border: '1px solid #a7f3d0',
                  letterSpacing: '0.5px',
                }}
              >
                <Sparkles size={13} />
                POINT MOBILE APP CAMERA HERE
              </span>
            </div>

            {/* QR Viewfinder with Corner Bracket Reticles (Matching Reference Image) */}
            <div
              style={{
                width: '320px',
                height: '320px',
                position: 'relative',
                display: 'grid',
                placeItems: 'center',
                padding: '16px',
              }}
            >
              {/* Top-Left Bracket Reticle */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '36px',
                  height: '36px',
                  borderTop: '4px solid #10b981',
                  borderLeft: '4px solid #10b981',
                  borderRadius: '12px 0 0 0',
                }}
              />

              {/* Top-Right Bracket Reticle */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '36px',
                  height: '36px',
                  borderTop: '4px solid #10b981',
                  borderRight: '4px solid #10b981',
                  borderRadius: '0 12px 0 0',
                }}
              />

              {/* Bottom-Left Bracket Reticle */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '36px',
                  height: '36px',
                  borderBottom: '4px solid #10b981',
                  borderLeft: '4px solid #10b981',
                  borderRadius: '0 0 0 12px',
                }}
              />

              {/* Bottom-Right Bracket Reticle */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '36px',
                  height: '36px',
                  borderBottom: '4px solid #10b981',
                  borderRight: '4px solid #10b981',
                  borderRadius: '0 0 12px 0',
                }}
              />

              {/* Dynamic QR Display */}
              <div
                style={{
                  width: '280px',
                  height: '280px',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '16px',
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
                    style={{ width: '270px', height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                ) : stationData?.qrDataUrl ? (
                  <img
                    src={stationData.qrDataUrl}
                    alt="Attendance QR Code"
                    style={{ width: '270px', height: '270px', display: 'block' }}
                  />
                ) : (
                  <div style={{ color: '#64748b', fontSize: '12px' }}>Loading QR...</div>
                )}

                {/* Animated Horizontal Laser Scanning Line (from Reference Image) */}
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
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
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
                      style={{ width: 32, height: 32, objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Subtitle Under QR (from reference: "Scan your code...") */}
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '20px', textAlign: 'center' }}>
              Scan dynamic QR code with BEMS Staff App to record presence
            </div>

            {/* Countdown & Security Status */}
            <div style={{ width: '100%', maxWidth: '300px', marginTop: '16px' }}>
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
          </div>
        </div>

        {/* Recent Arrivals Strip */}
        {recentPunches.length > 0 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '18px 24px',
              boxShadow: '0 4px 15px rgba(15, 23, 42, 0.02)',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '12px' }}>
              Recent Check-Ins Today
            </div>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
              {recentPunches.map(p => {
                const checkInFormatted = p.checkInTime
                  ? new Date(p.checkInTime).toLocaleTimeString('en-US', {
                      timeZone: 'Africa/Lagos',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : '--:--';
                const isLate = p.status === 'LATE';

                return (
                  <div
                    key={p.employeeId}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexShrink: 0,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{p.legalName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{p.role}</div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: isLate ? '#fef2f2' : '#ecfdf5',
                        color: isLate ? '#dc2626' : '#059669',
                      }}
                    >
                      {checkInFormatted}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

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
