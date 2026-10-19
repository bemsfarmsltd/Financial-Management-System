const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Synchronizing core organizations, departments, vendors, and initial live telemetry...");

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
  const vendorHostinger = await prisma.vendor.upsert({
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

  const vendorTotal = await prisma.vendor.upsert({
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

  // 4. Approval Policies
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

  // 5. Connect existing admin user to corporate assignment
  const adminUser = await prisma.employee.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });

  if (adminUser) {
    const existingAssignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: adminUser.id },
    });

    if (!existingAssignment) {
      await prisma.employeeAssignment.create({
        data: {
          employeeId: adminUser.id,
          subsidiaryId: group.id,
          departmentId: adminDept.id,
          positionName: "Chief System Administrator",
          isPrimary: true,
          status: "ACTIVE",
        },
      });
      console.log(`Assigned System Admin (${adminUser.legalName}) to Group Corporate Services.`);
    }

    const now = new Date();

    // Check & seed Request 1: Hostinger Cloud VPS
    let req1 = await prisma.expenditureRequest.findUnique({ where: { requestNumber: "REQ-2026-0001" } });
    if (!req1) {
      req1 = await prisma.expenditureRequest.create({
        data: {
          requestNumber: "REQ-2026-0001",
          groupId: group.id,
          subsidiaryId: subTech.id,
          requestedById: adminUser.id,
          vendorId: vendorHostinger.id,
          category: "IT_SOFTWARE",
          amountMinor: BigInt(45000000), // ₦450,000
          currency: "NGN",
          title: "Hostinger Cloud VPS Infrastructure Renewal",
          justification: "Annual renewal for production application servers and cloud databases.",
          deliverable: "12-month cloud server uptime and database access.",
          neededBy: new Date(now.getTime() + 7 * 86400000),
          approvalStatus: "APPROVED",
          paymentStatus: "UNPAID",
          accountabilityStatus: "PENDING",
        },
      });
    }

    // Check & seed Request 2: TotalEnergies Bulk Diesel
    let req2 = await prisma.expenditureRequest.findUnique({ where: { requestNumber: "REQ-2026-0002" } });
    if (!req2) {
      req2 = await prisma.expenditureRequest.create({
        data: {
          requestNumber: "REQ-2026-0002",
          groupId: group.id,
          subsidiaryId: subLogistics.id,
          requestedById: adminUser.id,
          vendorId: vendorTotal.id,
          category: "FACILITIES",
          amountMinor: BigInt(280000000), // ₦2,800,000
          currency: "NGN",
          title: "TotalEnergies Bulk Diesel Batch Supply",
          justification: "Procurement of 2,500 liters automotive gas oil (diesel) for delivery fleet.",
          deliverable: "Diesel delivery to Bems Farms logistics hub with signed meter waybill.",
          neededBy: new Date(now.getTime() + 3 * 86400000),
          approvalStatus: "APPROVED",
          paymentStatus: "AWAITING_RECIPIENT_CONFIRMATION",
          accountabilityStatus: "PENDING",
        },
      });
    }

    // Check & seed Disbursement for Request 2
    const existingDisbursement = await prisma.disbursement.findFirst({ where: { requestId: req2.id } });
    if (!existingDisbursement) {
      await prisma.disbursement.create({
        data: {
          requestId: req2.id,
          payerOrgId: subLogistics.id,
          beneficiaryName: "TotalEnergies Marketing Nigeria Plc",
          beneficiaryBank: "Zenith Bank Plc",
          beneficiaryAccount: "1012345678",
          amountMinor: BigInt(280000000),
          currency: "NGN",
          externalReference: "TRF-2026-9481",
          bankName: "Access Bank Corporate",
          paidAt: new Date(now.getTime() - 2 * 86400000),
          recordedById: adminUser.id,
          status: "AWAITING_RECIPIENT_CONFIRMATION",
          idempotencyKey: `IDEMP-TRF-${Date.now()}-001`,
        },
      });
    }

    // Check & seed Request 3: Project Advance with Accountability Case
    let req3 = await prisma.expenditureRequest.findUnique({ where: { requestNumber: "REQ-2026-0003" } });
    if (!req3) {
      req3 = await prisma.expenditureRequest.create({
        data: {
          requestNumber: "REQ-2026-0003",
          groupId: group.id,
          subsidiaryId: subLogistics.id,
          requestedById: adminUser.id,
          requestType: "ADVANCE",
          category: "LOGISTICS",
          amountMinor: BigInt(120000000), // ₦1,200,000
          currency: "NGN",
          title: "Q1 Agritech Delivery Advance & Waybill Float",
          justification: "Operational cash advance for interstate waybill clearing and driver logistics.",
          deliverable: "Retiral of all physical weighbridge receipts and driver toll stubs.",
          neededBy: new Date(now.getTime() + 4 * 86400000),
          approvalStatus: "APPROVED",
          paymentStatus: "RECIPIENT_CONFIRMED",
          accountabilityStatus: "EVIDENCE_SUBMITTED",
        },
      });
    }

    // Check & seed Accountability Case for Request 3
    const existingCase = await prisma.accountabilityCase.findFirst({ where: { requestId: req3.id } });
    if (!existingCase) {
      await prisma.accountabilityCase.create({
        data: {
          requestId: req3.id,
          ownerUserId: adminUser.id,
          dueAt: new Date(now.getTime() + 3 * 86400000),
          status: "OPEN",
          requiredDeliverables: "Physical weighbridge waybills, supplier receipt stubs, and delivery acceptance sign-offs.",
        },
      });
    }

    // Check & seed Request 4: Pending executive approval
    let req4 = await prisma.expenditureRequest.findUnique({ where: { requestNumber: "REQ-2026-0004" } });
    if (!req4) {
      req4 = await prisma.expenditureRequest.create({
        data: {
          requestNumber: "REQ-2026-0004",
          groupId: group.id,
          subsidiaryId: subTech.id,
          requestedById: adminUser.id,
          category: "IT_SOFTWARE",
          amountMinor: BigInt(65000000), // ₦650,000
          currency: "NGN",
          title: "Microsoft Cloud Developer Licenses Q4",
          justification: "Subscription extension for engineering IDEs and cloud telemetry tools.",
          deliverable: "Active developer license seat assignment.",
          neededBy: new Date(now.getTime() + 5 * 86400000),
          approvalStatus: "SUBMITTED",
          paymentStatus: "UNPAID",
          accountabilityStatus: "PENDING",
        },
      });
    }

    // Check & seed Initial Intercompany Note
    const existingNote = await prisma.intercompanyNote.findFirst({ where: { noteNumber: "DN-202610-0012" } });
    if (!existingNote) {
      await prisma.intercompanyNote.create({
        data: {
          sourceEntityId: subTech.id,
          targetEntityId: subLogistics.id,
          noteType: "DEBIT_NOTE",
          noteNumber: "DN-202610-0012",
          totalAmountMinor: BigInt(145000000), // ₦1,450,000
          currency: "NGN",
          description: "Shared Engineering Salaries — October DevOps Support Allocation (70/30 Split)",
          status: "ISSUED",
        },
      });
    }

    console.log("Telemetry and records synchronization complete!");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
