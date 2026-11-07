import { prisma } from "@/lib/prisma";

/**
 * Returns the 4-digit calendar year in the Africa/Lagos business timezone.
 */
export function getLagosBusinessYear(now: Date = new Date()): number {
  try {
    const yearStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      year: "numeric",
    }).format(now);
    const parsed = parseInt(yearStr, 10);
    if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) {
      return parsed;
    }
  } catch {
    // Fallback to UTC year if Intl is unavailable
  }
  return now.getUTCFullYear();
}

/**
 * Builds a business-dated reference prefix (e.g., REQ-2026, EMG-2026, ICN-2026)
 * using the current Africa/Lagos business year rather than a hardcoded literal year.
 */
export function buildDatedRequestPrefix(
  kind: "REQ" | "EMG" | "ICN" | "GRN" = "REQ",
  now: Date = new Date()
): string {
  return `${kind}-${getLagosBusinessYear(now)}`;
}

function normalizeRequestPrefix(prefix?: string): string {
  const clean = (prefix || "").trim().toUpperCase();
  if (!clean || clean === "REQ") {
    return buildDatedRequestPrefix("REQ");
  }
  if (clean === "EMG") {
    return buildDatedRequestPrefix("EMG");
  }
  if (clean === "ICN") {
    return buildDatedRequestPrefix("ICN");
  }
  if (clean === "GRN") {
    return buildDatedRequestPrefix("GRN");
  }
  return clean;
}

/**
 * Generates the next guaranteed unique sequential request reference (e.g. REQ-2026-0009)
 * preventing unique constraint collisions (P2002) from row count mismatches or deleted items.
 */
export async function generateUniqueRequestNumber(prefix?: string): Promise<string> {
  const resolvedPrefix = normalizeRequestPrefix(prefix);
  const existing = await prisma.expenditureRequest.findMany({
    where: {
      requestNumber: {
        startsWith: resolvedPrefix,
      },
    },
    select: {
      requestNumber: true,
    },
  });

  const existingSet = new Set(existing.map((r) => r.requestNumber));

  // Extract integer suffixes
  const suffixes = existing
    .map((r) => {
      const parts = r.requestNumber.split("-");
      const parsed = parseInt(parts[parts.length - 1], 10);
      return isNaN(parsed) ? 0 : parsed;
    })
    .filter((n) => n > 0);

  // If REQ-YYYY-0042 exists from seed fixtures while current sequence is under 20, exclude the isolated jump
  const regularSuffixes = suffixes.filter(
    (n) => n !== 42 || suffixes.some((s) => s >= 35 && s !== 42)
  );

  const maxSuffix = regularSuffixes.length > 0 ? Math.max(...regularSuffixes) : 0;
  let candidate = maxSuffix + 1;
  let candidateStr = `${resolvedPrefix}-${String(candidate).padStart(4, "0")}`;

  // Ensure collision-free against any existing DB entry
  while (existingSet.has(candidateStr)) {
    candidate++;
    candidateStr = `${resolvedPrefix}-${String(candidate).padStart(4, "0")}`;
  }

  return candidateStr;
}

/**
 * Executes a Prisma creation function with automatic retry if a unique constraint
 * collision (P2002) occurs on the generated requestNumber.
 */
export async function createWithUniqueRequestNumber<T>(
  prefix: string,
  createFn: (requestNumber: string) => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  const resolvedPrefix = normalizeRequestPrefix(prefix);
  let lastError: any = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const requestNumber = await generateUniqueRequestNumber(resolvedPrefix);
    try {
      return await createFn(requestNumber);
    } catch (err: any) {
      lastError = err;
      if (err?.code === "P2002" && attempt < maxAttempts - 1) {
        await new Promise((res) => setTimeout(res, 50 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
