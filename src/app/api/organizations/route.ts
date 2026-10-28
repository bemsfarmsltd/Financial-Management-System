import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export async function GET() {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to view subsidiaries.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'HR', 'FINANCE'])) return NextResponse.json({ error: 'Executive or finance access is required.' }, { status: 403 });
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json({
      organizations: orgs.map(o => ({
        id: o.id,
        name: o.legalName,
        code: o.code,
        type: o.type,
        status: o.status === 'ACTIVE' ? 'Live' : 'Setup',
        industry: 'Subsidiary Entity',
        initials: o.code.replace(/^BEMS-?/, '').slice(0, 2) || o.legalName.slice(0, 2).toUpperCase(),
        color: '#0d8a70',
        readiness: 100,
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to manage subsidiaries.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the System Admin or GMD can create subsidiaries.' }, { status: 403 });
    const body = await req.json();
    const {
      name,
      industry,
      code,
      color,
      rcNumber,
      headquarters,
      leadName,
      leadEmail,
      initialBudget,
      departments,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Subsidiary legal name is required' }, { status: 400 });
    }

    const words = name.trim().split(/\s+/);
    const generatedCode = code && code.trim() 
      ? code.trim().toUpperCase() 
      : ('BS-' + words.map((w: string) => w[0]).join('').toUpperCase().slice(0, 4));

    // 1. Create Organization in Prisma
    const newOrg = await prisma.organization.create({
      data: {
        legalName: name.trim(),
        code: generatedCode,
        type: body.type && ['OPERATING_SUBSIDIARY', 'AGRICULTURAL_HUB', 'SPECIAL_PURPOSE_VEHICLE', 'REGIONAL_OFFICE', 'GROUP', 'SUBSIDIARY'].includes(body.type) ? body.type : 'SUBSIDIARY',
        status: 'ACTIVE',
        defaultCurrency: body.currency && ['NGN', 'USD', 'GBP', 'EUR'].includes(body.currency) ? body.currency : 'NGN',
        timezone: 'Africa/Lagos',
      },
    });

    // 2. Create Initial Departments if provided
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

    // 3. Create Initial Active Budget if amount provided
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
          initials: newOrg.code.replace('BEMS-', '').slice(0, 2) || 'BS',
          color: color || '#ea580c',
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
