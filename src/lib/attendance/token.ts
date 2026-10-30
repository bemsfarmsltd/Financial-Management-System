import crypto from 'crypto';

// 45-second window for dynamic QR codes
const WINDOW_DURATION_SECONDS = 45;

/**
 * Calculates the great-circle distance between two points in meters using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Generates an HMAC-based rotating dynamic QR token for an attendance station.
 */
export function generateStationQrToken(stationCode: string, secret: string): {
  token: string;
  expiresInSeconds: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / WINDOW_DURATION_SECONDS);
  const secondsLeft = WINDOW_DURATION_SECONDS - (now % WINDOW_DURATION_SECONDS);

  const payload = `${stationCode}:${currentWindow}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);

  const token = `BEMSQR:${stationCode}:${currentWindow}:${hmac}`;
  return { token, expiresInSeconds: secondsLeft };
}

/**
 * Validates a dynamic QR token against the station's secret.
 * Accepts the current 45-second window or the immediately preceding window (clock tolerance).
 */
export function verifyStationQrToken(token: string, stationCode: string, secret: string): boolean {
  if (!token || !token.startsWith('BEMSQR:')) return false;

  const parts = token.split(':');
  if (parts.length !== 4) return false;

  const [_, code, windowStr, providedHmac] = parts;
  if (code !== stationCode) return false;

  const tokenWindow = parseInt(windowStr, 10);
  if (isNaN(tokenWindow)) return false;

  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / WINDOW_DURATION_SECONDS);

  // Accept current window or previous window
  if (tokenWindow !== currentWindow && tokenWindow !== currentWindow - 1) {
    return false;
  }

  const payload = `${stationCode}:${tokenWindow}`;
  const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);

  return crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac));
}

/**
 * Formats time in Africa/Lagos (GMT+1)
 */
export function getLagosTime(date: Date = new Date()): {
  workDate: string; // YYYY-MM-DD
  currentTimeStr: string; // HH:mm
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  hours: number;
  minutes: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const workDate = formatter.format(date); // YYYY-MM-DD

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTimeStr = timeFormatter.format(date); // HH:mm
  const [hours, minutes] = currentTimeStr.split(':').map(Number);

  // Day of week in Lagos
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
  });
  const weekdayShort = dayFormatter.format(date);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    workDate,
    currentTimeStr,
    dayOfWeek: weekdayMap[weekdayShort] ?? date.getDay(),
    hours,
    minutes,
  };
}

/**
 * Safely converts BigInt fields (such as deductionMinor) to Number for JSON serialization.
 */
export function serializeAttendanceRecord<T extends Record<string, any> | null>(record: T): any {
  if (!record) return record;
  const res: any = { ...record };
  if ('deductionMinor' in res && typeof res.deductionMinor === 'bigint') {
    res.deductionMinor = Number(res.deductionMinor);
  }
  return res;
}

/**
 * Extracts client IP from standard reverse proxy and direct headers.
 */
export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(s => s.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  return '127.0.0.1';
}

/**
 * Known SpaceX Starlink IP ranges (IPv4 CGNAT / public pool + IPv6 allocation):
 * - IPv4: 98.97.0.0/16, 143.244.32.0/19, 170.203.192.0/18, 206.214.224.0/19, 129.222.0.0/16
 * - IPv6: 2605:59c0::/28 (2605:59c0: - 2605:59cf:)
 */
const STARLINK_IPV4_PREFIXES = ['98.97.', '143.244.', '170.203.', '206.214.', '129.222.'];
const STARLINK_IPV6_PREFIX = '2605:59c';

function isStarlinkRange(ip: string): boolean {
  if (!ip) return false;
  const clean = ip.toLowerCase().replace(/^::ffff:/, '').trim();
  if (clean.startsWith(STARLINK_IPV6_PREFIX)) return true;
  return STARLINK_IPV4_PREFIXES.some(p => clean.startsWith(p));
}

/**
 * Checks if the request originates from the company's designated Starlink IP / network.
 * Supports dual-stack Starlink IPv4 / IPv6 matching, IPv6 /64 router prefix matching,
 * and automatically bypasses when power outage mode is enabled or Starlink check is turned off.
 */
export function isStarlinkIpAllowed(
  clientIp: string,
  starlinkIps: string,
  powerOutageMode: boolean,
  requireStarlink: boolean
): { allowed: boolean; reason?: string } {
  // 1. If admin turned off Starlink requirement or power outage mode is active, allow immediately
  if (!requireStarlink || powerOutageMode) {
    return { allowed: true };
  }

  // 2. Allow local loopback / development environments
  const cleanIp = clientIp ? clientIp.replace(/^::ffff:/, '').trim().toLowerCase() : '';
  if (['127.0.0.1', '::1', 'localhost'].includes(cleanIp)) {
    return { allowed: true };
  }

  // 3. If no specific Starlink IP has been configured yet by the admin, allow with warning
  if (!starlinkIps || !starlinkIps.trim()) {
    return { allowed: true };
  }

  // 4. Parse configured entries (comma, semicolon, or newline separated)
  const allowedEntries = starlinkIps
    .split(/[,;\n]+/)
    .map(ip => ip.trim().toLowerCase())
    .filter(Boolean);

  // Check if the configured network itself represents a Starlink network
  const configIsStarlink = allowedEntries.some(entry => isStarlinkRange(entry) || entry.includes('starlink'));
  const clientIsStarlink = isStarlinkRange(cleanIp);

  // If company configured Starlink and the incoming client is connected via Starlink's AS14593 network
  if (configIsStarlink && clientIsStarlink) {
    return { allowed: true };
  }

  // Check individual entries with prefix, CIDR, and IPv6 /64 subnet matching
  const isMatched = allowedEntries.some(target => {
    if (target === '*' || target === cleanIp) return true;

    // Wildcard prefix matching (e.g. "98.97.*" or "2605:59c1:1a3a:a210:*")
    if (target.endsWith('*')) {
      const prefix = target.slice(0, -1);
      if (cleanIp.startsWith(prefix)) return true;
    }

    // Direct prefix match (e.g. "98.97.")
    if (cleanIp.startsWith(target)) return true;

    // IPv6 /64 prefix match (Starlink assigns /64 blocks to routers; first 4 groups identify the local router)
    if (cleanIp.includes(':') && target.includes(':')) {
      const clientGroups = cleanIp.split(':').filter(Boolean);
      const targetGroups = target.split(':').filter(Boolean);
      if (clientGroups.length >= 4 && targetGroups.length >= 4) {
        const clientPrefix = clientGroups.slice(0, 4).join(':');
        const targetPrefix = targetGroups.slice(0, 4).join(':');
        if (clientPrefix === targetPrefix) return true;
      }
    }

    // IPv4 /24 subnet match (first 3 octets match, e.g. 98.97.76.x)
    if (!cleanIp.includes(':') && !target.includes(':')) {
      const clientOctets = cleanIp.split('.');
      const targetOctets = target.split('.');
      if (clientOctets.length === 4 && targetOctets.length === 4) {
        if (
          clientOctets[0] === targetOctets[0] &&
          clientOctets[1] === targetOctets[1] &&
          clientOctets[2] === targetOctets[2]
        ) {
          return true;
        }
      }
    }

    return false;
  });

  if (isMatched) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Access blocked: Device IP (${cleanIp}) is not connected to the Company Starlink Wi-Fi network. If the office is experiencing a power outage, please contact HR/Admin to activate Power Outage Mode.`,
  };
}

/**
 * Validates morning check-in arrival window (no check-in allowed before earliestCheckInTime).
 */
export function validateCheckInTimeWindow(
  currentTimeStr: string,
  earliestCheckInTime: string = '07:00'
): { allowed: boolean; reason?: string } {
  if (currentTimeStr < earliestCheckInTime) {
    return {
      allowed: false,
      reason: `Attendance taking is not allowed before ${earliestCheckInTime} AM. Morning arrival window is ${earliestCheckInTime} AM – 08:00 AM (Grace period until 08:15 AM). Please wait until ${earliestCheckInTime} AM to check in.`,
    };
  }
  return { allowed: true };
}
