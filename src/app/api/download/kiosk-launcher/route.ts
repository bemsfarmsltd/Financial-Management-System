import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'bat';

  if (type === 'url') {
    const content = `[InternetShortcut]\r\nURL=http://localhost:3000/attendance/kiosk\r\nIconIndex=0\r\n`;
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/internet-shortcut',
        'Content-Disposition': 'attachment; filename="BEMS-Attendance-Kiosk.url"',
      },
    });
  }

  // Windows Desktop Batch Launcher that launches Chrome or Edge in standalone app window
  const batContent = `@echo off\r\n:: BEMS Attendance Kiosk Desktop Launcher for Windows PC\r\ntitle BEMS Attendance Kiosk\r\necho Launching BEMS Reception Kiosk...\r\n\r\nstart chrome --app="http://localhost:3000/attendance/kiosk" 2>nul || start msedge --app="http://localhost:3000/attendance/kiosk" 2>nul || start http://localhost:3000/attendance/kiosk\r\nexit\r\n`;

  return new NextResponse(batContent, {
    headers: {
      'Content-Type': 'application/x-bat',
      'Content-Disposition': 'attachment; filename="Launch-BEMS-Kiosk-PC.bat"',
    },
  });
}
