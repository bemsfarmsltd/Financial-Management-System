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

  // Live West Africa Time Clock with ticking seconds
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
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch token and pre-rendered QR from server
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

  // Poll recent arrivals for the live stream ticker
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/attendance/timesheet');
        if (res.ok) {
          const data = await res.json();
          const activeToday = (data.employees || []).filter((e: any) => e.checkInTime);
          setRecentPunches(activeToday.slice(0, 6));
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
        background: '#040711',
        color: '#f8fafc',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dynamic Ambient Aurora Glows */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '25%',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(234, 88, 12, 0.15) 0%, transparent 65%)',
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '15%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
          filter: 'blur(50px)',
        }}
      />

      {/* Top Header */}
      <header
        style={{
          padding: '18px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(9, 13, 24, 0.75)',
          backdropFilter: 'blur(16px)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src="/bems-group-logo.png?v=20261024"
            alt="BEMS logo"
            style={{ width: 38, height: 38, objectFit: 'contain' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  letterSpacing: '-0.4px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                BEMS GROUP
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: 'rgba(234, 88, 12, 0.2)',
                  color: '#fb923c',
                  border: '1px solid rgba(234, 88, 12, 0.45)',
                  letterSpacing: '0.5px',
                }}
              >
                RECEPTION KIOSK
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', fontWeight: 500 }}>
              Official Corporate Attendance Terminal · Victoria Island HQ
            </div>
          </div>
        </div>

        {/* Station Location & Quick Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'rgba(30, 41, 59, 0.7)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Building2 size={15} color="#ea580c" />
            <span>{stationData?.stationName || 'BEMS Group Corporate Headquarters'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'rgba(30, 41, 59, 0.7)',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <Link
            href="/attendance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: '#ea580c',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
            }}
          >
            <ArrowLeft size={14} />
            <span>Attendance Desk</span>
          </Link>
        </div>
      </header>

      {/* Main Kiosk Display */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 500px 1fr',
          alignItems: 'center',
          padding: '28px 40px',
          gap: '36px',
          maxWidth: '1650px',
          margin: '0 auto',
          width: '100%',
          zIndex: 5,
        }}
      >
        {/* Left Column: Dynamic Clock & Shift Schedule */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Live WAT Clock Card */}
          <div
            style={{
              padding: '28px 30px',
              borderRadius: '24px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#ea580c',
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Clock size={14} />
                WEST AFRICA TIME (WAT · GMT+1)
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <Radio size={12} className="animate-pulse" />
                OFFICIAL TIME
              </span>
            </div>

            <div
              style={{
                fontSize: '60px',
                fontWeight: 900,
                letterSpacing: '-1.5px',
                color: '#ffffff',
                lineHeight: 1.05,
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 0 30px rgba(255, 255, 255, 0.2)',
              }}
            >
              {currentTime || '--:--:--'}
            </div>
            <div style={{ fontSize: '16px', color: '#94a3b8', marginTop: '10px', fontWeight: 600 }}>
              {currentDate || 'Loading date...'}
            </div>
          </div>

          {/* Corporate Workday Hours Card */}
          <div
            style={{
              padding: '24px 28px',
              borderRadius: '24px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.3px' }}>
                CORPORATE WORKDAY HOURS
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: stationData?.powerOutageMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: stationData?.powerOutageMode ? '#fbbf24' : '#34d399',
                  border: stationData?.powerOutageMode ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {stationData?.powerOutageMode ? <Zap size={12} /> : <Wifi size={12} />}
                <span>{stationData?.powerOutageMode ? 'Power Outage Mode' : 'Starlink Wi-Fi Enforced'}</span>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', fontWeight: 700 }}>
                  Arrival Window
                </span>
                <strong style={{ fontSize: '17px', color: '#38bdf8', fontWeight: 900, marginTop: '2px', display: 'block' }}>
                  {stationData?.earliestCheckInTime || '07:00'} – {stationData?.resumptionTime || '08:00'} AM
                </strong>
              </div>
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', fontWeight: 700 }}>
                  Grace Period Limit
                </span>
                <strong style={{ fontSize: '17px', color: '#fbbf24', fontWeight: 900, marginTop: '2px', display: 'block' }}>
                  08:15 AM
                </strong>
              </div>
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', fontWeight: 700 }}>
                  Official Close
                </span>
                <strong style={{ fontSize: '17px', color: '#cbd5e1', fontWeight: 900, marginTop: '2px', display: 'block' }}>
                  05:00 PM
                </strong>
              </div>
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', fontWeight: 700 }}>
                  Arrival Lock
                </span>
                <strong style={{ fontSize: '13px', color: '#34d399', fontWeight: 800, marginTop: '4px', display: 'block' }}>
                  Prior to 7:00 AM Locked
                </strong>
              </div>
            </div>
          </div>

          {/* Location Perimeter Card */}
          <div
            style={{
              padding: '16px 22px',
              borderRadius: '18px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.18)',
                display: 'grid',
                placeItems: 'center',
                color: '#34d399',
                flexShrink: 0,
              }}
            >
              <MapPin size={22} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#34d399' }}>
                Office Perimeter Active ({stationData?.radiusMeters || 100}m radius)
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Device hardware GPS must be within office boundary to unlock QR check-in.
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Illuminated High-Contrast QR Code Pedestal */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              background: '#ffffff',
              borderRadius: '32px',
              padding: '36px 30px',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8), 0 0 50px rgba(234, 88, 12, 0.25)',
              border: '5px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#c2410c',
                  background: '#ffedd5',
                  padding: '5px 14px',
                  borderRadius: '20px',
                  border: '1px solid #fed7aa',
                  letterSpacing: '0.5px',
                }}
              >
                <Sparkles size={13} />
                POINT PHONE CAMERA TO CLOCK IN
              </span>
            </div>

            {/* QR Container */}
            <div
              style={{
                width: '340px',
                height: '340px',
                borderRadius: '22px',
                background: '#ffffff',
                border: '2px solid #f1f5f9',
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 15px rgba(0,0,0,0.03)',
              }}
            >
              {isLoading ? (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={44} className="animate-spin" color="#ea580c" />
                  <div style={{ fontSize: '13px', marginTop: '14px', fontWeight: 700, color: '#334155' }}>
                    Generating secure QR code...
                  </div>
                </div>
              ) : loadError ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#b91c1c' }}>
                  <AlertCircle size={38} style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 800 }}>{loadError}</div>
                  <button
                    onClick={fetchToken}
                    style={{
                      marginTop: '14px',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: '#ea580c',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Tap to Reload
                  </button>
                </div>
              ) : stationData?.qrSvg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: stationData.qrSvg }}
                  style={{
                    width: '320px',
                    height: '320px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              ) : stationData?.qrDataUrl ? (
                <img
                  src={stationData.qrDataUrl}
                  alt="Attendance QR Code"
                  style={{ width: '320px', height: '320px', display: 'block' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  Loading QR Code...
                </div>
              )}

              {/* Center Brand Emblem Watermark */}
              {!isLoading && !loadError && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '58px',
                    height: '58px',
                    borderRadius: '15px',
                    background: '#ffffff',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
                    display: 'grid',
                    placeItems: 'center',
                    border: '3px solid #ea580c',
                  }}
                >
                  <img
                    src="/bems-mark.png?v=20261024"
                    alt="BEMS"
                    style={{ width: 36, height: 36, objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>

            {/* Dynamic Countdown & Rotating Progress Bar */}
            <div style={{ width: '340px', marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 800 }}>
                  <ShieldCheck size={16} />
                  HMAC-SHA256 ENCRYPTED
                </span>
                <span style={{ color: '#475569', fontWeight: 700 }}>
                  Refreshes in <strong style={{ color: '#ea580c', fontSize: '15px', fontWeight: 900 }}>{secondsRemaining}s</strong>
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
                    background: 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)',
                    borderRadius: '10px',
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            </div>

            {/* Smartphone Instruction Box */}
            <div
              style={{
                marginTop: '22px',
                padding: '12px 18px',
                borderRadius: '14px',
                background: '#f8fafc',
                border: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
              }}
            >
              <Smartphone size={22} color="#ea580c" />
              <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4, fontWeight: 500 }}>
                Open the <strong>BEMS Staff App</strong> on your smartphone, tap <strong>Clock In</strong>, and point camera here.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Live Arrivals Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              padding: '26px 26px',
              borderRadius: '24px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#10b981" />
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.2px' }}>
                  TODAY'S ARRIVALS STREAM
                </span>
              </div>
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 10px #10b981',
                  display: 'inline-block',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentPunches.length === 0 ? (
                <div
                  style={{
                    padding: '36px 16px',
                    borderRadius: '14px',
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#94a3b8',
                  }}
                >
                  <Clock size={30} style={{ margin: '0 auto 8px', color: '#64748b' }} />
                  <div>No clock-ins recorded yet today.</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    Staff arrivals will appear here in real-time as they scan.
                  </div>
                </div>
              ) : (
                recentPunches.map(p => {
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
                        padding: '14px 16px',
                        borderRadius: '14px',
                        background: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
                          {p.legalName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {p.role} · {p.workLocation}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: isLate ? '#f87171' : '#34d399' }}>
                          {checkInFormatted}
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: isLate ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: isLate ? '#f87171' : '#34d399',
                            border: isLate ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          {p.status}
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

      {/* Footer Status Bar */}
      <footer
        style={{
          padding: '14px 40px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(9, 13, 24, 0.8)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#64748b',
          zIndex: 10,
        }}
      >
        <span>
          BEMS Enterprise Attendance Network · Station Coordinates:{' '}
          {stationData?.latitude != null ? Number(stationData.latitude).toFixed(4) : '6.4285'}° N,{' '}
          {stationData?.longitude != null ? Number(stationData.longitude).toFixed(4) : '3.4221'}° E
        </span>
        <span>
          Full Executive Coverage · GMD, COO, Directors & Staff · © 2026 BEMS Group Holdings Ltd
        </span>
      </footer>
    </div>
  );
}
