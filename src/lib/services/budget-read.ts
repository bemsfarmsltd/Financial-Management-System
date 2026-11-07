import { prisma } from '@/lib/prisma';
import { getHrAuthorizationScope, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { clampPagination } from '@/lib/platform/read-catalog';

export interface QueryAuthorizedBudgetsParams {
  actor: {
    id: string;
    role: string;
    legalName?: string;
    workEmail?: string;
    scopedOrganizationId?: string | null;
  };
  organizationId?: string | null;
  period?: string | null;
  status?: string | null;
  limit?: number | string | null;
  offset?: number | string | null;
}

export async function queryAuthorizedBudgets(params: QueryAuthorizedBudgetsParams) {
  const { actor } = params;
  const isExecutive = hasAnyRole(actor as any, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
  const hrScope = await getHrAuthorizationScope(actor as any);

  if (!isExecutive && !hrScope.authorized) {
    return {
      authorized: false as const,
      error: 'Executive or authorized HR capability is required to view budgets.',
      scope: { isGroup: false, organizationIds: [] as string[] },
      pagination: { limit: 0, offset: 0 },
      budgets: [],
    };
  }

  const effectiveOrgFilter =
    params.organizationId ||
    actor.scopedOrganizationId ||
    'ALL';

  const orgScope = await resolveAuthorizedOrganizationScope(actor as any, effectiveOrgFilter);
  const permittedOrgIds = isExecutive
    ? orgScope.organizationIds
    : orgScope.organizationIds.filter((id) => hrScope.isGlobal || hrScope.subsidiaryIds.includes(id));

  const { limit, offset } = clampPagination(params.limit, params.offset, 50, 25);

  if (permittedOrgIds.length === 0) {
    return {
      authorized: true as const,
      scope: { isGroup: false, organizationIds: [] as string[] },
      pagination: { limit, offset },
      budgets: [],
    };
  }

  const whereClause: Record<string, any> = {
    organizationId: { in: permittedOrgIds },
  };
  if (params.status && params.status !== 'ALL') {
    whereClause.status = params.status;
  }
  if (params.period) {
    whereClause.periodName = { contains: params.period, mode: 'insensitive' };
  }

  const budgets = await prisma.budget.findMany({
    where: whereClause,
    include: {
      organization: { select: { id: true, legalName: true, code: true } },
      lines: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return {
    authorized: true as const,
    scope: {
      isGroup: orgScope.isGroup && (isExecutive || hrScope.isGlobal),
      organizationIds: permittedOrgIds,
    },
    pagination: { limit, offset },
    budgets,
  };
}

