# Wallet dashboard loading correction — 8 November 2026

The executive funding dashboard submitted POST requests to GET-only funding and bank-list routes. Next.js returned an empty HTTP 405 response, which became “Operation failed.” The component then rendered zero-valued fallback metrics despite having no data. Release-card detail reads used the same transport. The Staff wallet component also requested the nonexistent `/api/wallet` instead of `/api/wallet/me`.

A production read-only check exposed a second failure: the funding dashboard exceeded Prisma’s default interactive transaction deadline. Executive and own-wallet reads now use a bounded 30-second Repeatable Read transaction with a 10-second connection wait. Monetary transaction behavior, authorization, provider-source verification and approval proofs are unchanged.

The shared browser transport now defaults payload-free reads to GET, preserves POST/PATCH for mutations and retains idempotency headers. It explains HTTP, backend, network and invalid-response errors. Funding and bank reads explicitly use GET; Staff wallet reads use the actual own-wallet endpoint.

The funding page has a loading/error/retry state before any financial cards appear. Unknown funding amounts are shown as unavailable, not zero. Recorded Monnify balances show their observation time. Review mode is identified correctly rather than labeled sandbox. Disabled execution prevents toolbar writes. Existing password-protected pool activation/pause controls are visible again; no activation or payment is performed automatically. Approval wording includes the owner-authorized Super Admin exception.

Validation: client transport regression, production read-only service check, production build, and disposable-database Chrome tests covering successful GET loading, failed-load recovery without false zeroes, disabled execution controls, staff funding denial and own-wallet access. The transport regression is included in the wallet CI checks.

At diagnosis, production reported `walletMode: false`. The recorded pool was paused and its last observation was 8 November at 11:40 UTC. Changing the UI does not enable hosting switches or unpause that pool. Live configuration must be applied in Hostinger and pool activation requires the authorized executive’s own password.
