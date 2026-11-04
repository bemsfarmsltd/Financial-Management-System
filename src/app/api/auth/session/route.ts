import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, isHrAuthorizedEmployee, publicEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const employee = await getAuthenticatedEmployee(request);
  const isHr = employee ? await isHrAuthorizedEmployee(employee) : false;
  const res = NextResponse.json({
    user: employee
      ? {
          ...publicEmployee(employee),
          isHrAuthorized: isHr,
        }
      : null,
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}
