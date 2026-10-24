import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view staff records.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'COO', 'HEAD_OF_ADMIN', 'HR', 'DIRECTOR', 'FINANCE'])) {
      return NextResponse.json({ error: 'HR or executive access is required to view staff and salary records.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId') || searchParams.get('subsidiary');
    const now = new Date();

    const employees = await prisma.employee.findMany({
      where: {
        role: { notIn: ['SYSTEM_ADMIN', 'GMD'] },
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
          include: {
            compensations: {
              where: {
                effectiveFrom: { lte: now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
              },
              take: 1,
              orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const safeEmployees = JSON.parse(
      JSON.stringify(employees, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
    );

    let filtered = safeEmployees;
    if (orgId && orgId !== 'ALL' && orgId !== 'all') {
      const scope = await resolveOrganizationScope(orgId);
      if (!scope.isGroup) {
        filtered = safeEmployees.filter((e: any) =>
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
