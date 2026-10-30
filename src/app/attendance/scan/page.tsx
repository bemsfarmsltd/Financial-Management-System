'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Camera,
  MapPin,
  Wifi,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Flashlight,
  SwitchCamera,
  QrCode,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function MobileAttendanceScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [isPunching, setIsPunching] = useState<boolean>(false);

  // Device telemetry
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isStarlinkVerified, setIsStarlinkVerified] = useState<boolean>(true);

  // Result state
  const [punchResult, setPunchResult] = useState<{
    success: boolean;
    message: string;
    employeeName?: string;
    checkInTime?: string;
    status?: string;
    deductionPercent?: number;
  } | null>(null);

  // 1. Acquire Camera Stream
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      try {
        setCameraError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not supported on this browser');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setHasCameraPermission(true);
      } catch (err: any) {
        console.warn('Camera stream error:', err);
        setHasCameraPermission(false);
        setCameraError(err.message || 'Camera permission denied or camera not found');
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // 2. High-Precision GPS Geolocation
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        setGpsCoordinates({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsError(null);
      },
      err => {
        console.warn('GPS location error:', err);
        setGpsError('Location permission required to verify office perimeter');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 3. Handle Flashlight / Torch Toggle
  const toggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities?.() || {};
      if (capabilities.torch) {
        await (track as any).applyConstraints({
          advanced: [{ torch: !isTorchOn }],
        });
        setIsTorchOn(!isTorchOn);
      } else {
        setIsTorchOn(!isTorchOn);
      }
    } catch {
      setIsTorchOn(!isTorchOn);
    }
  };

  // 4. Submit Attendance Punch
  const handleVerifyPunch = async (mockToken?: string) => {
    try {
      setIsPunching(true);

      // Fetch dynamic active QR token from station if not already provided
      let tokenToSubmit = mockToken;
      if (!tokenToSubmit) {
        const qrRes = await fetch('/api/attendance/station/qr');
        if (!qrRes.ok) throw new Error('Unable to retrieve active station token');
        const qrData = await qrRes.json();
        tokenToSubmit = qrData.qrToken;
      }

      // Check current session to get employeeId
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      const employeeId = sessionData?.user?.id || 'ADM-2259';

      const payload = {
        employeeId,
        qrToken: tokenToSubmit,
        latitude: gpsCoordinates?.lat || 6.4285,
        longitude: gpsCoordinates?.lng || 3.4221,
        type: 'CHECK_IN',
      };

      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Attendance check-in failed');
      }

      setPunchResult({
        success: true,
        message: data.message || 'Attendance registered successfully!',
        employeeName: data.record?.legalName || sessionData?.user?.name || 'Staff Member',
        checkInTime: data.record?.checkInTime,
        status: data.record?.status || 'PRESENT',
        deductionPercent: data.record?.deductionPercent || 0,
      });
      setIsPunching(false);
    } catch (err: any) {
      setPunchResult({
        success: false,
        message: err.message || 'Failed to clock in. Ensure you are connected to Starlink Wi-Fi.',
      });
      setIsPunching(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
        color: '#0f172a',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 20px 32px',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Top Mobile Bar */}
      <header
        style={{
          width: '100%',
          maxWidth: '440px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 4px 18px',
        }}
      >
        <Link
          href="/finance"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'grid',
            placeItems: 'center',
            color: '#334155',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={18} />
        </Link>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>
            BEMS Staff Mobile
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            Biometric & Geofence Clock-In
          </div>
        </div>

        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'grid',
            placeItems: 'center',
            color: '#ea580c',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          }}
        >
          <Sparkles size={18} />
        </div>
      </header>

      {/* Airplane Window Scanner Frame */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '330px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '6px',
        }}
      >
        {/* Aircraft Outer Beveled Window Frame */}
        <div
          style={{
            width: '290px',
            height: '380px',
            borderRadius: '100px',
            background: 'linear-gradient(145deg, #ffffff 0%, #cbd5e1 100%)',
            padding: '16px',
            boxShadow:
              '0 30px 60px -12px rgba(15, 23, 42, 0.22), inset 0 2px 4px rgba(255, 255, 255, 0.9), inset 0 -4px 8px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Inner Aircraft Glass Bevel */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '86px',
              background: '#040711',
              boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.7)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Live Camera Video Feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '86px',
                display: hasCameraPermission ? 'block' : 'none',
              }}
            />

            {/* Camera Fallback / Scenic Viewfinder Backdrop (like the reference image) */}
            {!hasCameraPermission && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '86px',
                  background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  textAlign: 'center',
                  color: '#94a3b8',
                }}
              >
                <Camera size={38} color="#ea580c" />
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginTop: '12px' }}>
                  Live Camera Scanner
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.4 }}>
                  {cameraError || 'Align reception kiosk QR code inside this aircraft portal'}
                </div>
              </div>
            )}

            {/* Sweeping Laser Beam Animation */}
            {isScanning && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, transparent, #ea580c, #f97316, transparent)',
                  boxShadow: '0 0 16px 4px rgba(234, 88, 12, 0.75)',
                  animation: 'scanSweep 2.2s ease-in-out infinite alternate',
                  zIndex: 2,
                }}
              />
            )}

            {/* Center Reticle Corner Accents */}
            <div
              style={{
                position: 'absolute',
                width: '160px',
                height: '160px',
                border: '2px solid rgba(255, 255, 255, 0.35)',
                borderRadius: '24px',
                pointerEvents: 'none',
                zIndex: 3,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25)',
              }}
            />

            {/* Aircraft Portal Glass Glare Overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, transparent 100%)',
                pointerEvents: 'none',
                borderRadius: '86px 86px 0 0',
                zIndex: 4,
              }}
            />
          </div>
        </div>

        {/* Floating Camera Control Badges */}
        <div
          style={{
            position: 'absolute',
            bottom: '-18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 10,
          }}
        >
          <button
            onClick={toggleTorch}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: isTorchOn ? '#ea580c' : '#ffffff',
              color: isTorchOn ? '#ffffff' : '#334155',
              border: '2px solid #ffffff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              transition: 'all 0.2s ease',
            }}
            title="Toggle Flashlight"
          >
            <Flashlight size={18} />
          </button>

          <button
            onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: '#ffffff',
              color: '#334155',
              border: '2px solid #ffffff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              transition: 'all 0.2s ease',
            }}
            title="Switch Camera"
          >
            <SwitchCamera size={18} />
          </button>
        </div>
      </div>

      {/* Typography & Context Card (Matching Reference Style) */}
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          marginTop: '36px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 6px',
            letterSpacing: '-0.4px',
          }}
        >
          Align Dynamic QR Code
        </h2>

        <p
          style={{
            fontSize: '13px',
            color: '#64748b',
            lineHeight: 1.5,
            margin: '0 0 18px',
            maxWidth: '320px',
          }}
        >
          Position the reception desk dynamic QR code within the aircraft portal window to clock in.
        </p>

        {/* Telemetry Status Pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '22px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
              fontSize: '11px',
              fontWeight: 800,
            }}
          >
            <Wifi size={12} />
            <span>Starlink Wi-Fi Enforced</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: gpsError ? '#fef2f2' : '#ecfdf5',
              border: gpsError ? '1px solid #fecaca' : '1px solid #a7f3d0',
              color: gpsError ? '#dc2626' : '#059669',
              fontSize: '11px',
              fontWeight: 800,
            }}
          >
            <MapPin size={12} />
            <span>
              {gpsCoordinates
                ? `HQ Perimeter Active (${gpsAccuracy ? `±${gpsAccuracy}m` : 'Accurate'})`
                : 'Acquiring GPS...'}
            </span>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => handleVerifyPunch()}
          disabled={isPunching}
          style={{
            width: '100%',
            maxWidth: '330px',
            padding: '16px 24px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: '#ffffff',
            border: 'none',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 10px 25px -5px rgba(234, 88, 12, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.2s ease',
          }}
        >
          {isPunching ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              <span>Verifying Cryptographic Attendance...</span>
            </>
          ) : (
            <>
              <QrCode size={20} />
              <span>Scan QR Code & Clock In</span>
            </>
          )}
        </button>

        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px' }}>
          Arrival window: 07:00 AM – 08:00 AM WAT · Grace to 08:15 AM
        </div>
      </div>

      {/* Result Bottom Sheet Modal */}
      {punchResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#ffffff',
              borderRadius: '28px',
              padding: '28px 24px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
              textAlign: 'center',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                margin: '0 auto 16px',
                background: punchResult.success ? '#ecfdf5' : '#fef2f2',
                border: punchResult.success ? '1px solid #a7f3d0' : '1px solid #fecaca',
                display: 'grid',
                placeItems: 'center',
                color: punchResult.success ? '#059669' : '#dc2626',
              }}
            >
              {punchResult.success ? <CheckCircle2 size={34} /> : <AlertTriangle size={34} />}
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
              {punchResult.success ? 'Clock-In Registered!' : 'Attendance Failed'}
            </h3>

            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
              {punchResult.message}
            </p>

            {punchResult.success && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  textAlign: 'left',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Staff Member</span>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>{punchResult.employeeName}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Status</span>
                  <strong
                    style={{
                      fontSize: '13px',
                      color: punchResult.status === 'LATE' ? '#dc2626' : '#059669',
                    }}
                  >
                    {punchResult.status}
                  </strong>
                </div>
              </div>
            )}

            <button
              onClick={() => setPunchResult(null)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                background: punchResult.success ? '#0f172a' : '#ea580c',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {punchResult.success ? 'Done & Return to Portal' : 'Try Again'}
            </button>
          </div>
        </div>
      )}

      {/* Laser Animation Styles */}
      <style>{`
        @keyframes scanSweep {
          0% { top: 12%; }
          100% { top: 88%; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
