import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prepareMobileArtifact } from '@/lib/services/mobile-release';
import { executeDashboardCommand } from '@/lib/staged-actions';

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee(request, { disallowServiceToken: true });
  if (!actor || !hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) return NextResponse.json({ error: 'Executive access required.' }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Upload an APK file.');
    const artifact = await prepareMobileArtifact({ appId: String(form.get('appId') || ''), version: String(form.get('version') || ''), bytes: Buffer.from(await file.arrayBuffer()), actorId: actor.id });
    if (form.get('prepareOnly') === 'true') return NextResponse.json({ ok: true, attachmentId: artifact.id, checksum: artifact.checksum, preview: JSON.parse(artifact.notes || '{}') });
    const release = await executeDashboardCommand(actor, 'policy_update', { sub_action: 'ACTIVATE_MOBILE_APK', artifact_id: artifact.id });
    return NextResponse.json({ ok: true, release, attachmentId: artifact.id, checksum: artifact.checksum, downloadUrl: artifact.fileUrl });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'APK verification failed.' }, { status: 400 }); }
}
