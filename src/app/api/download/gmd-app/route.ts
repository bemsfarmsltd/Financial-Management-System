import { NextResponse } from 'next/server';
import { createReadStream, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = resolve(process.cwd(), 'public/downloads/gmd-app.apk');
    const stat = statSync(filePath);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="BEMS-GMD-Executive-Cockpit.apk"',
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Failed to stream GMD app APK', error);
    return NextResponse.json({ error: 'GMD app APK currently unavailable' }, { status: 404 });
  }
}
