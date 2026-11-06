import { prisma } from '@/lib/prisma';
import { sendGmdAttendanceAlert, getExecutiveRecipients } from '@/lib/email';

export interface NotifyGmdClockInParams {
  employee: {
    id: string;
    legalName: string;
    employeeNumber: string;
    workEmail?: string | null;
  };
  subsidiaryName: string;
  departmentName?: string;
  stationName: string;
  workDate: string;
  timeStr: string;
  status: 'PRESENT' | 'LATE' | string;
  deductionPercent?: number;
  method: 'KIOSK_PIN' | 'MOBILE_QR' | string;
}

/**
 * Dispatches both in-app SystemNotification records and Executive Email Alerts
 * to all active GMD and Super Admin users when a staff member clocks in.
 */
export async function notifyGmdStaffClockIn(params: NotifyGmdClockInParams) {
  try {
    const isLate = params.status === 'LATE';
    const statusLabel = isLate
      ? `LATE (${params.deductionPercent || 0}% deduction)`
      : 'ON TIME';

    const notifTitle = isLate
      ? `⚠️ Late Clock-In: ${params.employee.legalName}`
      : `🕒 Staff Clock-In: ${params.employee.legalName}`;

    const notifBody = `${params.employee.legalName} (${params.employee.employeeNumber}) clocked in at ${params.timeStr} at ${params.stationName} (${params.subsidiaryName}). Status: ${statusLabel}.`;

    // 1. Fetch active GMD and Super Admin accounts
    const executives = await prisma.employee.findMany({
      where: {
        role: { in: ['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true, legalName: true, workEmail: true },
    });

    // 2. Insert in-app SystemNotification for each executive
    if (executives.length > 0) {
      await prisma.systemNotification.createMany({
        data: executives.map((exec) => ({
          employeeId: exec.id,
          kind: 'ATTENDANCE_CLOCK_IN',
          title: notifTitle,
          body: notifBody,
          linkUrl: '/attendance',
        })),
      });
    }

    // 3. Dispatch Executive Email to each executive recipient
    const emailRecipients = await getExecutiveRecipients();
    for (const recipient of emailRecipients) {
      if (!recipient.email) continue;
      sendGmdAttendanceAlert({
        to: recipient.email,
        gmdName: recipient.name || 'Group Managing Director',
        staffName: params.employee.legalName,
        employeeNumber: params.employee.employeeNumber,
        subsidiaryName: params.subsidiaryName,
        departmentName: params.departmentName,
        stationName: params.stationName,
        workDate: params.workDate,
        timeStr: params.timeStr,
        status: params.status,
        deductionPercent: params.deductionPercent,
        method: params.method,
      }).catch((err) => {
        console.warn(`[Attendance Notify] Could not send email to ${recipient.email}:`, err);
      });
    }
  } catch (error) {
    console.error('[Attendance Notify] Error notifying GMD of clock-in:', error);
  }
}

