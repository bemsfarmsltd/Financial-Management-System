import { NextResponse } from 'next/server';
import { createReadStream, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = resolve(process.cwd(), 'public/downloads/staff-app.apk');
    const stat = statSync(filePath);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="BEMS-Staff-Portal-v1.3.8.apk"',
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Failed to stream staff app APK', error);
    return NextResponse.json({ error: 'Staff app APK currently unavailable' }, { status: 404 });
  }
}
