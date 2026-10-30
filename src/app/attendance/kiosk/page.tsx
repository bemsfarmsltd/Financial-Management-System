'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  Clock,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Building2,
  Sparkles,
  Wifi,
  Zap,
} from 'lucide-react';

interface StationData {
  stationCode: string;
  stationName: string;
  organizationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  qrToken: string;
  expiresInSeconds: number;
  powerOutageMode?: boolean;
  requireStarlinkIp?: boolean;
  earliestCheckInTime?: string;
  resumptionTime?: string;
  gracePeriodMinutes?: number;
}

export default function AttendanceKioskPage() {
  const [stationData, setStationData] = useState<StationData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [recentPunches, setRecentPunches] = useState<any[]>([]);

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
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
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch rotating QR token
  const fetchToken = async () => {
    try {
      const res = await fetch('/api/attendance/station/qr');
      if (!res.ok) throw new Error('Failed to load station token');
      const data: StationData = await res.json();
      setStationData(data);
      setSecondsRemaining(data.expiresInSeconds || 45);

      const url = await QRCode.toDataURL(data.qrToken, {
        width: 380,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading QR code:', err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
  }, [stationCode]);

  // Countdown timer & auto-refresh
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
  }, [stationCode]);

  // Poll recent check-ins for the ticker
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
        background: '#090d16',
        color: '#f8fafc',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '20%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(234, 88, 12, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '20%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header */}
      <header
        style={{
          padding: '20px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src="/bems-group-logo.png?v=20261024"
            alt="BEMS logo"
            style={{ width: 36, height: 36, objectFit: 'contain' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                BEMS CONNECT
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: 'rgba(234, 88, 12, 0.2)',
                  color: '#fb923c',
                  border: '1px solid rgba(234, 88, 12, 0.4)',
                }}
              >
                STATION KIOSK
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              {stationData?.stationName || 'Loading station...'}
            </div>
          </div>
        </div>

        {/* Official Station Badge & Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Building2 size={13} color="#ea580c" />
            <span>{stationData?.stationName || 'BEMS Group Headquarters'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <Link
            href="/attendance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#334155',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={13} />
            <span>Attendance Desk</span>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 480px 1fr',
          alignItems: 'center',
          padding: '24px 36px',
          gap: '30px',
          zIndex: 5,
        }}
      >
        {/* Left Column: Live Clock & Shift Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#ea580c',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '6px',
              }}
            >
              WEST AFRICA TIME (WAT · GMT+1)
            </div>
            <div
              style={{
                fontSize: '54px',
                fontWeight: 900,
                letterSpacing: '-1.5px',
                color: '#ffffff',
                lineHeight: 1.1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {currentTime || '--:--:--'}
            </div>
            <div style={{ fontSize: '15px', color: '#94a3b8', marginTop: '6px', fontWeight: 600 }}>
              {currentDate || 'Loading date...'}
            </div>
          </div>

          {/* Shift Rules Badge */}
          <div
            style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#fb923c" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                  CORPORATE WORKDAY HOURS
                </span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: stationData?.powerOutageMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: stationData?.powerOutageMode ? '#fbbf24' : '#34d399',
                  border: stationData?.powerOutageMode ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {stationData?.powerOutageMode ? <Zap size={11} /> : <Wifi size={11} />}
                <span>{stationData?.powerOutageMode ? 'Power Outage Mode' : 'Starlink Wi-Fi Enforced'}</span>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Arrival Window</span>
                <strong style={{ fontSize: '15px', color: '#60a5fa', fontWeight: 800 }}>
                  {stationData?.earliestCheckInTime || '07:00'} – {stationData?.resumptionTime || '08:00'} AM
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Grace Limit</span>
                <strong style={{ fontSize: '15px', color: '#fbbf24', fontWeight: 800 }}>08:15 AM</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Closing Time</span>
                <strong style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 800 }}>05:00 PM</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Earliest Punch</span>
                <strong style={{ fontSize: '15px', color: '#34d399', fontWeight: 800 }}>07:00 AM (Locked Prior)</strong>
              </div>
            </div>
          </div>

          {/* Geofence Info */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <MapPin size={22} color="#10b981" />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981' }}>
                GEOFENCE PERIMETER ACTIVE ({stationData?.radiusMeters || 100}m)
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Mobile apps must be within this perimeter to unlock QR camera scanning.
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: The Big Rotating QR Code */}
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
              padding: '24px',
              borderRadius: '28px',
              background: 'linear-gradient(145deg, #ffffff, #f1f5f9)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(234, 88, 12, 0.15)',
              border: '6px solid rgba(255, 255, 255, 0.15)',
              position: 'relative',
            }}
          >
            {isLoading ? (
              <div
                style={{
                  width: '340px',
                  height: '340px',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#0f172a',
                }}
              >
                <RefreshCw size={36} className="animate-spin" />
              </div>
            ) : (
              <img
                src={qrDataUrl}
                alt="Attendance Dynamic QR"
                style={{ width: '340px', height: '340px', display: 'block', borderRadius: '12px' }}
              />
            )}

            {/* Center Brand Watermark */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '54px',
                height: '54px',
                borderRadius: '12px',
                background: '#ffffff',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                display: 'grid',
                placeItems: 'center',
                border: '2px solid #ea580c',
              }}
            >
              <img
                src="/bems-mark.png?v=20261024"
                alt="BEMS"
                style={{ width: 34, height: 34, objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* Token Rotation Progress Bar */}
          <div style={{ width: '380px', marginTop: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                <ShieldCheck size={14} />
                HMAC-SHA256 SECURED
              </span>
              <span>
                REFRESHING IN <strong style={{ color: '#fb923c' }}>{secondsRemaining}s</strong>
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '6px',
                background: '#1e293b',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(secondsRemaining / 45) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ea580c, #f97316)',
                  transition: 'width 1s linear',
                }}
              />
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>
              Open your <strong>BEMS Staff App</strong>, tap <strong>Clock In</strong>, and scan this code.
            </p>
          </div>
        </div>

        {/* Right Column: Live Punch Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.2px' }}>
              TODAY'S ARRIVALS STREAM
            </span>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 10px #10b981',
                display: 'inline-block',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentPunches.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                No clock-ins recorded yet today. Arrivals will appear here in real-time.
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
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'rgba(30, 41, 59, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                        {p.legalName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {p.role} · {p.workLocation}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: isLate ? '#f87171' : '#34d399' }}>
                        {checkInFormatted}
                      </div>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: isLate ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: isLate ? '#f87171' : '#34d399',
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
      </main>

      {/* Footer Status Bar */}
      <footer
        style={{
          padding: '12px 36px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748b',
          zIndex: 10,
        }}
      >
        <span>
          BEMS Enterprise Attendance Network · Station Coordinate: {stationData?.latitude.toFixed(4)},{' '}
          {stationData?.longitude.toFixed(4)}
        </span>
        <span>
          Full Executive Coverage · GMD, COO, Directors & Staff · © 2026 BEMS Group Holdings Ltd
        </span>
      </footer>
    </div>
  );
}
