/** Stable identity; old HQ tokens are accepted only for existing clients/bookmarks. */
export const BEMS_GROUP_CODE = 'BEMS-GROUP';
export const BEMS_GROUP_NAME = 'BEMS Group';
const legacyGroupIds = new Set(['bems-group-hq', 'bems_group_hq', 'group_hq', 'bems-hq', 'general hq', 'bems group hq', 'hq']);
export function normalizeOrganizationIdentifier(value: string): string {
  const clean = value.trim();
  return clean.toUpperCase() === BEMS_GROUP_CODE || legacyGroupIds.has(clean.toLowerCase()) ? BEMS_GROUP_CODE : clean;
}
export function isBemsGroup(org: { id?: string; code?: string; type?: string; name?: string; legalName?: string } | null | undefined): boolean {
  return !!org && (org.type === 'GROUP' || normalizeOrganizationIdentifier(org.code || org.id || '') === BEMS_GROUP_CODE);
}

export function assertGroupIdentityUpdate(current: {code: string}, patch: {code?: string; legalName?: string; type?: string}) {
  if (current.code === BEMS_GROUP_CODE) {
    if ((patch.code !== undefined && patch.code !== BEMS_GROUP_CODE) ||
        (patch.legalName !== undefined && patch.legalName !== BEMS_GROUP_NAME) ||
        (patch.type !== undefined && patch.type !== 'GROUP')) throw new Error('BEMS Group is the parent organization; its identity cannot be changed into a subsidiary.');
  } else if (patch.code === BEMS_GROUP_CODE || patch.type === 'GROUP' ||
      (patch.legalName && (patch.legalName.trim().toLowerCase() === BEMS_GROUP_NAME.toLowerCase() || normalizeOrganizationIdentifier(patch.legalName) === BEMS_GROUP_CODE))) {
    throw new Error('BEMS Group already exists. This organization must remain a subsidiary.');
  }
}
