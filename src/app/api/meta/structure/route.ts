import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orgs = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        legalName: true,
        type: true,
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

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
    });
  } catch (error: any) {
    console.error('GET /api/meta/structure error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch enterprise structure' },
      { status: 500 }
    );
  }
}
