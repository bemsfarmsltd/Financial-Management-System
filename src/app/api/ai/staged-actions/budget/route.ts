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
    const { organization_id, period, currency, total_amount, allocations, note } = body;

    if (!organization_id || !period || !total_amount) {
      return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: 'organization_id, period, and total_amount are mandatory.' }, { status: 400 });
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({ where: { id: organization_id } });
    if (!org) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Organization ${organization_id} not found.` }, { status: 404 });
    }

    // Check for existing budget
    const existing = await prisma.budget.findFirst({
      where: { organizationId: organization_id, period },
    });

    const warnings: string[] = [];
    if (existing) {
      warnings.push(`An existing ${period} budget for ${org.legalName} will be superseded.`);
    }

    const materialPayload = {
      organization_id,
      period,
      currency: currency || 'NGN',
      total_amount: Number(total_amount),
      allocations: allocations || [],
      note: note || '',
    };

    const summary = `Create ${period} budget for ${org.legalName} — ₦${Number(total_amount).toLocaleString()} across ${(allocations || []).length} lines`;

    const preview = {
      organization: org.legalName,
      period,
      total_amount: `₦${Number(total_amount).toLocaleString()}`,
      currency: currency || 'NGN',
      lines_count: (allocations || []).length,
      allocations,
      supersedes_existing: !!existing,
    };

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
