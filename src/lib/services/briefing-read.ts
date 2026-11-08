import { prisma } from '@/lib/prisma';
import { AuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import { toSystemRequestId } from '@/lib/request-id';

export async function loadAuthorizedExecutiveBriefing(
  actor: AuthenticatedEmployee | null | undefined,
  requestedOrgId?: string | null
) {
  if (!actor) {
    return {
      authorized: false as const,
      status: 401 as const,
      error: 'Sign in to view the executive briefing.',
    };
  }

  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return {
      authorized: false as const,
      status: 403 as const,
      error: 'Executive access is required.',
    };
  }

  const scope = await resolveAuthorizedOrganizationScope(actor, requestedOrgId || 'ALL');
  const orgFilter = scope.isGroup ? {} : { id: { in: scope.organizationIds } };
  const subFilter = scope.isGroup ? {} : { subsidiaryId: { in: scope.organizationIds } };
  const budgetOrgFilter = scope.isGroup ? {} : { organizationId: { in: scope.organizationIds } };
  const payerOrgFilter = scope.isGroup ? {} : { payerOrgId: { in: scope.organizationIds } };

  const [organizations, requests, budgets, accountabilityCases, disbursements, rawBankAccounts] =
    await Promise.all([
      prisma.organization.findMany({
        where: orgFilter,
        orderBy: { legalName: 'asc' },
      }),
      prisma.expenditureRequest.findMany({
        where: subFilter,
        include: {
          subsidiary: true,
          requester: true,
          approvalSteps: true,
          disbursements: true,
          accountabilityCase: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
      prisma.budget.findMany({
        where: budgetOrgFilter,
        include: {
          organization: true,
          lines: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.accountabilityCase.findMany({
        where: scope.isGroup
          ? {}
          : {
              request: {
                subsidiaryId: { in: scope.organizationIds },
              },
            },
        include: {
          request: {
            include: {
              subsidiary: true,
              requester: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
        take: 100,
      }),
      prisma.disbursement.findMany({
        where: payerOrgFilter,
        include: {
          payerOrg: true,
          recordedBy: true,
          verification: true,
        },
        orderBy: { paidAt: 'desc' },
        take: 100,
      }),
      prisma.companyBankAccount.findMany({
        where: {
          status: 'ACTIVE',
          ...budgetOrgFilter,
        },
        include: { organization: true },
        orderBy: { balance: 'desc' },
      }),
    ]);

  const treasuryAccounts = rawBankAccounts.map((a) => {
    const balNum = Number(a.balance);
    const limitNum = Number(a.dailyLimit);
    return {
      id: a.id,
      bankName: a.bankName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      accountType: a.accountType,
      currency: a.currency,
      balance: balNum,
      balanceNaira: balNum,
      dailyLimit: limitNum,
      scope:
        a.organization?.code === 'BEMS-LOG'
          ? 'LOG'
          : a.organization?.code === 'BEMS-SOFT'
          ? 'SOFT'
          : 'HQ',
      assignedSubsidiary: a.organization?.legalName || 'BEMS Group',
      organization: {
        id: a.organization.id,
        legalName: a.organization.legalName,
        code: a.organization.code,
      },
    };
  });

  const serializedOrganizations = organizations.map((o) => ({
    id: o.id,
    legalName: o.legalName,
    code: o.code,
    type: o.type,
    status: o.status,
    currency: o.defaultCurrency,
  }));

  const serializedRequests = requests.map((r) => ({
    id: r.id,
    systemId: toSystemRequestId(r.id),
    requestNumber: r.requestNumber,
    title: r.title,
    justification: r.justification,
    deliverable: r.deliverable,
    category: r.category,
    requestType: r.requestType,
    amountMinor: r.amountMinor.toString(),
    amountNaira: Number(r.amountMinor) / 100,
    currency: r.currency,
    approvalStatus: r.approvalStatus,
    paymentStatus: r.paymentStatus,
    accountabilityStatus: r.accountabilityStatus,
    createdAt: r.createdAt.toISOString(),
    neededBy: r.neededBy.toISOString(),
    subsidiary: {
      id: r.subsidiary.id,
      legalName: r.subsidiary.legalName,
      code: r.subsidiary.code,
    },
    requester: {
      id: r.requester.id,
      legalName: r.requester.legalName,
      role: r.requester.role,
      workEmail: r.requester.workEmail,
      bankName: r.requester.bankName || r.requester.salaryBankName || null,
      accountNumber: r.requester.accountNumber || r.requester.salaryAccountNumber || null,
      accountName:
        r.requester.accountName || r.requester.salaryAccountName || r.requester.legalName,
    },
    approvalSteps: r.approvalSteps.map((s) => ({
      id: s.id,
      stageIndex: s.stageIndex,
      assignedRole: s.assignedRole,
      status: s.status,
      approverName: s.approverName,
      decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null,
      decisionReason: s.decisionReason,
    })),
  }));

  const serializedBudgets = budgets.map((b) => ({
    id: b.id,
    organizationId: b.organizationId,
    fiscalYear: b.fiscalYear,
    fiscalPeriod: b.fiscalPeriod,
    periodName: b.periodName,
    totalAmount: b.totalAmount,
    committedAmount: b.committedAmount,
    spentAmount: b.spentAmount,
    status: b.status,
    warningThreshold: b.warningThreshold,
    organization: {
      id: b.organization.id,
      legalName: b.organization.legalName,
      code: b.organization.code,
    },
    lines: b.lines.map((l) => ({
      id: l.id,
      departmentName: l.departmentName,
      category: l.category,
      expenseType: l.expenseType,
      allocatedAmount: l.allocatedAmount,
      committedAmount: l.committedAmount,
      spentAmount: l.spentAmount,
      status: l.status,
    })),
  }));

  const serializedAccountabilityCases = accountabilityCases.map((c) => ({
    id: c.id,
    status: c.status,
    requiredDeliverables: c.requiredDeliverables,
    dueAt: c.dueAt.toISOString(),
    closureNotes: c.closureNotes,
    request: {
      id: c.request.id,
      systemId: toSystemRequestId(c.request.id),
      requestNumber: c.request.requestNumber,
      title: c.request.title,
      amountNaira: Number(c.request.amountMinor) / 100,
      currency: c.request.currency,
      subsidiary: {
        legalName: c.request.subsidiary.legalName,
        code: c.request.subsidiary.code,
      },
      requester: {
        legalName: c.request.requester.legalName,
        role: c.request.requester.role,
      },
    },
  }));

  const serializedDisbursements = disbursements.map((d) => ({
    id: d.id,
    amountNaira: Number(d.amountMinor) / 100,
    currency: d.currency,
    externalReference: d.externalReference,
    bankName: d.bankName,
    paidAt: d.paidAt.toISOString(),
    status: d.status,
    payerOrg: {
      legalName: d.payerOrg.legalName,
      code: d.payerOrg.code,
    },
  }));

  return {
    authorized: true as const,
    status: 200 as const,
    data: {
      organizations: serializedOrganizations,
      requests: serializedRequests,
      budgets: serializedBudgets,
      accountabilityCases: serializedAccountabilityCases,
      disbursements: serializedDisbursements,
      treasuryAccounts,
    },
  };
}

