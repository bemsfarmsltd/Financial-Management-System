import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STANDARD_NIGERIAN_BANKS } from '@/lib/monnify';
import {
  getOrganizationsWithStreamlinedDepartments,
  STREAMLINED_STAFF_GRADES,
} from '@/lib/enterpriseStructure';

export const dynamic = 'force-dynamic';

const WORK_LOCATIONS = [
  { value: 'UMUAHIA_OPS_HUB', label: 'Umuahia Operations Center (Abia State)' },
  { value: 'OWERRI_OPS_HUB', label: 'Owerri Operations Center (Imo State)' },
  { value: 'EDO_BENIN_OPS_HUB', label: 'Benin City / Edo State Operations Hub' },
  { value: 'BEMS_GROUP_HQ', label: 'BEMS Corporate Headquarters (Executive Center)' },
];

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full-Time (Permanent Staff)' },
  { value: 'PROBATION', label: 'Probationary Staff (3-6 Months)' },
  { value: 'CONTRACT', label: 'Fixed-Term Contract' },
  { value: 'INTERN', label: 'Graduate Intern / NYSC Trainee' },
  { value: 'PART_TIME', label: 'Part-Time Specialist' },
];

const MARITAL_STATUSES = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' },
];

const EDUCATION_LEVELS = [
  { value: 'BSC', label: "Bachelor's Degree (B.Sc / B.Tech / B.A)" },
  { value: 'HND', label: 'Higher National Diploma (HND)' },
  { value: 'OND', label: 'Ordinary National Diploma (OND / NCE)' },
  { value: 'MSC', label: "Master's Degree (M.Sc / MBA / M.Tech)" },
  { value: 'PHD', label: 'Doctorate (Ph.D)' },
  { value: 'SSCE', label: 'Secondary School Certificate (SSCE / WAEC)' },
];

export async function GET() {
  try {
    const orgsWithDepts = await getOrganizationsWithStreamlinedDepartments(prisma);

    const organizations = orgsWithDepts.map((org) => ({
      id: org.id,
      legalName: org.legalName,
      code: org.code,
    }));

    const departments = orgsWithDepts.flatMap((org) =>
      org.departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        organizationId: d.organizationId,
      }))
    );

    const bankList = STANDARD_NIGERIAN_BANKS.map((b) => b.name);

    return NextResponse.json({
      organizations,
      departments,
      banks: bankList,
      employmentTypes: EMPLOYMENT_TYPES,
      staffGrades: STREAMLINED_STAFF_GRADES,
      workLocations: WORK_LOCATIONS,
      maritalStatuses: MARITAL_STATUSES,
      educationLevels: EDUCATION_LEVELS,
    });
  } catch (error) {
    console.error('Failed to load signup options:', error);
    return NextResponse.json(
      {
        organizations: [],
        departments: [],
        banks: STANDARD_NIGERIAN_BANKS.map((b) => b.name),
        employmentTypes: EMPLOYMENT_TYPES,
        staffGrades: STREAMLINED_STAFF_GRADES,
        workLocations: WORK_LOCATIONS,
        maritalStatuses: MARITAL_STATUSES,
        educationLevels: EDUCATION_LEVELS,
      },
      { status: 500 }
    );
  }
}
