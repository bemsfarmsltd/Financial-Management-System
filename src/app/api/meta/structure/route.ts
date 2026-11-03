import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getOrganizationsWithStreamlinedDepartments,
  STREAMLINED_STAFF_GRADES,
} from '@/lib/enterpriseStructure';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orgs = await getOrganizationsWithStreamlinedDepartments(prisma);

    return NextResponse.json({
      organizations: orgs.map((org) => ({
        id: org.id,
        code: org.code,
        legalName: org.legalName,
        type: org.type,
        departments: org.departments.map((dept) => ({
          id: dept.id,
          code: dept.code,
          name: dept.name,
        })),
      })),
      staffGrades: STREAMLINED_STAFF_GRADES,
    });
  } catch (error: any) {
    console.error('GET /api/meta/structure error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch enterprise structure' },
      { status: 500 }
    );
  }
}
