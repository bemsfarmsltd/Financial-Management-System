import { hasGmdFeatureAccess } from '@/lib/gmd-access';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (actor && !hasGmdFeatureAccess(actor.role)) return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access requires GMD or an authorized Super Admin.'},{status:403});
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only the GMD or System Admin can stage budget allocations.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const organization_id = body.business_id || body.organization_id;
    const period = body.fiscal_period || body.period || '2026-Q4';
    const currency = body.currency || 'NGN';
    const note = body.justification || body.note || '';

    // Mode A: Adjustment against existing department
    const isAdjustment = body.adjustment_amount !== undefined;
    const adjustment_amount = isAdjustment ? Number(body.adjustment_amount) : 0;
    const action = body.action || 'INCREASE';
    const department = body.department || 'General Operations';

    // Mode B: Full budget creation with allocations
    const total_amount = body.total_amount ? Number(body.total_amount) : adjustment_amount;
    const allocations = body.allocations || [{ department, amount: adjustment_amount }];

    if (!organization_id) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'business_id (or organization_id) is mandatory.' }, { status: 400 });
    }

    if (!isAdjustment && !body.total_amount) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'Either adjustment_amount or total_amount is mandatory.' }, { status: 400 });
    }

    // Verify organization exists by exact id, code, or unambiguous legalName
    const orgMatches = await prisma.organization.findMany({
      where: {
        OR: [
          { id: String(organization_id) },
          { code: { equals: String(organization_id), mode: 'insensitive' } },
          { legalName: { equals: String(organization_id), mode: 'insensitive' } },
        ],
      },
    });
    const org =
      orgMatches[0] ||
      (await (async () => {
        const partial = await prisma.organization.findMany({
          where: { legalName: { contains: String(organization_id), mode: 'insensitive' } },
        });
        return partial.length === 1 ? partial[0] : null;
      })());

    if (!org) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'NOT_FOUND',
          message: `Target organization "${organization_id}" was not found or is ambiguous. Specify an exact subsidiary ID or code.`,
        },
        { status: 404 }
      );
    }

    const orgDisplayName = org.legalName;
    const rawMode = String(body.mode || (isAdjustment ? 'reallocate' : 'create')).toLowerCase();
    const mode: 'create' | 'update' | 'reallocate' | 'archive' =
      rawMode === 'archive' || rawMode === 'delete'
        ? 'archive'
        : rawMode === 'update'
        ? 'update'
        : rawMode === 'reallocate' || isAdjustment
        ? 'reallocate'
        : 'create';

    let existingBudget = body.budget_id
      ? await prisma.budget.findUnique({ where: { id: String(body.budget_id) }, include: { lines: true } })
      : await prisma.budget.findFirst({
          where: {
            organizationId: org.id,
            periodName: { equals: String(period), mode: 'insensitive' },
            status: 'ACTIVE',
          },
          include: { lines: true },
        });

    if (mode !== 'create' && !existingBudget) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'BUDGET_NOT_FOUND',
          message: `No active budget found for ${orgDisplayName} in period "${period}" to ${mode}.`,
        },
        { status: 404 }
      );
    }
    if (mode === 'create' && existingBudget) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'BUDGET_ALREADY_EXISTS',
          message: `An active budget already exists for ${orgDisplayName} in period "${period}" (ID: ${existingBudget.id}). Use mode="update" or "reallocate".`,
        },
        { status: 409 }
      );
    }

    const resolvedAllocations = isAdjustment && existingBudget
      ? (() => {
          const currentLines = existingBudget.lines.map((l) => ({
            id: l.id,
            department: l.departmentName,
            category: l.category,
            amount: l.allocatedAmount,
            expenseType: l.expenseType,
          }));
          const delta = action === 'DECREASE' ? -Math.abs(adjustment_amount) : Math.abs(adjustment_amount);
          const idx = currentLines.findIndex(
            (l) => l.department.toLowerCase() === department.toLowerCase() || l.category.toLowerCase() === department.toLowerCase()
          );
          if (idx >= 0) {
            currentLines[idx].amount = Math.max(0, currentLines[idx].amount + delta);
          } else {
            currentLines.push({
              id: '',
              department,
              category: department,
              amount: Math.max(0, delta),
              expenseType: 'OPEX',
            });
          }
          return currentLines;
        })()
      : allocations;

    const resolvedTotal = isAdjustment && existingBudget
      ? resolvedAllocations.reduce((s: number, l: any) => s + Number(l.amount || l.allocatedAmount || 0), 0)
      : total_amount;

    if (mode !== 'archive' && resolvedTotal > 0) {
      const [pool] = await prisma.$queryRaw<Array<{ availableMinor: bigint }>>`SELECT "availableMinor" FROM "WalletFundingPool" WHERE "id" = 'MONNIFY_NGN'`;
      if (pool && pool.availableMinor > BigInt(0)) {
        const maxAllowed = Number(pool.availableMinor) / 100;
        if (resolvedTotal > maxAllowed) {
          return NextResponse.json(
            {
              ok: false,
              error_code: 'BUDGET_EXCEEDS_MONNIFY_BALANCE',
              message: `Subsidiary budget (₦${resolvedTotal.toLocaleString()}) cannot exceed the available Monnify balance (₦${maxAllowed.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
            },
            { status: 400 }
          );
        }
      }
    }

    const materialPayload = {
      mode,
      budget_id: existingBudget?.id || null,
      organization_id: org.id,
      period: existingBudget?.periodName || period,
      currency,
      total_amount: resolvedTotal,
      allocations: resolvedAllocations,
      note,
      ...(existingBudget ? { expected_updated_at: existingBudget.updatedAt.toISOString() } : {}),
    };

    const summary = isAdjustment
      ? `Budget ${action}: ${action === 'INCREASE' ? '+' : '-'}₦${adjustment_amount.toLocaleString()} for ${orgDisplayName} (${department}) — ${period}`
      : `${mode === 'create' ? 'Create' : 'Update'} ${period} budget for ${orgDisplayName} — ₦${resolvedTotal.toLocaleString()} across ${resolvedAllocations.length} allocation lines`;

    const preview = {
      organization: orgDisplayName,
      budget_id: existingBudget?.id || 'NEW',
      mode,
      period: existingBudget?.periodName || period,
      total_amount: `₦${resolvedTotal.toLocaleString()}`,
      currency,
      lines_count: resolvedAllocations.length,
      allocations: resolvedAllocations,
      justification: note,
    };

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'budget',
      targetSubsidiaryId: org.id,
      materialPayload,
      summary,
      preview,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
