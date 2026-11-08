# Correction implementation and release record — 7 November 2026

This change set implements the security and financial corrections described below. It is not a claim that every dashboard operation has achieved complete AI execution parity. Production configuration, migration, credential rotation, provider verification, browser testing for each role, and signed mobile release tests remain separate release requirements.

## Implemented source changes

- Automation requires a dedicated signing key and a short-lived delegation. Shared service credentials cannot impersonate dashboard employees. Delegated reads inherit organization filters and may not write business records. Staging checks current role, operation mode, and the exact capability.
- Proposed actions preserve conversation and delegation context. Canonical material fields are displayed in the preview and hashed. Target snapshots detect changed records; blocked or old command versions cannot execute. Human confirmation remains required. Suspended or revoked accounts are rechecked inside execution transactions.
- Dashboard approvals, payment recording, budgets, treasury, approval policy changes, workspace settings, executive invitations, payroll preparation, accountability closure, template imports and report snapshots use shared commands/services with AI execution. Shared execution also covers task assignment/completion, leave management, emergency authorization, payroll sign-off/removal, intercompany issuance/settlement, and attendance policy/roster/station/override changes. Remaining parity work is listed below.
- Transfers require actual receipt bytes, an exact payer account, an approved target, a matching positive amount and a unique reference/checksum. Treasury debits use a conditional database update. Duplicate targets and insufficient balances roll back all associated records. Payroll intercompany notes participate in the payment transaction.
- Attendance station QR and PIN punch require an executive session or provisioned station credentials. Staff must be active and approved, with an active assignment in the station entity. Policies use the station entity.
- New uploads stay in durable storage. Private downloads require ownership or executive authority; unbound files fail closed for staff. A before-files rewrite sends legacy `/uploads` URLs through authorization even if an old copy still exists under `public/uploads`.
- Staged attachments require stored bytes and matching checksums. Evidence submission does not confirm recipient payment. The shared accountability close command requires real payment/evidence and updates both the case and request.
- Authentication no longer relies on a worker-local session cache. Rate limits use shared PostgreSQL counters and deny requests if their storage is unavailable. Login limits are account based. Proxy IP headers are trusted only when explicitly configured.
- Mobile sessions, saved staff credentials, executive PINs, and executive chat caches use platform secure storage. Executive chat/PIN keys are scoped by account. Backups are disabled on Android. Missing roles no longer default to GMD, and no default PIN unlock is accepted.
- Web chat caches are scoped by account and workspace, active conversation IDs persist, and New Chat creates a distinct server conversation. A failed AI call displays a retry message instead of invented financial results. The memory API cannot accept forged assistant messages from a header.
- APK activation requires verified artifact bytes, package identity, embedded version/build, checksum and an approved signing certificate. Downloads resolve active releases. Version gates compare Android build numbers.
- Report exports save actual scoped rows to a private immutable snapshot with an owner and 24-hour expiry. CSV cells escape spreadsheet formulas.
- Canonical invitation/chat emails enter a transactional outbox. Delivery failure stays queued; provider simulation is not reported as sent. Concurrent delivery workers use leases. Sent private payloads are erased. Ordinary in-app notification records remain part of the domain transaction.
- Employee onboarding/status audits are transactional and use actual organizations. Super Admin privilege changes and invitations require a Super Admin. Approval policies accept only the three-role architecture's executive roles; invalid legacy policy labels are visible as needing repair.
- Vendor rendering, optional approval reasons, unsupported policy actions, fake channel-live labels and several fixed health figures were corrected. Supported governance templates apply settings rather than saving only a marker.
- Migrations add financial uniqueness/check constraints, a single-active-GMD index, shared rate limits and the delivery outbox. Destructive seed scripts require explicit target and backup safeguards. CI runs contract, security and isolated database regressions.

## Validation

Run `npm run typecheck`, `npm run verify:platform`, `npm run test:security` and `npm run build`.

`npm run test:database` is guarded to require a database named `bems_corrections_test`. Apply migrations to that isolated database first. It covers concurrent payments, duplicate recording, concurrent confirmation, stale previews, revoked authority, atomic bulk rollback, reason policy, shared rate limiting, evidence closure, applied templates, scoped snapshots, privilege escalation, real Prisma scope filters, and mocked provider retries. It does not send real emails.

Each Flutter app includes `test/security_storage_test.dart`. Run Flutter analysis and these tests in both app directories. These are storage and logic checks; they do not certify Android KeyStore behavior on physical devices or a release signing chain.

## Deployment sequence

1. Take and restore-test a database backup. Run `npm run corrections:preflight` against the intended database. Reconcile duplicates, invalid balances/amounts and legacy role data through reviewed corrections; do not delete financial history to force indexes through.
2. For an existing database without Prisma migration history, compare its schema with the baseline. Only when it matches, mark `20261107000000_baseline` applied using `prisma migrate resolve --applied 20261107000000_baseline`. Never run the baseline's CREATE TABLE statements blindly against a populated database. For an empty database, deploy all migrations normally.
3. Apply the remaining migrations with `prisma migrate deploy`; generate the Prisma client. Migrations were exercised in an isolated PostgreSQL database, not production. Check constraints use NOT VALID to preserve existing history while enforcing new writes; validate them after historical reconciliation.
4. Configure a random `BEMS_DELEGATION_SIGNING_SECRET` of at least 32 bytes, a separate `BEMS_N8N_SHARED_SECRET` of at least 32 bytes, actual provider credentials, and the trusted proxy header only if the proxy overwrites it. Update n8n to forward the issued delegation token on every tool request. Remove old shared-key impersonation headers. Rotate previously embedded credentials at their providers.
5. Configure `BEMS_APKSIGNER_PATH`, `BEMS_AAPT_PATH`, and independently trusted GMD/staff certificate fingerprints. A known local SDK path is not itself a trust decision. Activate only a verified newly built release. Previously activated metadata-only artifacts must be reviewed before release gates are enabled.
6. Run `npm run outbox:process` on a recurring protected backend worker. It sends queued email, so enable it only after configuring and testing the real provider. Retry delivery is at least once; a provider acknowledgement lost before database commit can lead to a duplicate email. It cannot repeat a financial operation. Periodically remove expired `SecurityRateLimit` rows and expired report artifacts using a reviewed retention job.
7. Provision kiosk credentials securely. Existing unauthenticated kiosks will fail closed until provisioned or signed in by an executive.
8. Publish rebuilt mobile apps only after device checks. The storage upgrade removes old insecure password/PIN values; users may need to sign in and configure a new PIN. Regenerate mobile dependencies from the checked-in lockfiles.
9. Exercise each role and HR entity scope in the browser and apps, including logout/account switching, receipt uploads, staging/approval, insufficient funds, stale previews, failed providers and release downloads. Deploying this code without the database tables or required keys deliberately leaves affected operations unavailable.

## Remaining work — do not mark the full audit closed

- Complete shared-command routing for the remaining independent dashboard mutations, including portions of staff management, procurement document operations, and legacy recovery workflows. The catalog alone is not proof of execution parity.
- Finish before/after snapshots for every target selected indirectly by a command, including all global and batch operations. Test nested relations, transferred staff and cross-entity payments with representative multi-entity data; the model-query smoke test does not prove all read projections.
- Audit every unsupported dashboard section and replace remaining demonstration figures with real queries or an explicit unavailable state. Several static service-library panels remain.
- Consolidate every legacy accountability creation/recovery path and all attendance/payroll deduction policies. Some old paths still have distinct lifecycle behavior. Governance deadlines are now shared by payment, confirmation, closure recovery and legacy initialization, but emergency paths still require workflow parity testing.
- Extend the outbox to legacy notification-producing routes and verify Slack/WhatsApp delivery with their real providers. Signed callbacks now direct executives to the authenticated human approval flow; they do not execute financial decisions.
- Test the external n8n workflow against the new delegation, conversation and artifact contract. No external workflow was edited or deployed in this session.
- Complete physical-device, signed-APK and per-role browser acceptance tests. No production rollout or release publication was performed.

## Additional release finding verified against the downloaded artifact

The existing GMD download is signed with an Android Debug certificate. The source app IDs are `com.bemsgroup.bems_gmd_ai` and `com.bemsfarms.bems_staff_app`; several backend gate defaults used different IDs. Those defaults are corrected, activation updates the package identity, release builds require explicit signing credentials, and production artifact verification rejects the Android Debug signer. Existing installed debug-signed applications may require a deliberate migration/reinstall when moving to a different production certificate. Do not force-update clients before testing that migration and preserving their required data.

## Additional validation and behavior changes

Shared task and leave commands were tested for assignee ownership, repeated decisions and future leave. Payroll tests cover exact allocation rounding, changed snapshots after sign-off, and permanent removal ending salary and invalidating approval. Signed subsidiary context is now inherited when an entity is omitted and cannot be widened to GROUP; a database regression verifies this. Attendance settings snapshot their actual target rows, including expected absence; group policy changes bind the reviewed entity IDs. All command descriptor versions are now 2, so pending proposals created before these changes require a fresh preview. Previously approved payroll without the new financial snapshot must be reviewed again before transfer recording.

## Approved leave access policy

The owner confirmed that approved staff on leave retain their own portal, payslips, messages and records. Login, session validation, recovery and AI identity now share that policy; suspension, termination, unknown roles and unapproved accounts still deny access. Attendance remains separately restricted during leave. The behavioral security suite passes all 17 cases, including this distinction.

Contact and banking endpoints now apply the same executive target protections as lifecycle operations, and their audit records commit atomically with profile updates. Both advance and salary account numbers require exactly ten digits. This validation is not a claim of provider-verified account ownership. Full shared-command parity and payroll bank-detail snapshot handling remain open.
