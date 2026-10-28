import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to update a subsidiary.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only the GMD or System Admin can update a subsidiary profile.' }, { status: 403 });
    }

    const { organizationId } = await params;
    const current = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        departments: { select: { id: true, name: true, code: true } },
        employeeAssignments: { select: { id: true } },
        budgets: { where: { status: 'ACTIVE' }, select: { id: true, totalAmount: true } },
        settings: { where: { key: { in: ['SUBSIDIARY_INDUSTRY', 'HEADQUARTERS_LOCATION', 'RC_NUMBER'] } } },
      },
    });

    if (!current) return NextResponse.json({ error: 'Subsidiary entity not found.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const legalName = typeof body.legalName === 'string' && body.legalName.trim() ? body.legalName.trim() : current.legalName;
    const code = typeof body.code === 'string' && body.code.trim() ? body.code.trim().toUpperCase() : current.code;
    const defaultCurrency = typeof body.defaultCurrency === 'string' && ['NGN', 'USD', 'GBP', 'EUR'].includes(body.defaultCurrency) 
      ? body.defaultCurrency 
      : current.defaultCurrency;
    const type = typeof body.type === 'string' ? body.type : current.type;
    const industry = typeof body.industry === 'string' ? body.industry.trim() : undefined;
    const headquarters = typeof body.headquarters === 'string' ? body.headquarters.trim() : undefined;
    const rcNumber = typeof body.rcNumber === 'string' ? body.rcNumber.trim() : undefined;
    const monthlyBudget = typeof body.monthlyBudget === 'number' 
      ? body.monthlyBudget 
      : typeof body.initialBudget === 'number' 
      ? body.initialBudget 
      : Number(body.monthlyBudget || body.initialBudget) || undefined;

    // Check code uniqueness if code changed
    if (code !== current.code) {
      const existing = await prisma.organization.findUnique({ where: { code } });
      if (existing && existing.id !== organizationId) {
        return NextResponse.json({ error: `Entity code "${code}" is already in use by another subsidiary.` }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update organization core fields
      const org = await tx.organization.update({
        where: { id: organizationId },
        data: {
          legalName,
          code,
          defaultCurrency,
          type,
        },
      });

      // 2. Upsert WorkspaceSettings
      if (industry !== undefined) {
        await tx.workspaceSetting.upsert({
          where: { organizationId_key: { organizationId, key: 'SUBSIDIARY_INDUSTRY' } },
          create: { organizationId, key: 'SUBSIDIARY_INDUSTRY', value: industry, updatedById: actor.id },
          update: { value: industry, updatedById: actor.id },
        });
      }
      if (headquarters !== undefined) {
        await tx.workspaceSetting.upsert({
          where: { organizationId_key: { organizationId, key: 'HEADQUARTERS_LOCATION' } },
          create: { organizationId, key: 'HEADQUARTERS_LOCATION', value: headquarters, updatedById: actor.id },
          update: { value: headquarters, updatedById: actor.id },
        });
      }
      if (rcNumber !== undefined) {
        await tx.workspaceSetting.upsert({
          where: { organizationId_key: { organizationId, key: 'RC_NUMBER' } },
          create: { organizationId, key: 'RC_NUMBER', value: rcNumber, updatedById: actor.id },
          update: { value: rcNumber, updatedById: actor.id },
        });
      }

      // 3. Update or create Active Budget if provided
      if (monthlyBudget !== undefined && monthlyBudget >= 0) {
        const activeBudget = current.budgets[0];
        if (activeBudget) {
          await tx.budget.update({
            where: { id: activeBudget.id },
            data: { totalAmount: monthlyBudget },
          });
        } else {
          const now = new Date();
          const fiscalYear = now.getFullYear();
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          await tx.budget.create({
            data: {
              organizationId,
              fiscalYear,
              fiscalPeriod: 'MONTHLY',
              periodName: `${monthNames[now.getMonth()]} ${fiscalYear}`,
              totalAmount: monthlyBudget,
              committedAmount: 0,
              spentAmount: 0,
              status: 'ACTIVE',
              warningThreshold: 80.0,
            },
          });
        }
      }

      // 4. Create Audit Event
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: current.parentGroupId || current.id,
          subsidiaryId: current.id,
          targetType: 'POLICY',
          targetId: current.id,
          action: 'ORGANIZATION_PROFILE_UPDATED',
          correlationId: `CORR-ORG-${randomUUID()}`,
          metadata: JSON.stringify({
            before: {
              legalName: current.legalName,
              code: current.code,
              defaultCurrency: current.defaultCurrency,
            },
            after: {
              legalName,
              code,
              defaultCurrency,
              industry,
              headquarters,
              rcNumber,
              monthlyBudget,
            },
          }),
        },
      });

      return org;
    });

    const effectiveBudget = monthlyBudget !== undefined ? monthlyBudget : (Number(current.budgets[0]?.totalAmount) || 0);

    return NextResponse.json({
      organization: {
        id: updated.id,
        name: updated.legalName,
        code: updated.code,
        type: updated.type,
        status: updated.status === 'ACTIVE' ? 'Live' : 'Setup',
        industry: industry || current.settings.find(s => s.key === 'SUBSIDIARY_INDUSTRY')?.value || 'Operating Subsidiary',
        headquarters: headquarters || current.settings.find(s => s.key === 'HEADQUARTERS_LOCATION')?.value || 'Lagos, Nigeria',
        rcNumber: rcNumber !== undefined ? rcNumber : current.settings.find(s => s.key === 'RC_NUMBER')?.value || null,
        initials: updated.code.replace(/^BEMS-?/, '').slice(0, 2) || updated.legalName.slice(0, 2).toUpperCase(),
        color: updated.type === 'GROUP' ? '#ea580c' : '#0d8a70',
        readiness: 100,
        departmentCount: current.departments.length,
        staffCount: current.employeeAssignments.length,
        budget: effectiveBudget,
        budgetFormatted: effectiveBudget > 0 ? `₦${(effectiveBudget / 1000000).toFixed(0)}M` : '₦0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update subsidiary' }, { status: 500 });
  }
}
