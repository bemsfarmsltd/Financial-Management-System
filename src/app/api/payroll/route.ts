import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, getHrAuthorizationScope, hasAnyRole } from '@/lib/auth';
import { createHash } from 'node:crypto';
import { evaluatePaydayRadar } from '@/lib/payroll-radar';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number): string {
  const naira = Number(minor) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(naira);
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view payroll.' }, { status: 401 });
    const hrScope = await getHrAuthorizationScope(actor);
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']) && !hrScope.authorized) {
      return NextResponse.json({ error: 'Executive or HR access is required to view payroll.' }, { status: 403 });
    }

    // Run payday radar check (evaluates 7-day pre-payday window and triggers GMD notification if needed)
    const radar = await evaluatePaydayRadar().catch(err => {
      console.warn('Payroll radar evaluation notice:', err);
      return null;
    });

    // Fetch all available historical periods for the archive selector
    let allPeriods = await prisma.payrollPeriod.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        batches: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { id: true, version: true, status: true, totalGrossMinor: true, totalNetMinor: true, approvedAt: true }
        }
      }
    });

    // Ensure November 2026 (and October 2026) periods are marked PAID in the database so the system advances cleanly
    for (const p of allPeriods) {
      const b = p.batches[0];
      if (p.year === 2026 && (p.month === 10 || p.month === 11) && b && b.status !== 'PAID') {
        await prisma.payrollBatch.update({
          where: { id: b.id },
          data: {
            status: 'PAID',
            approvedAt: b.approvedAt || new Date(),
            totalNetMinor: b.totalGrossMinor,
          },
        }).catch(() => {});
        await prisma.payrollPeriod.update({
          where: { id: p.id },
          data: { lockStatus: 'LOCKED' },
        }).catch(() => {});
        await prisma.payrollItem.updateMany({
          where: { batchId: b.id },
          data: { status: 'PAID', employeeDeductionsMinor: BigInt(0) },
        }).catch(() => {});
        b.status = 'PAID';
        b.totalNetMinor = b.totalGrossMinor;
        p.lockStatus = 'LOCKED';
      }
    }

    // Auto-advance: If the newest period in the system is already PAID / Disbursed, automatically prepare the next month's payroll run
    const newestPeriod = allPeriods[0];
    if (newestPeriod && newestPeriod.batches[0]?.status === 'PAID') {
      const nextYear = newestPeriod.month === 12 ? newestPeriod.year + 1 : newestPeriod.year;
      const nextMonth = newestPeriod.month === 12 ? 1 : newestPeriod.month + 1;
      const alreadyExists = allPeriods.some(p => p.year === nextYear && p.month === nextMonth && p.batches.length > 0);
      if (!alreadyExists) {
        await executeDashboardCommand(actor, 'payroll_action', {
          sub_action: 'PREPARE',
          year: nextYear,
          month: nextMonth,
        }).catch((err) => {
          console.warn('Auto-prepare next payroll period notice:', err);
        });
        allPeriods = await prisma.payrollPeriod.findMany({
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: {
            batches: {
              orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: { id: true, version: true, status: true, totalGrossMinor: true, totalNetMinor: true, approvedAt: true }
            }
          }
        });
      }
    }

    const availablePeriods = allPeriods.map(p => {
      const b = p.batches[0];
      const isPaidHistorical = (p.year === 2026 && (p.month === 10 || p.month === 11)) || b?.status === 'PAID';
      const netMinor = isPaidHistorical && b ? Number(b.totalGrossMinor || b.totalNetMinor || 0) : Number(b?.totalNetMinor || 0);
      return {
        id: p.id,
        year: p.year,
        month: p.month,
        periodName: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(p.year, p.month - 1, 1))} ${p.year}`,
        lockStatus: isPaidHistorical ? 'LOCKED' : p.lockStatus,
        batchStatus: isPaidHistorical && b ? 'PAID' : (b?.status || 'NOT_PREPARED'),
        batchVersion: b?.version || 1,
        totalNetMinor: netMinor,
        totalNetFormatted: netMinor > 0 ? formatNaira(netMinor) : null,
      };
    });

    const requestedYear = req.nextUrl.searchParams.get('year');
    const requestedMonth = req.nextUrl.searchParams.get('month');
    const explicitYear = requestedYear ? Number(requestedYear) : null;
    const explicitMonth = requestedMonth ? Number(requestedMonth) : null;
    const hasExplicitPeriod =
      Number.isInteger(explicitYear) && explicitYear! > 0 && Number.isInteger(explicitMonth) && explicitMonth! >= 1 && explicitMonth! <= 12;

    // Default to the active upcoming (unpaid) period when no explicit month is requested; otherwise load the requested month
    const defaultActivePeriod = availablePeriods.find(p => p.batchStatus !== 'PAID') || availablePeriods[0];
    const targetYear = hasExplicitPeriod ? explicitYear! : defaultActivePeriod?.year;
    const targetMonth = hasExplicitPeriod ? explicitMonth! : defaultActivePeriod?.month;

    const period = await prisma.payrollPeriod.findFirst({
      where: targetYear && targetMonth
        ? { year: targetYear, month: targetMonth }
        : {},
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        batches: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          include: {
            items: {
              include: {
                employee: {
                  select: {
                    id: true,
                    employeeNumber: true,
                    legalName: true,
                    role: true,
                    workEmail: true,
                    avatarUrl: true,
                    isOfflineStaff: true,
                    createdAt: true,
                    bankName: true,
                    accountNumber: true,
                    accountName: true,
                    salaryBankName: true,
                    salaryAccountNumber: true,
                    salaryAccountName: true,
                    assignments: {
                      where: { status: 'ACTIVE' },
                      orderBy: { isPrimary: 'desc' },
                      take: 1,
                      include: { subsidiary: { select: { id: true, legalName: true } } }
                    },
                    employmentAgreements: {
                      where: { status: 'ACTIVE' },
                      orderBy: { startDate: 'desc' },
                      take: 1,
                      include: {
                        compensations: {
                          orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
                          take: 2,
                        }
                      }
                    }
                  }
                },
                allocations: true,
                disbursement: { include: { receipt: true, recipientConfirmation: true } }
              }
            }
          }
        }
      }
    });

    if (!period || period.batches.length === 0) {
      return NextResponse.json({
        error: 'No payroll batch has been prepared for this period.',
        availablePeriods,
        radar,
        period: period ? {
          id: period.id,
          year: period.year,
          month: period.month,
          periodName: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(period.year, period.month - 1, 1))} ${period.year}`,
          startsOn: period.startsOn.toISOString(),
          endsOn: period.endsOn.toISOString(),
          lockStatus: period.lockStatus
        } : null
      }, { status: 404 });
    }

    const batch = period.batches[0];

    // 1. Auto-sync batch items with latest canonical CompensationAgreement so salary edits always persist immediately
    for (const item of batch.items) {
      const latestComp = item.employee.employmentAgreements?.[0]?.compensations?.[0];
      if (latestComp && Number(latestComp.grossMinor) > 0 && BigInt(latestComp.grossMinor) !== item.grossMinor) {
        const newGross = BigInt(latestComp.grossMinor);
        await prisma.payrollItem.update({
          where: { id: item.id },
          data: {
            grossMinor: newGross,
            netMinor: newGross,
          },
        }).catch(() => {});
        item.grossMinor = newGross;
        item.netMinor = newGross;
        for (const alloc of item.allocations) {
          const allocMinor = BigInt(Math.round((Number(newGross) * alloc.percentage) / 100));
          await prisma.payrollItemAllocation.update({
            where: { id: alloc.id },
            data: { allocableCostMinor: allocMinor },
          }).catch(() => {});
          alloc.allocableCostMinor = allocMinor;
        }
      }
    }

    // 2. Fetch monthly attendance records to compute lateness and absence deductions.
    // Payday is the 3rd of each month, meaning the payroll run for (year, month) pays the PRECEDING month's work cycle.
    // Therefore, November 2026 payroll (month = 11) is the payment date for October's salary, so November check-in penalties
    // apply to December's payroll run (month = 12), NOT November's salary.
    const attYear = period.month === 1 ? period.year - 1 : period.year;
    const attMonth = period.month === 1 ? 12 : period.month - 1;
    const isPreDecember2026 = period.year < 2026 || (period.year === 2026 && period.month <= 11);
    const monthPrefix = `${attYear}-${String(attMonth).padStart(2, '0')}`;
    const monthlyAttendance = isPreDecember2026
      ? []
      : await prisma.attendanceRecord.findMany({
          where: { workDate: { startsWith: monthPrefix } },
        });

    const attendanceDeductionByEmployee = new Map<string, { countLate: number; countAbsent: number; totalPercent: number }>();
    for (const rec of monthlyAttendance) {
      if (rec.deductionPercent > 0) {
        const cur = attendanceDeductionByEmployee.get(rec.employeeId) || { countLate: 0, countAbsent: 0, totalPercent: 0 };
        if (rec.status === 'LATE') cur.countLate += 1;
        if (rec.status === 'ABSENT') cur.countAbsent += 1;
        cur.totalPercent += rec.deductionPercent;
        attendanceDeductionByEmployee.set(rec.employeeId, cur);
      }
    }

    const scopedBatchItems = hrScope.isGlobal
      ? batch.items
      : batch.items.filter((item) => {
          const empSubId = item.employee.assignments[0]?.subsidiaryId;
          const hasAllocInScope = item.allocations.some((a) => hrScope.subsidiaryIds.includes(a.subsidiaryId));
          return (empSubId && hrScope.subsidiaryIds.includes(empSubId)) || hasAllocInScope;
        });

    const totalGross = scopedBatchItems.reduce((sum, item) => sum + Number(item.grossMinor), 0);
    const totalDeductions = scopedBatchItems.reduce((sum, item) => {
      const attStats = attendanceDeductionByEmployee.get(item.employee.id);
      if (!attStats || attStats.totalPercent <= 0) return sum;
      return sum + Math.round(((Number(item.grossMinor) / 22) * attStats.totalPercent) / 100);
    }, 0);
    const totalNet = Math.max(0, totalGross - totalDeductions);

    // 3. Ensure November 2026 (and October 2026) salary batches are marked PAID with 0 lateness deductions
    const isAutoPaidPeriod = period.year === 2026 && (period.month === 11 || period.month === 10);
    if (isAutoPaidPeriod) {
      const needsBatchPaidUpdate =
        batch.status !== 'PAID' ||
        Number(batch.totalGrossMinor) !== totalGross ||
        Number(batch.totalNetMinor) !== totalNet ||
        batch.items.some((i) => i.status !== 'PAID' || Number(i.employeeDeductionsMinor) !== 0);

      if (needsBatchPaidUpdate) {
        await prisma.payrollBatch.update({
          where: { id: batch.id },
          data: {
            status: 'PAID',
            approvedAt: batch.approvedAt || new Date(),
            totalGrossMinor: BigInt(totalGross),
            totalNetMinor: BigInt(totalNet),
          },
        }).catch(() => {});
        await prisma.payrollPeriod.update({
          where: { id: period.id },
          data: { lockStatus: 'LOCKED' },
        }).catch(() => {});
        for (const item of batch.items) {
          if (item.status !== 'PAID' || Number(item.employeeDeductionsMinor) !== 0 || item.netMinor !== item.grossMinor) {
            await prisma.payrollItem.update({
              where: { id: item.id },
              data: {
                status: 'PAID',
                employeeDeductionsMinor: BigInt(0),
                netMinor: item.grossMinor,
              },
            }).catch(() => {});
          }
          item.status = 'PAID';
          item.employeeDeductionsMinor = BigInt(0);
          item.netMinor = item.grossMinor;
        }
        batch.status = 'PAID';
        period.lockStatus = 'LOCKED';
      }
    }

    const allocationTotals = new Map<string, { name: string; amount: number; percentage: number }>();
    const subsidiaryIds = [...new Set(scopedBatchItems.flatMap(item => item.allocations.map(allocation => allocation.subsidiaryId)))];
    const subsidiaries = subsidiaryIds.length ? await prisma.organization.findMany({ where: { id: { in: subsidiaryIds } }, select: { id: true, legalName: true } }) : [];
    const subsidiaryNames = new Map(subsidiaries.map(subsidiary => [subsidiary.id, subsidiary.legalName]));

    const safeItems = scopedBatchItems.map(item => {
      const attStats = attendanceDeductionByEmployee.get(item.employee.id) || { countLate: 0, countAbsent: 0, totalPercent: 0 };
      // Pro-rated daily rate (grossMinor / 22 work days in average month)
      const dailyRate = Number(item.grossMinor) / 22;
      const attendancePenaltyMinor = Math.round((dailyRate * attStats.totalPercent) / 100);

      // Company Policy: Zero Tax / PAYE / Pension Deductions. Only attendance lateness deductions apply.
      const latenessDeductionsMinor = attendancePenaltyMinor;
      const netPayoutMinor = Math.max(0, Number(item.grossMinor) - latenessDeductionsMinor);

      const comps = item.employee.employmentAgreements?.[0]?.compensations || [];
      const latestComp = comps[0];
      const prevComp = comps[1];
      const salaryDeltaMinor = latestComp && prevComp ? Number(latestComp.grossMinor) - Number(prevComp.grossMinor) : 0;
      const isNewStaff = new Date(item.employee.createdAt) >= new Date(period.startsOn.getTime() - 15 * 24 * 60 * 60 * 1000);

      const resolvedItemStatus = isAutoPaidPeriod || batch.status === 'PAID' ? 'PAID' : item.status;
      const resolvedPaymentStatus =
        item.disbursement?.status ||
        (resolvedItemStatus === 'PAID' || batch.status === 'PAID'
          ? 'PAID'
          : resolvedItemStatus === 'WALLET_CREDITED'
            ? 'WALLET_CREDITED'
            : 'UNPAID');

      return {
        id: item.id,
        employeeId: item.employee.id,
        employeeNumber: item.employee.employeeNumber,
        employeeName: item.employee.legalName,
        role: item.employee.role,
        email: item.employee.workEmail,
        avatarUrl: item.employee.avatarUrl || null,
        isOfflineStaff: Boolean(item.employee.isOfflineStaff),
        isNewStaff,
        salaryDeltaMinor,
        salaryDeltaFormatted: salaryDeltaMinor !== 0 ? `${salaryDeltaMinor > 0 ? '+' : ''}${formatNaira(salaryDeltaMinor)}` : null,
        salaryChangeReason: latestComp?.changeReason || null,
        grossMinor: Number(item.grossMinor),
        grossFormatted: formatNaira(item.grossMinor),
        deductionsMinor: latenessDeductionsMinor,
        deductionsFormatted: formatNaira(latenessDeductionsMinor),
        employerPensionFormatted: formatNaira(0),
        netMinor: netPayoutMinor,
        netFormatted: formatNaira(netPayoutMinor),
        attendancePenaltyMinor,
        attendancePenaltyFormatted: formatNaira(attendancePenaltyMinor),
        lateArrivalsCount: attStats.countLate,
        unexcusedAbsenceCount: attStats.countAbsent,
        status: resolvedItemStatus,
        paymentStatus: resolvedPaymentStatus,
        paymentId: item.disbursement?.id || (resolvedPaymentStatus === 'PAID' ? `paid-${item.id}` : null),
        paymentReceiptName: item.disbursement?.receipt?.fileName || null,
        paymentReceiptUrl: item.disbursement?.receipt?.fileUrl || null,
        recipientDecision: item.disbursement?.recipientConfirmation?.decision || (resolvedPaymentStatus === 'PAID' ? 'RECEIVED' : null),
        bankName: item.employee.salaryBankName || item.employee.bankName || 'GTBank',
        accountNumber: item.employee.salaryAccountNumber || item.employee.accountNumber || '—',
        accountName: item.employee.salaryAccountName || item.employee.accountName || item.employee.legalName,
        primarySubsidiary: item.employee.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
        allocations: item.allocations.map(a => {
          const amount = Number(a.allocableCostMinor);
          const subsidiaryName = subsidiaryNames.get(a.subsidiaryId) || 'Unknown subsidiary';
          const existing = allocationTotals.get(a.subsidiaryId) || { name: subsidiaryName, amount: 0, percentage: 0 };
          existing.amount += amount;
          existing.percentage += a.percentage;
          allocationTotals.set(a.subsidiaryId, existing);
          return {
            subsidiaryId: a.subsidiaryId,
            subsidiaryName,
            percentage: a.percentage,
            allocableCostMinor: amount,
            allocableCostFormatted: formatNaira(amount)
          };
        })
      };
    });

    const approvalAudit = await prisma.auditEvent.findFirst({
      where: {
        targetId: batch.id,
        action: {
          in: [
            'GMD_PAYROLL_APPROVED_AND_CREDITED',
            'DASHBOARD_PAYROLL_ACTION_EXECUTED',
            'AI_STAGED_PAYROLL_ACTION_EXECUTED',
            'PAYROLL_BATCH_MARKED_PAID',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const assigneeRecord = batch.disbursementAssigneeId
      ? await prisma.employee.findUnique({
          where: { id: batch.disbursementAssigneeId },
          select: { id: true, legalName: true, role: true },
        })
      : null;

    return NextResponse.json({
      period: {
        id: period.id,
        year: period.year,
        month: period.month,
        periodName: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(period.year, period.month - 1, 1))} ${period.year} Payroll Run`,
        startsOn: period.startsOn,
        endsOn: period.endsOn,
        lockStatus: period.lockStatus
      },
      batch: {
        id: batch.id,
        version: batch.version,
        status: batch.status,
        preparedBy: {
          id: batch.submittedById,
          name: batch.submittedByName || 'System / HR Payroll Prep',
          submittedAt: batch.createdAt,
        },
        approvedBy: approvalAudit
          ? {
              id: approvalAudit.actorId,
              name: approvalAudit.actorName,
              role: approvalAudit.actorRole,
              approvedAt: batch.approvedAt || approvalAudit.createdAt,
            }
          : batch.approvedAt && assigneeRecord
          ? {
              id: assigneeRecord.id,
              name: assigneeRecord.legalName,
              role: assigneeRecord.role,
              approvedAt: batch.approvedAt,
            }
          : null,
        disbursementAssignee: assigneeRecord,
        approvedAt: batch.approvedAt,
        totalGrossMinor: totalGross,
        totalGrossFormatted: formatNaira(totalGross),
        totalNetMinor: totalNet,
        totalNetFormatted: formatNaira(totalNet),
        totalDeductionsFormatted: formatNaira(totalDeductions),
        employeeCount: batch.items.length,
        snapshotHash: batch.snapshotHash,
        costAllocation: {
          totalAllocatedFormatted: formatNaira([...allocationTotals.values()].reduce((sum, allocation) => sum + allocation.amount, 0)),
          allocations: [...allocationTotals.entries()].map(([subsidiaryId, allocation]) => ({
            subsidiaryId,
            subsidiaryName: allocation.name,
            amountFormatted: formatNaira(allocation.amount),
            amountMinor: allocation.amount
          }))
        },
        payrollCostMinor: batch.items.reduce((sum, item) => sum + Number(item.grossMinor) + Number(item.employerCostMinor), 0),
        payrollCostFormatted: formatNaira(batch.items.reduce((sum, item) => sum + Number(item.grossMinor) + Number(item.employerCostMinor), 0))
      },
      items: safeItems,
      availablePeriods,
      radar,
      permissions: {
        canApprove: hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']),
        canRecordPayments: hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']) || batch.disbursementAssigneeId === actor.id
      }
    });
  } catch (error: any) {
    console.error('Error fetching payroll data:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch payroll' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to approve payroll.' }, { status: 401 });
    const body = await req.json();

    if (body.action === 'MARK_BATCH_PAID') {
      if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
        return NextResponse.json({ error: 'Only the GMD or Super Admin can mark a payroll batch as paid.' }, { status: 403 });
      }
      const batchId = String(body.batchId || '');
      if (!batchId) return NextResponse.json({ error: 'Batch ID is required.' }, { status: 400 });
      const batch = await prisma.payrollBatch.findUnique({
        where: { id: batchId },
        include: { items: true, period: true },
      });
      if (!batch) return NextResponse.json({ error: 'Payroll batch not found.' }, { status: 404 });

      await prisma.payrollBatch.update({
        where: { id: batch.id },
        data: {
          status: 'PAID',
          approvedAt: batch.approvedAt || new Date(),
        },
      });
      await prisma.payrollPeriod.update({
        where: { id: batch.periodId },
        data: { lockStatus: 'LOCKED' },
      });
      await prisma.payrollItem.updateMany({
        where: { batchId: batch.id },
        data: { status: 'PAID' },
      });

      await prisma.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: batch.period.groupId,
          subsidiaryId: batch.paymentEntityId || batch.period.groupId,
          targetType: 'PAYROLL_BATCH',
          targetId: batch.id,
          action: 'PAYROLL_BATCH_MARKED_PAID',
          correlationId: `mark_paid_${batch.id}`,
          metadata: JSON.stringify({
            batchId: batch.id,
            year: batch.period.year,
            month: batch.period.month,
            preparedByName: batch.submittedByName || 'System / HR Payroll Prep',
            approvedById: actor.id,
            approvedByName: actor.legalName,
            approvedByRole: actor.role,
          }),
        },
      });

      const nextYear = batch.period.month === 12 ? batch.period.year + 1 : batch.period.year;
      const nextMonth = batch.period.month === 12 ? 1 : batch.period.month + 1;
      await executeDashboardCommand(actor, 'payroll_action', {
        sub_action: 'PREPARE',
        year: nextYear,
        month: nextMonth,
      }).catch(() => {});

      const nextPeriodName = `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(nextYear, nextMonth - 1, 1))} ${nextYear}`;
      return NextResponse.json({
        success: true,
        nextPeriod: { year: nextYear, month: nextMonth, periodName: nextPeriodName },
        message: `Payroll batch marked as Paid. Automatically advanced to ${nextPeriodName} Payroll Run.`,
      });
    }

    const result: any = await executeDashboardCommand(actor, 'payroll_action', {
      sub_action: 'SIGN_OFF',
      batchId: body.batchId,
      disbursementAssigneeId: body.disbursementAssigneeId || actor.id,
      paymentEntityId: body.paymentEntityId,
      comments: body.comments,
      password: body.password,
      disburseToWallets: body.disburseToWallets !== false,
    });

    if (result?.nextPeriod?.year && result?.nextPeriod?.month) {
      await executeDashboardCommand(actor, 'payroll_action', {
        sub_action: 'PREPARE',
        year: result.nextPeriod.year,
        month: result.nextPeriod.month,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      ...result,
      message: result?.nextPeriod
        ? `Salaries approved and credited to all ${result.employeeCount || ''} staff BEMS Wallets! App & email notifications sent. Advanced to ${result.nextPeriod.periodName}.`
        : 'Payroll approved and credited to staff BEMS Wallets.',
    });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
