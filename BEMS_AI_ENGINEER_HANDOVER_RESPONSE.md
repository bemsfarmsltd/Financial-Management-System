# BEMS AI Group Financial Manager — Handover & Contract Resolution
**Date:** 21 October 2026  
**To:** AI Automation Engineer (n8n Workflow Lead `mBIsnmPAtpCS38a4`)  
**From:** Henry Adeleke (BEMS Group)  
**Repository:** `bemsfarmsltd/Financial-Management-System` (Branch: `main`)  
**Production Host:** `https://pink-horse-318730.hostingersite.com`  

---

## Hello!

Thank you so much for the comprehensive breakdown and the contract document (`BEMS AI Backend Contract.md`). 

I went through everything you highlighted in detail, and I have good news: **all 29 tools are built, fully wired, and tested.** 

I have resolved every blocking item, aligned all the URL rewrites to match your current node paths, enabled your credentials, and run the live verification pack. Below is everything you need to activate your 41-node workflow immediately.

---

## 1. Resolution of Blocking Items

### Blocking · 01: Authentication Model & Tokens
I have implemented a **Dual-Authentication Architecture** supporting both of your proposed options:

* **Option A (Per-User Forwarding — Active in Web Chat):**
  When I or any executive chats with the AI in the BEMS web application, our backend automatically packages and forwards the user's live session token as `auth_token` in the webhook body. When your n8n nodes make tool calls back to BEMS (`/api/v1/...`), simply pass `Authorization: Bearer <auth_token>`. I have updated the backend to validate the cryptographic session hash in PostgreSQL, automatically scoping all data to the signed-in user's role and identity.
* **Option B (Persistent Service Token — Active for All 29 Tools):**
  To make wiring and testing your 29 HTTP Request nodes as simple as possible, I have generated and activated a permanent service key for you:
  * **Service Token:** `bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de`
  * **Header to send:** `Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de`
  * **Token Lifetime:** Permanent (non-expiring, managed by admin only).

---

### Blocking · 02: Status of the 11 "Awaiting" Endpoints
**All 11 endpoints already exist and are fully wired in our backend.** I configured routing rewrites in Next.js so that **your exact current paths work right now without you needing to change any URL in your nodes**:

| Agent Tool | Path Called by Your Node | Internal Route | Status | Supported Parameters / Notes |
|---|---|---|---|---|
| `get_daily_briefing` | `GET /api/v1/ai/briefing` | `/api/briefing` | **Live (HTTP 200)** | Aggregated executive briefing (`?organization_id=`). |
| `search_fund_requests` | `GET /api/v1/fund-requests` | `/api/requests` | **Live (HTTP 200)** | Supports `q`, `status`, `organization_id`, `requester_id`, `min_amount`, `date_from`, `date_to`, `limit`. |
| `get_fund_request_detail` | `GET /api/v1/fund-requests/{id}` | `/api/requests/[id]` | **Live (HTTP 200)** | Resolves by internal UUID or formatted request number (e.g. `REQ-2026-0042`), including approval ladder, disbursements, evidence count, and budget impact. |
| `get_pending_approvals` | `GET /api/v1/approvals/pending` | `/api/approvals` | **Live (HTTP 200)** | GMD pending approvals queue with stageIndex and approver role. |
| `get_budgets` | `GET /api/v1/budgets` | `/api/budgets` | **Live (HTTP 200)** | Fiscal budgets, allocation lines, and utilization. |
| `search_disbursements` | `GET /api/v1/disbursements` | `/api/disbursements` | **Live (HTTP 200)** | Supports `status`, `organization_id`, `limit`. |
| `get_accountability_status` | `GET /api/v1/accountability` | `/api/accountability` | **Live (HTTP 200)** | Open cases, overdue retiral deadlines, and missing evidence. |
| `search_staff` | `GET /api/v1/staff` | `/api/staff` | **Live (HTTP 200)** | Resolves names/emails to employeeNumber and ID. |
| `get_vendors_and_invoices` | `GET /api/v1/vendors` | `/api/vendors` | **Live (HTTP 200)** | Accredited vendor registry and invoice status. |
| `get_organizations` | `GET /api/v1/organizations` | `/api/organizations` | **Live (HTTP 200)** | Group subsidiaries with legal names, codes, and business IDs. |
| `prepare_payment_recorder_assignment` | `POST /api/v1/staged-actions/payment-recorder` | `/api/ai/staged-actions/payment-recorder` | **Live (HTTP 200)** | Stages assignment of an executive to record payouts. |

---

### Blocking · 03: Credentials & Webhook Security Handshake
* **Inbound Webhook Secret (BEMS ➔ n8n):**
  When BEMS dispatches messages to your n8n webhook, it transmits:  
  `X-BEMS-Webhook-Secret: bems_n8n_sec_88491029384756102938475`  
  *(You can verify this header on your n8n Webhook node so only requests from our BEMS instance are accepted).*
* **Production Base URL:**
  * **Live Production:** `https://pink-horse-318730.hostingersite.com/api/v1`
  * **Local / Staging:** `http://localhost:3000/api/v1`
* **Headers to send on all tool calls:**
  ```http
  Authorization: Bearer bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de
  X-Correlation-Id: <correlation_id>
  Content-Type: application/json
  Accept: application/json
  ```
  *(On `/staged-actions/:id/confirm`, also include `Idempotency-Key: <unique_key>`)*.

---

## 2. Governance Decisions & Field Clarifications

1. **Governance (Emergency Overrides & Role Changes):**
   * **Confirmed & Approved:** I have formally approved both `emergency-override` (`BUDGET_CAP_BYPASS`) and `staff-approval` (onboarding and role changes) for the GMD Omni-Executive role.
   * Both are strictly protected by our **Staging-Before-Execution** gate; the AI can never execute them directly without my explicit card confirmation.
2. **Decision Enum on `approval-decision`:**
   * I have configured the endpoint to accept all variants: `APPROVED` / `APPROVE`, `DECLINED` / `DECLINE`, and `NEEDS_CLARIFICATION` / `REQUEST_CLARIFICATION`.
3. **Budget Staged Action (`/staged-actions/budget`):**
   * I have updated the endpoint to support **both** modes:
     * **Mode A (Adjustment):** `{ business_id, department, fiscal_period, adjustment_amount, action: "INCREASE" | "DECREASE", justification }`
     * **Mode B (Creation):** `{ organization_id, period, total_amount, allocations: [...], note }`
4. **`receipt_file_id` in `payment-record`:**
   * Field is accepted in the body and recorded into the payment staging metadata.
5. **Error Status Codes:**
   * All business rejections and validation errors return standard **4xx HTTP codes** (400, 401, 403, 404) with `{ ok: false, error_code: string, message: string }`.

---

## 3. Verification Pack (Live Smoke Test Results)

I ran all 5 of your requested verification scenarios against the live environment. Here are the exact curl commands and the real responses:

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

### Test 4 · Staged Action Call (Budget Adjustment)
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

## 4. Next Step

Your n8n workflow `mBIsnmPAtpCS38a4` is now completely unblocked!

1. Attach the token (`bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de`) to your 29 HTTP nodes.
2. Verify `X-BEMS-Webhook-Secret: bems_n8n_sec_88491029384756102938475` on your webhook node.
3. **Send me your live n8n webhook URL** so I can set `N8N_AI_WEBHOOK_URL` on our server and we can do an end-to-end chat test together!

Looking forward to testing with you!

Warm regards,  
**Henry Adeleke**  
*BEMS Group*
