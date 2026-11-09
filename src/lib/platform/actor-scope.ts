import { hasGmdFeatureAccess } from '@/lib/gmd-access';
import { canAccessEmployeePortal } from '@/lib/portal-access';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import {
  AuthenticatedEmployee,
  getHrAuthorizationScope,
  HrAuthorizationScope,
} from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { AI_ACCESS_SCOPES, AiAccessScopeKey } from '@/lib/ai-access-control';

export type CanonicalRole = 'SUPER_ADMIN' | 'GMD' | 'STAFF';

/**
 * Normalizes any raw role string into the strict 3-role architecture:
 * - 'SUPER_ADMIN' (aliases 'SYSTEM_ADMIN')
 * - 'GMD'
 * - 'STAFF'
 * Returns null for any unrecognized or legacy role string.
 */
export function normalizeCanonicalRole(rawRole: unknown): CanonicalRole | null {
  const upper = String(rawRole || '').trim().toUpperCase();
  if (upper === 'SUPER_ADMIN' || upper === 'SYSTEM_ADMIN') return 'SUPER_ADMIN';
  if (upper === 'GMD') return 'GMD';
  if (upper === 'STAFF') return 'STAFF';
  return null;
}

export type DelegationOperationMode = 'READ_ONLY' | 'READ_AND_STAGE';

export interface ScopedAutomationDelegation {
  tokenVersion: 1;
  requesterId: string;
  requesterRole: CanonicalRole;
  conversationId: string;
  scopedOrganizationId: string | null;
  allowedScopes: AiAccessScopeKey[] | 'ALL';
  operationMode: DelegationOperationMode;
  issuedAtMs: number;
  expiresAtMs: number;
}

export interface PlatformActorContext {
  humanActor: AuthenticatedEmployee;
  canonicalRole: CanonicalRole;
  isExecutive: boolean;
  hrScope: HrAuthorizationScope;
  authorizedOrganizationIds: string[];
  isGroupScope: boolean;
  principalType: 'HUMAN_SESSION' | 'SCOPED_AUTOMATION_DELEGATION';
  automationDelegation?: ScopedAutomationDelegation | null;
}

const DELEGATION_TTL_MS = 10 * 60 * 1000; // 10 minutes max per conversation turn

function getDelegationSigningSecret(): string {
  const secret = process.env.BEMS_DELEGATION_SIGNING_SECRET || process.env.BEMS_BOOTSTRAP_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('BEMS_DELEGATION_SIGNING_SECRET or BEMS_BOOTSTRAP_SECRET must contain at least 32 bytes.');
  }
  return secret;
}

/**
 * Issues a short-lived, HMAC-signed automation delegation token for an n8n conversation turn.
 * This token carries scoped, expiring delegation for a specific human requester and conversation,
 * and can NEVER mint a human session or confirm a staged action.
 */
export function createScopedAutomationToken(input: {
  requesterId: string;
  requesterRole: CanonicalRole;
  conversationId: string;
  scopedOrganizationId?: string | null;
  allowedScopes?: AiAccessScopeKey[] | 'ALL';
  operationMode?: DelegationOperationMode;
  ttlMs?: number;
}): string {
  if(!hasGmdFeatureAccess(input.requesterRole))throw new Error('Only authorized GMD or Super Admin accounts can delegate AI access.');
  const now = Date.now();
  const isExecutiveRole = input.requesterRole === 'GMD' || input.requesterRole === 'SUPER_ADMIN';
  const effectiveOperationMode: DelegationOperationMode =
    !isExecutiveRole
      ? 'READ_ONLY'
      : input.operationMode === 'READ_ONLY'
      ? 'READ_ONLY'
      : 'READ_AND_STAGE';

  const payload: ScopedAutomationDelegation = {
    tokenVersion: 1,
    requesterId: input.requesterId,
    requesterRole: input.requesterRole,
    conversationId: input.conversationId,
    scopedOrganizationId: input.scopedOrganizationId || null,
    allowedScopes: input.allowedScopes || 'ALL',
    operationMode: effectiveOperationMode,
    issuedAtMs: now,
    expiresAtMs: now + Math.min(Math.max(input.ttlMs ?? DELEGATION_TTL_MS, 1), DELEGATION_TTL_MS),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getDelegationSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `bems_del_v1.${encodedPayload}.${signature}`;
}

/**
 * Verifies a scoped automation delegation token's HMAC signature and expiration window.
 */
export function verifyScopedAutomationToken(token: string | null | undefined): {
  valid: boolean;
  delegation?: ScopedAutomationDelegation;
  reason?: string;
} {
  if (!token || typeof token !== 'string' || !token.startsWith('bems_del_v1.')) {
    return { valid: false, reason: 'Invalid delegation token prefix.' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Malformed delegation token structure.' };
  }

  const [, encodedPayload, providedSig] = parts;
  let signingSecret: string;
  try { signingSecret = getDelegationSigningSecret(); } catch {
    return { valid: false, reason: 'Automation delegation is not configured.' };
  }
  const expectedSig = crypto
    .createHmac('sha256', signingSecret)
    .update(encodedPayload)
    .digest('base64url');

  const provBuf = Buffer.from(providedSig);
  const expBuf = Buffer.from(expectedSig);
  if (provBuf.length !== expBuf.length || !crypto.timingSafeEqual(provBuf, expBuf)) {
    return { valid: false, reason: 'Delegation token signature mismatch.' };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as ScopedAutomationDelegation;

    if (parsed.tokenVersion !== 1 || !parsed.requesterId || !parsed.conversationId) {
      return { valid: false, reason: 'Incomplete delegation claims.' };
    }

    const role = normalizeCanonicalRole(parsed.requesterRole);
    if (!role || !hasGmdFeatureAccess(role)) {
      return { valid: false, reason: 'AI delegation requires an authorized executive.' };
    }

    if (!Number.isFinite(parsed.issuedAtMs) || !Number.isFinite(parsed.expiresAtMs) ||
        parsed.issuedAtMs > Date.now() + 5000 || parsed.expiresAtMs <= parsed.issuedAtMs ||
        parsed.expiresAtMs - parsed.issuedAtMs > DELEGATION_TTL_MS ||
        !['READ_ONLY', 'READ_AND_STAGE'].includes(parsed.operationMode) ||
        (parsed.allowedScopes !== 'ALL' && (!Array.isArray(parsed.allowedScopes) ||
          parsed.allowedScopes.some(scope => !AI_ACCESS_SCOPES.some(item => item.key === scope))))) {
      return { valid: false, reason: 'Invalid delegation limits.' };
    }
    if (Date.now() >= parsed.expiresAtMs) {
      return { valid: false, reason: 'Delegation token has expired.' };
    }

    const isExecutiveRole = role === 'GMD' || role === 'SUPER_ADMIN';
    const normalizedOperationMode: DelegationOperationMode =
      !isExecutiveRole || parsed.operationMode === 'READ_ONLY'
        ? 'READ_ONLY'
        : 'READ_AND_STAGE';

    return {
      valid: true,
      delegation: {
        ...parsed,
        requesterRole: role,
        operationMode: normalizedOperationMode,
      },
    };
  } catch {
    return { valid: false, reason: 'Failed to decode delegation payload.' };
  }
}

/**
 * Resolves the full PlatformActorContext for a verified employee, enforcing:
 * - Active & Approved account status
 * - Canonical 3-role normalization
 * - Explicit revocable HR capability scope
 * - Intersected authorized organization IDs
 */
export async function resolvePlatformActorContext(
  employeeId: string,
  options?: {
    requestedOrganizationId?: string | null;
    principalType?: 'HUMAN_SESSION' | 'SCOPED_AUTOMATION_DELEGATION';
    automationDelegation?: ScopedAutomationDelegation | null;
  }
): Promise<PlatformActorContext | null> {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!emp || !canAccessEmployeePortal(emp)) {
    return null;
  }

  const canonicalRole = normalizeCanonicalRole(emp.role);
  if (!canonicalRole) {
    return null;
  }

  const humanActor: AuthenticatedEmployee = {
    id: emp.id,
    employeeNumber: emp.employeeNumber,
    legalName: emp.legalName,
    workEmail: emp.workEmail,
    phone: emp.phone,
    role: emp.role,
    avatarUrl: emp.avatarUrl,
  };

  const effectiveOrgFilter =
    options?.automationDelegation?.scopedOrganizationId ||
    options?.requestedOrganizationId ||
    'ALL';

  const [hrScope, orgScope] = await Promise.all([
    getHrAuthorizationScope(humanActor),
    resolveAuthorizedOrganizationScope(humanActor, effectiveOrgFilter),
  ]);

  return {
    humanActor,
    canonicalRole,
    isExecutive: canonicalRole === 'GMD' || canonicalRole === 'SUPER_ADMIN',
    hrScope,
    authorizedOrganizationIds: orgScope.organizationIds,
    isGroupScope: orgScope.isGroup,
    principalType: options?.principalType || 'HUMAN_SESSION',
    automationDelegation: options?.automationDelegation || null,
  };
}

