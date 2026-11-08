ALTER TABLE "WalletBudgetEnvelope" ADD COLUMN "parentId" TEXT REFERENCES "WalletBudgetEnvelope"("id") ON DELETE RESTRICT,
 ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','CLOSED')),
 ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WalletReleaseProposal" DROP CONSTRAINT "WalletReleaseProposal_sourceType_check";
ALTER TABLE "WalletReleaseProposal" ADD CHECK ("sourceType" IN ('REQUEST','PAYROLL_BATCH'));
ALTER TABLE "WalletReleaseProposal" ALTER COLUMN "employeeId" DROP NOT NULL, ALTER COLUMN "envelopeId" DROP NOT NULL;
ALTER TABLE "WalletReleaseProposal" ADD COLUMN "conversationId" TEXT, ADD COLUMN "workspaceId" TEXT;
-- Old pending previews do not contain execution item snapshots or strong auth.
UPDATE "WalletReleaseProposal" SET "status"='CANCELED' WHERE "status"='PENDING';
CREATE TABLE "WalletReleaseItem" (
 "id" TEXT PRIMARY KEY, "proposalId" TEXT NOT NULL REFERENCES "WalletReleaseProposal"("id"),
 "sourceType" TEXT NOT NULL CHECK ("sourceType" IN ('REQUEST','PAYROLL_ITEM')),
 "sourceId" TEXT NOT NULL, "employeeId" TEXT NOT NULL REFERENCES "Employee"("id"),
 "organizationId" TEXT NOT NULL REFERENCES "Organization"("id"),
 "envelopeId" TEXT NOT NULL REFERENCES "WalletBudgetEnvelope"("id"),
 "amountMinor" BIGINT NOT NULL CHECK ("amountMinor">0), "category" TEXT NOT NULL,
 UNIQUE("proposalId","sourceType","sourceId","organizationId")
);
ALTER TABLE "WalletCreditLot" DROP CONSTRAINT "WalletCreditLot_proposalId_key", DROP CONSTRAINT "WalletCreditLot_sourceType_sourceId_key";
ALTER TABLE "WalletCreditLot" ADD COLUMN "releaseItemId" TEXT UNIQUE REFERENCES "WalletReleaseItem"("id"),
 ADD COLUMN "frozen" BOOLEAN NOT NULL DEFAULT false,
 ADD UNIQUE("sourceType","sourceId","organizationId");
ALTER TABLE "WalletJournal" DROP CONSTRAINT "WalletJournal_kind_check";
ALTER TABLE "WalletJournal" ADD CHECK ("kind" IN ('BUDGET_ALLOCATED','BUDGET_ADJUSTED','WALLET_CREDITED','WITHDRAWAL_HELD','WITHDRAWAL_SETTLED','WITHDRAWAL_RELEASED','WITHDRAWAL_REVERSED','TRANSFER_FEE'));
CREATE TABLE "WalletBankAccount" (
 "id" TEXT PRIMARY KEY, "employeeId" TEXT NOT NULL REFERENCES "Employee"("id"),
 "accountNumber" TEXT NOT NULL CHECK ("accountNumber" ~ '^\d{10}$'),
 "bankCode" TEXT NOT NULL CHECK ("bankCode" ~ '^\d{3,6}$'), "accountName" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "verifiedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE("employeeId","fingerprint")
);
CREATE UNIQUE INDEX "WalletBankAccount_one_active" ON "WalletBankAccount"("employeeId") WHERE "active";
CREATE TABLE "WalletChallenge" (
 "id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL REFERENCES "Employee"("id"),
 "purpose" TEXT NOT NULL CHECK ("purpose" IN ('RELEASE','WITHDRAWAL','POOL_CONTROL')),
 "payloadHash" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "sessionHash" TEXT NOT NULL,
 "credentialHash" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "usedAt" TIMESTAMPTZ
);
CREATE INDEX "WalletChallenge_expiry" ON "WalletChallenge"("expiresAt");
CREATE TABLE "WalletWithdrawal" (
 "id" TEXT PRIMARY KEY, "employeeId" TEXT NOT NULL REFERENCES "Employee"("id"),
 "amountMinor" BIGINT NOT NULL CHECK ("amountMinor">0), "feeLimitMinor" BIGINT NOT NULL CHECK ("feeLimitMinor">0),
 "feeMinor" BIGINT NOT NULL DEFAULT 0 CHECK ("feeMinor">=0),
 "reference" TEXT NOT NULL UNIQUE, "idempotencyKey" TEXT NOT NULL, "intentHash" TEXT NOT NULL,
 "environment" TEXT NOT NULL CHECK ("environment" IN ('sandbox','live')), "sourceAccount" TEXT NOT NULL,
 "bankAccountId" TEXT NOT NULL REFERENCES "WalletBankAccount"("id"),
 "bankCode" TEXT NOT NULL, "accountNumber" TEXT NOT NULL, "accountName" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'HELD' CHECK ("status" IN ('HELD','SUBMITTING','PENDING','UNKNOWN','SUCCEEDED','FAILED','REVERSED','CANCELED')),
 "providerReference" TEXT, "providerStatus" TEXT, "submittedAt" TIMESTAMPTZ,
 "leaseToken" TEXT, "leaseUntil" TIMESTAMPTZ, "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "attempts" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE("employeeId","idempotencyKey")
);
CREATE INDEX "WalletWithdrawal_queue" ON "WalletWithdrawal"("status","nextAttemptAt");
CREATE TABLE "WalletWithdrawalAllocation" (
 "id" TEXT PRIMARY KEY, "withdrawalId" TEXT NOT NULL REFERENCES "WalletWithdrawal"("id"),
 "creditLotId" TEXT NOT NULL REFERENCES "WalletCreditLot"("id"),
 "amountMinor" BIGINT NOT NULL CHECK ("amountMinor">0), UNIQUE("withdrawalId","creditLotId")
);
CREATE TABLE "WalletProviderInbox" (
 "id" TEXT PRIMARY KEY, "bodyHash" TEXT NOT NULL UNIQUE, "reference" TEXT NOT NULL,
 "eventType" TEXT NOT NULL, "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "WalletReconciliationIssue" (
 "id" TEXT PRIMARY KEY, "reference" TEXT, "code" TEXT NOT NULL, "detail" TEXT NOT NULL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "resolvedAt" TIMESTAMPTZ,
 "resolvedById" TEXT REFERENCES "Employee"("id")
);

CREATE TABLE "WalletPaidSource" ("key" TEXT PRIMARY KEY, "proposalId" TEXT NOT NULL REFERENCES "WalletReleaseProposal"("id"), "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "WalletBalanceObservation" ("id" TEXT PRIMARY KEY,"environment" TEXT NOT NULL,"sourceAccount" TEXT NOT NULL,"availableMinor" BIGINT NOT NULL CHECK ("availableMinor">=0),"observedAt" TIMESTAMPTZ NOT NULL);
CREATE TRIGGER "wallet_observation_immutable" BEFORE UPDATE OR DELETE ON "WalletBalanceObservation" FOR EACH ROW EXECUTE FUNCTION bems_wallet_immutable();
ALTER TABLE "WalletProviderInbox" ADD COLUMN "processedAt" TIMESTAMPTZ;
ALTER TABLE "WalletCreditLot" ADD COLUMN "returnedMinor" BIGINT NOT NULL DEFAULT 0 CHECK ("returnedMinor">=0);
ALTER TABLE "WalletCreditLot" DROP CONSTRAINT "WalletCreditLot_check";
ALTER TABLE "WalletCreditLot" ADD CHECK ("availableMinor"+"heldMinor"+"settledMinor"+"returnedMinor"="amountMinor");
ALTER TABLE "WalletChallenge" DROP CONSTRAINT "WalletChallenge_purpose_check";
ALTER TABLE "WalletChallenge" ADD CHECK ("purpose" IN ('RELEASE','WITHDRAWAL','POOL_CONTROL','RETURN_PROJECT'));
ALTER TABLE "WalletJournal" DROP CONSTRAINT "WalletJournal_kind_check";
ALTER TABLE "WalletJournal" ADD CHECK ("kind" IN ('BUDGET_ALLOCATED','BUDGET_ADJUSTED','WALLET_CREDITED','WITHDRAWAL_HELD','WITHDRAWAL_SETTLED','WITHDRAWAL_RELEASED','WITHDRAWAL_REVERSED','TRANSFER_FEE','PROJECT_FUNDS_RETURNED'));
CREATE TABLE "WalletProjectReturn" ("id" TEXT PRIMARY KEY,"employeeId" TEXT NOT NULL REFERENCES "Employee"("id"),"creditLotId" TEXT NOT NULL REFERENCES "WalletCreditLot"("id"),"amountMinor" BIGINT NOT NULL CHECK ("amountMinor">0),"reason" TEXT NOT NULL,"idempotencyKey" TEXT NOT NULL,"intentHash" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE("employeeId","idempotencyKey"));
-- Direct vendor disbursements share transfer recovery but never create staff credits.
ALTER TABLE "Vendor" ADD COLUMN "bankCode" TEXT, ADD COLUMN "bankFingerprint" TEXT, ADD COLUMN "verifiedBankAt" TIMESTAMPTZ;
ALTER TABLE "WalletReleaseItem" ALTER COLUMN "employeeId" DROP NOT NULL,
 ADD COLUMN "vendorId" TEXT REFERENCES "Vendor"("id"), ADD COLUMN "bankSnapshot" TEXT,
 ADD CHECK (("employeeId" IS NOT NULL AND "vendorId" IS NULL) OR ("employeeId" IS NULL AND "vendorId" IS NOT NULL));
ALTER TABLE "WalletWithdrawal" ALTER COLUMN "bankAccountId" DROP NOT NULL,
 ADD COLUMN "targetType" TEXT NOT NULL DEFAULT 'STAFF' CHECK ("targetType" IN ('STAFF','VENDOR')),
 ADD COLUMN "vendorId" TEXT REFERENCES "Vendor"("id"),
 ADD COLUMN "requestId" TEXT REFERENCES "ExpenditureRequest"("id"),
 ADD COLUMN "proposalId" TEXT REFERENCES "WalletReleaseProposal"("id"),
 ADD CHECK (("targetType"='STAFF' AND "bankAccountId" IS NOT NULL AND "vendorId" IS NULL) OR ("targetType"='VENDOR' AND "vendorId" IS NOT NULL AND "requestId" IS NOT NULL AND "proposalId" IS NOT NULL));
ALTER TABLE "WalletJournal" DROP CONSTRAINT "WalletJournal_kind_check";
ALTER TABLE "WalletJournal" ADD CHECK ("kind" IN ('BUDGET_ALLOCATED','BUDGET_ADJUSTED','WALLET_CREDITED','WITHDRAWAL_HELD','WITHDRAWAL_SETTLED','WITHDRAWAL_RELEASED','WITHDRAWAL_REVERSED','TRANSFER_FEE','PROJECT_FUNDS_RETURNED','VENDOR_PAYMENT_HELD'));
ALTER TABLE "WalletCreditLot" ADD COLUMN "requestId" TEXT REFERENCES "ExpenditureRequest"("id") ON DELETE RESTRICT,
 ADD COLUMN "payrollItemId" TEXT REFERENCES "PayrollItem"("id") ON DELETE RESTRICT;
UPDATE "WalletCreditLot" c SET "requestId"=r."id" FROM "ExpenditureRequest" r WHERE c."sourceType"='REQUEST' AND c."sourceId"=r."id";
UPDATE "WalletCreditLot" c SET "payrollItemId"=p."id" FROM "PayrollItem" p WHERE c."sourceType"='PAYROLL_ITEM' AND c."sourceId"=p."id";
ALTER TABLE "WalletCreditLot" ADD CONSTRAINT "WalletCreditLot_business_source" CHECK (("sourceType"='REQUEST' AND "requestId" IS NOT NULL AND "payrollItemId" IS NULL) OR ("sourceType"='PAYROLL_ITEM' AND "payrollItemId" IS NOT NULL AND "requestId" IS NULL)) NOT VALID;
