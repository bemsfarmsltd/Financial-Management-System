# BEMS ERP — AI Automation & n8n Engineer Integration Guide
**Version:** 2.0.0 (Universal Human-in-the-Loop Staged-Action Architecture)  
**Target Environments:** Production (`https://bemserp.work`) | Local Development (`http://localhost:3000`)  
**Authentication Standard:** Bearer Token / `x-api-key` Service Header + Optional Actor Attribution (`x-actor-id` / `x-actor-email`)

---

## 1. Executive Architecture & Mandatory Staged-Action Governance

### 1.1 Zero Direct AI Writes (100% Staged Execution)
In BEMS Group Connect, **the AI agent and n8n automation workflows never mutate live database records directly**.
- **`GET` requests** across `/api/ai/tools/*` are read-only and immediately return live ERP data for reasoning, financial analysis, and context gathering.
- **`POST` requests** across `/api/ai/tools/*` **exclusively stage a proposal** in the `StagedAction` table (`status: "AWAITING_CONFIRMATION"`, `staged: true`) and return an interactive preview payload (`actionId`, `summary`, `preview`, `confirmUrl`, `cancelUrl`, `expiresAt`).
- **Database execution occurs ONLY when an authenticated human user clicks the confirmation button** in the BEMS Web Dashboard / BEMI Copilot Drawer (`POST /api/ai/staged-actions/{actionId}/confirm`).

### 1.2 Prohibited Bypass Vectors
To satisfy strict audit controls:
1. **No Auto-Confirm Flags:** Flags such as `auto_confirm: true` or `confirmed_by_gmd: true` in tool request payloads are ignored. Every tool `POST` returns a staged proposal.
2. **No Service-Token Confirmation:** The confirmation endpoint (`POST /api/ai/staged-actions/{id}/confirm`) and cancellation endpoint (`POST /api/ai/staged-actions/{id}/cancel`) **reject** requests carrying `x-api-key` or `Authorization: Bearer <BEMS_AI_SERVICE_TOKEN>` with `HTTP 403 Forbidden`. Only a browser/mobile human session cookie can confirm or cancel a staged action.
3. **No Conversational Text Confirmation:** Typing *"yes"*, *"approve"*, or *"confirm"* in the chat does not execute a staged action. The human must click the **Confirm & Execute** button on the staged action card.
4. **Strict 3-Role Architecture:** Only three roles exist in BEMS: `SUPER_ADMIN` (stored as `SYSTEM_ADMIN` in DB), `GMD` (The Group Managing Director), and `STAFF`. Legacy roles (`FINANCE`, `COO`, `HR`, `DEPT_HEAD`, `VERIFIER`, `DIRECTOR`) do not exist.

---

## 2. Connection & Authentication Headers

Every n8n **HTTP Request** node calling `/api/ai/tools/*` must include your `BEMS_AI_SERVICE_TOKEN` via `Authorization: Bearer <token>` or `x-api-key: <token>`. You may also pass `x-actor-email` or `x-actor-id` so the staged proposal is attributed to the specific executive interacting with the bot.

### Required HTTP Headers
```http
Authorization: Bearer <BEMS_AI_SERVICE_TOKEN>
Content-Type: application/json
x-actor-email: gmd@bemsgroup.com
```
*(Alternative auth header: `x-api-key: <BEMS_AI_SERVICE_TOKEN>`)*

### Standard Staged-Action Response Envelope (Returned by ALL `POST /api/ai/tools/*` Calls)
```json
{
  "ok": true,
  "staged": true,
  "status": "AWAITING_CONFIRMATION",
  "message": "Action has been staged. An authorized user must click Confirm in the dashboard.",
  "actionId": "sa_9df4c2b76ab34bbd",
  "actionType": "approval",
  "summary": "Approve REQ-2026-0005 (Starlink High-Speed Router Replacement) for ₦150,000",
  "preview": {
    "operation": "Approve Fund Request",
    "requestNumber": "REQ-2026-0005",
    "amount": "₦150,000"
  },
  "payloadHash": "sha256:8f9d2a...",
  "expiresAt": "2026-11-06T11:15:00.000Z",
  "confirmUrl": "/api/ai/staged-actions/sa_9df4c2b76ab34bbd/confirm",
  "cancelUrl": "/api/ai/staged-actions/sa_9df4c2b76ab34bbd/cancel"
}
```

---

## 3. Master Discovery & Context Endpoints

### 3.1 Master Tool Index
- **Method:** `GET`
- **Endpoint:** `/api/ai/tools`
- **Purpose:** Returns the live registry of all 16 BEMI AI tools, their endpoints, supported sub-actions, and staging rules (`stages: true | directExecute: false`).

### 3.2 Unified Conglomerate Context Snapshot
- **Method:** `GET`
- **Endpoint:** `/api/ai/context`
- **Purpose:** Single-call executive telemetry snapshot returning active subsidiaries, pending fund requests, budget utilization, attendance summary, payroll status, intercompany balances, and pending staged actions.

---

## 4. Complete Reference: All 16 BEMI AI Tool Endpoints

---

### Tool 1: Fund Request Approvals (`/api/ai/tools/approvals`)
**Purpose:** Inspect the pending fund request queue and stage executive decisions (`APPROVE`, `REJECT`, or `HOLD`) with automatic beneficiary bank and USSD quick-pay metadata.

#### A. List Pending Fund Requests (`GET`)
- **URL:** `GET /api/ai/tools/approvals?status=PENDING&limit=20`
- **Optional Query Params:** `status` (`PENDING` | `APPROVED` | `REJECTED` | `ALL`), `subsidiaryId`, `limit`

#### B. Stage an Approval Decision (`POST`)
- **URL:** `POST /api/ai/tools/approvals`
- **Action Type Staged:** `approval`
- **Payload Schema:**
```json
{
  "requestId": "REQ-2026-0005",
  "decision": "APPROVE",
  "comment": "Budget verified; approved for immediate procurement."
}
```
- **Field Notes:**
  - `requestId` *(required)*: Request number (`REQ-2026-XXXX`) or UUID.
  - `decision` *(required)*: `"APPROVE"`, `"REJECT"`, or `"HOLD"`.
  - `comment` *(optional)*: Executive review note saved on confirmation.
- **On Human Confirmation:** Transitions `FundRequest` status (`APPROVED` / `REJECTED` / `ON_HOLD`), records `ApprovalDecision`, updates budget commitment, and triggers requester notification.

---

### Tool 2: Fund Requests, Recurring Templates & Clarifications (`/api/ai/tools/requests`)
**Purpose:** Query fund requests or recurring templates, and stage creating new fund requests, creating recurring expense schedules, posting thread messages, requesting formal clarification from staff, or deleting pending requests.

#### A. List Requests & Recurring Templates (`GET`)
- **URL:** `GET /api/ai/tools/requests?status=SUBMITTED&includeRecurring=true&limit=25`

#### B. Stage Creating a New Fund Request (`POST` — `CREATE_REQUEST`)
- **URL:** `POST /api/ai/tools/requests`
- **Action Type Staged:** `request_creation`
- **Payload:**
```json
{
  "action": "CREATE_REQUEST",
  "title": "Q4 Diesel Supply for HQ Generators",
  "description": "2,000 liters automotive gas oil for backup power",
  "category": "FACILITIES_MAINTENANCE",
  "amount": 2400000,
  "currency": "NGN",
  "urgency": "HIGH",
  "subsidiaryId": "BEMS-GROUP",
  "requesterId": "babatundediekolayomi@gmail.com",
  "vendorName": "Mikano International Ltd",
  "beneficiaryName": "Mikano International Ltd",
  "beneficiaryBank": "Guaranty Trust Bank",
  "beneficiaryAccount": "0123456789"
}
```

#### C. Stage Creating a Recurring Fund Request Template (`POST` — `CREATE_RECURRING`)
```json
{
  "action": "CREATE_RECURRING",
  "title": "Monthly Starlink Enterprise Subscription",
  "description": "High-speed satellite internet for HQ",
  "category": "IT_SOFTWARE_CLOUD",
  "amount": 150000,
  "frequency": "MONTHLY",
  "dayOfMonth": 1,
  "subsidiaryId": "BEMS-GROUP"
}
```

#### D. Stage Posting a Comment on a Request Thread (`POST` — `SEND_MESSAGE`)
```json
{
  "action": "SEND_MESSAGE",
  "requestId": "REQ-2026-0005",
  "message": "Please confirm if delivery is included in the vendor quote."
}
```

#### E. Stage Requesting Formal Clarification (`POST` — `REQUEST_CLARIFICATION`)
```json
{
  "action": "REQUEST_CLARIFICATION",
  "requestId": "REQ-2026-0005",
  "message": "Attach the proforma invoice from the vendor before final GMD sign-off."
}
```
- **On Human Confirmation:** Places the request in `NEEDS_CLARIFICATION` (`ON_HOLD`), posts the clarification message, and notifies the requester.

#### F. Stage Deleting a Pending Request (`POST` — `DELETE_REQUEST`)
```json
{
  "action": "DELETE_REQUEST",
  "requestId": "REQ-2026-0009",
  "reason": "Duplicate submission by requester"
}
```

---

### Tool 3: Accountability & Retirement Governance (`/api/ai/tools/accountability`)
**Purpose:** Inspect open post-disbursement accountability cases (proof of spend / receipt retirement) and stage clearing a case, flagging a financial discrepancy, or extending a retirement deadline.

#### A. List Accountability Cases (`GET`)
- **URL:** `GET /api/ai/tools/accountability?status=OPEN`
- **Optional Query Params:** `status` (`OPEN` | `SUBMITTED` | `OVERDUE` | `FLAGGED` | `CLEARED`), `requestId`

#### B. Stage Clearing an Accountability Case (`POST` — `CLEAR`)
- **URL:** `POST /api/ai/tools/accountability`
- **Action Type Staged:** `accountability`
- **Payload:**
```json
{
  "decision": "CLEAR",
  "requestId": "REQ-2026-0005",
  "note": "Verified physical delivery waybill and vendor receipt."
}
```

#### C. Stage Flagging a Discrepancy (`POST` — `FLAG_DISCREPANCY`)
```json
{
  "decision": "FLAG_DISCREPANCY",
  "requestId": "REQ-2026-0005",
  "note": "Receipt total is ₦135,000 against ₦150,000 disbursed; unretired balance of ₦15,000 required."
}
```

#### D. Stage Extending an Accountability Deadline (`POST` — `EXTEND_DEADLINE`)
```json
{
  "decision": "EXTEND_DEADLINE",
  "requestId": "REQ-2026-0005",
  "extensionDays": 7,
  "note": "Vendor invoice delayed due to interstate transit."
}
```

---

### Tool 4: Subsidiary & Category Budgets (`/api/ai/tools/budgets`)
**Purpose:** Query monthly subsidiary budgets and category utilization, or stage creating/updating a subsidiary's monthly budget and category allocation lines.

#### A. Query Subsidiary Budgets (`GET`)
- **URL:** `GET /api/ai/tools/budgets?subsidiary=BEMS-GROUP&month=2026-11`

#### B. Stage Monthly Budget Creation / Allocation Update (`POST`)
- **URL:** `POST /api/ai/tools/budgets`
- **Action Type Staged:** `budget`
- **Payload:**
```json
{
  "subsidiary": "BEMS-GROUP",
  "month": "2026-11",
  "totalBudget": 50000000,
  "allocations": [
    { "category": "OPERATIONS_LOGISTICS", "allocated": 20000000 },
    { "category": "IT_SOFTWARE_CLOUD", "allocated": 10000000 },
    { "category": "FACILITIES_MAINTENANCE", "allocated": 10000000 },
    { "category": "MARKETING_BRAND", "allocated": 5000000 },
    { "category": "STAFF_WELFARE_TRAINING", "allocated": 5000000 }
  ]
}
```
- **On Human Confirmation:** Upserts the `Budget` record and all `BudgetAllocation` lines for the specified subsidiary and period.

---

### Tool 5: Payroll Lifecycle & Salary Adjustments (`/api/ai/tools/payroll`)
**Purpose:** Inspect monthly payroll batches and individual staff payslips, and stage base salary revisions, monthly payroll preparation, GMD batch sign-off, salary payout recording, removing an item from a draft batch, or confirming staff salary receipt.

#### A. List Payroll Periods or Payslip Items (`GET`)
- **Summary of all periods:** `GET /api/ai/tools/payroll`
- **Detailed payslips for a month:** `GET /api/ai/tools/payroll?action=GET_ITEMS&year=2026&month=11`

#### B. Stage Base Salary Adjustment (`POST` — `UPDATE_SALARY`)
- **URL:** `POST /api/ai/tools/payroll`
- **Action Type Staged:** `salary_change`
- **Payload:**
```json
{
  "action": "UPDATE_SALARY",
  "employeeId": "BEMS-BSA-2026-0002",
  "newSalary": 250000,
  "reason": "Annual performance review increment"
}
```

#### C. Stage Monthly Payroll Batch Preparation (`POST` — `PREPARE`)
- **Action Type Staged:** `payroll_action`
```json
{
  "action": "PREPARE",
  "year": 2026,
  "month": 11,
  "subsidiaryId": "BEMS-GROUP"
}
```
- **On Human Confirmation:** Calculates gross pay, aggregates attendance lateness/absence deductions, and creates/updates the `PayrollPeriod`, `PayrollBatch`, and `PayrollItem` rows.

#### D. Stage GMD Payroll Sign-Off (`POST` — `SIGN_OFF`)
```json
{
  "action": "SIGN_OFF",
  "year": 2026,
  "month": 11
}
```

#### E. Stage Salary Payout / Disbursement (`POST` — `PAYOUT` / `RECORD_PAYOUT`)
```json
{
  "action": "PAYOUT",
  "year": 2026,
  "month": 11,
  "itemId": "optional_single_payroll_item_uuid",
  "bankReference": "NIP-202611-00981"
}
```

#### F. Stage Removing a Staff Payslip from a Draft Batch (`POST` — `REMOVE_ITEM`)
```json
{
  "action": "REMOVE_ITEM",
  "itemId": "payroll_item_uuid",
  "reason": "Employee on unpaid sabbatical"
}
```

#### G. Stage Confirming Staff Salary Receipt (`POST` — `CONFIRM_RECEIPT`)
```json
{
  "action": "CONFIRM_RECEIPT",
  "itemId": "payroll_item_uuid",
  "note": "Confirmed credit alert received by staff"
}
```

---

### Tool 6: Staff Directory & Profile Governance (`/api/ai/tools/staff`)
**Purpose:** Search the staff directory and stage any staff administration operation: editing profile fields (name, email, phone, job title, department, subsidiary transfer, role), toggling attendance exemptions, suspending/freezing/activating a staff profile, registering an offline staff profile, requesting a profile update, or deactivating/deleting a staff record.

#### A. List / Search Staff Directory (`GET`)
- **URL:** `GET /api/ai/tools/staff?search=Babatunde&subsidiaryId=BEMS-GROUP&status=ACTIVE`

#### B. Stage Editing Staff Profile Data (`POST` — `EDIT_PROFILE`)
- **URL:** `POST /api/ai/tools/staff`
- **Action Type Staged:** `staff_management`
- **Payload:**
```json
{
  "action": "EDIT_PROFILE",
  "employeeId": "BEMS-BSA-2026-0002",
  "legalName": "Babatunde Diekolayomi",
  "workEmail": "babatunde@bemsgroup.com",
  "phone": "+2348031234567",
  "jobTitle": "Senior Operations Lead",
  "department": "Operations",
  "subsidiaryId": "BEMS-GROUP",
  "role": "STAFF"
}
```
- **Note on `role`:** Must strictly be `"STAFF"`, `"GMD"`, or `"SUPER_ADMIN"`.

#### C. Stage Toggling Attendance Exemption (`POST` — `TOGGLE_ATTENDANCE_EXEMPT`)
```json
{
  "action": "TOGGLE_ATTENDANCE_EXEMPT",
  "employeeId": "BEMS-BSA-2026-0002",
  "attendanceExempt": true,
  "reason": "Field engineering role with remote deployment"
}
```

#### D. Stage Changing Employment / Account Status (`POST` — `CHANGE_STATUS`)
```json
{
  "action": "CHANGE_STATUS",
  "employeeId": "BEMS-BSA-2026-0002",
  "status": "SUSPENDED",
  "reason": "Pending internal audit review"
}
```
- **Allowed `status` values:** `"ACTIVE"`, `"SUSPENDED"`, `"FROZEN"`, `"INACTIVE"`, `"TERMINATED"`.

#### E. Stage Offline Staff Registration (`POST` — `REGISTER_OFFLINE`)
```json
{
  "action": "REGISTER_OFFLINE",
  "legalName": "Musa Abdullahi",
  "workEmail": "musa.abdullahi@bemsgroup.com",
  "phone": "+2348099887766",
  "jobTitle": "Site Technician",
  "department": "Engineering",
  "subsidiaryId": "BEMS-GROUP",
  "baseSalary": 120000
}
```

#### F. Stage Requesting a Staff Profile Update (`POST` — `REQUEST_UPDATE`)
```json
{
  "action": "REQUEST_UPDATE",
  "employeeId": "BEMS-BSA-2026-0002",
  "message": "Please update your emergency contact and tax ID on the Staff Portal."
}
```

#### G. Stage Deactivating or Deleting a Staff Profile (`POST` — `DELETE_OR_DEACTIVATE`)
```json
{
  "action": "DELETE_OR_DEACTIVATE",
  "employeeId": "BEMS-BSA-2026-0002",
  "reason": "Duplicate test account cleanup"
}
```

---

### Tool 7: Executive Admin Onboarding (`/api/ai/tools/admin-onboarding`)
**Purpose:** Manage executive onboarding invitations strictly for **`SUPER_ADMIN`** and **`GMD`** (Staff onboard via self-service registration on the Staff Portal / Mobile App).

#### A. List Executive Invitations (`GET`)
- **URL:** `GET /api/ai/tools/admin-onboarding`

#### B. Stage New Executive Invitation (`POST` — `INVITE`)
- **URL:** `POST /api/ai/tools/admin-onboarding`
- **Action Type Staged:** `admin_onboarding`
- **Payload:**
```json
{
  "action": "INVITE",
  "legalName": "Engr. Michael Adeyemi",
  "workEmail": "adeyemi@bemsgroup.com",
  "phone": "+2348030001122",
  "role": "SUPER_ADMIN",
  "subsidiaryId": "BEMS-GROUP"
}
```

#### C. Stage Resending an Executive Invitation (`POST` — `RESEND_INVITE`)
```json
{
  "action": "RESEND_INVITE",
  "invitationId": "inv_uuid_or_work_email"
}
```

#### D. Stage Revoking an Executive Invitation (`POST` — `REVOKE_INVITE`)
```json
{
  "action": "REVOKE_INVITE",
  "invitationId": "inv_uuid_or_work_email",
  "reason": "Incorrect email address entered"
}
```

---

### Tool 8: Corporate Subsidiary Management (`/api/ai/tools/subsidiary`)
**Purpose:** List active subsidiaries across the conglomerate, stage creating a new subsidiary, or stage editing an existing subsidiary's metadata, RC number, headquarters, industry, brand color, active status, and monthly budget.

#### A. List Subsidiaries (`GET`)
- **URL:** `GET /api/ai/tools/subsidiary`

#### B. Stage Creating a New Subsidiary (`POST` — `CREATE`)
- **URL:** `POST /api/ai/tools/subsidiary`
- **Action Type Staged:** `subsidiary_creation`
- **Payload:**
```json
{
  "action": "CREATE",
  "name": "Studio Arella Ltd",
  "code": "SAL",
  "type": "SUBSIDIARY",
  "currency": "NGN",
  "brandColor": "#EA580C",
  "industry": "Media & Creative Production",
  "headquarters": "Lekki Phase 1, Lagos"
}
```

#### C. Stage Editing an Existing Subsidiary (`POST` — `UPDATE`)
- **Action Type Staged:** `subsidiary_update`
- **Payload:**
```json
{
  "action": "UPDATE",
  "subsidiaryId": "SAL",
  "name": "Studio Arella Media Ltd",
  "code": "SAML",
  "brandColor": "#2563EB",
  "industry": "Digital Media & Broadcast",
  "headquarters": "Victoria Island, Lagos",
  "rcNumber": "RC-1928374",
  "monthlyBudget": 35000000,
  "isActive": true
}
```

---

### Tool 9: Attendance, Shift Rosters & Geofence Stations (`/api/ai/tools/attendance`)
**Purpose:** Inspect daily attendance logs and shift policies, and stage excusing lateness/absence, overriding attendance records, manual clock-in/out, updating global shift & Starlink/GPS geofence enforcement policies, updating individual staff work schedule rosters, or calibrating attendance station GPS coordinates.

#### A. Get Live Attendance Log & Policies (`GET`)
- **URL:** `GET /api/ai/tools/attendance?date=2026-11-06`

#### B. Stage Excusing Lateness or Absence (`POST` — `EXCUSE`)
- **URL:** `POST /api/ai/tools/attendance`
- **Action Type Staged:** `attendance_override`
```json
{
  "action": "EXCUSE",
  "employeeId": "BEMS-BSA-2026-0002",
  "workDate": "2026-11-06",
  "reason": "Official client meeting at Victoria Island"
}
```

#### C. Stage Overriding an Attendance Record (`POST` — `OVERRIDE`)
```json
{
  "action": "OVERRIDE",
  "employeeId": "BEMS-BSA-2026-0002",
  "workDate": "2026-11-06",
  "status": "PRESENT",
  "isLate": false,
  "deductionPercent": 0,
  "reason": "Biometric kiosk sync delay"
}
```

#### D. Stage Manual Clock-In or Clock-Out (`POST` — `MANUAL_CLOCK_IN` / `MANUAL_CLOCK_OUT`)
```json
{
  "action": "MANUAL_CLOCK_IN",
  "employeeId": "BEMS-BSA-2026-0002",
  "workDate": "2026-11-06",
  "clockInTime": "08:05",
  "reason": "Verified arrival at HQ reception"
}
```

#### E. Stage Updating Shift & Starlink/GPS Geofence Policy (`POST` — `UPDATE_POLICY`)
```json
{
  "action": "UPDATE_POLICY",
  "resumptionTime": "08:00",
  "closingTime": "17:00",
  "gracePeriodMinutes": 15,
  "latenessDeductionPercent": 5.0,
  "requireStarlinkWifi": true,
  "requireGpsGeofence": true,
  "allowedSsid": "BEMS_STARLINK_HQ"
}
```

#### F. Stage Updating a Staff Member's Work Schedule Roster (`POST` — `UPDATE_ROSTER`)
```json
{
  "action": "UPDATE_ROSTER",
  "employeeId": "BEMS-BSA-2026-0002",
  "expectedClockIn": "08:30",
  "expectedClockOut": "17:30",
  "gracePeriodMinutes": 20,
  "offDays": "0,6",
  "notes": "Adjusted shift for Lagos mainland commute"
}
```

#### G. Stage Calibrating an Attendance Station's GPS Geofence (`POST` — `CALIBRATE_STATION`)
```json
{
  "action": "CALIBRATE_STATION",
  "name": "BEMS HQ Main Gate",
  "latitude": 6.5244,
  "longitude": 3.3792,
  "radiusMeters": 150,
  "allowedWifiSsid": "BEMS_STARLINK_HQ",
  "starlinkIpRanges": "192.168.1.0/24"
}
```

---

### Tool 10: HR Leave Management (`/api/ai/tools/hr-leave`)
**Purpose:** Query staff leave applications and stage filing a new leave request or approving/rejecting an existing leave application.

#### A. List Leave Applications (`GET`)
- **URL:** `GET /api/ai/tools/hr-leave?status=PENDING`

#### B. Stage Creating a Leave Application (`POST` — `CREATE`)
- **URL:** `POST /api/ai/tools/hr-leave`
- **Action Type Staged:** `leave_action`
```json
{
  "action": "CREATE",
  "employeeId": "BEMS-BSA-2026-0002",
  "leaveType": "ANNUAL",
  "startDate": "2026-12-15",
  "endDate": "2026-12-22",
  "reason": "Annual family vacation"
}
```

#### C. Stage Approving or Rejecting a Leave Request (`POST` — `APPROVE` / `REJECT`)
```json
{
  "action": "APPROVE",
  "leaveId": "leave_request_uuid",
  "reviewNote": "Approved by GMD; handover coverage confirmed."
}
```

---

### Tool 11: Vendors, GRNs, Invoices & 3-Way Match (`/api/ai/tools/vendors`)
**Purpose:** Manage the verified supplier registry and complete 3-way matching pipeline (Purchase Order / Fund Request + Goods Receipt Note + Vendor Invoice).

#### A. List Vendors or Inspect Read-Only 3-Way Match Status (`GET`)
- **List Vendors:** `GET /api/ai/tools/vendors`
- **Read-Only 3-Way Match Inspection:** `GET /api/ai/tools/vendors?action=CHECK_MATCH&requestId=REQ-2026-0005`

#### B. Stage Registering a Verified Vendor (`POST` — `REGISTER`)
- **URL:** `POST /api/ai/tools/vendors`
- **Action Type Staged:** `vendor_registration`
```json
{
  "action": "REGISTER",
  "name": "Mikano International Ltd",
  "category": "FACILITIES",
  "bankName": "Guaranty Trust Bank",
  "accountNumber": "0123456789",
  "accountName": "Mikano International Ltd",
  "taxId": "TIN-99283746",
  "contactPhone": "+2348020003344",
  "contactEmail": "billing@mikano.com"
}
```

#### C. Stage Recording a Goods Receipt Note (`POST` — `CREATE_GRN`)
- **Action Type Staged:** `grn_creation`
```json
{
  "action": "CREATE_GRN",
  "requestId": "REQ-2026-0005",
  "waybillNumber": "WB-2026-8841",
  "status": "ACCEPTED",
  "inspectionNotes": "All 4 Starlink kits delivered sealed and tested."
}
```
- **Allowed `status` values:** `"ACCEPTED"`, `"PARTIAL"`, `"DAMAGED"`.

#### D. Stage Logging a Vendor Invoice (`POST` — `CREATE_INVOICE`)
- **Action Type Staged:** `vendor_invoice_creation`
```json
{
  "action": "CREATE_INVOICE",
  "requestId": "REQ-2026-0005",
  "vendorId": "Mikano International Ltd",
  "invoiceNumber": "INV-MIK-2026-901",
  "amount": 150000,
  "tax": 11250,
  "currency": "NGN",
  "invoiceDate": "2026-11-06"
}
```

#### E. Stage 3-Way Match Verification & State Update (`POST` — `STAGE_MATCH`)
- **Action Type Staged:** `three_way_match`
```json
{
  "action": "STAGE_MATCH",
  "requestId": "REQ-2026-0005"
}
```
- **On Human Confirmation:** Runs the 3-way match engine across the PO (`FundRequest`), `GoodsReceiptNote`, and `VendorInvoice`, and persists the resulting `MATCHED` / `MISMATCH_FLAGGED` state.

---

### Tool 12: Intercompany Debit/Credit Ledger & Netting (`/api/ai/tools/intercompany`)
**Purpose:** Inspect bilateral intercompany balances across subsidiaries and stage paired Debit/Credit note generation or netting settlement.

#### A. Query Conglomerate Netting Matrix (`GET`)
- **URL:** `GET /api/ai/tools/intercompany`

#### B. Stage Paired Intercompany Debit/Credit Notes (`POST` — `CREATE_NOTE`)
- **URL:** `POST /api/ai/tools/intercompany`
- **Action Type Staged:** `intercompany_Entry`
```json
{
  "action": "CREATE_NOTE",
  "source": "BEMS-GROUP",
  "target": "SAL",
  "amount": 350000,
  "description": "Cross-charge: Shared Starlink & Cloud Infrastructure Q4"
}
```

#### C. Stage Intercompany Netting Settlement (`POST` — `STAGE_SETTLEMENT`)
- **Action Type Staged:** `intercompany_settle`
```json
{
  "action": "STAGE_SETTLEMENT",
  "noteIds": ["ic_note_uuid_1", "ic_note_uuid_2"],
  "settlementReference": "IC-NET-2026-11"
}
```

---

### Tool 13: Bank Account Registry (`/api/ai/tools/bank-accounts`)
**Purpose:** Stage registering or updating verified 10-digit NUBAN bank details for **Staff** (`staff_bank_update`), **Subsidiaries / Treasury** (`treasury_bank_register`), or **Vendors** (`vendor_bank_update`).

#### A. List Registered Bank Accounts (`GET`)
- **URL:** `GET /api/ai/tools/bank-accounts?targetType=STAFF`

#### B. Stage Staff, Subsidiary, or Vendor Bank Update (`POST`)
- **URL:** `POST /api/ai/tools/bank-accounts`
- **Payload (Staff Example):**
```json
{
  "targetType": "STAFF",
  "targetId": "BEMS-BSA-2026-0002",
  "bankName": "Kuda Microfinance Bank",
  "accountNumber": "2001928374",
  "accountName": "Babatunde Diekolayomi"
}
```
- **Payload (Subsidiary Treasury Example):**
```json
{
  "targetType": "SUBSIDIARY",
  "targetId": "BEMS-GROUP",
  "bankName": "Zenith Bank",
  "accountNumber": "1019283746",
  "accountName": "BEMS Group Holdings Operational",
  "accountType": "Corporate Operational"
}
```

---

### Tool 14: Executive Follow-Up Tasks (`/api/ai/tools/tasks`)
**Purpose:** Track and stage executive follow-up tasks assigned to staff or admins.

#### A. List Follow-Up Tasks (`GET`)
- **URL:** `GET /api/ai/tools/tasks?status=PENDING`

#### B. Stage Creating a Follow-Up Task (`POST` — `CREATE`)
- **URL:** `POST /api/ai/tools/tasks`
- **Action Type Staged:** `task_action`
```json
{
  "action": "CREATE",
  "title": "Submit Q4 Vendor Compliance Certificates",
  "description": "Collect updated CAC and TIN documents for top 5 logistics vendors.",
  "assignedToId": "BEMS-BSA-2026-0002",
  "priority": "HIGH",
  "dueDate": "2026-11-15"
}
```

#### C. Stage Completing or Updating a Task (`POST` — `COMPLETE` / `UPDATE_STATUS`)
```json
{
  "action": "COMPLETE",
  "taskId": "task_uuid",
  "note": "All certificates uploaded and verified."
}
```

---

### Tool 15: Direct Staff Helpdesk Messaging (`/api/ai/tools/messages`)
**Purpose:** Read Staff-Admin helpdesk threads and stage direct GMD or HR messages to any staff member (creates a `StaffAdminMessage`, in-app `SystemNotification`, and email alert on confirmation).

#### A. List Helpdesk Messages (`GET`)
- **URL:** `GET /api/ai/tools/messages?channel=GMD&employeeId=optional_uuid`

#### B. Stage Direct Executive Message to Staff (`POST`)
- **URL:** `POST /api/ai/tools/messages`
- **Action Type Staged:** `staff_message`
```json
{
  "employeeId": "BEMS-BSA-2026-0002",
  "channel": "GMD",
  "message": "Please upload the signed delivery waybill for REQ-2026-0005 before 4 PM today."
}
```

---

### Tool 16: Approval Policies & Workspace Governance Settings (`/api/ai/tools/policies`)
**Purpose:** Inspect or stage changes to conglomerate approval policy bands (`ApprovalPolicy`) and workspace-level governance settings (`WorkspaceSetting`).

#### A. List Approval Policies & Workspace Settings (`GET`)
- **URL:** `GET /api/ai/tools/policies?organizationId=BEMS-GROUP`

#### B. Stage Creating or Updating an Approval Policy Band (`POST` — `UPSERT_POLICY`)
- **URL:** `POST /api/ai/tools/policies`
- **Action Type Staged:** `policy_update`
```json
{
  "action": "UPSERT_POLICY",
  "organizationId": "BEMS-GROUP",
  "requestCategory": "CAPITAL_EXPENDITURE",
  "minAmountMinor": 0,
  "maxAmountMinor": 5000000000,
  "requiredRoles": ["GMD"],
  "slaHours": 24,
  "escalationRole": "GMD",
  "autoApproveBelowMinor": 0
}
```

#### C. Stage Updating Workspace Governance Settings (`POST` — `UPDATE_WORKSPACE_SETTINGS`)
```json
{
  "action": "UPDATE_WORKSPACE_SETTINGS",
  "organizationId": "BEMS-GROUP",
  "settingKey": "approval.controls",
  "settings": {
    "SLA_REMINDER_HOURS": 12,
    "REQUIRE_THREE_WAY_MATCH_ABOVE_NGN": 500000
  }
}
```

---

## 5. Human Confirmation & Cancellation Protocol

Once n8n or BEMI stages an action via any `POST /api/ai/tools/*` route, the proposal appears in:
1. The **BEMI Copilot Staged Action Card** in the web dashboard / mobile app.
2. `GET /api/ai/staged-actions` (pending proposals queue).

### 5.1 Confirm & Execute Staged Action (Human Browser Session Only)
- **Method:** `POST`
- **Endpoint:** `/api/ai/staged-actions/{actionId}/confirm`
- **Authentication:** Authenticated Human Session Cookie (`bems_session`) — **Service tokens (`x-api-key` / `BEMS_AI_SERVICE_TOKEN`) are strictly blocked with `403 Forbidden`**.
- **Optional Request Body:**
```json
{
  "payloadHash": "sha256:8f9d2a..."
}
```
- **Execution Guarantees:**
  - Atomically locks the `StagedAction` row (`PENDING` -> `EXECUTING` -> `EXECUTED`).
  - Verifies the `payloadHash` and checks that `expiresAt` has not passed.
  - Verifies the human user's role (`GMD` / `SUPER_ADMIN` / `STAFF`) against the specific action's permission gate.
  - Executes the canonical database transaction and records an immutable `AuditEvent`.

### 5.2 Cancel / Reject Staged Action (Human Browser Session Only)
- **Method:** `POST`
- **Endpoint:** `/api/ai/staged-actions/{actionId}/cancel`
- **Authentication:** Authenticated Human Session Cookie (`bems_session`).

---

## 6. Ready-to-Import n8n HTTP Request Node Template

Paste this JSON directly into your n8n workflow canvas to create a pre-configured **BEMS AI Tool Stage Request** node:

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://bemserp.work/api/ai/tools/approvals",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "Bearer {{ $env.BEMS_AI_SERVICE_TOKEN }}"
        },
        {
          "name": "x-actor-email",
          "value": "={{ $json.executiveEmail || 'gmd@bemsgroup.com' }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"requestId\": \"{{ $json.requestNumber }}\",\n  \"decision\": \"{{ $json.decision || 'APPROVE' }}\",\n  \"comment\": \"{{ $json.comment || 'Staged via n8n AI Automation' }}\"\n}",
    "options": {}
  },
  "name": "BEMS Stage AI Action",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

---

## 7. Error Codes & Troubleshooting for Automation Engineers

| HTTP Status | Error Code / Condition | Cause & Resolution |
| :--- | :--- | :--- |
| `400 Bad Request` | `INCOMPLETE_PARAMETERS` | Required fields were omitted. Inspect `missing_fields` and `conversational_prompt` in the response JSON and prompt the user for the missing values (never invent dummy data). |
| `401 Unauthorized` | Missing / Invalid Token | Ensure `Authorization: Bearer <BEMS_AI_SERVICE_TOKEN>` or `x-api-key: <BEMS_AI_SERVICE_TOKEN>` matches the server `.env`. |
| `403 Forbidden` | Service Token on `/confirm` | Automation service tokens cannot confirm staged actions. Present the staged action card or dashboard link so the human executive can click **Confirm**. |
| `404 Not Found` | Entity Not Found | The target `requestId`, `employeeId`, `subsidiaryId`, or `vendorId` could not be resolved. Call the corresponding `GET /api/ai/tools/*` endpoint first to look up the exact ID or code. |
| `409 Conflict` | Already Executed / Expired | The staged action was already confirmed, cancelled, or passed its 30-minute `expiresAt` window. Stage a fresh proposal if still needed. |
