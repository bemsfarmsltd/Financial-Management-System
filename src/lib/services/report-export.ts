import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { stripAuthenticationSecrets } from '@/lib/platform/read-catalog';

export async function createReportSnapshot(tx: Prisma.TransactionClient, actor: { id: string; role: string; employeeNumber?: string }, input: Record<string, any>) {
  const type = String(input.report_type || input.reportType || 'audit');
  const format = String(input.format || 'csv');
  if (!['audit', 'requests', 'fund_requests', 'disbursements', 'budgets'].includes(type) || !['csv', 'json'].includes(format)) throw new Error('Unsupported report type or format.');
  const scope = await resolveAuthorizedOrganizationScope(actor as any, input.subsidiary || input.organization_id || input.organizationId || input.subsidiaryId || 'ALL');
  if (!scope.organizationIds.length) throw new Error('No authorized report workspace.');
  const ids = scope.organizationIds;
  const limit = 500;
  let rows: Record<string, any>[];
  if (type === 'requests' || type === 'fund_requests') rows = await tx.expenditureRequest.findMany({ where: { subsidiaryId: { in: ids } }, select: { id: true, requestNumber: true, title: true, subsidiaryId: true, category: true, amountMinor: true, currency: true, approvalStatus: true, paymentStatus: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit });
  else if (type === 'disbursements') rows = await tx.disbursement.findMany({ where: { payerOrgId: { in: ids } }, select: { id: true, requestId: true, payerOrgId: true, amountMinor: true, currency: true, externalReference: true, status: true, paidAt: true }, orderBy: { paidAt: 'desc' }, take: limit });
  else if (type === 'budgets') rows = await tx.budget.findMany({ where: { organizationId: { in: ids } }, select: { id: true, organizationId: true, periodName: true, totalAmount: true, committedAmount: true, spentAmount: true, status: true }, orderBy: { createdAt: 'desc' }, take: limit });
  else rows = await tx.auditEvent.findMany({ where: { subsidiaryId: { in: ids } }, select: { id: true, actorName: true, actorRole: true, subsidiaryId: true, targetType: true, targetId: true, action: true, createdAt: true, correlationId: true }, orderBy: { createdAt: 'desc' }, take: limit });
  rows = stripAuthenticationSecrets(rows);
  const columns = rows.length ? Object.keys(rows[0]) : ['id'];
  const cell = (value: unknown) => { const text = String(value ?? ''); return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'; };
  const bytes = Buffer.from(format === 'json' ? JSON.stringify({ count: rows.length, rows, limit }) : [columns.map(cell).join(','), ...rows.map(row => columns.map(column => cell(row[column])).join(','))].join('\r\n'));
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 86400000);
  await tx.attachment.create({ data: { id, ownerType: 'REPORT_EXPORT', ownerId: actor.id, uploadedById: actor.id, fileName: type + '.' + format, fileUrl: '/api/reports/export?id=' + id, contentType: format === 'csv' ? 'text/csv' : 'application/json', fileData: new Uint8Array(bytes), checksum: createHash('sha256').update(bytes).digest('hex'), notes: JSON.stringify({ expiresAt: expiresAt.toISOString(), rowCount: rows.length }) } });
  return { ok: true, report_id: id, row_count: rows.length, format, download_url: '/api/reports/export?id=' + id, expires_at: expiresAt.toISOString(), limit };
}
