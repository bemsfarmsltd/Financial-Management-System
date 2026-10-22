import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { createHash } from 'node:crypto';

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
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'HR'])) return NextResponse.json({ error: 'HR or executive access is required to view payroll.' }, { status: 403 });
    const requestedYear = req.nextUrl.searchParams.get('year');
    const requestedMonth = req.nextUrl.searchParams.get('month');
    const year = requestedYear ? Number(requestedYear) : null;
    const month = requestedMonth ? Number(requestedMonth) : null;
    const period = await prisma.payrollPeriod.findFirst({
      where: Number.isInteger(year) && year! > 0 && Number.isInteger(month) && month! >= 1 && month! <= 12
        ? { year: year!, month: month! }
        : {},
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        batches: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          include: {
            items: {
              include: {
                employee: { select: { id: true, legalName: true, role: true, workEmail: true } },
                allocations: true,
                disbursement: { include: { receipt: true, recipientConfirmation: true } }
              }
            }
          }
        }
      }
    });

    if (!period || period.batches.length === 0) {
      return NextResponse.json({ error: 'No payroll batch has been prepared for this period.' }, { status: 404 });
    }

    const batch = period.batches[0];

    const totalGross = batch.items.reduce((sum, item) => sum + Number(item.grossMinor), 0);
    const totalNet = batch.items.reduce((sum, item) => sum + Number(item.netMinor), 0);
    const totalDeductions = batch.items.reduce((sum, item) => sum + Number(item.employeeDeductionsMinor), 0);
    const allocationTotals = new Map<string, { name: string; amount: number; percentage: number }>();
    const subsidiaryIds = [...new Set(batch.items.flatMap(item => item.allocations.map(allocation => allocation.subsidiaryId)))];
    const subsidiaries = subsidiaryIds.length ? await prisma.organization.findMany({ where: { id: { in: subsidiaryIds } }, select: { id: true, legalName: true } }) : [];
    const subsidiaryNames = new Map(subsidiaries.map(subsidiary => [subsidiary.id, subsidiary.legalName]));

    const safeItems = batch.items.map(item => ({
      id: item.id,
      employeeId: item.employee.id,
      employeeName: item.employee.legalName,
      role: item.employee.role,
      email: item.employee.workEmail,
      grossMinor: Number(item.grossMinor),
      grossFormatted: formatNaira(item.grossMinor),
      deductionsMinor: Number(item.employeeDeductionsMinor),
      deductionsFormatted: formatNaira(item.employeeDeductionsMinor),
      employerPensionFormatted: formatNaira(item.employerCostMinor),
      netMinor: Number(item.netMinor),
      netFormatted: formatNaira(item.netMinor),
      status: item.status,
      paymentStatus: item.disbursement?.status || 'UNPAID',
      paymentId: item.disbursement?.id || null,
      paymentReceiptName: item.disbursement?.receipt?.fileName || null,
      paymentReceiptUrl: item.disbursement?.receipt?.fileUrl || null,
      recipientDecision: item.disbursement?.recipientConfirmation?.decision || null,
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
    }));

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
        disbursementAssignee: batch.disbursementAssigneeId ? await prisma.employee.findUnique({ where: { id: batch.disbursementAssigneeId }, select: { id: true, legalName: true, role: true } }) : null,
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
      permissions: {
        canApprove: hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD']),
        canRecordPayments: hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD']) || batch.disbursementAssigneeId === actor.id
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
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the System Admin or GMD can approve payroll.' }, { status: 403 });
    const body = await req.json();
    const { batchId, comments, disbursementAssigneeId } = body;

    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    const batch = await prisma.payrollBatch.findUnique({
      where: { id: batchId },
      include: { period: true, items: { include: { employee: { select: { legalName: true, workEmail: true } }, allocations: true } } }
    });

    if (!batch) {
      return NextResponse.json({ error: 'Payroll batch not found' }, { status: 404 });
    }

    if (batch.status !== 'SUBMITTED') {
      return NextResponse.json({ error: 'Only a submitted payroll batch can be signed off.' }, { status: 409 });
    }
    if (!batch.items.length) return NextResponse.json({ error: 'The payroll batch has no staff items.' }, { status: 409 });
    if (typeof disbursementAssigneeId !== 'string' || !disbursementAssigneeId) {
      return NextResponse.json({ error: 'Assign an executive to record the external payroll payments.' }, { status: 400 });
    }
    const assignee = await prisma.employee.findFirst({ where: {
      id: disbursementAssigneeId,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      role: { in: ['SYSTEM_ADMIN', 'GMD', 'COO', 'FINANCE'] }
    } });
    if (!assignee) return NextResponse.json({ error: 'Choose an active Finance or executive user for payment recording.' }, { status: 400 });
    const snapshot = JSON.stringify(batch.items.map(item => ({
      employeeId: item.employeeId,
      grossMinor: item.grossMinor.toString(),
      deductionsMinor: item.employeeDeductionsMinor.toString(),
      employerCostMinor: item.employerCostMinor.toString(),
      netMinor: item.netMinor.toString(),
      allocations: item.allocations.map(a => ({ subsidiaryId: a.subsidiaryId, amountMinor: a.allocableCostMinor.toString(), percentage: a.percentage }))
    })));
    const snapshotHash = createHash('sha256').update(snapshot).digest('hex');
    const updatedBatch = await prisma.$transaction(async tx => {
      const updated = await tx.payrollBatch.update({
        where: { id: batchId },
        data: { status: 'APPROVED', approvedAt: new Date(), snapshotHash, disbursementAssigneeId: assignee.id }
      });
      await tx.payrollPeriod.update({ where: { id: batch.periodId }, data: { lockStatus: 'LOCKED' } });
      return updated;
    });

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: batch.paymentEntityId || 'HQ',
        targetType: 'PAYROLL',
        targetId: batchId,
        action: 'APPROVED',
        correlationId: `CORR-PAY-${batchId}`,
        metadata: JSON.stringify({
          period: `${batch.period.year}-${batch.period.month}`,
          totalGrossMinor: Number(batch.totalGrossMinor),
          comments: comments || `${batch.period.year}-${String(batch.period.month).padStart(2, '0')} payroll approved for external payment processing.`,
          snapshotHash,
          employeeCount: batch.items.length,
          disbursementAssigneeId: assignee.id
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `${batch.period.year}-${String(batch.period.month).padStart(2, '0')} payroll batch approved by ${actor.legalName}.`,
      approvedAt: updatedBatch.approvedAt
    });
  } catch (error: any) {
    console.error('Error approving payroll:', error);
    return NextResponse.json({ error: error.message || 'Failed to approve payroll' }, { status: 500 });
  }
}
