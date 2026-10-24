import { prisma } from '@/lib/prisma';

/**
 * Resolves an organization identifier (ID or Code) into an array of concrete organization IDs.
 * If the organization is a Holding Company (type === 'GROUP'), it automatically returns
 * both the Group HQ ID and all child subsidiary IDs under it.
 *
 * Returns null if the filter is 'ALL' or empty, signifying group-wide unrestricted scope.
 */
export async function resolveOrganizationScope(orgIdentifier?: string | null): Promise<string[] | null> {
  if (!orgIdentifier || orgIdentifier === 'ALL') {
    return null;
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
      // Fallback: if not found by ID or code, return the literal string to avoid silent drop
      return [orgIdentifier];
    }

    if (org.type === 'GROUP') {
      const childSubsidiaries = await prisma.organization.findMany({
        where: { parentGroupId: org.id },
        select: { id: true },
      });
      return [org.id, ...childSubsidiaries.map((s) => s.id)];
    }

    return [org.id];
  } catch (error) {
    console.error('Error resolving organization hierarchy scope:', error);
    return [orgIdentifier];
  }
}
