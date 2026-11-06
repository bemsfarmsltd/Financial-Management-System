import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number): string {
  const naira = Number(minor) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(naira);
}

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Executive authority required to view payroll data.' },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const action = (url.searchParams.get('action') || 'LIST').toUpperCase();
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
  const month = Number(url.searchParams.get('month')) || new Date().getMonth() + 1;

  // 1. GET_ITEMS: Return line items for a specific month/year
  if (action === 'GET_ITEMS') {
    const period = await prisma.payrollPeriod.findFirst({
      where: { year, month },
      include: {
        batches: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          include: {
            items: {
              include: {
                employee: {
                  select: {
                    id: true,
                    legalName: true,
                    employeeNumber: true,
                    role: true,
                    bankName: true,
                    accountNumber: true,
                    accountName: true,
                    salaryBankName: true,
                    salaryAccountNumber: true,
                    salaryAccountName: true,
                  },
                },
                disbursement: true,
              },
            },
          },
        },
      },
    });

    if (!period || !period.batches.length) {
      return NextResponse.json({
        ok: true,
        year,
        month,
        status: 'NOT_PREPARED',
        message: `Payroll for ${month}/${year} has not been prepared yet. Use action "PREPARE" to calculate.`,
        items: [],
      });
    }

    const batch = period.batches[0];
    const items = batch.items.map((item) => {
      const gross = Number(item.grossMinor) / 100;
      const deductions = Number(item.employeeDeductionsMinor) / 100;
      const net = Number(item.netMinor) / 100;
      const bank = item.employee.salaryAccountNumber
        ? {
            bankName: item.employee.salaryBankName || item.employee.bankName,
            accountNumber: item.employee.salaryAccountNumber,
            accountName: item.employee.salaryAccountName || item.employee.accountName,
          }
        : {
            bankName: item.employee.bankName || 'Not Set',
            accountNumber: item.employee.accountNumber || 'Not Set',
            accountName: item.employee.accountName || item.employee.legalName,
          };

      return {
        itemId: item.id,
        employeeId: item.employee.id,
        legalName: item.employee.legalName,
        employeeNumber: item.employee.employeeNumber,
        grossSalary: gross,
        formattedGross: `₦${gross.toLocaleString()}`,
        deductions,
        formattedDeductions: `₦${deductions.toLocaleString()}`,
        netPay: net,
        formattedNet: `₦${net.toLocaleString()}`,
        status: item.status,
        isDisbursed: Boolean(item.disbursement),
        disbursedAt: item.disbursement?.paidAt || null,
        bankDetails: bank,
      };
    });

    return NextResponse.json({
      ok: true,
      period: {
        year,
        month,
        periodName: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month - 1, 1))} ${year}`,
        batchId: batch.id,
        batchVersion: batch.version,
        batchStatus: batch.status,
        totalGross: formatNaira(batch.totalGrossMinor),
        totalDeductions: formatNaira(batch.totalGrossMinor - batch.totalNetMinor),
        totalNet: formatNaira(batch.totalNetMinor),
        totalEmployees: items.length,
      },
      items,
    });
  }

  // 2. Default LIST: Return historical and open periods
  const periods = await prisma.payrollPeriod.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {
      batches: {
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: {
          id: true,
          version: true,
          status: true,
          totalGrossMinor: true,
          totalNetMinor: true,
          approvedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    totalPeriods: periods.length,
    periods: periods.map((p) => {
      const b = p.batches[0];
      return {
        id: p.id,
        year: p.year,
        month: p.month,
        periodName: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(p.year, p.month - 1, 1))} ${p.year}`,
        lockStatus: p.lockStatus,
        batchStatus: b?.status || 'NOT_PREPARED',
        batchVersion: b?.version || 1,
        totalGross: b ? formatNaira(b.totalGrossMinor) : '₦0',
        totalDeductions: b ? formatNaira(b.totalGrossMinor - b.totalNetMinor) : '₦0',
        totalNet: b ? formatNaira(b.totalNetMinor) : '₦0',
        approvedAt: b?.approvedAt || null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Executive authority required to execute payroll actions.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = (body.action || 'PREPARE').toUpperCase().trim();
  const now = new Date();
  const year = Number(body.year) || now.getFullYear();
  const month = Number(body.month) || now.getMonth() + 1;

  // -------------------------------------------------------------
  // ACTION 1: PREPARE PAYROLL BATCH WITH ATTENDANCE DEDUCTIONS
  // -------------------------------------------------------------
  if (action === 'PREPARE') {
    // Forward internally to the full prepare engine
    const prepareUrl = new URL('/api/payroll/prepare', req.url);
    const prepareRes = await fetch(prepareUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('authorization') || '',
        'x-api-key': req.headers.get('x-api-key') || '',
        cookie: req.headers.get('cookie') || '',
      },
      body: JSON.stringify({ year, month }),
    });

    const data = await prepareRes.json();
    return NextResponse.json({
      ok: prepareRes.ok,
      action: 'PREPARE',
      ...data,
    }, { status: prepareRes.status });
  }

  // -------------------------------------------------------------
  // ACTION 2: SIGN OFF PAYROLL BATCH (GMD / Super Admin Approval)
  // -------------------------------------------------------------
  if (action === 'SIGN_OFF' || action === 'APPROVE') {
    const period = await prisma.payrollPeriod.findFirst({
      where: { year, month },
      include: {
        batches: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    if (!period || !period.batches.length) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `No prepared payroll batch found for ${month}/${year}.` },
        { status: 404 }
      );
    }

    const batch = period.batches[0];
    const updated = await prisma.payrollBatch.update({
      where: { id: batch.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    // Also close/lock the period
    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { lockStatus: 'LOCKED' },
    });

    return NextResponse.json({
      ok: true,
      action: 'SIGN_OFF',
      message: `Payroll batch for ${month}/${year} approved for disbursement by ${actor.legalName}.`,
      batch: {
        id: updated.id,
        status: updated.status,
        version: updated.version,
        totalNet: formatNaira(updated.totalNetMinor),
        approvedAt: updated.approvedAt,
      },
    });
  }

  // -------------------------------------------------------------
  // ACTION 3: RECORD PAYOUT / DISBURSE
  // -------------------------------------------------------------
  if (action === 'RECORD_PAYOUT' || action === 'DISBURSE') {
    const itemId = body.itemId || body.payrollItemId;
    const batchId = body.batchId;

    if (itemId) {
      // Mark single item as disbursed
      const item = await prisma.payrollItem.findUnique({
        where: { id: itemId },
        include: { employee: true },
      });

      if (!item) {
        return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: 'Payroll item not found.' }, { status: 404 });
      }

      await prisma.payrollItem.update({
        where: { id: itemId },
        data: { status: 'PAID' },
      });

      return NextResponse.json({
        ok: true,
        action: 'RECORD_PAYOUT',
        message: `Salary disbursement recorded for ${item.employee.legalName} (${formatNaira(item.netMinor)}).`,
      });
    }

    if (batchId) {
      // Mark entire batch as paid
      await prisma.payrollItem.updateMany({
        where: { batchId },
        data: { status: 'PAID' },
      });

      await prisma.payrollBatch.update({
        where: { id: batchId },
        data: { status: 'PAID' },
      });

      return NextResponse.json({
        ok: true,
        action: 'RECORD_PAYOUT',
        message: `Entire payroll batch ${batchId} marked as disbursed.`,
      });
    }

    return NextResponse.json(
      { ok: false, error_code: 'VALIDATION_FAILED', message: 'Provide either itemId or batchId to record payout.' },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------
  // ACTION 4: ADJUST_SALARY (Staff base pay modification / cut)
  // -------------------------------------------------------------
  if (action === 'ADJUST_SALARY' || action === 'SALARY_CHANGE' || action === 'CHANGE_SALARY') {
    const employeeId = body.employeeId || body.employee_id;
    const amount = Number(body.amount || body.new_base_salary || 0);
    const effectiveDate = body.effectiveDate || body.effective_date;
    const reason = body.reason || 'Salary modification authorized by Executive';

    if (!employeeId || isNaN(amount)) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'employeeId and valid numeric amount are required.' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: 'Employee not found.' }, { status: 404 });
    }

    // Stage the salary change action
    const { stageAction } = await import('@/lib/staged-actions');
    const staged = await stageAction({
      actorId: actor.id,
      actionType: 'salary_change',
      summary: `Adjust monthly salary for ${employee.legalName} to ₦${amount.toLocaleString()} effective ${effectiveDate || 'Immediately'}`,
      targetEmployeeId: employee.id,
      materialPayload: {
        employee_id: employee.id,
        amount,
        effective_date: effectiveDate,
        reason,
      },
      clientPreview: {
        employee_name: employee.legalName,
        employee_number: employee.employeeNumber,
        new_base_gross: `₦${amount.toLocaleString()}`,
        effective_date: effectiveDate || 'Immediate',
        reason,
      },
    });

    return NextResponse.json({
      ok: true,
      action: 'ADJUST_SALARY',
      staged_action_id: staged.id,
      confirmation_hash: staged.confirmationHash,
      summary: staged.summary,
      staged_action: {
        type: 'salary_change',
        cardType: 'STAGED_ACTION',
        staged_action_id: staged.id,
        confirmation_hash: staged.confirmationHash,
        summary: staged.summary,
        action_type: 'salary_change',
        payload_preview: {
          employee_name: employee.legalName,
          amount: `₦${amount.toLocaleString()}`,
          effective_date: effectiveDate,
          reason,
        },
      },
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_ACTION', message: 'Action must be PREPARE, SIGN_OFF, RECORD_PAYOUT, or ADJUST_SALARY.' },
    { status: 400 }
  );
}
