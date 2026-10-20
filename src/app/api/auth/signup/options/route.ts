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
  { value: 'PROBATION', label: 'Probationary Period' },
  { value: 'CONTRACT', label: 'Fixed-Term Contract' },
  { value: 'INTERN', label: 'Intern / NYSC Trainee' },
  { value: 'PART_TIME', label: 'Part-Time Associate' },
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

    // Fallback if no subsidiaries exist yet
    const safeOrgs = organizations.length > 0 ? organizations : [
      { id: 'bems-group-hq', legalName: 'BEMS Group Holdings HQ', code: 'BEMS-HQ' },
      { id: 'bems-farms', legalName: 'BEMS Farms Limited', code: 'BEMS-BF' },
      { id: 'bems-softhub', legalName: 'BEMS SoftHub Limited', code: 'BEMS-BS' },
      { id: 'bems-logistics', legalName: 'BEMS Logistics Limited', code: 'BEMS-BL' },
    ];

    return NextResponse.json({
      organizations: safeOrgs,
      departments,
      banks: STANDARD_BANKS,
      employmentTypes: EMPLOYMENT_TYPES,
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
    });
  }
}
