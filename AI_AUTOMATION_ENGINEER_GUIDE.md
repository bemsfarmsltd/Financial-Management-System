# BEMS Financial Management System — AI Engineer Integration Guide & Handover Contract
**Version:** 2.0 (GMD Omni-Executive AI Expansion)  
**Date:** October 2026  
**Target Audience:** AI Automation Engineer (n8n Workflow Lead) & Platform Architecture Team  
**Repository:** `bemsfarmsltd/Financial-Management-System` (Branch: `main`)

---

## 1. Executive Summary & Architecture Overview

The backend has implemented the complete **BEMS AI Group Financial Manager Backend Contract (v1.0)** and expanded it to **v2.0 (GMD Omni-Executive)**. The AI Assistant is equipped to act as the direct executive agent of the Group Managing Director (GMD), possessing both read-level visibility and transactional authority across:
1. **Budgets & Allocation Management**
2. **Expenditure Request Approvals & Rejections**
3. **Disbursement & Payment Recording**
4. **Staff Compensation & Payroll Amendments**
5. **Staff Registration Onboarding & Role Changes**
6. **Accountability Case Clearances & Deadline Extensions**
7. **Treasury & Bank Account Management**
8. **Intercompany Debit/Credit Note Issuance**
9. **Vendor Accreditation & Status Overrides**
10. **Emergency Budget & Expenditure Overrides**

### Architectural Guardrails: Zero-Trust & Staged Execution
To safeguard enterprise funds and maintain strict regulatory compliance, the system operates on a **Staging-Before-Execution** principle:
- **No direct write operations by AI:** The AI **never** commits state changes directly. It prepares a `StagedAction` record in PostgreSQL with an encrypted `confirmationHash` (deterministic SHA-256) and a 15-minute Time-To-Live (TTL).
- **Executive Authorization Gate:** A material mutation only executes when the GMD approves it via the interactive confirmation card on the web/mobile app or via an authorized confirmation webhook call containing the exact matching hash.
- **Idempotency & Atomic Ledger:** Every staged action execution runs inside an atomic PostgreSQL transaction (`prisma.$transaction`), records an immutable `AuditEvent`, and enforces idempotency via unique idempotency keys.

---

## 2. Base URLs & Authentication

### Base URLs
- **Production (Hostinger / Live Web):** `https://financial-management-system-orcin.vercel.app` (or your configured production domain)
- **Local Dev / Testing:** `http://localhost:3000` (LAN: `http://192.168.1.113:3000`)
- **API Version Aliases:** Both `/api/v1/...` and `/api/ai/...` are fully supported via Next.js URL rewrites.

### Authentication Headers
All incoming requests from n8n to BEMS endpoints must include:
```http
Authorization: Bearer <BEMS_API_KEY_OR_EXECUTIVE_TOKEN>
Content-Type: application/json
```
For requests triggered by an executive user session, the backend forwards the executive's `userId`, `role`, and `sessionId`.

---

## 3. n8n Inbound Webhook: Chat Dispatch Gateway

When a user chats with the AI in the BEMS web application or GMD mobile app, Next.js packages the request and posts it directly to your n8n workflow.

### Outgoing Payload (Next.js -> n8n Webhook)
- **Target URL in Next.js config:** `process.env.N8N_AI_WEBHOOK_URL`
- **HTTP Method:** `POST`
- **Timeout:** 35 seconds (with automatic fallback to local intelligence if unreachable)

```json
{
  "session_id": "bems-session-a1b2c3d4-e5f6-7890",
  "user": {
    "id": "usr_gmd_001",
    "name": "Dr. Adeleke (GMD)",
    "role": "GMD",
    "permissions": ["all"]
  },
  "query": "Approve the pending generator maintenance request for ₦450,000 under BEMS Farms.",
  "timestamp": "2026-10-20T15:30:00.000Z",
  "context": {
    "active_business_id": "biz_farms_001",
    "channel": "web_chat"
  }
}
```

### Expected Response Format (n8n -> Next.js)
Your n8n workflow should return HTTP 200 with one of the following two schemas:

#### Schema A: Pure Conversational / Analytical Response
```json
{
  "reply": "The current month-to-date expenditure for BEMS Farms is ₦3,850,000, representing 77% of the ₦5,000,000 monthly cap. You have ₦1,150,000 remaining.",
  "quick_replies": ["View breakdown", "Check pending approvals", "Download PDF"]
}
```

#### Schema B: Staged Action Proposal (Requiring GMD Confirmation)
When the user asks the AI to approve funds, disburse payments, change salaries, onboarding staff, or clear accountability cases, call the appropriate Staged Action endpoint first, then return:
```json
{
  "reply": "I have prepared the approval for Request #REQ-2026-0042 (₦450,000 for Generator Servicing). Please review and authorize the transaction below.",
  "staged_action": {
    "id": "stg_9f8e7d6c5b4a",
    "action_type": "approval_decision",
    "confirmation_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "summary": "Approve Request REQ-2026-0042 (₦450,000) for BEMS Farms",
    "expires_at": "2026-10-20T15:45:00.000Z",
    "preview": {
      "request_number": "REQ-2026-0042",
      "amount": "₦450,000",
      "department": "Operations",
      "budget_impact": "Consumes 9% of remaining monthly maintenance buffer"
    }
  }
}
```

---

## 4. Complete Tool Endpoints Reference (For n8n HTTP Request Nodes)

### Group A: Live Read & Analytical Tools (Zero-State Changes)

#### 1. Financial Snapshot
- **Endpoint:** `GET /api/v1/analytics/financial` (or `/api/analytics/financial`)
- **Query Params:** `business_id` (optional), `period` (`month` | `quarter` | `year`)
- **Response:**
  ```json
  {
    "ok": true,
    "data": {
      "total_budget": 25000000,
      "total_disbursed": 18240000,
      "pending_approvals_count": 4,
      "pending_approvals_amount": 1650000,
      "overdue_accountabilities_count": 2,
      "overdue_accountabilities_amount": 340000
    }
  }
  ```

#### 2. Cash Forecast
- **Endpoint:** `GET /api/v1/analytics/cash-forecast` (or `/api/analytics/cash-forecast`)
- **Query Params:** `days_ahead` (default: `30`), `business_id` (optional)
- **Response:**
  ```json
  {
    "ok": true,
    "data": {
      "current_liquid_balance": 14200000,
      "projected_burn_30d": 9800000,
      "projected_inflows_30d": 12500000,
      "safe_operating_runway_days": 43
    }
  }
  ```

#### 3. Payroll Summary
- **Endpoint:** `GET /api/v1/payroll/summary` (or `/api/payroll/summary`)
- **Query Params:** `business_id` (optional), `status` (optional)
- **Response:**
  ```json
  {
    "ok": true,
    "data": {
      "active_staff_count": 48,
      "monthly_payroll_commitment": 8450000,
      "disbursed_this_month": 8450000,
      "unpaid_salary_advance_balance": 620000
    }
  }
  ```

#### 4. Staff Compensation (Privileged Read with Audit Log)
- **Endpoint:** `GET /api/v1/staff/:employeeId/compensation` (or `/api/staff/:employeeId/compensation`)
- **Path Params:** `employeeId`
- **Response:**
  ```json
  {
    "ok": true,
    "data": {
      "employee_id": "EMP-0012",
      "full_name": "Samuel Okon",
      "role": "Farm Manager",
      "base_salary": 350000,
      "allowances": 50000,
      "effective_date": "2026-01-01T00:00:00.000Z"
    }
  }
  ```

---

### Group B: Financial Staged-Action Creation Endpoints

#### 5. Stage Budget Adjustment
- **Endpoint:** `POST /api/v1/staged-actions/budget` (or `/api/ai/staged-actions/budget`)
- **Body:**
  ```json
  {
    "business_id": "biz_farms_001",
    "department": "Crop Production",
    "fiscal_period": "2026-Q4",
    "adjustment_amount": 1500000,
    "action": "INCREASE",
    "justification": "Fuel price hike for harvesting equipment"
  }
  ```

#### 6. Stage Expenditure Approval / Rejection
- **Endpoint:** `POST /api/v1/staged-actions/approval-decision` (or `/api/ai/staged-actions/approval-decision`)
- **Body:**
  ```json
  {
    "request_id": "clx...request_uuid",
    "decision": "APPROVED",
    "approved_amount": 450000,
    "comment": "Approved per GMD instruction via AI"
  }
  ```

#### 7. Stage Payment Disbursement
- **Endpoint:** `POST /api/v1/staged-actions/payment-record` (or `/api/ai/staged-actions/payment-record`)
- **Body:**
  ```json
  {
    "request_id": "clx...request_uuid",
    "amount_paid": 450000,
    "payment_method": "BANK_TRANSFER",
    "bank_account_id": "acc_zenith_main",
    "reference": "TRX-20261020-001",
    "payee_name": "AgroParts Hub Ltd"
  }
  ```

#### 8. Stage Salary Amendment
- **Endpoint:** `POST /api/v1/staged-actions/salary-change` (or `/api/ai/staged-actions/salary-change`)
- **Body:**
  ```json
  {
    "employee_id": "EMP-0012",
    "new_base_salary": 400000,
    "new_allowances": 60000,
    "effective_date": "2026-11-01",
    "reason": "Annual performance evaluation"
  }
  ```

---

### Group C: GMD Omni-Executive Expansion Staged-Action Endpoints (NEW)

#### 9. Stage Staff Approval / Onboarding
- **Endpoint:** `POST /api/v1/staged-actions/staff-approval` (or `/api/ai/staged-actions/staff-approval`)
- **Body:**
  ```json
  {
    "approval_id": "staff_appr_uuid",
    "action": "APPROVE",
    "allocated_role": "STAFF",
    "allocated_business_id": "biz_farms_001",
    "assigned_department": "Agronomy",
    "notes": "Approved for farm operations"
  }
  ```

#### 10. Stage Staff Role Change
- **Endpoint:** `POST /api/v1/staged-actions/staff-approval`
- **Body:**
  ```json
  {
    "approval_id": "usr_emp_uuid",
    "action": "CHANGE_ROLE",
    "allocated_role": "FINANCE",
    "allocated_business_id": "biz_group_001",
    "notes": "Promoted to Central Finance Officer"
  }
  ```

#### 11. Stage Accountability Case Clearance
- **Endpoint:** `POST /api/v1/staged-actions/accountability-clearance` (or `/api/ai/staged-actions/accountability-clearance`)
- **Body:**
  ```json
  {
    "case_id": "case_uuid_1234",
    "resolution": "DEDUCT_FROM_PAYROLL",
    "deduction_amount": 85000,
    "installment_months": 2,
    "notes": "Agreed repayment over 2 months"
  }
  ```
  *(Supported resolutions: `FORGIVE`, `DEDUCT_FROM_PAYROLL`, `RETIRED_MANUALLY`, `DISCIPLINARY_HOLD`)*

#### 12. Stage Accountability Deadline Extension
- **Endpoint:** `POST /api/v1/staged-actions/accountability-clearance`
- **Body:**
  ```json
  {
    "case_id": "case_uuid_1234",
    "resolution": "EXTEND_DEADLINE",
    "extended_days": 14,
    "notes": "Delay in receipt verification from vendor"
  }
  ```

#### 13. Stage Treasury / Bank Account Configuration
- **Endpoint:** `POST /api/v1/staged-actions/treasury-account` (or `/api/ai/staged-actions/treasury-account`)
- **Body:**
  ```json
  {
    "business_id": "biz_farms_001",
    "bank_name": "Zenith Bank",
    "account_number": "1012938475",
    "account_name": "BEMS Farms Operations",
    "currency": "NGN",
    "opening_balance": 5000000,
    "action": "CREATE"
  }
  ```

#### 14. Stage Intercompany Debit/Credit Note
- **Endpoint:** `POST /api/v1/staged-actions/intercompany-note` (or `/api/ai/staged-actions/intercompany-note`)
- **Body:**
  ```json
  {
    "source_business_id": "biz_farms_001",
    "target_business_id": "biz_processing_002",
    "note_type": "DEBIT",
    "amount": 2400000,
    "reason": "Inter-unit raw maize transfer for feed processing",
    "request_id": "clx...optional_request_id"
  }
  ```

#### 15. Stage Vendor Accreditation / Status Update
- **Endpoint:** `POST /api/v1/staged-actions/vendor-approval` (or `/api/ai/staged-actions/vendor-approval`)
- **Body:**
  ```json
  {
    "vendor_id": "vnd_agroparts_001",
    "action": "APPROVE",
    "risk_score": 15,
    "notes": "Passed compliance and CAC verification"
  }
  ```

#### 16. Stage Emergency Override
- **Endpoint:** `POST /api/v1/staged-actions/emergency-override` (or `/api/ai/staged-actions/emergency-override`)
- **Body:**
  ```json
  {
    "business_id": "biz_farms_001",
    "override_type": "BUDGET_CAP_BYPASS",
    "amount": 3500000,
    "justification": "Emergency flood defense irrigation pump replacement",
    "request_id": "clx...req_uuid"
  }
  ```

---

### Group D: Execution & Cancellation Gate

#### 17. Confirm & Execute Staged Action
- **Endpoint:** `POST /api/v1/staged-actions/:id/confirm` (or `/api/ai/staged-actions/:id/confirm`)
- **Path Param:** `id` (e.g. `stg_9f8e7d6c5b4a`)
- **Body:**
  ```json
  {
    "confirmation_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "user_notes": "Authorized by GMD via chat card"
  }
  ```
- **Success Response (HTTP 200):**
  ```json
  {
    "ok": true,
    "message": "Action executed successfully.",
    "action_id": "stg_9f8e7d6c5b4a",
    "executed_at": "2026-10-20T15:35:12.000Z",
    "result": {
      "status": "APPROVED",
      "request_number": "REQ-2026-0042",
      "audit_id": "aud_8a7b6c5d"
    }
  }
  ```

#### 18. Cancel Staged Action
- **Endpoint:** `POST /api/v1/staged-actions/:id/cancel` (or `/api/ai/staged-actions/:id/cancel`)
- **Path Param:** `id`
- **Body:**
  ```json
  {
    "reason": "Cancelled by user"
  }
  ```
- **Response:**
  ```json
  {
    "ok": true,
    "message": "Staged action cancelled successfully."
  }
  ```

---

## 5. Standard Error Envelopes

Every endpoint guarantees a consistent JSON error envelope:
```json
{
  "ok": false,
  "error_code": "HASH_MISMATCH",
  "message": "Confirmation hash does not match staged payload. Re-stage required."
}
```

### Recognized Error Codes:
- `NOT_PERMITTED`: Missing bearer token or caller does not hold GMD / Executive privileges.
- `NOT_FOUND`: Referenced request, staff, business, or staged action ID does not exist.
- `VALIDATION_FAILED`: Payload missing required fields or violates schema constraints.
- `HASH_MISMATCH`: The submitted SHA-256 hash does not match the stored cryptographic fingerprint.
- `STAGED_ACTION_EXPIRED`: Action is older than 15 minutes (`expiresAt < now()`). Must be re-staged.
- `ALREADY_EXECUTED`: Action has already been committed to the ledger (returns cached receipt).

---

## 6. Updated n8n Canvas Node Mapping (Expanded to 31 Nodes)

| Node Name | Node Type | HTTP Method | Target URL / Path |
|---|---|---|---|
| `Get_Financial_Summary` | HTTP Request | `GET` | `/api/v1/analytics/financial` |
| `Get_Cash_Forecast` | HTTP Request | `GET` | `/api/v1/analytics/cash-forecast` |
| `Get_Payroll_Summary` | HTTP Request | `GET` | `/api/v1/payroll/summary` |
| `Get_Staff_Compensation` | HTTP Request | `GET` | `/api/v1/staff/{{$json.empId}}/compensation` |
| `Export_Financial_Report` | HTTP Request | `POST` | `/api/v1/reports/export` |
| `Stage_Budget_Adjustment` | HTTP Request | `POST` | `/api/v1/staged-actions/budget` |
| `Stage_Approval_Decision` | HTTP Request | `POST` | `/api/v1/staged-actions/approval-decision` |
| `Stage_Payment_Disbursement` | HTTP Request | `POST` | `/api/v1/staged-actions/payment-record` |
| `Stage_Salary_Amendment` | HTTP Request | `POST` | `/api/v1/staged-actions/salary-change` |
| `Stage_Staff_Onboarding` | HTTP Request | `POST` | `/api/v1/staged-actions/staff-approval` |
| `Stage_Role_Change` | HTTP Request | `POST` | `/api/v1/staged-actions/staff-approval` |
| `Stage_Accountability_Clearance` | HTTP Request | `POST` | `/api/v1/staged-actions/accountability-clearance` |
| `Stage_Deadline_Extension` | HTTP Request | `POST` | `/api/v1/staged-actions/accountability-clearance` |
| `Stage_Treasury_Account` | HTTP Request | `POST` | `/api/v1/staged-actions/treasury-account` |
| `Stage_Intercompany_Note` | HTTP Request | `POST` | `/api/v1/staged-actions/intercompany-note` |
| `Stage_Vendor_Accreditation` | HTTP Request | `POST` | `/api/v1/staged-actions/vendor-approval` |
| `Stage_Emergency_Override` | HTTP Request | `POST` | `/api/v1/staged-actions/emergency-override` |
| `Confirm_Staged_Action` | HTTP Request | `POST` | `/api/v1/staged-actions/{{$json.id}}/confirm` |
| `Cancel_Staged_Action` | HTTP Request | `POST` | `/api/v1/staged-actions/{{$json.id}}/cancel` |

---

## 7. Verification & Smoke Test Commands

To verify that the endpoints are live and rejecting unauthenticated calls with standard error envelopes:

```bash
# 1. Health Verification
curl -s http://localhost:3000/api/ai/verify

# 2. Financial Summary
curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/v1/analytics/financial

# 3. Stage Staff Approval
curl -s -X POST http://localhost:3000/api/v1/staged-actions/staff-approval \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"approval_id":"test_id","action":"APPROVE","allocated_role":"STAFF","notes":"Test"}'
```

---
**Handover Status:** All endpoints are live in `main`, compiled under Next.js 15, and bound to the PostgreSQL ledger on Supabase.
