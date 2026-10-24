import { prisma } from '@/lib/prisma';

export interface ScopeInfo {
  isGroup: boolean;
  organizationIds: string[];
}

export class OrganizationScopeResult extends Array<string> implements ScopeInfo {
  isGroup: boolean;
  organizationIds: string[];

  constructor(isGroup: boolean, ids: string[]) {
    super(...ids);
    this.isGroup = isGroup;
    this.organizationIds = ids;
    Object.setPrototypeOf(this, OrganizationScopeResult.prototype);
  }
}

/**
 * Resolves an organization identifier (ID or Code) into an OrganizationScopeResult
 * that is backwards and forwards compatible:
 * 1. Has `.isGroup` (boolean)
 * 2. Has `.organizationIds` (string[])
 * 3. Can be treated directly as a `string[]` (e.g. `scope.length`, Prisma `in: scope`)
 */
export async function resolveOrganizationScope(orgIdentifier?: string | null): Promise<OrganizationScopeResult> {
  if (!orgIdentifier || orgIdentifier === 'ALL' || orgIdentifier === 'all' || orgIdentifier === 'bems-group-hq') {
    try {
      const allOrgs = await prisma.organization.findMany({ select: { id: true } });
      const ids = allOrgs.map((o) => o.id);
      return new OrganizationScopeResult(true, ids);
    } catch {
      return new OrganizationScopeResult(true, []);
    }
  }

  try {
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: orgIdentifier },
          { code: orgIdentifier },
        ],
      },
      select: {
        id: true,
        type: true,
        code: true,
      },
    });

    if (!org) {
      return new OrganizationScopeResult(false, [orgIdentifier]);
    }

    if (org.type === 'GROUP') {
      const childSubsidiaries = await prisma.organization.findMany({
        where: { parentGroupId: org.id },
        select: { id: true },
      });
      const ids = [org.id, ...childSubsidiaries.map((s) => s.id)];
      return new OrganizationScopeResult(true, ids);
    }

    return new OrganizationScopeResult(false, [org.id]);
  } catch (error) {
    console.error('Error resolving organization hierarchy scope:', error);
    return new OrganizationScopeResult(false, [orgIdentifier]);
  }
}
