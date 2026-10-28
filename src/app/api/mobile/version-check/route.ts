import { NextResponse } from 'next/server';
import { checkMobileAppVersion, getMobileAppGate } from '@/lib/mobile-gate';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId') || request.headers.get('x-app-id') || 'GMD_APP';
    const clientVersion = searchParams.get('version') || request.headers.get('x-app-version') || '1.0.0';

    const check = await checkMobileAppVersion(appId, clientVersion);
    const gate = check.gate || await getMobileAppGate(appId);

    return NextResponse.json({
      appId: gate?.appId || appId,
      appName: gate?.appName || '',
      packageName: gate?.packageName || '',
      clientVersion,
      minimumAllowedVersion: gate?.minimumAllowedVersion || '1.0.0',
      latestVersionAvailable: gate?.latestVersionAvailable || '1.0.0',
      forceUpdate: gate?.forceUpdate ?? true,
      upgradeRequired: check.upgradeRequired,
      directDownloadUrl: gate?.directDownloadUrl || 'https://bemserp.work/download',
      upgradePromptNotes: gate?.upgradePromptNotes || '',
    });
  } catch (error) {
    console.error('[mobile/version-check] Error checking version gate:', error);
    return NextResponse.json(
      { error: 'Could not check version gate status.' },
      { status: 500 }
    );
  }
}
