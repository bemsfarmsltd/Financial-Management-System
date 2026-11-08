import { assertGroupIdentityUpdate } from '@/lib/organization-identity';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view subsidiaries.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive access is required.' }, { status: 403 });
    // Ensure BEMS Group always exists in the database as the master holding entity
    const existingGroup = await prisma.organization.findFirst({
      where: { code: 'BEMS-GROUP' },
    });
    if (!existingGroup) {
      await prisma.organization.create({
        data: {
          code: 'BEMS-GROUP',
          legalName: 'BEMS Group',
          type: 'GROUP',
          defaultCurrency: 'NGN',
          timezone: 'Africa/Lagos',
          status: 'ACTIVE',
          brandColor: '#ea580c',
          logoUrl: '/bems-group-logo.png?v=20261024',
        },
      });
    }

    const orgs = await prisma.organization.findMany({
      orderBy: [
        { type: 'asc' }, // GROUP first, then SUBSIDIARY
        { createdAt: 'asc' },
      ],
      include: {
        departments: { select: { id: true, name: true, code: true } },
        employeeAssignments: { select: { id: true } },
        budgets: { where: { status: 'ACTIVE' }, select: { totalAmount: true } },
        settings: { where: { key: { in: ['SUBSIDIARY_INDUSTRY', 'HEADQUARTERS_LOCATION', 'RC_NUMBER', 'BRAND_COLOR', 'BRAND_LOGO_URL'] } } },
      },
    });

    // Ensure GROUP is explicitly first in array
    const sortedOrgs = [...orgs].sort((a, b) => {
      if (a.type === 'GROUP' && b.type !== 'GROUP') return -1;
      if (b.type === 'GROUP' && a.type !== 'GROUP') return 1;
      return 0;
    });

    return NextResponse.json({
      organizations: sortedOrgs.map(o => {
        const totalBudget = o.budgets.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
        const industrySetting = o.settings.find(s => s.key === 'SUBSIDIARY_INDUSTRY');
        const hqSetting = o.settings.find(s => s.key === 'HEADQUARTERS_LOCATION');
        const rcSetting = o.settings.find(s => s.key === 'RC_NUMBER');
        const brandColorSetting = o.settings.find(s => s.key === 'BRAND_COLOR');
        const logoUrlSetting = o.settings.find(s => s.key === 'BRAND_LOGO_URL');

        const DEFAULT_LOGOS: Record<string, string> = {
          'BEMS-GROUP': '/bems-group-logo.png?v=20261024',
          'BBH': '/logos/bbh.svg',
          'BTECH': '/logos/smartairs.svg',
          'BSA': '/logos/studio-arella.svg',
          'BEDU': '/logos/bedu.svg',
          'BAGRO': '/logos/bems-farms.svg',
        };

        const resolvedIndustry = industrySetting?.value || (
          o.type === 'GROUP' 
            ? 'Group & Subsidiaries'
            : o.type === 'TECH_IP_ENTITY' 
            ? 'Technology & Digital Platforms'
            : o.type === 'AGRICULTURAL_HUB' 
            ? 'Agro-Allied & Food Processing' 
            : 'Operating Commercial Subsidiary'
        );

        const resolvedColor = o.brandColor || brandColorSetting?.value || (o.type === 'GROUP' ? '#ea580c' : '#0d8a70');
        const resolvedLogo = o.logoUrl || logoUrlSetting?.value || DEFAULT_LOGOS[o.code] || (o.type === 'GROUP' ? '/bems-group-logo.png?v=20261024' : null);

        return {
          id: o.id,
          name: o.legalName,
          code: o.code,
          type: o.type,
          status: o.status === 'ACTIVE' ? 'Live' : 'Setup',
          industry: resolvedIndustry,
          headquarters: hqSetting?.value || 'Lagos, Nigeria',
          rcNumber: rcSetting?.value || null,
          initials: o.code.replace(/^BEMS-?/, '').slice(0, 2) || o.legalName.slice(0, 2).toUpperCase(),
          color: resolvedColor,
          brandColor: resolvedColor,
          logoUrl: resolvedLogo,
          readiness: 100,
          departmentCount: o.departments.length,
          staffCount: o.employeeAssignments.length,
          budgetFormatted: totalBudget > 0 ? `₦${(totalBudget / 1000000).toFixed(0)}M` : '₦0',
          budget: totalBudget,
        };
      })
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage subsidiaries.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the Super Admin or GMD can create subsidiaries.' }, { status: 403 });
    const body = await req.json();
    const {
      name,
      industry,
      code,
      color,
      brandColor,
      logoUrl,
      rcNumber,
      headquarters,
      leadName,
      leadEmail,
      initialBudget,
      departments,
    } = body;

    const resolvedColor = brandColor || color || '#0d8a70';

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Subsidiary legal name is required' }, { status: 400 });
    }

    const words = name.trim().split(/\s+/);
    const generatedCode = code && code.trim() 
      ? code.trim().toUpperCase() 
      : ('BS-' + words.map((w: string) => w[0]).join('').toUpperCase().slice(0, 4));

    const validTypes = [
      'OPERATING_SUBSIDIARY',
      'TECH_IP_ENTITY',
      'SPECIAL_PURPOSE_VEHICLE',
      'INFRASTRUCTURE_SITE',
      'REGIONAL_OFFICE',
      'AGRICULTURAL_HUB',
      'GROUP',
      'SUBSIDIARY'
    ];

    if (body.type === 'GROUP' || generatedCode === 'BEMS-GROUP') return NextResponse.json({ error: 'BEMS Group already exists. Create a subsidiary under BEMS Group.' }, { status: 400 });
    try { assertGroupIdentityUpdate({ code: 'NEW_SUBSIDIARY' }, { legalName: name.trim(), code: generatedCode, type: body.type }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid subsidiary identity.' }, { status: 400 }); }
    const parentGroup = await prisma.organization.findUnique({ where: { code: 'BEMS-GROUP' } });
    if (!parentGroup || parentGroup.type !== 'GROUP') return NextResponse.json({ error: 'BEMS Group must be configured before adding subsidiaries.' }, { status: 409 });

    // 1. Create Organization in Prisma
    const newOrg = await prisma.organization.create({
      data: {
        parentGroupId: parentGroup.id,
        legalName: name.trim(),
        code: generatedCode,
        type: body.type && validTypes.includes(body.type) ? body.type : 'SUBSIDIARY',
        status: 'ACTIVE',
        defaultCurrency: body.currency && ['NGN', 'USD', 'GBP', 'EUR'].includes(body.currency) ? body.currency : 'NGN',
        timezone: 'Africa/Lagos',
        brandColor: resolvedColor,
        logoUrl: logoUrl || null,
      },
    });

    // 2. Persist metadata in WorkspaceSetting
    if (resolvedColor) {
      try {
        await prisma.workspaceSetting.create({
          data: { organizationId: newOrg.id, key: 'BRAND_COLOR', value: resolvedColor, updatedById: actor.id },
        });
      } catch {}
    }
    if (logoUrl) {
      try {
        await prisma.workspaceSetting.create({
          data: { organizationId: newOrg.id, key: 'BRAND_LOGO_URL', value: logoUrl, updatedById: actor.id },
        });
      } catch {}
    }
    if (industry) {
      try {
        await prisma.workspaceSetting.create({
          data: { organizationId: newOrg.id, key: 'SUBSIDIARY_INDUSTRY', value: industry, updatedById: actor.id },
        });
      } catch {}
    }
    if (headquarters) {
      try {
        await prisma.workspaceSetting.create({
          data: { organizationId: newOrg.id, key: 'HEADQUARTERS_LOCATION', value: headquarters, updatedById: actor.id },
        });
      } catch {}
    }
    if (rcNumber) {
      try {
        await prisma.workspaceSetting.create({
          data: { organizationId: newOrg.id, key: 'RC_NUMBER', value: rcNumber, updatedById: actor.id },
        });
      } catch {}
    }

    // 3. Create Initial Departments if provided
    const createdDepts: { id: string; name: string; code: string }[] = [];
    if (Array.isArray(departments) && departments.length > 0) {
      for (const dName of departments) {
        if (!dName || !dName.trim()) continue;
        const dCode = dName.trim().slice(0, 4).toUpperCase();
        try {
          const dept = await prisma.department.create({
            data: {
              organizationId: newOrg.id,
              name: dName.trim(),
              code: `${generatedCode}-${dCode}`,
            },
          });
          createdDepts.push({ id: dept.id, name: dept.name, code: dept.code });
        } catch {
          // ignore duplicate dept code if any
        }
      }
    } else {
      // Default initial departments
      const defaultNames = ['General Operations', 'Finance & Administration'];
      for (const dName of defaultNames) {
        const dCode = dName.slice(0, 4).toUpperCase();
        try {
          const dept = await prisma.department.create({
            data: {
              organizationId: newOrg.id,
              name: dName,
              code: `${generatedCode}-${dCode}`,
            },
          });
          createdDepts.push({ id: dept.id, name: dept.name, code: dept.code });
        } catch {}
      }
    }

    // 4. Create Initial Active Budget if amount provided
    const budgetAmount = Number(initialBudget) || 0;
    if (budgetAmount > 0) {
      const now = new Date();
      const fiscalYear = now.getFullYear();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const periodName = `${monthNames[now.getMonth()]} ${fiscalYear}`;
      try {
        await prisma.budget.create({
          data: {
            organizationId: newOrg.id,
            fiscalYear,
            fiscalPeriod: 'MONTHLY',
            periodName,
            totalAmount: budgetAmount,
            committedAmount: 0,
            spentAmount: 0,
            status: 'ACTIVE',
            warningThreshold: 80.0,
          },
        });
      } catch {}
    }

    return NextResponse.json(
      {
        organization: {
          id: newOrg.id,
          name: newOrg.legalName,
          code: newOrg.code,
          type: newOrg.type,
          status: 'Live',
          industry: industry || 'Enterprise Technology',
          initials: newOrg.code.replace(/^BEMS-?/, '').slice(0, 2) || 'BS',
          color: resolvedColor,
          brandColor: resolvedColor,
          logoUrl: logoUrl || null,
          rcNumber: rcNumber || `RC-${Math.floor(1000000 + Math.random() * 9000000)}`,
          headquarters: headquarters || 'Lagos, Nigeria',
          leadName: leadName || 'Managing Director',
          leadEmail: leadEmail || `executive@${generatedCode.toLowerCase()}.bemsgroup.com`,
          budget: budgetAmount,
          spent: 0,
          approvedUnpaid: 0,
          moneyLeft: budgetAmount,
          departments: createdDepts,
          readiness: 100,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create subsidiary' }, { status: 500 });
  }
}
