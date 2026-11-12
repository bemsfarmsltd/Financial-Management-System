import { prisma } from '@/lib/prisma';

export type NotificationCategory =
  | 'ATTENDANCE'
  | 'PAYROLL_DEDUCTIONS'
  | 'REQUESTS_APPROVALS'
  | 'LEAVE'
  | 'MESSAGES'
  | 'TASKS'
  | 'ANNOUNCEMENTS'
  | 'SECURITY';

export type NotificationPriority = 'CRITICAL' | 'IMPORTANT' | 'INFORMATIONAL';

export interface DispatchNotificationInput {
  employeeId: string;
  subsidiaryId?: string | null;
  category: NotificationCategory;
  priority?: NotificationPriority;
  kind: string;
  title: string;
  body: string;
  metadata?: Record<string, any> | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  linkUrl?: string | null;
  cooldownMinutes?: number;
}

const MANDATORY_CATEGORIES = new Set<NotificationCategory>([
  'SECURITY',
  'PAYROLL_DEDUCTIONS',
  'REQUESTS_APPROVALS',
]);

/**
 * Dispatches an event-driven notification to a single staff member or executive.
 * Fail-safe: Wraps in try/catch to ensure underlying core transactions are never aborted.
 */
export async function dispatchNotification(input: DispatchNotificationInput) {
  try {
    const priority = input.priority || (
      input.category === 'SECURITY' ? 'CRITICAL' :
      input.category === 'PAYROLL_DEDUCTIONS' ? 'IMPORTANT' :
      'INFORMATIONAL'
    );

    // 1. Resolve subsidiaryId if missing
    let resolvedSubsidiaryId = input.subsidiaryId || null;
    if (!resolvedSubsidiaryId) {
      const assignment = await (prisma as any).employeeAssignment?.findFirst?.({
        where: { employeeId: input.employeeId, status: 'ACTIVE' },
        select: { subsidiaryId: true },
        orderBy: { isPrimary: 'desc' },
      });
      resolvedSubsidiaryId = assignment?.subsidiaryId || null;
    }

    // 2. Check User Notification Preferences (for non-mandatory categories)
    if (!MANDATORY_CATEGORIES.has(input.category) && priority !== 'CRITICAL') {
      const prefs = await (prisma as any).notificationPreference?.findUnique?.({
        where: { employeeId: input.employeeId },
      });

      if (prefs) {
        if (input.category === 'ATTENDANCE' && !prefs.attendanceAlerts && priority === 'INFORMATIONAL') {
          return null;
        }
        if (input.category === 'TASKS' && !prefs.taskAlerts) {
          return null;
        }
        if (input.category === 'MESSAGES' && !prefs.messageAlerts) {
          return null;
        }
        if (input.category === 'ANNOUNCEMENTS' && !prefs.announcementAlerts) {
          return null;
        }
        if (input.category === 'LEAVE' && !prefs.leaveAlerts) {
          return null;
        }
      }
    }

    // 3. Deduplication filter (cooldown window)
    const cooldown = input.cooldownMinutes ?? 2;
    if (cooldown > 0) {
      const recentThreshold = new Date(Date.now() - cooldown * 60 * 1000);
      const duplicate = await (prisma as any).systemNotification?.findFirst?.({
        where: {
          employeeId: input.employeeId,
          kind: input.kind,
          title: input.title,
          createdAt: { gte: recentThreshold },
        },
        select: { id: true },
      });

      if (duplicate) {
        return null; // Suppress duplicate notification
      }
    }

    // 4. Persist Notification in Database
    const notification = await (prisma as any).systemNotification?.create?.({
      data: {
        employeeId: input.employeeId,
        subsidiaryId: resolvedSubsidiaryId,
        category: input.category,
        priority,
        kind: input.kind,
        title: input.title,
        body: input.body,
        metadata: input.metadata ? (input.metadata as any) : undefined,
        actionLabel: input.actionLabel || null,
        actionUrl: input.actionUrl || input.linkUrl || null,
        linkUrl: input.linkUrl || input.actionUrl || null,
      },
    });

    return notification;
  } catch (error) {
    // Non-blocking log: core transactions never fail due to notification dispatch
    console.error(`[Notification Dispatch Error] Target Employee ${input.employeeId}:`, error);
    return null;
  }
}

/**
 * Dispatches the same notification to multiple employees in bulk.
 */
export async function dispatchNotificationToMany(
  employeeIds: string[],
  template: Omit<DispatchNotificationInput, 'employeeId'>
): Promise<number> {
  let count = 0;
  for (const empId of employeeIds) {
    const res = await dispatchNotification({ ...template, employeeId: empId });
    if (res) count++;
  }
  return count;
}

/**
 * Fetches staff notification preferences (or defaults if not yet customized)
 */
export async function getStaffNotificationPreferences(employeeId: string) {
  const existing = await prisma.notificationPreference.findUnique({
    where: { employeeId },
  });

  if (existing) return existing;

  // Create default preferences
  return prisma.notificationPreference.create({
    data: {
      employeeId,
      attendanceAlerts: true,
      taskAlerts: true,
      messageAlerts: true,
      announcementAlerts: true,
      leaveAlerts: true,
    },
  });
}

/**
 * Updates staff notification preferences
 */
export async function updateStaffNotificationPreferences(
  employeeId: string,
  updates: {
    attendanceAlerts?: boolean;
    taskAlerts?: boolean;
    messageAlerts?: boolean;
    announcementAlerts?: boolean;
    leaveAlerts?: boolean;
  }
) {
  return prisma.notificationPreference.upsert({
    where: { employeeId },
    update: updates,
    create: {
      employeeId,
      attendanceAlerts: updates.attendanceAlerts ?? true,
      taskAlerts: updates.taskAlerts ?? true,
      messageAlerts: updates.messageAlerts ?? true,
      announcementAlerts: updates.announcementAlerts ?? true,
      leaveAlerts: updates.leaveAlerts ?? true,
    },
  });
}
