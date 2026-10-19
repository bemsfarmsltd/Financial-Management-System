const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable, globally unique identifier for any expenditure request. */
export function toSystemRequestId(id: string): string {
  return `SYS-${id.toUpperCase()}`;
}

/** Keep old request references valid while also accepting SYS IDs and raw UUIDs. */
export function requestIdentifierWhere(identifier: string) {
  const candidate = identifier.toUpperCase().startsWith('SYS-') ? identifier.slice(4) : identifier;
  return UUID_PATTERN.test(candidate)
    ? { id: candidate.toLowerCase() }
    : { requestNumber: identifier };
}
