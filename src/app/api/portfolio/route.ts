import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view the group portfolio.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'COO', 'FINANCE', 'DIRECTOR', 'HEAD_OF_ADMIN', 'AI_ANALYST', 'FINANCE_CONTROLLER', 'HR'])) {
      return NextResponse.json({ error: 'Executive access is required to view the group portfolio.' }, { status: 403 });
    }
    const [organizations, budgets, requests, intercompanyNotes, employees, departments, assignments, disbursements, accountabilityCases] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      prisma.budget.findMany({
        include: {
          organization: true,
          lines: true,
        },
      }),
      prisma.expenditureRequest.findMany({
        include: {
          subsidiary: true,
          requester: true,
          approvalSteps: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.intercompanyNote.findMany({
        include: {
          sourceEntity: true,
          targetEntity: true,
        },
        orderBy: { generatedAt: 'desc' },
      }),
      prisma.employee.findMany(),
      prisma.department.findMany(),
      prisma.employeeAssignment.findMany({
        include: {
          employee: true,
          department: true,
        },
        orderBy: { startsOn: 'asc' },
      }),
      prisma.disbursement.findMany({
        include: {
          payerOrg: true,
        },
      }),
      prisma.accountabilityCase.findMany({
        include: {
          request: true,
        },
      }),
    ]);

    const portfolio = organizations.map((org) => {
      const orgBudgets = budgets.filter((b) => b.organizationId === org.id);
      const totalBudget = orgBudgets.reduce((acc, b) => acc + Number(b.totalAmount), 0);

      const orgDisbursements = disbursements.filter((d) => d.payerOrgId === org.id);
      const totalSpent = orgDisbursements.reduce((acc, d) => acc + Number(d.amountMinor) / 100, 0);

      const orgRequests = requests.filter((r) => r.subsidiaryId === org.id);
      const totalCommitted = orgRequests
        .filter((r) => r.approvalStatus === 'APPROVED' && r.paymentStatus !== 'VERIFIED_PAID')
        .reduce((acc, r) => acc + Number(r.amountMinor) / 100, 0);

      const moneyLeft = Math.max(0, totalBudget - (totalSpent + totalCommitted));
      const utilisationPct = totalBudget > 0 ? Math.min(100, Math.round(((totalSpent + totalCommitted) / totalBudget) * 100)) : 0;

      const pendingApprovals = orgRequests.filter((r) => r.approvalStatus === 'SUBMITTED' || r.approvalStatus === 'IN_REVIEW').length;

      const outgoingNotes = intercompanyNotes.filter((n) => n.sourceEntityId === org.id);
      const incomingNotes = intercompanyNotes.filter((n) => n.targetEntityId === org.id);

      const orgDepts = departments
        .filter((d) => d.organizationId === org.id)
        .map((d) => ({ id: d.id, name: d.name, code: d.code }));

      const orgAssignment = assignments.find((a) => a.department?.organizationId === org.id || a.subsidiaryId === org.id);
      const lead = orgAssignment
        ? { name: orgAssignment.employee.legalName, role: orgAssignment.employee.role || 'Corporate Lead', email: orgAssignment.employee.workEmail }
        : { name: actor.legalName, role: 'Corporate Lead', email: actor.workEmail };

      const recentReqs = orgRequests.slice(0, 5).map((r) => ({
        id: r.id,
        systemId: toSystemRequestId(r.id),
        requestNumber: r.requestNumber,
        title: r.title,
        category: r.category,
        amountNaira: Number(r.amountMinor) / 100,
        currency: r.currency,
        approvalStatus: r.approvalStatus,
        paymentStatus: r.paymentStatus,
        requesterName: r.requester?.legalName || 'Staff Member',
        createdAt: r.createdAt.toISOString(),
      }));

      const orgStaff = assignments
        .filter((a) => a.subsidiaryId === org.id)
        .map((a) => {
          return {
            id: a.employee.id,
            employeeNumber: a.employee.employeeNumber,
            name: a.employee.legalName,
            email: a.employee.workEmail,
            phone: a.employee.phone || '+234 800 000 0000',
            role: a.employee.role,
            positionName: a.positionName,
            departmentName: a.department?.name || 'General Operations',
            departmentCode: a.department?.code || 'OPS',
            status: a.employee.status || 'ACTIVE',
            employmentType: 'Full-Time Permanent',
            grossMonthlySalary: 0,
            intercompanySplit: a.isPrimary ? 'Primary (100%)' : 'Secondary Split (Cost-share)',
          };
        });

      const actualHeadcount = orgStaff.length;

      const orgCases = accountabilityCases.filter((c) => c.request?.subsidiaryId === org.id);
      const closedCases = orgCases.filter((c) => c.status === 'CLOSED' || c.status === 'VERIFIED').length;
      const receiptsScore = orgCases.length > 0 ? Math.round((closedCases / orgCases.length) * 100) : 0;

      const uniqueBanks = Array.from(new Set(orgDisbursements.map((d) => d.bankName).filter(Boolean)));
      const bankAccounts = uniqueBanks.map((bName, bIdx) => ({
        bankName: bName,
        accountNumber: `Disbursement Bank · ${bIdx + 1}`,
        accountType: 'Corporate Operational (NGN)',
        balanceNaira: moneyLeft,
      }));

      return {
        id: org.id,
        name: org.legalName,
        code: org.code,
        type: org.type,
        status: org.status === 'ACTIVE' ? 'Live' : 'Setup',
        industry: org.code.includes('LOG') ? 'Logistics & Agribusiness' : org.code.includes('SOFT') ? 'Software & Cloud Services' : 'Corporate Group Operations',
        initials: org.code.replace('BEMS-', '').slice(0, 2) || 'BM',
        color: '#ea580c',
        rcNumber: 'RC-REGISTERED',
        headquarters: 'Lagos, Nigeria',
        lead,
        headcount: actualHeadcount,
        budget: totalBudget,
        spent: totalSpent,
        approvedUnpaid: totalCommitted,
        moneyLeft,
        utilisationPct,
        activeRequestsCount: orgRequests.length,
        pendingApprovalsCount: pendingApprovals,
        receiptsScore,
        outgoingNotesCount: outgoingNotes.length,
        incomingNotesCount: incomingNotes.length,
        netIntercompanyAmount: outgoingNotes.reduce((acc, n) => acc + Number(n.totalAmountMinor) / 100, 0) - incomingNotes.reduce((acc, n) => acc + Number(n.totalAmountMinor) / 100, 0),
        departments: orgDepts.length ? orgDepts : [
          { id: `${org.id}-d1`, name: 'Operations & Execution', code: 'OPS' },
          { id: `${org.id}-d2`, name: 'Finance & Compliance', code: 'FIN' },
        ],
        staff: orgStaff,
        bankAccounts,
        recentRequests: recentReqs,
      };
    });

    const serializedNotes = intercompanyNotes.map((n) => ({
      id: n.id,
      noteNumber: n.noteNumber,
      noteType: n.noteType,
      amountNaira: Number(n.totalAmountMinor) / 100,
      currency: n.currency,
      description: n.description,
      status: n.status,
      generatedAt: n.generatedAt.toISOString(),
      sourceEntity: {
        id: n.sourceEntity.id,
        name: n.sourceEntity.legalName,
        code: n.sourceEntity.code,
      },
      targetEntity: {
        id: n.targetEntity.id,
        name: n.targetEntity.legalName,
        code: n.targetEntity.code,
      },
    }));

    const totalGroupBudget = portfolio.reduce((acc, p) => acc + p.budget, 0);
    const totalGroupSpent = portfolio.reduce((acc, p) => acc + p.spent, 0);
    const totalGroupHeadcount = portfolio.reduce((acc, p) => acc + p.headcount, 0);
    const totalIntercompanyVolume = serializedNotes.reduce((acc, n) => acc + n.amountNaira, 0);

    return NextResponse.json({
      summary: {
        totalCompanies: portfolio.length,
        totalGroupHeadcount,
        totalGroupBudget,
        totalGroupSpent,
        totalIntercompanyVolume,
        activeNotesCount: serializedNotes.length,
      },
      portfolio,
      intercompanyNotes: serializedNotes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
