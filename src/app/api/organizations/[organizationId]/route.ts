import { assertGroupIdentityUpdate } from '@/lib/organization-identity';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to update a subsidiary.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only the GMD or Super Admin can update a subsidiary profile.' }, { status: 403 });
    }

    const { organizationId } = await params;
    const current = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        departments: { select: { id: true, name: true, code: true } },
        employeeAssignments: { where: { status: 'ACTIVE' }, select: { id: true, employeeId: true, isPrimary: true } },
        budgets: { where: { status: 'ACTIVE' }, select: { id: true, totalAmount: true } },
        settings: true,
      },
    });

    if (!current) return NextResponse.json({ error: 'Subsidiary entity not found.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const rawName = typeof body.legalName === 'string' && body.legalName.trim() ? body.legalName.trim() : typeof body.name === 'string' && body.name.trim() ? body.name.trim() : '';
    const legalName = rawName || current.legalName;
    const code = typeof body.code === 'string' && body.code.trim() ? body.code.trim().toUpperCase() : current.code;
    const defaultCurrency = typeof body.defaultCurrency === 'string' && ['NGN', 'USD', 'GBP', 'EUR'].includes(body.defaultCurrency) 
      ? body.defaultCurrency 
      : current.defaultCurrency;
    const type = typeof body.type === 'string' ? body.type : current.type;
    const industry = typeof body.industry === 'string' ? body.industry.trim() : undefined;
    const headquarters = typeof body.headquarters === 'string' ? body.headquarters.trim() : undefined;
    const rcNumber = typeof body.rcNumber === 'string' ? body.rcNumber.trim() : undefined;
    const tinNumber = typeof body.tinNumber === 'string' ? body.tinNumber.trim() : undefined;
    const incorporationDate = typeof body.incorporationDate === 'string' ? body.incorporationDate.trim() : undefined;
    const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : undefined;
    const description = typeof body.description === 'string' ? body.description.trim() : undefined;
    const leadName = typeof body.leadName === 'string' ? body.leadName.trim() : undefined;
    const leadTitle = typeof body.leadTitle === 'string' ? body.leadTitle.trim() : undefined;
    const leadEmail = typeof body.leadEmail === 'string' ? body.leadEmail.trim() : undefined;
    const leadPhone = typeof body.leadPhone === 'string' ? body.leadPhone.trim() : undefined;
    const brandColor = typeof body.brandColor === 'string' && body.brandColor.trim() 
      ? body.brandColor.trim() 
      : typeof body.color === 'string' && body.color.trim() 
      ? body.color.trim() 
      : undefined;
    const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : undefined;
    const monthlyBudget = typeof body.monthlyBudget === 'number' 
      ? body.monthlyBudget 
      : typeof body.initialBudget === 'number' 
      ? body.initialBudget 
      : body.monthlyBudget !== undefined || body.initialBudget !== undefined
      ? Number(body.monthlyBudget ?? body.initialBudget)
      : undefined;
    const departments: string[] | undefined = Array.isArray(body.departments) ? body.departments : undefined;
    const staffIds: string[] | undefined = Array.isArray(body.staffIds) ? body.staffIds.filter((s: unknown) => typeof s === 'string' && s.trim()) : undefined;

    assertGroupIdentityUpdate(current, { legalName, code, type });

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
          ...(brandColor !== undefined ? { brandColor } : {}),
          ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
        },
      });

      // 2. Upsert WorkspaceSettings
      const settingsToUpsert: Array<[string, string | undefined]> = [
        ['BRAND_COLOR', brandColor],
        ['BRAND_LOGO_URL', logoUrl],
        ['SUBSIDIARY_INDUSTRY', industry],
        ['HEADQUARTERS_LOCATION', headquarters],
        ['RC_NUMBER', rcNumber],
        ['TIN_NUMBER', tinNumber],
        ['INCORPORATION_DATE', incorporationDate],
        ['WEBSITE_URL', websiteUrl],
        ['CORPORATE_DESCRIPTION', description],
        ['EXECUTIVE_LEAD_NAME', leadName],
        ['EXECUTIVE_LEAD_TITLE', leadTitle],
        ['EXECUTIVE_LEAD_EMAIL', leadEmail],
        ['EXECUTIVE_LEAD_PHONE', leadPhone],
      ];

      for (const [key, value] of settingsToUpsert) {
        if (value !== undefined) {
          await tx.workspaceSetting.upsert({
            where: { organizationId_key: { organizationId, key } },
            create: { organizationId, key, value, updatedById: actor.id },
            update: { value, updatedById: actor.id },
          });
        }
      }

      // 2b. Ensure Departments
      let defaultDeptId = current.departments[0]?.id;
      if (departments && departments.length > 0) {
        const existingNames = new Set(current.departments.map((d) => d.name.toLowerCase()));
        for (const dName of departments) {
          if (!dName || !dName.trim()) continue;
          if (!existingNames.has(dName.trim().toLowerCase())) {
            const dCode = `${code}-${dName.trim().slice(0, 4).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`;
            const createdDept = await tx.department.create({
              data: {
                organizationId,
                name: dName.trim(),
                code: dCode,
              },
            });
            if (!defaultDeptId) defaultDeptId = createdDept.id;
            existingNames.add(dName.trim().toLowerCase());
          }
        }
      }
      if (!defaultDeptId) {
        const fallbackDept = await tx.department.create({
          data: {
            organizationId,
            name: 'General Operations',
            code: `${code}-OPS`,
          },
        });
        defaultDeptId = fallbackDept.id;
      }

      // 2c. Synchronize Tagged Staff Assignments if staffIds provided
      if (staffIds !== undefined && defaultDeptId) {
        const desiredSet = new Set(staffIds);
        const existingOrgStaffAssignments = await tx.employeeAssignment.findMany({
          where: {
            subsidiaryId: organizationId,
            status: 'ACTIVE',
            employee: { role: 'STAFF' },
          },
        });
        const currentlyAssignedEmpIds = new Set(existingOrgStaffAssignments.map((a) => a.employeeId));

        // Add newly tagged staff
        for (const empId of desiredSet) {
          if (!currentlyAssignedEmpIds.has(empId)) {
            const anyActive = await tx.employeeAssignment.findFirst({
              where: { employeeId: empId, status: 'ACTIVE' },
            });
            await tx.employeeAssignment.create({
              data: {
                employeeId: empId,
                subsidiaryId: organizationId,
                departmentId: defaultDeptId,
                positionName: anyActive?.positionName || 'Operations Specialist',
                isPrimary: !anyActive,
                status: 'ACTIVE',
                startsOn: new Date(),
              },
            });
          }
        }

        // Remove untagged staff (only if they have another active assignment, or move them back to BEMS-GROUP so they aren't orphaned)
        for (const assignment of existingOrgStaffAssignments) {
          if (!desiredSet.has(assignment.employeeId)) {
            const otherActiveCount = await tx.employeeAssignment.count({
              where: {
                employeeId: assignment.employeeId,
                status: 'ACTIVE',
                id: { not: assignment.id },
              },
            });
            if (otherActiveCount > 0) {
              await tx.employeeAssignment.update({
                where: { id: assignment.id },
                data: { status: 'INACTIVE', endsOn: new Date() },
              });
            } else if (current.parentGroupId && current.parentGroupId !== organizationId) {
              const groupDept = await tx.department.findFirst({
                where: { organizationId: current.parentGroupId },
              });
              if (groupDept) {
                await tx.employeeAssignment.update({
                  where: { id: assignment.id },
                  data: {
                    subsidiaryId: current.parentGroupId,
                    departmentId: groupDept.id,
                  },
                });
              }
            }
          }
        }
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
        color: updated.brandColor || (updated.type === 'GROUP' ? '#ea580c' : '#0d8a70'),
        brandColor: updated.brandColor || (updated.type === 'GROUP' ? '#ea580c' : '#0d8a70'),
        logoUrl: updated.logoUrl || null,
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
