import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  resolveHrContext,
  logHrAudit,
  serializeBigInt,
  canUseSubFilter,
} from '@/lib/hrRouteHelper';

export async function GET(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { orgWhere, allowedSubIds, useSubFilter } = ctx;

    const [batches, deductions, loans, staffOptions] = await Promise.all([
      prisma.payrollBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          period: true,
          items: {
            where: useSubFilter
              ? {
                  employee: {
                    assignments: {
                      some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' },
                    },
                  },
                }
              : undefined,
            include: {
              employee: {
                select: {
                  id: true,
                  employeeNumber: true,
                  legalName: true,
                  jobTitle: true,
                },
              },
            },
          },
        },
      }),
      prisma.payrollDeductionAdjustment.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          employee: { select: { id: true, employeeNumber: true, legalName: true } },
          organization: { select: { id: true, legalName: true, code: true } },
        },
      }),
      prisma.employeeLoan.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          employee: { select: { id: true, employeeNumber: true, legalName: true } },
          organization: { select: { id: true, legalName: true, code: true } },
        },
      }),
      prisma.employee.findMany({
        where: {
          role: 'STAFF',
          status: 'ACTIVE',
          ...(useSubFilter
            ? {
                assignments: {
                  some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' },
                },
              }
            : {}),
        },
        orderBy: { legalName: 'asc' },
        select: {
          id: true,
          employeeNumber: true,
          legalName: true,
          assignments: {
            where: { status: 'ACTIVE' },
            select: { subsidiaryId: true },
            take: 1,
          },
        },
      }),
    ]);

    return NextResponse.json(
      serializeBigInt({
        success: true,
        batches,
        deductions,
        loans,
        staffOptions,
      })
    );
  } catch (error) {
    console.error('HR Payroll GET error:', error);
    return NextResponse.json({ error: 'Failed to load payroll data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { actor, hrScope, defaultOrgId } = ctx;

    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'PROPOSE_DEDUCTION') {
      const employeeId = String(body.employeeId || '');
      const amountNaira = Number(body.amountNaira || 0);
      const category = String(body.category || 'OTHER');
      const direction = String(body.direction || 'DEDUCTION');
      const reason = String(body.reason || '').trim();
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!employeeId || !reason || amountNaira <= 0) {
        return NextResponse.json({ error: 'Employee, positive amount, and reason are required.' }, { status: 400 });
      }
      if (!canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden for selected subsidiary.' }, { status: 403 });
      }

      const created = await prisma.payrollDeductionAdjustment.create({
        data: {
          organizationId,
          employeeId,
          category,
          direction,
          amountMinor: BigInt(Math.round(amountNaira * 100)),
          reason,
          status: 'PROPOSED',
          proposedById: actor.id,
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || organizationId,
        subsidiaryId: organizationId,
        targetType: 'PAYROLL',
        targetId: created.id,
        action: 'CREATED',
        metadata: { kind: 'DEDUCTION_ADJUSTMENT', category, direction, amountMinor: created.amountMinor.toString() },
      });

      return NextResponse.json(serializeBigInt({ success: true, record: created }));
    }

    if (action === 'REVIEW_DEDUCTION') {
      const id = String(body.id || '');
      const decision = String(body.decision || ''); // APPROVED | REJECTED | DISPUTED
      const disputeNote = body.disputeNote ? String(body.disputeNote) : undefined;
      if (!id || !['APPROVED', 'REJECTED', 'DISPUTED'].includes(decision)) {
        return NextResponse.json({ error: 'Invalid deduction review request.' }, { status: 400 });
      }

      const existing = await prisma.payrollDeductionAdjustment.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
      if (!canUseSubFilter(hrScope, existing.organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }
      if (decision === 'APPROVED' && existing.proposedById === actor.id && actor.role !== 'GMD') {
        return NextResponse.json({ error: 'Self-approval is not permitted.' }, { status: 403 });
      }

      const updated = await prisma.payrollDeductionAdjustment.update({
        where: { id },
        data: {
          status: decision,
          disputeNote: disputeNote ?? existing.disputeNote,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || existing.organizationId,
        subsidiaryId: existing.organizationId,
        targetType: 'PAYROLL',
        targetId: id,
        action: decision,
      });

      return NextResponse.json(serializeBigInt({ success: true, record: updated }));
    }

    if (action === 'CREATE_LOAN') {
      const employeeId = String(body.employeeId || '');
      const loanType = String(body.loanType || 'SALARY_ADVANCE');
      const principalNaira = Number(body.principalNaira || 0);
      const tenureMonths = Math.max(1, Number(body.tenureMonths || 1));
      const reason = String(body.reason || '').trim();
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!employeeId || !reason || principalNaira <= 0) {
        return NextResponse.json({ error: 'Employee, positive principal, and reason are required.' }, { status: 400 });
      }
      if (!canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden for selected subsidiary.' }, { status: 403 });
      }

      const principalMinor = BigInt(Math.round(principalNaira * 100));
      const monthlyInstallmentMinor = BigInt(Math.ceil(Number(principalMinor) / tenureMonths));

      const created = await prisma.employeeLoan.create({
        data: {
          organizationId,
          employeeId,
          loanType,
          principalMinor,
          monthlyInstallmentMinor,
          remainingBalanceMinor: principalMinor,
          tenureMonths,
          reason,
          status: 'PENDING',
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || organizationId,
        subsidiaryId: organizationId,
        targetType: 'PAYROLL',
        targetId: created.id,
        action: 'CREATED',
        metadata: { kind: 'EMPLOYEE_LOAN', loanType, tenureMonths },
      });

      return NextResponse.json(serializeBigInt({ success: true, record: created }));
    }

    if (action === 'REVIEW_LOAN') {
      const id = String(body.id || '');
      const decision = String(body.decision || ''); // APPROVED | ACTIVE | COMPLETED | REJECTED
      if (!id || !['APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED'].includes(decision)) {
        return NextResponse.json({ error: 'Invalid loan decision.' }, { status: 400 });
      }

      const existing = await prisma.employeeLoan.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Loan not found.' }, { status: 404 });
      if (!canUseSubFilter(hrScope, existing.organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const updated = await prisma.employeeLoan.update({
        where: { id },
        data: {
          status: decision,
          approvedById: actor.id,
          disbursedAt: decision === 'ACTIVE' ? new Date() : existing.disbursedAt,
          remainingBalanceMinor: decision === 'COMPLETED' ? BigInt(0) : existing.remainingBalanceMinor,
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || existing.organizationId,
        subsidiaryId: existing.organizationId,
        targetType: 'PAYROLL',
        targetId: id,
        action: decision,
      });

      return NextResponse.json(serializeBigInt({ success: true, record: updated }));
    }

    return NextResponse.json({ error: 'Unsupported payroll action.' }, { status: 400 });
  } catch (error) {
    console.error('HR Payroll POST error:', error);
    return NextResponse.json({ error: 'Failed to process payroll action' }, { status: 500 });
  }
}

