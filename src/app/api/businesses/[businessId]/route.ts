import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access is required to edit business entities.' }, { status: 403 });
    }

    const { businessId } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await prisma.organization.findFirst({
      where: {
        OR: [{ id: businessId }, { code: { equals: businessId, mode: 'insensitive' } }],
      },
    });
    if (!existing) {
      return NextResponse.json({ error: `Business "${businessId}" not found.` }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (typeof body.legalName === 'string' && body.legalName.trim()) {
      updateData.legalName = body.legalName.trim();
    } else if (typeof body.name === 'string' && body.name.trim()) {
      updateData.legalName = body.name.trim();
    }
    if (typeof body.code === 'string' && body.code.trim()) {
      updateData.code = body.code.trim().toUpperCase();
    }
    if (typeof body.defaultCurrency === 'string' && body.defaultCurrency.trim()) {
      updateData.defaultCurrency = body.defaultCurrency.trim().toUpperCase();
    }
    if (body.brandColor !== undefined) {
      updateData.brandColor = body.brandColor ? String(body.brandColor).trim() : null;
    }
    if (body.logoUrl !== undefined) {
      updateData.logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null;
    }

    const updated = await prisma.organization.update({
      where: { id: existing.id },
      data: updateData,
    });

    if (body.industry) {
      await prisma.workspaceSetting.upsert({
        where: { organizationId_key: { organizationId: existing.id, key: 'SUBSIDIARY_INDUSTRY' } },
        create: { organizationId: existing.id, key: 'SUBSIDIARY_INDUSTRY', value: String(body.industry), updatedById: actor.id },
        update: { value: String(body.industry), updatedById: actor.id },
      });
    }
    if (body.headquarters) {
      await prisma.workspaceSetting.upsert({
        where: { organizationId_key: { organizationId: existing.id, key: 'HEADQUARTERS_LOCATION' } },
        create: { organizationId: existing.id, key: 'HEADQUARTERS_LOCATION', value: String(body.headquarters), updatedById: actor.id },
        update: { value: String(body.headquarters), updatedById: actor.id },
      });
    }

    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: existing.parentGroupId || existing.id,
        subsidiaryId: existing.id,
        targetType: 'ORGANIZATION',
        targetId: existing.id,
        action: 'BUSINESS_UPDATED',
        correlationId: `BIZ-PATCH-${Date.now()}`,
        metadata: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({
      ok: true,
      id: updated.id,
      legalName: updated.legalName,
      code: updated.code,
      defaultCurrency: updated.defaultCurrency,
      brandColor: updated.brandColor,
      logoUrl: updated.logoUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update business.' }, { status: 500 });
  }
}
