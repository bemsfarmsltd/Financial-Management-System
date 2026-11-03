/**
 * In-memory sliding window rate limiter for security-sensitive endpoints
 * (Login, password reset, bootstrap, attendance punch)
 */

type RateLimitRecord = {
  timestamps: number[];
  blockedUntil?: number;
};

const store = new Map<string, RateLimitRecord>();

// Clean up expired keys periodically to prevent memory bloat
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
    if (record.timestamps.length === 0 && (!record.blockedUntil || record.blockedUntil < now)) {
      store.delete(key);
    }
  }
}

export type RateLimitOptions = {
  windowMs: number; // e.g. 60_000 (1 min)
  maxAttempts: number; // e.g. 5 attempts
  blockDurationMs?: number; // e.g. 300_000 (5 min lockout on exceeding)
};

export type RateLimitResult = {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
};

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const { windowMs, maxAttempts, blockDurationMs = windowMs } = options;
  const now = Date.now();

  cleanupExpired(windowMs);

  let record = store.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    store.set(identifier, record);
  }

  // Check if currently blocked
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Filter out timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= maxAttempts) {
    record.blockedUntil = now + blockDurationMs;
    const retryAfterSeconds = Math.ceil(blockDurationMs / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Record this attempt
  record.timestamps.push(now);
  const remainingAttempts = Math.max(0, maxAttempts - record.timestamps.length);

  return {
    allowed: true,
    remainingAttempts,
  };
}

export function resetRateLimit(identifier: string): void {
  store.delete(identifier);
}
