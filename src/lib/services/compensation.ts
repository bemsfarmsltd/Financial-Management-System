import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type CompensationChangeType =
  | 'SET_EXACT'
  | 'INITIAL_SALARY'
  | 'ADDITION'
  | 'DEDUCTION'
  | 'REMOVE_FROM_PAYROLL';

export function formatNairaMinor(minor: bigint | number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export interface CompensationPreviewContext {
  employee: {
    id: string;
    employeeNumber: string;
    legalName: string;
    workEmail: string;
    role: string;
    status: string;
  };
  subsidiaryId: string;
  subsidiaryName: string;
  agreementId: string | null;
  currentCompVersion: number;
  currentGrossMinor: bigint;
  currentGrossNaira: number;
  affectedOpenPeriods: string[];
}

export async function inspectEmployeeCompensationContext(
  employeeQuery: string
): Promise<CompensationPreviewContext> {
  const cleanQuery = String(employeeQuery || '').trim();
  if (!cleanQuery) {
    throw new Error('employee_id is required.');
  }

  const emp = await prisma.employee.findFirst({
    where: {
      OR: [
        { id: cleanQuery },
        { employeeNumber: { equals: cleanQuery, mode: 'insensitive' } },
        { workEmail: { equals: cleanQuery, mode: 'insensitive' } },
      ],
    },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
        include: { subsidiary: { select: { id: true, legalName: true } } },
      },
      employmentAgreements: {
        where: { status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        take: 1,
        include: {
          compensations: {
            orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
          },
        },
      },
    },
  });

  if (!emp) {
    throw new Error(`Employee "${cleanQuery}" not found.`);
  }
  if (emp.role !== 'STAFF') {
    throw new Error(`Staff salary adjustments are only applicable to STAFF records (${emp.legalName} has role ${emp.role}).`);
  }
  if (emp.status !== 'ACTIVE') {
    throw new Error(`Salary can only be changed for ACTIVE staff (${emp.legalName} is ${emp.status}).`);
  }

  const activeAgreement = emp.employmentAgreements[0] || null;
  const activeAssignment = emp.assignments[0] || null;
  const subsidiaryId = activeAgreement?.employerEntityId || activeAssignment?.subsidiaryId || '';
  let subsidiaryName = activeAssignment?.subsidiary?.legalName || '';
  if (!subsidiaryName && subsidiaryId) {
    const employerOrg = await prisma.organization.findUnique({
      where: { id: subsidiaryId },
      select: { legalName: true },
    });
    subsidiaryName = employerOrg?.legalName || '';
  }

  if (!subsidiaryId) {
    throw new Error(
      `Staff member ${emp.legalName} has no active employment agreement or active subsidiary assignment.`
    );
  }

  const now = new Date();
  const comps = activeAgreement?.compensations || [];
  const effectiveComp =
    comps.find(
      (c: any) =>
        new Date(c.effectiveFrom) <= now &&
        (!c.effectiveTo || new Date(c.effectiveTo) >= now)
    ) ||
    comps[0] ||
    null;

  const maxVersion = comps.reduce((max: number, c: any) => Math.max(max, c.version), 0);
  const currentGrossMinor = effectiveComp ? effectiveComp.grossMinor : BigInt(0);

  const openPeriods = await prisma.payrollPeriod.findMany({
    where: { lockStatus: 'OPEN' },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 3,
  });

  const affectedOpenPeriods = openPeriods.map((p) => {
    const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(
      new Date(p.year, p.month - 1, 1)
    );
    return `${monthName} ${p.year}`;
  });

  return {
    employee: {
      id: emp.id,
      employeeNumber: emp.employeeNumber,
      legalName: emp.legalName,
      workEmail: emp.workEmail,
      role: emp.role,
      status: emp.status,
    },
    subsidiaryId,
    subsidiaryName,
    agreementId: activeAgreement?.id || null,
    currentCompVersion: maxVersion,
    currentGrossMinor,
    currentGrossNaira: Number(currentGrossMinor) / 100,
    affectedOpenPeriods,
  };
}

export interface ExecuteCompensationUpdateInput {
  employeeId: string;
  changeType: CompensationChangeType;
  /**
   * For SET_EXACT / INITIAL_SALARY: the target monthly gross in Naira.
   * For ADDITION / DEDUCTION: if isTargetGross is true, target monthly gross in Naira; otherwise the delta in Naira.
   */
  amountNaira: number;
  isTargetGross?: boolean;
  effectiveFrom?: Date | string;
  reason: string;
  actorId: string;
  expectedCompVersion?: number;
}

export interface ExecuteCompensationUpdateResult {
  employee: {
    id: string;
    employeeNumber: string;
    legalName: string;
  };
  subsidiaryId: string;
  agreementId: string;
  compensation: {
    id: string;
    version: number;
    grossMinor: bigint;
    effectiveFrom: Date;
    changeType: string | null;
    changeReason: string | null;
  };
  previousGrossMinor: bigint;
  newGrossMinor: bigint;
  targetDeltaMinor: bigint;
  previousGrossFormatted: string;
  newGrossFormatted: string;
  notificationBody: string;
  affectedOpenPeriods: string[];
}

export async function applyCanonicalCompensationChange(
  tx: Prisma.TransactionClient,
  input: ExecuteCompensationUpdateInput
): Promise<ExecuteCompensationUpdateResult> {
  const {
    employeeId,
    changeType,
    amountNaira,
    isTargetGross = false,
    effectiveFrom: rawEffectiveFrom,
    reason: rawReason,
    actorId,
    expectedCompVersion,
  } = input;

  const reason = String(rawReason || '').trim();
  if (reason.length < 5 || reason.length > 1000) {
    throw new Error('Enter a reason of at least 5 characters.');
  }

  let effectiveDate = new Date();
  if (rawEffectiveFrom) {
    const parsed = rawEffectiveFrom instanceof Date ? rawEffectiveFrom : new Date(rawEffectiveFrom);
    if (isNaN(parsed.getTime())) {
      throw new Error('Invalid effective date for salary adjustment.');
    }
    effectiveDate = parsed;
  }

  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      employeeNumber: true,
      legalName: true,
      status: true,
      role: true,
      assignments: {
        where: { status: 'ACTIVE' },
        orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
        take: 1,
        select: { subsidiaryId: true, departmentId: true },
      },
    },
  });

  if (!employee) {
    throw new Error('Staff member not found.');
  }
  if (employee.role !== 'STAFF') {
    throw new Error('Staff salary adjustments are only applicable to staff members.');
  }
  if (employee.status !== 'ACTIVE') {
    throw new Error('Salary can only be changed for active staff.');
  }

  // Strictly look up ACTIVE EmploymentAgreement only (never fall back to terminated/inactive agreements)
  let agreement = await tx.employmentAgreement.findFirst({
    where: { employeeId, status: 'ACTIVE' },
    orderBy: { startDate: 'desc' },
    include: {
      compensations: {
        orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
      },
    },
  });

  const activeAssignmentSubId = employee.assignments[0]?.subsidiaryId;
  const employerEntityId = agreement?.employerEntityId || activeAssignmentSubId;

  if (!employerEntityId) {
    throw new Error(
      `Staff member ${employee.legalName} does not have an active employment agreement or active subsidiary assignment.`
    );
  }

  if (!agreement) {
    agreement = await tx.employmentAgreement.create({
      data: {
        employeeId,
        employerEntityId,
        agreementType: 'PERMANENT',
        paymentModel: 'GROUP_PAID',
        status: 'ACTIVE',
        startDate: effectiveDate,
      },
      include: {
        compensations: true,
      },
    });
  }

  const allComps = agreement.compensations || [];
  const maxVersion = allComps.reduce((max, c) => Math.max(max, c.version), 0);

  if (expectedCompVersion !== undefined && expectedCompVersion !== null) {
    if (maxVersion !== Number(expectedCompVersion)) {
      throw new Error(
        `STALE_COMPENSATION_VERSION: Salary for ${employee.legalName} was modified after staging (v${maxVersion} vs expected v${expectedCompVersion}).`
      );
    }
  }

  const now = new Date();
  const effectiveSalary =
    allComps.find(
      (c) =>
        new Date(c.effectiveFrom) <= now &&
        (!c.effectiveTo || new Date(c.effectiveTo) >= now)
    ) ||
    allComps[0] ||
    null;

  const prevGrossMinor: bigint = effectiveSalary ? effectiveSalary.grossMinor : BigInt(0);
  let newGrossMinor: bigint;
  let targetDeltaMinor: bigint;

  if (changeType === 'REMOVE_FROM_PAYROLL') {
    newGrossMinor = BigInt(0);
    targetDeltaMinor = prevGrossMinor;
  } else {
    if (!Number.isFinite(amountNaira) || amountNaira <= 0 || amountNaira > 1_000_000_000) {
      throw new Error('Enter a valid positive salary amount.');
    }
    const inputMinor = BigInt(Math.round(amountNaira * 100));

    if (changeType === 'SET_EXACT' || changeType === 'INITIAL_SALARY' || isTargetGross) {
      newGrossMinor = inputMinor;
      targetDeltaMinor =
        newGrossMinor >= prevGrossMinor ? newGrossMinor - prevGrossMinor : prevGrossMinor - newGrossMinor;
    } else if (changeType === 'ADDITION') {
      newGrossMinor = prevGrossMinor + inputMinor;
      targetDeltaMinor = inputMinor;
    } else if (changeType === 'DEDUCTION') {
      newGrossMinor = prevGrossMinor - inputMinor;
      targetDeltaMinor = inputMinor;
    } else {
      throw new Error(`Unsupported salary change type: ${changeType}`);
    }

    if (newGrossMinor <= BigInt(0)) {
      throw new Error('Salary cannot be zero or negative.');
    }
  }

  const nextVersion = maxVersion + 1;
  if (effectiveSalary) {
    const closeAt = new Date(Math.min(now.getTime(), effectiveDate.getTime()) - 1);
    await tx.compensationAgreement.update({
      where: { id: effectiveSalary.id },
      data: { effectiveTo: closeAt },
    });
  }

  const resolvedChangeType: CompensationChangeType =
    changeType === 'REMOVE_FROM_PAYROLL'
      ? 'REMOVE_FROM_PAYROLL'
      : isTargetGross && (changeType === 'ADDITION' || changeType === 'DEDUCTION')
      ? newGrossMinor < prevGrossMinor
        ? 'DEDUCTION'
        : prevGrossMinor === BigInt(0)
        ? 'INITIAL_SALARY'
        : 'ADDITION'
      : changeType;

  const compensation = await tx.compensationAgreement.create({
    data: {
      employmentAgreementId: agreement.id,
      grossMinor: newGrossMinor,
      currency: effectiveSalary?.currency || 'NGN',
      recurrence: effectiveSalary?.recurrence || 'MONTHLY',
      effectiveFrom: effectiveDate,
      version: nextVersion,
      approvedBy: actorId,
      changeType: resolvedChangeType,
      changeReason: reason,
    },
  });

  await tx.costAllocation.create({
    data: {
      compensationAgreementId: compensation.id,
      subsidiaryId: agreement.employerEntityId,
      percentage: 100,
      effectiveFrom: effectiveDate,
    },
  });

  const affectedPeriodsSet = new Set<string>();

  if (resolvedChangeType === 'REMOVE_FROM_PAYROLL') {
    const activeItems = await tx.payrollItem.findMany({
      where: {
        employeeId,
        disbursement: null,
      },
      include: {
        batch: { include: { period: true } },
      },
    });

    for (const it of activeItems) {
      const p = it.batch.period;
      const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(
        new Date(p.year, p.month - 1, 1)
      );
      affectedPeriodsSet.add(`${monthName} ${p.year}`);

      await tx.payrollItemAllocation.deleteMany({ where: { itemId: it.id } });
      await tx.payrollItem.delete({ where: { id: it.id } });

      const remainingItems = await tx.payrollItem.findMany({
        where: { batchId: it.batchId },
        select: { grossMinor: true, netMinor: true },
      });
      let totalG = BigInt(0);
      let totalN = BigInt(0);
      for (const rem of remainingItems) {
        totalG += rem.grossMinor;
        totalN += rem.netMinor;
      }
      await tx.payrollBatch.update({
        where: { id: it.batchId },
        data: { totalGrossMinor: totalG, totalNetMinor: totalN },
      });
    }
  } else {
    // Synchronize unpaid payroll items in open payroll periods if the effectiveDate applies to them
    const openUnpaidItems = await tx.payrollItem.findMany({
      where: {
        employeeId,
        disbursement: null,
        batch: {
          period: {
            lockStatus: 'OPEN',
            endsOn: { gte: effectiveDate },
          },
        },
      },
      include: {
        batch: { include: { period: true } },
        allocations: true,
      },
    });

    for (const it of openUnpaidItems) {
      const p = it.batch.period;
      const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(
        new Date(p.year, p.month - 1, 1)
      );
      affectedPeriodsSet.add(`${monthName} ${p.year}`);

      const newNet =
        newGrossMinor > it.employeeDeductionsMinor
          ? newGrossMinor - it.employeeDeductionsMinor
          : BigInt(0);

      await tx.payrollItem.update({
        where: { id: it.id },
        data: {
          grossMinor: newGrossMinor,
          netMinor: newNet,
        },
      });

      if (it.allocations.length > 0) {
        for (const alloc of it.allocations) {
          await tx.payrollItemAllocation.update({
            where: { id: alloc.id },
            data: {
              allocableCostMinor: BigInt(
                Math.round(Number(newGrossMinor) * (alloc.percentage / 100))
              ),
            },
          });
        }
      }

      const batchItems = await tx.payrollItem.findMany({
        where: { batchId: it.batchId },
        select: { grossMinor: true, netMinor: true },
      });
      let totalG = BigInt(0);
      let totalN = BigInt(0);
      for (const bi of batchItems) {
        totalG += bi.grossMinor;
        totalN += bi.netMinor;
      }
      await tx.payrollBatch.update({
        where: { id: it.batchId },
        data: { totalGrossMinor: totalG, totalNetMinor: totalN },
      });
    }
  }

  const notificationBody =
    resolvedChangeType === 'REMOVE_FROM_PAYROLL'
      ? `You have been removed from salary payroll. Reason: ${reason}`
      : resolvedChangeType === 'SET_EXACT' || resolvedChangeType === 'INITIAL_SALARY'
      ? `Your monthly gross salary is set to ${formatNairaMinor(newGrossMinor)}. Reason: ${reason}`
      : `Your gross salary was ${
          newGrossMinor >= prevGrossMinor ? 'increased' : 'decreased'
        } by ${formatNairaMinor(targetDeltaMinor)}, from ${formatNairaMinor(
          prevGrossMinor
        )} to ${formatNairaMinor(newGrossMinor)}. Reason: ${reason}`;

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      legalName: employee.legalName,
    },
    subsidiaryId: agreement.employerEntityId,
    agreementId: agreement.id,
    compensation: {
      id: compensation.id,
      version: compensation.version,
      grossMinor: compensation.grossMinor,
      effectiveFrom: compensation.effectiveFrom,
      changeType: compensation.changeType,
      changeReason: compensation.changeReason,
    },
    previousGrossMinor: prevGrossMinor,
    newGrossMinor,
    targetDeltaMinor,
    previousGrossFormatted: formatNairaMinor(prevGrossMinor),
    newGrossFormatted: formatNairaMinor(newGrossMinor),
    notificationBody,
    affectedOpenPeriods: Array.from(affectedPeriodsSet),
  };
}
