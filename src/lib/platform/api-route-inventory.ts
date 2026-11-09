/**
 * Part III · Complete API Route Inventory Registry
 *
 * Canonical source-of-truth inventory for all registered BEMS ERP API routes across:
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
 * - budgets
 * - businesses
 * - departments
 * - disbursements
 * - download
 * - emergency
 * - hr
 * - intercompany
 * - matching
 * - meta
 * - mobile
 * - notifications
 * - organizations
 * - payroll
 * - policies
 * - portfolio
 * - receipts
 * - recurring
 * - reports
 * - requests
 * - settings
 * - staff
 * - tasks
 * - treasury
 * - upload
 * - vendors
 * - webhooks
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

export type ApiRouteGroup =
  | 'accountability'
  | 'admin'
  | 'ai'
  | 'analytics'
  | 'approvals'
  | 'attendance'
  | 'audit'
  | 'auth'
  | 'banking'
  | 'briefing'
  | 'budgets'
  | 'businesses'
  | 'departments'
  | 'disbursements'
  | 'download'
  | 'emergency'
  | 'hr'
  | 'intercompany'
  | 'matching'
  | 'meta'
  | 'mobile'
  | 'notifications'
  | 'organizations'
  | 'payroll'
  | 'policies'
  | 'portfolio'
  | 'receipts'
  | 'recurring'
  | 'reports'
  | 'requests'
  | 'settings'
  | 'staff'
  | 'tasks'
  | 'treasury'
  | 'upload'
  | 'vendors'
  | 'webhooks'
  | 'wallet';

export interface ApiRouteInventoryEntry {
  group: ApiRouteGroup;
  apiPath: string;
  relativeFilePath: string;
  declaredMethods: HttpMethod[];
  classification: RouteSurfaceClassification;
}

export const PART_III_API_ROUTE_INVENTORY: ApiRouteInventoryEntry[] = [
  // accountability (4)
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

  // admin (7)
  {
    group: 'admin',
    apiPath: '/api/admin/employees/[employeeId]/attendance-exemption',
    relativeFilePath: 'src/app/api/admin/employees/[employeeId]/attendance-exemption/route.ts',
    declaredMethods: ['PATCH'],
    classification: 'MUTATION',
  },
  {
    group: 'admin',
    apiPath: '/api/admin/employees/[employeeId]/corporate',
    relativeFilePath: 'src/app/api/admin/employees/[employeeId]/corporate/route.ts',
    declaredMethods: ['PATCH'],
    classification: 'MUTATION',
  },
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

  // ai (37)
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
    apiPath: '/api/ai/staged-actions/[id]/retry-effects',
    relativeFilePath: 'src/app/api/ai/staged-actions/[id]/retry-effects/route.ts',
    declaredMethods: ['POST'],
    classification: 'AI_STAGED_ACTION',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/staged-actions/[id]',
    relativeFilePath: 'src/app/api/ai/staged-actions/[id]/route.ts',
    declaredMethods: ['GET'],
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
    apiPath: '/api/ai/staged-actions/deadline-extension',
    relativeFilePath: 'src/app/api/ai/staged-actions/deadline-extension/route.ts',
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
    apiPath: '/api/ai/staged-actions/status',
    relativeFilePath: 'src/app/api/ai/staged-actions/status/route.ts',
    declaredMethods: ['GET'],
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
    apiPath: '/api/ai/tools/accountability',
    relativeFilePath: 'src/app/api/ai/tools/accountability/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/admin-onboarding',
    relativeFilePath: 'src/app/api/ai/tools/admin-onboarding/route.ts',
    declaredMethods: ['GET', 'POST'],
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
    declaredMethods: ['GET', 'POST'],
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
    apiPath: '/api/ai/tools/hr-leave',
    relativeFilePath: 'src/app/api/ai/tools/hr-leave/route.ts',
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
    apiPath: '/api/ai/tools/messages',
    relativeFilePath: 'src/app/api/ai/tools/messages/route.ts',
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
    apiPath: '/api/ai/tools/policies',
    relativeFilePath: 'src/app/api/ai/tools/policies/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'AI_TOOL',
  },
  {
    group: 'ai',
    apiPath: '/api/ai/tools/requests',
    relativeFilePath: 'src/app/api/ai/tools/requests/route.ts',
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
    apiPath: '/api/ai/tools/staff',
    relativeFilePath: 'src/app/api/ai/tools/staff/route.ts',
    declaredMethods: ['GET', 'POST'],
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
    apiPath: '/api/ai/tools/tasks',
    relativeFilePath: 'src/app/api/ai/tools/tasks/route.ts',
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

  // analytics (3)
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

  // approvals (2)
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

  // attendance (10)
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
    apiPath: '/api/attendance/station/activate',
    relativeFilePath: 'src/app/api/attendance/station/activate/route.ts',
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

  // audit (1)
  {
    group: 'audit',
    apiPath: '/api/audit',
    relativeFilePath: 'src/app/api/audit/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // auth (10)
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

  // banking (2)
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

  // briefing (1)
  {
    group: 'briefing',
    apiPath: '/api/briefing',
    relativeFilePath: 'src/app/api/briefing/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // budgets (2)
  {
    group: 'budgets',
    apiPath: '/api/budgets/[id]',
    relativeFilePath: 'src/app/api/budgets/[id]/route.ts',
    declaredMethods: ['GET', 'PATCH', 'DELETE'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'budgets',
    apiPath: '/api/budgets',
    relativeFilePath: 'src/app/api/budgets/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // businesses (7)
  {
    group: 'businesses',
    apiPath: '/api/businesses/[businessId]/audit-logs',
    relativeFilePath: 'src/app/api/businesses/[businessId]/audit-logs/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'businesses',
    apiPath: '/api/businesses/[businessId]/channels',
    relativeFilePath: 'src/app/api/businesses/[businessId]/channels/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'businesses',
    apiPath: '/api/businesses/[businessId]/members',
    relativeFilePath: 'src/app/api/businesses/[businessId]/members/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'businesses',
    apiPath: '/api/businesses/[businessId]',
    relativeFilePath: 'src/app/api/businesses/[businessId]/route.ts',
    declaredMethods: ['PATCH'],
    classification: 'MUTATION',
  },
  {
    group: 'businesses',
    apiPath: '/api/businesses/[businessId]/search',
    relativeFilePath: 'src/app/api/businesses/[businessId]/search/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'businesses',
    apiPath: '/api/businesses/[businessId]/templates/[templateId]/import',
    relativeFilePath: 'src/app/api/businesses/[businessId]/templates/[templateId]/import/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'businesses',
    apiPath: '/api/businesses/[businessId]/templates',
    relativeFilePath: 'src/app/api/businesses/[businessId]/templates/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // departments (1)
  {
    group: 'departments',
    apiPath: '/api/departments',
    relativeFilePath: 'src/app/api/departments/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // disbursements (5)
  {
    group: 'disbursements',
    apiPath: '/api/disbursements/assignees',
    relativeFilePath: 'src/app/api/disbursements/assignees/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'disbursements',
    apiPath: '/api/disbursements/confirm',
    relativeFilePath: 'src/app/api/disbursements/confirm/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'disbursements',
    apiPath: '/api/disbursements/record',
    relativeFilePath: 'src/app/api/disbursements/record/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'disbursements',
    apiPath: '/api/disbursements',
    relativeFilePath: 'src/app/api/disbursements/route.ts',
    declaredMethods: ['GET', 'POST', 'PATCH'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'disbursements',
    apiPath: '/api/disbursements/verify',
    relativeFilePath: 'src/app/api/disbursements/verify/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },

  // download (3)
  {
    group: 'download',
    apiPath: '/api/download/gmd-app',
    relativeFilePath: 'src/app/api/download/gmd-app/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'download',
    apiPath: '/api/download/kiosk-launcher',
    relativeFilePath: 'src/app/api/download/kiosk-launcher/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'download',
    apiPath: '/api/download/staff-app',
    relativeFilePath: 'src/app/api/download/staff-app/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // emergency (1)
  {
    group: 'emergency',
    apiPath: '/api/emergency',
    relativeFilePath: 'src/app/api/emergency/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // hr (4)
  {
    group: 'hr',
    apiPath: '/api/hr/attendance',
    relativeFilePath: 'src/app/api/hr/attendance/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'hr',
    apiPath: '/api/hr/leave',
    relativeFilePath: 'src/app/api/hr/leave/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'hr',
    apiPath: '/api/hr/overview',
    relativeFilePath: 'src/app/api/hr/overview/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'hr',
    apiPath: '/api/hr/staff',
    relativeFilePath: 'src/app/api/hr/staff/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // intercompany (5)
  {
    group: 'intercompany',
    apiPath: '/api/intercompany/[noteId]',
    relativeFilePath: 'src/app/api/intercompany/[noteId]/route.ts',
    declaredMethods: ['PATCH'],
    classification: 'MUTATION',
  },
  {
    group: 'intercompany',
    apiPath: '/api/intercompany/matrix',
    relativeFilePath: 'src/app/api/intercompany/matrix/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'intercompany',
    apiPath: '/api/intercompany/reconciliation',
    relativeFilePath: 'src/app/api/intercompany/reconciliation/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'intercompany',
    apiPath: '/api/intercompany',
    relativeFilePath: 'src/app/api/intercompany/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'intercompany',
    apiPath: '/api/intercompany/settle',
    relativeFilePath: 'src/app/api/intercompany/settle/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },

  // matching (1)
  {
    group: 'matching',
    apiPath: '/api/matching/verify',
    relativeFilePath: 'src/app/api/matching/verify/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // meta (1)
  {
    group: 'meta',
    apiPath: '/api/meta/structure',
    relativeFilePath: 'src/app/api/meta/structure/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // mobile (1)
  {
    group: 'mobile',
    apiPath: '/api/mobile/version-check',
    relativeFilePath: 'src/app/api/mobile/version-check/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // notifications (2)
  {
    group: 'notifications',
    apiPath: '/api/notifications',
    relativeFilePath: 'src/app/api/notifications/route.ts',
    declaredMethods: ['GET', 'PATCH'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'notifications',
    apiPath: '/api/notifications/push-token',
    relativeFilePath: 'src/app/api/notifications/push-token/route.ts',
    declaredMethods: ['POST', 'DELETE'],
    classification: 'MUTATION',
  },

  // organizations (2)
  {
    group: 'organizations',
    apiPath: '/api/organizations/[organizationId]',
    relativeFilePath: 'src/app/api/organizations/[organizationId]/route.ts',
    declaredMethods: ['PATCH'],
    classification: 'MUTATION',
  },
  {
    group: 'organizations',
    apiPath: '/api/organizations',
    relativeFilePath: 'src/app/api/organizations/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // payroll (8)
  {
    group: 'payroll',
    apiPath: '/api/payroll/assignees',
    relativeFilePath: 'src/app/api/payroll/assignees/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'payroll',
    apiPath: '/api/payroll/items/[itemId]',
    relativeFilePath: 'src/app/api/payroll/items/[itemId]/route.ts',
    declaredMethods: ['DELETE'],
    classification: 'MUTATION',
  },
  {
    group: 'payroll',
    apiPath: '/api/payroll/my-payments',
    relativeFilePath: 'src/app/api/payroll/my-payments/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'payroll',
    apiPath: '/api/payroll/prepare',
    relativeFilePath: 'src/app/api/payroll/prepare/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'payroll',
    apiPath: '/api/payroll/record',
    relativeFilePath: 'src/app/api/payroll/record/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'payroll',
    apiPath: '/api/payroll',
    relativeFilePath: 'src/app/api/payroll/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'payroll',
    apiPath: '/api/payroll/staff/[employeeId]',
    relativeFilePath: 'src/app/api/payroll/staff/[employeeId]/route.ts',
    declaredMethods: ['GET', 'PATCH'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'payroll',
    apiPath: '/api/payroll/summary',
    relativeFilePath: 'src/app/api/payroll/summary/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // policies (1)
  {
    group: 'policies',
    apiPath: '/api/policies',
    relativeFilePath: 'src/app/api/policies/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // portfolio (1)
  {
    group: 'portfolio',
    apiPath: '/api/portfolio',
    relativeFilePath: 'src/app/api/portfolio/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // receipts (2)
  {
    group: 'receipts',
    apiPath: '/api/receipts/[receiptId]',
    relativeFilePath: 'src/app/api/receipts/[receiptId]/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'receipts',
    apiPath: '/api/receipts',
    relativeFilePath: 'src/app/api/receipts/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // recurring (1)
  {
    group: 'recurring',
    apiPath: '/api/recurring',
    relativeFilePath: 'src/app/api/recurring/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // reports (1)
  {
    group: 'reports',
    apiPath: '/api/reports/export',
    relativeFilePath: 'src/app/api/reports/export/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ',
  },

  // requests (4)
  {
    group: 'requests',
    apiPath: '/api/requests/[requestNumber]/action',
    relativeFilePath: 'src/app/api/requests/[requestNumber]/action/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'requests',
    apiPath: '/api/requests/[requestNumber]',
    relativeFilePath: 'src/app/api/requests/[requestNumber]/route.ts',
    declaredMethods: ['GET', 'DELETE'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'requests',
    apiPath: '/api/requests/create',
    relativeFilePath: 'src/app/api/requests/create/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'requests',
    apiPath: '/api/requests',
    relativeFilePath: 'src/app/api/requests/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // settings (1)
  {
    group: 'settings',
    apiPath: '/api/settings',
    relativeFilePath: 'src/app/api/settings/route.ts',
    declaredMethods: ['GET', 'PUT'],
    classification: 'READ_AND_MUTATION',
  },

  // staff (16)
  {
    group: 'staff',
    apiPath: '/api/staff/[employeeId]/banking',
    relativeFilePath: 'src/app/api/staff/[employeeId]/banking/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/[employeeId]/compensation',
    relativeFilePath: 'src/app/api/staff/[employeeId]/compensation/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/[employeeId]/contact',
    relativeFilePath: 'src/app/api/staff/[employeeId]/contact/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/[employeeId]/password',
    relativeFilePath: 'src/app/api/staff/[employeeId]/password/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/[employeeId]/salary',
    relativeFilePath: 'src/app/api/staff/[employeeId]/salary/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/chat/admin',
    relativeFilePath: 'src/app/api/staff/chat/admin/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/chat/unread',
    relativeFilePath: 'src/app/api/staff/chat/unread/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/disbursements',
    relativeFilePath: 'src/app/api/staff/disbursements/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/invite/resend',
    relativeFilePath: 'src/app/api/staff/invite/resend/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/invite',
    relativeFilePath: 'src/app/api/staff/invite/route.ts',
    declaredMethods: ['GET', 'POST', 'DELETE'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/offline',
    relativeFilePath: 'src/app/api/staff/offline/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/onboard/complete',
    relativeFilePath: 'src/app/api/staff/onboard/complete/route.ts',
    declaredMethods: ['POST'],
    classification: 'AUTH',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/onboard',
    relativeFilePath: 'src/app/api/staff/onboard/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/profile/pending-update',
    relativeFilePath: 'src/app/api/staff/profile/pending-update/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/profile/submit-update',
    relativeFilePath: 'src/app/api/staff/profile/submit-update/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },
  {
    group: 'staff',
    apiPath: '/api/staff/me',
    relativeFilePath: 'src/app/api/staff/me/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'staff',
    apiPath: '/api/staff',
    relativeFilePath: 'src/app/api/staff/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },

  // tasks (2)
  {
    group: 'tasks',
    apiPath: '/api/tasks/[taskId]',
    relativeFilePath: 'src/app/api/tasks/[taskId]/route.ts',
    declaredMethods: ['PATCH'],
    classification: 'MUTATION',
  },
  {
    group: 'tasks',
    apiPath: '/api/tasks',
    relativeFilePath: 'src/app/api/tasks/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // treasury (1)
  {
    group: 'treasury',
    apiPath: '/api/treasury',
    relativeFilePath: 'src/app/api/treasury/route.ts',
    declaredMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    classification: 'READ_AND_MUTATION',
  },

  // upload (1)
  {
    group: 'upload',
    apiPath: '/api/upload',
    relativeFilePath: 'src/app/api/upload/route.ts',
    declaredMethods: ['POST'],
    classification: 'MUTATION',
  },

  // vendors (4)
  {
    group: 'vendors',
    apiPath: '/api/vendors/grn',
    relativeFilePath: 'src/app/api/vendors/grn/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'vendors',
    apiPath: '/api/vendors/invoices',
    relativeFilePath: 'src/app/api/vendors/invoices/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },
  {
    group: 'vendors',
    apiPath: '/api/vendors/matching/[requestId]',
    relativeFilePath: 'src/app/api/vendors/matching/[requestId]/route.ts',
    declaredMethods: ['GET'],
    classification: 'READ',
  },
  {
    group: 'vendors',
    apiPath: '/api/vendors',
    relativeFilePath: 'src/app/api/vendors/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'READ_AND_MUTATION',
  },

  // webhooks (2)
  {
    group: 'webhooks',
    apiPath: '/api/webhooks/slack',
    relativeFilePath: 'src/app/api/webhooks/slack/route.ts',
    declaredMethods: ['POST'],
    classification: 'WEBHOOK',
  },
  {
    group: 'webhooks',
    apiPath: '/api/webhooks/whatsapp',
    relativeFilePath: 'src/app/api/webhooks/whatsapp/route.ts',
    declaredMethods: ['GET', 'POST'],
    classification: 'WEBHOOK',
  },

  // Wallet execution: all monetary actions use the funded-release boundary.
  { group: 'wallet', apiPath: '/api/wallet/me', relativeFilePath: 'src/app/api/wallet/me/route.ts', declaredMethods: ['GET'], classification: 'READ' },
  { group: 'wallet', apiPath: '/api/wallet/funding', relativeFilePath: 'src/app/api/wallet/funding/route.ts', declaredMethods: ['GET'], classification: 'READ' },
  { group: 'wallet', apiPath: '/api/wallet/funding/refresh', relativeFilePath: 'src/app/api/wallet/funding/refresh/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/envelopes', relativeFilePath: 'src/app/api/wallet/envelopes/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/releases', relativeFilePath: 'src/app/api/wallet/releases/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/releases/approve-request', relativeFilePath: 'src/app/api/wallet/releases/approve-request/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/releases/[id]/approve', relativeFilePath: 'src/app/api/wallet/releases/[id]/approve/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/withdrawals', relativeFilePath: 'src/app/api/wallet/withdrawals/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },

  { group: 'meta', apiPath: '/api/meta/features', relativeFilePath: 'src/app/api/meta/features/route.ts', declaredMethods: ['GET'], classification: 'READ' },
  { group: 'ai', apiPath: '/api/ai/tools/wallet', relativeFilePath: 'src/app/api/ai/tools/wallet/route.ts', declaredMethods: ['GET', 'POST'], classification: 'AI_TOOL' },
  { group: 'wallet', apiPath: '/api/wallet/pool-control', relativeFilePath: 'src/app/api/wallet/pool-control/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/releases/[id]', relativeFilePath: 'src/app/api/wallet/releases/[id]/route.ts', declaredMethods: ['GET'], classification: 'READ' },
  { group: 'wallet', apiPath: '/api/wallet/bank', relativeFilePath: 'src/app/api/wallet/bank/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/challenges', relativeFilePath: 'src/app/api/wallet/challenges/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/withdrawals/[id]/cancel', relativeFilePath: 'src/app/api/wallet/withdrawals/[id]/cancel/route.ts', declaredMethods: ['POST'], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/banks', relativeFilePath: 'src/app/api/wallet/banks/route.ts', declaredMethods: ['GET'], classification: 'READ' },
  { group: 'wallet', apiPath: '/api/wallet/banks/resolve', relativeFilePath: 'src/app/api/wallet/banks/resolve/route.ts', declaredMethods: ['GET'], classification: 'READ' },
  { group: 'wallet', apiPath: '/api/wallet/envelopes/[id]', relativeFilePath: 'src/app/api/wallet/envelopes/[id]/route.ts', declaredMethods: ['PATCH'], classification: 'MUTATION' },
  { group: 'webhooks', apiPath: '/api/webhooks/monnify', relativeFilePath: 'src/app/api/webhooks/monnify/route.ts', declaredMethods: ['POST'], classification: 'WEBHOOK' },
  { group: 'webhooks', apiPath: '/api/webhooks/monnify/validate-transfer', relativeFilePath: 'src/app/api/webhooks/monnify/validate-transfer/route.ts', declaredMethods: ['POST'], classification: 'WEBHOOK' },

  { group: 'wallet', apiPath: '/api/wallet/issues/[id]/ack', relativeFilePath: 'src/app/api/wallet/issues/[id]/ack/route.ts', declaredMethods: ["POST"], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/project-returns', relativeFilePath: 'src/app/api/wallet/project-returns/route.ts', declaredMethods: ["POST"], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/reconcile', relativeFilePath: 'src/app/api/wallet/reconcile/route.ts', declaredMethods: ["POST"], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/vendors/[id]/verify-bank', relativeFilePath: 'src/app/api/wallet/vendors/[id]/verify-bank/route.ts', declaredMethods: ["POST"], classification: 'MUTATION' },
  { group: 'wallet', apiPath: '/api/wallet/withdrawal-plan', relativeFilePath: 'src/app/api/wallet/withdrawal-plan/route.ts', declaredMethods: ["POST"], classification: 'MUTATION' },
];
