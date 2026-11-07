import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { getThreeWayMatchSummary } from '@/lib/services/three-way-match';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const user = await getAuthenticatedEmployee(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = await params;

    const request = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { requestNumber: requestId }],
      },
    });

    if (!request) {
      return NextResponse.json({ ok: false, error: `Request "${requestId}" not found.` }, { status: 404 });
    }

    const isExecutive = hasAnyRole(user, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
    const scope = await resolveAuthorizedOrganizationScope(user, 'ALL');
    const withinOrgScope = scope.organizationIds.includes(request.subsidiaryId);
    const isOwnerOrExec = isExecutive || request.requestedById === user.id;

    if (!withinOrgScope || !isOwnerOrExec) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: You do not have access to this request match dossier.' },
        { status: 403 }
      );
    }

    const matchResult = await getThreeWayMatchSummary(request.id);

    return NextResponse.json({
      ok: true,
      threeWayMatch: matchResult.summary,
      record: matchResult.record,
    });
  } catch (error: any) {
    console.error('Error fetching 3-way match summary:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
