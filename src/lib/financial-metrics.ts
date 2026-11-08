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
  safeRunwayMonths: number | null;
  currencyTotals: Record<string, number>;
  pendingPipeline: number;
  monthlyBurn?: number | null;
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
    currency: 'NGN',
    approvalStatus: 'APPROVED',
    paymentStatus: { in: ['UNPAID', 'RECIPIENT_REPORTED_ISSUE'] },
  };

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  let disbWhere: any = {
    currency: 'NGN',
    paidAt: { gte: ninetyDaysAgo },
    status: { in: ['RECIPIENT_CONFIRMED', 'AWAITING_RECIPIENT_CONFIRMATION'] },
  };

  if (subsidiaryId && subsidiaryId !== 'ALL' && subsidiaryId !== 'BEMS-GROUP') {
    const { resolveOrganizationScope } = await import('@/lib/organizations');
    const scope = await resolveOrganizationScope(subsidiaryId);
    if (!scope.isGroup) {
      bankWhere.organizationId = { in: scope.organizationIds };
      reqWhere.subsidiaryId = { in: scope.organizationIds };
      disbWhere.payerOrgId = { in: scope.organizationIds };
    }
  }

  const [rawAccounts, approvedRequests, trailingDisbursements] = await Promise.all([
    prisma.companyBankAccount.findMany({
      where: bankWhere,
      include: { organization: true },
      orderBy: { balance: 'desc' },
    }),
    prisma.expenditureRequest.findMany({
      where: reqWhere,
      select: { amountMinor: true },
    }),
    prisma.disbursement.findMany({
      where: disbWhere,
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
      balanceNaira: a.currency === 'NGN' ? balNum : 0,
      dailyLimit: limitNum,
      status: a.status,
      scope: a.organization.code,
      subsidiaryName: a.organization?.legalName || 'BEMS Group Holdings',
      organizationId: a.organizationId,
    };
  });

  const currencyTotals = accounts.reduce<Record<string, number>>((totals, account) => { totals[account.currency] = (totals[account.currency] || 0) + account.balance; return totals; }, {});
  const totalCash = currencyTotals.NGN || 0;
  const pendingPipelineMinor = approvedRequests.reduce((acc, r) => acc + Number(r.amountMinor), 0);
  const pendingPipeline = pendingPipelineMinor / 100;

  const trailingDisbMinor = trailingDisbursements.reduce((acc, d) => acc + Number(d.amountMinor), 0);
  const trailingDisbNaira = trailingDisbMinor / 100;

  // A runway is unavailable when no recorded expense history supports a burn rate.
  const dynamicMonthlyBurn = trailingDisbNaira > 0 ? trailingDisbNaira / 3 : null;
  const safeRunwayMonths = dynamicMonthlyBurn ? Number((totalCash / dynamicMonthlyBurn).toFixed(1)) : null;

  return {
    accounts,
    totalCash,
    totalCashFormatted: formatNaira(totalCash) + ' (NGN accounts)',
    currencyTotals,
    safeRunwayMonths,
    pendingPipeline,
    monthlyBurn: dynamicMonthlyBurn,
  };
}

/**
 * Single Canonical Source of Truth for Corporate Budgets
 */
export async function getConsolidatedBudgets(organizationId?: string) {
  let budgetWhere: any = {};
  if (organizationId && organizationId !== 'ALL' && organizationId !== 'BEMS-GROUP') {
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
