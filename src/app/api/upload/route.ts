import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { prisma } from '@/lib/prisma';
import { computeBufferSha256 } from '@/lib/platform/staged-attachments';

export const dynamic = 'force-dynamic';

async function persistStoredFileWithRetry(
  filename: string,
  mimeType: string,
  bytes: Buffer,
  retries = 3
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.storedFile.upsert({
        where: { filename },
        create: {
          filename,
          mimeType,
          data: bytes as any,
          size: bytes.length,
        },
        update: {
          mimeType,
          data: bytes as any,
          size: bytes.length,
        },
      });
      return true;
    } catch (err) {
      console.error(`[Upload] DB persist attempt ${attempt}/${retries} failed for ${filename}:`, err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);

    // Rate limit uploads by IP to prevent flooding or DoS
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'direct';
    const rateLimit = checkRateLimit(`upload:${clientIp}`, {
      windowMs: 60 * 1000,
      maxAttempts: 25,
      blockDurationMs: 5 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Upload rate limit reached. Please wait a moment before trying again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) } }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle Multipart Form Data
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
      const isKnownExtension = validExtensions.includes(ext);
      const isMimeMatch = file.type.startsWith('image/') || file.type === 'application/pdf';

      if (!isMimeMatch && !isKnownExtension) {
        return NextResponse.json({ error: 'Only image files (JPG, PNG, WebP) and PDF documents are permitted.' }, { status: 400 });
      }

      const cleanExt = isKnownExtension ? ext : 'jpg';
      const isPdf = cleanExt === 'pdf' || file.type === 'application/pdf';

      // Security check: PDF documents require authenticated session; Image avatars are permitted for registration
      if (isPdf && !actor) {
        return NextResponse.json({ error: 'Sign in is required to upload official document files.' }, { status: 401 });
      }

      if (file.size > 12 * 1024 * 1024) {
        return NextResponse.json({ error: 'File size exceeds maximum 12MB limit.' }, { status: 400 });
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const prefix = isPdf ? 'doc' : 'file';
      const filename = `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}.${cleanExt}`;
      const subDir = isPdf ? 'documents' : 'avatars';
      const mimeType = isPdf ? 'application/pdf' : cleanExt === 'png' ? 'image/png' : cleanExt === 'webp' ? 'image/webp' : 'image/jpeg';

      // 1. Permanently persist to Supabase PostgreSQL database with retries
      await persistStoredFileWithRetry(filename, mimeType, bytes, 3);

      // 2. Also write to local disk cache if writable
      try {
        const uploadDir = join(process.cwd(), 'public', 'uploads', subDir);
        await mkdir(uploadDir, { recursive: true });
        await writeFile(join(uploadDir, filename), bytes);
      } catch (fsErr) {
        console.warn('[Upload] Local disk write skipped or failed:', fsErr);
      }

      const url = `/uploads/${subDir}/${filename}`;
      const checksum = computeBufferSha256(bytes);

      // 3. If an employeeId was provided for an avatar update, atomically update employee.avatarUrl ONLY for an authenticated owner or executive
      const formEmployeeId = formData.get('employeeId')?.toString()?.trim() || request.headers.get('x-employee-id')?.trim();
      if (!isPdf && formEmployeeId) {
        const canUpdate =
          Boolean(actor) &&
          (actor!.id === formEmployeeId || hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']));
        if (canUpdate) {
          await prisma.employee.update({
            where: { id: formEmployeeId },
            data: { avatarUrl: url },
          }).catch(() => {});
        }
      }

      // 4. Create an verifiable Attachment record when uploaded by an authenticated user (for staged action evidence / receipts)
      let attachmentId: string | undefined;
      const shouldStageAttachment =
        actor &&
        (isPdf ||
          formData.get('createAttachment') === 'true' ||
          formData.get('stageAttachment') === 'true' ||
          Boolean(formData.get('ownerType')));
      if (shouldStageAttachment && actor) {
        try {
          const att = await prisma.attachment.create({
            data: {
              ownerType: formData.get('ownerType')?.toString()?.trim() || 'STAGED_EVIDENCE',
              ownerId: formData.get('ownerId')?.toString()?.trim() || actor.id,
              fileName: file.name || filename,
              contentType: mimeType,
              fileUrl: url,
              checksum,
              uploadedById: actor.id,
            },
          });
          attachmentId = att.id;
        } catch (attErr) {
          console.warn('[Upload] Optional Attachment record creation skipped:', attErr);
        }
      }

      return NextResponse.json({
        success: true,
        url,
        filename,
        checksum,
        mimeType,
        sizeBytes: bytes.length,
        ...(attachmentId ? { attachmentId } : {}),
      });
    }

    // Handle JSON Base64 Payload
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const base64Data = body.image || body.base64;
      
      if (!base64Data || typeof base64Data !== 'string') {
        return NextResponse.json({ error: 'No image data provided.' }, { status: 400 });
      }

      const matches = base64Data.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,(.+)$/);
      let buffer: Buffer;
      let rawExt = 'jpg';

      if (matches) {
        rawExt = matches[1].toLowerCase().replace('jpeg', 'jpg');
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      const allowedImageExts = ['jpg', 'png', 'webp'];
      if (!allowedImageExts.includes(rawExt)) {
        return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are permitted for profile avatars.' }, { status: 400 });
      }
      const ext = rawExt;

      if (buffer.length > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image size exceeds maximum 8MB limit.' }, { status: 400 });
      }

      const rawPreserve = typeof body.preserveFilename === 'string' ? body.preserveFilename.trim() : '';
      const isValidPreserve = /^file-\d+-[a-f0-9]+\.(jpg|jpeg|png|webp)$/i.test(rawPreserve);
      const filename = isValidPreserve ? rawPreserve : `avatar-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
      const mimeType = filename.endsWith('.png') ? 'image/png' : filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

      // 1. Permanently persist to Supabase PostgreSQL database with retries
      await persistStoredFileWithRetry(filename, mimeType, buffer, 3);

      // 2. Also write to local disk cache if writable
      try {
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(join(uploadDir, filename), buffer);
      } catch (fsErr) {
        console.warn('[Upload] Local disk write skipped or failed:', fsErr);
      }

      const url = `/uploads/avatars/${filename}`;
      const checksum = computeBufferSha256(buffer);

      const bodyEmployeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : request.headers.get('x-employee-id')?.trim();
      if (bodyEmployeeId) {
        const canUpdate =
          Boolean(actor) &&
          (actor!.id === bodyEmployeeId || hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']));
        if (canUpdate) {
          await prisma.employee.update({
            where: { id: bodyEmployeeId },
            data: { avatarUrl: url },
          }).catch(() => {});
        }
      }

      return NextResponse.json({ success: true, url, filename, checksum, mimeType, sizeBytes: buffer.length });
    }

    return NextResponse.json({ error: 'Unsupported media type.' }, { status: 415 });
  } catch (error) {
    console.error('Avatar upload failed:', error);
    return NextResponse.json({ error: 'Could not upload profile picture.' }, { status: 500 });
  }
}
