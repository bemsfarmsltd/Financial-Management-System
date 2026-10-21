import React from 'react';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { StaffDashboardClient } from '@/components/dashboard/staff/StaffDashboardClient';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const actor = await getAuthenticatedEmployee();

  let staffUser = actor
    ? {
        id: actor.id,
        fullName: actor.legalName,
        email: actor.workEmail,
        role: actor.role,
        employeeNumber: actor.employeeNumber,
        phone: actor.phone,
      }
    : null;

  let businessName = 'BEMS Group';

  if (!staffUser) {
    // If not logged in or in dev preview, fetch a staff member from the database
    const sampleStaff = await prisma.employee.findFirst({
      where: { role: 'STAFF' },
      include: {
        assignments: {
          include: { subsidiary: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (sampleStaff) {
      staffUser = {
        id: sampleStaff.id,
        fullName: sampleStaff.legalName,
        email: sampleStaff.workEmail,
        role: sampleStaff.role,
        employeeNumber: sampleStaff.employeeNumber,
        phone: sampleStaff.phone,
      };
      if (sampleStaff.assignments[0]?.subsidiary) {
        businessName = sampleStaff.assignments[0].subsidiary.legalName;
      }
    } else {
      // Safe fallback
      staffUser = {
        id: 'staff-default',
        fullName: 'Staff Requester',
        email: 'staff@bemsfarms.com',
        role: 'STAFF',
        employeeNumber: 'BEMS-STF-001',
        phone: '+234 800 000 0000',
      };
    }
  } else {
    // Look up primary subsidiary for logged in actor
    const assignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: staffUser.id },
      include: { subsidiary: true },
    });
    if (assignment?.subsidiary) {
      businessName = assignment.subsidiary.legalName;
    }
  }

  return (
    <ConnectAppShell initialRole="Staff">
      <StaffDashboardClient user={staffUser} businessName={businessName} />
    </ConnectAppShell>
  );
}
