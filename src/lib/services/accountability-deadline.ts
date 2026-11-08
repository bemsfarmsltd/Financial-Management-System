import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
export async function accountabilityDeadline(organizationId: string, emergency: boolean, paidAt: Date, client: Prisma.TransactionClient = prisma) {
  const policy = await client.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId, key: 'accountability.controls' } } });
  const controls = policy ? JSON.parse(policy.value) : {};
  const hours = Number(emergency ? controls.emergencyHours ?? 24 : controls.standardHours ?? 336);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 8760) throw new Error('Accountability deadline policy is invalid.');
  return new Date(paidAt.getTime() + hours * 3600000);
}
