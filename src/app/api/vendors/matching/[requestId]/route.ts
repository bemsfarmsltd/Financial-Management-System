import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';
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

    // Resolve target request
    const request = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { requestNumber: requestId }],
      },
    });

    if (!request) {
      return NextResponse.json({ ok: false, error: `Request "${requestId}" not found.` }, { status: 404 });
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

