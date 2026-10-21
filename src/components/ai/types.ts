export type AiRole = 'GMD' | 'SYSTEM_ADMIN';

export type ActionCardType =
  | 'briefing'
  | 'approval_decision'
  | 'budget_proposal'
  | 'salary_adjustment'
  | 'disbursement_record'
  | 'scenario_simulator';

export interface BriefingCardData {
  asOf: string;
  totalPendingApprovals: number;
  totalPendingMinor: number;
  unrecordedPayments: number;
  unrecordedMinor: number;
  overdueCasesCount: number;
  cashRunwayMonths: string;
  urgentItems: {
    id: string;
    requestNumber: string;
    title: string;
    amountNaira: number;
    subsidiaryName: string;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
    dueInHours: number;
  }[];
}

export interface ApprovalDecisionCardData {
  requestId: string;
  requestNumber: string;
  title: string;
  subsidiaryName: string;
  requesterName: string;
  category: string;
  amountNaira: number;
  currency: string;
  justification: string;
  budgetImpact: {
    budgetTotal: number;
    currentSpent: number;
    newTotalAfterApproval: number;
    headroomPercentage: number;
  };
  policyChecks: {
    check: string;
    passed: boolean;
    note: string;
  }[];
}

export interface BudgetProposalCardData {
  organizationId: string;
  organizationName: string;
  periodName: string;
  fiscalYear: number;
  fiscalPeriod: string;
  totalAmount: number;
  currency: string;
  lines: {
    departmentName: string;
    category: string;
    allocatedAmount: number;
  }[];
  varianceFromPrevious?: number;
}

export interface SalaryAdjustmentCardData {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  subsidiaryName: string;
  departmentName: string;
  currentSalary: number;
  proposedSalary: number;
  changeType: 'ADDITION' | 'DEDUCTION';
  effectiveDate: string;
  reason: string;
  willNotifyEmployee: boolean;
}

export interface DisbursementRecordCardData {
  requestId: string;
  requestNumber: string;
  title: string;
  beneficiaryName: string;
  beneficiaryBank: string;
  beneficiaryAccount: string;
  amountNaira: number;
  payerOrgName: string;
  payerAccountName: string;
  externalReference?: string;
}

export interface ScenarioSimulatorCardData {
  initialRunwayMonths: number;
  initialLiquidNaira: number;
  monthlyBurnNaira: number;
  pendingCommitmentsNaira: number;
}

export interface AiMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  content: string;
  actionCard?: {
    type: ActionCardType;
    data: any;
    confirmed?: boolean;
    cancelled?: boolean;
    resultMessage?: string;
  };
  references?: {
    type: 'request' | 'note' | 'budget' | 'disbursement';
    id: string;
    label: string;
    targetTab?: string;
  }[];
  quickReplies?: string[];
}
