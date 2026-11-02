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

  let businessName = 'BEMS Group';
  const [assignment, subsidiaries, vendors, currentStaff] = await Promise.all([
    prisma.employeeAssignment.findFirst({
      where: { employeeId: actor.id },
      include: { subsidiary: true, department: true },
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
        phone: true,
        avatarUrl: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        salaryBankName: true,
        salaryAccountNumber: true,
        salaryAccountName: true,
        workLocation: true,
        staffGrade: true,
        maritalStatus: true,
        stateOfOrigin: true,
        lga: true,
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

  const primaryAssignment: any = currentStaff?.assignments?.find((a: any) => a.isPrimary) || currentStaff?.assignments?.[0] || assignment;
  const staffSubsidiary = primaryAssignment?.subsidiary?.legalName || businessName;
  const staffDepartment = primaryAssignment?.department?.name || 'General Operations';
  const staffPosition = primaryAssignment?.positionName || 'Staff Personnel';

  const staffUser = {
    id: actor.id,
    fullName: actor.legalName,
    email: actor.workEmail,
    role: actor.role,
    employeeNumber: actor.employeeNumber,
    phone: actor.phone || currentStaff?.phone || '',
    avatarUrl: actor.avatarUrl || currentStaff?.avatarUrl || '',
    bankName: currentStaff?.bankName || '',
    accountNumber: currentStaff?.accountNumber || '',
    accountName: currentStaff?.accountName || actor.legalName,
    salaryBankName: currentStaff?.salaryBankName || currentStaff?.bankName || '',
    salaryAccountNumber: currentStaff?.salaryAccountNumber || currentStaff?.accountNumber || '',
    salaryAccountName: currentStaff?.salaryAccountName || actor.legalName,
    jobTitle: staffPosition,
    department: staffDepartment,
    subsidiary: staffSubsidiary,
    workLocation: currentStaff?.workLocation || 'LAGOS_HQ',
    staffGrade: currentStaff?.staffGrade || 'OFFICER',
  };

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
