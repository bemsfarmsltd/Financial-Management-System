import React from 'react';
import { prisma } from '@/lib/prisma';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { RequestsInventoryClient } from './RequestsInventoryClient';
import { toSystemRequestId } from '@/lib/request-id';

import { redirect } from 'next/navigation';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const actor = await getAuthenticatedEmployee();
  if (!actor) {
    redirect('/');
  }

  const isStaff = actor.role === 'STAFF';
  const [requests, subsidiaries, vendors, currentStaff] = await Promise.all([
    prisma.expenditureRequest.findMany({
      where: isStaff ? { requestedById: actor.id } : undefined,
      include: {
        subsidiary: true,
        requester: true,
        channel: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { legalName: 'asc' },
      select: { id: true, legalName: true, code: true, type: true },
    }),
    prisma.vendor.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category: true, bankName: true, accountNumber: true, accountName: true },
    }),
    prisma.employee.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        legalName: true,
        workEmail: true,
        employeeNumber: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        assignments: {
          where: { status: 'ACTIVE' },
          select: {
            subsidiaryId: true,
            departmentId: true,
            positionName: true,
            isPrimary: true,
            subsidiary: { select: { id: true, legalName: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const rows = requests.map((request) => ({
    id: request.id,
    systemId: toSystemRequestId(request.id),
    requestNumber: request.requestNumber,
    title: request.title,
    requestType: request.requestType,
    category: request.category,
    subsidiaryName: request.subsidiary.legalName,
    requesterName: request.requester.legalName,
    requesterEmail: request.requester.workEmail,
    amountMinor: String(request.amountMinor),
    currency: request.currency,
    approvalStatus: request.approvalStatus,
    paymentStatus: request.paymentStatus,
    accountabilityStatus: request.accountabilityStatus,
    createdAt: request.createdAt.toISOString(),
  }));

  return (
    <ConnectAppShell>
      <RequestsInventoryClient
        requests={rows}
        subsidiaries={subsidiaries}
        vendors={vendors}
        currentStaff={currentStaff}
      />
    </ConnectAppShell>
  );
}
