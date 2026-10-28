import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface MobileGateCheckResult {
  allowed: boolean;
  upgradeRequired: boolean;
  gate: {
    appId: string;
    appName: string;
    packageName: string;
    minimumAllowedVersion: string;
    latestVersionAvailable: string;
    forceUpdate: boolean;
    directDownloadUrl: string;
    upgradePromptNotes: string | null;
  } | null;
}

/**
 * Compare two semver strings: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function semverCompare(v1: string, v2: string): number {
  const clean1 = (v1 || '').trim().replace(/^v/i, '');
  const clean2 = (v2 || '').trim().replace(/^v/i, '');

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Get or automatically initialize default gate rules for a mobile application
 */
export async function getMobileAppGate(appId: string) {
  const normalizedAppId = appId.toUpperCase();
  let gate = await prisma.mobileAppGate.findUnique({
    where: { appId: normalizedAppId },
  });

  if (!gate) {
    const isGmd = normalizedAppId === 'GMD_APP' || normalizedAppId.includes('GMD');
    const defaultData = isGmd
      ? {
          appId: 'GMD_APP',
          appName: 'BEMS GMD AI',
          packageName: 'com.bemsgroup.gmd_ai',
          minimumAllowedVersion: '1.0.0',
          latestVersionAvailable: '1.0.0',
          forceUpdate: true,
          directDownloadUrl: 'https://bemserp.work/download/gmd-app.apk',
          upgradePromptNotes: 'Critical security and synchronized balance engine updates.',
        }
      : {
          appId: 'STAFF_APP',
          appName: 'BEMS Staff App',
          packageName: 'com.bemsgroup.staff',
          minimumAllowedVersion: '1.0.0',
          latestVersionAvailable: '1.0.0',
          forceUpdate: true,
          directDownloadUrl: 'https://bemserp.work/download/staff-app.apk',
          upgradePromptNotes: 'Streamlined expenditure requisitions, offline drafts and receipt uploads.',
        };

    try {
      gate = await prisma.mobileAppGate.upsert({
        where: { appId: defaultData.appId },
        update: {},
        create: defaultData,
      });
    } catch {
      // In case of parallel initialization, fetch existing
      gate = await prisma.mobileAppGate.findUnique({
        where: { appId: defaultData.appId },
      });
    }
  }

  return gate;
}

/**
 * Check if a client version is allowed under active gate rules
 */
export async function checkMobileAppVersion(appId: string, clientVersion: string): Promise<MobileGateCheckResult> {
  const gate = await getMobileAppGate(appId);
  if (!gate) {
    return { allowed: true, upgradeRequired: false, gate: null };
  }

  if (!clientVersion) {
    // If no version header is provided, do not hard-block legacy web requests,
    // but flag if forced update is on for mobile agents
    return { allowed: true, upgradeRequired: false, gate };
  }

  const isBelowMinimum = semverCompare(clientVersion, gate.minimumAllowedVersion) < 0;

  if (gate.forceUpdate && isBelowMinimum) {
    return { allowed: false, upgradeRequired: true, gate };
  }

  return { allowed: true, upgradeRequired: false, gate };
}

/**
 * Request interceptor to gate mobile app API requests with HTTP 426 Upgrade Required
 */
export async function enforceMobileVersionGate(request: Request): Promise<NextResponse | null> {
  const appId = request.headers.get('x-app-id');
  const appVersion = request.headers.get('x-app-version');

  if (!appId || !appVersion) {
    return null; // Not a gated mobile request or web client
  }

  const check = await checkMobileAppVersion(appId, appVersion);
  if (!check.allowed && check.gate) {
    return NextResponse.json(
      {
        error: 'Upgrade Required',
        code: 'APP_UPGRADE_REQUIRED',
        message: `Your app version (${appVersion}) is outdated. Version ${check.gate.minimumAllowedVersion} or higher is required to continue.`,
        minimumAllowedVersion: check.gate.minimumAllowedVersion,
        latestVersionAvailable: check.gate.latestVersionAvailable,
        directDownloadUrl: check.gate.directDownloadUrl,
        upgradePromptNotes: check.gate.upgradePromptNotes || 'Please update your application to the latest version to maintain data consistency.',
      },
      { status: 426 }
    );
  }

  return null;
}
