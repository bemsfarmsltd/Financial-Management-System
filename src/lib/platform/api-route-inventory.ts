/**
 * Part III · Complete API Route Inventory Registry
 *
 * Canonical source-of-truth inventory for BEMS ERP API routes across:
 * - accountability
 * - admin
 * - ai (chat, memory, staged-actions, tools, verify)
 * - analytics
 * - approvals
 * - attendance
 * - audit
 * - auth
 * - banking
 * - briefing
 *
 * Verified automatically by scripts/verify-platform-architecture.ts against physical
 * route files and exported HTTP method handlers.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RouteSurfaceClassification =
  | 'READ'
  | 'MUTATION'
  | 'READ_AND_MUTATION'
  | 'AI_TOOL'
  | 'AI_STAGED_ACTION'
  | 'AUTH'
  | 'WEBHOOK';

export interface ApiRouteInventoryEntry {
  group:
    | 'accountability'
    | 'admin'
    | 'ai'
    | 'analytics'
    | 'approvals'
    | 'attendance'
    | 'audit'
    | 'auth'
    | 'banking'
    | 'briefing';
  apiPath: string;
  relativeFilePath: string;
  declaredMethods: HttpMethod[];
  classification: RouteSurfaceClassification;
}

export const PART_III_API_ROUTE_INVENTORY: ApiRouteInventoryEntry[] = [
  // accountability
  {
    group: 'accountability',
    apiPath: '/api/accountability/close',
    relativeFilePath: 'src/app/api/accountability/close/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'accountability',
    apiPath: '/api/accountability/evidence/[attachmentId]',
    relativeFilePath: 'src/app/api/accountability/evidence/[attachmentId]/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'accountability',
    apiPath: '/api/accountability/evidence',
    relativeFilePath: 'src/app/api/accountability/evidence/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'accountability',
    apiPath: '/api/accountability',
    relativeFilePath: 'src/app/api/accountability/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // admin
  {
    group: 'admin',
    apiPath: '/api/admin/employees/[employeeId]/request-update',
    relativeFilePath: 'src/app/api/admin/employees/[employeeId]/request-update/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'admin',
    apiPath: '/api/admin/employees/[employeeId]',
    relativeFilePath: 'src/app/api/admin/employees/[employeeId]/route.ts',
    declaredMethods: ['DELETE'],
    classification: 'MUTATION',
  },
  {
    group: 'admin',
    apiPath: '/api/admin/employees/[employeeId]/status',
    relativeFilePath: 'src/app/api/admin/employees/[employeeId]/status/route.ts',
    declaredMethods: ['PATCH'],
    classification: 'MUTATION',
  },
  {
    group: 'admin',
    apiPath: '/api/admin/leadership',
    relativeFilePath: 'src/app/api/admin/leadership/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'admin',
    apiPath: '/api/admin/mobile-apps',
    relativeFilePath: 'src/app/api/admin/mobile-apps/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'admin',
    apiPath: '/api/admin/mobile-apps/upload',
    relativeFilePath: 'src/app/api/admin/mobile-apps/upload/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },

  // ai
  {
    group: 'ai',
    apiPath: '/api/ai/chat',
    relativeFilePath: 'src/app/api/ai/chat/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/memory',
    relativeFilePath: 'src/app/api/ai/memory/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/[id]/cancel',
    relativeFilePath: 'src/app/api/ai/staged-actions/[id]/cancel/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/[id]/confirm',
    relativeFilePath: 'src/app/api/ai/staged-actions/[id]/confirm/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/accountability-clearance',
    relativeFilePath: 'src/app/api/ai/staged-actions/accountability-clearance/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/approval-decision',
    relativeFilePath: 'src/app/api/ai/staged-actions/approval-decision/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/budget',
    relativeFilePath: 'src/app/api/ai/staged-actions/budget/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/emergency-override',
    relativeFilePath: 'src/app/api/ai/staged-actions/emergency-override/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/intercompany-note',
    relativeFilePath: 'src/app/api/ai/staged-actions/intercompany-note/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/payment-record',
    relativeFilePath: 'src/app/api/ai/staged-actions/payment-record/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/payment-recorder',
    relativeFilePath: 'src/app/api/ai/staged-actions/payment-recorder/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/salary-change',
    relativeFilePath: 'src/app/api/ai/staged-actions/salary-change/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/staff-approval',
    relativeFilePath: 'src/app/api/ai/staged-actions/staff-approval/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/treasury-account',
    relativeFilePath: 'src/app/api/ai/staged-actions/treasury-account/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/vendor-approval',
    relativeFilePath: 'src/app/api/ai/staged-actions/vendor-approval/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/admin-onboarding',
    relativeFilePath: 'src/app/api/ai/tools/admin-onboarding/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/approvals',
    relativeFilePath: 'src/app/api/ai/tools/approvals/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/attendance',
    relativeFilePath: 'src/app/api/ai/tools/attendance/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/bank-accounts',
    relativeFilePath: 'src/app/api/ai/tools/bank-accounts/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/budgets',
    relativeFilePath: 'src/app/api/ai/tools/budgets/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/intercompany',
    relativeFilePath: 'src/app/api/ai/tools/intercompany/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/payroll',
    relativeFilePath: 'src/app/api/ai/tools/payroll/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools',
    relativeFilePath: 'src/app/api/ai/tools/route.ts',
    declaredMethods: ['GET'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/subsidiary',
    relativeFilePath: 'src/app/api/ai/tools/subsidiary/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/vendors',
    relativeFilePath: 'src/app/api/ai/tools/vendors/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/verify',
    relativeFilePath: 'src/app/api/ai/verify/route.ts',
    declaredMethods: ['GET'],
    classification: 'AI_TOOL',
  },

  // analytics
  {
    group: 'analytics',
    apiPath: '/api/analytics/cash-forecast',
    relativeFilePath: 'src/app/api/analytics/cash-forecast/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'analytics',
    apiPath: '/api/analytics/financial',
    relativeFilePath: 'src/app/api/analytics/financial/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'analytics',
    apiPath: '/api/analytics',
    relativeFilePath: 'src/app/api/analytics/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // approvals
  {
    group: 'approvals',
    apiPath: '/api/approvals/decide',
    relativeFilePath: 'src/app/api/approvals/decide/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'approvals',
    apiPath: '/api/approvals',
    relativeFilePath: 'src/app/api/approvals/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // attendance
  {
    group: 'attendance',
    apiPath: '/api/attendance/admin/daily-roster',
    relativeFilePath: 'src/app/api/attendance/admin/daily-roster/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/admin/override',
    relativeFilePath: 'src/app/api/attendance/admin/override/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/admin/policy',
    relativeFilePath: 'src/app/api/attendance/admin/policy/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/admin/roster',
    relativeFilePath: 'src/app/api/attendance/admin/roster/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/admin/station',
    relativeFilePath: 'src/app/api/attendance/admin/station/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/kiosk-punch',
    relativeFilePath: 'src/app/api/attendance/kiosk-punch/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/punch',
    relativeFilePath: 'src/app/api/attendance/punch/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/station/qr',
    relativeFilePath: 'src/app/api/attendance/station/qr/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/timesheet',
    relativeFilePath: 'src/app/api/attendance/timesheet/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'attendance',
    apiPath: '/api/attendance/verify-geofence',
    relativeFilePath: 'src/app/api/attendance/verify-geofence/route.ts',
    declaredMethods: ['POST'],
    classification: 'READ',
  },

  // audit
  {
    group: 'audit',
    apiPath: '/api/audit',
    relativeFilePath: 'src/app/api/audit/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // auth
  {
    group: 'auth',
    apiPath: '/api/auth/approvals',
    relativeFilePath: 'src/app/api/auth/approvals/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/bootstrap',
    relativeFilePath: 'src/app/api/auth/bootstrap/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AUTH',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/dev-role',
    relativeFilePath: 'src/app/api/auth/dev-role/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AUTH',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/login',
    relativeFilePath: 'src/app/api/auth/login/route.ts',
    declaredMethods: ['POST'],
    classification: 'AUTH',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/logout',
    relativeFilePath: 'src/app/api/auth/logout/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AUTH',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/magic-link',
    relativeFilePath: 'src/app/api/auth/magic-link/route.ts',
    declaredMethods: ['POST'],
    classification: 'AUTH',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/reset-password',
    relativeFilePath: 'src/app/api/auth/reset-password/route.ts',
    declaredMethods: ['POST'],
    classification: 'AUTH',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/session',
    relativeFilePath: 'src/app/api/auth/session/route.ts',
    declaredMethods: ['GET'],
    classification: 'AUTH',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/signup/options',
    relativeFilePath: 'src/app/api/auth/signup/options/route.ts',
    declaredMethods: ['GET'],
    classification: 'AUTH',
  },
  {
    group: 'auth',
    apiPath: '/api/auth/signup',
    relativeFilePath: 'src/app/api/auth/signup/route.ts',
    declaredMethods: ['POST'],
    classification: 'AUTH',
  },

  // banking
  {
    group: 'banking',
    apiPath: '/api/banking/banks',
    relativeFilePath: 'src/app/api/banking/banks/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'banking',
    apiPath: '/api/banking/verify-account',
    relativeFilePath: 'src/app/api/banking/verify-account/route.ts',
    declaredMethods: ['POST'],
    classification: 'READ',
  },

  // briefing
  {
    group: 'briefing',
    apiPath: '/api/briefing',
    relativeFilePath: 'src/app/api/briefing/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
];

