import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  const subsidiaries = await prisma.organization.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      legalName: true,
      code: true,
      type: true,
      defaultCurrency: true,
      brandColor: true,
      createdAt: true,
      _count: {
        select: {
          employeeAssignments: true,
          expenditureRequests: true,
        },
      },
    },
    orderBy: { legalName: 'asc' },
  });

  return NextResponse.json({
    ok: true,
    total: subsidiaries.length,
    subsidiaries: subsidiaries.map((s) => ({
      id: s.id,
      name: s.legalName,
      code: s.code,
      type: s.type,
      currency: s.defaultCurrency,
      brandColor: s.brandColor || '#EA580C',
      totalStaff: s._count.employeeAssignments,
      totalRequests: s._count.expenditureRequests,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Only GMD or Super Admin can create subsidiaries.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
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
          { field: 'logoUrl', label: 'Logo URL (Optional)', example: 'https://.../logo.png' },
        ],
        conversational_prompt: `To create this subsidiary, please provide the following details:\n` +
          missing.map((m, i) => `${i + 1}. **${m}**`).join('\n') +
          `\n\n*(Optional: Shortcode, Entity Structure, and Logo URL).*`,
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

  try {
    const org = await prisma.organization.create({
      data: {
        legalName: name,
        code,
        type: ['GROUP', 'SUBSIDIARY', 'OPERATING_SUBSIDIARY', 'SPECIAL_PURPOSE_VEHICLE'].includes(type)
          ? type
          : 'SUBSIDIARY',
        status: 'ACTIVE',
        defaultCurrency: ['NGN', 'USD', 'GBP', 'EUR'].includes(currency) ? currency : 'NGN',
        timezone: 'Africa/Lagos',
        brandColor,
        logoUrl: logoUrl || null,
      },
    });

    // Provision default attendance policy for this subsidiary (8:00 AM, 15m grace, 5% deduction)
    try {
      await prisma.attendancePolicy.create({
        data: {
          organizationId: org.id,
          earliestCheckInTime: '07:00',
          resumptionTime: '08:00',
          closingTime: '17:00',
          gracePeriodMinutes: 15,
          latenessDeductionPercent: 5.0,
          absenceDeductionPercent: 100.0,
          requireGeofence: true,
          requireQrScan: true,
          requireStarlinkIp: true,
          starlinkIpAddresses: '2605:59c1:1a3a:a210:*, 98.97.76.109, 98.97.76.*, 98.97.*',
          starlinkPowerOutageMode: false,
        },
      });
    } catch (e) {
      console.warn('Could not provision default attendance policy for subsidiary:', e);
    }

    // Persist workspace metadata settings
    if (industry) {
      try {
        await prisma.workspaceSetting.create({
          data: { organizationId: org.id, key: 'SUBSIDIARY_INDUSTRY', value: industry, updatedById: actor.id },
        });
      } catch {}
    }
    if (headquarters) {
      try {
        await prisma.workspaceSetting.create({
          data: { organizationId: org.id, key: 'HEADQUARTERS_LOCATION', value: headquarters, updatedById: actor.id },
        });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      message: `Subsidiary "${org.legalName}" (${org.code}) created successfully.`,
      subsidiary: {
        id: org.id,
        name: org.legalName,
        code: org.code,
        type: org.type,
        currency: org.defaultCurrency,
        brandColor: org.brandColor,
        createdAt: org.createdAt,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        { ok: false, error_code: 'DUPLICATE_CODE', message: `Subsidiary code "${code}" already exists.` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error_code: 'INTERNAL_ERROR', message: err.message },
      { status: 500 }
    );
  }
}
