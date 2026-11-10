import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  AI_ACCESS_SCOPES,
  AiAccessMatrix,
  AiAccessScopeKey,
  AiScopeDefinition,
  buildDefaultAiAccessMatrix,
  normalizeAiAccessMatrix,
} from './ai-access-scopes';

export {
  AI_ACCESS_SCOPES,
  buildDefaultAiAccessMatrix,
  normalizeAiAccessMatrix,
};
export type { AiAccessMatrix, AiAccessScopeKey, AiScopeDefinition };

/**
 * Loads the active `ai.access` matrix from `WorkspaceSetting`.
 * Group controls set the maximum permissions; an entity can narrow them independently.
 */
export async function getAiAccessMatrix(organizationId?: string): Promise<AiAccessMatrix> {
  try {
    const group = await prisma.organization.findFirst({ where: { type: 'GROUP', status: 'ACTIVE' }, select: { id: true } });
    const groupSetting = group ? await prisma.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId: group.id, key: 'ai.access' } } }) : null;
    const base = groupSetting ? normalizeAiAccessMatrix(JSON.parse(groupSetting.value)) : buildDefaultAiAccessMatrix();
    if (!organizationId || organizationId === group?.id) return base;
    const specific = await prisma.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId, key: 'ai.access' } } });
    if (!specific) return base;
    const local = normalizeAiAccessMatrix(JSON.parse(specific.value));
    return Object.fromEntries(Object.keys(base).map(key => [key, base[key as keyof AiAccessMatrix] !== false && local[key as keyof AiAccessMatrix] !== false])) as AiAccessMatrix;
  } catch {
    return { ...buildDefaultAiAccessMatrix(), 'master.read': false, 'master.write': false };
  }
}

/**
 * Checks whether `scopeKey` is allowed for `mode` ('read' | 'write') under `matrix`.
 * Respects the global `master.read` and `master.write` kill-switches first.
 */
export function isAiAccessAllowed(
  matrix: AiAccessMatrix,
  scopeKey: AiAccessScopeKey,
  mode: 'read' | 'write'
): boolean {
  if (matrix[`master.${mode}`] === false) {
    return false;
  }
  return matrix[`${scopeKey}.${mode}`] !== false;
}

/**
 * Maps an incoming `/api/ai/tools/*` URL pathname to its primary `AiAccessScopeKey`.
 */
export function resolveScopeFromPathname(pathname: string): AiAccessScopeKey | null {
  const clean = pathname.replace(/\/+$/, '');
  if (clean === '/api/ai/context' || clean === '/api/ai/tools' || clean === '/api/ai/chat') {
    return 'context';
  }
  if (clean.startsWith('/api/ai/tools/analytics') || clean === '/api/ai/analytics') return 'context';
  if (clean.startsWith('/api/ai/tools/forecast') || clean === '/api/ai/forecast') return 'context';
  if (clean.startsWith('/api/ai/tools/wallet')) return 'wallet';
  if (clean.startsWith('/api/ai/tools/approvals')) return 'approvals';
  if (clean.startsWith('/api/ai/tools/requests')) return 'requests';
  if (clean.startsWith('/api/ai/tools/accountability')) return 'accountability';
  if (clean.startsWith('/api/ai/tools/budgets')) return 'budgets';
  if (clean.startsWith('/api/ai/tools/payroll')) return 'payroll';
  if (clean.startsWith('/api/ai/tools/staff')) return 'staff_profiles';
  if (clean.startsWith('/api/ai/tools/admin-onboarding')) return 'admin_onboarding';
  if (clean.startsWith('/api/ai/tools/subsidiary')) return 'subsidiary_create';
  if (clean.startsWith('/api/ai/tools/attendance')) return 'attendance_logs';
  if (clean.startsWith('/api/ai/tools/hr-leave')) return 'hr_leave';
  if (clean.startsWith('/api/ai/tools/vendors')) return 'vendors';
  if (clean.startsWith('/api/ai/tools/intercompany')) return 'intercompany';
  if (clean.startsWith('/api/ai/tools/bank-accounts')) return 'bank_accounts';
  if (clean.startsWith('/api/ai/tools/tasks')) return 'tasks';
  if (clean.startsWith('/api/ai/tools/messages')) return 'messages';
  if (clean.startsWith('/api/ai/tools/policies')) return 'policies';
  return null;
}

/**
 * Maps a `stageAction` call (`actionType` + `materialPayload`) to the exact granular `AiAccessScopeKey`.
 */
export function resolveScopeFromStagePayload(
  actionType: string,
  materialPayload?: Record<string, any>
): AiAccessScopeKey {
  const subAction = String(
    materialPayload?.action ||
      materialPayload?.action_type ||
      materialPayload?.sub_action ||
      ''
  ).toUpperCase();
  switch (actionType) {
    case 'approval':
    case 'approval_decision':
    case 'payment_record':
    case 'payment_recorder':
    case 'emergency_override':
      return 'approvals';
    case 'request_creation':
      if (subAction === 'SEND_MESSAGE' || subAction === 'REQUEST_CLARIFICATION') {
        return 'request_messages';
      }
      return 'requests';
    case 'accountability':
    case 'accountability_clearance':
    case 'deadline_extension':
      return 'accountability';
    case 'budget':
      return 'budgets';
    case 'salary_change':
      return 'salary';
    case 'payroll_action':
      return 'payroll';
    case 'staff_management':
    case 'staff_approval':
    case 'role_change':
      if (
        actionType === 'staff_approval' ||
        actionType === 'role_change' ||
        subAction === 'TOGGLE_ATTENDANCE_EXEMPT' ||
        subAction === 'CHANGE_STATUS' ||
        subAction === 'DELETE_OR_DEACTIVATE'
      ) {
        return 'staff_status';
      }
      return 'staff_profiles';
    case 'admin_onboarding':
      return 'admin_onboarding';
    case 'subsidiary_creation':
      return 'subsidiary_create';
    case 'subsidiary_update':
      return 'subsidiary_edit';
    case 'attendance_override':
      if (
        subAction === 'UPDATE_POLICY' ||
        subAction === 'UPDATE_ROSTER' ||
        subAction === 'CALIBRATE_STATION'
      ) {
        return 'attendance_policy';
      }
      return 'attendance_logs';
    case 'leave_action':
      return 'hr_leave';
    case 'vendor_registration':
      return 'vendors';
    case 'vendor_approval':
      if (subAction === 'CHECK_MATCH' || subAction === 'STAGE_MATCH' || !subAction) {
        return 'three_way_match';
      }
      return 'vendors';
    case 'grn_creation':
    case 'vendor_invoice_creation':
    case 'three_way_match':
      return 'three_way_match';
    case 'intercompany_Entry':
    case 'intercompany_settle':
    case 'intercompany_note':
      return 'intercompany';
    case 'bank_account_update':
    case 'treasury_account':
    case 'staff_bank_update':
    case 'treasury_bank_register':
    case 'vendor_bank_update':
      return 'bank_accounts';
    case 'task_action':
      return 'tasks';
    case 'staff_message':
      return 'messages';
    case 'policy_update':
      return 'policies';
    default:
      return 'context';
  }
}

export class AiAccessDisabledError extends Error {
  status = 403;
  error_code = 'AI_ACCESS_DISABLED';
  scope: AiAccessScopeKey;
  mode: 'read' | 'write';

  constructor(scope: AiAccessScopeKey, mode: 'read' | 'write', message: string) {
    super(message);
    this.name = 'AiAccessDisabledError';
    this.scope = scope;
    this.mode = mode;
  }
}

export async function assertAiScopeAllowed(
  scopeKey: AiAccessScopeKey,
  mode: 'read' | 'write',
  organizationId?: string
): Promise<void> {
  const matrix = await getAiAccessMatrix(organizationId);
  if (!isAiAccessAllowed(matrix, scopeKey, mode)) {
    const def = AI_ACCESS_SCOPES.find((s) => s.key === scopeKey);
    const label = def?.label || scopeKey;
    const masterBlocked = matrix[`master.${mode}`] === false;
    const message = masterBlocked
      ? `Global AI ${mode.toUpperCase()} access is currently turned OFF by the Admin under Settings → AI & Copilot Access.`
      : `AI ${mode.toUpperCase()} access for "${label}" is currently turned OFF by the Admin under Settings → AI & Copilot Access.`;
    throw new AiAccessDisabledError(scopeKey, mode, message);
  }
}

/**
 * Checks whether an AI scope is enabled for `mode` ('read' | 'write').
 * Returns a 403 `NextResponse` if disabled by Admin in Settings, or `null` if allowed.
 */
export async function checkAiScopeOrResponse(
  scopeKey: AiAccessScopeKey,
  mode: 'read' | 'write',
  organizationId?: string
): Promise<NextResponse | null> {
  const matrix = await getAiAccessMatrix(organizationId);
  if (!isAiAccessAllowed(matrix, scopeKey, mode)) {
    const def = AI_ACCESS_SCOPES.find((s) => s.key === scopeKey);
    const label = def?.label || scopeKey;
    const masterBlocked = matrix[`master.${mode}`] === false;
    const message = masterBlocked
      ? `Global AI ${mode.toUpperCase()} access is currently turned OFF by the Admin under Settings → AI & Copilot Access.`
      : `AI ${mode.toUpperCase()} access for "${label}" is currently turned OFF by the Admin under Settings → AI & Copilot Access.`;
    return NextResponse.json(
      {
        ok: false,
        error_code: 'AI_ACCESS_DISABLED',
        scope: scopeKey,
        mode,
        error: message,
        message,
      },
      { status: 403 }
    );
  }
  return null;
}
