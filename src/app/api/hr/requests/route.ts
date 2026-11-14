import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveHrContext, logHrAudit, canUseSubFilter } from '@/lib/hrRouteHelper';

export async function GET(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { orgWhere, allowedSubIds, useSubFilter } = ctx;

    const [tickets, staffOptions] = await Promise.all([
      prisma.hrRequestTicket.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        take: 150,
        include: {
          employee: { select: { id: true, employeeNumber: true, legalName: true, jobTitle: true } },
          organization: { select: { id: true, legalName: true, code: true } },
        },
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
          assignments: { where: { status: 'ACTIVE' }, select: { subsidiaryId: true }, take: 1 },
        },
      }),
    ]);

    return NextResponse.json({ success: true, tickets, staffOptions });
  } catch (error) {
    console.error('HR Requests GET error:', error);
    return NextResponse.json({ error: 'Failed to load HR requests' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { actor, hrScope, defaultOrgId } = ctx;

    const body = await req.json();
    const action = String(body.action || 'CREATE');

    if (action === 'CREATE') {
      const employeeId = String(body.employeeId || '');
      const category = String(body.category || 'EMPLOYMENT_LETTER');
      const subject = String(body.subject || '').trim();
      const description = String(body.description || '').trim();
      const priority = String(body.priority || 'NORMAL');
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!employeeId || !subject || !description) {
        return NextResponse.json({ error: 'Employee, subject, and description are required.' }, { status: 400 });
      }
      if (!canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const refCode = `HRQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await prisma.hrRequestTicket.create({
        data: {
          referenceCode: refCode,
          organizationId,
          employeeId,
          category,
          subject,
          description,
          priority,
          status: 'PENDING',
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || organizationId,
        subsidiaryId: organizationId,
        targetType: 'HR_REQUEST',
        targetId: created.id,
        action: 'CREATED',
        metadata: { referenceCode: created.referenceCode, category },
      });

      return NextResponse.json({ success: true, ticket: created });
    }

    if (action === 'RESOLVE') {
      const id = String(body.id || '');
      const decision = String(body.decision || ''); // IN_REVIEW | APPROVED | REJECTED | CANCELLED
      const resolutionNote = body.resolutionNote ? String(body.resolutionNote) : undefined;

      if (!id || !['IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(decision)) {
        return NextResponse.json({ error: 'Invalid request resolution.' }, { status: 400 });
      }

      const existing = await prisma.hrRequestTicket.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
      if (!canUseSubFilter(hrScope, existing.organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }
      if (decision === 'APPROVED' && existing.employeeId === actor.id && actor.role !== 'GMD') {
        return NextResponse.json({ error: 'Self-approval is blocked by policy.' }, { status: 403 });
      }

      const updated = await prisma.hrRequestTicket.update({
        where: { id },
        data: {
          status: decision,
          resolvedById: actor.id,
          resolutionNote: resolutionNote ?? existing.resolutionNote,
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || existing.organizationId,
        subsidiaryId: existing.organizationId,
        targetType: 'HR_REQUEST',
        targetId: id,
        action: decision,
      });

      return NextResponse.json({ success: true, ticket: updated });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('HR Requests POST error:', error);
    return NextResponse.json({ error: 'Failed to process HR request' }, { status: 500 });
  }
}

