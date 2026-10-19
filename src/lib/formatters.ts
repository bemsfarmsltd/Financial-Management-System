/**
 * Monetary and date formatters adhering to minor-unit precision
 */

export function formatMoney(amountMinor: bigint | number | string, currency: string = "NGN"): string {
  const value = typeof amountMinor === "bigint" ? Number(amountMinor) : Number(amountMinor);
  const majorUnits = value / 100;
  
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(majorUnits);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "APPROVED":
    case "VERIFIED_PAID":
    case "VERIFIED":
    case "RECIPIENT_CONFIRMED":
    case "CLOSED":
      return {
        bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        dot: "bg-emerald-400",
        label: status === "RECIPIENT_CONFIRMED" ? "RECEIPT CONFIRMED" : status.replaceAll("_", " "),
      };
    case "IN_REVIEW":
    case "EVIDENCE_SUBMITTED":
    case "PENDING_VERIFICATION":
    case "AWAITING_RECIPIENT_CONFIRMATION":
      return {
        bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        dot: "bg-amber-400",
        label: "AWAITING STAFF CONFIRMATION",
      };
    case "CLARIFICATION_REQUESTED":
      return {
        bg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        dot: "bg-purple-400",
        label: "CLARIFICATION",
      };
    case "REJECTED":
    case "RECIPIENT_REPORTED_ISSUE":
      return {
        bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        dot: "bg-rose-400",
        label: "PAYMENT ISSUE REPORTED",
      };
    case "UNPAID":
    case "PENDING":
    case "SUBMITTED":
    default:
      return {
        bg: "bg-slate-500/10 text-slate-300 border-slate-500/20",
        dot: "bg-slate-400",
        label: status.replace("_", " "),
      };
  }
}
