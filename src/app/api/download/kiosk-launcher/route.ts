import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'bat';
  const isExplicitLocal = searchParams.get('local') === 'true';

  // Production base URL configured in environment (default: https://bemserp.work)
  const prodBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://bemserp.work').replace(/\/+$/, '');

  // Detect incoming request host
  const reqHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const reqProto = request.headers.get('x-forwarded-proto') || 'https';

  let targetUrl: string;

  if (isExplicitLocal) {
    targetUrl = `http://localhost:3000/attendance/kiosk`;
  } else if (reqHost && !reqHost.includes('localhost') && !reqHost.includes('127.0.0.1')) {
    // If accessed through a live company domain or external IP, use that host
    targetUrl = `${reqProto}://${reqHost}/attendance/kiosk`;
  } else {
    // Standard production URL accessible anywhere from any office workstation or receptionist PC
    targetUrl = `${prodBase}/attendance/kiosk`;
  }

  if (type === 'url') {
    const urlContent = `[InternetShortcut]\r\nURL=${targetUrl}\r\nIconIndex=0\r\n`;
    return new NextResponse(urlContent, {
      headers: {
        'Content-Type': 'application/internet-shortcut',
        'Content-Disposition': 'attachment; filename="BEMS-Attendance-Kiosk.url"',
      },
    });
  }

  // Windows Desktop Batch Launcher that launches Chrome or Edge in standalone software window
  const batContent = `@echo off\r\n:: BEMS Attendance Kiosk Desktop Launcher for Windows PC\r\n:: Connects to the live production BEMS Attendance System\r\ntitle BEMS Attendance Kiosk\r\necho Launching BEMS Reception Kiosk...\r\n\r\nset KIOSK_URL=${targetUrl}\r\n\r\nstart chrome --app="%KIOSK_URL%" 2>nul || start msedge --app="%KIOSK_URL%" 2>nul || start "" "%KIOSK_URL%"\r\nexit\r\n`;

  return new NextResponse(batContent, {
    headers: {
      'Content-Type': 'application/x-bat',
      'Content-Disposition': 'attachment; filename="Launch-BEMS-Kiosk-PC.bat"',
    },
  });
}
