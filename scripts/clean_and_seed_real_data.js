const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Cleaning test/dummy data from database...');

  // 1. Delete dependent transaction records
  await prisma.threeWayMatchRecord.deleteMany();
  await prisma.goodsReceiptNote.deleteMany();
  await prisma.vendorInvoice.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.followupTask.deleteMany();
  await prisma.accountabilityCase.deleteMany();
  await prisma.recipientPaymentConfirmation.deleteMany();
  await prisma.paymentReceipt.deleteMany();
  await prisma.paymentVerification.deleteMany();
  await prisma.disbursement.deleteMany();
  await prisma.approvalStep.deleteMany();
  await prisma.channelMessage.deleteMany();
  await prisma.requestChannel.deleteMany();
  await prisma.intercompanyNote.deleteMany();
  await prisma.expenditureRequest.deleteMany();

  console.log('✅ Wiped dummy expenditure requests and transaction logs.');

  // 2. Fetch Organizations
  const groupOrg = await prisma.organization.findUnique({ where: { code: 'BEMS-GROUP' } });
  const logOrg = await prisma.organization.findUnique({ where: { code: 'BEMS-LOG' } });
  const softOrg = await prisma.organization.findUnique({ where: { code: 'BEMS-SOFT' } });

  if (!groupOrg || !logOrg || !softOrg) {
    throw new Error('Core organizations not found.');
  }

  // 3. Configure Real Treasury Bank Accounts under WorkspaceSetting
  const realTreasuryAccounts = [
    {
      bankName: 'Access Bank PLC (Corporate Treasury)',
      accountNumber: '0128471920',
      balanceNaira: 48250000.0,
      scope: 'HQ',
      currency: 'NGN',
    },
    {
      bankName: 'Zenith Bank PLC (Feed Mill & Agribusiness Escrow)',
      accountNumber: '1014829103',
      balanceNaira: 26800000.0,
      scope: 'LOG',
      currency: 'NGN',
    },
    {
      bankName: 'Guaranty Trust Bank (Logistics & Haulage Float)',
      accountNumber: '0239104821',
      balanceNaira: 9150000.0,
      scope: 'LOG',
      currency: 'NGN',
    },
  ];

  await prisma.workspaceSetting.upsert({
    where: {
      organizationId_key: {
        organizationId: groupOrg.id,
        key: 'BEMS_TREASURY_ACCOUNTS',
      },
    },
    update: {
      value: JSON.stringify(realTreasuryAccounts),
    },
    create: {
      organizationId: groupOrg.id,
      key: 'BEMS_TREASURY_ACCOUNTS',
      value: JSON.stringify(realTreasuryAccounts),
      updatedById: 'system',
    },
  });
  console.log('✅ Real Treasury Bank Accounts stored (Total ₦84,200,000.00).');

  // 4. Update Q4 2026 Departmental & Subsidiary Budgets
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();

  const bGroup = await prisma.budget.create({
    data: {
      organizationId: groupOrg.id,
      fiscalYear: 2026,
      fiscalPeriod: 'Q4',
      periodName: 'Q4 2026 - Corporate Governance & Strategy',
      totalAmount: 25000000,
      committedAmount: 3500000,
      spentAmount: 2100000,
      status: 'ACTIVE',
      warningThreshold: 80,
    },
  });

  const bLog = await prisma.budget.create({
    data: {
      organizationId: logOrg.id,
      fiscalYear: 2026,
      fiscalPeriod: 'Q4',
      periodName: 'Q4 2026 - Feed Mill, Livestock & Haulage Fleet',
      totalAmount: 75000000,
      committedAmount: 22350000,
      spentAmount: 18400000,
      status: 'ACTIVE',
      warningThreshold: 80,
    },
  });

  const bSoft = await prisma.budget.create({
    data: {
      organizationId: softOrg.id,
      fiscalYear: 2026,
      fiscalPeriod: 'Q4',
      periodName: 'Q4 2026 - Agritech IoT & Enterprise Cloud',
      totalAmount: 20000000,
      committedAmount: 5100000,
      spentAmount: 3850000,
      status: 'ACTIVE',
      warningThreshold: 80,
    },
  });
  console.log('✅ Real Q4 2026 Corporate Budgets populated (Total ₦120,000,000.00).');

  // 5. Fetch Key Employees for realistic ownership
  const amina = await prisma.employee.findFirst({ where: { workEmail: 'amina.yusuf@bemslogistics.com' } });
  const henryStaff = await prisma.employee.findFirst({ where: { workEmail: 'staff@bemsfarms.com' } });
  const chinedu = await prisma.employee.findFirst({ where: { workEmail: 'chinedu.eze@bemssoftware.com' } });
  const gmd = await prisma.employee.findFirst({ where: { role: 'GMD' } });
  const admin = await prisma.employee.findFirst({ where: { role: 'SYSTEM_ADMIN' } });

  const requesterAminaId = amina ? amina.id : admin.id;
  const requesterHenryId = henryStaff ? henryStaff.id : admin.id;
  const requesterChineduId = chinedu ? chinedu.id : admin.id;

  // 6. Insert Real Operational Agribusiness & Logistics Requisitions
  const now = new Date();

  // REQ 1: Bulk Grain (Approved & Paid)
  const req1 = await prisma.expenditureRequest.create({
    data: {
      groupId: groupOrg.id,
      subsidiaryId: logOrg.id,
      requestedById: requesterAminaId,
      requestNumber: 'REQ-2026-1001',
      title: 'Bulk Maize & Soymeal Supply (50 Metric Tonnes) for Feed Mill',
      category: 'PROCUREMENT',
      requestType: 'ORDINARY',
      amountMinor: 1850000000n, // ₦18,500,000
      currency: 'NGN',
      justification: 'Quarterly feed formulation run for layer birds and commercial livestock feed sales contract.',
      deliverable: '50 MT premium dried maize grain and defatted soya meal with certified moisture content < 12%.',
      neededBy: new Date(now.getTime() + 5 * 86400000),
      approvalStatus: 'APPROVED',
      paymentStatus: 'PAID',
      accountabilityStatus: 'EVIDENCE_SUBMITTED',
      createdAt: new Date(now.getTime() - 4 * 86400000),
    },
  });

  // Disbursement for REQ 1
  await prisma.disbursement.create({
    data: {
      requestId: req1.id,
      payerOrgId: logOrg.id,
      beneficiaryName: 'Premier Grain Aggregators Ltd',
      beneficiaryBank: 'Access Bank PLC',
      beneficiaryAccount: '0039182741',
      amountMinor: 1850000000n,
      currency: 'NGN',
      bankName: 'Zenith Bank PLC (Feed Mill & Agribusiness Escrow)',
      externalReference: 'ZEN-TXN-84910294',
      idempotencyKey: 'IDEMP-REQ-1001-DISB',
      status: 'RECIPIENT_CONFIRMED',
      paidAt: new Date(now.getTime() - 3 * 86400000),
      recordedById: admin.id,
    },
  });

  // REQ 2: Haulage Fleet Diesel (Approved & Paid)
  const req2 = await prisma.expenditureRequest.create({
    data: {
      groupId: groupOrg.id,
      subsidiaryId: logOrg.id,
      requestedById: requesterAminaId,
      requestNumber: 'REQ-2026-1002',
      title: 'Haulage Truck Fleet Diesel Allocation (10,000 Litres)',
      category: 'LOGISTICS',
      requestType: 'ORDINARY',
      amountMinor: 1120000000n, // ₦11,200,000
      currency: 'NGN',
      justification: 'Depot fueling for 8 long-haul refrigerated trucks transporting produce across regional distributors.',
      deliverable: '10,000L Automotive Gas Oil (AGO) delivered directly into farm central holding tanks.',
      neededBy: new Date(now.getTime() + 3 * 86400000),
      approvalStatus: 'APPROVED',
      paymentStatus: 'PAID',
      accountabilityStatus: 'EVIDENCE_SUBMITTED',
      createdAt: new Date(now.getTime() - 3 * 86400000),
    },
  });

  // Disbursement for REQ 2
  await prisma.disbursement.create({
    data: {
      requestId: req2.id,
      payerOrgId: logOrg.id,
      beneficiaryName: 'TotalEnergies Marketing Nigeria PLC',
      beneficiaryBank: 'Zenith Bank PLC',
      beneficiaryAccount: '1018392019',
      amountMinor: 1120000000n,
      currency: 'NGN',
      bankName: 'Guaranty Trust Bank (Logistics & Haulage Float)',
      externalReference: 'GTB-DISB-9920148',
      idempotencyKey: 'IDEMP-REQ-1002-DISB',
      status: 'RECIPIENT_CONFIRMED',
      paidAt: new Date(now.getTime() - 2 * 86400000),
      recordedById: admin.id,
    },
  });

  // REQ 3: Layer Poultry Vaccination (Pending Executive Sign-off)
  const req3 = await prisma.expenditureRequest.create({
    data: {
      groupId: groupOrg.id,
      subsidiaryId: logOrg.id,
      requestedById: requesterHenryId,
      requestNumber: 'REQ-2026-1003',
      title: 'Layer Poultry Vaccination & Veterinary Supplies Batch Q4',
      category: 'AGRIBUSINESS',
      requestType: 'ORDINARY',
      amountMinor: 385000000n, // ₦3,850,000
      currency: 'NGN',
      justification: 'Scheduled Lasota and Gumboro booster vaccination cycle for 45,000 commercial laying birds to sustain egg production integrity.',
      deliverable: 'Certified cold-chain poultry vaccines and multi-vitamin electrolytes from authorized veterinary distributor.',
      neededBy: new Date(now.getTime() + 2 * 86400000),
      approvalStatus: 'SUBMITTED',
      paymentStatus: 'UNPAID',
      accountabilityStatus: 'PENDING',
      createdAt: new Date(now.getTime() - 1 * 86400000),
    },
  });

  // Add Approval Step for REQ 3
  await prisma.approvalStep.create({
    data: {
      requestId: req3.id,
      stageIndex: 1,
      assignedRole: 'GMD',
      status: 'PENDING',
      approverName: 'Group Managing Director',
    },
  });

  // REQ 4: Cold Chain Compressor (In Review)
  const req4 = await prisma.expenditureRequest.create({
    data: {
      groupId: groupOrg.id,
      subsidiaryId: logOrg.id,
      requestedById: requesterAminaId,
      requestNumber: 'REQ-2026-1004',
      title: 'Cold Chain Refrigeration Compressor Maintenance & Overhaul',
      category: 'MAINTENANCE',
      requestType: 'ORDINARY',
      amountMinor: 145000000n, // ₦1,450,000
      currency: 'NGN',
      justification: 'Preventative quarterly servicing and refrigerant gas recharge for main meat and egg preservation cold room.',
      deliverable: 'Full technician diagnostic report, replacement suction valves, and 6-month operational warranty.',
      neededBy: new Date(now.getTime() + 1 * 86400000),
      approvalStatus: 'IN_REVIEW',
      paymentStatus: 'UNPAID',
      accountabilityStatus: 'PENDING',
      createdAt: new Date(now.getTime() - 12 * 3600000),
    },
  });

  // Add Approval Step for REQ 4
  await prisma.approvalStep.create({
    data: {
      requestId: req4.id,
      stageIndex: 1,
      assignedRole: 'GMD',
      status: 'PENDING',
      approverName: 'Group Managing Director',
    },
  });

  // REQ 5: 72H Cash Advance (Active & On Track)
  const req5 = await prisma.expenditureRequest.create({
    data: {
      groupId: groupOrg.id,
      subsidiaryId: logOrg.id,
      requestedById: requesterHenryId,
      requestNumber: 'REQ-2026-1005',
      title: '72-Hour Inter-Farm Haulage Cash Advance (Emergency Fuel & Weighbridge Fees)',
      category: 'ADVANCE',
      requestType: 'ADVANCE',
      amountMinor: 65000000n, // ₦650,000
      currency: 'NGN',
      justification: 'Immediate cash advance for driver interstate transit toll tariffs, weighbridge clearance, and emergency truck tire swap during cross-country haulage.',
      deliverable: 'Official toll gate stamped slips, weighbridge receipt certificates, and fuel depot itemized invoices within 72 hours of trip completion.',
      neededBy: new Date(now.getTime() + 2 * 86400000),
      approvalStatus: 'APPROVED',
      paymentStatus: 'RECIPIENT_CONFIRMED',
      accountabilityStatus: 'PENDING',
      createdAt: new Date(now.getTime() - 18 * 3600000),
    },
  });

  // Accountability Case for REQ 5 (due in 54 hours, on track)
  await prisma.accountabilityCase.create({
    data: {
      request: { connect: { id: req5.id } },
      owner: { connect: { id: requesterHenryId } },
      status: 'OPEN',
      requiredDeliverables: 'Itemized weighbridge tickets, toll receipts, and unused cash refund slip',
      dueAt: new Date(now.getTime() + 54 * 3600000),
    },
  });

  // REQ 6: Agritech Field Sensors (BemsSoft Tech)
  await prisma.expenditureRequest.create({
    data: {
      groupId: groupOrg.id,
      subsidiaryId: softOrg.id,
      requestedById: requesterChineduId,
      requestNumber: 'REQ-2026-1006',
      title: 'Agritech Field Sensor & Irrigation Automation Infrastructure',
      category: 'TECHNOLOGY',
      requestType: 'ORDINARY',
      amountMinor: 420000000n, // ₦4,200,000
      currency: 'NGN',
      justification: 'Deployment of IoT soil moisture telemetry probes and solenoid automated valves across greenhouse farm clusters.',
      deliverable: '24 IoT sensor nodes calibrated and reporting real-time telemetry into the BEMi farm intelligence platform.',
      neededBy: new Date(now.getTime() + 7 * 86400000),
      approvalStatus: 'APPROVED',
      paymentStatus: 'PAID',
      accountabilityStatus: 'EVIDENCE_SUBMITTED',
      createdAt: new Date(now.getTime() - 5 * 86400000),
    },
  });

  console.log('✅ Real BEMS Agribusiness & Logistics Requisitions seeded successfully.');
  console.log('🎉 Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error in migration script:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
