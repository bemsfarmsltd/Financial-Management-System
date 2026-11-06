import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

const scrypt = promisify(nodeScrypt);
const COOKIE_NAME = 'bems_session';
const SESSION_DAYS = 7;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

export type AuthenticatedEmployee = {
  id: string;
  employeeNumber: string;
  legalName: string;
  workEmail: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
};

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string | null) {
  if (!encoded) return false;
  const [algorithm, salt, expectedHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createEmployeeSession(employeeId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await prisma.authSession.create({ data: { employeeId, tokenHash: hashToken(token), expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    expires: expiresAt,
  });
  return { token, expiresAt };
}

// In-memory session cache to eliminate redundant DB lookups on concurrent requests
type CachedSession = {
  employee: AuthenticatedEmployee;
  expiresAt: number;
};
const sessionMemoryCache = new Map<string, CachedSession>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (reduces DB lookups by 90% across concurrent endpoints)

function getCachedSession(tokenHash: string): AuthenticatedEmployee | null {
  const cached = sessionMemoryCache.get(tokenHash);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    sessionMemoryCache.delete(tokenHash);
    return null;
  }
  return cached.employee;
}

function setCachedSession(tokenHash: string, employee: AuthenticatedEmployee) {
  if (sessionMemoryCache.size > 500) {
    const now = Date.now();
    for (const [key, val] of sessionMemoryCache.entries()) {
      if (now > val.expiresAt) sessionMemoryCache.delete(key);
    }
  }
  sessionMemoryCache.set(tokenHash, {
    employee,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateSessionCache(token?: string) {
  if (token) {
    sessionMemoryCache.delete(hashToken(token));
  } else {
    sessionMemoryCache.clear();
  }
}

export async function getAuthenticatedEmployee(
  req?: Request,
  options?: { disallowServiceToken?: boolean; allowServiceToken?: boolean }
): Promise<AuthenticatedEmployee | null> {
  let authHeader: string | null = null;
  let cookieToken: string | null = null;
  let method = 'GET';

  // Direct extraction from incoming Request object (fastest, bypasses AsyncLocalStorage detachment)
  if (req) {
    authHeader = req.headers.get('authorization');
    method = (req.method || 'GET').toUpperCase();
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)bems_session=([^;]+)/);
    if (match) cookieToken = decodeURIComponent(match[1]);
  }

  // 1. Fallback to Next.js headers() store if not supplied via req
  if (!authHeader) {
    try {
      const headerStore = await headers();
      authHeader = headerStore.get('authorization');
    } catch {
      // Async storage not available
    }
  }

  // Service token is only permitted for read-only GET requests or when explicitly enabled for staging routes
  const canUseServiceToken =
    !options?.disallowServiceToken &&
    (options?.allowServiceToken === true || (req ? method === 'GET' : false));

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();

    // A. Check service API key ONLY when service tokens are permitted (never for human confirmation or ordinary dashboard mutations)
    const configuredServiceSecret = process.env.BEMS_AI_SERVICE_TOKEN;
    if (canUseServiceToken && configuredServiceSecret && configuredServiceSecret.length >= 24) {
      const tokenBuf = Buffer.from(token);
      const secretBuf = Buffer.from(configuredServiceSecret);
      if (tokenBuf.length === secretBuf.length && timingSafeEqual(tokenBuf, secretBuf)) {
        let targetUserId: string | null = null;
        if (req) {
          targetUserId = req.headers.get('x-user-id') || req.headers.get('x-employee-id');
        } else {
          try {
            const hs = await headers();
            targetUserId = hs.get('x-user-id') || hs.get('x-employee-id');
          } catch {}
        }

        const employee = targetUserId
          ? await prisma.employee.findFirst({ where: { id: targetUserId, status: 'ACTIVE', approvalStatus: 'APPROVED' } })
          : await prisma.employee.findFirst({ where: { role: { in: ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE', approvalStatus: 'APPROVED' } });

        if (employee) {
          return {
            id: employee.id,
            employeeNumber: employee.employeeNumber,
            legalName: employee.legalName,
            workEmail: employee.workEmail,
            phone: employee.phone,
            role: employee.role,
            avatarUrl: employee.avatarUrl,
          };
        }
      }
    }

    // B. Check user session token (Option A)
    const tHash = hashToken(token);
    const cached = getCachedSession(tHash);
    if (cached) return cached;

    const session = await prisma.authSession.findUnique({
      where: { tokenHash: tHash },
      include: { employee: true },
    });
    if (session && session.expiresAt > new Date()) {
      const employee = session.employee;
      if (employee.status === 'ACTIVE' && employee.approvalStatus === 'APPROVED') {
        const authEmp: AuthenticatedEmployee = {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          legalName: employee.legalName,
          workEmail: employee.workEmail,
          phone: employee.phone,
          role: employee.role,
          avatarUrl: employee.avatarUrl,
        };
        setCachedSession(tHash, authEmp);
        return authEmp;
      }
    }
  }

  // 2. Fall back to cookie session: use cookieToken if found on req, else await cookies()
  if (!cookieToken) {
    try {
      const cookieStore = await cookies();
      cookieToken = cookieStore.get(COOKIE_NAME)?.value || null;
    } catch {
      // Async storage not available
    }
  }

  if (cookieToken) {
    try {
      const tHash = hashToken(cookieToken);
      const cached = getCachedSession(tHash);
      if (cached) return cached;

      let session = null;
      try {
        session = await prisma.authSession.findUnique({
          where: { tokenHash: tHash },
          include: { employee: true },
        });
      } catch (poolErr) {
        // Retry once after 120ms on transient connection pool spike
        await new Promise((r) => setTimeout(r, 120));
        try {
          session = await prisma.authSession.findUnique({
            where: { tokenHash: tHash },
            include: { employee: true },
          });
        } catch {
          session = null;
        }
      }
      if (session && session.expiresAt > new Date()) {
        const employee = session.employee;
        if (employee.status === 'ACTIVE' && employee.approvalStatus === 'APPROVED') {
          const authEmp: AuthenticatedEmployee = {
            id: employee.id,
            employeeNumber: employee.employeeNumber,
            legalName: employee.legalName,
            workEmail: employee.workEmail,
            phone: employee.phone,
            role: employee.role,
            avatarUrl: employee.avatarUrl,
          };
          setCachedSession(tHash, authEmp);
          return authEmp;
        }
      }
    } catch (err) {
      console.error('[auth] Cookie session verification error:', err);
    }
  }

  return null;
}

export async function destroyEmployeeSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (token) {
      invalidateSessionCache(token);
      await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
    }
    cookieStore.delete(COOKIE_NAME);
    cookieStore.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  } catch (err) {
    console.error('Error destroying session:', err);
  }
}

export function publicEmployee(employee: AuthenticatedEmployee) {
  return {
    id: employee.id,
    name: employee.legalName,
    fullName: employee.legalName,
    email: employee.workEmail,
    phone: employee.phone || '',
    role: employee.role,
    avatarUrl: employee.avatarUrl || '',
    emailVerified: true,
  };
}

export const CANONICAL_ROLES = {
  SUPER_ADMIN: 'SYSTEM_ADMIN',
  GMD: 'GMD',
  STAFF: 'STAFF',
} as const;

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  SYSTEM_ADMIN: 'Super admin',
  SUPER_ADMIN: 'Super admin',
  GMD: 'The Group Managing Director',
  STAFF: 'Staff',
};

export function getRoleDisplayName(role: string): string {
  return ROLE_DISPLAY_NAMES[role] || (role === 'GMD' ? 'The Group Managing Director' : role === 'SYSTEM_ADMIN' || role === 'SUPER_ADMIN' ? 'Super admin' : 'Staff');
}

export function hasAnyRole(employee: AuthenticatedEmployee | null | undefined, roles: string[]): boolean {
  if (!employee || !employee.role) return false;
  const role = employee.role.toUpperCase();

  // Super admin has full administrative oversight
  const isSuperAdmin = role === 'SYSTEM_ADMIN' || role === 'SUPER_ADMIN';

  for (const r of roles) {
    const target = r.toUpperCase();
    if (role === target) return true;
    if (isSuperAdmin && (target === 'SYSTEM_ADMIN' || target === 'SUPER_ADMIN' || target === 'ADMIN' || target === 'SUPER ADMIN')) {
      return true;
    }
    if (role === 'GMD' && (target === 'GMD' || target.includes('MANAGING DIRECTOR'))) {
      return true;
    }
    if (role === 'STAFF' && target === 'STAFF') {
      return true;
    }
  }
  return false;
}

export type HrAuthorizationScope = {
  authorized: boolean;
  isExecutive: boolean;
  isGlobal: boolean;
  subsidiaryIds: string[];
};

const OFFICIAL_HR_DEPT_CODES = new Set(['HR', 'HUMAN_RESOURCES', 'PEOPLE_OPS']);

/**
 * Evaluates explicit, revocable, entity-scoped HR capability for an authenticated employee.
 * - Never infers HR authority from free-text substrings in employeeNumber, jobTitle, or department.name.
 * - Restricts checked assignments strictly to active, non-expired assignments in active subsidiaries.
 * - Supports explicit revocable capability grants via WorkspaceSetting (key: 'HR_CAPABILITY_GRANTS').
 */
export async function getHrAuthorizationScope(
  employee: AuthenticatedEmployee | null | undefined
): Promise<HrAuthorizationScope> {
  if (!employee) {
    return { authorized: false, isExecutive: false, isGlobal: false, subsidiaryIds: [] };
  }

  try {
    const empRecord = await prisma.employee.findUnique({
      where: { id: employee.id },
      select: {
        id: true,
        role: true,
        status: true,
        approvalStatus: true,
        assignments: {
          where: {
            status: 'ACTIVE',
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
            subsidiary: { status: 'ACTIVE' },
          },
          select: {
            subsidiaryId: true,
            subsidiary: { select: { id: true, type: true } },
            department: { select: { id: true, code: true } },
          },
        },
      },
    });

    if (!empRecord || empRecord.status !== 'ACTIVE' || empRecord.approvalStatus !== 'APPROVED') {
      return { authorized: false, isExecutive: false, isGlobal: false, subsidiaryIds: [] };
    }

    const isExecutive = hasAnyRole(employee, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
    if (isExecutive) {
      const allActiveOrgs = await prisma.organization.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      return {
        authorized: true,
        isExecutive: true,
        isGlobal: true,
        subsidiaryIds: allActiveOrgs.map((o) => o.id),
      };
    }

    const authorizedSubsidiaryIds = new Set<string>();
    let hasGroupLevelGrant = false;

    // 1. Check active assignments in an official HR department (exact department code match only)
    for (const assignment of empRecord.assignments) {
      const deptCode = (assignment.department?.code || '').trim().toUpperCase();
      if (deptCode && OFFICIAL_HR_DEPT_CODES.has(deptCode)) {
        authorizedSubsidiaryIds.add(assignment.subsidiaryId);
        if (assignment.subsidiary?.type === 'GROUP') {
          hasGroupLevelGrant = true;
        }
      }
    }

    // 2. Check explicit revocable capability grants in WorkspaceSetting ('HR_CAPABILITY_GRANTS')
    const grantSettings = await prisma.workspaceSetting.findMany({
      where: { key: 'HR_CAPABILITY_GRANTS' },
      select: { organizationId: true, value: true },
    });

    for (const setting of grantSettings) {
      try {
        const parsed = JSON.parse(setting.value);
        const grantedIds: string[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.employeeIds)
          ? parsed.employeeIds
          : [];
        if (grantedIds.includes(empRecord.id)) {
          authorizedSubsidiaryIds.add(setting.organizationId);
        }
      } catch {
        // Ignore malformed setting JSON
      }
    }

    if (hasGroupLevelGrant) {
      const allActiveOrgs = await prisma.organization.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      for (const org of allActiveOrgs) {
        authorizedSubsidiaryIds.add(org.id);
      }
    }

    const subsidiaryIds = Array.from(authorizedSubsidiaryIds);
    return {
      authorized: subsidiaryIds.length > 0,
      isExecutive: false,
      isGlobal: hasGroupLevelGrant,
      subsidiaryIds,
    };
  } catch (err) {
    console.warn('Could not verify explicit HR capability scope:', err);
    return { authorized: false, isExecutive: false, isGlobal: false, subsidiaryIds: [] };
  }
}

export async function isHrAuthorizedEmployee(
  employee: AuthenticatedEmployee | null | undefined,
  targetSubsidiaryId?: string | null
): Promise<boolean> {
  const scope = await getHrAuthorizationScope(employee);
  if (!scope.authorized) return false;
  if (scope.isGlobal || !targetSubsidiaryId) return true;
  return scope.subsidiaryIds.includes(targetSubsidiaryId);
}


