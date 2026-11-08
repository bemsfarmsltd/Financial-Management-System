-- Existing duplicates must be reconciled before applying these unique indexes.
-- PostgreSQL refuses duplicates instead of deleting financial history.
CREATE UNIQUE INDEX "Disbursement_externalReference_key" ON "Disbursement"("externalReference");
CREATE UNIQUE INDEX "PaymentReceipt_sha256_key" ON "PaymentReceipt"("sha256");
CREATE UNIQUE INDEX "Employee_single_active_gmd" ON "Employee"("role") WHERE "role" = 'GMD' AND "status" = 'ACTIVE' AND "approvalStatus" = 'APPROVED';
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_positive_amount" CHECK ("amountMinor" > 0) NOT VALID;
ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_nonnegative_balance" CHECK ("balance" >= 0) NOT VALID;
ALTER TABLE "ExpenditureRequest" ADD CONSTRAINT "ExpenditureRequest_positive_amount" CHECK ("amountMinor" > 0) NOT VALID;
