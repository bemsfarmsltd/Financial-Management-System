const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

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

  const subMedia = await prisma.organization.upsert({
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
  const itDept = await prisma.department.create({
    data: {
      organizationId: subTech.id,
      name: "Engineering & Cloud Infrastructure",
      code: "IT-ENG",
    },
  });

  const adminDept = await prisma.department.create({
    data: {
      organizationId: group.id,
      name: "Corporate Administration",
      code: "CORP-ADMIN",
    },
  });

  const mediaDept = await prisma.department.create({
    data: {
      organizationId: subMedia.id,
      name: "Production & Media Services",
      code: "MEDIA-PROD",
    },
  });

  // 3. Employees
  const gmd = await prisma.employee.upsert({
    where: { workEmail: "henry@bemsgroup.com" },
    update: {},
    create: {
      employeeNumber: "EMP-001",
      legalName: "Henry Nwosu",
      workEmail: "henry@bemsgroup.com",
      phone: "+2348031234567",
      role: "GMD",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    },
  });

  const coo = await prisma.employee.upsert({
    where: { workEmail: "adaobi@bemsgroup.com" },
    update: {},
    create: {
      employeeNumber: "EMP-002",
      legalName: "Adaobi Okeke",
      workEmail: "adaobi@bemsgroup.com",
      phone: "+2348029876543",
      role: "COO",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
    },
  });

  const headAdmin = await prisma.employee.upsert({
    where: { workEmail: "babatunde@bemsgroup.com" },
    update: {},
    create: {
      employeeNumber: "EMP-003",
      legalName: "Babatunde Adeleke",
      workEmail: "babatunde@bemsgroup.com",
      phone: "+2348051112233",
      role: "HEAD_OF_ADMIN",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    },
  });

  const finance = await prisma.employee.upsert({
    where: { workEmail: "ngozi@bemsgroup.com" },
    update: {},
    create: {
      employeeNumber: "EMP-004",
      legalName: "Ngozi Eze",
      workEmail: "ngozi@bemsgroup.com",
      phone: "+2348064445566",
      role: "FINANCE",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
    },
  });

  const verifier = await prisma.employee.upsert({
    where: { workEmail: "chinedu@bemsgroup.com" },
    update: {},
    create: {
      employeeNumber: "EMP-005",
      legalName: "Chinedu Obi",
      workEmail: "chinedu@bemsgroup.com",
      phone: "+2348078889900",
      role: "VERIFIER",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    },
  });

  const staffDevOps = await prisma.employee.upsert({
    where: { workEmail: "temitope@bemsgroup.com" },
    update: {},
    create: {
      employeeNumber: "EMP-006",
      legalName: "Temitope Bakare",
      workEmail: "temitope@bemsgroup.com",
      phone: "+2348093332211",
      role: "STAFF",
      avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150",
    },
  });

  const staffLogistics = await prisma.employee.upsert({
    where: { workEmail: "fatima@bemsgroup.com" },
    update: {},
    create: {
      employeeNumber: "EMP-007",
      legalName: "Fatima Bello",
      workEmail: "fatima@bemsgroup.com",
      phone: "+2348085556677",
      role: "STAFF",
      avatarUrl: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150",
    },
  });

  // Employee Assignments
  await prisma.employeeAssignment.createMany({
    data: [
      { employeeId: gmd.id, subsidiaryId: group.id, positionName: "Group Managing Director", isPrimary: true },
      { employeeId: coo.id, subsidiaryId: group.id, positionName: "Chief Operating Officer", isPrimary: true },
      { employeeId: headAdmin.id, subsidiaryId: group.id, departmentId: adminDept.id, positionName: "Head of Administration", isPrimary: true },
      { employeeId: finance.id, subsidiaryId: group.id, positionName: "Finance & Disbursement Officer", isPrimary: true },
      { employeeId: verifier.id, subsidiaryId: group.id, positionName: "Internal Audit & Accountability Verifier", isPrimary: true },
      { employeeId: staffDevOps.id, subsidiaryId: subTech.id, departmentId: itDept.id, positionName: "Lead DevOps Engineer", isPrimary: true },
      { employeeId: staffDevOps.id, subsidiaryId: subMedia.id, departmentId: mediaDept.id, positionName: "Media Infrastructure Lead", isPrimary: false },
      { employeeId: staffLogistics.id, subsidiaryId: group.id, departmentId: adminDept.id, positionName: "Facilities & Procurement Specialist", isPrimary: true },
    ],
  });

  // 4. Compensation Agreement with Cost Allocation (Shared Employee)
  const agreementDevOps = await prisma.employmentAgreement.create({
    data: {
      employeeId: staffDevOps.id,
      employerEntityId: group.id,
      paymentModel: "GROUP_PAID",
      agreementType: "PERMANENT",
    },
  });

  const compDevOps = await prisma.compensationAgreement.create({
    data: {
      employmentAgreementId: agreementDevOps.id,
      grossMinor: BigInt(85000000), // ₦850,000 monthly
      currency: "NGN",
      recurrence: "MONTHLY",
    },
  });

  // 70% to Tech Ltd, 30% to Media Ltd
  await prisma.costAllocation.createMany({
    data: [
      { compensationAgreementId: compDevOps.id, subsidiaryId: subTech.id, percentage: 70.0 },
      { compensationAgreementId: compDevOps.id, subsidiaryId: subMedia.id, percentage: 30.0 },
    ],
  });

  // 5. Vendors
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

  // 6. Approval Policies
  await prisma.approvalPolicy.createMany({
    data: [
      {
        scopeSubsidiaryId: null,
        category: null,
        minAmountMinor: BigInt(0),
        maxAmountMinor: BigInt(10000000), // Up to ₦100,000
        requiredRole: "HEAD_OF_ADMIN",
        priority: 1,
      },
      {
        scopeSubsidiaryId: null,
        category: null,
        minAmountMinor: BigInt(10000000),
        maxAmountMinor: BigInt(100000000), // ₦100,000 to ₦1,000,000
        requiredRole: "COO",
        priority: 2,
      },
      {
        scopeSubsidiaryId: null,
        category: null,
        minAmountMinor: BigInt(100000000), // Over ₦1,000,000
        maxAmountMinor: null,
        requiredRole: "GMD",
        priority: 3,
      },
      {
        scopeSubsidiaryId: null,
        category: "IT_SOFTWARE", // High importance IT expenditures
        minAmountMinor: BigInt(15000000), // Over ₦150,000
        maxAmountMinor: null,
        requiredRole: "GMD",
        priority: 4,
      },
    ],
  });

  // 7. Seed Sample Requests
  // Request 1: Hostinger VPS renewal (From audio briefing!)
  const req1 = await prisma.expenditureRequest.create({
    data: {
      requestNumber: "REQ-2026-0001",
      groupId: group.id,
      subsidiaryId: subTech.id,
      requestedById: staffDevOps.id,
      vendorId: vendorHostinger.id,
      requestType: "ORDINARY",
      category: "IT_SOFTWARE",
      amountMinor: BigInt(18500000), // ₦185,000
      currency: "NGN",
      title: "Hostinger Cloud VPS Server Renewal (Production Cluster)",
      justification: "Monthly infrastructure renewal for client portal hosting and database replication nodes.",
      deliverable: "Active server uptime with 30-day renewed SSL and compute instance licenses.",
      neededBy: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      approvalStatus: "IN_REVIEW",
      paymentStatus: "UNPAID",
      accountabilityStatus: "PENDING",
      isRecurring: true,
      recurringInterval: "MONTHLY",
    },
  });

  // Create Channel for Req 1
  const chan1 = await prisma.requestChannel.create({
    data: {
      requestId: req1.id,
      classification: "GENERAL",
    },
  });

  // Messages in Channel
  await prisma.channelMessage.createMany({
    data: [
      {
        channelId: chan1.id,
        authorName: "System",
        authorRole: "SYSTEM",
        messageType: "AUDIT_EVENT",
        body: "Request REQ-2026-0001 submitted by Temitope Bakare (Lead DevOps Engineer). Policy evaluated: Escalated to GMD due to IT_SOFTWARE threshold.",
      },
      {
        channelId: chan1.id,
        authorId: staffDevOps.id,
        authorName: "Temitope Bakare",
        authorRole: "STAFF",
        messageType: "USER",
        body: "Hello GMD and Head of Admin, please find attached the quote from Hostinger. This renewal ensures zero downtime for the client web portals.",
        attachmentName: "Hostinger_Invoice_Quote_#882194.pdf",
        attachmentUrl: "/attachments/sample_quote.pdf",
      },
      {
        channelId: chan1.id,
        authorId: headAdmin.id,
        authorName: "Babatunde Adeleke",
        authorRole: "HEAD_OF_ADMIN",
        messageType: "CLARIFICATION",
        body: "@Temitope, does this include the automated snapshot backups we discussed in last week's ops review?",
      },
      {
        channelId: chan1.id,
        authorId: staffDevOps.id,
        authorName: "Temitope Bakare",
        authorRole: "STAFF",
        messageType: "USER",
        body: "Yes sir! It includes daily automated snapshots and 24/7 dedicated enterprise support.",
      },
    ],
  });

  // Approval step for Req 1
  await prisma.approvalStep.create({
    data: {
      requestId: req1.id,
      stageIndex: 1,
      assignedRole: "GMD",
      approverId: gmd.id,
      approverName: "Henry Nwosu",
      status: "PENDING",
    },
  });

  // Request 2: Diesel purchase (Large amount, Approved, Ready for Finance Payment)
  const req2 = await prisma.expenditureRequest.create({
    data: {
      requestNumber: "REQ-2026-0002",
      groupId: group.id,
      subsidiaryId: group.id,
      requestedById: staffLogistics.id,
      vendorId: vendorTotal.id,
      requestType: "ORDINARY",
      category: "OFFICE_EXPENSE",
      amountMinor: BigInt(240000000), // ₦2,400,000
      currency: "NGN",
      title: "Monthly Corporate Headquarters Generator Diesel Supply (2,000 Litres)",
      justification: "Scheduled bulk purchase of low-pour fuel oil (AGO) for the HQ power plant to sustain business operations through grid interruptions.",
      deliverable: "Delivery waypoint ticket, dipstick tank measurement sheet, and official vendor invoice stamped by logistics.",
      neededBy: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      approvalStatus: "APPROVED",
      paymentStatus: "UNPAID",
      accountabilityStatus: "PENDING",
      isRecurring: true,
      recurringInterval: "MONTHLY",
    },
  });

  const chan2 = await prisma.requestChannel.create({
    data: {
      requestId: req2.id,
      classification: "GENERAL",
    },
  });

  await prisma.channelMessage.createMany({
    data: [
      {
        channelId: chan2.id,
        authorName: "System",
        authorRole: "SYSTEM",
        messageType: "AUDIT_EVENT",
        body: "Request REQ-2026-0002 created and submitted.",
      },
      {
        channelId: chan2.id,
        authorId: gmd.id,
        authorName: "Henry Nwosu",
        authorRole: "GMD",
        messageType: "USER",
        body: "Approved. Verified against monthly energy allocation. Finance to proceed with transfer once delivery window is confirmed.",
      },
    ],
  });

  await prisma.approvalStep.create({
    data: {
      requestId: req2.id,
      stageIndex: 1,
      assignedRole: "GMD",
      approverId: gmd.id,
      approverName: "Henry Nwosu",
      status: "APPROVED",
      decidedAt: new Date(),
      decisionReason: "Approved within standard operational energy budget.",
    },
  });

  // Request 3: Disbursed / Paid, but currently in Accountability Phase!
  const req3 = await prisma.expenditureRequest.create({
    data: {
      requestNumber: "REQ-2026-0003",
      groupId: group.id,
      subsidiaryId: subMedia.id,
      requestedById: staffDevOps.id,
      requestType: "ADVANCE",
      category: "ASSET",
      amountMinor: BigInt(14500000), // ₦145,000
      currency: "NGN",
      title: "Field Broadcast Lens Calibration & Emergency Gimbal Servicing",
      justification: "Urgent sensor alignment for Sony FX6 camera rig before the upcoming documentary shoot.",
      deliverable: "Calibrated camera test footage and return inspection certificate from authorized Sony service center.",
      neededBy: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      approvalStatus: "APPROVED",
      paymentStatus: "VERIFIED_PAID",
      accountabilityStatus: "EVIDENCE_SUBMITTED",
    },
  });

  const chan3 = await prisma.requestChannel.create({
    data: {
      requestId: req3.id,
      classification: "GENERAL",
    },
  });

  // Disbursement record for Req 3
  const disb3 = await prisma.disbursement.create({
    data: {
      requestId: req3.id,
      payerOrgId: subMedia.id,
      beneficiaryName: "Temitope Bakare",
      beneficiaryBank: "Guaranty Trust Bank (GTBank)",
      beneficiaryAccount: "0123456789",
      amountMinor: BigInt(14500000),
      externalReference: "GTB-TRF-20261012-998214",
      bankName: "GTBank Corporate Online",
      recordedById: finance.id,
      status: "VERIFIED",
      idempotencyKey: "DISB-2026-0003-IDEMP-01",
    },
  });

  // Payment receipt
  await prisma.paymentReceipt.create({
    data: {
      disbursementId: disb3.id,
      fileName: "GTBank_Disbursement_Receipt_TRF998214.pdf",
      fileUrl: "/receipts/sample_bank_receipt.pdf",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      mimeType: "application/pdf",
      uploadedById: finance.id,
    },
  });

  // Payment verification
  await prisma.paymentVerification.create({
    data: {
      disbursementId: disb3.id,
      verifierId: verifier.id,
      decision: "VERIFIED",
      supportingReference: "CONFIRMED_ON_GTB_STATEMENT_OCT12",
      reason: "Transaction matched corporate statement line item #4410.",
    },
  });

  // Accountability Case for Req 3
  const accCase = await prisma.accountabilityCase.create({
    data: {
      requestId: req3.id,
      ownerUserId: staffDevOps.id,
      verifierUserId: verifier.id,
      requiredDeliverables: "Submit authorized repair workshop invoice + upload photo of recalibrated camera serial number.",
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: "EVIDENCE_SUBMITTED",
      closureNotes: "Evidence submitted by Temitope; awaiting verifier physical inspection sign-off.",
    },
  });

  await prisma.followupTask.create({
    data: {
      accountabilityCaseId: accCase.id,
      channelId: chan3.id,
      assigneeId: staffDevOps.id,
      description: "Upload photographic evidence of calibrated camera and signed service certificate.",
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: "COMPLETED",
      completedAt: new Date(),
      responseNotes: "Uploaded workshop receipt and camera bench test report.",
      responseAttachmentUrl: "/evidence/camera_calibration_report.pdf",
    },
  });

  console.log("Database seeded successfully with organizations, employees, policies, and sample requests!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
