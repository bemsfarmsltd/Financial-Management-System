import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';
import { checkAiScopeOrResponse } from '@/lib/ai-access-control';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { clampPagination } from '@/lib/platform/read-catalog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor) {
    return NextResponse.json(
      { ok: false, error_code: 'UNAUTHORIZED', message: 'Authentication is required to view subsidiary directory.' },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const requestedOrgId =
    url.searchParams.get('subsidiary') ||
    url.searchParams.get('organization_id') ||
    url.searchParams.get('subsidiary_id') ||
    actor.scopedOrganizationId ||
    'ALL';
  const scope = await resolveAuthorizedOrganizationScope(actor as any, requestedOrgId);
  const { limit, offset } = clampPagination(
    url.searchParams.get('limit'),
    url.searchParams.get('offset'),
    50,
    25
  );

  if (scope.organizationIds.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      projection: actor.isExecutive ? 'EXECUTIVE_OPERATING_METRICS' : 'PUBLIC_DIRECTORY_METADATA',
      scope: { isGroup: scope.isGroup, organizationIds: [] },
      subsidiaries: [],
    });
  }

  const subsidiaries = await prisma.organization.findMany({
    where: {
      status: 'ACTIVE',
      id: { in: scope.organizationIds },
    },
    select: {
      id: true,
      legalName: true,
      code: true,
      type: true,
      defaultCurrency: true,
      brandColor: true,
      logoUrl: true,
      createdAt: true,
      ...(actor.isExecutive
        ? {
            budgets: {
              where: { status: 'ACTIVE' },
              select: { totalAmount: true },
              take: 1,
            },
            _count: {
              select: {
                employeeAssignments: true,
                expenditureRequests: true,
              },
            },
          }
        : {}),
      settings: {
        where: {
          key: {
            in: actor.isExecutive
              ? ['SUBSIDIARY_INDUSTRY', 'HEADQUARTERS_LOCATION', 'RC_NUMBER']
              : ['SUBSIDIARY_INDUSTRY', 'HEADQUARTERS_LOCATION'],
          },
        },
        select: { key: true, value: true },
      },
    },
    orderBy: { legalName: 'asc' },
    take: limit,
    skip: offset,
  });

  return NextResponse.json({
    ok: true,
    total: subsidiaries.length,
    projection: actor.isExecutive ? 'EXECUTIVE_OPERATING_METRICS' : 'PUBLIC_DIRECTORY_METADATA',
    scope: {
      isGroup: scope.isGroup,
      organizationIds: scope.organizationIds,
    },
    subsidiaries: subsidiaries.map((s: any) => {
      const publicMetadata = {
        id: s.id,
        name: s.legalName,
        code: s.code,
        type: s.type,
        currency: s.defaultCurrency,
        brandColor: s.brandColor || '#EA580C',
        industry: s.settings.find((st: any) => st.key === 'SUBSIDIARY_INDUSTRY')?.value || 'Operating Subsidiary',
        headquarters: s.settings.find((st: any) => st.key === 'HEADQUARTERS_LOCATION')?.value || 'Lagos, Nigeria',
        logoUrl: s.logoUrl,
        createdAt: s.createdAt,
      };

      if (!actor.isExecutive) {
        return publicMetadata;
      }

      return {
        ...publicMetadata,
        rcNumber: s.settings.find((st: any) => st.key === 'RC_NUMBER')?.value || null,
        monthlyBudget: Number(s.budgets?.[0]?.totalAmount) || 0,
        totalStaff: s._count?.employeeAssignments || 0,
        totalRequests: s._count?.expenditureRequests || 0,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Only GMD or Super Admin can create or edit subsidiaries.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const subAction = String(body.action || body.sub_action || (body.organizationId || body.subsidiaryId || body.targetCode ? 'UPDATE' : 'CREATE')).toUpperCase();
  const targetScope = subAction === 'UPDATE' || subAction === 'EDIT' ? 'subsidiary_edit' : 'subsidiary_create';
  const scopeBlocked = await checkAiScopeOrResponse(targetScope, 'write');
  if (scopeBlocked) return scopeBlocked;

  if (subAction === 'UPDATE' || subAction === 'EDIT') {
    const lookup = String(body.organizationId || body.subsidiaryId || body.targetCode || body.code || body.name || body.legalName || '').trim();
    if (!lookup) {
      return NextResponse.json(
        { ok: false, error: 'Provide organizationId, subsidiaryId, code, or name of the subsidiary to edit.' },
        { status: 400 }
      );
    }

    const existingOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: lookup },
          { code: { equals: lookup, mode: 'insensitive' } },
          { legalName: { contains: lookup, mode: 'insensitive' } },
        ],
      },
    });

    if (!existingOrg) {
      return NextResponse.json(
        { ok: false, error: `Subsidiary "${lookup}" not found.` },
        { status: 404 }
      );
    }

    const materialPayload: Record<string, any> = {
      organizationId: existingOrg.id,
      legalName: body.newLegalName || (body.legalName && body.legalName !== lookup ? body.legalName : undefined),
      code: body.newCode || (body.code && body.code.toUpperCase() !== existingOrg.code ? body.code.toUpperCase() : undefined),
      defaultCurrency: body.defaultCurrency || body.currency,
      type: body.type,
      brandColor: body.brandColor || body.color,
      industry: body.industry || body.sector,
      headquarters: body.headquarters || body.location || body.address,
      rcNumber: body.rcNumber || body.rc_number,
      monthlyBudget: body.monthlyBudget ?? body.monthly_budget,
    };

    const preview: Record<string, any> = {
      operation: 'Edit Subsidiary Information',
      subsidiary: `${existingOrg.legalName} (${existingOrg.code})`,
    };
    if (materialPayload.legalName) preview.new_legal_name = materialPayload.legalName;
    if (materialPayload.code) preview.new_code = materialPayload.code;
    if (materialPayload.defaultCurrency) preview.new_currency = materialPayload.defaultCurrency;
    if (materialPayload.brandColor) preview.new_brand_color = materialPayload.brandColor;
    if (materialPayload.industry) preview.new_industry = materialPayload.industry;
    if (materialPayload.headquarters) preview.new_headquarters = materialPayload.headquarters;
    if (materialPayload.rcNumber !== undefined) preview.new_rc_number = materialPayload.rcNumber;
    if (materialPayload.monthlyBudget !== undefined) {
      preview.new_monthly_budget = `₦${Number(materialPayload.monthlyBudget).toLocaleString()}`;
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'subsidiary_update',
      summary: `Update Subsidiary Information: ${existingOrg.legalName} (${existingOrg.code})`,
      materialPayload,
      preview,
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `Subsidiary update for "${existingOrg.legalName}" (${existingOrg.code}) has been staged. Click Confirm to apply changes.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }
  const name: string = (body.name || body.legalName || '').trim();
  let code: string = (body.code || '').trim().toUpperCase();
  const type: string = (body.type || 'OPERATING_SUBSIDIARY').trim();
  const currency: string = (body.currency || 'NGN').toUpperCase().trim();
  const brandColor: string = (body.brandColor || body.color || '').trim();
  const industry: string = (body.industry || body.sector || '').trim();
  const headquarters: string = (body.headquarters || body.location || body.address || '').trim();
  const logoUrl: string = (body.logoUrl || body.logo || '').trim();

  // Validate missing fields
  const missing: string[] = [];
  if (!name || name.length < 2) missing.push('name (Legal corporate name)');
  if (!brandColor) missing.push('brandColor (Corporate brand hex color, e.g. #EA580C, #2563EB)');
  if (!industry) missing.push('industry (Primary operational sector, e.g. Agribusiness, Media Production)');
  if (!headquarters) missing.push('headquarters (City / State / Physical headquarters address)');

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'INCOMPLETE_PARAMETERS',
        message: 'To create a subsidiary, all corporate specifications are mandatory. The AI must ask the GMD for the missing details before execution.',
        missing_fields: missing,
        required_fields: [
          { field: 'name', label: 'Legal Corporate Name', example: 'Studio Arella Ltd' },
          { field: 'brandColor', label: 'Brand Color (Hex)', example: '#EA580C' },
          { field: 'industry', label: 'Industry / Business Sector', example: 'Media & Creative Production' },
          { field: 'headquarters', label: 'Headquarters Location', example: 'Lagos, Nigeria' },
          { field: 'code', label: 'Shortcode (Optional)', example: 'SAL' },
          { field: 'type', label: 'Entity Structure', example: 'OPERATING_SUBSIDIARY' },
          { field: 'currency', label: 'Operating Currency', example: 'NGN' },
        ],
        note: 'File uploads (logos, certificates, brand assets) are excluded from AI tools and handled directly on the Web Dashboard.',
        conversational_prompt: `To create this subsidiary, please provide the following details:\n` +
          missing.map((m, i) => `${i + 1}. **${m}**`).join('\n') +
          `\n\n*(Optional: Shortcode, Entity Structure, and Operating Currency. Logo and file uploads are managed on the web dashboard).*`,
      },
      { status: 400 }
    );
  }

  // Generate code if not provided
  if (!code) {
    const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      code = words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
    } else {
      code = name.slice(0, 3).toUpperCase();
    }
    // Check if code collision
    const existing = await prisma.organization.findUnique({ where: { code } });
    if (existing) {
      code = `${code}${Math.floor(10 + Math.random() * 89)}`;
    }
  }

  const existingByCode = await prisma.organization.findUnique({ where: { code } });
  if (existingByCode) {
    return NextResponse.json(
      { ok: false, error_code: 'DUPLICATE_CODE', message: `Subsidiary code "${code}" already exists.` },
      { status: 409 }
    );
  }

  const canonicalType = ['GROUP', 'SUBSIDIARY', 'OPERATING_SUBSIDIARY', 'SPECIAL_PURPOSE_VEHICLE'].includes(type)
    ? type
    : 'SUBSIDIARY';
  const canonicalCurrency = ['NGN', 'USD', 'GBP', 'EUR'].includes(currency) ? currency : 'NGN';

  const staged = await stageAction({
    userId: actor.id,
    actionType: 'subsidiary_creation',
    summary: `Create new subsidiary "${name}" (${code}) in ${headquarters} (${industry})`,
    materialPayload: {
      name,
      code,
      type: canonicalType,
      currency: canonicalCurrency,
      brandColor,
      industry,
      headquarters,
      logoUrl: logoUrl || null,
    },
    preview: {
      name,
      code,
      type: canonicalType,
      currency: canonicalCurrency,
      brandColor,
      industry,
      headquarters,
    },
  });

  return NextResponse.json({
    ok: true,
    status: 'AWAITING_CONFIRMATION',
    requires_gmd_action: true,
    message: `Subsidiary creation for "${name}" (${code}) has been staged. Click the confirmation button to create the entity and initialize its default policies.`,
    staged_action_id: staged.staged_action_id,
    confirmation_hash: staged.confirmation_hash,
    confirmation_button: staged.confirmation_button,
    staged_action: staged.staged_action,
  });
}
