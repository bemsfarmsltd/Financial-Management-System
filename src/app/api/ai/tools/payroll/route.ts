import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { stageAction } from '@/lib/staged-actions';
import { checkAiScopeOrResponse } from '@/lib/ai-access-control';

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

  // 0A. GET_PAYSLIP: Return detailed payslip & cost allocation breakdown for a specific itemId or employeeId
  if (action === 'GET_PAYSLIP' || action === 'PAYSLIP') {
    const itemId = url.searchParams.get('itemId') || url.searchParams.get('payrollItemId');
    const employeeId = url.searchParams.get('employeeId') || url.searchParams.get('employee_id');

    const item = itemId
      ? await prisma.payrollItem.findUnique({
          where: { id: itemId },
          include: {
            employee: true,
            allocations: { include: { subsidiary: { select: { id: true, legalName: true, code: true } } } },
            disbursement: { include: { receipt: true } },
            batch: { include: { period: true } },
          },
        })
      : employeeId
      ? await prisma.payrollItem.findFirst({
          where: {
            employeeId,
            batch: { period: { year, month } },
          },
          orderBy: { batch: { version: 'desc' } },
          include: {
            employee: true,
            allocations: { include: { subsidiary: { select: { id: true, legalName: true, code: true } } } },
            disbursement: { include: { receipt: true } },
            batch: { include: { period: true } },
          },
        })
      : null;

    if (!item) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: 'Payroll payslip item not found for the requested employee/period.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      payslip: {
        itemId: item.id,
        period: `${item.batch.period.year}-${String(item.batch.period.month).padStart(2, '0')}`,
        batchStatus: item.batch.status,
        employee: {
          id: item.employee.id,
          legalName: item.employee.legalName,
          employeeNumber: item.employee.employeeNumber,
          jobTitle: item.employee.jobTitle,
        },
        grossSalary: Number(item.grossMinor) / 100,
        formattedGross: formatNaira(item.grossMinor),
        deductions: Number(item.employeeDeductionsMinor) / 100,
        formattedDeductions: formatNaira(item.employeeDeductionsMinor),
        netPay: Number(item.netMinor) / 100,
        formattedNet: formatNaira(item.netMinor),
        status: item.status,
        allocations: item.allocations.map((a) => ({
          subsidiaryId: a.subsidiaryId,
          subsidiaryName: a.subsidiary.legalName,
          subsidiaryCode: a.subsidiary.code,
          percentage: a.percentage,
          amountNaira: Number(a.allocableCostMinor) / 100,
        })),
        disbursement: item.disbursement
          ? {
              id: item.disbursement.id,
              status: item.disbursement.status,
              externalReference: item.disbursement.externalReference,
              paidAt: item.disbursement.paidAt,
              hasReceipt: Boolean(item.disbursement.receipt),
            }
          : null,
      },
    });
  }

  // 0B. GET_INTERCOMPANY: Return payroll intercompany recharge notes for the period
  if (action === 'GET_INTERCOMPANY' || action === 'INTERCOMPANY_EFFECTS') {
    const period = await prisma.payrollPeriod.findFirst({ where: { year, month } });
    if (!period) {
      return NextResponse.json({ ok: true, year, month, notesCount: 0, notes: [] });
    }
    const notes = await prisma.intercompanyNote.findMany({
      where: { periodId: period.id },
      include: {
        sourceEntity: { select: { id: true, legalName: true, code: true } },
        targetEntity: { select: { id: true, legalName: true, code: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });
    return NextResponse.json({
      ok: true,
      year,
      month,
      periodId: period.id,
      notesCount: notes.length,
      notes: notes.map((n) => ({
        id: n.id,
        noteNumber: n.noteNumber,
        noteType: n.noteType,
        sourceEntity: n.sourceEntity.legalName,
        targetEntity: n.targetEntity.legalName,
        amountNaira: Number(n.totalAmountMinor) / 100,
        formattedAmount: formatNaira(n.totalAmountMinor),
        status: n.status,
        description: n.description,
      })),
    });
  }

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
  const targetScope =
    action === 'UPDATE_SALARY' || action === 'SALARY_CHANGE' || action === 'ADJUST_SALARY'
      ? 'salary'
      : 'payroll';
  const scopeBlocked = await checkAiScopeOrResponse(targetScope, 'write');
  if (scopeBlocked) return scopeBlocked;
  const now = new Date();
  const year = Number(body.year) || now.getFullYear();
  const month = Number(body.month) || now.getMonth() + 1;

  // -------------------------------------------------------------
  // ACTION 1: STAGE PREPARE PAYROLL BATCH
  // -------------------------------------------------------------
  if (action === 'PREPARE') {
    const periodLabel = `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month - 1, 1))} ${year}`;
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'payroll_action',
      summary: `Prepare / calculate monthly payroll batch for ${periodLabel}`,
      materialPayload: {
        sub_action: 'PREPARE',
        year,
        month,
      },
      preview: {
        action: 'PREPARE',
        period: periodLabel,
        year,
        month,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'PREPARE',
      message: `Payroll preparation for ${periodLabel} has been staged. Click the confirmation button to calculate and generate the payroll batch.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 2: STAGE SIGN OFF PAYROLL BATCH (GMD / Super Admin Approval)
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
    const paymentEntityId = (body.paymentEntityId || body.payerOrgId || batch.paymentEntityId || '').trim() || null;
    const disbursementAssigneeId = (body.disbursementAssigneeId || body.assigneeId || '').trim() || null;
    const periodLabel = `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month - 1, 1))} ${year}`;
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'payroll_action',
      targetSubsidiaryId: paymentEntityId || undefined,
      summary: `Sign off & lock payroll batch v${batch.version} for ${periodLabel} (Net: ${formatNaira(batch.totalNetMinor)})`,
      materialPayload: {
        sub_action: 'SIGN_OFF',
        year,
        month,
        batchId: batch.id,
        paymentEntityId,
        disbursementAssigneeId,
      },
      preview: {
        action: 'SIGN_OFF',
        period: periodLabel,
        batchId: batch.id,
        version: batch.version,
        totalGross: formatNaira(batch.totalGrossMinor),
        totalNet: formatNaira(batch.totalNetMinor),
        ...(paymentEntityId ? { paymentEntityId } : {}),
        ...(disbursementAssigneeId ? { disbursementAssigneeId } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'SIGN_OFF',
      message: `Payroll sign-off for ${periodLabel} (${formatNaira(batch.totalNetMinor)}) has been staged. Click the confirmation button to approve and lock the period.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 3: STAGE RECORD PAYOUT / DISBURSE
  // -------------------------------------------------------------
  if (action === 'RECORD_PAYOUT' || action === 'DISBURSE') {
    const itemId = body.itemId || body.payrollItemId;
    const batchId = body.batchId;
    const externalReference = (body.externalReference || body.reference || `PAY-AI-${Date.now()}`).trim();
    const bankName = (body.bankName || 'Corporate Treasury Bank').trim();

    if (!itemId && !batchId) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'Provide either itemId or batchId to stage payroll payout.' },
        { status: 400 }
      );
    }

    if (itemId) {
      const item = await prisma.payrollItem.findUnique({
        where: { id: itemId },
        include: { employee: true, batch: true },
      });
      if (!item) {
        return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: 'Payroll item not found.' }, { status: 404 });
      }

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'payroll_action',
        summary: `Record salary payout for ${item.employee.legalName} (${formatNaira(item.netMinor)})`,
        materialPayload: {
          sub_action: 'RECORD_PAYOUT',
          itemId: item.id,
          externalReference,
          bankName,
        },
        preview: {
          action: 'RECORD_PAYOUT',
          employee: item.employee.legalName,
          employeeNumber: item.employee.employeeNumber,
          netPay: formatNaira(item.netMinor),
          externalReference,
          bankName,
        },
      });

      return NextResponse.json({
        ok: true,
        status: 'AWAITING_CONFIRMATION',
        requires_gmd_action: true,
        action: 'RECORD_PAYOUT',
        message: `Salary disbursement recording for ${item.employee.legalName} (${formatNaira(item.netMinor)}) has been staged. Click the confirmation button to record the disbursement, debit treasury, and notify the recipient.`,
        staged_action_id: staged.staged_action_id,
        confirmation_hash: staged.confirmation_hash,
        confirmation_button: staged.confirmation_button,
        staged_action: staged.staged_action,
      });
    }

    const batch = await prisma.payrollBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: 'Payroll batch not found.' }, { status: 404 });
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'payroll_action',
      summary: `Record batch salary payout for batch v${batch.version} (${formatNaira(batch.totalNetMinor)})`,
      materialPayload: {
        sub_action: 'RECORD_PAYOUT',
        batchId: batch.id,
        externalReference,
        bankName,
      },
      preview: {
        action: 'RECORD_PAYOUT',
        batchId: batch.id,
        totalNet: formatNaira(batch.totalNetMinor),
        externalReference,
        bankName,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'RECORD_PAYOUT',
      message: `Batch salary payout for ${batch.id} (${formatNaira(batch.totalNetMinor)}) has been staged. Click the confirmation button to commit.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 4: ADJUST_SALARY (Staff base pay modification / cut)
  // -------------------------------------------------------------
  if (action === 'ADJUST_SALARY' || action === 'SALARY_CHANGE' || action === 'CHANGE_SALARY') {
    const employeeId = body.employeeId || body.employee_id;
    const amount = Number(body.amount || body.new_base_salary || 0);
    const effectiveDate = body.effectiveDate || body.effective_date;
    const reason = String(body.reason || 'Salary modification authorized by Executive').trim();

    if (!employeeId || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'employeeId and a positive numeric amount are required.' },
        { status: 400 }
      );
    }
    if (reason.length < 5) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'reason must be at least 5 characters.' },
        { status: 400 }
      );
    }

    const { inspectEmployeeCompensationContext } = await import('@/lib/services/compensation');
    let ctx;
    try {
      ctx = await inspectEmployeeCompensationContext(String(employeeId));
    } catch (err: any) {
      const msg = err?.message || 'Employee compensation lookup failed.';
      const status = msg.includes('not found') ? 404 : 409;
      return NextResponse.json({ ok: false, error_code: status === 404 ? 'NOT_FOUND' : 'PRECONDITION_FAILED', message: msg }, { status });
    }

    let parsedEffectiveDate = new Date();
    if (effectiveDate) {
      const d = new Date(effectiveDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error_code: 'INVALID_DATE', message: 'effectiveDate must be a valid date.' }, { status: 400 });
      }
      parsedEffectiveDate = d;
    }

    const deltaVal = amount - ctx.currentGrossNaira;
    const deltaFormatted =
      deltaVal > 0
        ? `+₦${deltaVal.toLocaleString()}`
        : deltaVal < 0
        ? `-₦${Math.abs(deltaVal).toLocaleString()}`
        : '₦0';

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'salary_change',
      summary: `Adjust monthly salary for ${ctx.employee.legalName} (${ctx.employee.employeeNumber}) from ₦${ctx.currentGrossNaira.toLocaleString()} to ₦${amount.toLocaleString()}`,
      targetEmployeeId: ctx.employee.id,
      targetSubsidiaryId: ctx.subsidiaryId,
      materialPayload: {
        employee_id: ctx.employee.id,
        subsidiary_id: ctx.subsidiaryId,
        change_type: ctx.currentGrossNaira === 0 ? 'INITIAL_SALARY' : deltaVal < 0 ? 'DEDUCTION' : 'ADDITION',
        amount,
        new_base_salary: amount,
        prior_base_salary: ctx.currentGrossNaira,
        effective_date: parsedEffectiveDate.toISOString(),
        reason,
        expected_comp_version: ctx.currentCompVersion,
      },
      preview: {
        employee_name: ctx.employee.legalName,
        employee_number: ctx.employee.employeeNumber,
        subsidiary: ctx.subsidiaryName,
        current_base_gross: `₦${ctx.currentGrossNaira.toLocaleString()}`,
        new_base_gross: `₦${amount.toLocaleString()}`,
        delta: deltaFormatted,
        effective_date: parsedEffectiveDate.toISOString().split('T')[0],
        affected_open_periods:
          ctx.affectedOpenPeriods.length > 0 ? ctx.affectedOpenPeriods.join(', ') : 'Next payroll cycle',
        reason,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'ADJUST_SALARY',
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      summary: staged.summary,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 5: REMOVE_ITEM (Remove staff item from open payroll batch)
  // -------------------------------------------------------------
  if (action === 'REMOVE_ITEM' || action === 'DELETE_ITEM') {
    const itemId = String(body.itemId || body.payrollItemId || '').trim();
    if (!itemId) {
      return NextResponse.json({ ok: false, error_code: 'MISSING_ITEM_ID', message: 'itemId is required.' }, { status: 400 });
    }
    const item = await prisma.payrollItem.findUnique({
      where: { id: itemId },
      include: { employee: true },
    });
    if (!item) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: 'Payroll item not found.' }, { status: 404 });
    }

    const mode = body.mode === 'PERMANENT' ? 'PERMANENT' : 'BATCH_ONLY';
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'payroll_action',
      summary: `Remove ${item.employee.legalName} from payroll batch (${mode})`,
      materialPayload: {
        sub_action: 'REMOVE_ITEM',
        itemId: item.id,
        mode,
        reason: body.reason || 'Removed from payroll batch',
      },
      preview: {
        action: 'REMOVE_ITEM',
        employee: item.employee.legalName,
        mode,
        net_amount: formatNaira(item.netMinor),
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'REMOVE_ITEM',
      ...staged,
    });
  }

  // -------------------------------------------------------------
  // ACTION 6: CONFIRM_RECEIPT (Confirm disbursement receipt)
  // -------------------------------------------------------------
  if (action === 'CONFIRM_RECEIPT') {
    const disbursementId = String(body.disbursementId || '').trim();
    if (!disbursementId) {
      return NextResponse.json({ ok: false, error_code: 'MISSING_DISBURSEMENT_ID', message: 'disbursementId is required.' }, { status: 400 });
    }
    const decision = String(body.decision || 'RECEIVED').toUpperCase();

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'payroll_action',
      summary: `Record Recipient Payment Confirmation (${decision}) for Disbursement ${disbursementId.slice(0, 8)}`,
      materialPayload: {
        sub_action: 'CONFIRM_RECEIPT',
        disbursementId,
        decision,
        note: body.note || null,
      },
      preview: {
        action: 'CONFIRM_RECEIPT',
        disbursementId,
        decision,
        note: body.note || 'Confirmed via BEMI',
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'CONFIRM_RECEIPT',
      ...staged,
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_ACTION', message: 'Action must be PREPARE, SIGN_OFF, RECORD_PAYOUT, ADJUST_SALARY, REMOVE_ITEM, or CONFIRM_RECEIPT.' },
    { status: 400 }
  );
}
