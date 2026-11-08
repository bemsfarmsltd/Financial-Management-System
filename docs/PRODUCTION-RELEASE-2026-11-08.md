# Production release — 8 November 2026

The owner authorized production deployment and confirmed Hostinger automatically deploys the GitHub main branch.

## Database preparation completed

- Read-only preflight passed: no duplicate payment references or receipt checksums, nonpositive payments/requests, negative bank balances, invalid legacy roles or conflicting active GMD accounts.
- The production public schema matched the repository baseline exactly. The baseline was recorded as applied; no baseline CREATE TABLE statements were run against existing company tables.
- A full private database archive was created. Its public schema and data were restored into an isolated local database, where the full additive migration sequence passed before production execution.
- All six migrations are applied in production. New wallet tables, shared security rate limits, delivery outbox, constraints and immutable journals are present. Existing business rows were not reseeded or deleted.
- Production financial tables have row-level security enabled. Public-access policies were checked separately.
- The backup is retained in `.private-release-backups/`, outside Git, with owner-only directory/file permissions. Never publish it or upload it as a build artifact.

## Published source scope

Security and authorization corrections, shared financial commands, GMD-only AI, staff wallets, funded subsidiary budgets, whole-payroll net release, direct verified vendor payments, company-paid fees, durable transfer processing, callbacks, reconciliation, web screens and both Flutter source applications.

Wallet reads support authenticated read-only review while wallet mode is disabled. The review banner and disabled controls distinguish an inactive wallet from a working payment environment. Backend execution gates remain enforced independently of the interface. There are no seeded demonstration balances or invented live transfers.

## Verification

Production build, TypeScript, architecture contracts (177 routes), behavioral security regressions, disposable PostgreSQL wallet/provider tests and existing financial/scoped-read/outbox regressions passed during release preparation. Both Flutter analyzers and relevant money/storage tests passed. Real browser GMD approval/staff withdrawal tests used disposable local data, not production company accounts.

GitHub and Hostinger deployment outcomes must be verified against the pushed commit and live endpoint. A successful push alone is not evidence that the host finished deploying.

## Operational limits

This release does not activate Monnify payments, approve opening entitlements, fund budgets, send transfers, configure merchant callbacks, change hosted n8n workflows or publish newly signed Android applications. The supplied live Monnify connection check returned HTTP 403 and has not established provider authentication.

Hostinger must supply the dedicated delegation-signing secret and current n8n configuration for the new GMD AI contract. Existing shared-key impersonation is deliberately rejected. Merchant acceptance, opening reconciliation, fee policy, scheduled processing and controlled live activation remain governed by the wallet rollout runbook. Android source publication does not upgrade already-installed apps; signed builds and device acceptance remain separate.

## Recovery

If the new application fails its smoke checks, redeploy the previous application commit while investigating. The additive database tables and immutable history should stay in place; do not run destructive down migrations or resume legacy payment writers for a wallet-released source. Any database restore requires provider-reference reconciliation before financial processing resumes.
