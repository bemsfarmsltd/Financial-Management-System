import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to assign payroll payment recording.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the GMD or System Admin can assign payroll payment recording.' }, { status: 403 });

  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE', approvalStatus: 'APPROVED', role: { in: ['SYSTEM_ADMIN', 'GMD', 'COO', 'FINANCE'] } },
    select: { id: true, legalName: true, role: true },
    orderBy: { legalName: 'asc' },
  });
  return NextResponse.json({ current: { id: actor.id, legalName: actor.legalName }, employees });
}
