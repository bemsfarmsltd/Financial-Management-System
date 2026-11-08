# Wallet change register

This register lists the files added or changed in the full wallet-execution increment relative to the previously saved wallet foundation. Earlier architecture/security corrections and first-increment files remain in place. Read the implementation record and rollout runbook for behavior, testing and activation limits.

The saved checkpoint manifest records SHA-256 values and preserves pre-change copies outside the project. No commit, deployment or production migration is included.

## Backend wallet services

- [`src/lib/wallet/accountability.ts`](../src/lib/wallet/accountability.ts)
- [`src/lib/wallet/core.ts`](../src/lib/wallet/core.ts)
- [`src/lib/wallet/errors.ts`](../src/lib/wallet/errors.ts)
- [`src/lib/wallet/fees.ts`](../src/lib/wallet/fees.ts)
- [`src/lib/wallet/monnify-balance.ts`](../src/lib/wallet/monnify-balance.ts)
- [`src/lib/wallet/operations.ts`](../src/lib/wallet/operations.ts)
- [`src/lib/wallet/project-return.ts`](../src/lib/wallet/project-return.ts)
- [`src/lib/wallet/proposals.ts`](../src/lib/wallet/proposals.ts)
- [`src/lib/wallet/provider.ts`](../src/lib/wallet/provider.ts)
- [`src/lib/wallet/reconciliation.ts`](../src/lib/wallet/reconciliation.ts)
- [`src/lib/wallet/releases.ts`](../src/lib/wallet/releases.ts)
- [`src/lib/wallet/security.ts`](../src/lib/wallet/security.ts)
- [`src/lib/wallet/vendor-bank.ts`](../src/lib/wallet/vendor-bank.ts)
- [`src/lib/wallet/webhooks.ts`](../src/lib/wallet/webhooks.ts)
- [`src/lib/wallet/withdrawals.ts`](../src/lib/wallet/withdrawals.ts)
- [`src/lib/wallet/worker.ts`](../src/lib/wallet/worker.ts)

## Wallet, provider and feature API routes

- [`src/app/api/meta/features/route.ts`](../src/app/api/meta/features/route.ts)
- [`src/app/api/wallet/bank/route.ts`](../src/app/api/wallet/bank/route.ts)
- [`src/app/api/wallet/banks/route.ts`](../src/app/api/wallet/banks/route.ts)
- [`src/app/api/wallet/challenges/route.ts`](../src/app/api/wallet/challenges/route.ts)
- [`src/app/api/wallet/envelopes/[id]/route.ts`](../src/app/api/wallet/envelopes/[id]/route.ts)
- [`src/app/api/wallet/envelopes/route.ts`](../src/app/api/wallet/envelopes/route.ts)
- [`src/app/api/wallet/issues/[id]/ack/route.ts`](../src/app/api/wallet/issues/[id]/ack/route.ts)
- [`src/app/api/wallet/pool-control/route.ts`](../src/app/api/wallet/pool-control/route.ts)
- [`src/app/api/wallet/project-returns/route.ts`](../src/app/api/wallet/project-returns/route.ts)
- [`src/app/api/wallet/reconcile/route.ts`](../src/app/api/wallet/reconcile/route.ts)
- [`src/app/api/wallet/releases/[id]/approve/route.ts`](../src/app/api/wallet/releases/[id]/approve/route.ts)
- [`src/app/api/wallet/releases/[id]/route.ts`](../src/app/api/wallet/releases/[id]/route.ts)
- [`src/app/api/wallet/releases/route.ts`](../src/app/api/wallet/releases/route.ts)
- [`src/app/api/wallet/vendors/[id]/verify-bank/route.ts`](../src/app/api/wallet/vendors/[id]/verify-bank/route.ts)
- [`src/app/api/wallet/withdrawal-plan/route.ts`](../src/app/api/wallet/withdrawal-plan/route.ts)
- [`src/app/api/wallet/withdrawals/[id]/cancel/route.ts`](../src/app/api/wallet/withdrawals/[id]/cancel/route.ts)
- [`src/app/api/wallet/withdrawals/route.ts`](../src/app/api/wallet/withdrawals/route.ts)
- [`src/app/api/webhooks/monnify/route.ts`](../src/app/api/webhooks/monnify/route.ts)
- [`src/app/api/webhooks/monnify/validate-transfer/route.ts`](../src/app/api/webhooks/monnify/validate-transfer/route.ts)

## AI authorization and execution

- [`src/app/api/ai/chat/route.ts`](../src/app/api/ai/chat/route.ts)
- [`src/app/api/ai/memory/route.ts`](../src/app/api/ai/memory/route.ts)
- [`src/app/api/ai/staged-actions/[id]/cancel/route.ts`](../src/app/api/ai/staged-actions/[id]/cancel/route.ts)
- [`src/app/api/ai/staged-actions/[id]/confirm/route.ts`](../src/app/api/ai/staged-actions/[id]/confirm/route.ts)
- [`src/app/api/ai/staged-actions/[id]/retry-effects/route.ts`](../src/app/api/ai/staged-actions/[id]/retry-effects/route.ts)
- [`src/app/api/ai/staged-actions/[id]/route.ts`](../src/app/api/ai/staged-actions/[id]/route.ts)
- [`src/app/api/ai/staged-actions/accountability-clearance/route.ts`](../src/app/api/ai/staged-actions/accountability-clearance/route.ts)
- [`src/app/api/ai/staged-actions/approval-decision/route.ts`](../src/app/api/ai/staged-actions/approval-decision/route.ts)
- [`src/app/api/ai/staged-actions/budget/route.ts`](../src/app/api/ai/staged-actions/budget/route.ts)
- [`src/app/api/ai/staged-actions/emergency-override/route.ts`](../src/app/api/ai/staged-actions/emergency-override/route.ts)
- [`src/app/api/ai/staged-actions/intercompany-note/route.ts`](../src/app/api/ai/staged-actions/intercompany-note/route.ts)
- [`src/app/api/ai/staged-actions/payment-record/route.ts`](../src/app/api/ai/staged-actions/payment-record/route.ts)
- [`src/app/api/ai/staged-actions/payment-recorder/route.ts`](../src/app/api/ai/staged-actions/payment-recorder/route.ts)
- [`src/app/api/ai/staged-actions/salary-change/route.ts`](../src/app/api/ai/staged-actions/salary-change/route.ts)
- [`src/app/api/ai/staged-actions/staff-approval/route.ts`](../src/app/api/ai/staged-actions/staff-approval/route.ts)
- [`src/app/api/ai/staged-actions/status/route.ts`](../src/app/api/ai/staged-actions/status/route.ts)
- [`src/app/api/ai/staged-actions/treasury-account/route.ts`](../src/app/api/ai/staged-actions/treasury-account/route.ts)
- [`src/app/api/ai/staged-actions/vendor-approval/route.ts`](../src/app/api/ai/staged-actions/vendor-approval/route.ts)
- [`src/app/api/ai/tools/route.ts`](../src/app/api/ai/tools/route.ts)
- [`src/app/api/ai/tools/wallet/route.ts`](../src/app/api/ai/tools/wallet/route.ts)
- [`src/app/api/ai/verify/route.ts`](../src/app/api/ai/verify/route.ts)
- [`src/components/ai/AiFinancialManagerDrawer.tsx`](../src/components/ai/AiFinancialManagerDrawer.tsx)
- [`src/components/ai/types.ts`](../src/components/ai/types.ts)
- [`src/components/ai/useAiFinancialManager.ts`](../src/components/ai/useAiFinancialManager.ts)
- [`src/lib/ai-access-control.ts`](../src/lib/ai-access-control.ts)
- [`src/lib/ai-access-scopes.ts`](../src/lib/ai-access-scopes.ts)
- [`src/lib/ai-tools-auth.ts`](../src/lib/ai-tools-auth.ts)
- [`src/lib/platform/actor-scope.ts`](../src/lib/platform/actor-scope.ts)
- [`src/lib/staged-actions.ts`](../src/lib/staged-actions.ts)

## Web screens and existing business integration

- [`src/app/api/accountability/close/route.ts`](../src/app/api/accountability/close/route.ts)
- [`src/app/api/payroll/my-payments/route.ts`](../src/app/api/payroll/my-payments/route.ts)
- [`src/app/api/payroll/route.ts`](../src/app/api/payroll/route.ts)
- [`src/app/api/staff/[employeeId]/password/route.ts`](../src/app/api/staff/[employeeId]/password/route.ts)
- [`src/app/disbursements/DisbursementsClient.tsx`](../src/app/disbursements/DisbursementsClient.tsx)
- [`src/app/finance/page.tsx`](../src/app/finance/page.tsx)
- [`src/app/wallet/page.tsx`](../src/app/wallet/page.tsx)
- [`src/components/dashboard/gmd/ApprovalsDeskView.tsx`](../src/components/dashboard/gmd/ApprovalsDeskView.tsx)
- [`src/components/dashboard/gmd/DisbursementsDeskView.tsx`](../src/components/dashboard/gmd/DisbursementsDeskView.tsx)
- [`src/components/dashboard/gmd/PayrollSignOffView.tsx`](../src/components/dashboard/gmd/PayrollSignOffView.tsx)
- [`src/components/wallet/FundingView.tsx`](../src/components/wallet/FundingView.tsx)
- [`src/components/wallet/WalletFlowNotice.tsx`](../src/components/wallet/WalletFlowNotice.tsx)
- [`src/components/wallet/WalletReleaseCard.tsx`](../src/components/wallet/WalletReleaseCard.tsx)
- [`src/components/wallet/WalletView.tsx`](../src/components/wallet/WalletView.tsx)

## Account lifecycle, contracts and database

- [`prisma/migrations/20261107050000_wallet_execution/migration.sql`](../prisma/migrations/20261107050000_wallet_execution/migration.sql)
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`src/lib/employee-lifecycle.ts`](../src/lib/employee-lifecycle.ts)
- [`src/lib/platform/api-route-inventory.ts`](../src/lib/platform/api-route-inventory.ts)

## Mobile apps

- [`bems_gmd_ai/lib/screens/biometric_auth_screen.dart`](../bems_gmd_ai/lib/screens/biometric_auth_screen.dart)
- [`bems_gmd_ai/lib/screens/login_screen.dart`](../bems_gmd_ai/lib/screens/login_screen.dart)
- [`bems_gmd_ai/lib/screens/payroll_signoff_screen.dart`](../bems_gmd_ai/lib/screens/payroll_signoff_screen.dart)
- [`bems_gmd_ai/lib/screens/wallet_funding_screen.dart`](../bems_gmd_ai/lib/screens/wallet_funding_screen.dart)
- [`bems_gmd_ai/lib/services/api_service.dart`](../bems_gmd_ai/lib/services/api_service.dart)
- [`bems_gmd_ai/lib/widgets/action_cards.dart`](../bems_gmd_ai/lib/widgets/action_cards.dart)
- [`bems_staff_app/lib/screens/wallet/staff_wallet_screen.dart`](../bems_staff_app/lib/screens/wallet/staff_wallet_screen.dart)
- [`bems_staff_app/lib/services/staff_api_service.dart`](../bems_staff_app/lib/services/staff_api_service.dart)
- [`bems_staff_app/lib/services/staff_storage_service.dart`](../bems_staff_app/lib/services/staff_storage_service.dart)

## Tests, workers and operational commands

- [`scripts/generate_ai_engineer_pdf.py`](../scripts/generate_ai_engineer_pdf.py)
- [`scripts/process-wallet-transfers.ts`](../scripts/process-wallet-transfers.ts)
- [`scripts/reconcile-wallet.ts`](../scripts/reconcile-wallet.ts)
- [`scripts/regression-security.ts`](../scripts/regression-security.ts)
- [`scripts/regression-wallet-execution.ts`](../scripts/regression-wallet-execution.ts)
- [`scripts/regression-wallet-provider.ts`](../scripts/regression-wallet-provider.ts)
- [`scripts/regression-wallet-vendor.ts`](../scripts/regression-wallet-vendor.ts)
- [`scripts/regression-wallet.ts`](../scripts/regression-wallet.ts)
- [`scripts/run-wallet-regressions.cjs`](../scripts/run-wallet-regressions.cjs)
- [`scripts/verify-platform-architecture.ts`](../scripts/verify-platform-architecture.ts)
- [`scripts/wallet-preflight.ts`](../scripts/wallet-preflight.ts)

## Documentation and configuration

- [`.env.example`](../.env.example)
- [`GEMINI.md`](../GEMINI.md)
- [`docs/AI_AUTOMATION_N8N_GUIDE.md`](../docs/AI_AUTOMATION_N8N_GUIDE.md)
- [`docs/BEMS_AI_AUTOMATION_N8N_ENGINEER_GUIDE.pdf`](../docs/BEMS_AI_AUTOMATION_N8N_ENGINEER_GUIDE.pdf)
- [`docs/MONNIFY-WALLET-ROLLOUT.md`](../docs/MONNIFY-WALLET-ROLLOUT.md)
- [`docs/MONNIFY-WALLET-SPECIFICATION-2026-11-07.md`](../docs/MONNIFY-WALLET-SPECIFICATION-2026-11-07.md)
- [`docs/WALLET-IMPLEMENTATION-STATUS.md`](../docs/WALLET-IMPLEMENTATION-STATUS.md)
- [`package.json`](../package.json)

## Review order

1. Read the confirmed GMD-only AI and direct-vendor decisions in the specification.
2. Review migrations, exact source release, funding/fee calculations, owner challenges, durable transfer worker and immutable journals.
3. Review all legacy writer guards and current-account/delegation restrictions.
4. Review browser/native views and backend-verified chatbot cards.
5. Run disposable database/provider, security, architecture, native and browser acceptance checks.
6. Complete the separately controlled merchant setup, opening reconciliation and pilot described in the rollout runbook.
