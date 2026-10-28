# System Architecture & Data Flow Map

## 1. High-Level Enterprise Topology

```mermaid
graph TD
    subgraph ClientLayer ["Client Application Layer"]
        ADMIN_WEB["Admin Web Portal<br/>Next.js 15 App Router (SSR/React 19)<br/>Entry: src/app/page.tsx"]
        GMD_APP["BEMS GMD AI Mobile Cockpit<br/>Flutter / Dart 3.5<br/>Entry: bems_gmd_ai/lib/main.dart"]
        STAFF_APP["BEMS Staff Portal Mobile<br/>Flutter / Dart 3.5<br/>Entry: bems_staff_app/lib/main.dart"]
    end

    subgraph ReverseProxyGateway ["Edge Gateway & Micro-Proxy Layer"]
        EDGE_ROUTER["Hostinger Edge Router & CDN<br/>(bemserp.work / pink-horse-318730)"]
        DEV_PROXY_8086["Python Web Dev Proxy (Port 8086)<br/>web_dev_server.py -> :3000"]
    end

    subgraph BackendApp ["Full-Stack Next.js 15 Application Server"]
        NEXT_SERVER["Node.js Server Runtime (Port 3000)<br/>server.js / next dev"]
        
        subgraph RouteHandlers ["Modular API Route Suites (src/app/api/*)"]
            API_AUTH["/api/auth/*<br/>Session Token, Bcrypt/Scrypt"]
            API_TREASURY["/api/treasury<br/>Liquid Reserves"]
            API_BRIEFING["/api/briefing<br/>Executive Telemetry"]
            API_REQUESTS["/api/requests/*<br/>Requisitions & Lifecycle"]
            API_APPROVALS["/api/approvals/*<br/>Maker-Checker Matrix"]
            API_DISBURSE["/api/disbursements/*<br/>Dual-Custody Transfers"]
            API_ACCOUNT["/api/accountability/*<br/>Deliverables & SLA Enforcement"]
            API_AI["/api/ai/*<br/>Chat Engine & Staged Actions"]
            API_NOTIF["/api/notifications<br/>In-App & Email Bridge"]
            API_INTERCO["/api/intercompany/*<br/>Debit/Credit Recharges"]
        end

        subgraph CanonicalServices ["Canonical Business & Math Layer (src/lib/*)"]
            CANON_FIN["financial-metrics.ts<br/>Treasury & Budget Aggregator"]
            STAGED_ENG["staged-actions.ts<br/>Transaction Execution Engine"]
            AUTH_ENG["auth.ts<br/>Session Cache & RBAC Checker"]
            ORG_ENG["organizations.ts<br/>Multi-Tenant Hierarchy Resolver"]
            REQ_NUM["request-number.ts<br/>Atomic Requisition Numbering"]
            EMAIL_SVC["email.ts<br/>Resend / Nodemailer Dispatcher"]
        end
    end

    subgraph DataPersistence ["PostgreSQL Relational Storage Layer"]
        PRISMA_ORM["Prisma Client ORM v6.4.1<br/>src/lib/prisma.ts"]
        PG_SUPABASE[("Supabase / Hostinger PostgreSQL<br/>40 Data Tables & Constraints")]
    end

    subgraph ExternalServices ["External Systems & Automation Bridges"]
        N8N_WORKFLOW["Hostinger n8n Instance<br/>Webhook: /webhook/bems-financial-manager"]
        RESEND_API["Resend Cloud Email API<br/>notifications@bemserp.work"]
    end

    ADMIN_WEB --> EDGE_ROUTER & NEXT_SERVER
    GMD_APP --> EDGE_ROUTER & DEV_PROXY_8086
    STAFF_APP --> EDGE_ROUTER & DEV_PROXY_8086
    
    EDGE_ROUTER --> NEXT_SERVER
    DEV_PROXY_8086 --> NEXT_SERVER

    NEXT_SERVER --> RouteHandlers
    RouteHandlers --> CanonicalServices
    CanonicalServices --> PRISMA_ORM
    PRISMA_ORM --> PG_SUPABASE

    API_AI --> N8N_WORKFLOW
    EMAIL_SVC --> RESEND_API
```

---

## 2. Applications & Entry Point Directory Layout

| Application | Technology Stack | Entry Point | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **Admin Web Portal** | Next.js 15, React 19, Tailwind CSS | [src/app/page.tsx](file:///Users/henry/Documents/Fund%20Request%20System/src/app/page.tsx) | Executive Cockpit, Treasury Registry, Requisition Lifecycle, Corporate Budgets, Intercompany Notes, Vendor KYC, Payroll. |
| **GMD AI Mobile Cockpit** | Flutter 3.5, Dart | [bems_gmd_ai/lib/main.dart](file:///Users/henry/Documents/Fund%20Request%20System/bems_gmd_ai/lib/main.dart) | Group Managing Director real-time liquidity dashboard, AI conversational intelligence, pending maker-checker approvals, biometric authentication. |
| **BEMS Staff Portal** | Flutter 3.5, Dart | [bems_staff_app/lib/main.dart](file:///Users/henry/Documents/Fund%20Request%20System/bems_staff_app/lib/main.dart) | Staff requisition submissions, cash advance retirement evidence uploads, disbursement payment confirmation, internal administrative communication. |
| **Backend Gateway** | Node.js 24, Next.js Server | [server.js](file:///Users/henry/Documents/Fund%20Request%20System/server.js), [src/app/api](file:///Users/henry/Documents/Fund%20Request%20System/src/app/api) | Authentication, session tokens, RBAC authorization, transaction processing, notifications, webhooks. |

---

## 3. Database Entity Architecture (40 Prisma Models)

The relational schema ([prisma/schema.prisma](file:///Users/henry/Documents/Fund%20Request%20System/prisma/schema.prisma)) is organized into 11 functional clusters:

```mermaid
erDiagram
    Organization ||--o{ Department : contains
    Organization ||--o{ EmployeeAssignment : assigns
    Organization ||--o{ CompanyBankAccount : maintains
    Organization ||--o{ Budget : allocates
    Organization ||--o{ ExpenditureRequest : incurs

    Employee ||--o{ EmployeeAssignment : holds
    Employee ||--o{ AuthSession : initiates
    Employee ||--o{ ExpenditureRequest : requests
    Employee ||--o{ Disbursement : receives
    Employee ||--o{ AccountabilityCase : owns

    ExpenditureRequest ||--|| RequestChannel : opens
    ExpenditureRequest ||--o{ ApprovalStep : evaluates
    ExpenditureRequest ||--o{ Disbursement : disburses
    ExpenditureRequest ||--o| AccountabilityCase : mandates
    ExpenditureRequest }o--o| Vendor : pays

    Disbursement ||--o| RecipientPaymentConfirmation : confirms
    Disbursement ||--o| PaymentReceipt : generates
    Disbursement ||--o| PaymentVerification : verifies

    AccountabilityCase ||--o{ FollowupTask : assigns
    AccountabilityCase ||--o{ Attachment : proofs

    Budget ||--o{ BudgetLine : divides
```

---

## 4. API Route Catalog & Authorization Gating (30 Suites)

| Route Group | Path | Methods | Auth Gate | Data Source |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/login` | `POST` | Public | `prisma.employee`, `prisma.authSession` |
| **Auth** | `/api/auth/logout` | `POST` | Authenticated | `prisma.authSession` |
| **Auth** | `/api/auth/signup` | `POST` | Public | `prisma.employee` |
| **Treasury** | `/api/treasury` | `GET, POST` | `GMD, SYSTEM_ADMIN, FINANCE` | `getConsolidatedTreasury()`, `prisma.companyBankAccount` |
| **Briefing** | `/api/briefing` | `GET` | `GMD, SYSTEM_ADMIN` | Consolidated Prisma telemetry |
| **Requests** | `/api/requests` | `GET, POST` | `STAFF` (own), `MGMT` (all) | `prisma.expenditureRequest` |
| **Requests** | `/api/requests/[id]` | `GET, PATCH, DELETE` | Role-filtered | `prisma.expenditureRequest` |
| **Approvals** | `/api/approvals` | `GET` | Approver Roles | `prisma.expenditureRequest`, `prisma.approvalStep` |
| **Approvals** | `/api/approvals/decide`| `POST` | Assigned Approver | `prisma.$transaction` (Approval state machine) |
| **Disburse** | `/api/disbursements` | `GET, POST` | `FINANCE, SYSTEM_ADMIN` | `prisma.disbursement` |
| **Disburse** | `/api/disbursements/confirm` | `POST` | Beneficiary Employee | `prisma.recipientPaymentConfirmation` |
| **Account** | `/api/accountability`| `GET, POST` | `STAFF` (own), `MGMT` | `prisma.accountabilityCase` |
| **Account** | `/api/accountability/evidence`| `POST` | Case Owner | `prisma.attachment` |
| **AI** | `/api/ai/chat` | `POST` | `GMD, SYSTEM_ADMIN` | `getConsolidatedTreasury()`, n8n bridge |
| **AI** | `/api/ai/staged-actions/*` | `POST` | `GMD, SYSTEM_ADMIN` | `src/lib/staged-actions.ts` |
| **Budgets** | `/api/budgets` | `GET, POST` | `FINANCE, GMD, ADMIN` | `getConsolidatedBudgets()`, `prisma.budget` |
| **Members** | `/api/businesses/[id]/members` | `GET, POST` | Authenticated | `prisma.employee`, assignments |
| **Intercompany** | `/api/intercompany` | `GET, POST` | `FINANCE, GMD` | `prisma.intercompanyNote` |
| **Vendors** | `/api/vendors` | `GET, POST` | `PROCUREMENT, FINANCE` | `prisma.vendor`, `prisma.threeWayMatchRecord` |
| **Matching** | `/api/matching/verify`| `POST` | `FINANCE, AUDIT` | 3-Way Match Record |
| **Payroll** | `/api/payroll/*` | `GET, POST` | `HR, FINANCE, GMD` | `prisma.payrollBatch`, `payrollItem` |

---

## 5. Architectural Inconsistencies & Weaknesses Identified in Batch 1

### Issue 1: Unauthenticated Header Spoofing Risk (`SEC-001`)
- **Location**: [src/lib/auth.ts](file:///Users/henry/Documents/Fund%20Request%20System/src/lib/auth.ts#L232-L255)
- **Defect**: If `req.headers.get('x-employee-id')` is provided without a bearer token or cookie, the server creates an `AuthenticatedEmployee` directly from `prisma.employee.findUnique({ where: { id: mobileEmpId } })`.
- **Risk**: Any actor who knows or guesses a valid employee UUID could access or mutate records without valid credentials.
- **Remedy Planned for Batch 6**: Deprecate unsigned `x-employee-id` header in favor of mandatory `Authorization: Bearer <sessionToken>` issued during login.

### Issue 2: Static Workstation Profiles Masking Dynamic Zero Balances (`DATA-001`)
- **Location**: [bems_gmd_ai/lib/models/workstation_scope.dart](file:///Users/henry/Documents/Fund%20Request%20System/bems_gmd_ai/lib/models/workstation_scope.dart#L165-L250)
- **Defect**: Hardcoded static profiles (`bemsSoft: ₦24.4M`, `bemsLogistics: ₦7.0M`, `corporateHq: ₦52.8M`) display before dynamic network data loads, or when dynamic balances are ₦0 (falling back to ₦84.2M).
- **Risk**: Executives see phantom bank balances that do not exist in PostgreSQL.
- **Remedy Planned for Batch 5 & Batch 8**: Remove fictional fallback balances and display verified live database balances.

### Issue 3: Missing Global Next.js Route Middleware (`ARCH-001`)
- **Location**: Root directory
- **Defect**: There is no top-level `middleware.ts` in Next.js. Route protection is enforced ad-hoc inside each route handler. If an engineer adds a route and forgets `getAuthenticatedEmployee()`, the endpoint defaults to public.
- **Risk**: Defense-in-depth gap.
- **Remedy Planned for Batch 6**: Add a centralized `src/middleware.ts` to enforce uniform session checking on `/api/*` and protected page routes.
