import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { getIntercompanyMatrix } from '@/lib/services/intercompany';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ ok: false, error: 'Executive authority required.' }, { status: 403 });
    }

    const matrix = await getIntercompanyMatrix();

    const totalReceivables = matrix.reduce((acc, m) => acc + m.receivables, 0);
    const totalPayables = matrix.reduce((acc, m) => acc + m.payables, 0);

    return NextResponse.json({
      ok: true,
      summary: {
        totalEntities: matrix.length,
        totalConglomerateReceivables: totalReceivables,
        totalConglomeratePayables: totalPayables,
        isBalanced: Math.abs(totalReceivables - totalPayables) < 0.01,
      },
      matrix,
    });
  } catch (error: any) {
    console.error('Error fetching intercompany matrix:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

