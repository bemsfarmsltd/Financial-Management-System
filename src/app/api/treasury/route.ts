import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { enforceMobileVersionGate } from '@/lib/mobile-gate';

export const dynamic = 'force-dynamic';

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
}

export async function GET(req: NextRequest) {
  try {
    const gateBlock = await enforceMobileVersionGate(req);
    if (gateBlock) return gateBlock;

    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view treasury information.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive or Super admin access is required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const subsidiary = searchParams.get('subsidiary') || searchParams.get('organization_id');

    let reqWhere: any = { approvalStatus: 'APPROVED', paymentStatus: { in: ['UNPAID', 'RECIPIENT_REPORTED_ISSUE'] } };
    let disbWhere: any = { status: 'RECIPIENT_CONFIRMED' };
    let bankWhere: any = { status: 'ACTIVE' };

    if (subsidiary && subsidiary !== 'ALL') {
      const { resolveOrganizationScope } = await import('@/lib/organizations');
      const scope = await resolveOrganizationScope(subsidiary);
      if (!scope.isGroup) {
        reqWhere.subsidiaryId = { in: scope.organizationIds };
        disbWhere.request = { subsidiaryId: { in: scope.organizationIds } };
        bankWhere.organizationId = { in: scope.organizationIds };
      }
    }

    // 1. Fetch live Bank Accounts directly from PostgreSQL
    const dbAccounts = await prisma.companyBankAccount.findMany({
      where: bankWhere,
      include: { organization: true },
      orderBy: { balance: 'desc' }
    });

    // 2. Calculate pending payout from DB
    const approvedRequests = await prisma.expenditureRequest.findMany({
      where: reqWhere,
      select: { amountMinor: true }
    });
    const pendingPipelineMinor = approvedRequests.reduce((acc, r) => acc + Number(r.amountMinor), 0);
    const pendingPipeline = pendingPipelineMinor / 100;

    // 3. Disbursed in last 30 days
    const disbursed = await prisma.disbursement.findMany({
      where: disbWhere,
      select: { amountMinor: true }
    });
    const disbursedMinor = disbursed.reduce((acc, d) => acc + Number(d.amountMinor), 0);
    const mtdOutflow = disbursedMinor / 100;

    const accounts = dbAccounts.map((a) => {
      const balNum = Number(a.balance);
      const limitNum = Number(a.dailyLimit);
      return {
        id: a.id,
        bankName: a.bankName,
        accountName: a.accountName,
        accountNumber: a.accountNumber,
        accountType: a.accountType,
        currency: a.currency,
        balance: balNum,
        balanceNaira: balNum,
        dailyLimit: limitNum,
        assignedSubsidiary: a.organization?.legalName || 'BEMS Group',
        tier: a.tier,
        status: a.status === 'ACTIVE' ? 'Active' : a.status,
        createdAt: a.createdAt.toISOString(),
        balanceFormatted: formatNaira(balNum),
        dailyLimitFormatted: formatNaira(limitNum),
        organization: {
          id: a.organization.id,
          legalName: a.organization.legalName,
          code: a.organization.code,
        }
      };
    });

    const totalLiquidReserves = accounts.reduce((acc: number, a: any) => acc + a.balance, 0);
    const uncommittedReserves = Math.max(0, totalLiquidReserves - pendingPipeline);
    const runwayMonths = totalLiquidReserves > 0 && mtdOutflow > 0 ? (totalLiquidReserves / mtdOutflow).toFixed(1) : (totalLiquidReserves > 0 ? '12.0' : '0.0');

    return NextResponse.json({
      accounts,
      summary: {
        totalLiquidReserves,
        totalLiquidReservesFormatted: formatNaira(totalLiquidReserves),
        uncommittedReservesFormatted: formatNaira(uncommittedReserves),
        pendingPipelineFormatted: formatNaira(pendingPipeline),
        mtdOutflowFormatted: formatNaira(mtdOutflow),
        runwayMonths: `${runwayMonths} Months`,
        liquidityHealth: accounts.length === 0 ? 'Awaiting Account Setup' : 'Active Registry'
      }
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
    });
  } catch (error: any) {
    console.error('Error in treasury API:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch treasury data' }, { status: 500 });
  }
}

async function resolveExactTreasuryOrganization(organizationId?: string, assignedSubsidiary?: string) {
  const query = String(organizationId || assignedSubsidiary || '').trim();
  if (!query || query.toUpperCase() === 'ALL') {
    return { org: null, error: 'An explicit organizationId or assignedSubsidiary is required.' };
  }

  const exactMatch = await prisma.organization.findFirst({
    where: {
      OR: [
        { id: query },
        { code: { equals: query, mode: 'insensitive' } },
        { legalName: { equals: query, mode: 'insensitive' } },
      ],
    },
  });
  if (exactMatch) return { org: exactMatch, error: null };

  const partialMatches = await prisma.organization.findMany({
    where: {
      OR: [
        { legalName: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ],
    },
  });
  if (partialMatches.length === 1) {
    return { org: partialMatches[0], error: null };
  }
  if (partialMatches.length > 1) {
    return {
      org: null,
      error: `Ambiguous subsidiary "${query}" matched multiple entities (${partialMatches.map((o) => o.legalName).join(', ')}). Specify the exact organization.`,
    };
  }
  return { org: null, error: `Organization "${query}" was not found.` };
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to configure treasury accounts.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only The Group Managing Director or Super admin can manage company bank accounts.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id: accountId,
      mode: rawMode,
      bankName,
      accountName,
      accountNumber,
      accountType,
      currency,
      balance,
      dailyLimit,
      assignedSubsidiary,
      organizationId,
    } = body;

    const mode = String(rawMode || 'register').toLowerCase().trim();
    const cleanAccountNumber = String(accountNumber || '').replace(/\D/g, '');

    if (mode === 'deactivate' || mode === 'delete') {
      const existing = accountId
        ? await prisma.companyBankAccount.findUnique({ where: { id: String(accountId) }, include: { organization: true } })
        : cleanAccountNumber
        ? await prisma.companyBankAccount.findUnique({ where: { accountNumber: cleanAccountNumber }, include: { organization: true } })
        : null;

      if (!existing) {
        return NextResponse.json({ error: 'Target company bank account was not found.' }, { status: 404 });
      }

      const deactivated = await prisma.companyBankAccount.update({
        where: { id: existing.id },
        data: { status: 'INACTIVE' },
        include: { organization: true },
      });

      await prisma.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: deactivated.organization.parentGroupId || deactivated.organizationId,
          subsidiaryId: deactivated.organizationId,
          targetType: 'COMPANY_BANK_ACCOUNT',
          targetId: deactivated.id,
          action: 'TREASURY_ACCOUNT_DEACTIVATED',
          correlationId: `TREASURY-DEACTIVATE-${deactivated.id}`,
          metadata: JSON.stringify({
            accountNumber: deactivated.accountNumber,
            bankName: deactivated.bankName,
          }),
        },
      });

      return NextResponse.json({
        message: 'Bank account deactivated.',
        account: { id: deactivated.id, accountNumber: deactivated.accountNumber, status: 'INACTIVE' },
      });
    }

    const { org: targetOrg, error: orgError } = await resolveExactTreasuryOrganization(organizationId, assignedSubsidiary);
    if (!targetOrg) {
      return NextResponse.json({ error: orgError || 'Valid company organization is required.' }, { status: 400 });
    }

    if (!cleanAccountNumber || cleanAccountNumber.length !== 10) {
      return NextResponse.json({ error: 'A valid 10-digit NUBAN account number is required.' }, { status: 400 });
    }

    const existing = accountId
      ? await prisma.companyBankAccount.findUnique({ where: { id: String(accountId) }, include: { organization: true } })
      : await prisma.companyBankAccount.findUnique({ where: { accountNumber: cleanAccountNumber }, include: { organization: true } });

    if (existing && existing.organizationId !== targetOrg.id) {
      return NextResponse.json(
        {
          error: `Account ${cleanAccountNumber} is already registered under ${existing.organization.legalName} and cannot be reassigned to ${targetOrg.legalName}.`,
        },
        { status: 409 }
      );
    }

    let saved: any;
    if (mode === 'update_metadata') {
      if (!existing) {
        return NextResponse.json({ error: `Account ${cleanAccountNumber} was not found for metadata update.` }, { status: 404 });
      }
      saved = await prisma.companyBankAccount.update({
        where: { id: existing.id },
        data: {
          bankName: bankName?.trim() || existing.bankName,
          accountName: accountName?.trim() || existing.accountName,
          accountType: accountType?.trim() || existing.accountType,
          dailyLimit: dailyLimit !== undefined && dailyLimit !== null ? Number(dailyLimit) : existing.dailyLimit,
          // Strictly preserve existing balance on metadata update
        },
        include: { organization: true },
      });
    } else if (mode === 'correct_balance') {
      if (!existing) {
        return NextResponse.json({ error: `Account ${cleanAccountNumber} was not found for balance correction.` }, { status: 404 });
      }
      if (balance === undefined || balance === null || isNaN(Number(balance)) || Number(balance) < 0) {
        return NextResponse.json({ error: 'A valid non-negative balance is required for balance correction.' }, { status: 400 });
      }
      saved = await prisma.companyBankAccount.update({
        where: { id: existing.id },
        data: {
          balance: Number(balance),
          ...(bankName?.trim() ? { bankName: bankName.trim() } : {}),
          ...(accountName?.trim() ? { accountName: accountName.trim() } : {}),
        },
        include: { organization: true },
      });
    } else if (mode === 'register') {
      if (!bankName || !bankName.trim()) {
        return NextResponse.json({ error: 'Bank name is required.' }, { status: 400 });
      }
      if (!accountName || !accountName.trim()) {
        return NextResponse.json({ error: 'Account title / name is required.' }, { status: 400 });
      }
      if (existing && existing.status === 'ACTIVE') {
        return NextResponse.json(
          {
            error: `Active account ${cleanAccountNumber} (${existing.bankName}) is already registered for ${existing.organization.legalName}. Use metadata update or balance correction instead.`,
          },
          { status: 409 }
        );
      }

      const initialBalance =
        balance !== undefined && balance !== null && !isNaN(Number(balance))
          ? Number(balance)
          : existing
          ? Number(existing.balance)
          : 0;

      saved = existing
        ? await prisma.companyBankAccount.update({
            where: { id: existing.id },
            data: {
              bankName: bankName.trim(),
              accountName: accountName.trim(),
              accountType: accountType || existing.accountType || 'Corporate Operational',
              currency: currency || existing.currency || 'NGN',
              balance: initialBalance,
              dailyLimit: Number(dailyLimit) || Number(existing.dailyLimit) || 25000000,
              status: 'ACTIVE',
            },
            include: { organization: true },
          })
        : await prisma.companyBankAccount.create({
            data: {
              organizationId: targetOrg.id,
              bankName: bankName.trim(),
              accountName: accountName.trim(),
              accountNumber: cleanAccountNumber,
              accountType: accountType || 'Corporate Operational',
              currency: currency || 'NGN',
              balance: initialBalance,
              dailyLimit: Number(dailyLimit) || 25000000,
              tier: 'Primary Maker-Checker',
              status: 'ACTIVE',
            },
            include: { organization: true },
          });
    } else {
      return NextResponse.json({ error: `Unsupported treasury mode "${mode}".` }, { status: 400 });
    }

    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: saved.organization?.parentGroupId || saved.organizationId,
        subsidiaryId: saved.organizationId,
        targetType: 'COMPANY_BANK_ACCOUNT',
        targetId: saved.id,
        action: `TREASURY_${mode.toUpperCase()}`,
        correlationId: `TREASURY-${mode.toUpperCase()}-${saved.id}`,
        metadata: JSON.stringify({
          mode,
          bankName: saved.bankName,
          accountNumber: saved.accountNumber,
          balance: Number(saved.balance),
        }),
      },
    });

    const balNum = Number(saved.balance);
    const limNum = Number(saved.dailyLimit);

    return NextResponse.json({
      message: 'Bank account saved successfully to PostgreSQL.',
      account: {
        id: saved.id,
        bankName: saved.bankName,
        accountName: saved.accountName,
        accountNumber: saved.accountNumber,
        accountType: saved.accountType,
        currency: saved.currency,
        balance: balNum,
        dailyLimit: limNum,
        assignedSubsidiary: saved.organization.legalName,
        tier: saved.tier,
        status: saved.status === 'ACTIVE' ? 'Active' : saved.status,
        balanceFormatted: formatNaira(balNum),
        dailyLimitFormatted: formatNaira(limNum),
      }
    }, { status: mode === 'register' ? 201 : 200 });
  } catch (error: any) {
    console.error('Error saving bank account:', error);
    return NextResponse.json({ error: error.message || 'Failed to save bank account' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return POST(req);
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to configure treasury accounts.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only The Group Managing Director or Super admin can deactivate company bank accounts.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const accountNumber = searchParams.get('accountNumber');

    if (!id && !accountNumber) {
      return NextResponse.json({ error: 'Account id or accountNumber is required to deactivate an account.' }, { status: 400 });
    }

    const existing = id
      ? await prisma.companyBankAccount.findUnique({ where: { id } })
      : await prisma.companyBankAccount.findUnique({ where: { accountNumber: String(accountNumber).trim() } });

    if (!existing) {
      return NextResponse.json({ error: 'Company bank account not found.' }, { status: 404 });
    }

    const updated = await prisma.companyBankAccount.update({
      where: { id: existing.id },
      data: { status: 'INACTIVE' },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: updated.organizationId,
        subsidiaryId: updated.organizationId,
        targetType: 'COMPANY_BANK_ACCOUNT',
        targetId: updated.id,
        action: 'TREASURY_ACCOUNT_DEACTIVATED',
        correlationId: `TREASURY-DELETE-${updated.id}`,
        metadata: JSON.stringify({
          accountNumber: updated.accountNumber,
          bankName: updated.bankName,
          preservedBalance: Number(updated.balance),
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Company bank account deactivated.',
      account: {
        id: updated.id,
        accountNumber: updated.accountNumber,
        status: updated.status,
      },
    });
  } catch (error: any) {
    console.error('Error deactivating treasury account:', error);
    return NextResponse.json({ error: error.message || 'Failed to deactivate bank account' }, { status: 500 });
  }
}
