import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { getThreeWayMatchSummary } from '@/lib/services/three-way-match';
import { stageAction } from '@/lib/staged-actions';
import { checkAiScopeOrResponse } from '@/lib/ai-access-control';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { clampPagination, maskIdentifierPii } from '@/lib/platform/read-catalog';

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
  const { searchParams } = new URL(req.url);
  const requestId = (searchParams.get('requestId') || searchParams.get('request_id') || '').trim();
  const search = (searchParams.get('search') || '').trim();
  const includeFinancialDetails =
    searchParams.get('includeFinancialDetails') === 'true' ||
    searchParams.get('financial_details') === 'true';

  const { actor, errorResponse } = await authenticateAiToolRequest(req, {
    scope: requestId ? 'three_way_match' : 'vendors',
    mode: 'read',
  });
  if (errorResponse) return errorResponse;
  if (!actor) {
    return NextResponse.json({ ok: false, error_code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }
  const isExecutive = actor.isExecutive;

  const requestedOrgId =
    searchParams.get('subsidiary') ||
    searchParams.get('organization_id') ||
    searchParams.get('subsidiary_id') ||
    actor.scopedOrganizationId ||
    'ALL';
  const scope = await resolveAuthorizedOrganizationScope(actor as any, requestedOrgId);

  // 1. Request Match Dossier permission & target ownership check
  if (requestId) {
    const request = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { requestNumber: requestId }],
      },
    });

    if (!request) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request "${requestId}" not found.` }, { status: 404 });
    }

    const withinOrgScope = scope.organizationIds.includes(request.subsidiaryId);
    const isOwnerOrExec = isExecutive || request.requestedById === actor.id;
    if (!withinOrgScope || !isOwnerOrExec) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'FORBIDDEN',
          message: 'You do not have permission or entity scope to inspect the 3-way match dossier for this request.',
        },
        { status: 403 }
      );
    }

    const match = await getThreeWayMatchSummary(request.id);
    return NextResponse.json({
      ok: true,
      service: 'BEMS AI 3-Way Match Inspector',
      requestId: request.id,
      requestNumber: request.requestNumber,
      subsidiaryId: request.subsidiaryId,
      threeWayMatch: match.summary,
    });
  }

  // 2. Financial-detail permission check
  if (includeFinancialDetails && !isExecutive) {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'FORBIDDEN',
        message: 'Executive access is required to inspect vendor tax IDs and banking details.',
      },
      { status: 403 }
    );
  }

  // 3. Vendor Directory read with restricted projections
  const { limit, offset } = clampPagination(
    searchParams.get('limit'),
    searchParams.get('offset'),
    50,
    25
  );

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
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    ok: true,
    service: 'BEMS AI Vendor Registry',
    projection: isExecutive && includeFinancialDetails ? 'EXECUTIVE_FINANCIAL' : 'DIRECTORY_RESTRICTED',
    count: vendors.length,
    vendors: vendors.map((v) => {
      const baseDirectoryProjection = {
        id: v.id,
        name: v.name,
        code: v.code,
        category: v.category,
        rating: v.rating,
        totalPOs: v._count.requests,
        totalInvoices: v._count.invoices,
      };

      if (!isExecutive) {
        return baseDirectoryProjection;
      }

      if (!includeFinancialDetails) {
        return {
          ...baseDirectoryProjection,
          taxId: v.taxId ? maskIdentifierPii(v.taxId) : null,
          bank: {
            bankName: v.bankName,
            accountNumber: v.accountNumber ? maskIdentifierPii(v.accountNumber) : null,
            accountName: v.accountName,
          },
        };
      }

      return {
        ...baseDirectoryProjection,
        taxId: v.taxId ? maskIdentifierPii(v.taxId) : null,
        contactEmail: v.contactEmail,
        contactPhone: v.contactPhone,
        bank: {
          bankName: v.bankName,
          accountNumber: v.accountNumber ? maskIdentifierPii(v.accountNumber) : null,
          accountName: v.accountName,
        },
      };
    }),
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
  const targetScope = action === 'REGISTER' || action === 'CREATE' ? 'vendors' : 'three_way_match';
  const targetMode: 'read' | 'write' = action === 'CHECK_MATCH' ? 'read' : 'write';
  const scopeBlocked = await checkAiScopeOrResponse(targetScope, targetMode);
  if (scopeBlocked) return scopeBlocked;

  // -------------------------------------------------------------
  // ACTION 1: CHECK_MATCH (Read-Only 3-Way Match Status Inspection)
  // -------------------------------------------------------------
  if (action === 'CHECK_MATCH') {
    const requestId: string = (body.requestId || body.requestNumber || '').trim();
    if (!requestId) {
      return NextResponse.json(
        { ok: false, error_code: 'MISSING_REQUEST_ID', message: 'requestId or requestNumber is required to inspect 3-way matching.' },
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

    const scope = await resolveAuthorizedOrganizationScope(actor as any, actor.scopedOrganizationId || 'ALL');
    const withinOrgScope = scope.organizationIds.includes(request.subsidiaryId);
    const isOwnerOrExec = isExecutive || request.requestedById === actor.id;
    if (!withinOrgScope || !isOwnerOrExec) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'FORBIDDEN',
          message: 'You do not have permission or entity scope to inspect the 3-way match dossier for this request.',
        },
        { status: 403 }
      );
    }

    const match = await getThreeWayMatchSummary(request.id);

    return NextResponse.json({
      ok: true,
      service: 'BEMS AI 3-Way Match Inspector (Read-Only)',
      matchStatus: match.summary?.canDisburse ? 'MATCHED' : 'UNVERIFIED',
      summary: match.summary,
    });
  }

  // -------------------------------------------------------------
  // ACTION 1B: RECOMPUTE_MATCH (Staged 3-Way Match Evaluation & Ledger Update)
  // -------------------------------------------------------------
  if (action === 'RECOMPUTE_MATCH' || action === 'EXECUTE_MATCH') {
    if (!isExecutive) {
      return NextResponse.json(
        { ok: false, error_code: 'FORBIDDEN', message: 'Executive authority required to stage 3-way match recomputation.' },
        { status: 403 }
      );
    }

    const requestId: string = (body.requestId || body.requestNumber || '').trim();
    if (!requestId) {
      return NextResponse.json(
        { ok: false, error_code: 'MISSING_REQUEST_ID', message: 'requestId or requestNumber is required.' },
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

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'vendor_approval',
      summary: `Recompute & commit 3-Way Match verification for ${request.requestNumber} (${request.title})`,
      materialPayload: {
        mode: 'RECOMPUTE_MATCH',
        request_id: request.id,
        request_number: request.requestNumber,
      },
      preview: {
        action: 'RECOMPUTE_MATCH',
        requestNumber: request.requestNumber,
        title: request.title,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `3-Way Match recomputation for ${request.requestNumber} has been staged. Click the confirmation button to commit.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 1C: RESOLVE_MATCH_EXCEPTION (Staged Executive Match Exception Override)
  // -------------------------------------------------------------
  if (action === 'RESOLVE_MATCH_EXCEPTION' || action === 'OVERRIDE_MATCH_EXCEPTION') {
    if (!isExecutive) {
      return NextResponse.json(
        { ok: false, error_code: 'FORBIDDEN', message: 'Executive authority is required to resolve or override a 3-way match exception.' },
        { status: 403 }
      );
    }

    const requestId: string = (body.requestId || body.requestNumber || '').trim();
    const reason: string = (body.reason || body.notes || '').trim();
    if (!requestId || reason.length < 5) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'VALIDATION_FAILED',
          message: 'requestId/requestNumber and a reason (min 5 chars) are required to resolve a 3-way match exception.',
        },
        { status: 400 }
      );
    }

    const request = await prisma.expenditureRequest.findFirst({
      where: { OR: [{ id: requestId }, { requestNumber: requestId }] },
    });
    if (!request) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request "${requestId}" not found.` }, { status: 404 });
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'vendor_approval',
      targetSubsidiaryId: request.subsidiaryId,
      summary: `Authorize 3-Way Match Exception Override for ${request.requestNumber} (${request.title})`,
      materialPayload: {
        mode: 'RESOLVE_MATCH_EXCEPTION',
        request_id: request.id,
        request_number: request.requestNumber,
        reason,
      },
      preview: {
        action: 'RESOLVE_MATCH_EXCEPTION',
        requestNumber: request.requestNumber,
        title: request.title,
        reason,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `3-Way Match exception override for ${request.requestNumber} has been staged. Click Confirm to authorize.`,
      ...staged,
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
    if (!bankName || bankName.toLowerCase() === 'commercial bank') missing.push('bankName (e.g. GTBank, Kuda, Zenith, Access)');
    if (!accountNumber || accountNumber.length !== 10 || accountNumber === '0000000000') missing.push('accountNumber (10-digit Nigerian NUBAN)');
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

    const cleanTaxId = taxId && taxId.toUpperCase() !== 'PENDING_TIN' ? taxId : null;
    const duplicate = await prisma.vendor.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { accountNumber },
          ...(cleanTaxId ? [{ taxId: { equals: cleanTaxId, mode: 'insensitive' as const } }] : []),
        ],
      },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'DUPLICATE_VENDOR',
          message: `Vendor "${duplicate.name}" (${duplicate.code}) is already registered with matching name, NUBAN, or tax ID.`,
          existing_vendor_id: duplicate.id,
        },
        { status: 409 }
      );
    }

    // Generate unique vendor code
    const count = await prisma.vendor.count();
    const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const prefix = words.length >= 2 ? words.map((w) => w[0]).join('').slice(0, 3).toUpperCase() : 'VND';
    const code = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'vendor_approval',
      summary: `Register verified vendor "${name}" (${code}) · ${bankName} ${accountNumber}`,
      materialPayload: {
        mode: 'REGISTER_NEW_VENDOR',
        name,
        code,
        category,
        taxId: cleanTaxId,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        bankName,
        accountNumber,
        accountName,
        notes: notes || null,
      },
      preview: {
        action: 'REGISTER_NEW_VENDOR',
        name,
        code,
        category,
        bankName,
        accountNumber,
        accountName,
        taxId: cleanTaxId || 'Not Provided',
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `Vendor registration for "${name}" (${code}) has been staged. Click the confirmation button to commit to the Vendor Registry.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 3: RECORD_GRN (Stage Goods Receipt Note for 3-Way Match)
  // -------------------------------------------------------------
  if (action === 'RECORD_GRN' || action === 'CREATE_GRN') {
    const requestLookup = String(body.requestId || body.requestNumber || body.request_id || '').trim();
    if (!requestLookup) {
      return NextResponse.json(
        { ok: false, error_code: 'MISSING_REQUEST_ID', message: 'requestId or requestNumber is required to record a Goods Receipt Note (GRN).' },
        { status: 400 }
      );
    }

    const reqRecord = await prisma.expenditureRequest.findFirst({
      where: { OR: [{ id: requestLookup }, { requestNumber: requestLookup }] },
    });
    if (!reqRecord) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request "${requestLookup}" not found.` }, { status: 404 });
    }

    const grnNumber =
      body.grnNumber || `GRN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const deliveryStatus = String(body.deliveryStatus || 'COMPLETE').toUpperCase();
    const conditionNotes = String(body.conditionNotes || 'Goods received in complete and good condition').trim();

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'grn_creation',
      summary: `Record Goods Receipt Note (${grnNumber}) for ${reqRecord.requestNumber} (${reqRecord.title})`,
      materialPayload: {
        requestId: reqRecord.id,
        grnNumber,
        deliveryStatus,
        items: body.items || [{ description: reqRecord.title, quantity: 1 }],
        conditionNotes,
        deliveryNoteUrl: body.deliveryNoteUrl || null,
      },
      preview: {
        action: 'RECORD_GRN',
        grnNumber,
        requestNumber: reqRecord.requestNumber,
        title: reqRecord.title,
        deliveryStatus,
        conditionNotes,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `Goods Receipt Note (${grnNumber}) for ${reqRecord.requestNumber} has been staged. Click Confirm to record delivery and trigger 3-way matching.`,
      ...staged,
    });
  }

  // -------------------------------------------------------------
  // ACTION 4: RECORD_INVOICE (Stage Vendor Invoice for 3-Way Match)
  // -------------------------------------------------------------
  if (action === 'RECORD_INVOICE' || action === 'CREATE_INVOICE') {
    const requestLookup = String(body.requestId || body.requestNumber || body.request_id || '').trim();
    if (!requestLookup) {
      return NextResponse.json(
        { ok: false, error_code: 'MISSING_REQUEST_ID', message: 'requestId or requestNumber is required to record a Vendor Invoice.' },
        { status: 400 }
      );
    }

    const reqRecord = await prisma.expenditureRequest.findFirst({
      where: { OR: [{ id: requestLookup }, { requestNumber: requestLookup }] },
      include: { vendor: true },
    });
    if (!reqRecord) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request "${requestLookup}" not found.` }, { status: 404 });
    }

    let vendorId = body.vendorId || reqRecord.vendorId;
    if (!vendorId && body.vendorName) {
      const foundVendor = await prisma.vendor.findFirst({
        where: { name: { contains: String(body.vendorName), mode: 'insensitive' } },
      });
      if (foundVendor) vendorId = foundVendor.id;
    }

    if (!vendorId) {
      return NextResponse.json(
        { ok: false, error_code: 'MISSING_VENDOR', message: 'vendorId or vendorName is required when the request has no linked vendor.' },
        { status: 400 }
      );
    }

    const invoiceNumber =
      body.invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const amountNaira = body.amount !== undefined ? Number(body.amount) : Number(reqRecord.amountMinor) / 100;

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'vendor_invoice_creation',
      summary: `Record Vendor Invoice (${invoiceNumber}) of ₦${amountNaira.toLocaleString()} for ${reqRecord.requestNumber}`,
      materialPayload: {
        requestId: reqRecord.id,
        vendorId,
        invoiceNumber,
        amount: amountNaira,
        currency: body.currency || reqRecord.currency || 'NGN',
        items: body.items || [{ description: reqRecord.title, quantity: 1, amount: amountNaira }],
        documentUrl: body.documentUrl || null,
      },
      preview: {
        action: 'RECORD_INVOICE',
        invoiceNumber,
        requestNumber: reqRecord.requestNumber,
        amount: `₦${amountNaira.toLocaleString()}`,
        currency: body.currency || reqRecord.currency || 'NGN',
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      message: `Vendor Invoice (${invoiceNumber}) for ${reqRecord.requestNumber} has been staged. Click Confirm to record invoice and run 3-way matching.`,
      ...staged,
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_ACTION', message: `Unknown action "${action}". Allowed: CHECK_MATCH, RECOMPUTE_MATCH, REGISTER, RECORD_GRN, RECORD_INVOICE.` },
    { status: 400 }
  );
}

