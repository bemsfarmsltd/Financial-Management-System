import React from 'react';
import { prisma } from '@/lib/prisma';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { RequestsInventoryClient } from './RequestsInventoryClient';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const requests = await prisma.expenditureRequest.findMany({
    include: {
      subsidiary: true,
      requester: true,
      channel: true,
    },
    orderBy: { createdAt: 'desc' }
  });

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
      <RequestsInventoryClient requests={rows} />
    </ConnectAppShell>
  );
}
