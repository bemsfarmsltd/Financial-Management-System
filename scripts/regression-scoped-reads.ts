import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { getAiReadClient } from '../src/lib/platform/scoped-database';
if (!process.env.DATABASE_URL?.includes('/bems_corrections_test')) throw new Error('Isolated test database required.');
async function main() {
  const org = await prisma.organization.findFirstOrThrow();
  const actor = await prisma.employee.findFirstOrThrow({ where: { role: 'SYSTEM_ADMIN', status: 'ACTIVE' } });
  const db = await getAiReadClient({ ...actor, canonicalRole: 'SUPER_ADMIN', isExecutive: true, authSource: 'HUMAN_SESSION', scopedOrganizationId: org.id, delegation: { scopedOrganizationId: org.id } as any });
  for (const model of ['organization','department','employee','employeeAssignment','workspaceSetting','budget','budgetLine','expenditureRequest','disbursement','accountabilityCase','attendanceStation','attendancePolicy','attendanceRecord','staffWorkSchedule','leaveRequest','payrollItem','payrollBatch','payrollPeriod','payrollItemAllocation','staffAdminMessage','followupTask','intercompanyNote','vendorInvoice','goodsReceiptNote','threeWayMatchRecord','auditEvent','systemNotification']) {
    await (db as any)[model].findMany({ take: 1 });
  }
  const budgets = await db.budget.findMany({ include: { organization: true, lines: true } });
  assert.ok(budgets.every(budget => budget.organizationId === org.id));
  await assert.rejects(db.budget.deleteMany({ where: { organizationId: org.id } }));
  console.log('PASS all 27 AI model scopes execute with real Prisma and AI writes remain blocked');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
