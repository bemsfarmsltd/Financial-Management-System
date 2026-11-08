import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access is required to view budgets.' }, { status: 403 });
    }
    const { id } = await params;
    const budget = await prisma.budget.findUnique({
      where: { id },
      include: {
        organization: true,
        lines: true,
      },
    });

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    return NextResponse.json({ budget });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function mutate(req: Request, params: Promise<{ id: string }>, archive: boolean) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive access required.' }, { status: 403 });
    const { id } = await params;
    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Budget not found.' }, { status: 404 });
    const body = archive ? {} : await req.json();
    const budget = await executeDashboardCommand(actor, 'budget', {
      mode: archive || body.status === 'CLOSED' ? 'archive' : 'reallocate', budget_id: id,
      organization_id: existing.organizationId, period: body.periodName || existing.periodName,
      total_amount: body.totalAmount, warning_threshold: body.warningThreshold, allocations: body.lines,
      expected_updated_at: existing.updatedAt.toISOString(),
    });
    return NextResponse.json(archive ? { success: true, budget } : { budget });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) { return mutate(req, params, false); }
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) { return mutate(req, params, true); }
