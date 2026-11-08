import { prisma } from '../src/lib/prisma';
async function main() {
  const checks = await prisma.$queryRaw<Array<{ check: string; count: bigint }>>`
    SELECT 'duplicate_payment_references' AS check, count(*) FROM (SELECT "externalReference" FROM "Disbursement" GROUP BY "externalReference" HAVING count(*) > 1) d
    UNION ALL SELECT 'duplicate_receipt_checksums', count(*) FROM (SELECT "sha256" FROM "PaymentReceipt" GROUP BY "sha256" HAVING count(*) > 1) d
    UNION ALL SELECT 'active_gmd_accounts', count(*) FROM "Employee" WHERE "role" = 'GMD' AND "status" = 'ACTIVE' AND "approvalStatus" = 'APPROVED'
    UNION ALL SELECT 'nonpositive_payments', count(*) FROM "Disbursement" WHERE "amountMinor" <= 0
    UNION ALL SELECT 'negative_bank_balances', count(*) FROM "CompanyBankAccount" WHERE "balance" < 0
    UNION ALL SELECT 'nonpositive_requests', count(*) FROM "ExpenditureRequest" WHERE "amountMinor" <= 0
    UNION ALL SELECT 'legacy_employee_roles', count(*) FROM "Employee" WHERE "role" NOT IN ('STAFF', 'GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN')
    UNION ALL SELECT 'legacy_approval_roles', count(*) FROM "ApprovalPolicy" WHERE "requiredRole" NOT IN ('GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN')
  `;
  console.log(JSON.stringify(checks, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  if (checks.some(check => Number(check.count) > (check.check === 'active_gmd_accounts' ? 1 : 0))) process.exitCode = 1;
}
main().finally(() => prisma.$disconnect()).catch(() => { console.error('Preflight could not complete.'); process.exitCode = 1; });
