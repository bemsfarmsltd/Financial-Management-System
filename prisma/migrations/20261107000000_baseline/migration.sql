-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "parentGroupId" TEXT,
    "type" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "logoUrl" TEXT,
    "brandColor" TEXT DEFAULT '#ea580c',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBankAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'Corporate Operational',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0.0,
    "dailyLimit" DECIMAL(18,2) NOT NULL DEFAULT 25000000.0,
    "tier" TEXT NOT NULL DEFAULT 'Primary Maker-Checker',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "passwordHash" TEXT,
    "securityPinHash" TEXT,
    "avatarUrl" TEXT,
    "gender" TEXT,
    "dateOfBirth" TEXT,
    "residentialAddress" TEXT,
    "cityState" TEXT,
    "jobTitle" TEXT,
    "employmentType" TEXT DEFAULT 'FULL_TIME',
    "resumptionDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "salaryBankName" TEXT,
    "salaryAccountNumber" TEXT,
    "salaryAccountName" TEXT,
    "nextOfKinName" TEXT,
    "nextOfKinPhone" TEXT,
    "nextOfKinRelationship" TEXT,
    "nextOfKinAddress" TEXT,
    "maritalStatus" TEXT,
    "stateOfOrigin" TEXT,
    "lga" TEXT,
    "nin" TEXT,
    "bvn" TEXT,
    "workLocation" TEXT,
    "staffGrade" TEXT,
    "highestEducation" TEXT,
    "isOfflineStaff" BOOLEAN NOT NULL DEFAULT false,
    "isAttendanceExempt" BOOLEAN NOT NULL DEFAULT false,
    "kioskPin" TEXT,
    "onboardedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryChangeProposal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "proposedByName" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "previousGrossMinor" BIGINT NOT NULL DEFAULT 0,
    "proposedGrossMinor" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "allocationsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfileUpdateRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedFields" TEXT NOT NULL,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffProfileUpdateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemNotification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "departmentId" TEXT,
    "positionName" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "EmployeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentAgreement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employerEntityId" TEXT NOT NULL,
    "agreementType" TEXT NOT NULL DEFAULT 'PERMANENT',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "paymentModel" TEXT NOT NULL DEFAULT 'GROUP_PAID',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "EmploymentAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationAgreement" (
    "id" TEXT NOT NULL,
    "employmentAgreementId" TEXT NOT NULL,
    "grossMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "recurrence" TEXT NOT NULL DEFAULT 'MONTHLY',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedBy" TEXT,
    "changeType" TEXT,
    "changeReason" TEXT,

    CONSTRAINT "CompensationAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAllocation" (
    "id" TEXT NOT NULL,
    "compensationAgreementId" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "chargeBasis" TEXT NOT NULL DEFAULT 'PAYROLL_COST',

    CONSTRAINT "CostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "taxId" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenditureRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "vendorId" TEXT,
    "requestType" TEXT NOT NULL DEFAULT 'ORDINARY',
    "category" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "title" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "deliverable" TEXT NOT NULL,
    "neededBy" TIMESTAMP(3) NOT NULL,
    "requestVersion" INTEGER NOT NULL DEFAULT 1,
    "approvalStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "accountabilityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringInterval" TEXT,
    "disbursementAssigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenditureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestChannel" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'GENERAL',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RequestChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'GROUP',
    "recipientId" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'USER',
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "scopeSubsidiaryId" TEXT,
    "category" TEXT,
    "minAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "maxAmountMinor" BIGINT,
    "requiredRole" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "assignedRole" TEXT NOT NULL,
    "approverId" TEXT,
    "approverName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disbursement" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "payrollItemId" TEXT,
    "beneficiaryEmployeeId" TEXT,
    "payerOrgId" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryBank" TEXT NOT NULL,
    "beneficiaryAccount" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "externalReference" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_RECIPIENT_CONFIRMATION',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Disbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipientPaymentConfirmation" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipientPaymentConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentVerification" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "verifierId" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'VERIFIED',
    "supportingReference" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "PaymentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountabilityCase" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "verifierUserId" TEXT,
    "requiredDeliverables" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "verifiedAt" TIMESTAMP(3),
    "closureNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountabilityCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowupTask" (
    "id" TEXT NOT NULL,
    "accountabilityCaseId" TEXT,
    "channelId" TEXT,
    "assigneeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "responseNotes" TEXT,
    "responseAttachmentUrl" TEXT,

    CONSTRAINT "FollowupTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "lockStatus" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollBatch" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "paymentEntityId" TEXT,
    "payrollType" TEXT NOT NULL DEFAULT 'REGULAR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "totalGrossMinor" BIGINT NOT NULL DEFAULT 0,
    "totalNetMinor" BIGINT NOT NULL DEFAULT 0,
    "snapshotHash" TEXT,
    "disbursementAssigneeId" TEXT,
    "clearingBankName" TEXT,
    "clearingAccountNumber" TEXT,
    "clearingAccountName" TEXT,
    "submittedById" TEXT,
    "submittedByName" TEXT,
    "submissionNote" TEXT,
    "bulkFundedAt" TIMESTAMP(3),
    "bulkFundedAmountMinor" BIGINT,
    "bulkFundingBankName" TEXT,
    "bulkFundingReference" TEXT,
    "bulkFundingReceiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "grossMinor" BIGINT NOT NULL,
    "employeeDeductionsMinor" BIGINT NOT NULL,
    "employerCostMinor" BIGINT NOT NULL,
    "netMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItemAllocation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "allocableCostMinor" BIGINT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PayrollItemAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntercompanyNote" (
    "id" TEXT NOT NULL,
    "periodId" TEXT,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "noteNumber" TEXT NOT NULL,
    "totalAmountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntercompanyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subsidiaryId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeHash" TEXT,
    "afterHash" TEXT,
    "metadata" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT,
    "requestId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "checksum" TEXT,
    "contentType" TEXT NOT NULL,
    "fileData" BYTEA,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalPeriod" TEXT NOT NULL,
    "periodName" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "committedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "warningThreshold" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expenseType" TEXT NOT NULL DEFAULT 'OPEX',
    "allocatedAmount" DOUBLE PRECISION NOT NULL,
    "committedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInvoice" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "requestId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "fileAttachmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptNote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waybillNumber" TEXT,
    "inspectionNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',

    CONSTRAINT "GoodsReceiptNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeWayMatchRecord" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "grnId" TEXT,
    "poAmountMinor" BIGINT NOT NULL,
    "invoiceAmountMinor" BIGINT NOT NULL,
    "varianceMinor" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MATCH_CONFIRMED',
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreeWayMatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundNotification" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagedAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "commandVersion" INTEGER NOT NULL DEFAULT 1,
    "conversationId" TEXT,
    "targetSubsidiaryId" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "expectedVersion" TEXT,
    "eligibleApproverRoles" TEXT NOT NULL DEFAULT 'GMD,SUPER_ADMIN',
    "attachmentIds" TEXT,
    "sideEffectStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "sideEffectLogJson" TEXT,
    "confirmationHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "previewJson" TEXT NOT NULL,
    "warnings" TEXT,
    "blockingErrors" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "resultJson" TEXT,
    "auditEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StagedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminInvitation" (
    "id" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "departmentId" TEXT,
    "positionName" TEXT,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n8n_chat_histories" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "message" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n8n_chat_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAdminMessage" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'GMD',
    "senderRole" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "isReadByStaff" BOOLEAN NOT NULL DEFAULT false,
    "isReadByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileAppGate" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "minimumAllowedVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "latestVersionAvailable" TEXT NOT NULL DEFAULT '1.0.0',
    "forceUpdate" BOOLEAN NOT NULL DEFAULT true,
    "directDownloadUrl" TEXT NOT NULL DEFAULT 'https://bemserp.work/download/gmd-app.apk',
    "upgradePromptNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "MobileAppGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileAppRelease" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceStation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "activeSecret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "earliestCheckInTime" TEXT NOT NULL DEFAULT '07:00',
    "resumptionTime" TEXT NOT NULL DEFAULT '08:00',
    "closingTime" TEXT NOT NULL DEFAULT '17:00',
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 15,
    "latenessDeductionPercent" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "absenceDeductionPercent" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "requireGeofence" BOOLEAN NOT NULL DEFAULT true,
    "requireQrScan" BOOLEAN NOT NULL DEFAULT true,
    "requireStarlinkIp" BOOLEAN NOT NULL DEFAULT true,
    "starlinkIpAddresses" TEXT NOT NULL DEFAULT '',
    "starlinkPowerOutageMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffWorkSchedule" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weeklyOffDays" TEXT NOT NULL DEFAULT '0,6',
    "customShiftIn" TEXT,
    "customShiftOut" TEXT,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffWorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "stationId" TEXT,
    "workDate" TEXT NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkInLat" DOUBLE PRECISION,
    "checkInLng" DOUBLE PRECISION,
    "checkInDistanceM" DOUBLE PRECISION,
    "clientIp" TEXT,
    "checkOutTime" TIMESTAMP(3),
    "checkOutLat" DOUBLE PRECISION,
    "checkOutLng" DOUBLE PRECISION,
    "checkOutDistanceM" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideById" TEXT,
    "isDeductionApplied" BOOLEAN NOT NULL DEFAULT false,
    "deductionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "deductionMinor" BIGINT NOT NULL DEFAULT 0,
    "payrollItemId" TEXT,
    "excuseStatus" TEXT NOT NULL DEFAULT 'NONE',
    "excuseRequestNote" TEXT,
    "excuseRequestedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "handoverNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBankAccount_accountNumber_key" ON "CompanyBankAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "CompanyBankAccount_organizationId_status_idx" ON "CompanyBankAccount"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceSetting_organizationId_updatedAt_idx" ON "WorkspaceSetting"("organizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSetting_organizationId_key_key" ON "WorkspaceSetting"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");

-- CreateIndex
CREATE INDEX "SalaryChangeProposal_status_createdAt_idx" ON "SalaryChangeProposal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SalaryChangeProposal_employeeId_status_idx" ON "SalaryChangeProposal"("employeeId", "status");

-- CreateIndex
CREATE INDEX "StaffProfileUpdateRequest_employeeId_status_idx" ON "StaffProfileUpdateRequest"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_employeeId_expiresAt_idx" ON "AuthSession"("employeeId", "expiresAt");

-- CreateIndex
CREATE INDEX "SystemNotification_employeeId_readAt_createdAt_idx" ON "SystemNotification"("employeeId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_code_key" ON "Vendor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenditureRequest_requestNumber_key" ON "ExpenditureRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RequestChannel_requestId_key" ON "RequestChannel"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Disbursement_payrollItemId_key" ON "Disbursement"("payrollItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Disbursement_idempotencyKey_key" ON "Disbursement"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecipientPaymentConfirmation_disbursementId_key" ON "RecipientPaymentConfirmation"("disbursementId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_disbursementId_key" ON "PaymentReceipt"("disbursementId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVerification_disbursementId_key" ON "PaymentVerification"("disbursementId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountabilityCase_requestId_key" ON "AccountabilityCase"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "IntercompanyNote_noteNumber_key" ON "IntercompanyNote"("noteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNote_grnNumber_key" ON "GoodsReceiptNote"("grnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeWayMatchRecord_requestId_key" ON "ThreeWayMatchRecord"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeWayMatchRecord_invoiceId_key" ON "ThreeWayMatchRecord"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeWayMatchRecord_grnId_key" ON "ThreeWayMatchRecord"("grnId");

-- CreateIndex
CREATE INDEX "StagedAction_userId_status_idx" ON "StagedAction"("userId", "status");

-- CreateIndex
CREATE INDEX "StagedAction_conversationId_idx" ON "StagedAction"("conversationId");

-- CreateIndex
CREATE INDEX "StagedAction_targetSubsidiaryId_status_idx" ON "StagedAction"("targetSubsidiaryId", "status");

-- CreateIndex
CREATE INDEX "StagedAction_expiresAt_idx" ON "StagedAction"("expiresAt");

-- CreateIndex
CREATE INDEX "StagedAction_idempotencyKey_idx" ON "StagedAction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_token_key" ON "AdminInvitation"("token");

-- CreateIndex
CREATE INDEX "AdminInvitation_workEmail_status_idx" ON "AdminInvitation"("workEmail", "status");

-- CreateIndex
CREATE INDEX "AdminInvitation_token_idx" ON "AdminInvitation"("token");

-- CreateIndex
CREATE INDEX "StaffAdminMessage_employeeId_channel_createdAt_idx" ON "StaffAdminMessage"("employeeId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "StaffAdminMessage_channel_createdAt_idx" ON "StaffAdminMessage"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_email_expiresAt_idx" ON "EmailVerificationToken"("email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileAppGate_appId_key" ON "MobileAppGate"("appId");

-- CreateIndex
CREATE INDEX "MobileAppRelease_appId_status_idx" ON "MobileAppRelease"("appId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceStation_code_key" ON "AttendanceStation"("code");

-- CreateIndex
CREATE INDEX "AttendanceStation_organizationId_status_idx" ON "AttendanceStation"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePolicy_organizationId_key" ON "AttendancePolicy"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffWorkSchedule_employeeId_key" ON "StaffWorkSchedule"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_workDate_status_idx" ON "AttendanceRecord"("workDate", "status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_employeeId_workDate_idx" ON "AttendanceRecord"("employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_workDate_key" ON "AttendanceRecord"("employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_filename_key" ON "StoredFile"("filename");

-- CreateIndex
CREATE INDEX "StoredFile_filename_idx" ON "StoredFile"("filename");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_status_idx" ON "LeaveRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_createdAt_idx" ON "LeaveRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSetting" ADD CONSTRAINT "WorkspaceSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryChangeProposal" ADD CONSTRAINT "SalaryChangeProposal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfileUpdateRequest" ADD CONSTRAINT "StaffProfileUpdateRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfileUpdateRequest" ADD CONSTRAINT "StaffProfileUpdateRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemNotification" ADD CONSTRAINT "SystemNotification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentAgreement" ADD CONSTRAINT "EmploymentAgreement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationAgreement" ADD CONSTRAINT "CompensationAgreement_employmentAgreementId_fkey" FOREIGN KEY ("employmentAgreementId") REFERENCES "EmploymentAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_compensationAgreementId_fkey" FOREIGN KEY ("compensationAgreementId") REFERENCES "CompensationAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRequest" ADD CONSTRAINT "ExpenditureRequest_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRequest" ADD CONSTRAINT "ExpenditureRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRequest" ADD CONSTRAINT "ExpenditureRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRequest" ADD CONSTRAINT "ExpenditureRequest_disbursementAssigneeId_fkey" FOREIGN KEY ("disbursementAssigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestChannel" ADD CONSTRAINT "RequestChannel_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenditureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "RequestChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenditureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenditureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "PayrollItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_beneficiaryEmployeeId_fkey" FOREIGN KEY ("beneficiaryEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_payerOrgId_fkey" FOREIGN KEY ("payerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientPaymentConfirmation" ADD CONSTRAINT "RecipientPaymentConfirmation_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "Disbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientPaymentConfirmation" ADD CONSTRAINT "RecipientPaymentConfirmation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "Disbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "Disbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountabilityCase" ADD CONSTRAINT "AccountabilityCase_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenditureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountabilityCase" ADD CONSTRAINT "AccountabilityCase_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountabilityCase" ADD CONSTRAINT "AccountabilityCase_verifierUserId_fkey" FOREIGN KEY ("verifierUserId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupTask" ADD CONSTRAINT "FollowupTask_accountabilityCaseId_fkey" FOREIGN KEY ("accountabilityCaseId") REFERENCES "AccountabilityCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupTask" ADD CONSTRAINT "FollowupTask_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "RequestChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowupTask" ADD CONSTRAINT "FollowupTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollBatch" ADD CONSTRAINT "PayrollBatch_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollBatch" ADD CONSTRAINT "PayrollBatch_disbursementAssigneeId_fkey" FOREIGN KEY ("disbursementAssigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayrollBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "EmploymentAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItemAllocation" ADD CONSTRAINT "PayrollItemAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PayrollItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItemAllocation" ADD CONSTRAINT "PayrollItemAllocation_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercompanyNote" ADD CONSTRAINT "IntercompanyNote_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercompanyNote" ADD CONSTRAINT "IntercompanyNote_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercompanyNote" ADD CONSTRAINT "IntercompanyNote_targetEntityId_fkey" FOREIGN KEY ("targetEntityId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenditureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoice" ADD CONSTRAINT "VendorInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoice" ADD CONSTRAINT "VendorInvoice_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenditureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenditureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeWayMatchRecord" ADD CONSTRAINT "ThreeWayMatchRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenditureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeWayMatchRecord" ADD CONSTRAINT "ThreeWayMatchRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "VendorInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeWayMatchRecord" ADD CONSTRAINT "ThreeWayMatchRecord_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdminMessage" ADD CONSTRAINT "StaffAdminMessage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileAppRelease" ADD CONSTRAINT "MobileAppRelease_appId_fkey" FOREIGN KEY ("appId") REFERENCES "MobileAppGate"("appId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceStation" ADD CONSTRAINT "AttendanceStation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWorkSchedule" ADD CONSTRAINT "StaffWorkSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "AttendanceStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

