import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to view budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'HR'])) return NextResponse.json({ error: 'Executive or HR access is required to view budgets.' }, { status: 403 });
    const { id } = await params;
    const budget = await prisma.budget.findUnique({
      where: { id },
      include: {
        organization: true,
        lines: true
      }
    });

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    return NextResponse.json({ budget });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to manage budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the System Admin or GMD can update budgets.' }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const { status, warningThreshold, totalAmount, periodName } = body;

    const data: any = {};
    if (status) data.status = status;
    if (warningThreshold !== undefined) data.warningThreshold = parseFloat(warningThreshold);
    if (totalAmount !== undefined) data.totalAmount = parseFloat(totalAmount);
    if (periodName) data.periodName = periodName;

    const updated = await prisma.budget.update({
      where: { id },
      data,
      include: {
        organization: true,
        lines: true
      }
    });

    return NextResponse.json({ budget: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to manage budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the System Admin or GMD can delete budgets.' }, { status: 403 });
    const { id } = await params;
    await prisma.budget.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
