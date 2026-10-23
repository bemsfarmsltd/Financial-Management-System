import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle Multipart Form Data
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
      }

      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Only image files (JPG, PNG, WebP) are permitted for profile photos.' }, { status: 400 });
      }

      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image size exceeds maximum 8MB limit.' }, { status: 400 });
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const cleanExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const filename = `avatar-${Date.now()}-${randomUUID().slice(0, 8)}.${cleanExt}`;
      
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, filename), bytes);

      const url = `/uploads/avatars/${filename}`;
      return NextResponse.json({ success: true, url, filename });
    }

    // Handle JSON Base64 Payload
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const base64Data = body.image || body.base64;
      
      if (!base64Data || typeof base64Data !== 'string') {
        return NextResponse.json({ error: 'No image data provided.' }, { status: 400 });
      }

      // Check format
      const matches = base64Data.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = 'jpg';

      if (matches) {
        ext = matches[1].replace('jpeg', 'jpg');
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      if (buffer.length > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image size exceeds maximum 8MB limit.' }, { status: 400 });
      }

      const filename = `avatar-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, filename), buffer);

      const url = `/uploads/avatars/${filename}`;
      return NextResponse.json({ success: true, url, filename });
    }

    return NextResponse.json({ error: 'Unsupported media type.' }, { status: 415 });
  } catch (error) {
    console.error('Avatar upload failed:', error);
    return NextResponse.json({ error: 'Could not upload profile picture.' }, { status: 500 });
  }
}
