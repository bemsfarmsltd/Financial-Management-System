import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { matchBank } from '@/lib/bank-utils';
import { stageAction } from '@/lib/staged-actions';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Only GMD or Super Admin can register bank account details.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const targetType = (body.targetType || body.type || 'STAFF').toUpperCase().trim(); // STAFF | SUBSIDIARY | VENDOR
  const targetQuery = (body.targetId || body.target || body.employeeId || body.organizationId || body.vendorId || body.email || body.name || '').trim();
  const rawBankName = (body.bankName || body.bank || '').trim();
  const accountNumber = (body.accountNumber || body.account || '').replace(/[^0-9]/g, '');
  const accountName = (body.accountName || body.beneficiaryName || '').trim();
  const accountType = (body.accountType || 'Corporate Operational').trim(); // For CompanyBankAccount

  const missing: string[] = [];
  if (!targetQuery) missing.push('targetId (Name, Email, or ID of Staff, Subsidiary, or Vendor)');
  if (!rawBankName) missing.push('bankName (Bank Name, e.g. GTBank, Kuda, Zenith, Access, OPay)');
  if (!accountNumber || accountNumber.length !== 10) missing.push('accountNumber (Exactly 10-digit NUBAN)');
  if (!accountName) missing.push('accountName (Exact beneficiary account name on record with NIBSS)');

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error_code: 'INCOMPLETE_PARAMETERS',
        message: 'To register a bank account, all financial and beneficiary specifications are mandatory.',
        missing_fields: missing,
        required_fields: [
          { field: 'targetType', label: 'Target Type (STAFF, SUBSIDIARY, or VENDOR)', example: 'STAFF' },
          { field: 'targetId', label: 'Beneficiary Name/Email/Code', example: 'babatundediekolayomi@gmail.com' },
          { field: 'bankName', label: 'Bank Name', example: 'Guaranty Trust Bank' },
          { field: 'accountNumber', label: '10-Digit Account Number', example: '0123456789' },
          { field: 'accountName', label: 'Verified Beneficiary Account Name', example: 'Babatunde Diekolayomi' },
        ],
        conversational_prompt: `To register this bank account, please ask the GMD for:\n` +
          missing.map((m, i) => `${i + 1}. **${m}**`).join('\n'),
      },
      { status: 400 }
    );
  }

  const matchedBank = matchBank(rawBankName);
  const canonicalBankName = matchedBank?.name || rawBankName;

  // 1. Handle STAFF
  if (targetType === 'STAFF') {
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: targetQuery },
          { employeeNumber: targetQuery },
          { workEmail: { equals: targetQuery, mode: 'insensitive' } },
          { legalName: { contains: targetQuery, mode: 'insensitive' } },
        ],
      },
    });

    if (!employee) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Staff "${targetQuery}" not found.` },
        { status: 404 }
      );
    }

    const resolvedAccountName = accountName || employee.legalName;
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'bank_account_update',
      summary: `Update staff bank account for ${employee.legalName} (${employee.employeeNumber}) to ${canonicalBankName} · ${accountNumber}`,
      materialPayload: {
        targetType: 'STAFF',
        targetRecordId: employee.id,
        bankName: canonicalBankName,
        accountNumber,
        accountName: resolvedAccountName,
      },
      preview: {
        targetType: 'STAFF',
        staffName: employee.legalName,
        employeeNumber: employee.employeeNumber,
        bankName: canonicalBankName,
        accountNumber,
        accountName: resolvedAccountName,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      targetType: 'STAFF',
      message: `Staff bank account update for "${employee.legalName}" has been staged. Click the confirmation button to commit.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // 2. Handle SUBSIDIARY (CompanyBankAccount)
  if (targetType === 'SUBSIDIARY' || targetType === 'COMPANY' || targetType === 'ORGANIZATION') {
    const exactOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: targetQuery },
          { code: { equals: targetQuery, mode: 'insensitive' } },
          { legalName: { equals: targetQuery, mode: 'insensitive' } },
        ],
      },
    });
    let org = exactOrg;
    if (!org) {
      const partial = await prisma.organization.findMany({
        where: {
          OR: [
            { legalName: { contains: targetQuery, mode: 'insensitive' } },
            { code: { contains: targetQuery, mode: 'insensitive' } },
          ],
        },
      });
      if (partial.length === 1) org = partial[0];
      else if (partial.length > 1) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'AMBIGUOUS_SUBSIDIARY',
            message: `Multiple subsidiaries matched "${targetQuery}": ${partial.map((o) => o.legalName).join(', ')}.`,
          },
          { status: 400 }
        );
      }
    }

    if (!org) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Subsidiary "${targetQuery}" not found.` },
        { status: 404 }
      );
    }

    const existingAcct = await prisma.companyBankAccount.findUnique({
      where: { accountNumber },
      include: { organization: true },
    });
    if (existingAcct && existingAcct.organizationId !== org.id) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'ORG_OWNERSHIP_CONFLICT',
          message: `Account ${accountNumber} is already registered to ${existingAcct.organization.legalName} and cannot be moved to ${org.legalName}.`,
        },
        { status: 409 }
      );
    }

    const requestedMode = String(body.mode || (existingAcct ? 'update_metadata' : 'register')).toLowerCase().trim();
    const resolvedAccountName = accountName || org.legalName;
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'bank_account_update',
      targetSubsidiaryId: org.id,
      summary:
        requestedMode === 'update_metadata'
          ? `Update corporate treasury account metadata for ${org.legalName}: ${canonicalBankName} · ${accountNumber}`
          : `Register corporate treasury account for ${org.legalName}: ${canonicalBankName} · ${accountNumber}`,
      materialPayload: {
        targetType: 'SUBSIDIARY',
        mode: requestedMode,
        targetRecordId: org.id,
        accountId: existingAcct?.id || null,
        bankName: canonicalBankName,
        accountNumber,
        accountName: resolvedAccountName,
        accountType,
        expectedBalance: existingAcct ? Number(existingAcct.balance) : null,
      },
      preview: {
        targetType: 'SUBSIDIARY',
        mode: requestedMode,
        subsidiary: org.legalName,
        bankName: canonicalBankName,
        accountNumber,
        accountName: resolvedAccountName,
        accountType,
        preservedBalance: existingAcct ? `₦${Number(existingAcct.balance).toLocaleString()}` : undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      targetType: 'SUBSIDIARY',
      message: `Corporate bank account registration for "${org.legalName}" has been staged. Click the confirmation button to commit.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // 3. Handle VENDOR
  if (targetType === 'VENDOR') {
    const vendor = await prisma.vendor.findFirst({
      where: {
        OR: [
          { id: targetQuery },
          { code: targetQuery.toUpperCase() },
          { name: { contains: targetQuery, mode: 'insensitive' } },
        ],
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Vendor "${targetQuery}" not found.` },
        { status: 404 }
      );
    }

    const resolvedAccountName = accountName || vendor.name;
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'bank_account_update',
      summary: `Update vendor bank account for ${vendor.name} (${vendor.code}) to ${canonicalBankName} · ${accountNumber}`,
      materialPayload: {
        targetType: 'VENDOR',
        targetRecordId: vendor.id,
        bankName: canonicalBankName,
        accountNumber,
        accountName: resolvedAccountName,
      },
      preview: {
        targetType: 'VENDOR',
        vendorName: vendor.name,
        vendorCode: vendor.code,
        bankName: canonicalBankName,
        accountNumber,
        accountName: resolvedAccountName,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      targetType: 'VENDOR',
      message: `Vendor bank account update for "${vendor.name}" has been staged. Click the confirmation button to commit.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_TYPE', message: 'targetType must be STAFF, SUBSIDIARY, or VENDOR.' },
    { status: 400 }
  );
}

