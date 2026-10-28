# BEMS Fund Request & Accountability System
## RBAC & Security Permission Matrix (Batch 6 Deliverable)

### 1. Architectural Security Overview
This document defines the authoritative Role-Based Access Control (RBAC), multi-tenant subsidiary boundaries, and identity verification guarantees for the BEMS Fund Request & Accountability System across all web and mobile client interfaces.

---

### 2. System Roles Taxonomy
The system governs all human and programmatic operations across six distinct roles:

| Role Identifier | Classification | Primary Responsibility | Organizational Scope |
| :--- | :--- | :--- | :--- |
| **`STAFF`** | Operational Staff | Submits fund requisitions, confirms personal bank receipt, files retirement evidence. | Own Requisitions & Assigned Items |
| **`LINE_MANAGER`** | Departmental Approver | First-tier review, departmental budget validation, initial approval or rejection. | Own Department / Assigned Subsidiary |
| **`FINANCE_OFFICER`** | Financial Operations | Reviews documentation, checks vendor 3-way matching, stages disbursement vouchers. | Assigned Subsidiary / Enterprise Finance |
| **`FINANCE_CONTROLLER`** | Treasury & Governance | Final financial clearance, bank account balance allocations, intercompany notes. | Enterprise-wide (All Subsidiaries) |
| **`GMD`** | Executive Governance | Final executive clearance, AI briefings, corporate treasury oversight. | Enterprise-wide (All Subsidiaries) |
| **`SYSTEM_ADMIN`** | System Administration | Platform configuration, employee provisioning, security audit logs, SLA monitoring. | Enterprise-wide (All Subsidiaries) |

---

### 3. API Route Permission Matrix

| Route Endpoint | HTTP Methods | Allowed Roles | Subsidiary Scoping | Enforcement Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | POST | Public | N/A | Rate-limited credential auth |
| `/api/auth/signup` | POST | Public | Per chosen subsidiary | Captures profile & dual accounts |
| `/api/auth/me` | GET | All authenticated | Own profile | Session Bearer / Cookie |
| `/api/requests` | GET | All authenticated | Filtered (Staff: own; GMD/FC: all; Manager: dept) | Prisma query scoped by `actor.id` / `role` |
| `/api/requests` | POST | `STAFF`, `LINE_MANAGER`, `FINANCE_OFFICER` | Own assigned subsidiary | Rejects executive governance accounts (`GMD`, `SYSTEM_ADMIN`) |
| `/api/requests/[id]` | GET | Requester, Approvers, Privileged | Checked against approval chain | 403 if not participant or executive |
| `/api/requests/[id]` | DELETE | Requester (if DRAFT/SUBMITTED) or `SYSTEM_ADMIN` | Own request only | Status check + requester ID match |
| `/api/requests/[id]/action` | GET, POST | Participants, `GMD`, `SYSTEM_ADMIN` | Request collaboration channel | Channel membership verification |
| `/api/approvals` | GET | `LINE_MANAGER`, `FINANCE_OFFICER`, `FINANCE_CONTROLLER`, `GMD` | Tiered pending steps | Filtered by step assigned role |
| `/api/approvals/decide` | POST | Assigned approver role | Verification of active approval step | Atomic transaction with audit logging |
| `/api/disbursements` | GET, POST | `FINANCE_OFFICER`, `FINANCE_CONTROLLER`, `GMD` | Enterprise treasury | Restricted by role check |
| `/api/disbursements/confirm` | POST | Requisition Requester (`STAFF`) | Own disbursement only | Enforces `actor.id == request.requesterId` |
| `/api/accountability` | GET | All authenticated | Scoped (Staff: own cases; Finance/GMD: all) | Filtered by `actor.id` or elevated role |
| `/api/accountability/evidence`| POST | Requisition Requester | Own case only | Validates case assigned employee |
| `/api/accountability/review` | POST | `FINANCE_OFFICER`, `FINANCE_CONTROLLER` | Enterprise accountability | Approves or rejects retirement evidence |
| `/api/treasury` | GET, POST | `FINANCE_CONTROLLER`, `GMD`, `SYSTEM_ADMIN` | Enterprise-wide | Strictly restricted to financial leadership |
| `/api/briefing` | GET | `GMD`, `SYSTEM_ADMIN`, `FINANCE_CONTROLLER` | Enterprise-wide | Executive high-level analytics & cash burn |
| `/api/ai/chat` | POST | `GMD`, `SYSTEM_ADMIN` or Authenticated Svc Token | Enterprise-wide | Guarded by Bearer token & GMD role check |
| `/api/staff/[id]/banking` | POST | Own Employee or `FINANCE_CONTROLLER`, `SYSTEM_ADMIN` | Own record | IDOR check (`actor.id === id \|\| isPrivileged`) |
| `/api/staff/[id]/contact` | POST | Own Employee or `SYSTEM_ADMIN`, `GMD` | Own record | IDOR check (`actor.id === id \|\| isPrivileged`) |
| `/api/staff/[id]/password` | POST | Own Employee or `SYSTEM_ADMIN` | Own record | Password verification + IDOR check |
| `/api/staff/chat/admin` | GET, POST | All authenticated | Own messages with admin | Filtered by `authorId` / `recipientId` |
| `/api/notifications` | GET, PATCH | All authenticated | Own notifications only | Scoped to `recipientId = actor.id` |
| `/api/vendors` | GET, POST | All authenticated (GET); Finance (POST) | Enterprise vendor directory | 3-way matching directory |
| `/api/payroll/summary` | GET | `FINANCE_CONTROLLER`, `GMD`, `SYSTEM_ADMIN` | Cross-entity payroll allocations | Scoped to financial management |

---

### 4. Vulnerabilities Resolved in Batch 6

#### 1. SEC-001: Arbitrary `x-employee-id` Header Authentication Bypass
- **Before**: In `src/lib/auth.ts`, any incoming HTTP request carrying an `x-employee-id: <uuid>` header was authenticated as that employee without verifying session cookies or cryptographic JWT tokens.
- **Remedy**: Deleted all unauthenticated header-fallback branches from `src/lib/auth.ts`, `src/app/api/requests/route.ts`, `src/app/api/requests/[requestNumber]/route.ts`, `src/app/api/requests/[requestNumber]/action/route.ts`, `src/app/api/vendors/route.ts`, `src/app/api/accountability/evidence/route.ts`, and `src/app/api/disbursements/confirm/route.ts`. Mobile apps now transmit valid Bearer tokens received during authentication.

#### 2. SEC-002: Arbitrary `x-bems-mobile-role: GMD` Header Role Elevation
- **Before**: Several high-privilege endpoints allowed incoming requests with `x-bems-mobile-role: GMD` to bypass authentication and execute approvals or queries as executive GMD.
- **Remedy**: Deleted all `x-bems-mobile-role` bypasses from `src/app/api/approvals/decide/route.ts`, `src/app/api/ai/chat/route.ts`, and `src/app/api/notifications/route.ts`. GMD operations now require authenticated user session or validated service secret `BEMS_AI_SERVICE_TOKEN`.

#### 3. SEC-003: Insecure Direct Object Reference (IDOR) on Staff Mutation Endpoints
- **Before**: Routes `/api/staff/[employeeId]/banking`, `/api/staff/[employeeId]/contact`, and `/api/staff/[employeeId]/password` accepted arbitrary `employeeId` in the path without checking whether the caller was authenticated or authorized to update the targeted record.
- **Remedy**: Enforced caller authentication and strict ownership verification (`actor.id === employeeId || isPrivilegedRole`). Any unauthorized attempt returns `403 Forbidden`.

---

### 5. Multi-Tenant Subsidiary Isolation Guarantees
1. **Departmental & Entity Scoping**:
   - Staff and Line Managers are strictly bound to their assigned subsidiary (`EmployeeAssignment` and `Department`).
   - Line Managers can only approve requests originating from within their department or assigned cost center.
2. **Executive Cross-Subsidiary Oversight**:
   - `GMD`, `FINANCE_CONTROLLER`, and `SYSTEM_ADMIN` possess multi-entity read privileges to monitor group-level liquidity, intercompany transfers, and unified financial health across Bems Farms Ltd, Bems Agro Commodities Ltd, Bems Soft Hub Ltd, and Bems Logistics Ltd.
3. **Audit Immutability**:
   - Any state change (approval, rejection, disbursement, retirement verification) creates an immutable `AuditLog` row tracking `actorId`, `actorRole`, `action`, `ipAddress`, and `timestamp`.
