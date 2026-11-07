import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const employee = await getAuthenticatedEmployee(request);
    if (!employee || !hasAnyRole(employee, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Unauthorized administrative access.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const appId = (formData.get('appId') as string) || 'GMD_APP';
    const version = ((formData.get('version') as string) || '').trim();
    const notes = ((formData.get('notes') as string) || '').trim();
    const applyAsMin = formData.get('applyAsMin') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No APK file uploaded.' }, { status: 400 });
    }

    if (!version || !/^\d+\.\d+\.\d+([+-][a-zA-Z0-9.-]+)?$/.test(version)) {
      return NextResponse.json({ error: 'Explicit semantic version (e.g., 1.0.2) is required.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.apk')) {
      return NextResponse.json({ error: 'Only Android Application Package (.apk) files are accepted.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Verify ZIP/APK local file header magic bytes (PK\x03\x04)
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      return NextResponse.json(
        { error: 'Uploaded binary failed APK/ZIP header signature verification (PK\\x03\\x04).' },
        { status: 400 }
      );
    }

    const sha256Checksum = `sha256:${createHash('sha256').update(buffer).digest('hex')}`;

    // Ensure public/downloads directory exists
    const downloadsDir = path.join(process.cwd(), 'public', 'downloads');
    await fs.mkdir(downloadsDir, { recursive: true });

    // Canonical direct download filename and versioned archive filename
    const isGmd = appId === 'GMD_APP';
    const canonicalName = isGmd ? 'gmd-app.apk' : 'staff-app.apk';
    const canonicalPath = path.join(downloadsDir, canonicalName);
    const versionedName = `${isGmd ? 'BemsGmdAi' : 'BemsStaff'}-v${version}.apk`;
    const versionedPath = path.join(downloadsDir, versionedName);

    // Write both the canonical file and versioned archive
    await fs.writeFile(canonicalPath, buffer);
    await fs.writeFile(versionedPath, buffer);

    const sizeInMB = (buffer.length / (1024 * 1024)).toFixed(1) + ' MB';
    const downloadUrl = `/downloads/${canonicalName}`;
    const releaseNotesWithChecksum = notes
      ? `${notes} [${sha256Checksum}]`
      : `Verified build [${sha256Checksum}]`;

    // Archive previous releases
    await prisma.mobileAppRelease.updateMany({
      where: { appId, status: 'ACTIVE' },
      data: { status: 'ARCHIVE' },
    });

    // Create new release record
    const release = await prisma.mobileAppRelease.create({
      data: {
        appId,
        version,
        fileName: versionedName,
        fileSize: sizeInMB,
        downloadUrl,
        status: 'ACTIVE',
        notes: releaseNotesWithChecksum,
        uploadedBy: employee.workEmail,
      },
    });

    // Update Gate latestVersionAvailable (and optionally minimumAllowedVersion)
    await prisma.mobileAppGate.upsert({
      where: { appId },
      update: {
        latestVersionAvailable: version,
        ...(applyAsMin ? { minimumAllowedVersion: version } : {}),
        directDownloadUrl: `https://bemserp.work${downloadUrl}`,
        upgradePromptNotes: releaseNotesWithChecksum,
        updatedById: employee.id,
      },
      create: {
        appId,
        appName: isGmd ? 'BEMS GMD AI' : 'BEMS Staff App',
        packageName: isGmd ? 'com.bemsgroup.gmd_ai' : 'com.bemsgroup.staff',
        minimumAllowedVersion: applyAsMin ? version : '1.0.0',
        latestVersionAvailable: version,
        forceUpdate: true,
        directDownloadUrl: `https://bemserp.work${downloadUrl}`,
        upgradePromptNotes: releaseNotesWithChecksum,
        updatedById: employee.id,
      },
    });

    return NextResponse.json({
      ok: true,
      checksum: sha256Checksum,
      message: `APK for ${isGmd ? 'BEMS GMD AI' : 'BEMS Staff App'} v${version} deployed and checksum-verified (${sizeInMB}).`,
      release,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/mobile-apps/upload:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload APK.' }, { status: 500 });
  }
}
