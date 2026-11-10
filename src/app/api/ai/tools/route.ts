import { NextRequest, NextResponse } from 'next/server';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  return NextResponse.json({
    ok: true,
    service: 'BEMS Enterprise AI Agent Tooling Gateway',
    version: '2.0.0',
    authenticatedActor: {
      name: actor?.legalName,
      role: actor?.role,
      isExecutive: actor?.isExecutive,
    },
    availableTools: [
      {
        name: 'analytics',
        endpoint: '/api/ai/tools/analytics',
        methods: ['GET', 'POST'],
        description: 'Query live financial analytics (get_financial_analytics), requests/disbursements totals, budget allocation variance, and accountability retiral anomalies.',
      },
      {
        name: 'forecast',
        endpoint: '/api/ai/tools/forecast',
        methods: ['GET', 'POST'],
        description: 'Query live 30-day cash forecasting (get_cash_forecast) across approved unpaid requests, recurring commitments, and active payroll obligations.',
      },
      {name:'wallet',endpoint:'/api/ai/tools/wallet',methods:['GET','POST'],description:'GMD-only scoped wallet reads and exact staff-request or whole-payroll release staging. No AI approval or withdrawal. Return the wallet_release card for secure human confirmation.'},
      {
        name: 'budgets',
        endpoint: '/api/ai/tools/budgets',
        methods: ['GET', 'POST'],
        description: 'List, create, edit, reallocate lines, and remove corporate fiscal budgets across subsidiaries (staged).',
      },
      {
        name: 'subsidiary',
        endpoint: '/api/ai/tools/subsidiary',
        methods: ['GET', 'POST'],
        description: 'List, create (action: CREATE), or edit/update (action: UPDATE) corporate subsidiaries, RC numbers, headquarters, industries, brand colors, and monthly budgets (staged).',
      },
      {
        name: 'staff',
        endpoint: '/api/ai/tools/staff',
        methods: ['GET', 'POST'],
        description: 'Query staff directory or stage staff profile edits (EDIT_PROFILE), attendance exemption toggles (TOGGLE_ATTENDANCE_EXEMPT), status changes (CHANGE_STATUS: ACTIVE/SUSPENDED/TERMINATED), offline staff registration (REGISTER_OFFLINE), profile update requests (REQUEST_UPDATE), and account deactivation/deletion (DELETE_OR_DEACTIVATE).',
      },
      {
        name: 'requests',
        endpoint: '/api/ai/tools/requests',
        methods: ['GET', 'POST'],
        description: 'Query expenditure requests and recurring commitments, or stage creating a new fund request or recurring commitment (staged).',
      },
      {
        name: 'approvals',
        endpoint: '/api/ai/tools/approvals',
        methods: ['GET', 'POST'],
        description: 'Stage approval/rejection of fund requests and retrieve beneficiary account details + bank app deep links.',
      },
      {
        name: 'bank_accounts',
        endpoint: '/api/ai/tools/bank-accounts',
        methods: ['POST'],
        description: 'Stage registering or updating bank account details for staff, subsidiary treasury, or vendor.',
      },
      {
        name: 'admin_onboarding',
        endpoint: '/api/ai/tools/admin-onboarding',
        methods: ['POST'],
        description: 'Stage onboarding and executive email invitation for SUPER_ADMIN or GMD.',
      },
      {
        name: 'payroll',
        endpoint: '/api/ai/tools/payroll',
        methods: ['GET', 'POST'],
        description: 'Inspect payroll or stage preparing monthly payroll batches, signing off, adjusting salaries, and recording payouts.',
      },
      {
        name: 'attendance',
        endpoint: '/api/ai/tools/attendance',
        methods: ['GET', 'POST'],
        description: 'Inspect live daily attendance or stage excuse overrides, manual clock-in/out, shift/deduction policy updates, Starlink Wi-Fi lock toggles (TOGGLE_STARLINK_LOCK), and GPS geofence toggles (TOGGLE_GEOFENCE_LOCK).',
      },
      {
        name: 'vendors',
        endpoint: '/api/ai/tools/vendors',
        methods: ['GET', 'POST'],
        description: 'Vendor registry & 3-way matching engine: inspect matches (CHECK_MATCH) or stage vendor registration (REGISTER), Goods Receipt Notes (RECORD_GRN), Vendor Invoices (RECORD_INVOICE), and match recomputation (RECOMPUTE_MATCH).',
      },
      {
        name: 'intercompany',
        endpoint: '/api/ai/tools/intercompany',
        methods: ['GET', 'POST'],
        description: 'Inspect intercompany recharge matrix or stage paired debit/credit note generation (CREATE_NOTE) and netting settlement (SETTLE).',
      },
      {
        name: 'hr_leave',
        endpoint: '/api/ai/tools/hr-leave',
        methods: ['GET', 'POST'],
        description: 'List HR leave requests or stage creating, approving, or rejecting a leave request (CREATE_LEAVE, APPROVE_LEAVE, REJECT_LEAVE).',
      },
      {
        name: 'tasks',
        endpoint: '/api/ai/tools/tasks',
        methods: ['GET', 'POST'],
        description: 'List follow-up tasks or stage assigning (CREATE_TASK), completing (COMPLETE_TASK), or reopening (REOPEN_TASK) a task.',
      },
      {
        name: 'accountability',
        endpoint: '/api/ai/tools/accountability',
        methods: ['GET', 'POST'],
        description: 'List 72-hour cash advance accountability cases or stage retiral clearance (CLEAR_CASE) and SLA deadline extensions (EXTEND_DEADLINE).',
      },
      {
        name: 'messages',
        endpoint: '/api/ai/tools/messages',
        methods: ['GET', 'POST'],
        description: 'Read staff-admin helpdesk threads or stage sending a direct executive (GMD) or HR message to a staff member with in-app & email alerts.',
      },
      {
        name: 'policies',
        endpoint: '/api/ai/tools/policies',
        methods: ['GET', 'POST'],
        description: 'Inspect or stage updates to corporate approval matrix threshold bands (UPDATE_APPROVAL_POLICY) and workspace governance settings (UPDATE_WORKSPACE_SETTINGS).',
      },
    ],
  });
}

