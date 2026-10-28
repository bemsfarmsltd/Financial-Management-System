import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'HEAD_OF_ADMIN', 'COO', 'GMD'];

export async function POST(request: Request) {
  try {
    const employee = await getAuthenticatedEmployee(request);
    if (!employee || !ADMIN_ROLES.includes(employee.role)) {
      return NextResponse.json({ error: 'Unauthorized administrative access.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const appId = (formData.get('appId') as string) || 'GMD_APP';
    const version = (formData.get('version') as string) || '1.0.0';
    const notes = (formData.get('notes') as string) || '';
    const applyAsMin = formData.get('applyAsMin') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No APK file uploaded.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.apk')) {
      return NextResponse.json({ error: 'Only Android Application Package (.apk) files are accepted.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

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
        notes,
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
        upgradePromptNotes: notes || undefined,
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
        upgradePromptNotes: notes || 'New APK build deployed.',
        updatedById: employee.id,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `APK for ${isGmd ? 'BEMS GMD AI' : 'BEMS Staff App'} v${version} deployed successfully (${sizeInMB}).`,
      release,
      downloadUrl: `https://bemserp.work${downloadUrl}`,
    });
  } catch (error) {
    console.error('[admin/mobile-apps/upload] Error uploading APK:', error);
    return NextResponse.json({ error: 'Failed to process and deploy APK.' }, { status: 500 });
  }
}
