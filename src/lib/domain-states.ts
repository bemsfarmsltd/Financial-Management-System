/**
 * Canonical Domain States, State Transition Guards, Legacy Mappings,
 * and Exact Money (Kobo/Naira) Serialization Helpers (Audit Item 07).
 */

export type CanonicalRole = 'SUPER_ADMIN' | 'GMD' | 'STAFF';

export type CanonicalApprovalStatus =
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'CLARIFICATION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED';

export type CanonicalPaymentStatus =
  | 'UNPAID'
  | 'DISBURSEMENT_RECORDED'
  | 'SETTLED'
  | 'PAYMENT_ISSUE';

export type CanonicalAccountabilityStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'CLOSED'
  | 'OVERDUE';

export type CanonicalDisbursementStatus =
  | 'AWAITING_RECIPIENT_CONFIRMATION'
  | 'RECIPIENT_CONFIRMED'
  | 'RECIPIENT_REPORTED_ISSUE';

/**
 * Documented mapping from historical/legacy approval status values to canonical states.
 */
export const APPROVAL_STATUS_LEGACY_MAP: Record<string, CanonicalApprovalStatus> = {
  SUBMITTED: 'SUBMITTED',
  PENDING: 'SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  CLARIFICATION_REQUESTED: 'CLARIFICATION_REQUESTED',
  REQUIRES_CLARIFICATION: 'CLARIFICATION_REQUESTED',
  NEEDS_CLARIFICATION: 'CLARIFICATION_REQUESTED',
  ON_HOLD: 'CLARIFICATION_REQUESTED',
  APPROVED: 'APPROVED',
  PAID: 'APPROVED',
  DISBURSED: 'APPROVED',
  SETTLED: 'APPROVED',
  REJECTED: 'REJECTED',
  DECLINED: 'REJECTED',
};

/**
 * Documented mapping from historical/legacy payment status values to canonical states.
 * Note: Legacy `PAID` is mapped to `SETTLED` if recipient confirmation is complete,
 * or `DISBURSEMENT_RECORDED` while awaiting recipient confirmation.
 */
export function normalizePaymentStatus(
  rawStatus: string | null | undefined,
  disbursementStatus?: string | null
): CanonicalPaymentStatus {
  const upper = String(rawStatus || 'UNPAID').trim().toUpperCase();
  const disbUpper = String(disbursementStatus || '').trim().toUpperCase();

  if (
    upper === 'PAYMENT_ISSUE' ||
    upper === 'RECIPIENT_REPORTED_ISSUE' ||
    disbUpper === 'RECIPIENT_REPORTED_ISSUE'
  ) {
    return 'PAYMENT_ISSUE';
  }
  if (upper === 'SETTLED' || disbUpper === 'RECIPIENT_CONFIRMED') {
    return 'SETTLED';
  }
  if (upper === 'DISBURSEMENT_RECORDED' || upper === 'AWAITING_CONFIRMATION') {
    return 'DISBURSEMENT_RECORDED';
  }
  if (upper === 'PAID') {
    if (disbUpper === 'AWAITING_RECIPIENT_CONFIRMATION') {
      return 'DISBURSEMENT_RECORDED';
    }
    return 'SETTLED';
  }
  return 'UNPAID';
}

export function normalizeApprovalStatus(rawStatus: string | null | undefined): CanonicalApprovalStatus {
  const upper = String(rawStatus || 'SUBMITTED').trim().toUpperCase();
  return APPROVAL_STATUS_LEGACY_MAP[upper] || 'SUBMITTED';
}

export function normalizeAccountabilityStatus(
  rawStatus: string | null | undefined
): CanonicalAccountabilityStatus {
  const upper = String(rawStatus || 'PENDING').trim().toUpperCase();
  if (upper === 'NOT_REQUIRED' || upper === 'EXEMPT') return 'NOT_REQUIRED';
  if (upper === 'PENDING' || upper === 'PENDING_SUBMISSION' || upper === 'OPEN') return 'PENDING';
  if (upper === 'SUBMITTED' || upper === 'EVIDENCE_SUBMITTED') return 'SUBMITTED';
  if (upper === 'VERIFIED') return 'VERIFIED';
  if (upper === 'CLOSED' || upper === 'CLEARED' || upper === 'RECONCILED') return 'CLOSED';
  if (upper === 'OVERDUE' || upper === 'FLAGGED') return 'OVERDUE';
  return 'PENDING';
}

const ALLOWED_APPROVAL_TRANSITIONS: Record<CanonicalApprovalStatus, CanonicalApprovalStatus[]> = {
  SUBMITTED: ['IN_REVIEW', 'CLARIFICATION_REQUESTED', 'APPROVED', 'REJECTED'],
  IN_REVIEW: ['CLARIFICATION_REQUESTED', 'APPROVED', 'REJECTED'],
  CLARIFICATION_REQUESTED: ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

export function canTransitionApprovalStatus(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined
): boolean {
  const from = normalizeApprovalStatus(fromRaw);
  const to = normalizeApprovalStatus(toRaw);
  if (from === to) return true;
  return ALLOWED_APPROVAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface SerializedMoney {
  /** Exact integer minor units (kobo) as string to prevent JS Number overflow */
  minor: string;
  /** Major units (Naira) rounded to 2 decimal places */
  naira: number;
  /** Exact major units string (e.g. "12500.50") */
  nairaExact: string;
  /** Formatted currency display string (e.g. "₦12,500.50" or "₦12,500") */
  formatted: string;
  currency: string;
}

/**
 * Converts a Naira value (number or string) to exact BigInt kobo using string-safe
 * integer parsing to eliminate IEEE-754 floating-point drift (e.g. 19.99 * 100 = 1998.9999999999998).
 */
export function nairaToKoboBigInt(nairaInput: number | string | bigint): bigint {
  if (typeof nairaInput === 'bigint') {
    return nairaInput * BigInt(100);
  }
  const raw = String(nairaInput ?? '0')
    .replace(/[₦,\s]/g, '')
    .trim();
  if (!raw || raw === '-') {
    throw new Error(`Invalid Naira amount: "${nairaInput}"`);
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid numeric Naira amount: "${nairaInput}"`);
    }
    return BigInt(Math.round(parsed * 100));
  }

  const isNegative = raw.startsWith('-');
  const unsigned = isNegative ? raw.slice(1) : raw;
  const [wholePart, fracPart = ''] = unsigned.split('.');

  const wholeBig = BigInt(wholePart || '0') * BigInt(100);
  const paddedFrac = (fracPart + '000').slice(0, 3);
  const twoDigits = BigInt(paddedFrac.slice(0, 2));
  const thirdDigit = Number(paddedFrac[2] || '0');
  const roundedFrac = thirdDigit >= 5 ? twoDigits + BigInt(1) : twoDigits;

  const totalKobo = wholeBig + roundedFrac;
  return isNegative ? -totalKobo : totalKobo;
}

/**
 * Converts a Prisma Decimal, string, or number (major units) to exact BigInt kobo.
 */
export function decimalToKoboBigInt(decimalValue: unknown): bigint {
  if (decimalValue === null || decimalValue === undefined) return BigInt(0);
  if (typeof decimalValue === 'bigint') return decimalValue;
  if (typeof decimalValue === 'object' && decimalValue !== null && 'toString' in decimalValue) {
    return nairaToKoboBigInt(String((decimalValue as { toString(): string }).toString()));
  }
  return nairaToKoboBigInt(String(decimalValue));
}

/**
 * Serializes a kobo (minor unit) value into a deterministic money envelope
 * preserving exact BigInt string representation alongside Naira number and formatted string.
 */
export function koboToNairaExact(
  minorInput: bigint | number | string | null | undefined,
  currency: string = 'NGN'
): SerializedMoney {
  let minorBig: bigint;
  if (typeof minorInput === 'bigint') {
    minorBig = minorInput;
  } else if (typeof minorInput === 'number') {
    minorBig = BigInt(Math.round(minorInput));
  } else if (typeof minorInput === 'string' && minorInput.trim() !== '') {
    const cleaned = minorInput.trim();
    minorBig = /^-?\d+$/.test(cleaned) ? BigInt(cleaned) : BigInt(Math.round(Number(cleaned) || 0));
  } else {
    minorBig = BigInt(0);
  }

  const isNegative = minorBig < BigInt(0);
  const absMinor = isNegative ? -minorBig : minorBig;
  const wholeNaira = absMinor / BigInt(100);
  const koboRemainder = absMinor % BigInt(100);

  const signPrefix = isNegative ? '-' : '';
  const nairaExact = `${signPrefix}${wholeNaira.toString()}.${koboRemainder.toString().padStart(2, '0')}`;
  const nairaNumber = Number(nairaExact);

  const hasFraction = koboRemainder !== BigInt(0);
  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(nairaNumber);

  return {
    minor: minorBig.toString(),
    naira: nairaNumber,
    nairaExact,
    formatted,
    currency,
  };
}
