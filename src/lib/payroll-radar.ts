import { prisma } from './prisma';

/**
 * Payroll Payday Automation & 7-Day GMD Notification Radar
 * 
 * Rules:
 * 1. Company payday is the 3rd of each calendar month.
 * 2. 7 days before payday (running daily from the 26th/27th of preceding month through the 3rd),
 *    the system sends a daily high-priority notification to the GMD to review, sign off, and disburse.
 */

export interface PaydayRadarStatus {
  paydayDay: number;
  targetPayday: Date;
  daysRemaining: number;
  isRadarActive: boolean;
  targetYear: number;
  targetMonth: number;
  periodName: string;
  batchStatus: string | null;
  notifiedToday: boolean;
}

export async function evaluatePaydayRadar(): Promise<PaydayRadarStatus> {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 10 = Nov)
  const currentYear = now.getFullYear();

  // Payday is the 3rd of the month
  const PAYDAY_DAY = 3;
  let targetYear = currentYear;
  let targetMonth = currentMonth + 1; // 1-12

  // Determine target payday Date
  let targetPayday: Date;
  if (currentDay <= PAYDAY_DAY) {
    // Payday is this month on the 3rd
    targetPayday = new Date(currentYear, currentMonth, PAYDAY_DAY, 9, 0, 0);
  } else {
    // Payday is next month on the 3rd
    targetPayday = new Date(currentYear, currentMonth + 1, PAYDAY_DAY, 9, 0, 0);
    targetMonth = targetPayday.getMonth() + 1;
    targetYear = targetPayday.getFullYear();
  }

  const periodName = `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(targetYear, targetMonth - 1, 1))} ${targetYear}`;

  // Calculate days remaining (using start-of-day comparison)
  const startOfToday = new Date(currentYear, currentMonth, currentDay).getTime();
  const startOfPayday = new Date(targetPayday.getFullYear(), targetPayday.getMonth(), targetPayday.getDate()).getTime();
  const daysRemaining = Math.round((startOfPayday - startOfToday) / (1000 * 60 * 60 * 24));

  const isRadarActive = daysRemaining >= 0 && daysRemaining <= 7;

  // Check period and batch status in database
  const period = await prisma.payrollPeriod.findFirst({
    where: { year: targetYear, month: targetMonth },
    include: {
      batches: {
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
    },
  });

  const latestBatch = period?.batches[0] || null;
  const batchStatus = latestBatch?.status || null;

  let notifiedToday = false;

  // If radar is active and batch is not yet fully PAID, evaluate sending notification to GMD
  if (isRadarActive && batchStatus !== 'PAID') {
    // Check if notification was already sent to GMD today
    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const existingNotification = await prisma.systemNotification.findFirst({
      where: {
        kind: 'PAYROLL_UPCOMING_PAYDAY',
        createdAt: { gte: twentyHoursAgo },
      },
    });

    if (existingNotification) {
      notifiedToday = true;
    } else {
      // Find GMD accounts to notify
      const gmdUsers = await prisma.employee.findMany({
        where: {
          role: 'GMD',
          status: 'ACTIVE',
        },
        select: { id: true, legalName: true },
      });

      // Fallback: If no user with role 'GMD' is found, notify SUPER_ADMIN
      const recipients = gmdUsers.length > 0 ? gmdUsers : await prisma.employee.findMany({
        where: {
          role: { in: ['SUPER_ADMIN', 'SYSTEM_ADMIN'] },
          status: 'ACTIVE',
        },
        select: { id: true, legalName: true },
      });

      const title = daysRemaining === 0
        ? `🚨 Payroll Payday Today (3rd of the Month) ⚡`
        : `Upcoming Payroll Payday in ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'} (3rd of the Month) ⚡`;

      const statusDetail = !latestBatch
        ? 'No batch prepared yet. Prepare and sign off now.'
        : latestBatch.status === 'SUBMITTED'
        ? 'Batch is prepared and waiting for GMD sign-off.'
        : latestBatch.status === 'APPROVED'
        ? 'Batch is approved and pending bank disbursement execution.'
        : 'Please review register.';

      const body = `Monthly staff salary payment for ${periodName} is due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (Payday: the 3rd). ${statusDetail}`;

      for (const user of recipients) {
        await prisma.systemNotification.create({
          data: {
            employeeId: user.id,
            kind: 'PAYROLL_UPCOMING_PAYDAY',
            title,
            body,
            linkUrl: '/finance?tab=Hybrid+payroll',
          },
        });
      }
      notifiedToday = true;
    }
  }

  return {
    paydayDay: PAYDAY_DAY,
    targetPayday,
    daysRemaining,
    isRadarActive,
    targetYear,
    targetMonth,
    periodName,
    batchStatus,
    notifiedToday,
  };
}
