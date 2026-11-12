import { prisma } from '@/lib/prisma';
import { dispatchNotification, dispatchNotificationToMany, NotificationPriority } from './service';

function formatNaira(minor: bigint | number): string {
  const naira = Number(minor) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(naira);
}

// ---------------------------------------------------------------------------
// 1. ATTENDANCE NOTIFICATION EVENTS
// ---------------------------------------------------------------------------

export async function notifyAttendancePunch(params: {
  employeeId: string;
  subsidiaryId?: string | null;
  stationName: string;
  timeStr: string;
  isClockIn: boolean;
  status: 'PRESENT' | 'LATE' | 'EXCUSED' | string;
  minutesLate?: number;
  deductionPercent?: number;
  recordId?: string;
}) {
  const isLate = params.status === 'LATE' || (params.minutesLate && params.minutesLate > 0);

  if (params.isClockIn) {
    if (isLate) {
      const minText = params.minutesLate ? `${params.minutesLate} minutes late` : 'Late arrival';
      const penaltyText = params.deductionPercent ? ` (${params.deductionPercent}% salary penalty applies)` : '';

      return dispatchNotification({
        employeeId: params.employeeId,
        subsidiaryId: params.subsidiaryId,
        category: 'ATTENDANCE',
        priority: 'IMPORTANT',
        kind: 'ATTENDANCE_LATE_RECORDED',
        title: `⚠️ Lateness Recorded: ${minText}`,
        body: `You clocked in at ${params.timeStr} at ${params.stationName}. ${minText}${penaltyText}. If this was due to operational duties or an emergency, you can file an immediate explanation.`,
        metadata: {
          station: params.stationName,
          time: params.timeStr,
          minutesLate: params.minutesLate || 0,
          deductionPercent: params.deductionPercent || 0,
          recordId: params.recordId,
        },
        actionLabel: 'Dispute Lateness',
        actionUrl: `/disputes?action=new&category=LATENESS&recordId=${params.recordId || ''}`,
        linkUrl: '/attendance',
      });
    }

    return dispatchNotification({
      employeeId: params.employeeId,
      subsidiaryId: params.subsidiaryId,
      category: 'ATTENDANCE',
      priority: 'INFORMATIONAL',
      kind: 'ATTENDANCE_CHECK_IN',
      title: '✓ Check-In Confirmed',
      body: `You clocked in on-time at ${params.timeStr} at ${params.stationName}. Have a productive day!`,
      linkUrl: '/attendance',
    });
  }

  // Clock Out
  return dispatchNotification({
    employeeId: params.employeeId,
    subsidiaryId: params.subsidiaryId,
    category: 'ATTENDANCE',
    priority: 'INFORMATIONAL',
    kind: 'ATTENDANCE_CHECK_OUT',
    title: '✓ Check-Out Recorded',
    body: `You clocked out at ${params.timeStr} at ${params.stationName}. Rest well!`,
    linkUrl: '/attendance',
  });
}

export async function notifyAttendanceCorrection(params: {
  employeeId: string;
  subsidiaryId?: string | null;
  workDate: string;
  status: string;
  reason: string;
  approved: boolean;
  decidedBy: string;
}) {
  return dispatchNotification({
    employeeId: params.employeeId,
    subsidiaryId: params.subsidiaryId,
    category: 'ATTENDANCE',
    priority: 'IMPORTANT',
    kind: params.approved ? 'ATTENDANCE_CORRECTION_APPROVED' : 'ATTENDANCE_CORRECTION_REJECTED',
    title: params.approved ? '✓ Attendance Correction Approved' : '✕ Attendance Correction Rejected',
    body: params.approved
      ? `Your attendance for ${params.workDate} was corrected to ${params.status} by ${params.decidedBy}: "${params.reason}". Any lateness penalty has been waived.`
      : `Your lateness excuse for ${params.workDate} was declined by ${params.decidedBy}: "${params.reason}".`,
    linkUrl: '/attendance',
  });
}

// ---------------------------------------------------------------------------
// 2. SALARY, PAYROLL & DEDUCTION EVENTS
// ---------------------------------------------------------------------------

export async function notifyPayrollDeduction(params: {
  employeeId: string;
  subsidiaryId?: string | null;
  month: number;
  year: number;
  grossMinor: bigint | number;
  deductionMinor: bigint | number;
  netMinor: bigint | number;
  reason: string;
  payrollItemId?: string;
}) {
  const formattedGross = formatNaira(params.grossMinor);
  const formattedDeduction = formatNaira(params.deductionMinor);
  const formattedNet = formatNaira(params.netMinor);

  return dispatchNotification({
    employeeId: params.employeeId,
    subsidiaryId: params.subsidiaryId,
    category: 'PAYROLL_DEDUCTIONS',
    priority: 'IMPORTANT',
    kind: 'SALARY_DEDUCTION_RECORDED',
    title: `Salary Deduction Applied: -${formattedDeduction}`,
    body: `A deduction of ${formattedDeduction} was applied to your ${params.month}/${params.year} payroll for "${params.reason}". Gross: ${formattedGross} | Est. Net: ${formattedNet}.`,
    metadata: {
      month: params.month,
      year: params.year,
      grossMinor: params.grossMinor.toString(),
      deductionMinor: params.deductionMinor.toString(),
      netMinor: params.netMinor.toString(),
      reason: params.reason,
      payrollItemId: params.payrollItemId,
    },
    actionLabel: 'Dispute Deduction',
    actionUrl: `/disputes?action=new&category=DEDUCTION&recordId=${params.payrollItemId || ''}`,
    linkUrl: '/payroll',
  });
}

export async function notifyPayrollFinalized(params: {
  employeeId: string;
  subsidiaryId?: string | null;
  month: number;
  year: number;
  netMinor: bigint | number;
}) {
  const formattedNet = formatNaira(params.netMinor);
  return dispatchNotification({
    employeeId: params.employeeId,
    subsidiaryId: params.subsidiaryId,
    category: 'PAYROLL_DEDUCTIONS',
    priority: 'IMPORTANT',
    kind: 'PAYROLL_FINALIZED',
    title: `✓ Payroll Finalized: ${formattedNet}`,
    body: `The Group Managing Director signed off payroll for ${params.month}/${params.year}. Your confirmed net salary is ${formattedNet}. Your digital payslip is now available.`,
    actionLabel: 'View Payslip',
    actionUrl: '/payroll',
    linkUrl: '/payroll',
  });
}

export async function notifyPayrollDisbursed(params: {
  employeeId: string;
  subsidiaryId?: string | null;
  amountMinor: bigint | number;
  bankName: string;
  accountNumberMasked: string;
  reference: string;
}) {
  const formattedAmount = formatNaira(params.amountMinor);
  return dispatchNotification({
    employeeId: params.employeeId,
    subsidiaryId: params.subsidiaryId,
    category: 'PAYROLL_DEDUCTIONS',
    priority: 'CRITICAL',
    kind: 'PAYROLL_DISBURSED',
    title: `💸 Salary Payment Dispatched: ${formattedAmount}`,
    body: `Your salary of ${formattedAmount} has been sent to ${params.bankName} (${params.accountNumberMasked}). Reference: ${params.reference}. Please confirm once received.`,
    actionLabel: 'Confirm Receipt',
    actionUrl: '/payroll',
    linkUrl: '/payroll',
  });
}

// ---------------------------------------------------------------------------
// 3. REQUESTS & APPROVALS EVENTS
// ---------------------------------------------------------------------------

export async function notifyFundRequestDecision(params: {
  employeeId: string;
  subsidiaryId?: string | null;
  requestNumber: string;
  title: string;
  decision: 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUIRED';
  decidedBy: string;
  reason?: string;
  amountMinor?: bigint | number;
}) {
  const isApproved = params.decision === 'APPROVED';
  const isClarify = params.decision === 'CLARIFICATION_REQUIRED';

  const titleText = isApproved
    ? `✓ Fund Request Approved: ${params.requestNumber}`
    : isClarify
    ? `ℹ Clarification Needed: ${params.requestNumber}`
    : `✕ Fund Request Declined: ${params.requestNumber}`;

  const bodyText = isApproved
    ? `Your requisition "${params.title}" was approved by ${params.decidedBy}.`
    : isClarify
    ? `${params.decidedBy} requested clarification on "${params.title}": "${params.reason || 'Please provide additional details'}"`
    : `Your requisition "${params.title}" was declined by ${params.decidedBy}. Reason: "${params.reason || 'No reason specified'}"`;

  return dispatchNotification({
    employeeId: params.employeeId,
    subsidiaryId: params.subsidiaryId,
    category: 'REQUESTS_APPROVALS',
    priority: 'IMPORTANT',
    kind: `REQUEST_${params.decision}`,
    title: titleText,
    body: bodyText,
    actionLabel: isClarify ? 'Respond to Clarification' : 'View Request',
    actionUrl: `/requests/${params.requestNumber}`,
    linkUrl: `/requests/${params.requestNumber}`,
  });
}

// ---------------------------------------------------------------------------
// 4. LEAVE MANAGEMENT EVENTS
// ---------------------------------------------------------------------------

export async function notifyLeaveDecision(params: {
  employeeId: string;
  subsidiaryId?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  approved: boolean;
  decidedBy: string;
  reason?: string;
}) {
  return dispatchNotification({
    employeeId: params.employeeId,
    subsidiaryId: params.subsidiaryId,
    category: 'LEAVE',
    priority: 'IMPORTANT',
    kind: params.approved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    title: params.approved ? `✓ Leave Request Approved (${params.leaveType})` : `✕ Leave Request Declined (${params.leaveType})`,
    body: params.approved
      ? `Your ${params.leaveType} from ${params.startDate} to ${params.endDate} has been approved by ${params.decidedBy}.`
      : `Your ${params.leaveType} application was declined by ${params.decidedBy}. Reason: "${params.reason || 'None provided'}"`,
    linkUrl: '/hr',
  });
}

// ---------------------------------------------------------------------------
// 5. TASKS & RESPONSIBILITIES EVENTS
// ---------------------------------------------------------------------------

export async function notifyTaskAssigned(params: {
  employeeId: string;
  subsidiaryId?: string | null;
  taskTitle: string;
  assignedBy: string;
  dueDate?: string;
  taskId: string;
}) {
  const dueText = params.dueDate ? ` (Due: ${params.dueDate})` : '';
  return dispatchNotification({
    employeeId: params.employeeId,
    subsidiaryId: params.subsidiaryId,
    category: 'TASKS',
    priority: 'IMPORTANT',
    kind: 'TASK_ASSIGNED',
    title: `📋 New Task: ${params.taskTitle}`,
    body: `${params.assignedBy} assigned you a follow-up task: "${params.taskTitle}"${dueText}.`,
    actionLabel: 'View Task',
    actionUrl: `/tasks`,
    linkUrl: `/tasks`,
  });
}

// ---------------------------------------------------------------------------
// 6. COMPANY & HR ANNOUNCEMENTS EVENTS
// ---------------------------------------------------------------------------

export async function broadcastCompanyAnnouncement(params: {
  announcementId: string;
  title: string;
  content: string;
  category: string;
  priority: NotificationPriority;
  subsidiaryId?: string | null;
  authorName: string;
}) {
  // Find all active employees in this scope (or all active employees for group-wide)
  const where: any = { status: 'ACTIVE' };
  if (params.subsidiaryId) {
    where.assignments = {
      some: { subsidiaryId: params.subsidiaryId, status: 'ACTIVE' },
    };
  }

  const employees = await prisma.employee.findMany({
    where,
    select: { id: true },
  });

  const empIds = employees.map(e => e.id);
  if (empIds.length === 0) return 0;

  return dispatchNotificationToMany(empIds, {
    subsidiaryId: params.subsidiaryId,
    category: 'ANNOUNCEMENTS',
    priority: params.priority,
    kind: 'COMPANY_ANNOUNCEMENT',
    title: `📢 ${params.title}`,
    body: params.content.length > 250 ? `${params.content.slice(0, 247)}...` : params.content,
    actionLabel: 'Read Announcement',
    actionUrl: `/notifications?category=ANNOUNCEMENTS`,
    linkUrl: `/notifications?category=ANNOUNCEMENTS`,
  });
}

// ---------------------------------------------------------------------------
// 7. SECURITY EVENTS
// ---------------------------------------------------------------------------

export async function notifySecurityAlert(params: {
  employeeId: string;
  alertType: 'NEW_DEVICE_LOGIN' | 'PASSWORD_CHANGED' | 'SUSPICIOUS_LOGIN' | 'PERMISSION_CHANGED';
  details: string;
}) {
  const titles = {
    NEW_DEVICE_LOGIN: '🔒 New Device Login Detected',
    PASSWORD_CHANGED: '🔒 Your Password Was Changed',
    SUSPICIOUS_LOGIN: '🚨 Security Alert: Unusual Login Attempt',
    PERMISSION_CHANGED: '🛡 Account Role / Permission Updated',
  };

  return dispatchNotification({
    employeeId: params.employeeId,
    category: 'SECURITY',
    priority: 'CRITICAL',
    kind: params.alertType,
    title: titles[params.alertType] || 'Security Notification',
    body: `${params.details}. If you did not authorize this action, contact IT Support or Executive Admin immediately.`,
    linkUrl: '/profile',
  });
}
