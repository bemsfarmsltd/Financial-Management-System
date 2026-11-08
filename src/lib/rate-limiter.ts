import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export type RateLimitOptions = { windowMs: number; maxAttempts: number; blockDurationMs?: number };
export type RateLimitResult = { allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number };
function identifierHash(identifier: string) { return createHash('sha256').update(identifier).digest('hex'); }

/** A single database counter is shared by every worker. Database failure denies attempts. */
export async function checkRateLimit(identifier: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const key = identifierHash(identifier);
  const windowMs = Math.max(1000, options.windowMs);
  const blockMs = Math.max(1000, options.blockDurationMs ?? windowMs);
  const max = Math.max(1, options.maxAttempts);
  try {
    const rows = await prisma.$queryRaw<Array<{ attempts: number; blockedUntil: Date | null }>>`
      INSERT INTO "SecurityRateLimit" ("key", "attempts", "windowStartedAt", "blockedUntil", "expiresAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP + (${windowMs + blockMs} * interval '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN "SecurityRateLimit"."blockedUntil" > CURRENT_TIMESTAMP THEN "SecurityRateLimit"."attempts"
          WHEN "SecurityRateLimit"."windowStartedAt" + (${windowMs} * interval '1 millisecond') <= CURRENT_TIMESTAMP THEN 1
          ELSE "SecurityRateLimit"."attempts" + 1 END,
        "windowStartedAt" = CASE WHEN "SecurityRateLimit"."blockedUntil" > CURRENT_TIMESTAMP THEN "SecurityRateLimit"."windowStartedAt"
          WHEN "SecurityRateLimit"."windowStartedAt" + (${windowMs} * interval '1 millisecond') <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
          ELSE "SecurityRateLimit"."windowStartedAt" END,
        "blockedUntil" = CASE WHEN "SecurityRateLimit"."blockedUntil" > CURRENT_TIMESTAMP THEN "SecurityRateLimit"."blockedUntil"
          WHEN "SecurityRateLimit"."windowStartedAt" + (${windowMs} * interval '1 millisecond') <= CURRENT_TIMESTAMP THEN NULL
          WHEN "SecurityRateLimit"."attempts" >= ${max} THEN CURRENT_TIMESTAMP + (${blockMs} * interval '1 millisecond') ELSE NULL END,
        "expiresAt" = CURRENT_TIMESTAMP + (${windowMs + blockMs} * interval '1 millisecond')
      RETURNING "attempts", "blockedUntil"
    `;
    const row = rows[0];
    if (!row) return { allowed: false, remainingAttempts: 0, retryAfterSeconds: 60 };
    const blocked = row.blockedUntil && new Date(row.blockedUntil).getTime() > Date.now();
    return { allowed: !blocked && row.attempts <= max, remainingAttempts: Math.max(0, max - row.attempts), ...(blocked ? { retryAfterSeconds: Math.max(1, Math.ceil((new Date(row.blockedUntil!).getTime() - Date.now()) / 1000)) } : {}) };
  } catch (error) {
    console.error('Shared rate-limit storage is unavailable.');
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds: 60 };
  }
}
export async function resetRateLimit(identifier: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "SecurityRateLimit" WHERE "key" = ${identifierHash(identifier)}`;
}
export function getClientIp(req: Request): string {
  const customHeader = process.env.BEMS_TRUSTED_CLIENT_IP_HEADER;
  if (customHeader) {
    const customVal = req.headers.get(customHeader)?.split(',')[0].trim();
    if (customVal && customVal !== 'direct') return customVal.slice(0, 80);
  }

  // Inspect standard reverse proxy / CDN headers (Cloudflare, Nginx, Hostinger, Starlink)
  const cfConnectingIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfConnectingIp && cfConnectingIp !== 'direct') return cfConnectingIp.slice(0, 80);

  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp && realIp !== 'direct') return realIp.slice(0, 80);

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp && firstIp !== 'direct') return firstIp.slice(0, 80);
  }

  return '127.0.0.1';
}
