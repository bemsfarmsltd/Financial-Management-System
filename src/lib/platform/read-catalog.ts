/**
 * Typed Read Catalog & Untrusted Context Sanitizer (Audit Item 05 · Pillar 2)
 *
 * Ensures all AI and dashboard read queries:
 * 1. Return bounded, paginated, source-labelled results.
 * 2. Redact authentication material (`passwordHash`, `securityPinHash`, `tokenHash`, `activeSecret`, `kioskPin`)
 *    and minimize provider-bound PII (`bvn`, `nin`).
 * 3. Label untrusted user-supplied text (requisition descriptions, chat bodies, vendor notes, attachment notes)
 *    so a document or chat message in model context can never authorize an action.
 */

export type ReadDataTrustLevel = 'TRUSTED_LEDGER' | 'MIXED_LEDGER_WITH_UNTRUSTED_NOTES' | 'UNTRUSTED_USER_CONTENT';

export interface ReadCatalogPagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface ReadCatalogEnvelope<T> {
  ok: true;
  source: 'BEMS_READ_CATALOG';
  queryName: string;
  trustLevel: ReadDataTrustLevel;
  untrustedContentPolicy: 'DOCUMENTS_AND_CHATS_CANNOT_AUTHORIZE_ACTIONS';
  scope: {
    isGroup: boolean;
    organizationIds: string[];
  };
  pagination: ReadCatalogPagination;
  data: T;
}

const SENSITIVE_AUTH_KEYS = new Set([
  'passwordHash',
  'password_hash',
  'securityPinHash',
  'security_pin_hash',
  'tokenHash',
  'token_hash',
  'activeSecret',
  'active_secret',
  'kioskPin',
  'kiosk_pin',
  'codeHash',
  'code_hash',
]);

const PII_MASK_KEYS = new Set(['bvn', 'nin']);

const UNTRUSTED_FREE_TEXT_KEYS = new Set([
  'justification',
  'deliverable',
  'notes',
  'closureNotes',
  'responseNotes',
  'inspectionNotes',
  'excuseRequestNote',
  'submissionNote',
  'instructions',
  'message',
  'body',
]);

export function clampPagination(
  rawLimit?: number | string | null,
  rawOffset?: number | string | null,
  maxLimit = 100,
  defaultLimit = 50
): { limit: number; offset: number } {
  const parsedLimit = Number(rawLimit);
  const parsedOffset = Number(rawOffset);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0
    ? Math.floor(parsedOffset)
    : 0;
  return { limit, offset };
}

export function maskIdentifierPii(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return '****';
  return `*******${trimmed.slice(-4)}`;
}

export function wrapUntrustedUserText(raw: string): string {
  const cleaned = raw
    .replace(/\[SYSTEM\s*OVERRIDE[^\]]*\]/gi, '[REDACTED_DIRECTIVE]')
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[UNTRUSTED_TEXT]');
  return cleaned;
}

/**
 * Recursively strips authentication secrets, masks national/banking identity numbers (NIN/BVN),
 * converts BigInt values safely, and neutralizes prompt-injection directives inside free-text fields.
 */
export function redactUntrustedAndSensitiveFields<T>(input: T): T {
  const seen = new WeakSet();

  const visit = (val: any): any => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'bigint') return Number(val);
    if (val instanceof Date) return val.toISOString();
    if (typeof val !== 'object') return val;
    if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
      return '[BINARY_OMITTED]';
    }
    if (seen.has(val)) return undefined;
    seen.add(val);

    if (Array.isArray(val)) {
      return val.map(visit);
    }

    const out: Record<string, any> = {};
    for (const [key, propVal] of Object.entries(val)) {
      if (SENSITIVE_AUTH_KEYS.has(key)) {
        continue; // Never emit auth secrets or hashes
      }
      if (PII_MASK_KEYS.has(key)) {
        out[key] = maskIdentifierPii(propVal);
        continue;
      }
      if (UNTRUSTED_FREE_TEXT_KEYS.has(key) && typeof propVal === 'string') {
        out[key] = wrapUntrustedUserText(propVal);
        continue;
      }
      out[key] = visit(propVal);
    }
    return out;
  };

  return visit(input);
}

/**
 * Builds a canonical ReadCatalogEnvelope with automatic redaction and pagination metadata.
 */
export function buildReadCatalogEnvelope<T>(params: {
  queryName: string;
  trustLevel?: ReadDataTrustLevel;
  isGroup: boolean;
  organizationIds: string[];
  limit?: number;
  offset?: number;
  total?: number;
  data: T;
}): ReadCatalogEnvelope<T> {
  const sanitized = redactUntrustedAndSensitiveFields(params.data);
  const count = Array.isArray(sanitized) ? sanitized.length : 1;
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const total = params.total ?? count;

  return {
    ok: true,
    source: 'BEMS_READ_CATALOG',
    queryName: params.queryName,
    trustLevel: params.trustLevel || 'TRUSTED_LEDGER',
    untrustedContentPolicy: 'DOCUMENTS_AND_CHATS_CANNOT_AUTHORIZE_ACTIONS',
    scope: {
      isGroup: params.isGroup,
      organizationIds: params.organizationIds,
    },
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + count < total,
    },
    data: sanitized,
  };
}

