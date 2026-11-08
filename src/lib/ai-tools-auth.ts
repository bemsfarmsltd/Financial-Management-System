import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { timingSafeEqual } from 'node:crypto';
import {
  AiAccessScopeKey,
  checkAiScopeOrResponse,
  resolveScopeFromPathname,
} from '@/lib/ai-access-control';
import {
  normalizeCanonicalRole,
  ScopedAutomationDelegation,
  verifyScopedAutomationToken,
} from '@/lib/platform/actor-scope';

export interface AuthenticatedAiActor {
  id: string;
  legalName: string;
  role: string;
  canonicalRole: 'SUPER_ADMIN' | 'GMD' | 'STAFF';
  workEmail: string;
  phone?: string | null;
  isExecutive: boolean;
  authSource: 'SERVICE_TOKEN' | 'HUMAN_SESSION';
  conversationId?: string | null;
  scopedOrganizationId?: string | null;
  delegation?: ScopedAutomationDelegation | null;
}

const MULTI_WRITE_SCOPE_PATHS = new Set([
  '/api/ai/tools/requests',
  '/api/ai/tools/payroll',
  '/api/ai/tools/staff',
  '/api/ai/tools/subsidiary',
  '/api/ai/tools/attendance',
  '/api/ai/tools/vendors',
]);

/**
 * Authenticates requests coming from either:
 * 1. An active browser session cookie (GMD, Super Admin)
 * 2. An n8n / AI automation HTTP request with `Authorization: Bearer <TOKEN>` or `x-api-key: <TOKEN>`
 *
 * Also enforces the Admin's Granular AI Read & Write Access Control Matrix (`ai.access`).
 */
export async function authenticateAiToolRequest(
  req: NextRequest,
  options?: { scope?: AiAccessScopeKey; mode?: 'read' | 'write' }
): Promise<{ actor: AuthenticatedAiActor | null; errorResponse: NextResponse | null }> {
  const url = new URL(req.url);
  const cleanPath = url.pathname.replace(/\/+$/, '');
  const method = req.method.toUpperCase();
  const mode: 'read' | 'write' = options?.mode || (method === 'GET' || method === 'HEAD' ? 'read' : 'write');

  // Resolve scope from pathname or query parameters
  let scopeKey: AiAccessScopeKey | null = options?.scope || resolveScopeFromPathname(cleanPath);
  if (mode === 'read' && cleanPath === '/api/ai/tools/vendors') {
    const action = (url.searchParams.get('action') || '').toUpperCase();
    if (action === 'CHECK_MATCH') {
      scopeKey = 'three_way_match';
    }
  }

  // Always check master switch first; for GET or single-scope POST routes, check the exact scope immediately.
  // Multi-scope POST routes (e.g. /api/ai/tools/staff, /api/ai/tools/payroll) check master.write here and
  // enforce the exact sub-scope inside stageAction().
  if (scopeKey) {
    const scopeToVerify: AiAccessScopeKey =
      mode === 'write' && !options?.scope && MULTI_WRITE_SCOPE_PATHS.has(cleanPath)
        ? 'master'
        : scopeKey;
    const blockedResponse = await checkAiScopeOrResponse(scopeToVerify, mode);
    if (blockedResponse) {
      return { actor: null, errorResponse: blockedResponse };
    }
  }

  const delegationHeader =
    req.headers.get('x-bems-delegation-token') ||
    req.headers.get('x-delegation-token');
  const apiKey = req.headers.get('x-api-key');
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
  const candidateSecret = apiKey || bearerToken;

  // 1. Check Scoped Automation Delegation Token (bems_del_v1.*) first
  const candidateDelegation =
    delegationHeader ||
    (candidateSecret?.startsWith('bems_del_v1.') ? candidateSecret : null);

  if (candidateDelegation) {
    const verified = verifyScopedAutomationToken(candidateDelegation);
    if (!verified.valid || !verified.delegation) {
      return {
        actor: null,
        errorResponse: NextResponse.json(
          {
            ok: false,
            error_code: 'DELEGATION_TOKEN_INVALID',
            message: verified.reason || 'Scoped automation delegation token is invalid or expired.',
          },
          { status: 401 }
        ),
      };
    }

    const del = verified.delegation;
    if(del.requesterRole!=='GMD')return {actor:null,errorResponse:NextResponse.json({error_code:'GMD_AI_ONLY',message:'AI access is exclusively for the GMD.'},{status:403})};
    if (mode === 'write' && del.operationMode === 'READ_ONLY') {
      return {
        actor: null,
        errorResponse: NextResponse.json(
          {
            ok: false,
            error_code: 'DELEGATION_READ_ONLY',
            message: 'Read-only delegation cannot stage or execute write operations.',
          },
          { status: 403 }
        ),
      };
    }

    if (
      scopeKey &&
      Array.isArray(del.allowedScopes) &&
      !del.allowedScopes.includes(scopeKey)
    ) {
      return {
        actor: null,
        errorResponse: NextResponse.json(
          {
            ok: false,
            error_code: 'DELEGATION_SCOPE_FORBIDDEN',
            message: `Automation delegation is not permitted for scope "${scopeKey}".`,
          },
          { status: 403 }
        ),
      };
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: del.requesterId,
        OR: [{ status: 'ACTIVE' }, { status: 'ON_LEAVE', role: 'STAFF' }],
        approvalStatus: 'APPROVED',
      },
    });
    const canonicalRole = employee ? normalizeCanonicalRole(employee.role) : null;
    if (!employee || canonicalRole!=='GMD' || canonicalRole !== del.requesterRole) {
      return {
        actor: null,
        errorResponse: NextResponse.json(
          {
            ok: false,
            error_code: 'DELEGATED_ACTOR_INACTIVE',
            message: 'The human requester associated with this automation delegation is no longer active.',
          },
          { status: 401 }
        ),
      };
    }

    return {
      actor: {
        id: employee.id,
        legalName: employee.legalName,
        role: employee.role,
        canonicalRole,
        workEmail: employee.workEmail,
        phone: employee.phone,
        isExecutive: hasAnyRole(employee, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']),
        authSource: 'SERVICE_TOKEN',
        conversationId: del.conversationId,
        scopedOrganizationId: del.scopedOrganizationId,
        delegation: del,
      },
      errorResponse: null,
    };
  }

  if (candidateSecret && (apiKey || !bearerToken || !candidateSecret.startsWith('bems_del_v1.'))) {
    // Bearer user sessions are verified below. An API key cannot select a human.
    if (apiKey || url.searchParams.has('auth_token')) {
      return { actor: null, errorResponse: NextResponse.json({ error: 'A signed automation delegation is required.', error_code: 'SERVICE_TOKEN_MISSING_DELEGATION' }, { status: 401 }) };
    }
  }

  // 3. Fallback to standard human session or user Bearer session token
  const standardUser = await getAuthenticatedEmployee(req, { disallowServiceToken: true });
  if (!standardUser) {
    return {
      actor: null,
      errorResponse: NextResponse.json(
        {
          ok: false,
          error_code: 'UNAUTHORIZED',
          message: 'Authentication required. Provide a valid user session or AI service token.',
        },
        { status: 401 }
      ),
    };
  }

  if(standardUser.role!=='GMD')return {actor:null,errorResponse:NextResponse.json({error_code:'GMD_AI_ONLY',message:'AI access is exclusively for the GMD.'},{status:403})};
  const canonicalRole = normalizeCanonicalRole(standardUser.role) || 'STAFF';
  const isExecutive = hasAnyRole(standardUser, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);

  return {
    actor: {
      id: standardUser.id,
      legalName: standardUser.legalName,
      role: standardUser.role,
      canonicalRole,
      workEmail: standardUser.workEmail,
      phone: standardUser.phone,
      isExecutive,
      authSource: 'HUMAN_SESSION',
      conversationId: req.headers.get('x-conversation-id') || `conv_${standardUser.id}`,
      scopedOrganizationId: req.headers.get('x-subsidiary-id') || null,
      delegation: null,
    },
    errorResponse: null,
  };
}

