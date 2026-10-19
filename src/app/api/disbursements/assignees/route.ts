import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const disbursementRoles = ['SYSTEM_ADMIN', 'GMD', 'FINANCE'];

export async function GET() {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to assign disbursement recording.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only the GMD or System Admin can assign disbursement recording.' }, { status: 403 });
    }

    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE', approvalStatus: 'APPROVED', role: { in: disbursementRoles } },
      select: { id: true, legalName: true, role: true },
      orderBy: { legalName: 'asc' },
    });

    return NextResponse.json({ current: { id: actor.id, legalName: actor.legalName }, employees });
  } catch (error) {
    console.error('Disbursement assignees fetch error:', error);
    return NextResponse.json({ error: 'Could not load executives for assignment.' }, { status: 500 });
  }
}
