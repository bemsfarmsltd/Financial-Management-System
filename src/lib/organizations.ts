import { normalizeOrganizationIdentifier } from '@/lib/organization-identity';
import { prisma } from '@/lib/prisma';
import { type AuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

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
 *
 * Security rule:
 * - Never returns `[orgIdentifier]` when a lookup fails; returns `[]` so callers never widen access on a failed lookup.
 */
export async function resolveOrganizationScope(orgIdentifier?: string | null): Promise<OrganizationScopeResult> {
  if (orgIdentifier) orgIdentifier = normalizeOrganizationIdentifier(orgIdentifier);
  if (!orgIdentifier || orgIdentifier.toLowerCase() === 'all') {
    try {
      const allOrgs = await prisma.organization.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
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
          { code: { equals: orgIdentifier, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        type: true,
        code: true,
      },
    });

    if (!org) {
      return new OrganizationScopeResult(false, []);
    }

    if (org.type === 'GROUP') {
      const childSubsidiaries = await prisma.organization.findMany({
        where: { parentGroupId: org.id, status: 'ACTIVE' },
        select: { id: true },
      });
      const ids = [org.id, ...childSubsidiaries.map((s) => s.id)];
      return new OrganizationScopeResult(true, ids);
    }

    return new OrganizationScopeResult(false, [org.id]);
  } catch (error) {
    console.error('Error resolving organization hierarchy scope:', error);
    return new OrganizationScopeResult(false, []);
  }
}

/**
 * Resolves the requested organization scope and intersects it with the authenticated caller's
 * authorized organization IDs.
 * - Executives (`SYSTEM_ADMIN`, `SUPER_ADMIN`, `GMD`) are authorized across all active organizations.
 * - Staff are authorized only for organizations where they hold an active `EmployeeAssignment`.
 * - A failed lookup or unauthorized subsidiary selection produces an empty `OrganizationScopeResult(false, [])`.
 */
export async function resolveAuthorizedOrganizationScope(
  actor: AuthenticatedEmployee | null | undefined,
  orgIdentifier?: string | null
): Promise<OrganizationScopeResult> {
  if (!actor) {
    return new OrganizationScopeResult(false, []);
  }

  const requestedScope = await resolveOrganizationScope(orgIdentifier);
  if (requestedScope.organizationIds.length === 0) {
    return new OrganizationScopeResult(false, []);
  }

  const scopedOrgId =
    (actor as any)?.scopedOrganizationId ||
    (actor as typeof actor & { delegation?: { scopedOrganizationId?: string | null } })?.delegation?.scopedOrganizationId;
  let permittedScope = requestedScope;
  if (scopedOrgId) {
    const delegatedScope = await resolveOrganizationScope(scopedOrgId);
    const delegatedIds = new Set(delegatedScope.organizationIds);
    permittedScope = new OrganizationScopeResult(false, requestedScope.organizationIds.filter(id => delegatedIds.has(id)));
  }
  const isExecutive = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
  if (isExecutive) return permittedScope;

  // Non-executive staff: intersect with active assignments
  try {
    const activeAssignments = await prisma.employeeAssignment.findMany({
      where: {
        employeeId: actor.id,
        status: 'ACTIVE',
        OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
        subsidiary: { status: 'ACTIVE' },
      },
      select: { subsidiaryId: true },
    });

    const allowedSet = new Set(activeAssignments.map((a) => a.subsidiaryId));
    const intersected = permittedScope.organizationIds.filter((id) => allowedSet.has(id));
    return new OrganizationScopeResult(false, intersected);
  } catch (error) {
    console.error('Error computing authorized organization scope:', error);
    return new OrganizationScopeResult(false, []);
  }
}

