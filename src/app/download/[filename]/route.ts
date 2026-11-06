import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const safeFilename = path.basename(filename);

    if (!safeFilename.toLowerCase().endsWith('.apk')) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    const downloadsDir = path.join(process.cwd(), 'public', 'downloads');
    let targetPath = path.join(downloadsDir, safeFilename);

    let fileBuffer: Buffer | null = null;

    try {
      fileBuffer = await fs.readFile(targetPath);
    } catch {
      // Fallback aliases for GMD and Staff apps
      const lower = safeFilename.toLowerCase();
      const candidates: string[] = [];

      if (lower.includes('gmd')) {
        candidates.push(
          'BEMS-GMD-Executive-v1.3.3.apk',
          'BEMS-GMD-Executive-Cockpit-v1.3.3.apk',
          'gmd-app.apk',
          'BEMS-GMD-Executive-Cockpit.apk'
        );
      } else if (lower.includes('staff')) {
        candidates.push(
          'BEMS-Staff-Portal-v1.3.3.apk',
          'staff-app.apk',
          'BEMS-Staff-App.apk',
          'BEMS-Staff-Portal.apk'
        );
      }

      for (const cand of candidates) {
        try {
          const candPath = path.join(downloadsDir, cand);
          fileBuffer = await fs.readFile(candPath);
          targetPath = candPath;
          break;
        } catch {
          // Continue to next candidate
        }
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        {
          error: `APK build "${safeFilename}" could not be found.`,
        },
        { status: 404 }
      );
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Could not download file.' }, { status: 500 });
  }
}
