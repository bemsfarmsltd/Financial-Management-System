import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveHrContext, logHrAudit, canUseSubFilter } from '@/lib/hrRouteHelper';

export async function GET(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { actor, orgWhere, allowedSubIds, useSubFilter } = ctx;

    const [disciplinaryCases, grievances, staffOptions] = await Promise.all([
      prisma.disciplinaryCase.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, employeeNumber: true, legalName: true, jobTitle: true } },
          organization: { select: { id: true, legalName: true, code: true } },
        },
      }),
      prisma.employeeGrievanceCase.findMany({
        where: {
          ...orgWhere,
          // Anti-retaliation: never show confidential grievances filed against the viewer
          NOT: { againstEmployeeId: actor.id },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, employeeNumber: true, legalName: true } },
          againstEmployee: { select: { id: true, employeeNumber: true, legalName: true } },
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

    return NextResponse.json({ success: true, disciplinaryCases, grievances, staffOptions });
  } catch (error) {
    console.error('HR Relations GET error:', error);
    return NextResponse.json({ error: 'Failed to load employee relations data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { actor, hrScope, defaultOrgId } = ctx;

    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'OPEN_DISCIPLINARY') {
      const employeeId = String(body.employeeId || '');
      const severity = String(body.severity || 'MINOR');
      const allegation = String(body.allegation || '').trim();
      const queryText = body.queryText ? String(body.queryText) : undefined;
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!employeeId || !allegation) {
        return NextResponse.json({ error: 'Employee and allegation are required.' }, { status: 400 });
      }
      if (!canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const caseNumber = `DSC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await prisma.disciplinaryCase.create({
        data: {
          caseNumber,
          organizationId,
          employeeId,
          severity,
          allegation,
          step: queryText ? 'QUERY_ISSUED' : 'HR_REVIEW',
          queryText,
          issuedById: actor.id,
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || organizationId,
        subsidiaryId: organizationId,
        targetType: 'DISCIPLINE',
        targetId: created.id,
        action: 'CREATED',
        metadata: { caseNumber, severity },
      });

      return NextResponse.json({ success: true, record: created });
    }

    if (action === 'ADVANCE_DISCIPLINARY') {
      const id = String(body.id || '');
      const step = String(body.step || '');
      const decisionOutcome = body.decisionOutcome ? String(body.decisionOutcome) : undefined;
      const employeeResponse = body.employeeResponse ? String(body.employeeResponse) : undefined;

      const existing = await prisma.disciplinaryCase.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
      if (!canUseSubFilter(hrScope, existing.organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const updated = await prisma.disciplinaryCase.update({
        where: { id },
        data: {
          step: step || existing.step,
          decisionOutcome: decisionOutcome ?? existing.decisionOutcome,
          employeeResponse: employeeResponse ?? existing.employeeResponse,
          decidedById: decisionOutcome ? actor.id : existing.decidedById,
        },
      });
      return NextResponse.json({ success: true, record: updated });
    }

    if (action === 'FILE_GRIEVANCE') {
      const reporterId = String(body.reporterId || actor.id);
      const againstEmployeeId = body.againstEmployeeId ? String(body.againstEmployeeId) : null;
      const category = String(body.category || 'OTHER');
      const summary = String(body.summary || '').trim();
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!summary) {
        return NextResponse.json({ error: 'Grievance summary is required.' }, { status: 400 });
      }
      const ticketCode = `GRV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await prisma.employeeGrievanceCase.create({
        data: {
          ticketCode,
          organizationId,
          reporterId,
          againstEmployeeId,
          category,
          summary,
          isConfidential: true,
          restrictedReviewerId: actor.id,
          status: 'OPEN',
        },
      });
      return NextResponse.json({ success: true, record: created });
    }

    if (action === 'UPDATE_GRIEVANCE') {
      const id = String(body.id || '');
      const status = String(body.status || 'INVESTIGATING');
      const resolutionNote = body.resolutionNote ? String(body.resolutionNote) : undefined;
      const existing = await prisma.employeeGrievanceCase.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Grievance not found.' }, { status: 404 });
      if (existing.againstEmployeeId === actor.id) {
        return NextResponse.json({ error: 'Anti-retaliation policy blocks access.' }, { status: 403 });
      }

      const updated = await prisma.employeeGrievanceCase.update({
        where: { id },
        data: { status, resolutionNote: resolutionNote ?? existing.resolutionNote },
      });
      return NextResponse.json({ success: true, record: updated });
    }

    return NextResponse.json({ error: 'Unsupported relations action.' }, { status: 400 });
  } catch (error) {
    console.error('HR Relations POST error:', error);
    return NextResponse.json({ error: 'Failed to process relations action' }, { status: 500 });
  }
}

