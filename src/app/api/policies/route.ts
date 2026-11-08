import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view approval policies.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive access is required to view approval policies.' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const subsidiaryCode = searchParams.get('subsidiary');

    const [policies, organizations] = await Promise.all([
      prisma.approvalPolicy.findMany({
        orderBy: [{ priority: 'asc' }, { minAmountMinor: 'asc' }],
      }),
      prisma.organization.findMany({
        select: { id: true, code: true, legalName: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    const enrichedPolicies = policies.map((p) => {
      const minNgn = Number(p.minAmountMinor) / 100;
      const maxNgn = p.maxAmountMinor ? Number(p.maxAmountMinor) / 100 : null;
      const org = p.scopeSubsidiaryId ? organizations.find((o) => o.id === p.scopeSubsidiaryId) : null;

      let bandName = '';
      let slaHours = 4;
      let reviewTier = 'Standard';

      if (p.category === 'EMERGENCY') {
        bandName = 'Emergency Facility Override';
        slaHours = 0; // Instant
        reviewTier = 'Strict Audit';
      } else if (p.requiredRole === 'GMD') {
        bandName = 'Tier 3: GMD Mandatory Escalation';
        slaHours = 12;
        reviewTier = 'Executive Sign-Off';
      } else {
        bandName = 'Super Admin Review';
        slaHours = null as any;
        reviewTier = 'Executive Sign-Off';
      }

      let rangeLabel = '';
      if (p.category === 'EMERGENCY') {
        rangeLabel = `Pre-authorized up to ₦${(maxNgn || 1000000).toLocaleString()}`;
      } else if (maxNgn === null) {
        rangeLabel = `₦${(minNgn + (minNgn > 0 ? 0 : 0)).toLocaleString()} and above`;
      } else if (minNgn === 0) {
        rangeLabel = `Up to ₦${maxNgn.toLocaleString()}`;
      } else {
        rangeLabel = `₦${minNgn.toLocaleString()} — ₦${maxNgn.toLocaleString()}`;
      }

      return {
        id: p.id,
        bandCode: `BAND-0${p.priority}`,
        bandName,
        priority: p.priority,
        category: p.category || 'GENERAL_OPEX',
        minAmount: minNgn,
        maxAmount: maxNgn,
        rangeLabel,
        requiredRole: p.requiredRole,
        approverTitle: p.requiredRole === 'GMD' ? 'Group Managing Director (GMD)' : ['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(p.requiredRole) ? 'Super Admin' : 'Invalid legacy policy — update required',
        minSignatures: null,
        slaHours: null,
        slaWindow: 'Not configured',
        reviewTier,
        scope: org ? org.legalName : 'Global Group Policy (All Subsidiaries)',
        scopeCode: org ? org.code : 'GLOBAL',
        scopeSubsidiaryId: p.scopeSubsidiaryId,
        active: p.active,
      };
    });

    // Filter if subsidiary query provided
    const filtered =
      subsidiaryCode && subsidiaryCode !== 'ALL'
        ? enrichedPolicies.filter((p) => p.scopeCode === 'GLOBAL' || p.scopeCode === subsidiaryCode)
        : enrichedPolicies;

    return NextResponse.json({
      summary: {
        totalRules: enrichedPolicies.length,
        globalRulesCount: enrichedPolicies.filter((p) => p.scopeCode === 'GLOBAL').length,
        subsidiaryOverridesCount: enrichedPolicies.filter((p) => p.scopeCode !== 'GLOBAL').length,
        tier1LimitFormatted: 'See policy bands',
        tier2LimitFormatted: 'See policy bands',
        emergencyCapFormatted: 'See emergency policy',
      },
      organizations,
      policies: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching policies:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch policies' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage policies.' }, { status: 401 });
    const body = await request.json();
    const saved = await executeDashboardCommand(actor, 'policy_update', { ...body, sub_action: 'UPDATE_APPROVAL_POLICY' });
    return NextResponse.json({ success: true, policyId: saved.id, policy: saved });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage policies.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const id = new URL(request.url).searchParams.get('id') || body.id;
    const policy = await executeDashboardCommand(actor, 'policy_update', { sub_action: 'DELETE_POLICY', id });
    return NextResponse.json({ success: true, policy });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
