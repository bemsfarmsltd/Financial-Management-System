/**
 * BEMS Intelligent Dual-Agent Intent Router
 * Determines whether an executive instruction should be dispatched to:
 * - n8n HR & Workforce Operations (bems-hr-operations)
 * - n8n Financial Manager (bems-financial-manager)
 * 
 * Incorporates:
 * 1. Weighted NLP lexicon scoring (with stem matching & colloquialisms)
 * 2. Deterministic DOM element inspection (data-ai-domain) for Point & Ask
 * 3. Multi-turn sticky conversation thread affinity
 * 4. Cross-domain query detection (e.g. payroll spend + attendance deductions)
 */

export type AiAgentDomain = 'financial' | 'hr';

export interface RouteResolutionInput {
  message: string;
  explicitMode?: 'financial' | 'hr' | 'auto';
  threadDomain?: AiAgentDomain | null;
  history?: Array<{ role: string; content: string }>;
  targetElement?: {
    page?: string;
    section?: string;
    label?: string;
    rawText?: string;
    domain?: string;
  } | null;
  currentPage?: string;
}

export interface RouteResolutionResult {
  domain: AiAgentDomain;
  isCrossDomain: boolean;
  confidence: number;
  reason: string;
}

// 1. Lexicons with contextual weights
const HR_WEIGHTS: Record<string, number> = {
  // Attendance & Timekeeping
  attend: 10,
  attendance: 12,
  attendacne: 12, // common typo tolerance
  present: 8,
  presence: 8,
  absent: 10,
  absence: 10,
  clock: 10,
  'clock in': 12,
  'clock-in': 12,
  'clock out': 12,
  'clock-out': 12,
  clocked: 10,
  roster: 12,
  shift: 10,
  lateness: 10,
  late: 8,
  early: 6,
  resumption: 8,
  punctual: 8,
  cutoff: 8,
  'show face': 10,
  'enter work': 10,
  'at work': 8,

  // Leave & Absence Management
  leave: 10,
  'sick leave': 12,
  'annual leave': 12,
  'maternity leave': 12,
  'casual leave': 12,
  excuse: 8,
  overtime: 8,

  // Workforce & Personnel Directory
  workforce: 10,
  headcount: 10,
  employee: 8,
  employees: 8,
  staff: 8,
  dossier: 10,
  directory: 8,
  'staff list': 10,
  probation: 8,
  onboard: 8,
  invitation: 8,
  'people & access': 10,
  helpdesk: 8,
  'support ticket': 8,
  'hr policy': 10,
  deduction: 8,
};

const FINANCE_WEIGHTS: Record<string, number> = {
  // Budget & Treasury Governance
  budget: 12,
  envelope: 12,
  backing: 12,
  unallocated: 10,
  treasury: 12,
  balance: 10,
  cash: 10,
  monnify: 14,
  reconcil: 12,
  bank: 8,
  account: 8,
  ledger: 10,

  // Payroll & Spend
  payroll: 12,
  salary: 12,
  salaries: 12,
  spend: 10,
  spending: 10,
  expense: 10,
  expenses: 10,
  cost: 8,
  costs: 8,

  // Requisitions & Approvals
  requisition: 12,
  req: 10,
  'req-': 14,
  expenditure: 10,
  approval: 8,
  approve: 8,
  reject: 8,
  clarification: 8,
  'payment release': 12,
  payout: 10,
  disburse: 12,
  disbursement: 12,
  wallet: 12,

  // Procurement & Vendors
  vendor: 10,
  supplier: 10,
  invoice: 10,
  receipt: 8,
  'debit note': 12,
  'credit note': 12,
  intercompany: 10,
  'burn rate': 10,
  revenue: 10,
  profit: 10,
  'funding pool': 12,
  '3-way match': 12,
};

// Conversational follow-up phrases that imply continuing the previous conversation thread
const FOLLOW_UP_PATTERNS = [
  /^yes\b/i,
  /^no\b/i,
  /\blook into\b/i,
  /\btell me\b/i,
  /\bwhy\b/i,
  /\bgo ahead\b/i,
  /\bproceed\b/i,
  /\bcontinue\b/i,
  /\bcheck (it|that|her|him|them)\b/i,
  /\bexcuse (her|him|them)\b/i,
  /\bmessage \b/i,
  /\bwhat about\b/i,
  /\bexplain\b/i,
  /\bmore details\b/i,
  /\bsure\b/i,
  /\bplease\b/i,
  /\bwho else\b/i,
  /\bhow come\b/i,
];

function scoreText(text: string, weights: Record<string, number>): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const [kw, w] of Object.entries(weights)) {
    if (lower.includes(kw)) {
      score += w;
    }
  }
  return score;
}

export function resolveAiAgentRoute(input: RouteResolutionInput): RouteResolutionResult {
  const { message, explicitMode = 'auto', threadDomain, history = [], targetElement, currentPage = '' } = input;
  const normalizedMsg = message.trim().toLowerCase();

  // 1. Explicit Mode Override: user selected [⚡ Finance] or [👥 HR Ops]
  if (explicitMode === 'hr') {
    return { domain: 'hr', isCrossDomain: false, confidence: 1.0, reason: 'Explicit [👥 HR Ops] toggle active.' };
  }
  if (explicitMode === 'financial') {
    return { domain: 'financial', isCrossDomain: false, confidence: 1.0, reason: 'Explicit [⚡ Finance] toggle active.' };
  }

  // 2. Deterministic DOM Domain Tagging (Point & Ask)
  if (targetElement) {
    if (targetElement.domain === 'hr' || String(targetElement.domain).toLowerCase() === 'hr') {
      return { domain: 'hr', isCrossDomain: false, confidence: 1.0, reason: 'Point & Ask element carries explicit data-ai-domain="hr".' };
    }
    if (targetElement.domain === 'finance' || String(targetElement.domain).toLowerCase() === 'finance') {
      return { domain: 'financial', isCrossDomain: false, confidence: 1.0, reason: 'Point & Ask element carries explicit data-ai-domain="finance".' };
    }

    // Inspect element text and headers
    const elementCorpus = `${targetElement.page || ''} ${targetElement.section || ''} ${targetElement.label || ''} ${targetElement.rawText || ''}`.toLowerCase();
    const elemHrScore = scoreText(elementCorpus, HR_WEIGHTS);
    const elemFinScore = scoreText(elementCorpus, FINANCE_WEIGHTS);
    if (elemHrScore > elemFinScore && elemHrScore >= 8) {
      return { domain: 'hr', isCrossDomain: false, confidence: 0.9, reason: 'Point & Ask element metadata is primarily HR operations.' };
    }
    if (elemFinScore > elemHrScore && elemFinScore >= 8) {
      return { domain: 'financial', isCrossDomain: false, confidence: 0.9, reason: 'Point & Ask element metadata is primarily financial.' };
    }
  }

  // 3. Compute NLP Lexicon Scores on the user message
  const hrScore = scoreText(normalizedMsg, HR_WEIGHTS);
  const finScore = scoreText(normalizedMsg, FINANCE_WEIGHTS);

  // 4. Cross-domain detection: strong scores in both domains
  if (hrScore >= 8 && finScore >= 8) {
    return {
      domain: finScore >= hrScore ? 'financial' : 'hr',
      isCrossDomain: true,
      confidence: 0.85,
      reason: `Cross-domain prompt (HR score: ${hrScore}, Finance score: ${finScore}).`,
    };
  }

  // 5. Strong direct signal in current prompt
  if (hrScore >= 8 && hrScore > finScore) {
    return { domain: 'hr', isCrossDomain: false, confidence: 0.95, reason: `HR keyword intent detected (score: ${hrScore}).` };
  }
  if (finScore >= 8 && finScore > hrScore) {
    return { domain: 'financial', isCrossDomain: false, confidence: 0.95, reason: `Financial keyword intent detected (score: ${finScore}).` };
  }

  // 6. Conversational Continuity & Sticky Thread Affinity
  // Check if message is a short follow-up or reply
  const isFollowUp = normalizedMsg.length < 80 && FOLLOW_UP_PATTERNS.some((pat) => pat.test(normalizedMsg));

  // Inspect recent conversation turns
  const priorMessages = history.slice(-4);
  const priorAssistantText = priorMessages.filter((m) => m.role === 'assistant').map((m) => m.content).join(' ');
  const priorAssistantHrScore = scoreText(priorAssistantText, HR_WEIGHTS);
  const priorAssistantFinScore = scoreText(priorAssistantText, FINANCE_WEIGHTS);

  // If in an active HR thread or recent assistant message discussed HR
  if (threadDomain === 'hr' || (priorAssistantHrScore > priorAssistantFinScore && priorAssistantHrScore >= 8)) {
    // Stick to HR unless user introduces an unequivocal financial question
    if (finScore < 8) {
      return {
        domain: 'hr',
        isCrossDomain: false,
        confidence: 0.9,
        reason: 'Thread continuity: following up on previous HR conversation.',
      };
    }
  }

  // If in an active Finance thread
  if (threadDomain === 'financial' || (priorAssistantFinScore > priorAssistantHrScore && priorAssistantFinScore >= 8)) {
    if (hrScore < 8) {
      return {
        domain: 'financial',
        isCrossDomain: false,
        confidence: 0.9,
        reason: 'Thread continuity: following up on previous Financial conversation.',
      };
    }
  }

  // 7. Page Context Fallback
  const lowerPage = currentPage.toLowerCase();
  if (lowerPage.includes('attendance') || lowerPage.includes('staff') || lowerPage.includes('onboarding') || lowerPage.includes('hr')) {
    return { domain: 'hr', isCrossDomain: false, confidence: 0.7, reason: `Page context (${currentPage}) defaults to HR operations.` };
  }

  // Default fallback
  return { domain: 'financial', isCrossDomain: false, confidence: 0.6, reason: 'Default domain fallback: Financial Manager.' };
}
