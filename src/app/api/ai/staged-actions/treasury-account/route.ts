import { hasGmdFeatureAccess } from '@/lib/gmd-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (actor && !hasGmdFeatureAccess(actor.role)) return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access requires GMD or an authorized Super Admin.'},{status:403});
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or Super Admin can stage corporate treasury accounts.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      account_id,
      bank_name,
      account_number,
      account_name,
      account_type,
      balance,
      daily_limit,
      subsidiary_id,
      subsidiary_name,
      organization_id,
      mode: rawMode,
      action: rawAction,
    } = body;

    const requestedMode = String(rawMode || rawAction || 'register').toLowerCase().trim();
    const validModes = ['register', 'update_metadata', 'correct_balance', 'deactivate'];
    const mode =
      requestedMode === 'delete' || requestedMode === 'archive'
        ? 'deactivate'
        : requestedMode === 'update'
        ? 'update_metadata'
        : validModes.includes(requestedMode)
        ? requestedMode
        : '';

    if (!mode) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'INVALID_MODE',
          message: `mode must be one of: ${validModes.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const cleanAccountNumber = String(account_number || '').replace(/\D/g, '');
    const existingAccount = account_id
      ? await prisma.companyBankAccount.findUnique({ where: { id: String(account_id) }, include: { organization: true } })
      : cleanAccountNumber.length === 10
      ? await prisma.companyBankAccount.findUnique({ where: { accountNumber: cleanAccountNumber }, include: { organization: true } })
      : null;

    if (mode === 'deactivate') {
      if (!existingAccount) {
        return NextResponse.json(
          { ok: false, error_code: 'ACCOUNT_NOT_FOUND', message: 'Target company bank account to deactivate was not found.' },
          { status: 404 }
        );
      }
      if (existingAccount.status === 'INACTIVE') {
        return NextResponse.json(
          { ok: false, error_code: 'ACCOUNT_ALREADY_INACTIVE', message: `Account ${existingAccount.accountNumber} is already inactive.` },
          { status: 409 }
        );
      }

      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'treasury_account',
        targetSubsidiaryId: existingAccount.organizationId,
        materialPayload: {
          mode: 'deactivate',
          account_id: existingAccount.id,
          account_number: existingAccount.accountNumber,
          bank_name: existingAccount.bankName,
          account_name: existingAccount.accountName,
          subsidiary_id: existingAccount.organizationId,
          subsidiary_name: existingAccount.organization.legalName,
          expected_balance: Number(existingAccount.balance),
        },
        summary: `Deactivate corporate account: ${existingAccount.bankName} (${existingAccount.accountNumber}) for ${existingAccount.organization.legalName}`,
        preview: {
          mode: 'deactivate',
          account_id: existingAccount.id,
          bank_name: existingAccount.bankName,
          account_number: existingAccount.accountNumber,
          account_name: existingAccount.accountName,
          current_balance: `₦${Number(existingAccount.balance).toLocaleString()}`,
          assigned_subsidiary: existingAccount.organization.legalName,
        },
      });
      return NextResponse.json(staged);
    }

    // Resolve exact target organization (never default to HQ or first org)
    const orgQuery = String(organization_id || subsidiary_id || subsidiary_name || existingAccount?.organizationId || '').trim();
    if (!orgQuery || orgQuery.toUpperCase() === 'ALL') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'SUBSIDIARY_REQUIRED',
          message: 'An explicit subsidiary_id or subsidiary_name is required for corporate treasury operations.',
        },
        { status: 400 }
      );
    }

    let org = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: orgQuery },
          { code: { equals: orgQuery, mode: 'insensitive' } },
          { legalName: { equals: orgQuery, mode: 'insensitive' } },
        ],
      },
    });
    if (!org) {
      const partial = await prisma.organization.findMany({
        where: {
          OR: [
            { legalName: { contains: orgQuery, mode: 'insensitive' } },
            { code: { contains: orgQuery, mode: 'insensitive' } },
          ],
        },
      });
      if (partial.length === 1) org = partial[0];
      else if (partial.length > 1) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'AMBIGUOUS_SUBSIDIARY',
            message: `Multiple subsidiaries matched "${orgQuery}": ${partial.map((o) => o.legalName).join(', ')}.`,
          },
          { status: 400 }
        );
      }
    }

    if (!org) {
      return NextResponse.json(
        { ok: false, error_code: 'SUBSIDIARY_NOT_FOUND', message: `Subsidiary "${orgQuery}" was not found.` },
        { status: 404 }
      );
    }

    if (!cleanAccountNumber || cleanAccountNumber.length !== 10) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'A valid 10-digit NUBAN account_number is required.' },
        { status: 400 }
      );
    }

    if (existingAccount && existingAccount.organizationId !== org.id) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'ORG_OWNERSHIP_CONFLICT',
          message: `Account ${cleanAccountNumber} is already registered to ${existingAccount.organization.legalName} and cannot be moved to ${org.legalName}.`,
        },
        { status: 409 }
      );
    }

    if (mode === 'register') {
      if (!bank_name || !String(bank_name).trim()) {
        return NextResponse.json(
          { ok: false, error_code: 'VALIDATION_FAILED', message: 'bank_name is required to register a corporate bank account.' },
          { status: 400 }
        );
      }
      if (!account_name || !String(account_name).trim()) {
        return NextResponse.json(
          { ok: false, error_code: 'VALIDATION_FAILED', message: 'account_name is required to register a corporate bank account.' },
          { status: 400 }
        );
      }
      if (existingAccount && existingAccount.status === 'ACTIVE') {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'ACCOUNT_ALREADY_EXISTS',
            message: `Corporate account ${cleanAccountNumber} is already active under ${existingAccount.organization.legalName}. Stage update_metadata or correct_balance instead.`,
          },
          { status: 409 }
        );
      }
    } else if (mode === 'update_metadata' || mode === 'correct_balance') {
      if (!existingAccount) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'ACCOUNT_NOT_FOUND',
            message: `Account ${cleanAccountNumber} was not found for ${mode}.`,
          },
          { status: 404 }
        );
      }
      if (mode === 'correct_balance' && (balance === undefined || balance === null || isNaN(Number(balance)) || Number(balance) < 0)) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'INVALID_BALANCE',
            message: 'A valid non-negative balance is required for correct_balance.',
          },
          { status: 400 }
        );
      }
    }

    const effectiveBankName = String(bank_name || existingAccount?.bankName || '').trim();
    const effectiveAccountName = String(account_name || existingAccount?.accountName || '').trim();
    const effectiveBalance =
      mode === 'update_metadata'
        ? Number(existingAccount!.balance)
        : balance !== undefined && balance !== null
        ? Number(balance)
        : Number(existingAccount?.balance || 0);

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'treasury_account',
      targetSubsidiaryId: org.id,
      materialPayload: {
        mode,
        account_id: existingAccount?.id || null,
        bank_name: effectiveBankName,
        account_number: cleanAccountNumber,
        account_name: effectiveAccountName,
        account_type: account_type || existingAccount?.accountType || 'Corporate Operational',
        balance: effectiveBalance,
        daily_limit: daily_limit !== undefined ? Number(daily_limit) : Number(existingAccount?.dailyLimit || 25000000),
        subsidiary_id: org.id,
        subsidiary_name: org.legalName,
        expected_balance: existingAccount ? Number(existingAccount.balance) : null,
      },
      summary:
        mode === 'register'
          ? `Register new corporate account: ${effectiveBankName} (${cleanAccountNumber}) for ${org.legalName}`
          : mode === 'correct_balance'
          ? `Correct treasury balance for ${effectiveBankName} (${cleanAccountNumber}) to ₦${effectiveBalance.toLocaleString()}`
          : `Update corporate account metadata: ${effectiveBankName} (${cleanAccountNumber}) for ${org.legalName}`,
      preview: {
        mode,
        account_id: existingAccount?.id || null,
        bank_name: effectiveBankName,
        account_number: cleanAccountNumber,
        account_name: effectiveAccountName,
        previous_balance: existingAccount ? `₦${Number(existingAccount.balance).toLocaleString()}` : null,
        opening_balance: `₦${effectiveBalance.toLocaleString()}`,
        assigned_subsidiary: org.legalName,
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
