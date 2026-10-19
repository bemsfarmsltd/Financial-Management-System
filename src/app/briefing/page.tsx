import React from 'react';
import { prisma } from '@/lib/prisma';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { ExecutiveBriefingClient } from './ExecutiveBriefingClient';

export const dynamic = 'force-dynamic';

export default async function ExecutiveBriefingPage() {
  const [organizations, requests, budgets, accountabilityCases, disbursements] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { legalName: 'asc' }
    }),
    prisma.expenditureRequest.findMany({
      include: {
        subsidiary: true,
        requester: true,
        approvalSteps: true,
        disbursements: true,
        accountabilityCase: true,
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.budget.findMany({
      include: {
        organization: true,
        lines: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.accountabilityCase.findMany({
      include: {
        request: {
          include: {
            subsidiary: true,
            requester: true,
          }
        }
      },
      orderBy: { dueAt: 'asc' }
    }),
    prisma.disbursement.findMany({
      include: {
        payerOrg: true,
        recordedBy: true,
        verification: true,
      },
      orderBy: { paidAt: 'desc' }
    })
  ]);

  // Safe serialization for BigInt and dates
  const serializedOrganizations = organizations.map(o => ({
    id: o.id,
    legalName: o.legalName,
    code: o.code,
    type: o.type,
    status: o.status,
    currency: o.defaultCurrency,
  }));

  const serializedRequests = requests.map(r => ({
    id: r.id,
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
    },
    approvalSteps: r.approvalSteps.map(s => ({
      id: s.id,
      stageIndex: s.stageIndex,
      assignedRole: s.assignedRole,
      status: s.status,
      approverName: s.approverName,
      decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null,
      decisionReason: s.decisionReason,
    })),
  }));

  const serializedBudgets = budgets.map(b => ({
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
    lines: b.lines.map(l => ({
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

  const serializedAccountabilityCases = accountabilityCases.map(c => ({
    id: c.id,
    status: c.status,
    requiredDeliverables: c.requiredDeliverables,
    dueAt: c.dueAt.toISOString(),
    closureNotes: c.closureNotes,
    request: {
      id: c.request.id,
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

  const serializedDisbursements = disbursements.map(d => ({
    id: d.id,
    amountNaira: Number(d.amountMinor) / 100,
    externalReference: d.externalReference,
    bankName: d.bankName,
    paidAt: d.paidAt.toISOString(),
    status: d.status,
    payerOrg: {
      legalName: d.payerOrg.legalName,
      code: d.payerOrg.code,
    },
  }));

  return (
    <ConnectAppShell>
      <ExecutiveBriefingClient
        organizations={serializedOrganizations}
        requests={serializedRequests}
        budgets={serializedBudgets}
        accountabilityCases={serializedAccountabilityCases}
        disbursements={serializedDisbursements}
      />
    </ConnectAppShell>
  );
}
