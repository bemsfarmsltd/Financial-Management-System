import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const execute = promisify(execFile);
const packages: Record<string, string> = { GMD_APP: 'com.bemsgroup.bems_gmd_ai', STAFF_APP: 'com.bemsfarms.bems_staff_app' };
export async function prepareMobileArtifact(input: { appId: string; version: string; bytes: Buffer; actorId: string }) {
  if (!packages[input.appId]) throw new Error('Unknown mobile application.');
  if (!/^\d+\.\d+\.\d+(\+\d+)?$/.test(input.version)) throw new Error('Supply the full application version and build.');
  if (!input.bytes.length || input.bytes.length > 150 * 1024 * 1024) throw new Error('APK must be between 1 byte and 150 MB.');
  const expectedSigner = process.env[input.appId === 'GMD_APP' ? 'BEMS_GMD_APK_CERT_SHA256' : 'BEMS_STAFF_APK_CERT_SHA256']?.replace(/:/g, '').toLowerCase();
  const signerTool = process.env.BEMS_APKSIGNER_PATH;
  const metadataTool = process.env.BEMS_AAPT_PATH;
  if (!expectedSigner || !signerTool || !metadataTool) throw new Error('Configure trusted Android signing certificates and APK verification tools before publishing.');
  const directory = await mkdtemp(path.join(tmpdir(), 'bems-apk-'));
  try {
    const apkPath = path.join(directory, 'artifact.apk');
    await writeFile(apkPath, input.bytes);
    const signature = await execute(signerTool, ['verify', '--print-certs', apkPath], { timeout: 30000 });
    if (/certificate DN:.*CN=Android Debug/i.test(signature.stdout)) throw new Error('Debug-signed APKs cannot be published as production releases.');
    const signer = signature.stdout.match(/certificate SHA-256 digest:\s*([a-fA-F0-9:]+)/)?.[1]?.replace(/:/g, '').toLowerCase();
    if (signer !== expectedSigner) throw new Error('The APK signing certificate is not trusted for this application.');
    const metadata = await execute(metadataTool, ['dump', 'badging', apkPath], { timeout: 30000 });
    const name = metadata.stdout.match(/package: name='([^']+)'/)?.[1];
    const versionName = metadata.stdout.match(/versionName='([^']+)'/)?.[1];
    const versionCode = metadata.stdout.match(/versionCode='([^']+)'/)?.[1];
    const [requestedName, requestedCode] = input.version.split('+');
    if (name !== packages[input.appId] || versionName !== requestedName || (requestedCode && versionCode !== requestedCode)) throw new Error('The APK package or embedded version does not match the selected release.');
    const checksum = createHash('sha256').update(input.bytes).digest('hex');
    const filename = `${input.appId.toLowerCase()}-${checksum}.apk`;
    const output = path.join(process.cwd(), 'public', 'downloads');
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, filename), input.bytes, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
    const artifact = await prisma.attachment.create({ data: {
      ownerType: 'VERIFIED_APK', ownerId: input.appId, uploadedById: input.actorId,
      fileName: filename, fileUrl: '/downloads/' + filename, contentType: 'application/vnd.android.package-archive', checksum,
      notes: JSON.stringify({ appId: input.appId, version: `${versionName}+${versionCode}`, signer, checksum, size: input.bytes.length }), fileData: new Uint8Array(input.bytes),
    } });
    return artifact;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function activateMobileArtifact(tx: Prisma.TransactionClient, artifactId: string, actor: { id: string; legalName: string }) {
  const artifact = await tx.attachment.findUnique({ where: { id: artifactId } });
  if (artifact?.ownerType !== 'VERIFIED_APK' || !artifact.fileData) throw new Error('Choose a verified uploaded APK artifact.');
  const metadata = JSON.parse(artifact.notes || '{}');
  const checksum = createHash('sha256').update(artifact.fileData).digest('hex');
  const expectedSigner = process.env[metadata.appId === 'GMD_APP' ? 'BEMS_GMD_APK_CERT_SHA256' : 'BEMS_STAFF_APK_CERT_SHA256']?.replace(/:/g, '').toLowerCase();
  if (!packages[metadata.appId] || !expectedSigner || metadata.signer !== expectedSigner || checksum !== metadata.checksum || checksum !== artifact.checksum) throw new Error('APK verification is missing, expired or changed.');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'mobile:' + metadata.appId}, 0))`;
  await tx.mobileAppRelease.updateMany({ where: { appId: metadata.appId, status: 'ACTIVE' }, data: { status: 'ARCHIVE' } });
  const release = await tx.mobileAppRelease.create({ data: { appId: metadata.appId, version: metadata.version, fileName: artifact.fileName, fileSize: String(metadata.size), downloadUrl: artifact.fileUrl, status: 'ACTIVE', notes: JSON.stringify(metadata), uploadedBy: actor.legalName } });
  await tx.mobileAppGate.upsert({ where: { appId: metadata.appId }, update: { packageName: packages[metadata.appId], latestVersionAvailable: metadata.version, directDownloadUrl: artifact.fileUrl, updatedById: actor.id }, create: { appId: metadata.appId, appName: metadata.appId === 'GMD_APP' ? 'BEMS GMD AI' : 'BEMS Staff App', packageName: packages[metadata.appId], latestVersionAvailable: metadata.version, minimumAllowedVersion: metadata.version, forceUpdate: true, directDownloadUrl: artifact.fileUrl, updatedById: actor.id } });
  return release;
}
