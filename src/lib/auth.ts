import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
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
    expires: expiresAt,
  });
}

export async function getAuthenticatedEmployee(): Promise<AuthenticatedEmployee | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { employee: true },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  const employee = session.employee;
  if (employee.status !== 'ACTIVE' || employee.approvalStatus !== 'APPROVED') return null;
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

export async function destroyEmployeeSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.set(COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
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
