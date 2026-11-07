import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { executeThreeWayMatch } from '@/lib/services/three-way-match';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedEmployee(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const isExecutive = hasAnyRole(user, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId') || undefined;
    const requestId = searchParams.get('requestId') || undefined;
    const status = searchParams.get('status') || undefined;
    const subsidiaryId = searchParams.get('subsidiaryId') || searchParams.get('subsidiary') || 'ALL';
    const scope = await resolveAuthorizedOrganizationScope(user, subsidiaryId);

    const invoices = await prisma.vendorInvoice.findMany({
      where: {
        vendorId,
        requestId,
        status,
        ...(!isExecutive || !scope.isGroup
          ? {
              request: {
                ...(!scope.isGroup ? { subsidiaryId: { in: scope.organizationIds } } : {}),
                ...(!isExecutive ? { requestedById: user.id } : {}),
              },
            }
          : {}),
      },
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        request: { select: { id: true, requestNumber: true, title: true, amountMinor: true } },
        matchingRecord: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      count: invoices.length,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString(),
        amountMinor: Number(inv.amountMinor),
        taxMinor: Number(inv.taxMinor),
        currency: inv.currency,
        status: inv.status,
        vendor: inv.vendor,
        request: inv.request
          ? {
              id: inv.request.id,
              requestNumber: inv.request.requestNumber,
              title: inv.request.title,
              poAmountMinor: Number(inv.request.amountMinor),
            }
          : null,
        matchingRecord: inv.matchingRecord
          ? {
              status: inv.matchingRecord.status,
              varianceMinor: Number(inv.matchingRecord.varianceMinor),
              matchedAt: inv.matchingRecord.matchedAt.toISOString(),
            }
          : null,
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
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
    const invoiceNumber: string = (body.invoiceNumber || '').trim();
    const invoiceDateStr: string = (body.invoiceDate || '').trim();
    let amountMinor: number = Number(body.amountMinor || (body.amount ? Math.round(Number(body.amount) * 100) : 0));
    const taxMinor: number = Number(body.taxMinor || 0);
    const currency: string = (body.currency || 'NGN').toUpperCase().trim();
    const vendorIdParam: string = (body.vendorId || '').trim();

    if (!requestId) {
      return NextResponse.json({ ok: false, error: 'Target Purchase Order / Expenditure Request ID is required.' }, { status: 400 });
    }

    if (!invoiceNumber) {
      return NextResponse.json({ ok: false, error: 'Invoice number is required.' }, { status: 400 });
    }

    if (!amountMinor || amountMinor <= 0) {
      return NextResponse.json({ ok: false, error: 'Invoice gross amount is required (greater than 0).' }, { status: 400 });
    }

    // Resolve Request
    const request = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { requestNumber: requestId }],
      },
      include: { vendor: true },
    });

    if (!request) {
      return NextResponse.json({ ok: false, error: `Request "${requestId}" not found.` }, { status: 404 });
    }

    const isExecutive = hasAnyRole(user, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
    if (!isExecutive && request.requestedById !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Only an executive or the original requester can attach a vendor invoice to this Purchase Order.' },
        { status: 403 }
      );
    }

    const scopeCheck = await resolveAuthorizedOrganizationScope(user, request.subsidiaryId);
    if (scopeCheck.organizationIds.length === 0 && !isExecutive && request.requestedById !== user.id) {
      return NextResponse.json({ ok: false, error: 'Forbidden: Outside authorized subsidiary scope.' }, { status: 403 });
    }

    if (vendorIdParam && request.vendorId && vendorIdParam !== request.vendorId) {
      return NextResponse.json(
        { ok: false, error: 'Vendor mismatch: The supplied invoice vendorId does not match the vendor assigned to the Purchase Order.' },
        { status: 400 }
      );
    }

    const effectiveVendorId = request.vendorId || vendorIdParam;
    if (!effectiveVendorId) {
      return NextResponse.json(
        { ok: false, error: 'No vendor is linked to this request. Please specify a vendorId or assign a vendor to the request.' },
        { status: 400 }
      );
    }

    // Create Invoice
    const invoice = await prisma.vendorInvoice.create({
      data: {
        vendorId: effectiveVendorId,
        requestId: request.id,
        invoiceNumber,
        invoiceDate: invoiceDateStr ? new Date(invoiceDateStr) : new Date(),
        amountMinor: BigInt(amountMinor),
        taxMinor: BigInt(taxMinor),
        currency,
        status: 'PENDING',
      },
    });

    // Execute Automated 3-Way Match
    const matchResult = await executeThreeWayMatch({
      requestId: request.id,
      invoiceId: invoice.id,
      actorId: user.id,
      actorName: user.legalName || user.workEmail,
      actorRole: user.role,
    });

    return NextResponse.json({
      ok: true,
      message: `Invoice #${invoice.invoiceNumber} recorded successfully. 3-way match status: ${matchResult.matchStatus}.`,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amountMinor: Number(invoice.amountMinor),
        status: matchResult.summary.canDisburse ? 'MATCHED' : invoice.status,
      },
      threeWayMatch: matchResult.summary,
    });
  } catch (error: any) {
    console.error('Error creating vendor invoice:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

