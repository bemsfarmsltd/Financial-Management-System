# BEMS System Audit Findings Log

This log tracks all architectural, security, data consistency, financial, and code quality vulnerabilities identified during the comprehensive system audit.

---

## Severity Scale
- **CRITICAL**: Immediate risk to financial records, data isolation / multi-tenancy breach, unauthorized authentication bypass, or data corruption.
- **HIGH**: Logic error affecting financial calculations, broken core business workflow, or unauthenticated route access.
- **MEDIUM**: Data inconsistency across clients (Web vs Mobile vs GMD AI), missing validations, unhandled edge cases, or stale fallbacks.
- **LOW**: Code cleanup, cosmetic UI mismatch, non-blocking telemetry gaps, or deprecations.

---

## Findings Index

| ID | Title | Module | Severity | Status | Discovered In |
|---|---|---|---|---|---|
| **SEC-001** | `x-employee-id` Header Authentication Bypass | Backend Auth (`src/lib/auth.ts`) | **CRITICAL** | **RESOLVED** | Batch 1 / 6 |
| **SEC-002** | `x-bems-mobile-role` Header Unauthenticated Impersonation | Approvals / AI Chat / Notifications | **CRITICAL** | **RESOLVED** | Batch 2 / 6 |
| **SEC-003** | Insecure Direct Object Reference (IDOR) on Staff Mutation | Staff API (`/api/staff/[id]/{banking,contact,password}`) | **HIGH** | **RESOLVED** | Batch 6 |
| **MOB-001** | Mobile Session Token Discard in Staff App | Staff Mobile (`staff_api_service.dart`) | **HIGH** | **RESOLVED** | Batch 4 |
| **DATA-001** | Hardcoded Workstation Balances Fallback in GMD AI | GMD AI App (`workstation_scope.dart`) | **HIGH** | **RESOLVED** | Batch 1 / 5 |
| **DATA-002** | Hardcoded Monthly Burn Rate in Financial Metrics | Financial Metrics (`src/lib/financial-metrics.ts`) | **MEDIUM** | **RESOLVED** | Batch 2 / 7 |
| **DATA-003** | Fictional Equal Split in Payroll Subsidiary Summary | Payroll API (`src/app/api/payroll/summary/route.ts`) | **HIGH** | **RESOLVED** | Batch 2 |
| **DATA-004** | Pipeline Inconsistency between Analytics and Treasury | Analytics API (`src/app/api/analytics/route.ts`) | **MEDIUM** | **RESOLVED** | Batch 2 |
| **DB-001** | Runtime Crash on `where.amount` in Requests Route | Requests API (`src/app/api/requests/route.ts`) | **HIGH** | **RESOLVED** | Batch 2 |
| **FIN-001** | Bank Account Balance Not Decremented on Payment | Disbursements / Treasury Accounts | **HIGH** | **RESOLVED** | Batch 2 / 7 |
| **WEB-001** | Empty Staff Requests List via Array vs Object Mismatch | Staff Desk (`StaffDashboardClient.tsx`) | **HIGH** | **RESOLVED** | Batch 3 |
| **WEB-002** | Hardcoded Past Date `2026-10-24` in Request Creator | Approvals Desk (`ApprovalsDeskView.tsx`) | **LOW** | **RESOLVED** | Batch 3 |
| **WEB-003** | Missing BemsSoft Subsidiary in Briefing Account Fallback | Executive Briefing (`ExecutiveBriefingClient.tsx`) | **MEDIUM** | **RESOLVED** | Batch 3 |
| **WEB-004** | Hardcoded 96.4% Compliance Score in Accountability | Accountability Page (`AccountabilityClient.tsx`) | **MEDIUM** | **RESOLVED** | Batch 3 |
| **ARCH-001** | Missing Centralized Next.js Middleware Route Guard | Web / API Routing | **MEDIUM** | OPEN | Batch 1 |
| **ARCH-002** | Missing Request Reference in API Authentication Calls | Backend Route Handlers | **LOW** | OPEN | Batch 2 |

---

## Detailed Findings

### SEC-001: `x-employee-id` Header Authentication Bypass
- **Severity**: CRITICAL
- **Location**: `src/lib/auth.ts:232-255`
- **Component**: Backend API Authentication
- **Description**: The `getSession()` / `getCurrentUser()` helper explicitly accepts an arbitrary `x-employee-id: <uuid>` HTTP request header. If present, it bypasses session cookie and JWT verification entirely and authenticates the request as whichever employee UUID was passed.
- **Impact**: Any external user or automated script can impersonate any employee, manager, CFO, or GMD simply by providing an employee UUID without requiring credentials or session tokens.
- **Root Cause**: An insecure developer shortcut introduced for mobile debugging before token persistence was fully wired.
- **Remediation Plan**:
  1. Require strict cryptographic session tokens (`Authorization: Bearer <token>` or session cookie).
  2. Deprecate and remove `x-employee-id` header inspection (scheduled for Batch 6 RBAC & Security).
  3. Ensure `bems_staff_app` and `bems_gmd_ai` store and transmit the JWT bearer token returned upon `POST /api/auth/login` (Done in Batch 4).

---

### SEC-002: `x-bems-mobile-role` Header Unauthenticated Impersonation
- **Severity**: CRITICAL
- **Location**: `src/app/api/approvals/decide/route.ts:12`, `src/app/api/ai/chat/route.ts:20`, `src/app/api/notifications/route.ts:20`
- **Component**: Approvals & AI Executive Services
- **Description**: If a request has no session, these endpoints check `req.headers.get('x-bems-mobile-role')`. If set to `'GMD'` or `'SYSTEM_ADMIN'`, they automatically query and impersonate the active GMD or System Admin without any token or authentication challenge.
- **Impact**: Anyone on the public internet can send an HTTP POST to `/api/approvals/decide` with `x-bems-mobile-role: GMD` to approve fund requests or execute staged actions.
- **Remediation Plan**: Require valid Bearer token verification and delete all `x-bems-mobile-role` unauthenticated fallbacks in Batch 6.

---

### MOB-001: Mobile Session Token Discard in Staff App
- **Severity**: HIGH
- **Status**: **RESOLVED in Batch 4**
- **Location**: `bems_staff_app/lib/services/staff_api_service.dart` and `models/staff_models.dart`
- **Component**: Staff Mobile App Authentication
- **Description**: The mobile login endpoint received `data['token']` from the backend upon login, but discarded it and only stored profile fields. Subsequent requests sent only `x-employee-id: <id>` without standard Bearer session tokens.
- **Resolution**:
  1. Added `final String token;` to `StaffUser` model.
  2. Captured and persisted session token in `StaffApiService.login`.
  3. Updated `fetchStaffDashboard`, `createFundRequest`, `confirmDisbursement` to send `Authorization: Bearer <token>`.
  4. Verified with `flutter analyze` (0 issues).

---

### DATA-001: Hardcoded Workstation Balances Fallback in GMD AI
- **Severity**: HIGH
- **Status**: **RESOLVED in Batch 5**
- **Location**: `bems_gmd_ai/lib/models/workstation_scope.dart:36-62, 400-435`
- **Component**: GMD AI Mobile App
- **Description**: The GMD AI Workstation Scope hardcoded fictional balances:
  - BemsSoft: ₦24,400,000
  - BemsLogistics: ₦7,000,000
  - Corporate HQ: ₦52,800,000
  Furthermore, it contained a fallback: `if (liquidBalance <= 0) liquidBalance = 84200000.0`. If a subsidiary had ₦0 in real accounts, it displayed ₦84.2M.
- **Resolution**:
  1. Removed `84200000.0` fallback, reflecting real liquid balance (or ₦0.00).
  2. Removed synthetic `monthlyCeiling * 0.12` fabrication in monthly burn chart.
  3. Removed fallback to mock bank accounts when live database accounts are queried.
  4. Corrected case SLA counter to real database cases length.

---

### DATA-002: Hardcoded Monthly Burn Rate in Financial Metrics
- **Severity**: MEDIUM
- **Location**: `src/lib/financial-metrics.ts:91`
- **Component**: Financial Analytics Core
- **Description**: `const estimatedMonthlyBurn = 30000000;` (₦30M/mo) is hardcoded to calculate `safeRunwayMonths = totalCash / 30000000`.
- **Impact**: Organizations with smaller or larger actual expenditure profiles display incorrect runway calculations.
- **Remediation Plan**: Dynamically calculate monthly burn rate from trailing 90-day verified disbursements and monthly active payroll commitments.

---

### DATA-003: Fictional Equal Split in Payroll Subsidiary Summary
- **Severity**: HIGH
- **Status**: **RESOLVED in Batch 2**
- **Location**: `src/app/api/payroll/summary/route.ts:52`
- **Component**: Payroll Management API
- **Description**: The summary endpoint divided 100% equally across all subsidiaries (`Math.round(100 / orgs.length)%`) rather than reading actual contracts and cost allocation records.
- **Resolution**: Refactored query to fetch `CompensationAgreement` records with `costAllocations` and employee subsidiary assignments, aggregating true proportional allocations in minor units and formatting percentages accurately.

---

### DATA-004: Pipeline Inconsistency between Analytics and Treasury
- **Severity**: MEDIUM
- **Status**: **RESOLVED in Batch 2**
- **Location**: `src/app/api/analytics/route.ts:9`
- **Component**: Analytics Reporting API
- **Description**: Analytics defined `unpaidStatuses = ['UNPAID']`, omitting requests with `paymentStatus = 'RECIPIENT_REPORTED_ISSUE'`. This caused a discrepancy where Treasury showed requests awaiting re-transfer in the pipeline, but Analytics omitted them.
- **Resolution**: Updated `unpaidStatuses = ['UNPAID', 'RECIPIENT_REPORTED_ISSUE']` to ensure 100% metric symmetry with Treasury.

---

### DB-001: Runtime Crash on `where.amount` in Requests Route
- **Severity**: HIGH
- **Status**: **RESOLVED in Batch 2**
- **Location**: `src/app/api/requests/route.ts:54`
- **Component**: Fund Requests Query API
- **Description**: When a query passed `?min_amount=...`, the handler applied `where.amount = { gte: minAmount }`. Prisma threw an unhandled runtime error because the model column is `amountMinor`.
- **Resolution**: Replaced with `where.amountMinor = { gte: BigInt(Math.round(minAmount * 100)) }`.

---

### WEB-001: Empty Staff Requests List via Array vs Object Mismatch
- **Severity**: HIGH
- **Status**: **RESOLVED in Batch 3**
- **Location**: `src/components/dashboard/staff/StaffDashboardClient.tsx:129`
- **Component**: Staff Portal Web Dashboard
- **Description**: `StaffDashboardClient` parsed `fetch('/api/requests')` assuming it returned an object `{ requests: [...] }`. Because the endpoint returns a top-level JSON array `[...]`, `reqRes.requests` resolved to `undefined` and the staff desk rendered an empty table.
- **Resolution**: Added `Array.isArray(reqRes) ? reqRes : (reqRes?.requests || [])` safe extractor.

---

### WEB-002: Hardcoded Past Date `2026-10-24` in Request Creator
- **Severity**: LOW
- **Status**: **RESOLVED in Batch 3**
- **Location**: `src/components/dashboard/gmd/ApprovalsDeskView.tsx:198`
- **Component**: New Request Modal
- **Description**: Initial state for `newReqNeededBy` defaulted to a static string `'2026-10-24'`.
- **Resolution**: Changed to dynamic date computation defaulting to 7 days from the current date.

---

### WEB-003: Missing BemsSoft Subsidiary in Briefing Account Fallback
- **Severity**: MEDIUM
- **Status**: **RESOLVED in Batch 3**
- **Location**: `src/app/briefing/ExecutiveBriefingClient.tsx:185`
- **Component**: Executive Briefing
- **Description**: Bank accounts with non-HQ scope defaulted to `'Bems Logistics & Farms Ltd'`, erasing BemsSoft Hub Ltd from the view.
- **Resolution**: Connected to `a.assignedSubsidiary || a.organization?.legalName`.

---

### WEB-004: Hardcoded 96.4% Compliance Score in Accountability
- **Severity**: MEDIUM
- **Status**: **RESOLVED in Batch 3**
- **Location**: `src/app/accountability/AccountabilityClient.tsx:43`
- **Component**: Accountability Page
- **Description**: The audit compliance metric card displayed a static string `96.4%` and `0` defaulters.
- **Resolution**: Dynamically computed from active vs closed/verified cases and overdue SLA countdowns.

---

### FIN-001: Bank Account Balance Not Decremented on Payment
- **Severity**: HIGH
- **Location**: `src/app/api/disbursements/route.ts` vs `CompanyBankAccount`
- **Component**: Treasury & Disbursement Ledger
- **Description**: When an off-platform bank disbursement is recorded and confirmed, the `CompanyBankAccount.balance` column is not decremented. Bank balances remain static unless updated manually.
- **Remediation Plan**: In Batch 7 (Financial Reconciliation), implement ledger transaction linking `Disbursement` to `CompanyBankAccount` and auto-decrementing balance upon payment verification.

---

### ARCH-001: Missing Centralized Next.js Middleware Route Guard
- **Severity**: MEDIUM
- **Location**: Root workspace (`src/middleware.ts` missing)
- **Component**: Web App & API Routing
- **Description**: Route authentication is implemented ad-hoc inside each route handler rather than at the network boundary.
- **Remediation Plan**: Deploy edge middleware in `src/middleware.ts` to validate session tokens across all protected paths.

---

### ARCH-002: Missing Request Reference in API Authentication Calls
- **Severity**: LOW
- **Location**: Various route handlers (e.g., `src/app/api/intercompany/route.ts`, `src/app/api/accountability/close/route.ts`)
- **Component**: Route Handler Auth Wiring
- **Description**: Handlers invoke `getAuthenticatedEmployee()` without passing the `request` parameter. While Next.js `headers()` fallback works in standard page requests, passing `request` directly ensures header persistence across edge runtimes and async promise scopes.
- **Remediation Plan**: Ensure all route handlers consistently invoke `getAuthenticatedEmployee(request)`.
