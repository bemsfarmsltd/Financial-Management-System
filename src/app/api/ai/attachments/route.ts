import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeBufferSha256 } from '@/lib/platform/staged-attachments';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access is required to upload AI attachments.' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Multipart form-data is required.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds maximum 12MB limit.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'csv', 'txt', 'json', 'md'];
    if (!validExtensions.includes(ext)) {
      return NextResponse.json(
        { error: 'Supported AI attachment formats: JPG, PNG, WebP, PDF, CSV, TXT, JSON, MD.' },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
    const isText = ['csv', 'txt', 'json', 'md'].includes(ext);
    const subDir = isImage ? 'avatars' : 'documents';
    const filename = `ai-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const mimeType =
      file.type ||
      (ext === 'png'
        ? 'image/png'
        : ext === 'webp'
        ? 'image/webp'
        : isImage
        ? 'image/jpeg'
        : ext === 'pdf'
        ? 'application/pdf'
        : 'text/plain');

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

    const url = `/uploads/${subDir}/${filename}`;
    const checksum = computeBufferSha256(bytes);

    await prisma.attachment.create({
      data: {
        ownerType: 'STAGED_EVIDENCE',
        ownerId: actor.id,
        fileName: file.name || filename,
        contentType: mimeType,
        fileUrl: url,
        fileData: new Uint8Array(bytes),
        checksum,
        uploadedById: actor.id,
      },
    });

    let textContent: string | undefined;
    if (isText) {
      textContent = bytes.toString('utf8').slice(0, 6000);
    }

    return NextResponse.json({
      success: true,
      url,
      name: file.name || filename,
      type: mimeType,
      sizeBytes: bytes.length,
      textContent,
    });
  } catch (error: any) {
    console.error('[AI Attachment Upload] Error:', error);
    return NextResponse.json({ error: error.message || 'Could not upload AI attachment.' }, { status: 500 });
  }
}
