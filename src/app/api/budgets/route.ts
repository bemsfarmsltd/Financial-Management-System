import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'HR'])) return NextResponse.json({ error: 'Executive or HR access is required to view budgets.' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId') || searchParams.get('subsidiary');

    const whereClause: any = {};
    if (organizationId && organizationId !== 'ALL') {
      const { resolveOrganizationScope } = await import('@/lib/organizations');
      const scope = await resolveOrganizationScope(organizationId);
      if (!scope.isGroup) {
        whereClause.organizationId = { in: scope.organizationIds };
      }
    }

    const budgets = await prisma.budget.findMany({
      where: whereClause,
      include: {
        organization: {
          select: { id: true, legalName: true, code: true }
        },
        lines: true
      },
      orderBy: { createdAt: 'desc' }
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
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the System Admin or GMD can create budgets.' }, { status: 403 });
    const body = await req.json();
    const {
      organizationId,
      fiscalYear,
      fiscalPeriod,
      periodName,
      totalAmount,
      warningThreshold,
      lines
    } = body;

    if (!organizationId || !periodName || !totalAmount) {
      return NextResponse.json(
        { error: 'organizationId, periodName, and totalAmount are required' },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.create({
      data: {
        organizationId,
        fiscalYear: fiscalYear ? parseInt(fiscalYear, 10) : new Date().getFullYear(),
        fiscalPeriod: fiscalPeriod || 'QUARTERLY',
        periodName,
        totalAmount: parseFloat(totalAmount),
        warningThreshold: warningThreshold ? parseFloat(warningThreshold) : 80.0,
        status: 'ACTIVE',
        lines: {
          create: (lines || []).map((l: any) => ({
            departmentName: l.departmentName || 'General Operations',
            category: l.category || 'Operating Expenses',
            expenseType: l.expenseType || 'OPEX',
            allocatedAmount: parseFloat(l.allocatedAmount || 0),
            committedAmount: 0,
            spentAmount: 0,
            status: 'ACTIVE'
          }))
        }
      },
      include: {
        organization: true,
        lines: true
      }
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
