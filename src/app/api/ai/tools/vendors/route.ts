import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { executeThreeWayMatch, getThreeWayMatchSummary } from '@/lib/services/three-way-match';

/**
 * AI & n8n Automation Tool: Vendor Registry & 3-Way Match Verification
 *
 * GET  /api/ai/tools/vendors?search=... or ?requestId=REQ-2026-0005
 * POST /api/ai/tools/vendors
 * Payload:
 *   - Action 'REGISTER': Register verified vendor with NUBAN bank check
 *   - Action 'CHECK_MATCH': Evaluate 3-way match (PO vs GRN vs Invoice)
 */
export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor) {
    return NextResponse.json({ ok: false, error_code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }
  const isExecutive = actor.isExecutive;

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId') || '';
  const search = searchParams.get('search') || '';

  // If requestId provided, return 3-Way Match Verification Dossier
  if (requestId) {
    const request = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { requestNumber: requestId }],
      },
    });

    if (!request) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request "${requestId}" not found.` }, { status: 404 });
    }

    const match = await getThreeWayMatchSummary(request.id);
    return NextResponse.json({
      ok: true,
      service: 'BEMS AI 3-Way Match Inspector',
      threeWayMatch: match.summary,
    });
  }

  // Otherwise list vendors
  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
    ];
  }

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      _count: {
        select: { requests: true, invoices: true },
      },
    },
    take: 50,
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    ok: true,
    service: 'BEMS AI Vendor Registry',
    count: vendors.length,
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      code: v.code,
      category: v.category,
      taxId: v.taxId,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      bank: {
        bankName: v.bankName,
        accountNumber: v.accountNumber,
        accountName: v.accountName,
      },
      rating: v.rating,
      totalPOs: v._count.requests,
      totalInvoices: v._count.invoices,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;
  if (!actor) {
    return NextResponse.json({ ok: false, error_code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }
  const isExecutive = actor.isExecutive;

  const body = await req.json().catch(() => ({}));
  const action: string = (body.action || 'CHECK_MATCH').toUpperCase().trim();

  // -------------------------------------------------------------
  // ACTION 1: CHECK_MATCH (Verify PO vs GRN vs Invoice)
  // -------------------------------------------------------------
  if (action === 'CHECK_MATCH') {
    const requestId: string = (body.requestId || body.requestNumber || '').trim();
    if (!requestId) {
      return NextResponse.json(
        { ok: false, error_code: 'MISSING_REQUEST_ID', message: 'requestId or requestNumber is required to run 3-way matching.' },
        { status: 400 }
      );
    }

    const request = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { requestNumber: requestId }],
      },
    });

    if (!request) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request "${requestId}" not found.` }, { status: 404 });
    }

    const match = await executeThreeWayMatch({
      requestId: request.id,
      actorId: actor.id,
      actorName: actor.legalName,
      actorRole: actor.role,
    });

    return NextResponse.json({
      ok: true,
      service: 'BEMS AI 3-Way Match Verification Engine',
      matchStatus: match.matchStatus,
      summary: match.summary,
    });
  }

  // -------------------------------------------------------------
  // ACTION 2: REGISTER (Register verified vendor with NUBAN check)
  // -------------------------------------------------------------
  if (action === 'REGISTER') {
    if (!isExecutive) {
      return NextResponse.json(
        { ok: false, error_code: 'FORBIDDEN', message: 'Only Executive Leadership (SUPER_ADMIN or GMD) can register corporate vendors.' },
        { status: 403 }
      );
    }

    const name: string = (body.name || body.vendorName || '').trim();
    const category: string = (body.category || 'GENERAL').toUpperCase().trim();
    const contactEmail: string = (body.contactEmail || body.email || '').trim();
    const contactPhone: string = (body.contactPhone || body.phone || '').trim();
    const bankName: string = (body.bankName || '').trim();
    const accountNumber: string = (body.accountNumber || '').trim().replace(/\D/g, '');
    const accountName: string = (body.accountName || '').trim();
    const taxId: string = (body.taxId || body.tin || '').trim();
    const notes: string = (body.notes || '').trim();

    // Check mandatory parameters
    const missing: string[] = [];
    if (!name || name.length < 2) missing.push('name (Legal corporate vendor name)');
    if (!bankName) missing.push('bankName (e.g. GTBank, Kuda, Zenith, Access)');
    if (!accountNumber || accountNumber.length !== 10) missing.push('accountNumber (10-digit Nigerian NUBAN)');
    if (!accountName) missing.push('accountName (Verified beneficiary account name on record with NIBSS)');

    if (missing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'INCOMPLETE_PARAMETERS',
          message: 'To register a vendor, all verified banking and corporate fields are mandatory.',
          missing_fields: missing,
          required_fields: [
            { field: 'name', label: 'Vendor Corporate Name', example: 'Mikano International Ltd' },
            { field: 'bankName', label: 'Commercial Bank', example: 'Guaranty Trust Bank' },
            { field: 'accountNumber', label: '10-Digit NUBAN', example: '0123456789' },
            { field: 'accountName', label: 'Verified Account Name', example: 'Mikano International Ltd' },
            { field: 'category', label: 'Category', example: 'FACILITIES' },
            { field: 'contactPhone', label: 'Contact Phone', example: '+234 802 000 3344' },
          ],
          conversational_prompt: `To register this vendor, please provide the following details:\n` +
            missing.map((m, i) => `${i + 1}. **${m}**`).join('\n'),
        },
        { status: 400 }
      );
    }

    // Generate unique vendor code
    const count = await prisma.vendor.count();
    const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const prefix = words.length >= 2 ? words.map((w) => w[0]).join('').slice(0, 3).toUpperCase() : 'VND';
    const code = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const vendor = await prisma.vendor.create({
      data: {
        name,
        code,
        category,
        taxId: taxId || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        bankName,
        accountNumber,
        accountName,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Vendor "${vendor.name}" registered successfully with code ${vendor.code}.`,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        code: vendor.code,
        category: vendor.category,
        bankName: vendor.bankName,
        accountNumber: vendor.accountNumber,
        accountName: vendor.accountName,
      },
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_ACTION', message: `Unknown action "${action}". Allowed: CHECK_MATCH, REGISTER.` },
    { status: 400 }
  );
}

