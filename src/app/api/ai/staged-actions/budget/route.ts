import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
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

    // Verify organization exists by id or code
    const org = await prisma.organization.findFirst({
      where: {
        OR: [{ id: organization_id }, { code: organization_id }, { legalName: organization_id }],
      },
    });

    const orgDisplayName = org ? org.legalName : organization_id;

    const materialPayload = isAdjustment
      ? {
          business_id: org ? org.id : organization_id,
          department,
          fiscal_period: period,
          adjustment_amount,
          action,
          justification: note,
        }
      : {
          organization_id: org ? org.id : organization_id,
          period,
          currency,
          total_amount,
          allocations,
          note,
        };

    const summary = isAdjustment
      ? `Budget ${action}: ${action === 'INCREASE' ? '+' : '-'}₦${adjustment_amount.toLocaleString()} for ${orgDisplayName} (${department}) — ${period}`
      : `Create ${period} budget for ${orgDisplayName} — ₦${total_amount.toLocaleString()} across ${allocations.length} allocation lines`;

    const preview = isAdjustment
      ? {
          organization: orgDisplayName,
          department,
          fiscal_period: period,
          action,
          adjustment_amount: `₦${adjustment_amount.toLocaleString()}`,
          justification: note,
        }
      : {
          organization: orgDisplayName,
          period,
          total_amount: `₦${total_amount.toLocaleString()}`,
          currency,
          lines_count: allocations.length,
          allocations,
        };

    const warnings: string[] = [];
    if (!org) {
      warnings.push(`Target business entity '${organization_id}' will be referenced as a new business unit.`);
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'budget',
      materialPayload,
      summary,
      preview,
      warnings,
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
