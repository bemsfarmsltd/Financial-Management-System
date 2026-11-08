# Monnify wallet rollout and operations

This runbook accompanies the source implementation. We will review the merchant setup and pilot together. It is not authorization to deploy, fund accounts or make real payments.

## 1. Prepare the environment

Use a separate merchant sandbox first. Server configuration comes from `.env.example`; secrets must remain outside Git, Flutter builds, browser code, AI context and screenshots. Explicitly select sandbox/live and the single source account. Configure the actual active, approved GMD employee ID in `BEMS_FINANCIAL_GMD_ID`. A role edit alone cannot change that financial designation.

Confirm merchant disbursement entitlement, supported bank-name enquiry, transfer status fields and actual fee reporting. Confirm the provider's IP restrictions, unattended authorization/OTP arrangement and transaction-reference rules. Use the real current merchant documentation and sandbox responses; mocked tests cannot establish these contracts. The adapter refuses missing evidence and has bounded network timeouts.

Configure a verified worst-case company transfer fee in integer kobo, the base fee reserve and reviewed withdrawal limits. The reserve grows with the number of minimum-sized withdrawals that approved entitlements could generate. An excessively low minimum or high fee ceiling can therefore make releases unavailable; this is explicit backing protection. Staff always receive the approved principal.

Configure the raw-body transfer webhook with its signing secret and expected HMAC contract. The optional transaction-validation callback uses a different protocol and is disabled by default; verify it separately before enabling it. An unsigned sandbox callback may wake a query only, never create approval or settlement. A provider transfer response accepting submission is not proof of success.

Rotate the formerly embedded automation credential in its owning service. Set distinct delegation signing and automation credentials using secret storage. Rebuild clients without any shared service key.

## 2. Database and opening review

Back up the intended database and verify the connection target. Apply the reviewed migration sequence with `prisma migrate deploy`, including wallet foundation and execution. Generate the Prisma client in the real deployment workspace. Never use schema-push as a substitute for the SQL migrations and journal triggers.

Run `npm run corrections:preflight` and `npm run wallet:preflight` as read-only checks. Inventory legacy paid/unpaid requests, salary batches, HR clearing, vendor transfers, pending proposals, all historical budget commitments and unresolved bank payments. Do not bulk-credit old APPROVED records; they may already be paid or approved under obsolete authority.

Agree and configure `BEMS_WALLET_CUTOVER_AT` as an ISO timestamp. Classify each opening source before release. Old paid sources stay historical. Unknown liabilities need investigation. Review any opening employee entitlement explicitly with GMD and prevent parallel legacy payment. Enabling a flag does not migrate opening liabilities.

Refresh verified backing with the pool paused. Create only funded envelopes whose combined remaining values, liabilities and fees fit the verified source. Parent/child envelopes subdivide an allocation. Planning budgets cannot create withdrawable money. No manual balance editing is part of this procedure.

## 3. Workers, callbacks and reconciliation

Deploy `npm run wallet:process` on a reliable scheduler. It processes bounded jobs and exits; it is not a permanently running daemon. Schedule frequent runs with logs and failure monitoring. Overlapping runs are fenced by durable leases. Keep server runtime limits longer than bounded provider calls. Keep existing delivery-outbox processing scheduled separately.

Configure callback HTTPS URLs `/api/webhooks/monnify` and, only if separately enabled, `/api/webhooks/monnify/validate-transfer`. Verify authentic signature, duplicate delivery, pending, success, rejection, timeout, delayed callback and reversal using actual sandbox events. Verify a lost submit response never produces a fresh-reference resend.

Run `npm run wallet:reconcile` regularly and after incidents. The dashboard/mobile reconciliation control uses the same service. A scan pauses new commitments and submissions, queues authenticated reference checks and refreshes funding. If `historyComplete` is false, increase the reviewed page bound and repeat; do not treat the partial scan as a clean reconciliation. Run workers to resolve queued status checks before attempting GMD activation.

Monitor oldest pending/unknown intent, callback inbox age, worker errors, funding freshness, negative backing, unresolved issues, actual fees above reserve and unmatched references. Keep notifications free of full bank details and secrets.

## 4. Acceptance and activation

In sandbox, perform each role's browser and physical-device acceptance. Verify staff/HR/Admin cannot call AI routes or approve money, including direct API requests. Verify approved leave access; blocked suspended accounts must preserve existing entitlements.

Exercise request categories, multi-subsidiary whole payroll, partial withdrawals, combined sources, bank changes, cancellation, return of unused project funds, vendor three-way match/direct transfer and failure/reversal. Verify company fees, stable references, journals, source statuses and accountability. Confirm the external n8n workflow uses the new signed GMD delegation and returns stored proposal identifiers rather than fabricated approvals; source changes do not update a hosted n8n workflow.

Review limits, name-mismatch support and pending-transfer messaging with the owner. Build and sign mobile releases only after the intended server is verified. Arrange a controlled live pilot and reconciliation before wider activation.

For live operation, the code requires explicit live-enabled, opening-reconciled and transfers-enabled flags in addition to wallet mode. Those flags record completed operational work; they must not be set to skip it. Funding starts paused. Only designated GMD can activate after fresh matching backing, no unresolved issues and no due reconciliation work. The UI uses a session-bound current-password challenge. Staff then withdraw released funds with their own challenge and no second GMD approval.

## 5. Incident handling

Pause new commitments/submissions on uncertainty. Reconciliation continues for already submitted references. Record the merchant reference, source and issue code; investigate through authenticated provider history. Do not remove holds, edit posted journals, invent zero fees or resubmit under a new reference just because a screen times out.

Definitive rejection/failure restores the held entitlement or original vendor envelope once. Success consumes principal and actual company fees once. Authenticated reversal has its own compensating entry. A vendor retry after confirmed failure/reversal requires a new GMD proposal and approval.

Only corrected provider setup D04/D06 or fee-ceiling issues have a restricted GMD acknowledgment action. It requires a correction note and fresh backing and does not activate the pool. Unmatched payments and amount/bank/reference mismatches require evidence-driven repair; they cannot be dismissed with that button.

Do not roll back to legacy payment writers for wallet-released sources. Keep the ledger, source uniqueness, transfer references and reconciliation available. Database restore requires reconciliation against provider events before resuming jobs. GMD succession or blocked employee settlement must follow a separately reviewed recovery process, without granting another role disbursement approval.
