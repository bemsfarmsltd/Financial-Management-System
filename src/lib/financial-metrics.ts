import { prisma } from '@/lib/prisma';

export interface TreasuryAccountDTO {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  balance: number;
  balanceNaira: number;
  dailyLimit: number;
  status: string;
  scope: string;
  subsidiaryName: string;
  organizationId: string;
}

export interface ConsolidatedTreasury {
  accounts: TreasuryAccountDTO[];
  totalCash: number;
  totalCashFormatted: string;
  safeRunwayMonths: number;
  pendingPipeline: number;
}

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Single Canonical Source of Truth for Company Bank Balances
 */
export async function getConsolidatedTreasury(subsidiaryId?: string): Promise<ConsolidatedTreasury> {
  let bankWhere: any = { status: 'ACTIVE' };
  let reqWhere: any = {
    approvalStatus: 'APPROVED',
    paymentStatus: { in: ['UNPAID', 'RECIPIENT_REPORTED_ISSUE'] },
  };

  if (subsidiaryId && subsidiaryId !== 'ALL' && subsidiaryId !== 'bems-group-hq') {
    const { resolveOrganizationScope } = await import('@/lib/organizations');
    const scope = await resolveOrganizationScope(subsidiaryId);
    if (!scope.isGroup) {
      bankWhere.organizationId = { in: scope.organizationIds };
      reqWhere.subsidiaryId = { in: scope.organizationIds };
    }
  }

  const [rawAccounts, approvedRequests] = await Promise.all([
    prisma.companyBankAccount.findMany({
      where: bankWhere,
      include: { organization: true },
      orderBy: { balance: 'desc' },
    }),
    prisma.expenditureRequest.findMany({
      where: reqWhere,
      select: { amountMinor: true },
    }),
  ]);

  const accounts: TreasuryAccountDTO[] = rawAccounts.map((a) => {
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
      status: a.status,
      scope: (a.organization?.code === 'BEMS-LOG' ? 'LOG' : a.organization?.code === 'BEMS-SOFT' ? 'SOFT' : 'HQ'),
      subsidiaryName: a.organization?.legalName || 'BEMS Group Holdings',
      organizationId: a.organizationId,
    };
  });

  const totalCash = accounts.reduce((acc, a) => acc + a.balance, 0);
  const pendingPipelineMinor = approvedRequests.reduce((acc, r) => acc + Number(r.amountMinor), 0);
  const pendingPipeline = pendingPipelineMinor / 100;

  // Monthly burn rate based on active operational budgets (~₦30M/mo across group)
  const estimatedMonthlyBurn = 30000000;
  const safeRunwayMonths = estimatedMonthlyBurn > 0 ? Number((totalCash / estimatedMonthlyBurn).toFixed(1)) : 0;

  return {
    accounts,
    totalCash,
    totalCashFormatted: formatNaira(totalCash),
    safeRunwayMonths,
    pendingPipeline,
  };
}

/**
 * Single Canonical Source of Truth for Corporate Budgets
 */
export async function getConsolidatedBudgets(organizationId?: string) {
  let budgetWhere: any = {};
  if (organizationId && organizationId !== 'ALL' && organizationId !== 'bems-group-hq') {
    const { resolveOrganizationScope } = await import('@/lib/organizations');
    const scope = await resolveOrganizationScope(organizationId);
    if (!scope.isGroup) {
      budgetWhere.organizationId = { in: scope.organizationIds };
    }
  }

  const budgets = await prisma.budget.findMany({
    where: budgetWhere,
    include: {
      organization: true,
      lines: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalAllocated = budgets.reduce((acc, b) => acc + Number(b.totalAmount), 0);
  const totalCommitted = budgets.reduce((acc, b) => acc + Number(b.committedAmount), 0);
  const totalSpent = budgets.reduce((acc, b) => acc + Number(b.spentAmount), 0);
  const percentSpent = totalAllocated > 0 ? Number(((totalSpent / totalAllocated) * 100).toFixed(1)) : 0;

  return {
    budgets,
    totalAllocated,
    totalCommitted,
    totalSpent,
    percentSpent,
    totalAllocatedFormatted: formatNaira(totalAllocated),
    totalSpentFormatted: formatNaira(totalSpent),
  };
}
