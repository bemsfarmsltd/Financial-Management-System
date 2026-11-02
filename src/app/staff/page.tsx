import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { StaffDashboardClient } from '@/components/dashboard/staff/StaffDashboardClient';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const actor = await getAuthenticatedEmployee();

  // Redirect unauthenticated visitors to portal sign-in
  if (!actor) {
    redirect('/finance');
  }

  // Allow STAFF, as well as SUPER_ADMIN and GMD for administrative preview
  if (actor.role !== 'STAFF' && actor.role !== 'SUPER_ADMIN' && actor.role !== 'GMD') {
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
  const [assignment, subsidiaries, vendors, currentStaff] = await Promise.all([
    prisma.employeeAssignment.findFirst({
      where: { employeeId: actor.id },
      include: { subsidiary: true },
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

  if (assignment?.subsidiary) {
    businessName = assignment.subsidiary.legalName;
  }

  return (
    <StaffDashboardClient
      user={staffUser}
      businessName={businessName}
      subsidiaries={subsidiaries}
      vendors={vendors}
      currentStaff={currentStaff}
    />
  );
}
