/**
 * BEMS Intelligent Dual-Agent Intent Router
 * Determines whether an executive instruction should be dispatched to:
 * - n8n HR & Workforce Operations (bems-hr-operations)
 * - n8n Financial Manager (bems-financial-manager)
 * 
 * Incorporates:
 * 1. Explicit @agent or /agent inline prefix tags (@finance, /finance, @hr, /hr, @auto, /auto)
 * 2. Asymmetric Strong Signal Overrides (e.g. asking about attendance while on Finance pill switches dynamically to HR)
 * 3. Multi-turn referential continuity (e.g. "the first 1", "yes", "proceed", "look into it" inherits previous turn domain)
 * 4. Deterministic DOM element inspection (data-ai-domain) for Point & Ask
 * 5. Weighted NLP lexicon scoring with expanded Nigerian enterprise HR & Finance vocabularies
 * 6. Cross-domain query detection (e.g. payroll spend + attendance deductions)
 */

export type AiAgentDomain = 'financial' | 'hr' | 'both';

export interface RouteResolutionInput {
  message: string;
  explicitMode?: 'financial' | 'hr' | 'auto' | 'both';
  isTagLocked?: boolean;
  threadDomain?: AiAgentDomain | null;
  history?: Array<{ role: string; content: string; domain?: AiAgentDomain }>;
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
  cleanMessage?: string;
}

// Extract any leading @agent or /agent command tag from the input prompt
export function extractAgentCommandTag(rawMessage: string): {
  tag: 'financial' | 'hr' | 'both' | 'auto' | null;
  cleanMessage: string;
} {
  const trimmed = rawMessage.trim();
  const match = trimmed.match(/^[@/](finance|financial|hr|people|both|all|auto)\b\s*/i);
  if (!match) {
    return { tag: null, cleanMessage: trimmed };
  }
  const token = match[1].toLowerCase();
  const cleanMessage = trimmed.slice(match[0].length).trim();
  if (token === 'finance' || token === 'financial') {
    return { tag: 'financial', cleanMessage };
  }
  if (token === 'hr' || token === 'people') {
    return { tag: 'hr', cleanMessage };
  }
  if (token === 'both' || token === 'all') {
    return { tag: 'both', cleanMessage };
  }
  if (token === 'auto') {
    return { tag: 'auto', cleanMessage };
  }
  return { tag: null, cleanMessage: trimmed };
}

// 1. Lexicons with contextual weights
const HR_WEIGHTS: Record<string, number> = {
  // Attendance & Timekeeping
  attend: 10,
  attendance: 12,
  attendacne: 12, // typo tolerance
  present: 8,
  presence: 8,
  absent: 10,
  absence: 10,
  absenteeism: 10,
  clock: 10,
  'clock in': 12,
  'clock-in': 12,
  'clock out': 12,
  'clock-out': 12,
  clocked: 10,
  clocking: 10,
  roster: 12,
  shift: 10,
  lateness: 12,
  late: 8,
  early: 6,
  'early departure': 10,
  resumption: 8,
  punctual: 8,
  punctuality: 10,
  cutoff: 8,
  'show face': 10,
  'enter work': 10,
  'at work': 8,
  timesheet: 10,
  biometric: 10,
  'face match': 10,
  geolocation: 8,

  // Leave & Absence Management
  leave: 10,
  'sick leave': 12,
  'annual leave': 12,
  'maternity leave': 12,
  'casual leave': 12,
  'compassionate leave': 12,
  'time off': 10,
  vacation: 8,
  excuse: 8,
  overtime: 8,
  permission: 8,

  // Workforce, Personnel & Dossier
  workforce: 10,
  headcount: 10,
  employee: 8,
  employees: 8,
  staff: 8,
  dossier: 10,
  directory: 8,
  'staff list': 10,
  'staff directory': 10,
  probation: 8,
  onboard: 8,
  onboarding: 8,
  invitation: 8,
  'people & access': 10,
  helpdesk: 8,
  'support ticket': 8,
  'hr policy': 10,
  'staff handbook': 10,
  'code of conduct': 10,
  disciplinary: 10,
  query: 8,
  'warning letter': 10,
  termination: 10,
  promotion: 8,
  designation: 6,
  'job title': 6,
  grade: 6,
  'org chart': 8,
  supervisor: 6,
  'reporting line': 8,
};

const FINANCE_WEIGHTS: Record<string, number> = {
  // Budget & Treasury Governance
  budget: 12,
  envelope: 12,
  backing: 12,
  allocation: 10,
  unallocated: 10,
  treasury: 12,
  balance: 10,
  cash: 10,
  monnify: 14,
  reconcil: 12,
  reconciliation: 12,
  bank: 8,
  account: 8,
  ledger: 10,
  vault: 10,
  float: 10,
  cashflow: 12,
  'cash flow': 12,
  'burn rate': 10,
  'funding pool': 12,
  'sub-account': 12,

  // Payroll & Spend
  payroll: 14,
  salary: 14,
  salaries: 14,
  spend: 10,
  spending: 10,
  expense: 10,
  expenses: 10,
  cost: 8,
  costs: 8,
  remuneration: 12,
  compensation: 12,
  payslip: 10,
  allowance: 10,
  pension: 10,
  paye: 10,
  'gross pay': 12,
  'net pay': 12,

  // Requisitions & Approvals
  requisition: 12,
  req: 10,
  'req-': 14,
  'fund request': 14,
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
  voucher: 10,
  imprest: 10,
  'petty cash': 10,

  // Procurement & Vendors
  vendor: 10,
  supplier: 10,
  invoice: 10,
  receipt: 8,
  'purchase order': 10,
  'debit note': 12,
  'credit note': 12,
  intercompany: 10,
  revenue: 10,
  profit: 10,
  '3-way match': 12,
  'three-way match': 12,
};

// Conversational follow-up phrases that imply continuing the previous conversation thread
const FOLLOW_UP_PATTERNS = [
  /^yes\b/i,
  /^no\b/i,
  /^sure\b/i,
  /^please\b/i,
  /^ok\b/i,
  /^okay\b/i,
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
  /\bwho else\b/i,
  /\bhow come\b/i,
  /\b(the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/i,
  /\b(the\s+)?(first|second|third|last)\s+(one|record|item|row|person|staff|entry)\b/i,
  /\b(option|choice|number|item|candidate)\s+\d+\b/i,
  /\b(all\s+of\s+them|both|none|neither)\b/i,
  /\b(try\s+again|retry|repeat|redo)\b/i,
  /\b(apply|apply\s+it|confirm|confirm\s+it|execute|execute\s+it|do\s+it|make\s+the\s+change)\b/i,
  /\b(cancel|cancel\s+it|dismiss|ignore)\b/i,
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
  const {
    message,
    explicitMode = 'auto',
    isTagLocked = false,
    threadDomain,
    history = [],
    targetElement,
    currentPage = '',
  } = input;

  // 0. Parse leading @agent or /agent command tag from the message
  const parsedTag = extractAgentCommandTag(message);
  const effectiveMessage = parsedTag.cleanMessage || message;
  const normalizedMsg = effectiveMessage.trim().toLowerCase();

  // If user explicitly prefixed the prompt with @both, /both, @finance, /finance, @hr, or /hr
  if (parsedTag.tag === 'both' || (isTagLocked && explicitMode === 'both') || explicitMode === 'both') {
    return {
      domain: 'both',
      isCrossDomain: true,
      confidence: 1.0,
      reason: 'Explicit @both / /both dual-agent co-dispatch active.',
      cleanMessage: effectiveMessage,
    };
  }
  if (parsedTag.tag === 'financial' || (isTagLocked && explicitMode === 'financial')) {
    return {
      domain: 'financial',
      isCrossDomain: false,
      confidence: 1.0,
      reason: 'Explicit @finance / /finance tag locked.',
      cleanMessage: effectiveMessage,
    };
  }
  if (parsedTag.tag === 'hr' || (isTagLocked && explicitMode === 'hr')) {
    return {
      domain: 'hr',
      isCrossDomain: false,
      confidence: 1.0,
      reason: 'Explicit @hr / /hr tag locked.',
      cleanMessage: effectiveMessage,
    };
  }

  // 1. Deterministic DOM Domain Tagging (Point & Ask)
  if (targetElement) {
    if (targetElement.domain === 'hr' || String(targetElement.domain).toLowerCase() === 'hr') {
      return {
        domain: 'hr',
        isCrossDomain: false,
        confidence: 1.0,
        reason: 'Point & Ask element carries explicit data-ai-domain="hr".',
        cleanMessage: effectiveMessage,
      };
    }
    if (targetElement.domain === 'finance' || String(targetElement.domain).toLowerCase() === 'finance') {
      return {
        domain: 'financial',
        isCrossDomain: false,
        confidence: 1.0,
        reason: 'Point & Ask element carries explicit data-ai-domain="finance".',
        cleanMessage: effectiveMessage,
      };
    }

    // Inspect element text and headers
    const elementCorpus = `${targetElement.page || ''} ${targetElement.section || ''} ${targetElement.label || ''} ${targetElement.rawText || ''}`.toLowerCase();
    const elemHrScore = scoreText(elementCorpus, HR_WEIGHTS);
    const elemFinScore = scoreText(elementCorpus, FINANCE_WEIGHTS);
    if (elemHrScore > elemFinScore && elemHrScore >= 8) {
      return {
        domain: 'hr',
        isCrossDomain: false,
        confidence: 0.9,
        reason: 'Point & Ask element metadata is primarily HR operations.',
        cleanMessage: effectiveMessage,
      };
    }
    if (elemFinScore > elemHrScore && elemFinScore >= 8) {
      return {
        domain: 'financial',
        isCrossDomain: false,
        confidence: 0.9,
        reason: 'Point & Ask element metadata is primarily financial.',
        cleanMessage: effectiveMessage,
      };
    }
  }

  // 2. Compute NLP Lexicon Scores on the current prompt
  const hrScore = scoreText(normalizedMsg, HR_WEIGHTS);
  const finScore = scoreText(normalizedMsg, FINANCE_WEIGHTS);

  // 3. Multi-turn Conversational Continuity for Short / Referential Follow-ups
  // (e.g. "the first 1", "yes", "proceed", "look into it", "confirm it")
  const isShortReferential = normalizedMsg.length <= 30 || FOLLOW_UP_PATTERNS.some((pat) => pat.test(normalizedMsg));
  if (isShortReferential && hrScore < 8 && finScore < 8) {
    // If an explicit threadDomain is already established, follow-ups adhere to that thread
    if (threadDomain) {
      return {
        domain: threadDomain,
        isCrossDomain: false,
        confidence: 0.95,
        reason: `Multi-turn continuity: short follow-up adhering to active thread (${threadDomain}).`,
        cleanMessage: effectiveMessage,
      };
    }

    if (history.length > 0) {
      // Inspect recent turns (searching from the most recent backwards)
      for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        if (turn.domain) {
          return {
            domain: turn.domain,
            isCrossDomain: false,
            confidence: 0.95,
            reason: `Multi-turn continuity: inheriting ${turn.domain} domain from previous turn.`,
            cleanMessage: effectiveMessage,
          };
        }
        const turnHrScore = scoreText(turn.content, HR_WEIGHTS);
        const turnFinScore = scoreText(turn.content, FINANCE_WEIGHTS);
        if (turnFinScore >= 8 && turnFinScore >= turnHrScore) {
          return {
            domain: 'financial',
            isCrossDomain: false,
            confidence: 0.9,
            reason: 'Multi-turn continuity: previous turn was Financial management.',
            cleanMessage: effectiveMessage,
          };
        }
        if (turnHrScore >= 8 && turnHrScore > turnFinScore) {
          return {
            domain: 'hr',
            isCrossDomain: false,
            confidence: 0.9,
            reason: 'Multi-turn continuity: previous turn was HR operations.',
            cleanMessage: effectiveMessage,
          };
        }
      }
    }
  }

  // If explicitMode is set by the user in the UI pill toggle ('hr', 'financial', or 'both'), strictly honor it!
  if (explicitMode === 'hr') {
    return {
      domain: 'hr',
      isCrossDomain: false,
      confidence: 0.99,
      reason: 'Explicit [👥 HR Ops] toggle active.',
      cleanMessage: effectiveMessage,
    };
  }
  if (explicitMode === 'financial') {
    return {
      domain: 'financial',
      isCrossDomain: false,
      confidence: 0.99,
      reason: 'Explicit [⚡ Finance] toggle active.',
      cleanMessage: effectiveMessage,
    };
  }

  // 5. Cross-domain detection: strong scores in both domains -> call both agents together!
  if (hrScore >= 8 && finScore >= 8) {
    return {
      domain: 'both',
      isCrossDomain: true,
      confidence: 0.95,
      reason: `Cross-domain prompt touching both Financial and Workforce operations (HR score: ${hrScore}, Finance score: ${finScore}). Dispatched to both agents for unified synthesis.`,
      cleanMessage: effectiveMessage,
    };
  }

  // 6. Strong direct signal in current prompt
  if (hrScore >= 8 && hrScore > finScore) {
    return {
      domain: 'hr',
      isCrossDomain: false,
      confidence: 0.95,
      reason: `HR keyword intent detected (score: ${hrScore}).`,
      cleanMessage: effectiveMessage,
    };
  }
  if (finScore >= 8 && finScore > hrScore) {
    return {
      domain: 'financial',
      isCrossDomain: false,
      confidence: 0.95,
      reason: `Financial keyword intent detected (score: ${finScore}).`,
      cleanMessage: effectiveMessage,
    };
  }

  // 7. Conversational Continuity & Sticky Thread Affinity
  const priorMessages = history.slice(-4);
  const priorAssistantText = priorMessages.filter((m) => m.role === 'assistant').map((m) => m.content).join(' ');
  const priorAssistantHrScore = scoreText(priorAssistantText, HR_WEIGHTS);
  const priorAssistantFinScore = scoreText(priorAssistantText, FINANCE_WEIGHTS);

  if (threadDomain === 'hr' || (priorAssistantHrScore > priorAssistantFinScore && priorAssistantHrScore >= 8)) {
    if (finScore < 8) {
      return {
        domain: 'hr',
        isCrossDomain: false,
        confidence: 0.9,
        reason: 'Thread continuity: following up on previous HR conversation.',
        cleanMessage: effectiveMessage,
      };
    }
  }

  if (threadDomain === 'financial' || (priorAssistantFinScore > priorAssistantHrScore && priorAssistantFinScore >= 8)) {
    if (hrScore < 8) {
      return {
        domain: 'financial',
        isCrossDomain: false,
        confidence: 0.9,
        reason: 'Thread continuity: following up on previous Financial conversation.',
        cleanMessage: effectiveMessage,
      };
    }
  }

  // 8. Page Context Fallback
  const lowerPage = currentPage.toLowerCase();
  if (lowerPage.includes('attendance') || lowerPage.includes('staff') || lowerPage.includes('onboarding') || lowerPage.includes('hr')) {
    return {
      domain: 'hr',
      isCrossDomain: false,
      confidence: 0.7,
      reason: `Page context (${currentPage}) defaults to HR operations.`,
      cleanMessage: effectiveMessage,
    };
  }

  // Default fallback: Financial Manager
  return {
    domain: 'financial',
    isCrossDomain: false,
    confidence: 0.6,
    reason: 'Default domain fallback: Financial Manager.',
    cleanMessage: effectiveMessage,
  };
}
