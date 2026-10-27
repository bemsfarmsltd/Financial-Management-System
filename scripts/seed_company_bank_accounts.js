const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding official CompanyBankAccount records into PostgreSQL...');

  const hqOrg = await prisma.organization.findFirst({ where: { code: 'BEMS-GROUP' } });
  const logOrg = await prisma.organization.findFirst({ where: { code: 'BEMS-LOG' } });

  if (!hqOrg || !logOrg) {
    throw new Error('Required organizations not found!');
  }

  // Clear existing to avoid duplicates
  await prisma.companyBankAccount.deleteMany({});

  const accounts = [
    {
      organizationId: hqOrg.id,
      bankName: 'Access Bank PLC',
      accountName: 'BEMS Group Holdings Corporate Treasury',
      accountNumber: '0128471920',
      accountType: 'Corporate Operational',
      currency: 'NGN',
      balance: 48250000.00,
      dailyLimit: 50000000.00,
      tier: 'Primary Maker-Checker',
      status: 'ACTIVE',
    },
    {
      organizationId: logOrg.id,
      bankName: 'Zenith Bank PLC',
      accountName: 'Bems Logistics Feed Mill & Agribusiness Escrow',
      accountNumber: '1014829103',
      accountType: 'Corporate Escrow',
      currency: 'NGN',
      balance: 26800000.00,
      dailyLimit: 30000000.00,
      tier: 'Primary Maker-Checker',
      status: 'ACTIVE',
    },
    {
      organizationId: logOrg.id,
      bankName: 'Guaranty Trust Bank',
      accountName: 'Bems Logistics Fleet & Haulage Float',
      accountNumber: '0239104821',
      accountType: 'Operational Float',
      currency: 'NGN',
      balance: 9150000.00,
      dailyLimit: 15000000.00,
      tier: 'Primary Maker-Checker',
      status: 'ACTIVE',
    },
  ];

  for (const acc of accounts) {
    const created = await prisma.companyBankAccount.create({ data: acc });
    console.log(`✓ Created: ${created.bankName} (${created.accountNumber}) - ₦${Number(created.balance).toLocaleString()}`);
  }

  const all = await prisma.companyBankAccount.findMany({
    include: { organization: true }
  });

  const total = all.reduce((sum, a) => sum + Number(a.balance), 0);
  console.log(`\nSUCCESS: 3 official bank accounts seeded. Total Liquid Cash: ₦${total.toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
