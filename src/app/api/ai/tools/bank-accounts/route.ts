import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { matchBank } from '@/lib/bank-utils';

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

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        bankName: canonicalBankName,
        accountNumber,
        accountName: resolvedAccountName,
        // Also sync salary banking if empty
        salaryBankName: employee.salaryBankName || canonicalBankName,
        salaryAccountNumber: employee.salaryAccountNumber || accountNumber,
        salaryAccountName: employee.salaryAccountName || resolvedAccountName,
      },
      select: {
        id: true,
        legalName: true,
        employeeNumber: true,
        workEmail: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
      },
    });

    return NextResponse.json({
      ok: true,
      targetType: 'STAFF',
      message: `Bank account registered successfully for staff "${updated.legalName}".`,
      employee: {
        id: updated.id,
        name: updated.legalName,
        employeeNumber: updated.employeeNumber,
        bankName: updated.bankName,
        accountNumber: updated.accountNumber,
        accountName: updated.accountName,
      },
    });
  }

  // 2. Handle SUBSIDIARY (CompanyBankAccount)
  if (targetType === 'SUBSIDIARY' || targetType === 'COMPANY' || targetType === 'ORGANIZATION') {
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: targetQuery },
          { code: targetQuery.toUpperCase() },
          { legalName: { contains: targetQuery, mode: 'insensitive' } },
        ],
      },
    });

    if (!org) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Subsidiary "${targetQuery}" not found.` },
        { status: 404 }
      );
    }

    const resolvedAccountName = accountName || org.legalName;

    const bankAccount = await prisma.companyBankAccount.upsert({
      where: { accountNumber },
      update: {
        organizationId: org.id,
        bankName: canonicalBankName,
        accountName: resolvedAccountName,
        accountType,
      },
      create: {
        organizationId: org.id,
        bankName: canonicalBankName,
        accountName: resolvedAccountName,
        accountNumber,
        accountType,
        currency: org.defaultCurrency || 'NGN',
      },
    });

    return NextResponse.json({
      ok: true,
      targetType: 'SUBSIDIARY',
      message: `Corporate bank account registered successfully for subsidiary "${org.legalName}".`,
      account: {
        id: bankAccount.id,
        subsidiary: org.legalName,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        accountType: bankAccount.accountType,
        currency: bankAccount.currency,
      },
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

    const updatedVendor = await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        bankName: canonicalBankName,
        accountNumber,
        accountName: resolvedAccountName,
      },
    });

    return NextResponse.json({
      ok: true,
      targetType: 'VENDOR',
      message: `Bank account registered successfully for vendor "${updatedVendor.name}".`,
      vendor: {
        id: updatedVendor.id,
        name: updatedVendor.name,
        code: updatedVendor.code,
        bankName: updatedVendor.bankName,
        accountNumber: updatedVendor.accountNumber,
        accountName: updatedVendor.accountName,
      },
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_TYPE', message: 'targetType must be STAFF, SUBSIDIARY, or VENDOR.' },
    { status: 400 }
  );
}

