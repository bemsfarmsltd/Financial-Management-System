# BEMS ERP — AI Automation & n8n Integration Guide
**Version:** 1.2.0  
**Target Environment:** Production (`https://bemserp.work`) | Local Dev (`http://localhost:3000`)  
**Security Standard:** Bearer Token Authentication / Header-based API Key

---

## 1. Authentication & Security Headers

All AI Agent and n8n HTTP Request nodes must authenticate using either standard **Bearer Token** authorization or an **`x-api-key`** header.

### Required HTTP Headers:
```http
Authorization: Bearer 7095ec2348ee3a4ca855707cec7bab8a697f0de4aad3f93f0e545d82bba8e9a8
Content-Type: application/json
```
*(Alternative: `x-api-key: 7095ec2348ee3a4ca855707cec7bab8a697f0de4aad3f93f0e545d82bba8e9a8`)*

---

## 2. Tool 1: Corporate Subsidiary Management

### A. List All Active Subsidiaries
- **Method:** `GET`
- **Endpoint:** `/api/ai/tools/subsidiary`
- **cURL Example:**
```bash
curl -X GET "https://bemserp.work/api/ai/tools/subsidiary" \
  -H "Authorization: Bearer 7095ec2348ee3a4ca855707cec7bab8a697f0de4aad3f93f0e545d82bba8e9a8"
```
- **Response Schema:**
```json
{
  "ok": true,
  "total": 6,
  "subsidiaries": [
    {
      "id": "7f84f13a-d3e3-4203-8157-be0de305f459",
      "name": "BEMS Group",
      "code": "BEMS-GROUP",
      "type": "GROUP",
      "currency": "NGN",
      "brandColor": "#ea580c",
      "totalStaff": 22,
      "totalRequests": 0,
      "createdAt": "2026-11-01T20:48:36.862Z"
    }
  ]
}
```

### B. Create a New Subsidiary
- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/subsidiary`
- **Request Body:**
```json
{
  "name": "Studio Arella Ltd",
  "code": "SAL",                 // Optional: Auto-generated from name if omitted
  "type": "SUBSIDIARY",           // GROUP | SUBSIDIARY | OPERATING_SUBSIDIARY | SPECIAL_PURPOSE_VEHICLE
  "currency": "NGN",              // NGN | USD | GBP | EUR (Defaults to NGN)
  "headquarters": "Lagos, Nigeria",
  "industry": "Media & Creative Production",
  "brandColor": "#EA580C"
}
```
- **cURL Example:**
```bash
curl -X POST "https://bemserp.work/api/ai/tools/subsidiary" \
  -H "Authorization: Bearer 7095ec2348ee3a4ca855707cec7bab8a697f0de4aad3f93f0e545d82bba8e9a8" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Arella Farms SPV",
    "industry": "Agribusiness & Logistics",
    "headquarters": "Ogun State, Nigeria"
  }'
```
- **Response Schema:**
```json
{
  "ok": true,
  "message": "Subsidiary \"Arella Farms SPV\" (AFSP) created successfully.",
  "subsidiary": {
    "id": "c3faf9ad-b718-4869-8cd9-6dab201a401d",
    "name": "Arella Farms SPV",
    "code": "AFSP",
    "type": "SUBSIDIARY",
    "currency": "NGN",
    "brandColor": "#EA580C",
    "createdAt": "2026-11-05T12:00:00.000Z"
  }
}
```

---

## 3. Tool 2: Approvals & Bank App Quick-Disbursement

> **Mandatory BEMS Security Governance Protocol:**  
> **The AI never approves directly — it ONLY stages the action.**  
> When the AI or automation triggers an approval, the backend creates a cryptographic **Staged Action** and generates an interactive **Confirmation Button** sent to the frontend chatbot (or Slack/WhatsApp via n8n).  
> Only when the GMD physically clicks **"Authorize & Execute Approval"** does the backend execute the ledger mutation and commit the approval.

### A. Query Pending Approvals Queue
- **Method:** `GET`
- **Endpoint:** `/api/ai/tools/approvals?status=PENDING&limit=20`

### B. Stage Approval Decision (AI Copilot / n8n)
- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/approvals`
- **Request Body:**
```json
{
  "requestId": "REQ-2026-0005",   // Can be REQ number or UUID ID
  "decision": "APPROVE",          // APPROVE | REJECT
  "comment": "Recommended by AI after budget inspection"
}
```
- **cURL Example:**
```bash
curl -X POST "https://bemserp.work/api/ai/tools/approvals" \
  -H "Authorization: Bearer 7095ec2348ee3a4ca855707cec7bab8a697f0de4aad3f93f0e545d82bba8e9a8" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-2026-0005",
    "decision": "APPROVE",
    "comment": "Recommended approval"
  }'
```
- **Response Schema (Staged with Interactive Button for GMD):**
```json
{
  "ok": true,
  "status": "AWAITING_CONFIRMATION",
  "requires_gmd_action": true,
  "message": "Approval action for REQ-2026-0005 has been staged. In accordance with BEMS security governance, the AI cannot approve directly — the GMD must click the confirmation button to execute.",
  "staged_action_id": "sa_4a7b21903e1f",
  "confirmation_hash": "sha256:7e8d2...",
  "confirmation_button": {
    "label": "Authorize & Execute Approval (GMD)",
    "action_type": "CONFIRM_STAGED_ACTION",
    "endpoint": "/api/ai/staged-actions/sa_4a7b21903e1f/confirm",
    "confirm_url": "https://bemserp.work/api/ai/staged-actions/sa_4a7b21903e1f/confirm",
    "method": "POST",
    "payload": {
      "confirmed_by": "GMD Executive",
      "confirmation_hash": "sha256:7e8d2..."
    }
  },
  "request": {
    "id": "e0b1f234-5678-4321-9abc-def012345678",
    "requestNumber": "REQ-2026-0005",
    "title": "Starlink High-Speed Router Replacement",
    "amount": 150000,
    "formattedAmount": "₦150,000",
    "status": "SUBMITTED",
    "subsidiary": "BEMS Group",
    "requester": "Babatunde Diekolayomi"
  },
  "beneficiary": {
    "name": "Babatunde Diekolayomi",
    "bankName": "Kuda Microfinance Bank",
    "accountNumber": "2001928374",
    "type": "STAFF"
  },
  "disbursement": {
    "beneficiaryName": "Babatunde Diekolayomi",
    "accountNumber": "2001928374",
    "bankName": "Kuda Microfinance Bank",
    "amount": 150000,
    "formattedAmount": "₦150,000",
    "reference": "REQ-2026-0005",
    "quickPayUrl": "https://bemserp.work/pay/REQ-2026-0005",
    "ussdDialer": "tel:*737*2*150000*2001928374#",
    "ussdRaw": "*737*2*150000*2001928374#",
    "bankingApps": [
      { "name": "GTWorld (GTBank)", "scheme": "gtworld://" },
      { "name": "Kuda Bank", "scheme": "kuda://" },
      { "name": "OPay", "scheme": "opay://" },
      { "name": "Moniepoint", "scheme": "moniepoint://" },
      { "name": "Zenith Bank", "scheme": "zenithbank://" },
      { "name": "Access More", "scheme": "accessmore://" }
    ]
  },
  "gmdActionLink": "https://bemserp.work/pay/REQ-2026-0005"
}
```

### C. GMD Confirmation Click Execution
When the GMD taps the button in the chatbot (or in Slack/WhatsApp), the client calls:
- **POST** `/api/ai/staged-actions/{staged_action_id}/confirm`
```json
{
  "confirmed_by": "The Group Managing Director",
  "confirmation_hash": "sha256:7e8d2..."
}
```
*The request status transitions to `APPROVED` on the ledger, an audit event is logged, and the GMD can tap the Bank Quick-Pay link to disburse!*
    "amount": 150000,
    "formattedAmount": "₦150,000",
    "status": "APPROVED",
    "subsidiary": "BEMS Group",
    "requester": "Babatunde Diekolayomi"
  },
  "beneficiary": {
    "name": "Babatunde Diekolayomi",
    "bankName": "Kuda Microfinance Bank",
    "accountNumber": "2001928374",
    "type": "STAFF"
  },
  "disbursement": {
    "beneficiaryName": "Babatunde Diekolayomi",
    "accountNumber": "2001928374",
    "bankName": "Kuda Microfinance Bank",
    "amount": 150000,
    "formattedAmount": "₦150,000",
    "reference": "REQ-2026-0005",
    "quickPayUrl": "https://bemserp.work/pay/REQ-2026-0005",
    "ussdDialer": "tel:*737*2*150000*2001928374#",
    "ussdRaw": "*737*2*150000*2001928374#",
    "bankingApps": [
      { "name": "GTWorld (GTBank)", "scheme": "gtworld://" },
      { "name": "Kuda Bank", "scheme": "kuda://" },
      { "name": "OPay", "scheme: "opay://" },
      { "name": "Moniepoint", "scheme": "moniepoint://" },
      { "name": "Zenith Bank", "scheme": "zenithbank://" },
      { "name": "Access More", "scheme": "accessmore://" }
    ]
  },
  "gmdActionLink": "https://bemserp.work/pay/REQ-2026-0005"
}
```

---

## 4. Tool 3: Register Bank Account Numbers

Allows registering or updating bank account numbers for **Staff**, **Subsidiaries (Corporate Accounts)**, or **Vendors**.

- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/bank-accounts`
- **Request Body (Staff):**
```json
{
  "targetType": "STAFF",
  "targetId": "babatundediekolayomi@gmail.com", // Email, Staff Name, or Employee ID
  "bankName": "Guaranty Trust Bank",            // Matches names like "GTB", "Kuda", "Zenith", etc.
  "accountNumber": "0123456789",               // Exactly 10 digits
  "accountName": "Babatunde Diekolayomi"
}
```
- **Request Body (Corporate Subsidiary):**
```json
{
  "targetType": "SUBSIDIARY",
  "targetId": "BEMS-GROUP",                     // Shortcode or Subsidiary Name
  "bankName": "Zenith Bank",
  "accountNumber": "1019283746",
  "accountName": "BEMS Group Holdings Operational",
  "accountType": "Corporate Operational"       // Operational | Escrow | Float
}
```
- **Request Body (Vendor):**
```json
{
  "targetType": "VENDOR",
  "targetId": "AgroParts Hub Ltd",
  "bankName": "Access Bank",
  "accountNumber": "0987654321",
  "accountName": "AgroParts Hub Nigeria Ltd"
}
```
- **Response Schema:**
```json
{
  "ok": true,
  "targetType": "STAFF",
  "message": "Bank account registered successfully for staff \"Babatunde Diekolayomi\".",
  "employee": {
    "id": "cd0bb350-979a-4ba6-bd39-041523364025",
    "name": "Babatunde Diekolayomi",
    "employeeNumber": "BEMS-BSA-2026-0002",
    "bankName": "Guaranty Trust Bank (GTBank)",
    "accountNumber": "0123456789",
    "accountName": "Babatunde Diekolayomi"
  }
}
```

---

## 5. Tool 4: Executive Admin Onboarding

> **Strict 3-Role Rule Compliance:**
> Admin creation is strictly reserved for **`SUPER_ADMIN`** and **`GMD`**. Never attempt to onboard Staff through this endpoint (Staff accounts use self-service registration).

- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/admin-onboarding`
- **Request Body:**
```json
{
  "legalName": "Engr. Michael Adeyemi",
  "workEmail": "adeyemi@bemsgroup.com",
  "phone": "+2348030001122",
  "role": "SUPER_ADMIN",                        // Strictly: "SUPER_ADMIN" or "GMD"
  "subsidiaryId": "7f84f13a-d3e3-4203-8157-be0de305f459" // Optional: Defaults to HQ
}
```
- **Response Schema:**
```json
{
  "ok": true,
  "message": "Executive Admin \"Engr. Michael Adeyemi\" onboarded successfully as SUPER_ADMIN.",
  "employee": {
    "id": "90214a12-4321-4def-89ab-123456789abc",
    "legalName": "Engr. Michael Adeyemi",
    "workEmail": "adeyemi@bemsgroup.com",
    "employeeNumber": "BEMS-ADM-2026-0030",
    "role": "SUPER_ADMIN",
    "jobTitle": "Super Admin",
    "subsidiary": "BEMS Group"
  },
  "onboarding": {
    "invitationUrl": "https://bemserp.work/onboard?token=49fe38...&email=adeyemi%40bemsgroup.com",
    "emailDelivered": true,
    "expiresAt": "2026-11-12T12:00:00.000Z"
  }
}
```

---

## 6. Tool 5: Full Payroll Operations

### A. List All Payroll Periods & Totals
- **Method:** `GET`
- **Endpoint:** `/api/ai/tools/payroll`
- **Response:** Summary of periods, batch statuses, total gross, deductions, and net payouts.

### B. Get Individual Staff Payslips & Deductions Breakdown
- **Method:** `GET`
- **Endpoint:** `/api/ai/tools/payroll?action=GET_ITEMS&year=2026&month=11`
- **Response Schema:**
```json
{
  "ok": true,
  "period": {
    "year": 2026,
    "month": 11,
    "periodName": "November 2026",
    "batchStatus": "DRAFT",
    "totalGross": "₦8,500,000",
    "totalDeductions": "₦125,000",
    "totalNet": "₦8,375,000",
    "totalEmployees": 22
  },
  "items": [
    {
      "itemId": "item_123",
      "legalName": "Babatunde Diekolayomi",
      "employeeNumber": "BEMS-BSA-2026-0002",
      "grossSalary": 100000,
      "deductions": 0,
      "netPay": 100000,
      "status": "CALCULATED",
      "isDisbursed": false,
      "bankDetails": {
        "bankName": "Kuda Microfinance Bank",
        "accountNumber": "2001928374",
        "accountName": "Babatunde Diekolayomi"
      }
    }
  ]
}
```

### C. Execute / Prepare Monthly Payroll Batch
Calculates base salary, automatically aggregates attendance lateness penalties and absences, and creates the batch:
- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/payroll`
- **Request Body:**
```json
{
  "action": "PREPARE",
  "year": 2026,
  "month": 11
}
```

### D. Sign Off & Approve Payroll (GMD)
- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/payroll`
- **Request Body:**
```json
{
  "action": "SIGN_OFF",
  "year": 2026,
  "month": 11
}
```

### E. Record Salary Payout / Disbursement
- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/payroll`
- **Request Body (Single Staff):**
```json
{
  "action": "RECORD_PAYOUT",
  "itemId": "payroll_item_uuid"
}
```

---

## 7. Tool 6: Full Attendance & Timekeeping Operations

### A. Get Live Daily Attendance Roster
- **Method:** `GET`
- **Endpoint:** `/api/ai/tools/attendance?date=2026-11-05`
- **Response:** Live list of all staff, resumption times, lateness flags, active hours, and deduction percentages.

### B. Excuse or Override an Attendance Penalty
Waives lateness deductions or excuses absences:
- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/attendance`
- **Request Body:**
```json
{
  "action": "EXCUSE_OVERRIDE",
  "employeeId": "Babatunde Diekolayomi",       // Name, Email, or Employee ID
  "workDate": "2026-11-05",                   // YYYY-MM-DD
  "status": "PRESENT",                        // PRESENT or EXCUSED
  "deductionPercent": 0,                      // 0 waives all penalties
  "reason": "Traffic delay excused by GMD"
}
```

### C. Clock In / Out Staff Manually via AI
- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/attendance`
- **Request Body:**
```json
{
  "action": "CLOCK_IN",                       // CLOCK_IN or CLOCK_OUT
  "employeeId": "Babatunde Diekolayomi",
  "workDate": "2026-11-05",
  "stationName": "HQ Kiosk / AI Station"
}
```

### D. Update Shift Policy & Lateness Deduction Percentage
- **Method:** `POST`
- **Endpoint:** `/api/ai/tools/attendance`
- **Request Body:**
```json
{
  "action": "UPDATE_POLICY",
  "resumptionTime": "08:00",
  "gracePeriodMinutes": 15,
  "latenessDeductionPercent": 5.0
}
```

---

## 8. n8n HTTP Request Node Template

Below is the standard JSON structure to paste into an n8n **HTTP Request** node:

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
          "value": "Bearer 7095ec2348ee3a4ca855707cec7bab8a697f0de4aad3f93f0e545d82bba8e9a8"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"requestId\": \"{{ $json.requestNumber }}\",\n  \"decision\": \"APPROVE\",\n  \"comment\": \"{{ $json.approvalComment }}\"\n}",
    "options": {}
  },
  "name": "BEMS AI Approval & Bank Link",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

---

## 9. WhatsApp / Slack Notification Message Template for n8n

When an approval occurs, n8n can format this message to WhatsApp or Slack for the GMD:

```text
✅ *REQ-2026-0005 APPROVED*
*Title:* Starlink Router Replacement
*Amount:* ₦150,000
*Beneficiary:* Babatunde Diekolayomi
*Bank:* Kuda Microfinance Bank
*Account:* 2001928374

📲 *Tap to Disburse in Bank App:*
https://bemserp.work/pay/REQ-2026-0005

📞 *Fast Phone USSD:*
*737*2*150000*2001928374#
```

