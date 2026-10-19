import React from 'react';
import { prisma } from '@/lib/prisma';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { VendorsClient } from './VendorsClient';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <ConnectAppShell>
      <VendorsClient initialVendors={JSON.parse(JSON.stringify(vendors))} />
    </ConnectAppShell>
  );
}
