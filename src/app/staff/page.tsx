import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { resolveOrganizationBranding } from '@/lib/subsidiary-branding';
import { StaffDashboardClient } from '@/components/dashboard/staff/StaffDashboardClient';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const actor = await getAuthenticatedEmployee();

  // Redirect unauthenticated visitors to portal sign-in
  if (!actor) {
    redirect('/?redirect=/staff');
  }

  // Allow STAFF, as well as SUPER_ADMIN and GMD for administrative preview
  if (actor.role !== 'STAFF' && actor.role !== 'SUPER_ADMIN' && actor.role !== 'GMD') {
    redirect('/');
  }

  let businessName = 'Staff Workspace';
  const [assignment, subsidiaries, vendors, currentStaff] = await Promise.all([
    prisma.employeeAssignment.findFirst({
      where: { employeeId: actor.id },
      orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
      include: {
        subsidiary: {
          include: {
            settings: {
              where: { key: { in: ['BRAND_COLOR', 'BRAND_LOGO_URL'] } },
            },
          },
        },
        department: true,
      },
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
        gender: true,
        dateOfBirth: true,
        residentialAddress: true,
        cityState: true,
        jobTitle: true,
        employmentType: true,
        resumptionDate: true,
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
        nextOfKinName: true,
        nextOfKinPhone: true,
        nextOfKinRelationship: true,
        nextOfKinAddress: true,
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
  const staffPosition = primaryAssignment?.positionName || currentStaff?.jobTitle || 'Staff Personnel';

  const branding = resolveOrganizationBranding(assignment?.subsidiary);
  businessName = branding.subsidiaryName;

  const staffUser = {
    id: actor.id,
    ...branding,
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
    workLocation: currentStaff?.workLocation || 'Oyo Logistics & Farm Hub',
    staffGrade: currentStaff?.staffGrade || 'Level 06 - Operational Specialist',
    employmentType: currentStaff?.employmentType || 'FULL_TIME',
    resumptionDate: currentStaff?.resumptionDate ? new Date(currentStaff.resumptionDate).toISOString().split('T')[0] : '2026-10-28',
    gender: currentStaff?.gender || 'FEMALE',
    dateOfBirth: currentStaff?.dateOfBirth || '2002-05-12',
    residentialAddress: currentStaff?.residentialAddress || 'Oyo Central Base',
    cityState: currentStaff?.cityState || 'Oyo State',
    maritalStatus: currentStaff?.maritalStatus || 'SINGLE',
    stateOfOrigin: currentStaff?.stateOfOrigin || 'Oyo State',
    lga: currentStaff?.lga || 'Ibadan North',
    nextOfKinName: currentStaff?.nextOfKinName || '',
    nextOfKinPhone: currentStaff?.nextOfKinPhone || '',
    nextOfKinRelationship: currentStaff?.nextOfKinRelationship || '',
    nextOfKinAddress: currentStaff?.nextOfKinAddress || '',
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
