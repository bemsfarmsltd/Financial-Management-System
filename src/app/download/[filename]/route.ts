import { prisma } from '@/lib/prisma';
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
    const appId = safeFilename === 'gmd-app.apk' ? 'GMD_APP' : safeFilename === 'staff-app.apk' ? 'STAFF_APP' : null;
    const active = appId ? await prisma.mobileAppRelease.findFirst({ where: { appId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }) : null;
    const targetPath = path.join(downloadsDir, path.basename(active?.fileName || safeFilename));
    const fileBuffer = await fs.readFile(targetPath).catch(() => null);

    if (!fileBuffer) {
      return NextResponse.json(
        {
          error: `APK build "${safeFilename}" could not be found.`,
        },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
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
