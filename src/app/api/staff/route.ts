import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

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
    const orgId = searchParams.get('orgId');
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

    const filtered = orgId && orgId !== 'all'
      ? safeEmployees.filter((e: any) =>
          e.assignments?.some((a: any) => a.subsidiary?.id === orgId || a.subsidiary?.code === orgId)
        )
      : safeEmployees;

    return NextResponse.json({ employees: filtered });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
