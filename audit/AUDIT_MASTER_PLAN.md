# BEMS Financial Management System — Audit Master Plan

## 1. Audit Charter & Core Objectives
This master plan governs the exhaustive, forensic, 10-batch technical audit across the entire BEMS Fund Request & Financial Accountability enterprise architecture.

The primary directive is to identify, document, and eliminate all root causes of data inconsistencies, phantom numbers, competing calculation logic, unauthenticated header fallbacks, and state synchronization failures across:
1. **Admin & Finance Web Portal** (Next.js 15 App Router, React 19, Tailwind CSS)
2. **GMD AI Mobile Cockpit** (`bems_gmd_ai`, Flutter 3.5, Dart)
3. **Staff Mobile Application** (`bems_staff_app`, Flutter 3.5, Dart)
4. **Backend Gateway & Micro-Services** (`src/app/api`, 30 API route groups, Next.js server runtime)
5. **PostgreSQL Relational Core** (Supabase/Hostinger PostgreSQL via Prisma ORM, 40 schemas)

---

## 2. 10-Batch Audit Execution Matrix

| Batch | Title | Focus Areas | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Batch 1** | **Complete Architecture & Data Flow Audit** | Topology, entry points, client-server DTO mapping, proxy architecture | `SYSTEM_ARCHITECTURE_MAP.md`, `AUDIT_PROGRESS.md` |
| **Batch 2** | **Database Integrity & Query Consistency** | Foreign keys, indexes, multi-tenant scoping, transaction boundaries | `DATA_CONSISTENCY_MATRIX.md`, query patches |
| **Batch 3** | **Admin Web Application Deep Audit** | 27 Web pages, real-time counters, mutation cache revalidation | Admin module-by-module audit entries |
| **Batch 4** | **Staff Mobile Application Deep Audit** | 8 screens, offline state, evidence upload, tenant isolation | Staff mobile consistency log & patches |
| **Batch 5** | **GMD AI Mobile Application Deep Audit** | Workstation profiles, AI grounding, natural language tools | GMD data reliability & AI tool audit |
| **Batch 6** | **Auth, Authorization & Role Isolation** | Privilege escalation, token validation, unauthenticated headers | `RBAC_PERMISSION_MATRIX.md`, negative auth suite |
| **Batch 7** | **Financial Calculations & Workflow SLA** | Fixed-point integer arithmetic (minor units), 3-way matching | `FINANCIAL_RECONCILIATION.md`, test cases |
| **Batch 8** | **Frontend Hardcoding & State Sync** | AST scan for static mocks, cache invalidation headers | Hardcoding inventory & synchronization report |
| **Batch 9** | **End-to-End Multi-Role Testing** | Requisition -> Approval -> Disbursement -> Retirement simulation | End-to-end execution evidence matrix |
| **Batch 10** | **Final Re-Audit & Technical Certification** | Zero-regression verification, full compile check, production deploy | `FINAL_AUDIT_REPORT.md`, technical health certificate |

---

## 3. Methodological Principles & Safety Boundaries
1. **Evidence-Based Grounding**: No defect is recorded without code snippets, file paths, and terminal verification.
2. **Authoritative Calculation Single-Point**: Calculations for liquid reserves, budgets, disbursements, and accountability must occur in canonical backend libraries, never duplicated in frontend code.
3. **Non-Destructive Database Operations**: Read-only production diagnostics. No destructive schema drops or unconstrained deletions.
4. **Zero Workarounds**: Fix the root cause in the database schema or query projection; never hardcode frontend values to mask underlying API failures.
5. **Full Regression Coverage**: Every batch modification must pass `npx tsc --noEmit`, `flutter analyze`, and `npm run build`.
