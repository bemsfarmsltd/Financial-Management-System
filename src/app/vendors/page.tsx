import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { VendorsClient } from './VendorsClient';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const actor = await getAuthenticatedEmployee();
  if (!actor) {
    redirect('/?redirect=/vendors');
  }

  const isExecutive = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);

  const vendors = await prisma.vendor.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      category: true,
      rating: true,
      createdAt: true,
      ...(isExecutive
        ? {
            taxId: true,
            contactEmail: true,
            contactPhone: true,
            bankName: true,
            accountNumber: true,
            accountName: true,
            notes: true,
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  });

  const projectedVendors = vendors.map((v: any) => ({
    id: v.id,
    name: v.name,
    code: v.code,
    category: v.category,
    rating: v.rating,
    taxId: isExecutive ? v.taxId || null : null,
    contactEmail: isExecutive ? v.contactEmail || null : null,
    contactPhone: isExecutive ? v.contactPhone || null : null,
    bankName: isExecutive ? v.bankName || null : null,
    accountNumber: isExecutive ? v.accountNumber || null : null,
    accountName: isExecutive ? v.accountName || null : null,
    notes: isExecutive ? v.notes || null : null,
    createdAt: v.createdAt.toISOString(),
  }));

  const initialRole = actor.role === 'GMD' ? 'GMD' : isExecutive ? 'SystemAdmin' : 'Staff';

  return (
    <ConnectAppShell initialRole={initialRole}>
      <VendorsClient initialVendors={projectedVendors} />
    </ConnectAppShell>
  );
}
