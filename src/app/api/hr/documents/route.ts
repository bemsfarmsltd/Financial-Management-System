import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveHrContext, logHrAudit, canUseSubFilter } from '@/lib/hrRouteHelper';

export async function GET(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { orgWhere, allowedSubIds, useSubFilter } = ctx;

    const [documents, templates, staffOptions] = await Promise.all([
      prisma.employeeDocument.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        take: 150,
        include: {
          employee: { select: { id: true, employeeNumber: true, legalName: true } },
          organization: { select: { id: true, legalName: true, code: true } },
        },
      }),
      prisma.hrDocumentTemplate.findMany({
        where: useSubFilter
          ? { OR: [{ organizationId: null }, { organizationId: { in: allowedSubIds } }] }
          : undefined,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.findMany({
        where: {
          role: 'STAFF',
          status: 'ACTIVE',
          ...(useSubFilter
            ? { assignments: { some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' } } }
            : {}),
        },
        orderBy: { legalName: 'asc' },
        select: {
          id: true,
          employeeNumber: true,
          legalName: true,
          jobTitle: true,
          assignments: { where: { status: 'ACTIVE' }, select: { subsidiaryId: true }, take: 1 },
        },
      }),
    ]);

    return NextResponse.json({ success: true, documents, templates, staffOptions });
  } catch (error) {
    console.error('HR Documents GET error:', error);
    return NextResponse.json({ error: 'Failed to load HR documents' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { actor, hrScope, defaultOrgId } = ctx;

    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'CREATE_TEMPLATE') {
      const docType = String(body.docType || 'OFFER_LETTER');
      const title = String(body.title || '').trim();
      const bodyTemplate = String(body.bodyTemplate || '').trim();
      const organizationId = body.organizationId ? String(body.organizationId) : null;

      if (!title || !bodyTemplate) {
        return NextResponse.json({ error: 'Template title and body are required.' }, { status: 400 });
      }
      if (organizationId && !canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const tpl = await prisma.hrDocumentTemplate.create({
        data: {
          organizationId,
          docType,
          title,
          bodyTemplate,
        },
      });
      return NextResponse.json({ success: true, template: tpl });
    }

    if (action === 'ISSUE_DOCUMENT') {
      const employeeId = String(body.employeeId || '');
      const docType = String(body.docType || 'OFFER_LETTER');
      const title = String(body.title || '').trim();
      const renderedHtml = body.renderedHtml ? String(body.renderedHtml) : undefined;
      const expiryDate = body.expiryDate ? String(body.expiryDate) : undefined;
      const requiresSignature = Boolean(body.requiresSignature);
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!employeeId || !title) {
        return NextResponse.json({ error: 'Employee and document title are required.' }, { status: 400 });
      }
      if (!canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const doc = await prisma.employeeDocument.create({
        data: {
          organizationId,
          employeeId,
          docType,
          title,
          renderedHtml,
          expiryDate,
          requiresSignature,
          issuedById: actor.id,
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || organizationId,
        subsidiaryId: organizationId,
        targetType: 'HR_DOCUMENT',
        targetId: doc.id,
        action: 'CREATED',
        metadata: { docType, title },
      });

      return NextResponse.json({ success: true, document: doc });
    }

    if (action === 'SIGN_DOCUMENT') {
      const id = String(body.id || '');
      const signatureNote = body.signatureNote ? String(body.signatureNote) : 'Acknowledged digitally';
      const existing = await prisma.employeeDocument.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });

      const updated = await prisma.employeeDocument.update({
        where: { id },
        data: { signedAt: new Date(), signatureNote },
      });
      return NextResponse.json({ success: true, document: updated });
    }

    return NextResponse.json({ error: 'Unsupported document action.' }, { status: 400 });
  } catch (error) {
    console.error('HR Documents POST error:', error);
    return NextResponse.json({ error: 'Failed to process document action' }, { status: 500 });
  }
}

