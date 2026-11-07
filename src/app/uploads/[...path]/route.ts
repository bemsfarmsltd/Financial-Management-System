import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

// In-memory LRU cache to prevent concurrent PgBouncer connection spikes when rendering staff lists
type CachedFile = {
  data: Buffer;
  mimeType: string;
  cachedAt: number;
};

const fileMemoryCache = new Map<string, CachedFile>();
const MAX_CACHE_ITEMS = 80;

function getFromMemoryCache(filename: string): CachedFile | null {
  const item = fileMemoryCache.get(filename);
  if (!item) return null;
  return item;
}

function setInMemoryCache(filename: string, data: Buffer, mimeType: string) {
  if (fileMemoryCache.size >= MAX_CACHE_ITEMS) {
    const oldestKey = fileMemoryCache.keys().next().value;
    if (oldestKey) fileMemoryCache.delete(oldestKey);
  }
  fileMemoryCache.set(filename, { data, mimeType, cachedAt: Date.now() });
}

async function findStoredFileWithRetry(filename: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await prisma.storedFile.findUnique({
        where: { filename },
      });
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 150 * attempt));
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse('Not Found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Sanitize path segments to prevent directory traversal
    const safeSegments = pathSegments.map((s) => path.basename(s));
    const filename = safeSegments[safeSegments.length - 1];
    const ext = path.extname(filename).toLowerCase();
    const defaultContentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Public branding logos may be rendered on login screens; all evidence/profile/voucher files require authentication
    const isPublicBrandAsset = filename.startsWith('logo-') || filename.startsWith('brand-');
    let actor = null;
    if (!isPublicBrandAsset) {
      actor = await getAuthenticatedEmployee(request);
      if (!actor) {
        return new NextResponse('Authentication required to access uploaded documents.', {
          status: 401,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      // Check Attachment ownership if this file is bound to a specific request/accountability attachment
      const isExecutive = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
      if (!isExecutive && !filename.startsWith('avatar-')) {
        const attachment = await prisma.attachment.findFirst({
          where: { fileUrl: { endsWith: filename } },
          include: {
            request: {
              select: {
                requestedById: true,
                disbursementAssigneeId: true,
              },
            },
          },
        });
        if (
          attachment?.request &&
          attachment.request.requestedById !== actor.id &&
          attachment.request.disbursementAssigneeId !== actor.id &&
          attachment.uploadedById !== actor.id
        ) {
          return new NextResponse('Forbidden: You do not have access to this evidence document.', {
            status: 403,
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'private, no-store, no-cache, must-revalidate',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        }
      }
    }

    const cacheControlHeader = isPublicBrandAsset
      ? 'public, max-age=86400'
      : 'private, no-store, no-cache, must-revalidate';

    // 0. Check fast in-memory cache first (<1ms, zero DB load)
    const memCached = getFromMemoryCache(filename);
    if (memCached) {
      return new NextResponse(new Uint8Array(memCached.data), {
        headers: {
          'Content-Type': memCached.mimeType || defaultContentType,
          'Cache-Control': cacheControlHeader,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 1. Primary storage check: Durable Supabase PostgreSQL database (with retry)
    try {
      const dbFile = await findStoredFileWithRetry(filename, 3);
      if (dbFile && dbFile.data) {
        const buf = Buffer.from(dbFile.data);
        const resolvedMime = dbFile.mimeType || defaultContentType;
        setInMemoryCache(filename, buf, resolvedMime);

        // Warm local disk cache asynchronously if possible
        const diskPath = path.join(process.cwd(), 'public', 'uploads', ...safeSegments);
        fs.mkdir(path.dirname(diskPath), { recursive: true })
          .then(() => fs.writeFile(diskPath, buf))
          .catch(() => {});

        return new NextResponse(new Uint8Array(buf), {
          headers: {
            'Content-Type': resolvedMime,
            'Cache-Control': cacheControlHeader,
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    } catch (dbErr) {
      console.warn('[Uploads Serve] Database lookup failed after retries, falling back to disk:', dbErr);
    }

    // 2. Secondary fallback: Local filesystem cache
    const filePath = path.join(process.cwd(), 'public', 'uploads', ...safeSegments);
    try {
      const fileBuffer = await fs.readFile(filePath);
      setInMemoryCache(filename, fileBuffer, defaultContentType);
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': defaultContentType,
          'Cache-Control': cacheControlHeader,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new NextResponse('File Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
  } catch (error) {
    return new NextResponse('Error loading file', {
      status: 500,
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
