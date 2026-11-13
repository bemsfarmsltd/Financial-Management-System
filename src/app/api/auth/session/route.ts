import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, isHrAuthorizedEmployee, publicEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveOrganizationBranding } from '@/lib/subsidiary-branding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const employee = await getAuthenticatedEmployee(request);
  const [isHr, primaryAssignment] = employee
    ? await Promise.all([
        isHrAuthorizedEmployee(employee),
        prisma.employeeAssignment.findFirst({
          where: { employeeId: employee.id, status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
          include: {
            subsidiary: {
              include: {
                settings: {
                  where: { key: { in: ['BRAND_COLOR', 'BRAND_LOGO_URL'] } },
                },
              },
            },
          },
        }),
      ])
    : [false, null];
  const branding = employee ? resolveOrganizationBranding(primaryAssignment?.subsidiary) : null;
  const res = NextResponse.json({
    user: employee
      ? {
          ...publicEmployee(employee),
          isHrAuthorized: isHr,
          subsidiary: primaryAssignment?.subsidiary?.legalName || primaryAssignment?.subsidiary?.code || '',
          ...(branding || {}),
        }
      : null,
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}
