import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeThreeWayMatch } from '@/lib/services/three-way-match';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedEmployee(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('requestId') || undefined;
    const status = searchParams.get('status') || undefined;

    const grns = await prisma.goodsReceiptNote.findMany({
      where: {
        requestId,
        status,
      },
      include: {
        request: { select: { id: true, requestNumber: true, title: true, amountMinor: true } },
        receivedBy: { select: { id: true, legalName: true, role: true } },
        matchingRecord: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      count: grns.length,
      goodsReceiptNotes: grns.map((g) => ({
        id: g.id,
        grnNumber: g.grnNumber,
        receivedAt: g.receivedAt.toISOString(),
        waybillNumber: g.waybillNumber,
        inspectionNotes: g.inspectionNotes,
        status: g.status,
        receivedBy: g.receivedBy.legalName,
        request: {
          id: g.request.id,
          requestNumber: g.request.requestNumber,
          title: g.request.title,
          poAmountMinor: Number(g.request.amountMinor),
        },
        matchingRecord: g.matchingRecord
          ? {
              status: g.matchingRecord.status,
              varianceMinor: Number(g.matchingRecord.varianceMinor),
              matchedAt: g.matchingRecord.matchedAt.toISOString(),
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching GRNs:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedEmployee(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId: string = (body.requestId || '').trim();
    const waybillNumber: string = (body.waybillNumber || '').trim();
    const inspectionNotes: string = (body.inspectionNotes || '').trim();
    const status: string = (body.status || 'ACCEPTED').toUpperCase().trim(); // ACCEPTED | PARTIAL | DAMAGED

    if (!requestId) {
      return NextResponse.json({ ok: false, error: 'Target Purchase Order / Expenditure Request ID is required.' }, { status: 400 });
    }

    if (!['ACCEPTED', 'PARTIAL', 'DAMAGED'].includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'GRN inspection status must be ACCEPTED, PARTIAL, or DAMAGED.' },
        { status: 400 }
      );
    }

    // Resolve Request
    const request = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { requestNumber: requestId }],
      },
    });

    if (!request) {
      return NextResponse.json({ ok: false, error: `Request "${requestId}" not found.` }, { status: 404 });
    }

    // Generate sequential GRN number
    const count = await prisma.goodsReceiptNote.count();
    const year = new Date().getFullYear();
    const grnNumber = `GRN-${year}-${String(count + 1).padStart(4, '0')}`;

    const grn = await prisma.goodsReceiptNote.create({
      data: {
        requestId: request.id,
        grnNumber,
        receivedById: user.id,
        waybillNumber: waybillNumber || null,
        inspectionNotes: inspectionNotes || null,
        status,
      },
    });

    // Re-evaluate 3-Way Match
    const matchResult = await executeThreeWayMatch({
      requestId: request.id,
      grnId: grn.id,
      actorId: user.id,
      actorName: user.legalName || user.workEmail,
      actorRole: user.role,
    });

    return NextResponse.json({
      ok: true,
      message: `Goods Receipt Note "${grn.grnNumber}" certified successfully (${status}). 3-way match status: ${matchResult.matchStatus}.`,
      goodsReceiptNote: {
        id: grn.id,
        grnNumber: grn.grnNumber,
        status: grn.status,
        inspectionNotes: grn.inspectionNotes,
      },
      threeWayMatch: matchResult.summary,
    });
  } catch (error: any) {
    console.error('Error creating Goods Receipt Note:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

