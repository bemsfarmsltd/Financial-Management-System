import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_CHANNELS = [
  {
    name: 'WhatsApp Bot Bridge',
    icon: '💬',
    description: 'Instant notification & emergency requisitions via WhatsApp',
    status: 'Not configured',
    address: '',
    workflow: 'High-priority notifications',
    color: '#25D366',
  },
  {
    name: 'Slack Executive Channel',
    icon: '⌗',
    description: 'Real-time alert dispatch to #executive-finance and #gmd-desk',
    status: 'Not configured',
    address: '',
    workflow: 'Executive disbursement approvals',
    color: '#4A154B',
  },
  {
    name: 'Corporate Email Dispatch',
    icon: '✉',
    description: 'Formal audit trails, debit/credit notes, and settlement notices',
    status: 'Not configured',
    address: '',
    workflow: 'Official PDF vouchers & statements',
    color: '#EA4335',
  },
];

async function resolveOrg(businessId: string) {
  if (!businessId || businessId === 'all' || businessId === 'bems-group-hq') {
    return prisma.organization.findFirst({ where: { OR: [{ type: 'GROUP' }, { code: 'BEMS-GROUP' }, { code: 'BEMS-HQ' }] } });
  }
  return prisma.organization.findFirst({
    where: { OR: [{ id: businessId }, { code: { equals: businessId, mode: 'insensitive' } }] },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { businessId } = await params;
  const org = await resolveOrg(businessId);
  if (!org) return NextResponse.json(DEFAULT_CHANNELS);

  const setting = await prisma.workspaceSetting.findUnique({
    where: { organizationId_key: { organizationId: org.id, key: 'notification.channels' } },
  });

  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed) && parsed.length > 0) return NextResponse.json(parsed);
    } catch {}
  }

  return NextResponse.json(DEFAULT_CHANNELS);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return NextResponse.json({ error: 'Executive access is required to configure notification channels.' }, { status: 403 });
  }

  const { businessId } = await params;
  const org = await resolveOrg(businessId);
  if (!org) {
    return NextResponse.json({ error: `Business "${businessId}" not found.` }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const existingSetting = await prisma.workspaceSetting.findUnique({
    where: { organizationId_key: { organizationId: org.id, key: 'notification.channels' } },
  });

  let channels = [...DEFAULT_CHANNELS];
  if (existingSetting?.value) {
    try {
      const parsed = JSON.parse(existingSetting.value);
      if (Array.isArray(parsed)) channels = parsed;
    } catch {}
  }

  const channelEntry = {
    name: String(body.name || 'Custom Channel').trim(),
    icon: String(body.icon || '🔔'),
    description: String(body.description || 'Configured corporate notification bridge'),
    status: String(body.status || 'Live'),
    address: String(body.address || ''),
    workflow: String(body.workflow || 'Executive notifications'),
    color: String(body.color || '#25D366'),
  };

  const idx = channels.findIndex((c) => c.name.toLowerCase() === channelEntry.name.toLowerCase());
  if (idx >= 0) {
    channels[idx] = { ...channels[idx], ...channelEntry };
  } else {
    channels.push(channelEntry);
  }

  await prisma.workspaceSetting.upsert({
    where: { organizationId_key: { organizationId: org.id, key: 'notification.channels' } },
    create: {
      organizationId: org.id,
      key: 'notification.channels',
      value: JSON.stringify(channels),
      updatedById: actor.id,
    },
    update: {
      value: JSON.stringify(channels),
      updatedById: actor.id,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: actor.id,
      actorName: actor.legalName,
      actorRole: actor.role,
      groupId: org.parentGroupId || org.id,
      subsidiaryId: org.id,
      targetType: 'POLICY',
      targetId: org.id,
      action: 'CHANNEL_CONFIGURED',
      correlationId: `CHAN-${Date.now()}`,
      metadata: JSON.stringify(channelEntry),
    },
  });

  return NextResponse.json({ ok: true, ...channelEntry, channels });
}
