import React from 'react';
import { prisma } from '@/lib/prisma';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { AccountabilityClient } from './AccountabilityClient';

export const dynamic = 'force-dynamic';

export default async function AccountabilityPage() {
  const accountabilityCases = await prisma.accountabilityCase.findMany({
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
