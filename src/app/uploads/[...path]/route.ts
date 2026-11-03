import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Sanitize path segments to prevent directory traversal
    const safeSegments = pathSegments.map((s) => path.basename(s));
    const filename = safeSegments[safeSegments.length - 1];
    const ext = path.extname(filename).toLowerCase();
    const defaultContentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 1. Primary storage check: Durable Supabase PostgreSQL database
    try {
      const dbFile = await prisma.storedFile.findUnique({
        where: { filename },
      });
      if (dbFile && dbFile.data) {
        return new NextResponse(Buffer.from(dbFile.data), {
          headers: {
            'Content-Type': dbFile.mimeType || defaultContentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (dbErr) {
      console.warn('[Uploads Serve] Database lookup failed, falling back to disk:', dbErr);
    }

    // 2. Secondary fallback: Local filesystem cache
    const filePath = path.join(process.cwd(), 'public', 'uploads', ...safeSegments);
    try {
      const fileBuffer = await fs.readFile(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': defaultContentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return new NextResponse('File Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    return new NextResponse('Error loading file', { status: 500 });
  }
}
