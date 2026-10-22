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

export async function getAuthenticatedEmployee(): Promise<AuthenticatedEmployee | null> {
  // 1. Check Authorization Bearer header first (for n8n tools, API clients, and curl tests)
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7).trim();

      // A. Check service API key (Option B)
      const serviceSecret = process.env.BEMS_AI_SERVICE_TOKEN || process.env.BEMS_BOOTSTRAP_SECRET;
      if (serviceSecret && token === serviceSecret) {
        const targetUserId = headerStore.get('x-user-id') || headerStore.get('x-employee-id');
        const employee = targetUserId
          ? await prisma.employee.findFirst({ where: { id: targetUserId, status: 'ACTIVE', approvalStatus: 'APPROVED' } })
          : await prisma.employee.findFirst({ where: { role: 'GMD', status: 'ACTIVE', approvalStatus: 'APPROVED' } });

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

      // B. Check user session token (Option A)
      const session = await prisma.authSession.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { employee: true },
      });
      if (session && session.expiresAt > new Date()) {
        const employee = session.employee;
        if (employee.status === 'ACTIVE' && employee.approvalStatus === 'APPROVED') {
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
  } catch {
    // Header check non-blocking
  }

  // 2. Fall back to cookie session
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (token) {
      const session = await prisma.authSession.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { employee: true },
      });
      if (session && session.expiresAt > new Date()) {
        const employee = session.employee;
        if (employee.status === 'ACTIVE' && employee.approvalStatus === 'APPROVED') {
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
  } catch {
    // Cookie check non-blocking
  }

  return null;
}

export async function destroyEmployeeSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (token) {
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

export function hasAnyRole(employee: AuthenticatedEmployee, roles: string[]) {
  return roles.includes(employee.role);
}
