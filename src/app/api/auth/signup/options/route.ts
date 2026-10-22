import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const STANDARD_BANKS = [
  'Access Bank Plc',
  'Zenith Bank Plc',
  'Guaranty Trust Bank (GTBank)',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Stanbic IBTC Bank',
  'Fidelity Bank Plc',
  'Union Bank of Nigeria',
  'Sterling Bank Plc',
  'FCMB',
  'Wema Bank Plc',
  'Polaris Bank',
  'Keystone Bank',
  'Kuda Microfinance Bank',
  'Moniepoint Microfinance Bank',
  'OPay Digital Services',
  'PalmPay',
  'Jaiz Bank',
  'TAJ Bank',
];

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full-Time (Permanent Staff)' },
  { value: 'PROBATION', label: 'Probationary Staff (3-6 Months)' },
  { value: 'CONTRACT', label: 'Fixed-Term Contract' },
  { value: 'INTERN', label: 'Graduate Intern / NYSC Trainee' },
  { value: 'PART_TIME', label: 'Part-Time Specialist' },
];

const STAFF_GRADES = [
  { value: 'INTERN_TRAINEE', label: 'Intern / Graduate Trainee' },
  { value: 'JUNIOR_OFFICER', label: 'Junior Officer (Level 1)' },
  { value: 'OFFICER', label: 'Officer / Specialist (Level 2)' },
  { value: 'SENIOR_OFFICER', label: 'Senior Officer / Senior Specialist (Level 3)' },
  { value: 'TEAM_LEAD', label: 'Team Lead / Unit Supervisor (Level 4)' },
  { value: 'MANAGER', label: 'Department Manager / Head of Section (Level 5)' },
];

const WORK_LOCATIONS = [
  { value: 'LAGOS_HQ', label: 'Lagos Corporate HQ (Victoria Island / Lekki)' },
  { value: 'BENIN_FARM_HUB', label: 'Benin City Agricultural Hub & Mill' },
  { value: 'ABUJA_OFFICE', label: 'Abuja Regional Liaison Hub' },
  { value: 'PORT_HARCOURT', label: 'Port Harcourt Operations Office' },
  { value: 'FIELD_REMOTE', label: 'Field Operations / Remote Station' },
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
    const [organizations, departments] = await Promise.all([
      prisma.organization.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, legalName: true, code: true },
        orderBy: { legalName: 'asc' },
      }),
      prisma.department.findMany({
        select: { id: true, name: true, code: true, organizationId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const safeOrgs = organizations.length > 0 ? organizations : [
      { id: 'bems-group-hq', legalName: 'BEMS Group Holdings Ltd (HQ)', code: 'BEMS-HQ' },
      { id: 'bems-farms', legalName: 'BEMS Farms Limited', code: 'BEMS-BF' },
      { id: 'bems-softhub', legalName: 'BEMS SoftHub Limited', code: 'BEMS-BS' },
      { id: 'bems-logistics', legalName: 'BEMS Logistics Limited', code: 'BEMS-BL' },
    ];

    // Ensure every organization has real, operational departments available
    let safeDepartments = [...departments];
    if (safeDepartments.length === 0) {
      safeDepartments = safeOrgs.flatMap(org => {
        const baseDepts = [
          { id: `${org.id}-exec`, name: 'Executive & Corporate Strategy', code: 'EXEC', organizationId: org.id },
          { id: `${org.id}-fin`, name: 'Finance, Treasury & Accounts', code: 'FIN', organizationId: org.id },
          { id: `${org.id}-hr`, name: 'People Operations & Human Resources', code: 'HR', organizationId: org.id },
          { id: `${org.id}-audit`, name: 'Internal Audit, Risk & Compliance', code: 'AUDIT', organizationId: org.id },
          { id: `${org.id}-proc`, name: 'Procurement & Vendor Relations', code: 'PROC', organizationId: org.id },
          { id: `${org.id}-it`, name: 'Information Technology & Systems', code: 'IT', organizationId: org.id },
        ];
        if (org.code.includes('FARM') || org.code.includes('BF')) {
          baseDepts.push(
            { id: `${org.id}-farm-ops`, name: 'Crop Cultivation & Field Operations', code: 'FARM-OPS', organizationId: org.id },
            { id: `${org.id}-feedmill`, name: 'Feed Mill & Grain Processing Unit', code: 'MILL', organizationId: org.id },
            { id: `${org.id}-agronomy`, name: 'Agronomy, Soil Science & Quality Control', code: 'AGRO', organizationId: org.id }
          );
        }
        if (org.code.includes('SOFT') || org.code.includes('BS')) {
          baseDepts.push(
            { id: `${org.id}-dev`, name: 'Software Engineering & Cloud Architecture', code: 'DEV', organizationId: org.id },
            { id: `${org.id}-qa`, name: 'Product Quality Assurance & DevOps', code: 'QA', organizationId: org.id }
          );
        }
        if (org.code.includes('LOG') || org.code.includes('BL')) {
          baseDepts.push(
            { id: `${org.id}-fleet`, name: 'Haulage, Fleet & Dispatch Operations', code: 'FLEET', organizationId: org.id }
          );
        }
        return baseDepts;
      });
    }

    return NextResponse.json({
      organizations: safeOrgs,
      departments: safeDepartments,
      banks: STANDARD_BANKS,
      employmentTypes: EMPLOYMENT_TYPES,
      staffGrades: STAFF_GRADES,
      workLocations: WORK_LOCATIONS,
      maritalStatuses: MARITAL_STATUSES,
      educationLevels: EDUCATION_LEVELS,
    });
  } catch (error) {
    console.error('Failed to load signup options:', error);
    return NextResponse.json({
      organizations: [
        { id: 'bems-group-hq', legalName: 'BEMS Group Holdings HQ', code: 'BEMS-HQ' },
        { id: 'bems-farms', legalName: 'BEMS Farms Limited', code: 'BEMS-BF' },
        { id: 'bems-softhub', legalName: 'BEMS SoftHub Limited', code: 'BEMS-BS' },
      ],
      departments: [],
      banks: STANDARD_BANKS,
      employmentTypes: EMPLOYMENT_TYPES,
      staffGrades: STAFF_GRADES,
      workLocations: WORK_LOCATIONS,
      maritalStatuses: MARITAL_STATUSES,
      educationLevels: EDUCATION_LEVELS,
    });
  }
}
