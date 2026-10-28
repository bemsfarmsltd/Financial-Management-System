import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMobileAppGate } from '@/lib/mobile-gate';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'HEAD_OF_ADMIN', 'COO', 'GMD'];

export async function GET(request: Request) {
  try {
    const employee = await getAuthenticatedEmployee(request);
    if (!employee || !ADMIN_ROLES.includes(employee.role)) {
      return NextResponse.json({ error: 'Unauthorized administrative access.' }, { status: 403 });
    }

    // Ensure both gates are initialized
    const gmdGate = await getMobileAppGate('GMD_APP');
    const staffGate = await getMobileAppGate('STAFF_APP');

    const releases = await prisma.mobileAppRelease.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      gates: {
        GMD_APP: gmdGate,
        STAFF_APP: staffGate,
      },
      releases,
    });
  } catch (error) {
    console.error('[admin/mobile-apps] GET error:', error);
    return NextResponse.json({ error: 'Failed to load mobile app settings.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const employee = await getAuthenticatedEmployee(request);
    if (!employee || !ADMIN_ROLES.includes(employee.role)) {
      return NextResponse.json({ error: 'Unauthorized administrative access.' }, { status: 403 });
    }

    const body = await request.json();
    const { appId, minimumAllowedVersion, latestVersionAvailable, forceUpdate, directDownloadUrl, upgradePromptNotes } = body;

    if (!appId || !['GMD_APP', 'STAFF_APP'].includes(appId)) {
      return NextResponse.json({ error: 'Invalid appId. Must be GMD_APP or STAFF_APP.' }, { status: 400 });
    }

    const updated = await prisma.mobileAppGate.upsert({
      where: { appId },
      update: {
        minimumAllowedVersion: minimumAllowedVersion || '1.0.0',
        latestVersionAvailable: latestVersionAvailable || '1.0.0',
        forceUpdate: typeof forceUpdate === 'boolean' ? forceUpdate : true,
        directDownloadUrl: directDownloadUrl || (appId === 'GMD_APP' ? 'https://bemserp.work/download/gmd-app.apk' : 'https://bemserp.work/download/staff-app.apk'),
        upgradePromptNotes: upgradePromptNotes || '',
        updatedById: employee.id,
      },
      create: {
        appId,
        appName: appId === 'GMD_APP' ? 'BEMS GMD AI' : 'BEMS Staff App',
        packageName: appId === 'GMD_APP' ? 'com.bemsgroup.gmd_ai' : 'com.bemsgroup.staff',
        minimumAllowedVersion: minimumAllowedVersion || '1.0.0',
        latestVersionAvailable: latestVersionAvailable || '1.0.0',
        forceUpdate: typeof forceUpdate === 'boolean' ? forceUpdate : true,
        directDownloadUrl: directDownloadUrl || (appId === 'GMD_APP' ? 'https://bemserp.work/download/gmd-app.apk' : 'https://bemserp.work/download/staff-app.apk'),
        upgradePromptNotes: upgradePromptNotes || '',
        updatedById: employee.id,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Version gate rules for ${updated.appName} successfully updated. Outdated apps will immediately receive HTTP 426 on their next API request.`,
      gate: updated,
    });
  } catch (error) {
    console.error('[admin/mobile-apps] POST error:', error);
    return NextResponse.json({ error: 'Failed to update gate rules.' }, { status: 500 });
  }
}
