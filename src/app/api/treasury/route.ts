import { executeDashboardCommand } from '@/lib/staged-actions';
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
      const { resolveAuthorizedOrganizationScope } = await import('@/lib/organizations');
      const scope = await resolveAuthorizedOrganizationScope(actor, subsidiary);
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

async function mutateTreasury(req: NextRequest, deleting = false) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to manage treasury.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive access required.' }, { status: 403 });
    const body = deleting ? Object.fromEntries(new URL(req.url).searchParams) : await req.json();
    const number = String(body.accountNumber || '').replace(/\D/g, '');
    const existing = body.id ? await prisma.companyBankAccount.findUnique({ where: { id: String(body.id) } }) : number ? await prisma.companyBankAccount.findUnique({ where: { accountNumber: number } }) : null;
    const mode = deleting ? 'deactivate' : String(body.mode || 'register').toLowerCase();
    const resolved = await resolveExactTreasuryOrganization(body.organizationId || existing?.organizationId, body.assignedSubsidiary);
    if (!resolved.org && !['deactivate', 'delete'].includes(mode)) return NextResponse.json({ error: resolved.error }, { status: 400 });
    if (body.currency && resolved.org?.defaultCurrency && body.currency !== resolved.org.defaultCurrency) return NextResponse.json({ error: 'Account currency must match its organization.' }, { status: 400 });
    const account = await executeDashboardCommand(actor, 'treasury_account', {
      mode, account_id: existing?.id || body.id, subsidiary_id: resolved.org?.id,
      account_number: number || existing?.accountNumber, bank_name: body.bankName || existing?.bankName,
      account_name: body.accountName || existing?.accountName, account_type: body.accountType,
      balance: body.balance, daily_limit: body.dailyLimit, expected_balance: existing ? Number(existing.balance) : undefined,
    });
    return NextResponse.json({ ok: true, message: 'Treasury account saved.', account: { ...account, assignedSubsidiary: resolved.org?.legalName, balanceFormatted: formatNaira(Number(account.balance || 0)), dailyLimitFormatted: formatNaira(Number(account.dailyLimit || 0)) } }, { status: mode === 'register' ? 201 : 200 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
export async function POST(req: NextRequest) { return mutateTreasury(req); }
export async function PATCH(req: NextRequest) { return mutateTreasury(req); }
export async function DELETE(req: NextRequest) { return mutateTreasury(req, true); }
