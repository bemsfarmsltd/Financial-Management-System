import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to view approval policies.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive access is required to view approval policies.' }, { status: 403 });
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
      } else if (p.requiredRole === 'COO') {
        bandName = 'Tier 2: Executive COO / Finance';
        slaHours = 6;
        reviewTier = 'Verified Endorsement';
      } else {
        bandName = 'Tier 1: Department Autonomous';
        slaHours = 4;
        reviewTier = 'Operational';
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
        approverTitle:
          p.requiredRole === 'GMD'
            ? 'Group Managing Director (GMD)'
            : p.requiredRole === 'COO'
            ? 'Chief Operating Officer / Finance Lead'
            : 'Head of Department (HOD)',
        minSignatures: p.requiredRole === 'GMD' ? 3 : p.requiredRole === 'COO' ? 2 : 1,
        slaHours,
        slaWindow: slaHours === 0 ? 'Instant' : `${slaHours} Hours`,
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
        tier1LimitFormatted: '₦500,000',
        tier2LimitFormatted: '₦2,000,000',
        emergencyCapFormatted: '₦1,000,000',
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
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to manage approval policies.' }, { status: 401 });
    if (actor.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Only the System Admin can change approval policies.' }, { status: 403 });
    const body = await request.json();
    const { id, scopeSubsidiaryId, category, minAmount, maxAmount, requiredRole, priority, active } = body;

    const minAmountMinor = BigInt(Math.round((Number(minAmount) || 0) * 100));
    const maxAmountMinor = maxAmount !== null && maxAmount !== undefined ? BigInt(Math.round(Number(maxAmount) * 100)) : null;

    let saved;
    if (id) {
      saved = await prisma.approvalPolicy.update({
        where: { id },
        data: {
          scopeSubsidiaryId: scopeSubsidiaryId || null,
          category: category || null,
          minAmountMinor,
          maxAmountMinor,
          requiredRole: requiredRole || 'HEAD_OF_ADMIN',
          priority: Number(priority) || 1,
          active: active !== undefined ? active : true,
        },
      });
    } else {
      saved = await prisma.approvalPolicy.create({
        data: {
          scopeSubsidiaryId: scopeSubsidiaryId || null,
          category: category || null,
          minAmountMinor,
          maxAmountMinor,
          requiredRole: requiredRole || 'HEAD_OF_ADMIN',
          priority: Number(priority) || 1,
          active: true,
        },
      });
    }

    return NextResponse.json({ success: true, policyId: saved.id });
  } catch (error: any) {
    console.error('Error saving policy:', error);
    return NextResponse.json({ error: error.message || 'Failed to save policy' }, { status: 500 });
  }
}
