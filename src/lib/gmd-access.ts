/** Owner-authorized temporary Super Admin parity, 8 November 2026. */
export function superAdminGmdAccessEnabled(): boolean {
  const value = process.env.BEMS_SUPER_ADMIN_GMD_ACCESS;
  return value === undefined || value === 'true';
}
export function hasGmdFeatureAccess(role: unknown, allowSuperAdmin = superAdminGmdAccessEnabled()): boolean {
  return role === 'GMD' || (allowSuperAdmin && (role === 'SUPER_ADMIN' || role === 'SYSTEM_ADMIN'));
}
export function canApproveWalletRelease(actor: { id: string; role: string }): boolean {
  if (actor.role === 'SUPER_ADMIN' || actor.role === 'SYSTEM_ADMIN') return superAdminGmdAccessEnabled();
  return actor.role === 'GMD' && (!process.env.BEMS_FINANCIAL_GMD_ID || actor.id === process.env.BEMS_FINANCIAL_GMD_ID);
}
export function financialApproverLabel(): string {
  return superAdminGmdAccessEnabled() ? 'GMD or Super Admin' : 'designated GMD';
}
