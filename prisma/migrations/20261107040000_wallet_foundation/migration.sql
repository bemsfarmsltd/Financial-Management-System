-- Internal NGN liabilities only. No provider sub-wallets and no automatic legacy credits.
CREATE TABLE "WalletFundingPool" (
  "id" TEXT PRIMARY KEY CHECK ("id" = 'MONNIFY_NGN'),
  "environment" TEXT NOT NULL CHECK ("environment" IN ('sandbox', 'live')),
  "sourceAccount" TEXT NOT NULL,
  "availableMinor" BIGINT NOT NULL CHECK ("availableMinor" >= 0),
  "feeReserveMinor" BIGINT NOT NULL CHECK ("feeReserveMinor" >= 0),
  "observedAt" TIMESTAMPTZ NOT NULL,
  "observationId" TEXT NOT NULL,
  "paused" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE "WalletBudgetEnvelope" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT,
  "label" TEXT NOT NULL,
  "allocatedMinor" BIGINT NOT NULL CHECK ("allocatedMinor" > 0),
  "remainingMinor" BIGINT NOT NULL CHECK ("remainingMinor" >= 0 AND "remainingMinor" <= "allocatedMinor"),
  "createdById" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "WalletReleaseProposal" (
  "id" TEXT PRIMARY KEY,
  "createdById" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "sourceType" TEXT NOT NULL CHECK ("sourceType" IN ('REQUEST', 'PAYROLL_ITEM')),
  "sourceId" TEXT NOT NULL,
  "envelopeId" TEXT NOT NULL REFERENCES "WalletBudgetEnvelope"("id") ON DELETE RESTRICT,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0),
  "category" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "confirmationHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','EXECUTED','CANCELED')),
  "approvedById" TEXT REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "approvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (("status" = 'EXECUTED') = ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL))
);
CREATE TABLE "WalletCreditLot" (
  "id" TEXT PRIMARY KEY,
  "proposalId" TEXT NOT NULL UNIQUE REFERENCES "WalletReleaseProposal"("id") ON DELETE RESTRICT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT,
  "category" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0),
  "availableMinor" BIGINT NOT NULL CHECK ("availableMinor" >= 0),
  "heldMinor" BIGINT NOT NULL DEFAULT 0 CHECK ("heldMinor" >= 0),
  "settledMinor" BIGINT NOT NULL DEFAULT 0 CHECK ("settledMinor" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("sourceType", "sourceId"),
  CHECK ("availableMinor" + "heldMinor" + "settledMinor" = "amountMinor")
);
CREATE INDEX "WalletCreditLot_owner" ON "WalletCreditLot"("employeeId", "createdAt");
CREATE TABLE "WalletJournal" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('BUDGET_ALLOCATED','WALLET_CREDITED')),
  "reference" TEXT NOT NULL UNIQUE,
  "actorId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
  "postingTx" BIGINT NOT NULL DEFAULT txid_current(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "WalletJournalEntry" (
  "id" TEXT PRIMARY KEY,
  "journalId" TEXT NOT NULL REFERENCES "WalletJournal"("id") ON DELETE RESTRICT,
  "accountKey" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" <> 0)
);
CREATE INDEX "WalletJournalEntry_journal" ON "WalletJournalEntry"("journalId");
-- Enforce complete balanced posting at commit, rather than after each entry insert.
CREATE FUNCTION bems_wallet_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journal_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'WalletJournal' THEN journal_id := NEW."id"; ELSE journal_id := NEW."journalId"; END IF;
  IF (SELECT count(*) FROM "WalletJournalEntry" WHERE "journalId" = journal_id) < 2
    OR (SELECT COALESCE(sum("amountMinor"),0) FROM "WalletJournalEntry" WHERE "journalId" = journal_id) <> 0 THEN
    RAISE EXCEPTION 'Wallet journal must contain at least two balanced entries';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "wallet_journal_balanced" AFTER INSERT ON "WalletJournal"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bems_wallet_balanced_journal();
CREATE CONSTRAINT TRIGGER "wallet_entry_balanced" AFTER INSERT ON "WalletJournalEntry"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bems_wallet_balanced_journal();
CREATE FUNCTION bems_wallet_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Posted wallet journals are immutable'; END $$;
CREATE TRIGGER "wallet_journal_immutable" BEFORE UPDATE OR DELETE ON "WalletJournal"
  FOR EACH ROW EXECUTE FUNCTION bems_wallet_immutable();
CREATE TRIGGER "wallet_entry_immutable" BEFORE UPDATE OR DELETE ON "WalletJournalEntry"
  FOR EACH ROW EXECUTE FUNCTION bems_wallet_immutable();

CREATE FUNCTION bems_wallet_same_posting_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "WalletJournal" WHERE "id" = NEW."journalId" AND "postingTx" = txid_current()) THEN
    RAISE EXCEPTION 'Cannot append entries to a posted wallet journal';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "wallet_entry_posting_transaction" BEFORE INSERT ON "WalletJournalEntry"
  FOR EACH ROW EXECUTE FUNCTION bems_wallet_same_posting_transaction();
