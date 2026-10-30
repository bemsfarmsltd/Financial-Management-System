import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'HR', 'COO', 'HEAD_OF_ADMIN'])) {
      return NextResponse.json({ error: 'Executive or HR authorization required.' }, { status: 403 });
    }

    const leaders = await prisma.employee.findMany({
      where: {
        role: {
          in: ['GMD', 'SYSTEM_ADMIN', 'COO', 'HEAD_OF_ADMIN', 'FINANCE', 'VERIFIER', 'DEPT_HEAD', 'HR', 'DIRECTOR'],
        },
        status: { not: 'DELETED' },
      },
      include: {
        assignments: {
          include: {
            subsidiary: { select: { id: true, legalName: true, code: true } },
            department: { select: { id: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ role: 'asc' }, { legalName: 'asc' }],
    });

    const safeLeaders = leaders.map((l) => ({
      id: l.id,
      legalName: l.legalName,
      employeeNumber: l.employeeNumber,
      workEmail: l.workEmail,
      phone: l.phone,
      role: l.role,
      status: l.status,
      subsidiaryName: l.assignments[0]?.subsidiary?.legalName || 'BEMS Group Headquarters',
      departmentName: l.assignments[0]?.department?.name || 'Executive Directorate',
      positionName: l.jobTitle || l.role,
      isCurrentUser: l.id === actor.id || l.workEmail.toLowerCase() === actor.workEmail.toLowerCase(),
      createdAt: l.createdAt,
    }));

    return NextResponse.json({ leaders: safeLeaders });
  } catch (error: any) {
    console.error('Error in GET /api/admin/leadership:', error);
    return NextResponse.json({ error: error.message || 'Failed to list leadership accounts.' }, { status: 500 });
  }
}
