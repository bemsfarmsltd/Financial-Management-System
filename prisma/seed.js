const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding core organizational foundations (Zero seeded accounts)...");

  // 1. Organizations
  const group = await prisma.organization.upsert({
    where: { code: "BEMS-GROUP" },
    update: {},
    create: {
      code: "BEMS-GROUP",
      legalName: "BEMS Group Holdings Ltd (HQ)",
      type: "GROUP",
      defaultCurrency: "NGN",
      timezone: "Africa/Lagos",
      status: "ACTIVE",
    },
  });

  const subTech = await prisma.organization.upsert({
    where: { code: "BEMS-SOFT" },
    update: {},
    create: {
      parentGroupId: group.id,
      code: "BEMS-SOFT",
      legalName: "BemsSoft Hub Ltd",
      type: "SUBSIDIARY",
      defaultCurrency: "NGN",
      timezone: "Africa/Lagos",
      status: "ACTIVE",
    },
  });

  const subLogistics = await prisma.organization.upsert({
    where: { code: "BEMS-LOG" },
    update: {},
    create: {
      parentGroupId: group.id,
      code: "BEMS-LOG",
      legalName: "Bems Logistics & Farms Ltd",
      type: "SUBSIDIARY",
      defaultCurrency: "NGN",
      timezone: "Africa/Lagos",
      status: "ACTIVE",
    },
  });

  // 2. Departments
  const itDept = await prisma.department.upsert({
    where: { id: "dept-tech-eng" },
    update: {},
    create: {
      id: "dept-tech-eng",
      organizationId: subTech.id,
      name: "Engineering & Cloud Infrastructure",
      code: "IT-ENG",
    },
  });

  const adminDept = await prisma.department.upsert({
    where: { id: "dept-group-admin" },
    update: {},
    create: {
      id: "dept-group-admin",
      organizationId: group.id,
      name: "Corporate Services & Administration",
      code: "CORP-ADMIN",
    },
  });

  const logDept = await prisma.department.upsert({
    where: { id: "dept-log-ops" },
    update: {},
    create: {
      id: "dept-log-ops",
      organizationId: subLogistics.id,
      name: "Logistics, Supply Chain & Agritech",
      code: "LOG-OPS",
    },
  });

  // 3. Approved Vendors
  await prisma.vendor.upsert({
    where: { code: "VND-HOSTINGER" },
    update: {},
    create: {
      code: "VND-HOSTINGER",
      name: "Hostinger International Ltd",
      category: "IT_SERVICES",
      taxId: "CY10156942L",
      contactEmail: "billing@hostinger.com",
      bankName: "Standard Chartered / Wire",
      accountNumber: "0098765432",
      accountName: "Hostinger International",
      rating: 5,
      notes: "Primary cloud VPS & hosting provider",
    },
  });

  await prisma.vendor.upsert({
    where: { code: "VND-TOTAL" },
    update: {},
    create: {
      code: "VND-TOTAL",
      name: "TotalEnergies Marketing Nigeria Plc",
      category: "FACILITIES",
      taxId: "TIN-001928374",
      contactEmail: "commercial@totalenergies.ng",
      bankName: "Zenith Bank Plc",
      accountNumber: "1012345678",
      accountName: "TotalEnergies Commercial Sales",
      rating: 5,
      notes: "Corporate diesel and fleet lubricant supplier",
    },
  });

  // 4. Approval Policies (GMD Executive Approval Authority)
  const existingPolicies = await prisma.approvalPolicy.count();
  if (existingPolicies === 0) {
    await prisma.approvalPolicy.createMany({
      data: [
        {
          scopeSubsidiaryId: null,
          category: null,
          minAmountMinor: BigInt(0),
          maxAmountMinor: null,
          requiredRole: "GMD",
          priority: 1,
        },
      ],
    });
  }

  console.log("Core organizations, departments, vendors, and policies successfully synchronized without any seeded user accounts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
