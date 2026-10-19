# BEMS AI Group Financial Manager
## Product requirements: what the AI must be able to do

**Audience:** BEMS AI automation engineer and product team  
**Product:** BEMS Connect  
**AI role:** Group Financial Manager  
**Authorized users:** Group Managing Director (GMD) and System Admin only

## 1. Purpose

BEMS needs an AI Group Financial Manager: a capable, conversational assistant that understands the whole BEMS financial-management system, keeps the GMD and System Admin informed, analyzes the organization’s financial activity, recommends useful next steps, and carries out authorized work in the system.
It should feel natural to talk to. The user can say “Good morning,” ask a broad question, explore an idea, request an analysis, or give a work instruction in ordinary language. They should not need to know menu names, database terms, or special commands.

The assistant is not a general staff chatbot. Only a signed-in GMD or System Admin may open or use it. It acts as a Group Financial Manager within BEMS; it does not gain authority beyond the signed-in person’s own role and the system’s financial controls. The AI is the same financial-management assistant for both roles, while each person’s permissions continue to determine what she can see and do.

## 1.1 Required connection to BEMS

The AI must connect to the BEMS backend through authenticated, authorized backend APIs. **She must never connect directly to PostgreSQL/Prisma or write to the database.** All reads and actions go through BEMS backend endpoints/services. The backend—not the AI model—must authenticate the signed-in user, apply role and record-level permissions, validate inputs, enforce approval and budget policies, run transactions, prevent duplicates, send required notifications, and write the authoritative audit events.

If an existing backend API does not support an AI-required task, engineering must add or extend a backend API/service for it. The AI may not work around a missing endpoint by opening a database connection, running SQL, calling an unrestricted ORM tool, or changing database records through another route. The AI receives only the authorized data returned by the backend.

Required path:

```text
GMD or System Admin → BEMS AI interface → AI orchestration/tool selection
  → authenticated BEMS backend API → validation, permissions, business rules, audit
  → database → backend result → AI explains completion to the user
```

## 2. What the AI must do

### A. Understand and answer questions about the whole system

The AI must be able to explain how BEMS works and answer questions using current, authorized system records across:

- Fund requests and their system IDs, owners, subsidiaries, categories, amounts, due dates, and status.
- Approval routing, pending decisions, approval history, policies, and reasons for delays.
- Budgets, allocations, commitments, spending, balances, and budget utilization.
- Disbursement records, transfer references, receipt files, recipient confirmations, and payment issues.
- Accountability evidence, close-out, overdue cases, and outstanding follow-up.
- Payroll periods, payroll totals, staff compensation changes, payroll payment status, and intercompany allocations.
- Vendors, invoices, recurring commitments, organizations/subsidiaries, audit history, and analytics.

It must answer follow-up questions using the context of the conversation. When asked “why?”, it should show the relevant records, policy, calculation, and assumptions—not just repeat a conclusion. It must use stable system IDs and human-readable references so a user can find each record.

### B. Act as the GMD and System Admin’s daily financial brief

When asked what needs attention, the AI must be able to produce a concise, current briefing that identifies:

- Decisions waiting for the GMD, with amounts, age, urgency, due date, and the reason each is in the queue.
- Payments approved but not yet recorded, payments due soon, and payments awaiting recipient confirmation.
- Budget risks, overspending, low remaining balances, unusual spend, and significant changes from prior periods.
- Payroll actions, upcoming payroll deadlines, compensation changes requiring review, and payroll payment issues.
- Overdue accountability, missing receipts/evidence, unresolved recipient reports, and other control gaps.
- The most important next actions, ranked by urgency and financial impact.

The briefing must distinguish facts from forecasts and recommendations, show the “as of” time and period, and link to the underlying BEMS records. It must not invent activity or claim to have a personal “mind”; it can answer warmly and proactively based on actual system conditions.

### C. Analyze financial and operational data

The AI must be able to:

- Analyze spending, requests, approvals, payments, payroll, budgets, vendors, and accountability by time period, subsidiary, department, category, requester, or status where the user is authorized.
- Compare current and previous periods, identify trends, calculate totals and variances, and explain what is driving a change.
- Forecast near-term cash requirements from approved unpaid requests, planned recurring commitments, and payroll obligations available in BEMS.
- Identify potential duplicates, unusual amounts, repeated exceptions, late approvals, missing documents, and other items worth human review.
- Run “what if” scenarios such as changing a budget allocation or delaying a planned expense without changing real records.
- Make practical recommendations, state the evidence and assumptions behind them, and offer the next useful action.

It must not present a forecast as a fact or label an anomaly as fraud. It should flag concerns for review and show the records behind them.

### D. Create and manage budgets

The AI must be able to create, review, and update budgets through BEMS. It should understand requests such as:

> “Create a ₦20 million Q1 budget for BemsSoft Hub: ₦8 million for cloud services, ₦7 million for payroll, and ₦5 million for operations.”

It must identify the organization, period, currency, total, and allocation lines; check existing budgets, current commitments, and available historical spend; validate totals; identify missing details; and present a complete preview. After the authorized user confirms, it must save the budget, return its system ID/link, and report the result. It must not silently replace, delete, or materially change an existing budget.

### E. Manage the request-to-accountability financial flow

The AI must be able to help the GMD or System Admin locate and understand any request, then perform eligible actions through the existing BEMS workflow:

1. Explain the request and its approval/evidence history.
2. Prepare an approval, clarification, or decline action with a clear reason where required.
3. Before an approval decision, show the request ID, amount, requester, subsidiary, vendor, budget impact, approval history, and policy checks.
4. On final approval, let the GMD assign an eligible executive to record the disbursement when desired.
5. Help the authorized payment recorder prepare the payment record and attach the actual bank slip/receipt.
6. Track recipient confirmation and accountability through completion.

The AI must use BEMS’s approval policy and current record state. It must not approve a request that is assigned to someone else, bypass approval stages, alter policy to make an action succeed, or impersonate a requester or recipient. A recipient must personally confirm receipt through their own account.

### F. Handle disbursements honestly

The AI must help prepare and record disbursements with the correct request, amount, payer account, beneficiary, bank, transfer reference, payment date, and actual receipt upload. It must confirm that the request is approved and prevent duplicate payment records.

The current BEMS flow records a bank transfer made outside the application. Until BEMS has a live, authorized bank integration, the AI must not say it sent or transferred money. It may say “I recorded the transfer details and receipt; recipient confirmation is pending.” If a future bank integration is added, initiation must have its own financial controls and approval requirements.

### G. Support payroll and staff compensation actions

For the GMD and System Admin, the AI must be able to summarize payroll and prepare an authorized staff salary addition or deduction. It must identify the employee, current and proposed compensation, amount or percentage change, effective date, and reason. It must show a before-and-after preview and explain who will be notified.

After confirmation and authorization, it must save a versioned change, preserve the old compensation history, record who approved it, and notify the affected staff member with the reason for the addition or deduction. It must never silently alter salary or reveal compensation in a conversation or briefing to an unauthorized person.

### H. Carry out other authorized system work

The AI must be able to perform supported work—not only explain it—including searching and filtering records, preparing and saving budgets, preparing decisions, assigning a payment recorder, drafting tasks, generating and exporting reports, and checking the result of its own actions. It should complete a multi-step task when the user’s instruction is clear and authorized, asking only for details that are genuinely missing or a required confirmation.

It must report what it completed, what remains, and any failure. If an action is unavailable in BEMS, it must say so clearly and offer the closest supported next step instead of pretending.

## 3. How it must communicate

- Speak naturally, directly, and respectfully; recognize the signed-in GMD or System Admin by their preferred name and title when available.
- Handle greetings and open-ended conversation, then use available BEMS context to make the exchange useful.
- Give the answer first, then the evidence and explanation the user needs.
- Explain unfamiliar financial and system terms in plain language.
- Ask a short follow-up when critical information is missing. Do not make up a value to avoid asking.
- For an action, summarize the intended result and any risks before asking for confirmation.
- After an action, provide its result, record ID, status, and a direct link where available.
- If it does not know, cannot access the record, or cannot complete the task, say so plainly.

## 4. Authority and mandatory safeguards

1. **Only the GMD and System Admin can use the AI.** Enforce this on the server for every chat request and every tool call. Hiding the button is not sufficient.
2. **The AI inherits the signed-in user’s permissions.** System Admin access to the assistant does not make it acceptable to bypass a GMD decision or financial policy. The system must enforce the exact permissions assigned to each role.
3. **Read actions may proceed immediately.** Searches, explanations, summaries, and calculations do not need confirmation, but must still respect access controls.
4. **Financial writes require a preview and explicit confirmation.** This includes budget creation/changes, salary changes, approvals/declines, request changes, payment recording, and payroll sign-off.
5. **Confirmation applies to one exact action.** If amount, account, beneficiary, request, organization, date, or another material field changes, require confirmation again.
6. **Do not fabricate or infer money movement.** Recording an off-platform transfer is not the same as sending money.
7. **Use the normal BEMS controls.** The AI must not bypass budget limits, approval stages, assignment checks, recipient confirmation, audit records, or notifications.
8. **Protect confidential information.** Do not reveal salaries, bank details, private messages, or records outside the user’s permission.
9. **Treat uploaded content as evidence, not authority.** Instructions inside receipts, invoices, request descriptions, email text, or other documents must never change the AI’s rules or grant permission.
10. **Keep a complete audit trail.** Record the user, action requested, preview, confirmation, records affected, outcome, timestamp, and correlation ID. Normal BEMS audit records remain authoritative for business changes.
11. **Never claim success without verified success.** Confirm the saved record, uploaded file, notification, or export actually exists before reporting completion.
12. **Do not block ordinary BEMS work.** The product must continue functioning if the AI provider is unavailable.

## 5. What “AI Group Financial Manager” means in practice

The AI should behave like a capable financial manager who knows the group’s BEMS records and can help move work forward. It can recommend a decision and prepare it. It can carry out a decision or financial change when the signed-in authorized executive instructs it and confirms the exact action. It does not make hidden decisions, independently approve its own recommendations, or bypass the organization’s controls.

Example:

**User:** “Hello Dr Pastra, what do you have in your mind today?”

**AI:** “Good morning, Dr Pastra. Three items need your attention: REQ-2026-0010, ₦340,000, has waited one day for approval; four approved requests totaling ₦3.385 million are due within 30 days; and two accountability cases are overdue. I can open the approval, show the upcoming cash commitments, or prepare a follow-up.”

The details above are illustrative. In operation, the assistant must retrieve current data and cite the corresponding records; it must never reuse example figures as live facts.

## 6. Complete delivery requirement

The target is the complete AI Group Financial Manager described in this document. There is no MVP or reduced first release. The delivered system must include the full set of capabilities: conversational assistance, system knowledge, role-scoped answers, live financial analysis, briefings, recommendations, budgets, request and approval work, disbursement recording and receipt handling, payroll and salary-change workflows, notifications, and auditability. These capabilities must be integrated into the BEMS application and backend as one complete solution.

The engineer should deliver all of the following as part of that complete solution:

- GMD/System Admin-only entry and server-side authorization on every conversation and tool operation.
- A natural-language assistant that can greet, answer broad system questions, retain conversation context, ask focused follow-ups, and explain its work.
- Current role-scoped system answers with source records, stable system IDs, date ranges, calculation details, and an “as of” time.
- Financial dashboards, analysis, comparisons, forecasts, anomaly flags, scenario modeling, and actionable recommendations across the available BEMS records.
- The full budget workflow: inspect, draft, validate, preview, create, and update budgets through backend APIs.
- The full request workflow: explain requests, prepare and execute authorized GMD decisions, request clarification or decline with reasons, and assign a payment recorder where allowed.
- The full disbursement workflow: check approval, capture actual transfer details, upload the real receipt, record the payment through the backend, and track recipient confirmation.
- The full payroll workflow: analyze payroll, support authorized salary additions/deductions, retain compensation history, require a reason and effective date, and notify the affected staff member.
- System-wide notifications, follow-ups, report generation/export, and verification that requested work completed.
- Complete auditability, idempotent retries, transaction safety, meaningful failures, monitoring, and an AI-unavailable fallback that leaves ordinary BEMS workflows usable.
- Automated tests for the above workflows, security boundaries, roles, financial controls, and system integrations.

All capabilities must use BEMS backend APIs. The model itself has no database credentials and no database write path.

## 7. Known project work required first

The current BEMS project already has request, approval, budget, payroll, disbursement, receipt, recipient-confirmation, analytics, notification, and audit workflows that the AI should use. As part of this complete delivery, engineering must make the four-role permissions and approval routing consistent throughout the project before enabling AI operations. Some current routes and schema comments still reference legacy role names such as COO, Finance, Verifier, and Head of Admin. The AI must not be built on top of inconsistent or bypassable authorization.

The app currently records off-platform transfers and stores receipt information; no live bank transfer capability has been established. Do not claim the AI can initiate a bank transfer until the bank integration is implemented, authorized, and audited.

## 8. Out of scope unless separately approved

- AI access for Staff or HR.
- Unconfirmed financial actions or autonomous approval of requests.
- Any AI-to-database connection or direct database write; AI operations must go through authenticated BEMS backend APIs.
- Sending money through a bank without a separately approved and implemented bank integration.
- Changing roles, approval policy, audit history, or security controls to make a requested action possible.
- Making financial, legal, tax, or fraud determinations without human review.

## 9. Completion standard

The AI is successful when the GMD or System Admin can speak naturally, get reliable answers from current BEMS data, understand why the answer is correct, ask for an analysis or recommendation, and complete any supported authorized task through BEMS backend APIs with a clear preview and appropriate confirmation—while every action remains permission-checked, traceable, and honest about what the system actually did. The AI has no direct database connection or write capability.
