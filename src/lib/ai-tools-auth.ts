import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { timingSafeEqual } from 'node:crypto';

export interface AuthenticatedAiActor {
  id: string;
  legalName: string;
  role: string;
  workEmail: string;
  phone?: string | null;
  isExecutive: boolean;
}

/**
 * Authenticates requests coming from either:
 * 1. An active browser session cookie (GMD, Super Admin)
 * 2. An n8n / AI automation HTTP request with `Authorization: Bearer <TOKEN>` or `x-api-key: <TOKEN>`
 */
export async function authenticateAiToolRequest(req: NextRequest): Promise<{ actor: AuthenticatedAiActor | null; errorResponse: NextResponse | null }> {
  // Check x-api-key header first
  const apiKey = req.headers.get('x-api-key');
  const serviceSecret = process.env.BEMS_AI_SERVICE_TOKEN || process.env.BEMS_N8N_SHARED_SECRET || '';

  if (apiKey && serviceSecret && apiKey.length >= 16) {
    const keyBuf = Buffer.from(apiKey);
    const secBuf = Buffer.from(serviceSecret);
    if (keyBuf.length === secBuf.length && timingSafeEqual(keyBuf, secBuf)) {
      // Valid service API key
      const targetUserId = req.headers.get('x-user-id');
      const employee = targetUserId
        ? await prisma.employee.findFirst({ where: { id: targetUserId, status: 'ACTIVE' } })
        : await prisma.employee.findFirst({ where: { role: { in: ['GMD', 'SYSTEM_ADMIN'] }, status: 'ACTIVE' } });

      if (employee) {
        return {
          actor: {
            id: employee.id,
            legalName: employee.legalName,
            role: employee.role,
            workEmail: employee.workEmail,
            phone: employee.phone,
            isExecutive: hasAnyRole(employee, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']),
          },
          errorResponse: null,
        };
      }
    }
  }

  // Fallback to standard session or Bearer token via getAuthenticatedEmployee
  const standardUser = await getAuthenticatedEmployee(req);
  if (!standardUser) {
    return {
      actor: null,
      errorResponse: NextResponse.json(
        {
          ok: false,
          error_code: 'UNAUTHORIZED',
          message: 'Authentication required. Provide a valid Bearer token in the Authorization header or x-api-key.',
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
    },
    errorResponse: null,
  };
}

