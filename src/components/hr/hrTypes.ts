export type HrSectionId =
  | 'overview'
  | 'employees'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'performance'
  | 'recruitment'
  | 'relations'
  | 'requests'
  | 'documents'
  | 'reports'
  | 'configuration';

export interface HrMetrics {
  totalStaff: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  onLeaveToday: number;
  excusedToday: number;
  pendingOnboarding: number;
  pendingProfileUpdates: number;
  pendingLeaves: number;
  pendingExcuseRequests: number;
}

export interface AttendanceTrendDay {
  date: string;
  dayLabel: string;
  present: number;
  late: number;
  absent: number;
}

export interface HrSubsidiarySummary {
  id: string;
  name: string;
  code: string;
  type?: string | null;
  industry?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  staffCount: number;
}

export interface HrLatestPayroll {
  id: string;
  version: number;
  status: string;
  yearMonth: string;
  totalHeadcount: number;
  totalGrossMinor: string;
  totalNetMinor: string;
  createdAt: string;
}

export interface HrOverviewData {
  todayStr: string;
  actor?: {
    id: string;
    legalName: string;
    role: string;
  };
  metrics: HrMetrics;
  attendance7DayTrend: AttendanceTrendDay[];
  attendance14DayTrend?: AttendanceTrendDay[];
  employmentBreakdown?: Array<{ type: string; count: number }>;
  departmentBreakdown?: Array<{ department: string; count: number }>;
  leaveBreakdown?: Array<{ type: string; count: number }>;
  latestPayrollBatch: HrLatestPayroll | null;
  subsidiaries: HrSubsidiarySummary[];
}

export interface HrStaffMember {
  id: string;
  employeeNumber: string;
  legalName: string;
  workEmail: string;
  phone?: string | null;
  status: string;
  approvalStatus: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  resumptionDate?: string | null;
  workLocation?: string | null;
  staffGrade?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  residentialAddress?: string | null;
  cityState?: string | null;
  maritalStatus?: string | null;
  stateOfOrigin?: string | null;
  lga?: string | null;
  isOfflineStaff?: boolean;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  salaryBankName?: string | null;
  salaryAccountNumber?: string | null;
  salaryAccountName?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  nextOfKinRelationship?: string | null;
  nextOfKinAddress?: string | null;
  primaryAssignment?: {
    subsidiary?: { id: string; legalName: string; code: string; brandColor?: string | null } | null;
    department?: { id: string; name: string } | null;
  } | null;
  currentGrossMinor?: string;
  currency?: string;
  totalAttendancePunches?: number;
  totalLeaves?: number;
  createdAt?: string;
}

export interface HrAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  subsidiary?: { id: string; legalName: string; code: string; brandColor?: string | null } | null;
  department: string;
  workDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInDistanceM?: number | null;
  clientIp?: string | null;
  status: string;
  isManualOverride: boolean;
  overrideReason?: string | null;
  isDeductionApplied: boolean;
  deductionPercent?: number | null;
  deductionMinor?: string;
  excuseStatus?: string | null;
  excuseRequestNote?: string | null;
  excuseRequestedByName?: string | null;
  stationName: string;
}

export interface HrLeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  subsidiary: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  handoverNotes?: string | null;
  status: string;
  reviewedByName?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export function formatNairaMinor(minorStr?: string | number | null): string {
  const num = Number(minorStr || 0) / 100;
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

