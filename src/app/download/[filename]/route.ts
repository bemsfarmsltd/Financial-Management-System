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

    const filePath = path.join(process.cwd(), 'public', 'downloads', safeFilename);

    try {
      const fileBuffer = await fs.readFile(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=300, must-revalidate',
        },
      });
    } catch {
      return NextResponse.json(
        {
          error: `APK build "${safeFilename}" has not yet been uploaded by an administrator. Please upload the APK in the Admin Mobile Apps Management page.`,
        },
        { status: 404 }
      );
    }
  } catch (error) {
    return NextResponse.json({ error: 'Could not download file.' }, { status: 500 });
  }
}
