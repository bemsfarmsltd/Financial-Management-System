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

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to configure treasury accounts.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only The Group Managing Director or Super admin can add company bank accounts.' }, { status: 403 });
    }

    const body = await req.json();
    const {
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

    if (!bankName || !bankName.trim()) {
      return NextResponse.json({ error: 'Bank name is required.' }, { status: 400 });
    }
    if (!accountName || !accountName.trim()) {
      return NextResponse.json({ error: 'Account title / name is required.' }, { status: 400 });
    }
    if (!accountNumber || !accountNumber.trim()) {
      return NextResponse.json({ error: '10-digit NUBAN account number is required.' }, { status: 400 });
    }

    // Resolve target Organization
    let targetOrgId = organizationId;
    if (!targetOrgId && assignedSubsidiary) {
      const org = await prisma.organization.findFirst({
        where: {
          OR: [
            { legalName: { contains: assignedSubsidiary, mode: 'insensitive' } },
            { code: { contains: assignedSubsidiary, mode: 'insensitive' } }
          ]
        }
      });
      if (org) targetOrgId = org.id;
    }

    if (!targetOrgId) {
      const defaultOrg = await prisma.organization.findFirst({ where: { type: 'GROUP' } });
      targetOrgId = defaultOrg?.id;
    }

    if (!targetOrgId) {
      return NextResponse.json({ error: 'Valid company organization is required.' }, { status: 400 });
    }

    const created = await prisma.companyBankAccount.upsert({
      where: { accountNumber: accountNumber.trim() },
      create: {
        organizationId: targetOrgId,
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        accountType: accountType || 'Corporate Operational',
        currency: currency || 'NGN',
        balance: Number(balance) || 0,
        dailyLimit: Number(dailyLimit) || 25000000,
        tier: 'Primary Maker-Checker',
        status: 'ACTIVE',
      },
      update: {
        organizationId: targetOrgId,
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountType: accountType || 'Corporate Operational',
        balance: Number(balance) || 0,
        dailyLimit: Number(dailyLimit) || 25000000,
        status: 'ACTIVE',
      },
      include: { organization: true }
    });

    const balNum = Number(created.balance);
    const limNum = Number(created.dailyLimit);

    return NextResponse.json({
      message: 'Bank account saved successfully to PostgreSQL.',
      account: {
        id: created.id,
        bankName: created.bankName,
        accountName: created.accountName,
        accountNumber: created.accountNumber,
        accountType: created.accountType,
        currency: created.currency,
        balance: balNum,
        dailyLimit: limNum,
        assignedSubsidiary: created.organization.legalName,
        tier: created.tier,
        status: 'Active',
        balanceFormatted: formatNaira(balNum),
        dailyLimitFormatted: formatNaira(limNum),
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: error.message || 'Failed to save bank account' }, { status: 500 });
  }
}
