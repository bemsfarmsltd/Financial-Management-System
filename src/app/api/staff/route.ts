import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { projectSafeEmployeeDto } from '@/lib/platform/read-catalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view staff records.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive or Super admin access is required to view staff and salary records.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId') || searchParams.get('subsidiary');
    const now = new Date();

    const employees = await prisma.employee.findMany({
      where: {
        role: 'STAFF',
      },
      include: {
        assignments: {
          include: {
            subsidiary: {
              select: { id: true, legalName: true, code: true }
            },
            department: {
              select: { id: true, name: true, code: true }
            }
          }
        },
        employmentAgreements: {
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          include: {
            compensations: {
              take: 5,
              orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }]
            }
          }
        },
        salaryChangeProposals: {
          where: { status: 'PENDING_APPROVAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const safeEmployees = JSON.parse(
      JSON.stringify(employees, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
    );

    const processedEmployees = safeEmployees.map((e: any) => {
      const allComp = e.employmentAgreements?.[0]?.compensations || [];
      const activeComp = allComp[0] || null;
      const upcomingComp = allComp.find((c: any) => c.id !== activeComp?.id && new Date(c.effectiveFrom) > now) || null;

      // Keep e.employmentAgreements[0].compensations pointing to activeComp for backward compatibility
      if (e.employmentAgreements?.[0] && activeComp) {
        e.employmentAgreements[0].compensations = [activeComp];
      }

      return projectSafeEmployeeDto(
        {
          ...e,
          activeCompensation: activeComp,
          upcomingCompensation: upcomingComp,
        },
        actor.role
      );
    });

    let filtered = processedEmployees;
    if (orgId && orgId !== 'ALL' && orgId !== 'all') {
      const scope = await resolveAuthorizedOrganizationScope(actor, orgId);
      if (!scope.isGroup) {
        filtered = processedEmployees.filter((e: any) =>
          e.assignments?.some((a: any) =>
            scope.organizationIds.includes(a.subsidiaryId) ||
            scope.organizationIds.includes(a.subsidiary?.id) ||
            scope.organizationIds.includes(a.subsidiary?.code)
          )
        );
      }
    }

    return NextResponse.json(
      { employees: filtered },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
