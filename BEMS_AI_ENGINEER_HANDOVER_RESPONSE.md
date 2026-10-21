# BEMS AI Group Financial Manager — Backend Handover & Contract Resolution
**Date:** 21 October 2026  
**To:** AI Automation Engineer (n8n Workflow Lead `mBIsnmPAtpCS38a4`)  
**From:** BEMS Platform & Backend Engineering  
**Repository:** `bemsfarmsltd/Financial-Management-System` (Branch: `main`)  
**Production Host:** `https://pink-horse-318730.hostingersite.com`

---

## 1. Resolution of Blocking Items

### Blocking · 01: Authentication Model & Tokens
We have implemented a **Dual-Authentication Architecture** supporting both of your proposed options:

* **Option A (Per-User Forwarding — Active in Web Chat):**
  When an executive chats with the AI in the BEMS web application, `/api/ai/chat` automatically packages and forwards the user's live session token as `auth_token` in the webhook body. When n8n makes tool calls back to BEMS (`/api/v1/...`), pass `Authorization: Bearer <auth_token>`. The backend validates the cryptographic session hash in PostgreSQL, automatically scoping data to the signed-in GMD/staff member.
* **Option B (Persistent Service Token — Active for All 29 Tools):**
  n8n can also use the persistent Service API Key for standalone triggers or background tool execution:
  * **Service Token:** `bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de`
  * **Header:** `Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de`
  * **Token Lifetime:** Permanent (non-expiring, rotated by admin only).

---

### Blocking · 02: Status of the 11 "Awaiting" Endpoints
**All 11 endpoints already exist and are fully wired in the backend.** Next.js URL rewrites have been configured in `next.config.ts` so that your agent's current paths work seamlessly without any rewiring:

| Agent Tool | Path Called by Agent | Target Controller Route | Status | Notes / Supported Parameters |
|---|---|---|---|---|
| `get_daily_briefing` | `GET /api/v1/ai/briefing` | `/api/briefing` | **Live (200 OK)** | Supports `?organization_id=` |
| `search_fund_requests` | `GET /api/v1/fund-requests` | `/api/requests` | **Live (200 OK)** | Supports `q`, `status`, `organization_id`, `requester_id`, `min_amount`, `date_from`, `date_to`, `limit` |
| `get_fund_request_detail` | `GET /api/v1/fund-requests/{id}` | `/api/requests/[id]` | **Live (200 OK)** | Resolves by internal UUID or formatted request number (e.g. `REQ-2026-0042`) |
| `get_pending_approvals` | `GET /api/v1/approvals/pending` | `/api/approvals` | **Live (200 OK)** | Decision queue with stageIndex and approver role |
| `get_budgets` | `GET /api/v1/budgets` | `/api/budgets` | **Live (200 OK)** | Returns fiscal budgets, allocation lines, and utilization |
| `search_disbursements` | `GET /api/v1/disbursements` | `/api/disbursements` | **Live (200 OK)** | Supports `status`, `organization_id`, `limit` |
| `get_accountability_status` | `GET /api/v1/accountability` | `/api/accountability` | **Live (200 OK)** | Open cases, overdue deadlines, and missing receipts |
| `search_staff` | `GET /api/v1/staff` | `/api/staff` | **Live (200 OK)** | Resolves name/email to employeeNumber and ID |
| `get_vendors_and_invoices` | `GET /api/v1/vendors` | `/api/vendors` | **Live (200 OK)** | Accredited vendor registry and invoice status |
| `get_organizations` | `GET /api/v1/organizations` | `/api/organizations` | **Live (200 OK)** | Subsidiary list with legal names, codes, and business IDs |
| `prepare_payment_recorder_assignment` | `POST /api/v1/staged-actions/payment-recorder` | `/api/ai/staged-actions/payment-recorder` | **Live (200 OK)** | Staged action to assign an executive to record payouts |

---

### Blocking · 03: Credentials & Webhook Security Handshake
* **Inbound Webhook Secret (BEMS -> n8n):**
  When BEMS calls your n8n webhook, it transmits:
  `X-BEMS-Webhook-Secret: bems_n8n_sec_88491029384756102938475`
* **Canonical Base URLs:**
  * **Production (Hostinger Live):** `https://pink-horse-318730.hostingersite.com/api/v1`
  * **Local / Staging:** `http://localhost:3000/api/v1`
* **Headers to send on all tool calls:**
  ```http
  Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de
  X-Correlation-Id: <correlation_id>
  Content-Type: application/json
  Accept: application/json
  ```
  *(On `/staged-actions/:id/confirm`, include `Idempotency-Key: <unique_key>`)*.

---

## 2. Decisions & Field-Level Clarifications

1. **Governance (Emergency Overrides & Role Changes):**
   * **Approved:** Both `emergency-override` (`BUDGET_CAP_BYPASS`) and `staff-approval` (onboarding & role changes) are confirmed as approved for the GMD Omni-Executive capacity.
   * Both are strictly subject to the **Staging-Before-Execution** gate; the AI can never execute them directly without explicit GMD card confirmation.
2. **Decision Enum on `approval-decision`:**
   * Fully supports all variations: `APPROVED` / `APPROVE`, `DECLINED` / `DECLINE`, and `NEEDS_CLARIFICATION` / `REQUEST_CLARIFICATION`.
3. **Budget Staged Action (`/staged-actions/budget`):**
   * **Both modes are supported:**
     * **Mode A (Adjustment):** `{ business_id, department, fiscal_period, adjustment_amount, action: "INCREASE" | "DECREASE", justification }`
     * **Mode B (Creation):** `{ organization_id, period, total_amount, allocations: [...], note }`
4. **`receipt_file_id` in `payment-record`:**
   * Field is accepted in the request body and recorded into the payment staging metadata.
5. **Error Status Codes:**
   * All validation or permission failures return standard **4xx HTTP codes** (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found) with `{ ok: false, error_code: string, message: string }`.

---

## 3. Verification Pack Responses (Live Smoke Test Results)

### Test 1 · Health & Auth Verification
```bash
curl -i "https://pink-horse-318730.hostingersite.com/api/v1/ai/verify" \
  -H "Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de"
```
**Response (HTTP 200 OK):**
```json
{
  "ok": true,
  "exists": false,
  "record": null,
  "notification_delivery_status": "PENDING"
}
```

---

### Test 2 · Documented Read (Financial Analytics)
```bash
curl -i "https://pink-horse-318730.hostingersite.com/api/v1/analytics/financial?period=month" \
  -H "Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de"
```
**Response (HTTP 200 OK):**
```json
{
  "ok": true,
  "dataset": "requests",
  "totals": {
    "requests_sum": 0,
    "requests_count": 0,
    "disbursed_sum": 0,
    "disbursed_count": 0,
    "budget_allocated": 0
  },
  "grouped": {},
  "variance_vs_budget": "0%",
  "anomalies": [],
  "as_of": "2026-10-21T12:34:13.856Z"
}
```

---

### Test 3 · Undocumented Reads (Fund Requests & Organizations)
```bash
curl -i "https://pink-horse-318730.hostingersite.com/api/v1/fund-requests?limit=5" \
  -H "Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de"
```
**Response (HTTP 200 OK):**
```json
[]
```

```bash
curl -i "https://pink-horse-318730.hostingersite.com/api/v1/organizations" \
  -H "Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de"
```
**Response (HTTP 200 OK):**
```json
{
  "organizations": []
}
```

---

### Test 4 · Staging Call (Budget Adjustment)
```bash
curl -i -X POST "https://pink-horse-318730.hostingersite.com/api/v1/staged-actions/budget" \
  -H "Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "BEMS_HOLDINGS",
    "department": "Operations",
    "fiscal_period": "2026-Q4",
    "adjustment_amount": 1500000,
    "action": "INCREASE",
    "justification": "Fuel price adjustment"
  }'
```
**Response (HTTP 200 OK):**
```json
{
  "staged_action_id": "sa_b951ad1c06a04b36",
  "confirmation_hash": "sha256:da0efd1f3114656bf1245818363e25cd6f276bba2e2805df541e1557002a5f08",
  "type": "budget",
  "expires_at": "2026-10-21T12:52:08.774Z",
  "summary": "Budget INCREASE: +₦1,500,000 for BEMS_HOLDINGS (Operations) — 2026-Q4",
  "preview": {
    "organization": "BEMS_HOLDINGS",
    "department": "Operations",
    "fiscal_period": "2026-Q4",
    "action": "INCREASE",
    "adjustment_amount": "₦1,500,000",
    "justification": "Fuel price adjustment"
  },
  "warnings": [
    "Target business entity 'BEMS_HOLDINGS' will be referenced as a new business unit."
  ],
  "blocking_errors": []
}
```

---

### Test 5 · Rejection Paths

#### 5A. Tampered Hash Confirmation
```bash
curl -i -X POST "https://pink-horse-318730.hostingersite.com/api/v1/staged-actions/sa_b951ad1c06a04b36/confirm" \
  -H "Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de" \
  -H "Content-Type: application/json" \
  -d '{"confirmation_hash":"deadbeef","user_notes":"should fail"}'
```
**Response (HTTP 400 Bad Request):**
```json
{
  "ok": false,
  "error_code": "HASH_MISMATCH",
  "message": "Material fields have changed since this action was staged. Execution aborted."
}
```

#### 5B. Unauthorized Request (Missing Token)
```bash
curl -i "https://pink-horse-318730.hostingersite.com/api/v1/payroll/summary"
```
**Response (HTTP 401 Unauthorized):**
```json
{
  "ok": false,
  "error_code": "NOT_PERMITTED",
  "message": "Authentication required."
}
```

---

## 4. Activation Handshake
Your n8n workflow `mBIsnmPAtpCS38a4` can now be connected immediately!
1. Set the bearer token on your 29 HTTP nodes to `bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de`.
2. Configure your webhook node to verify `X-BEMS-Webhook-Secret: bems_n8n_sec_88491029384756102938475`.
3. Provide your live n8n webhook URL to the BEMS engineering team so we can set `N8N_AI_WEBHOOK_URL` in the production environment.
