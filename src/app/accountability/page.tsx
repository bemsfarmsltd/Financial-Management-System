import React from 'react';
import { prisma } from '@/lib/prisma';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { AccountabilityClient } from './AccountabilityClient';

import { redirect } from 'next/navigation';
import { getAuthenticatedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AccountabilityPage() {
  const actor = await getAuthenticatedEmployee();
  if (!actor) {
    redirect('/');
  }

  const isStaff = actor.role === 'STAFF';
  const accountabilityCases = await prisma.accountabilityCase.findMany({
    where: isStaff ? { OR: [{ ownerUserId: actor.id }, { request: { requestedById: actor.id } }] } : undefined,
    include: {
      request: {
        include: {
          subsidiary: true,
          requester: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const safeCases = JSON.parse(
    JSON.stringify(accountabilityCases, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
  );

  return (
    <ConnectAppShell>
      <AccountabilityClient initialCases={safeCases} />
    </ConnectAppShell>
  );
}
