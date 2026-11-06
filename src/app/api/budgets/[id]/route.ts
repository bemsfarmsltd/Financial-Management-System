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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only an Executive (GMD or Super Admin) can update budgets.' }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const { status, warningThreshold, totalAmount, periodName, lines } = body;

    const existing = await prisma.budget.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    const data: any = {};
    if (status) data.status = status;
    if (warningThreshold !== undefined) data.warningThreshold = parseFloat(warningThreshold);
    if (totalAmount !== undefined) data.totalAmount = parseFloat(totalAmount);
    if (periodName) data.periodName = periodName;

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(lines) && lines.length > 0) {
        for (const incoming of lines) {
          const deptName = String(incoming.departmentName || incoming.department || 'General Operations').trim();
          const catName = String(incoming.category || incoming.line_name || 'Operating Expenses').trim();
          const newAlloc = Number(incoming.allocatedAmount ?? incoming.amount ?? 0);

          const matchedLine = existing.lines.find(
            (l) =>
              (incoming.id && l.id === incoming.id) ||
              (l.departmentName.toLowerCase() === deptName.toLowerCase() &&
                l.category.toLowerCase() === catName.toLowerCase())
          );

          if (matchedLine) {
            const minAllowed = Math.max(matchedLine.committedAmount || 0, matchedLine.spentAmount || 0);
            if (newAlloc < minAllowed) {
              throw new Error(
                `Cannot reduce allocation for "${deptName} / ${catName}" to ₦${newAlloc.toLocaleString()} below committed/spent amount (₦${minAllowed.toLocaleString()}).`
              );
            }
            await tx.budgetLine.update({
              where: { id: matchedLine.id },
              data: {
                departmentName: deptName,
                category: catName,
                allocatedAmount: newAlloc,
                expenseType: incoming.expenseType || matchedLine.expenseType,
              },
            });
          } else {
            await tx.budgetLine.create({
              data: {
                budgetId: id,
                departmentName: deptName,
                category: catName,
                allocatedAmount: newAlloc,
                committedAmount: 0,
                spentAmount: 0,
                expenseType: incoming.expenseType || 'OPEX',
                status: 'ACTIVE',
              },
            });
          }
        }
      }

      return tx.budget.update({
        where: { id },
        data,
        include: {
          organization: true,
          lines: true,
        },
      });
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
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage budgets.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only an Executive (GMD or Super Admin) can delete budgets.' }, { status: 403 });
    }
    const { id } = await params;
    await prisma.budget.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
