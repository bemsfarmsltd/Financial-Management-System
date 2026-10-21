import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { StaffDashboardClient } from '@/components/dashboard/staff/StaffDashboardClient';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const actor = await getAuthenticatedEmployee();

  // Strictly enforce role-based access control: only registered, approved STAFF can access /staff
  if (!actor || actor.role !== 'STAFF') {
    redirect('/');
  }

  const staffUser = {
    id: actor.id,
    fullName: actor.legalName,
    email: actor.workEmail,
    role: actor.role,
    employeeNumber: actor.employeeNumber,
    phone: actor.phone,
  };

  let businessName = 'BEMS Group';
  const assignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId: actor.id },
    include: { subsidiary: true },
  });
  if (assignment?.subsidiary) {
    businessName = assignment.subsidiary.legalName;
  }

  return (
    <ConnectAppShell initialRole="Staff">
      <StaffDashboardClient user={staffUser} businessName={businessName} />
    </ConnectAppShell>
  );
}
