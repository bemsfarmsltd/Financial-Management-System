import { PrismaClient } from '@prisma/client';

export interface StreamlinedDepartmentSpec {
  name: string;
  codeSuffix: string;
}

export const STREAMLINED_DEPARTMENTS: StreamlinedDepartmentSpec[] = [
  { name: 'Executive Management & Leadership', codeSuffix: 'EXEC' },
  { name: 'Software Development & Engineering', codeSuffix: 'ENG' },
  { name: 'Product & Creative Design', codeSuffix: 'DESIGN' },
  { name: 'Media, Studio & Content Production', codeSuffix: 'MEDIA' },
  { name: 'Product Management & Data / AI', codeSuffix: 'PROD-AI' },
  { name: 'Sales, Marketing & Growth', codeSuffix: 'SALES-MKT' },
  { name: 'Customer Support & Client Relations', codeSuffix: 'SUPPORT' },
  { name: 'Operations, Logistics & Supply Chain', codeSuffix: 'OPS-LOG' },
  { name: 'Agribusiness & Farm Production', codeSuffix: 'AGRO-PROD' },
  { name: 'Training, Academy & Faculty', codeSuffix: 'ACADEMY' },
  { name: 'Finance, Treasury & Accounts', codeSuffix: 'FINANCE' },
  { name: 'People (HR) & Administration', codeSuffix: 'HR-ADMIN' },
  { name: 'Facilities, Security & Support', codeSuffix: 'FACILITIES' },
];

export const STREAMLINED_STAFF_GRADES = [
  { value: 'Intern / NYSC / Trainee (Level 1)', label: 'Intern / NYSC / Trainee (Level 1)' },
  { value: 'Support / Field Assistant (Level 2)', label: 'Support / Field Assistant (Level 2)' },
  { value: 'Junior Staff / Associate (Level 3)', label: 'Junior Staff / Associate (Level 3)' },
  { value: 'Mid-Level Specialist / Officer (Level 4)', label: 'Mid-Level Specialist / Officer (Level 4)' },
  { value: 'Senior Specialist (Level 5)', label: 'Senior Specialist (Level 5)' },
  { value: 'Team Lead / Supervisor (Level 6)', label: 'Team Lead / Supervisor (Level 6)' },
  { value: 'Manager / Head of Department (Level 7)', label: 'Manager / Head of Department (Level 7)' },
  { value: 'C-Suite / Executive Director (Level 8)', label: 'C-Suite / Executive Director (Level 8)' },
];

const STREAMLINED_NAME_ORDER = new Map(
  STREAMLINED_DEPARTMENTS.map((d, idx) => [d.name.toLowerCase(), idx])
);

/**
 * Ensures all 13 streamlined departments exist for every active organization
 * and returns only the canonical 13 departments per organization in exact order.
 */
export async function getOrganizationsWithStreamlinedDepartments(prisma: PrismaClient) {
  const orgs = await prisma.organization.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      code: true,
      legalName: true,
      type: true,
      departments: {
        select: {
          id: true,
          name: true,
          code: true,
          organizationId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const missingToCreate: { organizationId: string; name: string; code: string }[] = [];

  for (const org of orgs) {
    const existingLowerNames = new Set(org.departments.map((d) => d.name.trim().toLowerCase()));
    for (const spec of STREAMLINED_DEPARTMENTS) {
      if (!existingLowerNames.has(spec.name.toLowerCase())) {
        missingToCreate.push({
          organizationId: org.id,
          name: spec.name,
          code: `${org.code}-${spec.codeSuffix}`,
        });
      }
    }
  }

  if (missingToCreate.length > 0) {
    await prisma.department.createMany({
      data: missingToCreate,
    });
  }

  // Re-fetch only if we inserted new departments
  const finalOrgs =
    missingToCreate.length > 0
      ? await prisma.organization.findMany({
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            code: true,
            legalName: true,
            type: true,
            departments: {
              select: {
                id: true,
                name: true,
                code: true,
                organizationId: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        })
      : orgs;

  return finalOrgs.map((org) => {
    const seen = new Set<string>();
    const streamlinedDepts = org.departments
      .filter((d) => {
        const key = d.name.trim().toLowerCase();
        if (!STREAMLINED_NAME_ORDER.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (a, b) =>
          (STREAMLINED_NAME_ORDER.get(a.name.trim().toLowerCase()) ?? 999) -
          (STREAMLINED_NAME_ORDER.get(b.name.trim().toLowerCase()) ?? 999)
      );

    return {
      ...org,
      departments: streamlinedDepts,
    };
  });
}

