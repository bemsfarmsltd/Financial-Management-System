import { createHash } from 'node:crypto';
export function payrollSnapshotHash(items: Array<{ id: string; employeeId: string; grossMinor: bigint; employeeDeductionsMinor: bigint; employerCostMinor: bigint; netMinor: bigint; allocations: Array<{ subsidiaryId: string; allocableCostMinor: bigint; percentage: number }> }>) {
  const snapshot = [...items].sort((a, b) => a.id.localeCompare(b.id)).map(item => ({ id: item.id, employeeId: item.employeeId, grossMinor: item.grossMinor.toString(), deductionsMinor: item.employeeDeductionsMinor.toString(), employerCostMinor: item.employerCostMinor.toString(), netMinor: item.netMinor.toString(), allocations: [...item.allocations].sort((a, b) => a.subsidiaryId.localeCompare(b.subsidiaryId)).map(a => ({ subsidiaryId: a.subsidiaryId, amountMinor: a.allocableCostMinor.toString(), percentage: a.percentage })) }));
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
