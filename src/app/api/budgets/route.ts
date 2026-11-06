import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access is required to view budgets.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId') || searchParams.get('subsidiary');

    const scope = await resolveAuthorizedOrganizationScope(actor, organizationId);
    if (scope.organizationIds.length === 0) {
      return NextResponse.json(
        { budgets: [] },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      );
    }

    const whereClause: any = {
      organizationId: { in: scope.organizationIds },
    };

    const budgets = await prisma.budget.findMany({
      where: whereClause,
      include: {
        organization: {
          select: { id: true, legalName: true, code: true },
        },
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      { budgets },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only an Executive (GMD or Super Admin) can create budgets.' }, { status: 403 });
    }
    const body = await req.json();
    const {
      organizationId,
      fiscalYear,
      fiscalPeriod,
      periodName,
      totalAmount,
      warningThreshold,
      lines,
    } = body;

    if (!organizationId || !periodName || totalAmount === undefined || totalAmount === null) {
      return NextResponse.json(
        { error: 'organizationId, periodName, and totalAmount are required' },
        { status: 400 }
      );
    }

    const parsedTotal = parseFloat(totalAmount);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return NextResponse.json(
        { error: 'totalAmount must be a positive number' },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: String(organizationId) },
    });
    if (!org) {
      return NextResponse.json(
        { error: `Target organization (${organizationId}) was not found.` },
        { status: 404 }
      );
    }

    const normalizedPeriodName = String(periodName).trim();
    const existingActive = await prisma.budget.findFirst({
      where: {
        organizationId: org.id,
        periodName: { equals: normalizedPeriodName, mode: 'insensitive' },
        status: 'ACTIVE',
      },
    });
    if (existingActive) {
      return NextResponse.json(
        {
          error: `An active budget for ${org.legalName} (${normalizedPeriodName}) already exists. Use update or reallocate instead.`,
          existingBudgetId: existingActive.id,
        },
        { status: 409 }
      );
    }

    const budget = await prisma.$transaction(async (tx) => {
      const created = await tx.budget.create({
        data: {
          organizationId: org.id,
          fiscalYear: fiscalYear ? parseInt(fiscalYear, 10) : new Date().getFullYear(),
          fiscalPeriod: fiscalPeriod || 'QUARTERLY',
          periodName: normalizedPeriodName,
          totalAmount: parsedTotal,
          warningThreshold: warningThreshold ? parseFloat(warningThreshold) : 80.0,
          createdById: actor.id,
          status: 'ACTIVE',
          lines: {
            create: (lines || []).map((l: any) => ({
              departmentName: l.departmentName || 'General Operations',
              category: l.category || 'Operating Expenses',
              expenseType: l.expenseType || 'OPEX',
              allocatedAmount: parseFloat(l.allocatedAmount || 0),
              committedAmount: 0,
              spentAmount: 0,
              status: 'ACTIVE',
            })),
          },
        },
        include: {
          organization: true,
          lines: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: org.parentGroupId || org.id,
          subsidiaryId: org.id,
          targetType: 'BUDGET',
          targetId: created.id,
          action: 'BUDGET_CREATED',
          correlationId: `BUDGET-CREATE-${created.id}`,
          metadata: JSON.stringify({
            periodName: created.periodName,
            totalAmount: created.totalAmount,
            lineCount: created.lines.length,
          }),
        },
      });

      return created;
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
