import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { queryAuthorizedBudgets } from '@/lib/services/budget-read';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view budgets.' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId') || searchParams.get('subsidiary');

    const result = await queryAuthorizedBudgets({
      actor,
      organizationId,
      period: searchParams.get('period'),
      status: searchParams.get('status') || 'ALL',
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    });

    if (!result.authorized) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(
      { budgets: result.budgets, scope: result.scope, pagination: result.pagination },
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
    const body = await req.json();
    const budget = await executeDashboardCommand(actor, 'budget', {
      mode: 'create', organization_id: body.organizationId, period: body.periodName,
      fiscal_year: body.fiscalYear, fiscal_period: body.fiscalPeriod,
      total_amount: body.totalAmount, warning_threshold: body.warningThreshold, allocations: body.lines || [],
    });
    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
