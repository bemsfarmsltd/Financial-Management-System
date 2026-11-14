export type AiAccessScopeKey =
  | 'master'
  | 'context'
  | 'approvals'
  | 'requests'
  | 'request_messages'
  | 'accountability'
  | 'budgets'
  | 'payroll'
  | 'salary'
  | 'staff_profiles'
  | 'staff_status'
  | 'admin_onboarding'
  | 'subsidiary_create'
  | 'subsidiary_edit'
  | 'attendance_logs'
  | 'attendance_policy'
  | 'hr_leave'
  | 'vendors'
  | 'three_way_match'
  | 'intercompany'
  | 'bank_accounts'
  | 'tasks'
  | 'messages'
  | 'policies'
  | 'wallet';

export interface AiScopeDefinition {
  key: AiAccessScopeKey;
  category:
    | 'Master Control'
    | 'Financial & Approvals'
    | 'People, Payroll & HR'
    | 'Corporate, Attendance & Operations'
    | 'Procurement, Intercompany & Governance';
  label: string;
  description: string;
  endpoint: string;
  readLabel: string;
  writeLabel: string;
}

export const AI_ACCESS_SCOPES: AiScopeDefinition[] = [
 {key:'wallet',category:'Financial & Approvals',label:'Staff wallets',description:'Scoped wallet reads and release staging only. Human financial approval and staff withdrawal authentication cannot be delegated.',endpoint:'/api/ai/tools/wallet',readLabel:'Read scoped approved wallet funds',writeLabel:'Stage exact wallet release proposals'},
  {
    key: 'master',
    category: 'Master Control',
    label: 'Global AI Master Switch',
    description:
      'Master kill-switch governing all BEMi Copilot and n8n automation read queries and staged action writes across the entire ERP.',
    endpoint: '/api/ai/*',
    readLabel: 'Allow All AI Read Queries',
    writeLabel: 'Allow All AI Staged Writes',
  },
  {
    key: 'context',
    category: 'Financial & Approvals',
    label: 'Conglomerate Telemetry & Chat Context',
    description:
      'Unified executive snapshot, live KPI summaries, tool discovery index, and conversational copilot context.',
    endpoint: '/api/ai/context · /api/ai/chat',
    readLabel: 'Read Telemetry & Chat Context',
    writeLabel: 'Stage Actions from Chat Prompt',
  },
  {
    key: 'approvals',
    category: 'Financial & Approvals',
    label: 'Fund Request Approvals (Approve / Reject / Hold)',
    description:
      'Inspect pending fund requests, beneficiary bank details, USSD quick-pay links, and stage APPROVE, REJECT, or HOLD decisions.',
    endpoint: '/api/ai/tools/approvals',
    readLabel: 'Read Approval Queue',
    writeLabel: 'Stage Approval Decisions',
  },
  {
    key: 'requests',
    category: 'Financial & Approvals',
    label: 'Fund Requests & Recurring Templates',
    description:
      'Query fund requisitions and recurring expense templates, or stage creating new requests, recurring schedules, and deleting pending requests.',
    endpoint: '/api/ai/tools/requests',
    readLabel: 'Read Requests & Recurring',
    writeLabel: 'Stage Create / Delete Requests',
  },
  {
    key: 'request_messages',
    category: 'Financial & Approvals',
    label: 'Request Thread Comments & Formal Clarifications',
    description:
      'Read request discussion threads or stage posting comments and requesting formal clarification (placing requests on hold).',
    endpoint: '/api/ai/tools/requests (Messages)',
    readLabel: 'Read Request Threads',
    writeLabel: 'Stage Comments & Clarifications',
  },
  {
    key: 'accountability',
    category: 'Financial & Approvals',
    label: 'Accountability & Proof-of-Spend Retirements',
    description:
      'Inspect open/overdue post-disbursement accountability cases or stage clearing cases, flagging discrepancies, and extending deadlines.',
    endpoint: '/api/ai/tools/accountability',
    readLabel: 'Read Accountability Cases',
    writeLabel: 'Stage Clear / Flag / Extend',
  },
  {
    key: 'budgets',
    category: 'Financial & Approvals',
    label: 'Subsidiary & Category Budgets',
    description:
      'Read monthly subsidiary budget utilization or stage creating/updating monthly budgets and category allocation lines.',
    endpoint: '/api/ai/tools/budgets',
    readLabel: 'Read Budgets & Utilization',
    writeLabel: 'Stage Budget Allocations',
  },
  {
    key: 'bank_accounts',
    category: 'Financial & Approvals',
    label: 'Bank Account Registry (Staff, Treasury & Vendors)',
    description:
      'Inspect registered bank accounts or stage 10-digit NUBAN updates for staff salary accounts, subsidiary treasury accounts, and vendors.',
    endpoint: '/api/ai/tools/bank-accounts',
    readLabel: 'Read Bank Accounts',
    writeLabel: 'Stage Bank Account Updates',
  },
  {
    key: 'payroll',
    category: 'People, Payroll & HR',
    label: 'Payroll Batches, Sign-Off & Payouts',
    description:
      'Read monthly payroll batches and payslips, or stage batch preparation, GMD sign-off, salary payouts, item removal, and receipt confirmation.',
    endpoint: '/api/ai/tools/payroll',
    readLabel: 'Read Payroll & Payslips',
    writeLabel: 'Stage Prepare / Sign-Off / Payout',
  },
  {
    key: 'salary',
    category: 'People, Payroll & HR',
    label: 'Staff Base Salary Adjustments',
    description:
      'Inspect staff base remuneration or stage base salary revisions with mandatory audit reason.',
    endpoint: '/api/ai/tools/payroll (Salary)',
    readLabel: 'Read Staff Base Salaries',
    writeLabel: 'Stage Salary Revisions',
  },
  {
    key: 'staff_profiles',
    category: 'People, Payroll & HR',
    label: 'Staff Directory & Profile Editing',
    description:
      'Search the staff directory or stage editing staff profile fields (name, email, phone, job title, department, subsidiary transfer, role) and offline registration.',
    endpoint: '/api/ai/tools/staff (Profiles)',
    readLabel: 'Read Staff Directory',
    writeLabel: 'Stage Profile Edits & Registration',
  },
  {
    key: 'staff_status',
    category: 'People, Payroll & HR',
    label: 'Staff Status, Attendance Exemptions & Deactivation',
    description:
      'Read employment status and exemption flags, or stage toggling attendance exemptions, suspending/activating accounts, and deactivating staff.',
    endpoint: '/api/ai/tools/staff (Governance)',
    readLabel: 'Read Status & Exemptions',
    writeLabel: 'Stage Status & Exemption Changes',
  },
  {
    key: 'admin_onboarding',
    category: 'People, Payroll & HR',
    label: 'Executive Admin Onboarding (GMD & Super Admin)',
    description:
      'Inspect pending executive email invitations or stage inviting, resending, and revoking GMD / Super Admin onboarding links.',
    endpoint: '/api/ai/tools/admin-onboarding',
    readLabel: 'Read Executive Invitations',
    writeLabel: 'Stage Invite / Resend / Revoke',
  },
  {
    key: 'hr_leave',
    category: 'People, Payroll & HR',
    label: 'HR Leave Applications & Approvals',
    description:
      'Read staff leave requests and balances, or stage filing new leave applications and approving/rejecting leave requests.',
    endpoint: '/api/ai/tools/hr-leave',
    readLabel: 'Read Leave Applications',
    writeLabel: 'Stage Leave Create / Approve / Reject',
  },
  {
    key: 'messages',
    category: 'People, Payroll & HR',
    label: 'Direct Staff Helpdesk Messaging',
    description:
      'Read Staff-Admin helpdesk threads (GMD / HR channels) or stage sending direct executive messages and email alerts to staff.',
    endpoint: '/api/ai/tools/messages',
    readLabel: 'Read Helpdesk Threads',
    writeLabel: 'Stage Direct Staff Messages',
  },
  {
    key: 'subsidiary_create',
    category: 'Corporate, Attendance & Operations',
    label: 'Subsidiary Creation & Initialization',
    description:
      'Read active subsidiaries across the conglomerate or stage onboarding a brand-new subsidiary with default governance policies.',
    endpoint: '/api/ai/tools/subsidiary (Create)',
    readLabel: 'Read Subsidiary Portfolio',
    writeLabel: 'Stage New Subsidiary Creation',
  },
  {
    key: 'subsidiary_edit',
    category: 'Corporate, Attendance & Operations',
    label: 'Subsidiary Profile, RC Number & Budget Editing',
    description:
      'Read subsidiary metadata (RC number, operating location, industry, active status) or stage editing existing subsidiary details and monthly budgets.',
    endpoint: '/api/ai/tools/subsidiary (Update)',
    readLabel: 'Read Subsidiary Metadata',
    writeLabel: 'Stage Subsidiary Info Edits',
  },
  {
    key: 'attendance_logs',
    category: 'Corporate, Attendance & Operations',
    label: 'Daily Attendance Logs, Excuses & Manual Clock-In/Out',
    description:
      'Read daily staff attendance logs and lateness deductions, or stage excusing lateness, overriding records, and manual clock-in/out.',
    endpoint: '/api/ai/tools/attendance (Logs)',
    readLabel: 'Read Daily Attendance Logs',
    writeLabel: 'Stage Excuse / Override / Clock-In',
  },
  {
    key: 'attendance_policy',
    category: 'Corporate, Attendance & Operations',
    label: 'Shift Policies, Rosters & Starlink/GPS Geofence Stations',
    description:
      'Read shift rules and geofence stations, or stage updating resumption policies, Starlink/GPS locks, staff shift rosters, and GPS station calibration.',
    endpoint: '/api/ai/tools/attendance (Policy)',
    readLabel: 'Read Shift & Geofence Policies',
    writeLabel: 'Stage Policy, Roster & GPS Changes',
  },
  {
    key: 'tasks',
    category: 'Corporate, Attendance & Operations',
    label: 'Executive Follow-Up Tasks',
    description:
      'Read assigned executive follow-up tasks and deadlines, or stage creating, completing, and updating task statuses.',
    endpoint: '/api/ai/tools/tasks',
    readLabel: 'Read Follow-Up Tasks',
    writeLabel: 'Stage Create / Complete Tasks',
  },
  {
    key: 'vendors',
    category: 'Procurement, Intercompany & Governance',
    label: 'Vendor & Supplier Registry',
    description:
      'Read the verified vendor directory or stage registering new suppliers with NUBAN bank account details.',
    endpoint: '/api/ai/tools/vendors (Registry)',
    readLabel: 'Read Vendor Registry',
    writeLabel: 'Stage Vendor Registration',
  },
  {
    key: 'three_way_match',
    category: 'Procurement, Intercompany & Governance',
    label: 'GRNs, Vendor Invoices & 3-Way Matching',
    description:
      'Inspect read-only 3-way match status (PO vs GRN vs Invoice) or stage recording Goods Receipt Notes, logging vendor invoices, and running 3-way match.',
    endpoint: '/api/ai/tools/vendors (3-Way Match)',
    readLabel: 'Read 3-Way Match & GRNs',
    writeLabel: 'Stage GRN, Invoice & Match',
  },
  {
    key: 'intercompany',
    category: 'Procurement, Intercompany & Governance',
    label: 'Intercompany Debit/Credit Notes & Netting',
    description:
      'Query the bilateral intercompany netting matrix or stage paired Debit/Credit cross-charge notes and monthly settlements.',
    endpoint: '/api/ai/tools/intercompany',
    readLabel: 'Read Netting Matrix',
    writeLabel: 'Stage Paired Notes & Settlement',
  },
  {
    key: 'policies',
    category: 'Procurement, Intercompany & Governance',
    label: 'Approval Policies & Workspace Governance Settings',
    description:
      'Read approval policy bands and workspace settings, or stage upserting approval threshold bands and governance configuration.',
    endpoint: '/api/ai/tools/policies',
    readLabel: 'Read Approval Policies',
    writeLabel: 'Stage Policy & Setting Updates',
  },
];

export type AiAccessMatrix = Record<string, boolean>;

export function buildDefaultAiAccessMatrix(): AiAccessMatrix {
  const matrix: AiAccessMatrix = {};
  for (const scope of AI_ACCESS_SCOPES) {
    matrix[`${scope.key}.read`] = true;
    matrix[`${scope.key}.write`] = true;
  }
  return matrix;
}

export function normalizeAiAccessMatrix(raw?: Record<string, unknown> | null): AiAccessMatrix {
  const defaults = buildDefaultAiAccessMatrix();
  if (!raw || typeof raw !== 'object') return defaults;
  const merged: AiAccessMatrix = { ...defaults };
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'boolean') {
      merged[k] = v;
    }
  }
  return merged;
}

