import { StagedActionType } from '@/lib/staged-actions';
import { COMMAND_CATALOG } from './command-catalog';

export type ParityStatus = 'AI_PARITY_VERIFIED' | 'DASHBOARD_ONLY_INTENTIONAL';

export interface ParityInventoryEntry {
  dashboardRoute: string;
  methods: ReadonlyArray<'POST' | 'PUT' | 'PATCH' | 'DELETE'>;
  status: ParityStatus;
  commandType?: StagedActionType;
  justification?: string;
}

/**
 * Canonical inventory of every dashboard mutation route and its AI Command Registry parity status.
 * Enforced by `scripts/verify-platform-architecture.ts` so no new dashboard mutation ships
 * without a recorded AI parity status.
 */
export const PARITY_INVENTORY: ReadonlyArray<ParityInventoryEntry> = [
  // 1. Budgets
  {
    dashboardRoute: '/api/budgets',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'budget',
  },
  {
    dashboardRoute: '/api/budgets/[id]',
    methods: ['PATCH', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'budget',
  },

  // 2. Treasury & Bank Accounts
  {
    dashboardRoute: '/api/treasury',
    methods: ['POST', 'PATCH', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'treasury_account',
  },
  {
    dashboardRoute: '/api/staff/[employeeId]/banking',
    methods: ['POST', 'PATCH', 'PUT'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'bank_account_update',
  },

  // 3. Salary & Compensation
  {
    dashboardRoute: '/api/staff/[employeeId]/salary',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'salary_change',
  },
  {
    dashboardRoute: '/api/payroll/staff/[employeeId]',
    methods: ['POST', 'PATCH', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'salary_change',
  },
  {
    dashboardRoute: '/api/staff/[employeeId]/compensation',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'salary_change',
  },

  // 4. Requisitions, Approvals & Disbursements
  {
    dashboardRoute: '/api/requests/create',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'request_creation',
  },
  {
    dashboardRoute: '/api/requests/[requestNumber]/action',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'approval_decision',
  },
  {
    dashboardRoute: '/api/approvals/decide',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'approval_decision',
  },
  {
    dashboardRoute: '/api/disbursements',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payment_record',
  },
  {
    dashboardRoute: '/api/disbursements/record',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payment_record',
  },
  {
    dashboardRoute: '/api/disbursements/assignees',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payment_recorder',
  },
  {
    dashboardRoute: '/api/disbursements/confirm',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payroll_action',
  },
  {
    dashboardRoute: '/api/disbursements/verify',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payment_record',
  },

  // 5. Intercompany
  {
    dashboardRoute: '/api/intercompany',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'intercompany_note',
  },
  {
    dashboardRoute: '/api/intercompany/settle',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'intercompany_note',
  },
  {
    dashboardRoute: '/api/intercompany/[noteId]',
    methods: ['PATCH'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'intercompany_note',
  },

  // 6. Emergency
  {
    dashboardRoute: '/api/emergency',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'emergency_override',
  },

  // 7. Vendors & 3-Way Match
  {
    dashboardRoute: '/api/vendors',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'vendor_approval',
  },
  {
    dashboardRoute: '/api/vendors/grn',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'grn_creation',
  },
  {
    dashboardRoute: '/api/vendors/invoices',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'vendor_invoice_creation',
  },
  {
    dashboardRoute: '/api/matching/verify',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'vendor_invoice_creation',
  },

  // 8. Attendance
  {
    dashboardRoute: '/api/attendance/admin/override',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'attendance_override',
  },
  {
    dashboardRoute: '/api/attendance/admin/policy',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'attendance_override',
  },
  {
    dashboardRoute: '/api/attendance/admin/roster',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'attendance_override',
  },
  {
    dashboardRoute: '/api/attendance/admin/station',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'attendance_override',
  },
  {
    dashboardRoute: '/api/hr/attendance',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'attendance_override',
  },

  // 9. People Access, Staff & Onboarding
  {
    dashboardRoute: '/api/auth/approvals',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'staff_approval',
  },
  {
    dashboardRoute: '/api/hr/staff',
    methods: ['POST', 'PATCH'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'staff_management',
  },
  {
    dashboardRoute: '/api/staff/offline',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'staff_management',
  },
  {
    dashboardRoute: '/api/admin/employees/[employeeId]',
    methods: ['PATCH', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'staff_management',
  },
  {
    dashboardRoute: '/api/admin/employees/[employeeId]/status',
    methods: ['PATCH', 'POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'staff_management',
  },
  {
    dashboardRoute: '/api/admin/employees/[employeeId]/attendance-exemption',
    methods: ['POST', 'PATCH'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'staff_management',
  },
  {
    dashboardRoute: '/api/admin/employees/[employeeId]/request-update',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'staff_management',
  },
  {
    dashboardRoute: '/api/admin/leadership',
    methods: ['POST', 'PATCH', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'role_change',
  },
  {
    dashboardRoute: '/api/staff/invite',
    methods: ['POST', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'admin_onboarding',
  },
  {
    dashboardRoute: '/api/staff/invite/resend',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'admin_onboarding',
  },
  {
    dashboardRoute: '/api/staff/onboard',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'admin_onboarding',
  },

  // 10. Payroll Batch Operations
  {
    dashboardRoute: '/api/payroll/prepare',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payroll_action',
  },
  {
    dashboardRoute: '/api/payroll/record',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payroll_action',
  },
  {
    dashboardRoute: '/api/payroll/items/[itemId]',
    methods: ['PATCH', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payroll_action',
  },
  {
    dashboardRoute: '/api/payroll/assignees',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'payroll_action',
  },

  // 11. Subsidiaries & Organizations
  {
    dashboardRoute: '/api/departments',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'policy_update',
  },
  {
    dashboardRoute: '/api/organizations',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'subsidiary_creation',
  },
  {
    dashboardRoute: '/api/organizations/[organizationId]',
    methods: ['PATCH', 'PUT', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'subsidiary_update',
  },
  {
    dashboardRoute: '/api/businesses/[businessId]',
    methods: ['PATCH', 'PUT'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'subsidiary_update',
  },
  {
    dashboardRoute: '/api/businesses/[businessId]/channels',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'policy_update',
  },
  {
    dashboardRoute: '/api/businesses/[businessId]/templates/[templateId]/import',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'policy_update',
  },
  {
    dashboardRoute: '/api/businesses/[businessId]/members',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'admin_onboarding',
  },
  {
    dashboardRoute: '/api/admin/mobile-apps',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'policy_update',
  },
  {
    dashboardRoute: '/api/accountability/evidence',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'accountability_clearance',
  },
  {
    dashboardRoute: '/api/reports/export',
    methods: ['POST'],
    status: 'DASHBOARD_ONLY_INTENTIONAL',
    justification: 'Generates a read-only scoped download URL for /api/audit?export=true; no financial state mutation.',
  },
  {
    dashboardRoute: '/api/staff/[employeeId]/password',
    methods: ['POST', 'PATCH'],
    status: 'DASHBOARD_ONLY_INTENTIONAL',
    justification: 'Identity secret entry is strictly human-bound on the dedicated UI; BEMI stages SEND_PASSWORD_RESET_INVITE via staff_management.',
  },

  // 12. Accountability, Leave, Tasks, Messages & Policies
  {
    dashboardRoute: '/api/accountability/close',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'accountability_clearance',
  },
  {
    dashboardRoute: '/api/accountability',
    methods: ['POST', 'PATCH'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'deadline_extension',
  },
  {
    dashboardRoute: '/api/hr/leave',
    methods: ['POST', 'PATCH'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'leave_action',
  },
  {
    dashboardRoute: '/api/tasks',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'task_action',
  },
  {
    dashboardRoute: '/api/tasks/[taskId]',
    methods: ['PATCH'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'task_action',
  },
  {
    dashboardRoute: '/api/staff/chat/admin',
    methods: ['POST'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'staff_message',
  },
  {
    dashboardRoute: '/api/policies',
    methods: ['POST', 'PUT', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'policy_update',
  },
  {
    dashboardRoute: '/api/settings',
    methods: ['POST', 'PUT'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'policy_update',
  },
  {
    dashboardRoute: '/api/recurring',
    methods: ['POST', 'PATCH', 'DELETE'],
    status: 'AI_PARITY_VERIFIED',
    commandType: 'policy_update',
  },

  // 13. Intentional Human-Only / Device-Bound Routes
  {
    dashboardRoute: '/api/auth/login',
    methods: ['POST'],
    status: 'DASHBOARD_ONLY_INTENTIONAL',
    justification: 'Authentication credential exchange is strictly human-only; automation cannot mint human sessions.',
  },
  {
    dashboardRoute: '/api/auth/logout',
    methods: ['POST'],
    status: 'DASHBOARD_ONLY_INTENTIONAL',
    justification: 'Session destruction is bound to the human browser/mobile session.',
  },
  {
    dashboardRoute: '/api/auth/signup',
    methods: ['POST'],
    status: 'DASHBOARD_ONLY_INTENTIONAL',
    justification: 'Self-service staff registration is strictly human-driven on the Staff Portal/Mobile App.',
  },
  {
    dashboardRoute: '/api/auth/reset-password',
    methods: ['POST'],
    status: 'DASHBOARD_ONLY_INTENTIONAL',
    justification: 'Password reset requires human email OTP verification.',
  },
  {
    dashboardRoute: '/api/attendance/punch',
    methods: ['POST'],
    status: 'DASHBOARD_ONLY_INTENTIONAL',
    justification: 'Physical QR + GPS geofence clock-in requires live mobile device hardware telemetry.',
  },
  {
    dashboardRoute: '/api/attendance/kiosk-punch',
    methods: ['POST'],
    status: 'DASHBOARD_ONLY_INTENTIONAL',
    justification: 'Physical office kiosk PIN punch is bound to the office kiosk terminal.',
  },
];

export function verifyParityInventoryConsistency(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  for (const entry of PARITY_INVENTORY) {
    if (entry.status === 'AI_PARITY_VERIFIED') {
      if (!entry.commandType) {
        errors.push(`Route ${entry.dashboardRoute} is marked AI_PARITY_VERIFIED but has no commandType.`);
      } else if (!COMMAND_CATALOG[entry.commandType]) {
        errors.push(`Route ${entry.dashboardRoute} references unknown commandType "${entry.commandType}".`);
      }
    } else if (entry.status === 'DASHBOARD_ONLY_INTENTIONAL') {
      if (!entry.justification || entry.justification.trim().length < 10) {
        errors.push(`Route ${entry.dashboardRoute} is DASHBOARD_ONLY_INTENTIONAL without justification.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

