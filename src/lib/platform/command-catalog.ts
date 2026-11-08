import { AiAccessScopeKey } from '@/lib/ai-access-control';
import { CanonicalRole, normalizeCanonicalRole } from './actor-scope';
import { StagedActionType } from '@/lib/staged-actions';

export interface CommandDescriptor {
  actionType: StagedActionType;
  commandVersion: number;
  title: string;
  aiScope: AiAccessScopeKey;
  allowedCallerRoles: ReadonlyArray<CanonicalRole>;
  allowedApproverRoles: ReadonlyArray<'GMD' | 'SUPER_ADMIN'>;
  requiredFields: ReadonlyArray<string>;
  targetEntityType: string;
  dashboardRoutes: ReadonlyArray<string>;
  validateInput: (payload: Record<string, any>) => {
    valid: boolean;
    missingFields: string[];
    errorMessage?: string;
  };
}

function checkRequiredFields(
  payload: Record<string, any>,
  groups: ReadonlyArray<string | ReadonlyArray<string>>
): string[] {
  const missing: string[] = [];
  for (const group of groups) {
    if (typeof group === 'string') {
      const val = payload[group];
      if (val === undefined || val === null || String(val).trim() === '') {
        missing.push(group);
      }
    } else {
      const satisfied = group.some((key) => {
        const val = payload[key];
        return val !== undefined && val !== null && String(val).trim() !== '';
      });
      if (!satisfied) {
        missing.push(group.join(' | '));
      }
    }
  }
  return missing;
}

export const COMMAND_CATALOG: Record<StagedActionType, CommandDescriptor> = {
  notification_read: { actionType: 'notification_read', commandVersion: 2, title: 'Mark notifications read', aiScope: 'messages', allowedCallerRoles: ['GMD', 'SUPER_ADMIN'], allowedApproverRoles: ['GMD', 'SUPER_ADMIN'], requiredFields: [], targetEntityType: 'NOTIFICATION', dashboardRoutes: ['/api/notifications'], validateInput: () => ({ valid: true, missingFields: [] }) },
  budget: {
    actionType: 'budget',
    commandVersion: 2,
    title: 'Budget Allocation / Reallocation / Lifecycle',
    aiScope: 'budgets',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['mode', 'organization_id | subsidiaryId'],
    targetEntityType: 'BUDGET',
    dashboardRoutes: ['/api/budgets', '/api/budgets/[id]'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [
        ['organization_id', 'organizationId', 'subsidiaryId'],
      ]);
      const mode = String(payload.mode || payload.operation || 'create').toLowerCase();
      if ((mode === 'update' || mode === 'reallocate' || mode === 'archive') && !payload.budget_id && !payload.id) {
        missing.push('budget_id');
      }
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `Missing required budget fields: ${missing.join(', ')}` : undefined,
      };
    },
  },
  approval_decision: {
    actionType: 'approval_decision',
    commandVersion: 2,
    title: 'Expenditure Requisition Approval Decision',
    aiScope: 'approvals',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['request_id', 'decision'],
    targetEntityType: 'REQUEST',
    dashboardRoutes: ['/api/approvals/decide', '/api/requests/[requestNumber]/action'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, ['request_id', 'decision']);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `approval_decision requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  payment_record: {
    actionType: 'payment_record',
    commandVersion: 2,
    title: 'Corporate Disbursement & Payment Voucher Recording',
    aiScope: 'approvals',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['request_id', 'payer_account_id', 'amount', 'transfer_reference'],
    targetEntityType: 'DISBURSEMENT',
    dashboardRoutes: ['/api/disbursements', '/api/disbursements/record'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [
        'request_id',
        ['payer_account_id', 'payerAccountId'],
        'amount',
        ['transfer_reference', 'externalReference'],
      ]);
      if (Number(payload.amount) <= 0) {
        missing.push('amount (> 0)');
      }
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `payment_record requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  payment_recorder: {
    actionType: 'payment_recorder',
    commandVersion: 2,
    title: 'Assign Disbursement Payment Recorder',
    aiScope: 'approvals',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['request_id', 'assignee_user_id'],
    targetEntityType: 'REQUEST',
    dashboardRoutes: ['/api/disbursements/assignees'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, ['request_id', 'assignee_user_id']);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `payment_recorder requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  salary_change: {
    actionType: 'salary_change',
    commandVersion: 2,
    title: 'Staff Compensation & Payroll Agreement Modification',
    aiScope: 'salary',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['employee_id', 'amount | new_base_salary', 'reason'],
    targetEntityType: 'COMPENSATION',
    dashboardRoutes: ['/api/staff/[employeeId]/salary', '/api/payroll/staff/[employeeId]'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [
        ['employee_id', 'employeeId'],
        ['amount', 'new_base_salary'],
      ]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `salary_change requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  staff_approval: {
    actionType: 'staff_approval',
    commandVersion: 2,
    title: 'Self-Service Staff Onboarding Approval',
    aiScope: 'staff_status',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['employee_id'],
    targetEntityType: 'EMPLOYEE',
    dashboardRoutes: ['/api/auth/approvals', '/api/hr/staff'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [['employee_id', 'employeeId']]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? 'staff_approval requires employee_id.' : undefined,
      };
    },
  },
  role_change: {
    actionType: 'role_change',
    commandVersion: 2,
    title: 'System Role Assignment & Session Revocation',
    aiScope: 'staff_status',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['employee_id', 'new_role'],
    targetEntityType: 'EMPLOYEE',
    dashboardRoutes: ['/api/admin/leadership'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [['employee_id', 'employeeId'], 'new_role']);
      if (payload.new_role && !normalizeCanonicalRole(payload.new_role)) {
        return {
          valid: false,
          missingFields: ['new_role (STAFF | GMD | SUPER_ADMIN)'],
          errorMessage: `Invalid target role "${payload.new_role}". Only STAFF, GMD, and SUPER_ADMIN exist.`,
        };
      }
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `role_change requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  accountability_clearance: {
    actionType: 'accountability_clearance',
    commandVersion: 2,
    title: 'Accountability Case Clearance & Closure',
    aiScope: 'accountability',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['case_id | request_number'],
    targetEntityType: 'ACCOUNTABILITY_CASE',
    dashboardRoutes: ['/api/accountability/close'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [['case_id', 'request_number']]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? 'accountability_clearance requires case_id or request_number.' : undefined,
      };
    },
  },
  deadline_extension: {
    actionType: 'deadline_extension',
    commandVersion: 2,
    title: 'Accountability Case Deadline Extension',
    aiScope: 'accountability',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['case_id'],
    targetEntityType: 'ACCOUNTABILITY_CASE',
    dashboardRoutes: ['/api/accountability'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, ['case_id']);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? 'deadline_extension requires case_id.' : undefined,
      };
    },
  },
  treasury_account: {
    actionType: 'treasury_account',
    commandVersion: 2,
    title: 'Corporate Treasury Bank Account Lifecycle',
    aiScope: 'bank_accounts',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['mode', 'account_number | account_id'],
    targetEntityType: 'COMPANY_BANK_ACCOUNT',
    dashboardRoutes: ['/api/treasury'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [['account_number', 'accountNumber', 'account_id', 'id']]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `treasury_account requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  intercompany_note: {
    actionType: 'intercompany_note',
    commandVersion: 2,
    title: 'Intercompany Paired-Note Issuance & Net Settlement',
    aiScope: 'intercompany',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['sub_action'],
    targetEntityType: 'INTERCOMPANY_NOTE',
    dashboardRoutes: ['/api/intercompany', '/api/intercompany/settle', '/api/intercompany/[noteId]'],
    validateInput: (payload) => {
      const subAction = String(payload.sub_action || payload.mode || payload.action || 'CREATE_NOTE').toUpperCase();
      if (['SETTLE', 'STAGE_SETTLEMENT', 'RECONCILE_SETTLEMENT', 'RECONCILE', 'RECONCILE_NOTE'].includes(subAction)) {
        const hasNotes =
          (Array.isArray(payload.targetNoteIds) && payload.targetNoteIds.length > 0) || (Array.isArray(payload.noteIds) && payload.noteIds.length > 0) ||
          Boolean(payload.noteId);
        return {
          valid: hasNotes,
          missingFields: hasNotes ? [] : ['targetNoteIds'],
          errorMessage: hasNotes ? undefined : 'Intercompany settlement requires targetNoteIds.',
        };
      }
      const missing = checkRequiredFields(payload, [
        ['source_entity_id', 'sourceEntityId'],
        ['target_entity_id', 'targetEntityId'],
        'amount',
      ]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `intercompany_note requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  vendor_approval: {
    actionType: 'vendor_approval',
    commandVersion: 2,
    title: 'Vendor Registry Onboarding & Verification',
    aiScope: 'vendors',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['mode', 'vendor_id | vendor_name'],
    targetEntityType: 'VENDOR',
    dashboardRoutes: ['/api/vendors'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [['vendor_id', 'vendorId', 'vendor_name', 'name']]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `vendor_approval requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  emergency_override: {
    actionType: 'emergency_override',
    commandVersion: 2,
    title: 'Executive Emergency Declaration & Request Override',
    aiScope: 'approvals',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['mode', 'justification'],
    targetEntityType: 'REQUEST',
    dashboardRoutes: ['/api/emergency'],
    validateInput: (payload) => {
      const mode = String(payload.mode || (payload.request_id ? 'OVERRIDE_EXISTING_REQUEST' : 'DECLARE_NEW_EMERGENCY')).toUpperCase();
      const missing = checkRequiredFields(payload, [['justification', 'reason']]);
      if (mode === 'OVERRIDE_EXISTING_REQUEST' && !payload.request_id) {
        missing.push('request_id');
      }
      if (mode === 'DECLARE_NEW_EMERGENCY') {
        missing.push(...checkRequiredFields(payload, [['subsidiary_id', 'subsidiaryId'], 'title', 'amount']));
      }
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `emergency_override requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  attendance_override: {
    actionType: 'attendance_override',
    commandVersion: 2,
    title: 'Attendance Status Override, Roster & Policy Control',
    aiScope: 'attendance_logs',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['action_type'],
    targetEntityType: 'ATTENDANCE',
    dashboardRoutes: [
      '/api/attendance/admin/override',
      '/api/attendance/admin/policy',
      '/api/attendance/admin/roster',
      '/api/attendance/admin/station',
      '/api/hr/attendance',
    ],
    validateInput: (payload) => {
      const sub = String(payload.action_type || payload.sub_action || 'EXCUSE_OVERRIDE').toUpperCase();
      if (
        sub === 'UPDATE_POLICY' ||
        sub === 'TOGGLE_STARLINK_LOCK' ||
        sub === 'TOGGLE_GEOFENCE_LOCK' ||
        sub === 'TOGGLE_POWER_OUTAGE' ||
        sub === 'CALIBRATE_STATION'
      ) {
        return { valid: true, missingFields: [] };
      }
      const missing = checkRequiredFields(payload, [['employee_id', 'employeeId']]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? 'attendance_override requires employee_id.' : undefined,
      };
    },
  },
  admin_onboarding: {
    actionType: 'admin_onboarding',
    commandVersion: 2,
    title: 'Executive Email Invitation & Onboarding',
    aiScope: 'admin_onboarding',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['workEmail', 'role', 'subsidiaryId'],
    targetEntityType: 'ADMIN_INVITATION',
    dashboardRoutes: ['/api/staff/invite', '/api/staff/invite/resend', '/api/staff/onboard'],
    validateInput: (payload) => {
      if (['RESEND_INVITE', 'REVOKE_INVITE'].includes(String(payload.sub_action || '').toUpperCase())) { const missing = checkRequiredFields(payload, [['invitationId', 'id']]); return { valid: missing.length === 0, missingFields: missing }; }
      const missing = checkRequiredFields(payload, [
        ['workEmail', 'work_email', 'email'],
        'role',
        ['subsidiaryId', 'subsidiary_id', 'organizationId'],
      ]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `admin_onboarding requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  subsidiary_creation: {
    actionType: 'subsidiary_creation',
    commandVersion: 2,
    title: 'Subsidiary Entity Creation',
    aiScope: 'subsidiary_create',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['legalName', 'code'],
    targetEntityType: 'ORGANIZATION',
    dashboardRoutes: ['/api/organizations'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [['legalName', 'name'], 'code']);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `subsidiary_creation requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  subsidiary_update: {
    actionType: 'subsidiary_update',
    commandVersion: 2,
    title: 'Subsidiary Profile & Configuration Update',
    aiScope: 'subsidiary_edit',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['organizationId'],
    targetEntityType: 'ORGANIZATION',
    dashboardRoutes: ['/api/organizations/[organizationId]', '/api/businesses/[businessId]'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [['organizationId', 'subsidiaryId', 'id']]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? 'subsidiary_update requires organizationId.' : undefined,
      };
    },
  },
  bank_account_update: {
    actionType: 'bank_account_update',
    commandVersion: 2,
    title: 'Staff / Vendor / Subsidiary Bank Account Update',
    aiScope: 'bank_accounts',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['targetType', 'bankName', 'accountNumber'],
    targetEntityType: 'BANK_ACCOUNT',
    dashboardRoutes: ['/api/staff/[employeeId]/banking', '/api/treasury'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, ['targetType', 'bankName', 'accountNumber']);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? `bank_account_update requires: ${missing.join(', ')}` : undefined,
      };
    },
  },
  payroll_action: {
    actionType: 'payroll_action',
    commandVersion: 2,
    title: 'Payroll Batch Preparation, Approval & Disbursement',
    aiScope: 'payroll',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['sub_action'],
    targetEntityType: 'PAYROLL_BATCH',
    dashboardRoutes: [
      '/api/payroll/prepare',
      '/api/payroll/record',
      '/api/payroll/items/[itemId]',
      '/api/payroll/assignees',
    ],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, [['sub_action', 'action_type', 'action']]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? 'payroll_action requires sub_action.' : undefined,
      };
    },
  },
  staff_management: {
    actionType: 'staff_management',
    commandVersion: 2,
    title: 'Staff Dossier, Status & Exemption Management',
    aiScope: 'staff_profiles',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['sub_action'],
    targetEntityType: 'EMPLOYEE',
    dashboardRoutes: [
      '/api/hr/staff',
      '/api/staff/offline',
      '/api/admin/employees/[employeeId]',
      '/api/admin/employees/[employeeId]/status',
      '/api/admin/employees/[employeeId]/attendance-exemption',
      '/api/admin/employees/[employeeId]/request-update',
    ],
    validateInput: (payload) => {
      const sub = String(payload.sub_action || payload.action_type || 'EDIT_PROFILE').toUpperCase();
      if (sub === 'REGISTER_OFFLINE') {
        const missing = checkRequiredFields(payload, ['legalName']);
        return { valid: missing.length === 0, missingFields: missing };
      }
      const missing = checkRequiredFields(payload, [['employeeId', 'employee_id']]);
      return {
        valid: missing.length === 0,
        missingFields: missing,
        errorMessage: missing.length ? 'staff_management requires employeeId.' : undefined,
      };
    },
  },
  request_creation: {
    actionType: 'request_creation',
    commandVersion: 2,
    title: 'Expenditure Requisition Creation & Channel Messaging',
    aiScope: 'requests',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN', 'STAFF'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['sub_action'],
    targetEntityType: 'REQUEST',
    dashboardRoutes: ['/api/requests/create', '/api/requests/[requestNumber]/action'],
    validateInput: (payload) => {
      const sub = String(payload.sub_action || 'CREATE').toUpperCase();
      if (sub === 'SEND_MESSAGE' || sub === 'REQUEST_CLARIFICATION') {
        const missing = checkRequiredFields(payload, ['requestId', 'body']);
        return { valid: missing.length === 0, missingFields: missing };
      }
      const missing = checkRequiredFields(payload, ['title', 'amount']);
      return { valid: missing.length === 0, missingFields: missing };
    },
  },
  grn_creation: {
    actionType: 'grn_creation',
    commandVersion: 2,
    title: 'Goods Receipt Note (GRN) Recording',
    aiScope: 'three_way_match',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['requestId'],
    targetEntityType: 'GOODS_RECEIPT_NOTE',
    dashboardRoutes: ['/api/vendors/grn'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, ['requestId']);
      return { valid: missing.length === 0, missingFields: missing };
    },
  },
  vendor_invoice_creation: {
    actionType: 'vendor_invoice_creation',
    commandVersion: 2,
    title: 'Vendor Invoice Recording & 3-Way Match',
    aiScope: 'three_way_match',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['vendorId', 'invoiceNumber', 'amount'],
    targetEntityType: 'VENDOR_INVOICE',
    dashboardRoutes: ['/api/vendors/invoices', '/api/matching/verify'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, ['vendorId', 'invoiceNumber', 'amount']);
      return { valid: missing.length === 0, missingFields: missing };
    },
  },
  leave_action: {
    actionType: 'leave_action',
    commandVersion: 2,
    title: 'Staff Leave Request & Approval Decision',
    aiScope: 'hr_leave',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['sub_action'],
    targetEntityType: 'LEAVE_REQUEST',
    dashboardRoutes: ['/api/hr/leave'],
    validateInput: (payload) => {
      const sub = String(payload.sub_action || 'CREATE').toUpperCase();
      if (['DECIDE', 'APPROVE_LEAVE', 'REJECT_LEAVE'].includes(sub)) {
        const missing = checkRequiredFields(payload, ['leaveId']);
        return { valid: missing.length === 0, missingFields: missing };
      }
      const missing = checkRequiredFields(payload, ['employeeId', 'startDate', 'endDate']);
      return { valid: missing.length === 0, missingFields: missing };
    },
  },
  task_action: {
    actionType: 'task_action',
    commandVersion: 2,
    title: 'Follow-up Task Assignment & Completion',
    aiScope: 'tasks',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['sub_action'],
    targetEntityType: 'FOLLOWUP_TASK',
    dashboardRoutes: ['/api/tasks', '/api/tasks/[taskId]'],
    validateInput: (payload) => {
      const sub = String(payload.sub_action || 'CREATE').toUpperCase();
      if (['COMPLETE', 'UPDATE', 'COMPLETE_TASK', 'REOPEN_TASK'].includes(sub)) {
        const missing = checkRequiredFields(payload, ['taskId']);
        return { valid: missing.length === 0, missingFields: missing };
      }
      const missing = checkRequiredFields(payload, ['assigneeId', 'description']);
      return { valid: missing.length === 0, missingFields: missing };
    },
  },
  staff_message: {
    actionType: 'staff_message',
    commandVersion: 2,
    title: 'Direct Executive / HR Staff Communication',
    aiScope: 'messages',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['employeeId', 'message'],
    targetEntityType: 'STAFF_ADMIN_MESSAGE',
    dashboardRoutes: ['/api/staff/chat/admin'],
    validateInput: (payload) => {
      const missing = checkRequiredFields(payload, ['employeeId', 'message']);
      return { valid: missing.length === 0, missingFields: missing };
    },
  },
  policy_update: {
    actionType: 'policy_update',
    commandVersion: 2,
    title: 'Approval Matrix & Workspace Setting Configuration',
    aiScope: 'policies',
    allowedCallerRoles: ['GMD', 'SUPER_ADMIN'],
    allowedApproverRoles: ['GMD', 'SUPER_ADMIN'],
    requiredFields: ['sub_action'],
    targetEntityType: 'POLICY',
    dashboardRoutes: ['/api/policies', '/api/settings', '/api/recurring'],
    validateInput: (payload) => {
      const sub = String(payload.sub_action || 'UPSERT_POLICY').toUpperCase();
      if (sub === 'DELETE_POLICY') {
        const missing = checkRequiredFields(payload, ['id']);
        return { valid: missing.length === 0, missingFields: missing };
      }
      if (sub === 'UPDATE_SETTING') {
        const missing = checkRequiredFields(payload, ['key']);
        return { valid: missing.length === 0, missingFields: missing };
      }
      return { valid: true, missingFields: [] };
    },
  },
};

export function getCommandDescriptor(actionType: string): CommandDescriptor | null {
  return COMMAND_CATALOG[actionType as StagedActionType] || null;
}

