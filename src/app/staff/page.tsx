import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { StaffDashboardClient } from '@/components/dashboard/staff/StaffDashboardClient';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const actor = await getAuthenticatedEmployee();

  // Enforce mandatory authentication: redirect unauthenticated visitors to login
  if (!actor) {
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
