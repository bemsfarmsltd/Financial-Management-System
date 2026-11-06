import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { timingSafeEqual } from 'node:crypto';
import {
  AiAccessScopeKey,
  checkAiScopeOrResponse,
  resolveScopeFromPathname,
} from '@/lib/ai-access-control';

export interface AuthenticatedAiActor {
  id: string;
  legalName: string;
  role: string;
  workEmail: string;
  phone?: string | null;
  isExecutive: boolean;
  authSource: 'SERVICE_TOKEN' | 'HUMAN_SESSION';
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

  const apiKey = req.headers.get('x-api-key');
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
  const candidateSecret = apiKey || bearerToken;
  const serviceSecrets = [
    process.env.BEMS_AI_SERVICE_TOKEN,
    process.env.BEMS_N8N_SHARED_SECRET,
  ].filter((s): s is string => Boolean(s && s.length >= 16));

  if (candidateSecret && candidateSecret.length >= 16 && serviceSecrets.length > 0) {
    const keyBuf = Buffer.from(candidateSecret);
    const matchedSecret = serviceSecrets.some((sec) => {
      const secBuf = Buffer.from(sec);
      return keyBuf.length === secBuf.length && timingSafeEqual(keyBuf, secBuf);
    });

    if (matchedSecret) {
      const targetUserId = req.headers.get('x-user-id') || req.headers.get('x-employee-id');
      const employee = targetUserId
        ? await prisma.employee.findFirst({ where: { id: targetUserId, status: 'ACTIVE', approvalStatus: 'APPROVED' } })
        : await prisma.employee.findFirst({ where: { role: { in: ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE', approvalStatus: 'APPROVED' } });

      if (employee) {
        return {
          actor: {
            id: employee.id,
            legalName: employee.legalName,
            role: employee.role,
            workEmail: employee.workEmail,
            phone: employee.phone,
            isExecutive: hasAnyRole(employee, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']),
            authSource: 'SERVICE_TOKEN',
          },
          errorResponse: null,
        };
      }
    }
  }

  // Fallback to standard human session or user Bearer session token
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

  const isExecutive = hasAnyRole(standardUser, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);

  return {
    actor: {
      id: standardUser.id,
      legalName: standardUser.legalName,
      role: standardUser.role,
      workEmail: standardUser.workEmail,
      phone: standardUser.phone,
      isExecutive,
      authSource: 'HUMAN_SESSION',
    },
    errorResponse: null,
  };
}

