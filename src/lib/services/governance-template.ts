import { GOVERNANCE_TEMPLATES } from '@/lib/governance-templates';
import type { Prisma } from '@prisma/client';
export async function applyGovernanceTemplate(tx: Prisma.TransactionClient, organizationId: string, templateId: string, actorId: string) {
  const id = templateId.trim().toLowerCase();
  const template = GOVERNANCE_TEMPLATES.find(template => template.id === id);
  if (!template) throw new Error('Unsupported governance template.');
  const values = template.settings;
  if (!await tx.organization.findUnique({ where: { id: organizationId } })) throw new Error('Organization not found.');
  for (const [key, patch] of Object.entries(values)) {
    const prior = await tx.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId, key } } });
    const value = JSON.stringify({ ...(prior ? JSON.parse(prior.value) : {}), ...patch });
    await tx.workspaceSetting.upsert({ where: { organizationId_key: { organizationId, key } }, create: { organizationId, key, value, updatedById: actorId }, update: { value, updatedById: actorId } });
  }
  const key = 'governance.template';
  const prior = await tx.workspaceSetting.findUnique({ where: { organizationId_key: { organizationId, key } } });
  const previous = prior ? JSON.parse(prior.value) : {};
  const imported = [...new Set([...(previous.imported || []), id])];
  const value = JSON.stringify({ imported, importedAt: new Date().toISOString(), importedById: actorId });
  const setting = await tx.workspaceSetting.upsert({ where: { organizationId_key: { organizationId, key } }, create: { organizationId, key, value, updatedById: actorId }, update: { value, updatedById: actorId } });
  return { organizationId, templateId: id, settingId: setting.id, appliedSettings: Object.keys(values) };
}
