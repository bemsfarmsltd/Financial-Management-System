import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, getHrAuthorizationScope, hasAnyRole } from '@/lib/auth';
import { queryDailyAttendanceRoster } from '@/lib/services/attendance-roster';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedEmployee(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }
    const isExecutive = hasAnyRole(user, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
    const hrScope = await getHrAuthorizationScope(user);
    if (!isExecutive && !hrScope.authorized) {
      return NextResponse.json({ error: 'Forbidden: Executive or HR access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const result = await queryDailyAttendanceRoster(user, {
      date: searchParams.get('date'),
      subsidiaryId: searchParams.get('subsidiaryId'),
      departmentId: searchParams.get('departmentId'),
      search: searchParams.get('search'),
      redactSensitivePins: false,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching daily attendance roster:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
