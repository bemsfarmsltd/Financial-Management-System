'use client';

import { ModernBentoDashboard } from "@/components/dashboard/ModernBentoDashboard";
import { GmdDashboard } from "@/components/dashboard/gmd/GmdDashboard";
import { ApprovalsDeskView } from "@/components/dashboard/gmd/ApprovalsDeskView";
import { ApprovalMatrixView } from "@/components/dashboard/gmd/ApprovalMatrixView";
import { EmergencyOverridesView } from "@/components/dashboard/gmd/EmergencyOverridesView";
import { DisbursementsDeskView } from "@/components/dashboard/gmd/DisbursementsDeskView";
import { TreasuryAccountsView } from "@/components/dashboard/gmd/TreasuryAccountsView";
import { PayrollSignOffView } from "@/components/dashboard/gmd/PayrollSignOffView";
import { SubsidiaryPortfolioView } from "@/components/dashboard/gmd/SubsidiaryPortfolioView";
import { ApprovalsHubView } from "@/components/dashboard/gmd/ApprovalsHubView";
import { FundFlowWorkspace } from "@/components/dashboard/gmd/FundFlowWorkspace";
import { TreasuryFinanceHubView } from "@/components/dashboard/gmd/TreasuryFinanceHubView";
import { RecurringCommitmentsView } from "@/components/dashboard/gmd/RecurringCommitmentsView";
import { IntercompanyAuditHubView } from "@/components/dashboard/gmd/IntercompanyAuditHubView";
import { GmdView } from "@/components/dashboard/gmd/demo";
import ExecutiveBriefingClient from "../briefing/ExecutiveBriefingClient";
import { RequestDossierModal, type RequestDossier } from "@/components/requests/RequestDossierModal";
import { RequestChatModal } from "@/components/requests/RequestChatModal";
import { StaffAdminChatModal } from "@/components/chat/StaffAdminChatModal";
import {
  AccountabilityModule as LiveAccountabilityModule,
  AnalyticsBIPage as LiveAnalyticsBIPage,
  AuditLogsModule as LiveAuditLogsModule,
  FollowUpTasksModule as LiveFollowUpTasksModule,
  IntercompanyModule as LiveIntercompanyModule,
  ProofDeliverablesModule as LiveProofDeliverablesModule,
  ReceiptArchiveModule as LiveReceiptArchiveModule,
  StaffProfilesModule as LiveStaffProfilesModule,
  WorkspaceSettingsModule as LiveWorkspaceSettingsModule,
} from "@/components/dashboard/gmd/BusinessModules";
import { AiFinancialManagerDrawer } from "@/components/ai/AiFinancialManagerDrawer";
import { AmbientBottomAiBar } from "@/components/ai/AmbientBottomAiBar";
import { AiScreenEdgeGlow, notifyAiInteraction } from "@/components/ai/AiScreenEdgeGlow";
import { useAiFinancialManager } from "@/components/ai/useAiFinancialManager";
import { AiMotionEntryScreen } from "@/components/ai/AiMotionEntryScreen";
import { AiChatWorkspaceView } from "@/components/ai/AiChatWorkspaceView";
import { UniversalClickToAskProvider } from "@/components/ai/UniversalClickToAskProvider";
import { PeopleAccessWorkspaceModule } from "@/components/dashboard/gmd/PeopleAccessWorkspaceModule";
import { StaffWorkspaceModule } from "@/components/dashboard/staff/StaffWorkspaceModule";
import { NIGERIAN_STATES, NIGERIAN_STATE_LGAS, RESIDENTIAL_CITIES_AND_STATES } from "@/lib/nigeriaGeoData";
import { CorporateSubsidiaryModal } from "@/components/dashboard/CorporateSubsidiaryModal";
import { EditSubsidiaryModal } from "@/components/dashboard/EditSubsidiaryModal";
import AttendanceDeskPage from "../attendance/page";

import { Fragment, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = "";

async function apiGet<T>(path: string, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 401 || res.status === 403) {
        if (attempt < retries) {
          console.warn(`[apiGet retry] ${path} returned ${res.status}, retrying in ${(attempt + 1) * 350}ms...`);
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
          continue;
        }
        throw new Error(`GET ${path} returned ${res.status}`);
      }
      lastError = new Error(`GET ${path} failed with status ${res.status}`);
    } catch (err: unknown) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`GET ${path} failed`);
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed`);
  return res.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed`);
  return res.json();
}

// Auth calls need the response body even on non-2xx (error message, devVerificationCode, etc.)
async function authRequest<T>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({})) as T;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

type Business = {
  id: string;
  name: string;
  industry: string;
  initials: string;
  status: 'Live' | 'Setup';
  readiness: number;
  color: string;
  aiEnabled: boolean;
  code?: string;
  type?: string;
};

type OnboardingData = {
  businessName: string;
  industry: string;
  size: string;
  country: string;
  goals: string[];
  plan: string;
};

type AuthUser = { id: string; email: string; fullName: string; phone: string; emailVerified: boolean; role: string; name?: string; avatarUrl?: string };

const defaultBemsBusinesses: Business[] = [
  {
    id: "bems-group-hq",
    name: "BEMS Group",
    industry: "Conglomerate & Holding HQ",
    initials: "BG",
    status: "Live",
    readiness: 100,
    color: "#0b1220",
    aiEnabled: true,
  }
];

function formatDisplayName(fullName?: string): string {
  if (!fullName) return 'Executive';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1 && ['dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'engr', 'engr.', 'prof', 'prof.', 'chief', 'pastor'].includes(parts[0].toLowerCase())) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
}

const industryOptions = [
  'Financial services', 'Banking', 'Investment & wealth', 'Insurance', 'Healthcare',
  'Retail & e-commerce', 'Logistics & delivery', 'Travel & hospitality', 'Education',
  'Government & public services', 'Telecommunications', 'Utilities', 'Real estate',
  'Professional services', 'Media & entertainment', 'Non-profit', 'Other',
];

const goalPresets: Record<string, string[]> = {
  'Financial services': ['Open or service accounts', 'Collect payments', 'Verify customer identity', 'Resolve transaction issues', 'Send statements and receipts', 'Escalate sensitive requests'],
  Banking: ['Account self-service', 'Transfers and payments', 'Card services', 'Customer verification', 'Loan enquiries', 'Fraud and dispute support'],
  'Investment & wealth': ['Investor onboarding', 'KYC and suitability', 'Fund an account', 'Portfolio information', 'Trade or redemption requests', 'Adviser handoff'],
  Healthcare: ['Book appointments', 'Patient registration', 'Triage enquiries', 'Receive documents', 'Send reminders', 'Connect to a clinician'],
  'Retail & e-commerce': ['Browse products', 'Place an order', 'Make payment', 'Track delivery', 'Manage returns', 'Customer support'],
};

const defaultGoals = ['Answer customer questions', 'Collect information', 'Process payments', 'Book appointments', 'Send notifications', 'Handle support cases'];


type SystemRole = 'GMD' | 'SYSTEM_ADMIN' | 'STAFF' | 'DIRECTOR' | 'AI_ANALYST';

interface RoleProfile {
  role: SystemRole;
  title: string;
  badge: string;
  platform: string;
  avatarColor: string;
}

const roleProfiles: Record<string, RoleProfile> = {
  GMD: { role: 'GMD', title: 'Group Managing Director', badge: 'Super Executive', platform: 'Executive Command Center', avatarColor: '#ea580c' },
  SYSTEM_ADMIN: { role: 'SYSTEM_ADMIN', title: 'System Administrator', badge: 'Super Executive', platform: 'Executive Command Center', avatarColor: '#ea580c' },
  STAFF: { role: 'STAFF', title: 'Staff Member', badge: 'Self-Service', platform: 'Staff Requisition & Accountability Portal', avatarColor: '#2563eb' },
  DIRECTOR: { role: 'DIRECTOR', title: 'Board Member / Director', badge: 'Executive Board', platform: 'Board Governance Center', avatarColor: '#0d9488' },
  AI_ANALYST: { role: 'AI_ANALYST', title: 'AI Copilot Specialist', badge: 'AI Intelligence Only', platform: 'AI Intelligence Command', avatarColor: '#8b5cf6' },
};

const staffNavGroups = [
  {
    label: 'MY REQUISITIONS',
    items: [
      ['Overview', '⌂'],
      ['New fund request', '＋'],
      ['My requests', '▱'],
    ]
  },
  {
    label: 'ACCOUNTABILITY & EVIDENCE',
    items: [
      ['72h Evidence Vault', '▣'],
      ['Receipt archive', '▤'],
    ]
  },
  {
    label: 'SUPPORT & ACCESS',
    items: [
      ['Attendance & Timekeeping', '⏱'],
      ['Settings & Profile', '⚙'],
    ]
  },
];

const gmdNavGroups = [
  {
    label: 'EXECUTIVE',
    items: [
      ['Overview', '⌂'],
      ['Subsidiary portfolio', '▦'],
      ['Executive briefing', '✦'],
    ]
  },
  {
    label: 'FUND FLOW',
    items: [
      ['Fund requests', '▱'],
      ['Approvals & payments', '✓'],
      ['Budgets & commitments', '◫'],
      ['Treasury accounts', '🏦'],
      ['Recurring commitments', '◌'],
      ['Hybrid payroll', '⌁'],
      ['Intercompany notes', '▥'],
      ['Receipt archive', '▣'],
    ]
  },
  {
    label: 'ADMINISTRATION & GOVERNANCE',
    items: [
      ['Attendance & Timekeeping', '⏱'],
      ['Staff profiles', '♙'],
      ['Staff onboarding', '👤'],
      ['Audit logs', '≡'],
      ['Admin Settings', '⚙'],
      ['Mobile App Settings', '📱'],
    ]
  },
];

const aiAnalystNavGroups = [
  {
    label: 'AI INTELLIGENCE & COPILOT',
    items: [
      ['AI Copilot & Chat', '✦'],
      ['Executive briefing', '◈'],
    ]
  },
];

function getRoleNavigation(role?: string) {
  if (role === 'AI_ANALYST') {
    return aiAnalystNavGroups;
  }
  if (role === 'STAFF') {
    return staffNavGroups;
  }
  return gmdNavGroups;
}



const capabilities = [
  { group: 'Core intelligence', icon: '✦', items: ['Conversational AI','Knowledge & grounded answers','AI customer assistant','AI sales personalisation','AI agent copilot','Document & voice intelligence','AI insights & sentiment','AI governance & control centre'] },
  { group: 'AI platform', icon: '◈', items: ['AI workflow builder','AI integration copilot','AI conversation designer','AI quality assurance','AI compliance assistant','AI forecasting','AI proactive service','AI journey optimiser','AI translation','AI anomaly detection','AI developer copilot','AI training simulator','AI executive briefing','Bring your own AI model','AI model router','AI evaluations & red teaming','Multi-agent orchestration','AI action planner','Voice biometrics & liveness','Visual intelligence','Content moderation','Knowledge gap detection','Synthetic test data','AI cost optimiser','AI skills marketplace','AI agent builder'] },
  { group: 'Build & orchestration', icon: '⌁', items: ['Workflow orchestration','Visual workflow builder','Service templates','Session & state management','Rules & decision engine','Custom code & serverless actions','Feature flags & progressive rollout','Experimentation & journey optimisation'] },
  { group: 'Integrations & channels', icon: '◉', items: ['API connector','Connector marketplace','Multi-channel routing','Channel policy & template governance','Channel experience builder','Channel capability matrix','Notifications & events','Geolocation & location services','Offline & low-connectivity support'] },
  { group: 'Customer operations', icon: '▱', items: ['Human-agent handoff','Unified inbox operations','Customer profiles & personalisation','Case management & SLA','Customer feedback & sentiment','Feedback & reviews','Lead qualification & CRM sync','Campaigns & outbound journeys','Agent quality & supervision','Customer self-service portal'] },
  { group: 'Transactions & experiences', icon: '₦', items: ['Payment orchestration','Scheduling & appointments','Document & form handling','Interactive forms & mini apps','Conversational commerce','Commerce catalogue & orders','Reusable order, booking & subscription engine','Ticketing & QR validation','Field service management','Loyalty & rewards','Licensed wallet & credit orchestration','Contracts, consent & e-signature'] },
  { group: 'Trust, identity & resilience', icon: '⌾', items: ['Identity, authentication & consent','Identity verification hub','Fraud, risk & policy guardrails','Privacy, data lifecycle & audit','Secrets & credential management','Data residency & regional deployment','Disaster recovery & reliability','Business continuity centre'] },
  { group: 'Administration & ecosystem', icon: '▦', items: ['Multi-tenant admin & RBAC','Client onboarding hub','Client admin dashboard','Usage metering & billing','Analytics & observability','Data export & business intelligence','Audit export & compliance reporting','Localisation & accessibility','White-label & brand customisation','API marketplace','Service marketplace','Partner & reseller portal'] },
];

type RegisterRow = { icon:string; primary:string; secondary:string; status:string; statusClass:'good'|'review'|'expired'; col2:string; col3:string; col4:string };
type CardItem = { icon:string; title:string; badge:string; description:string; facts:[string,string][]; action:string };
type ProgressItem = { icon:string; title:string; description:string; stat:string; percent:number; action:string };
type ModuleEntry = {
  eyebrow: string; title: string; text: string; action: string; cards: [string,string,string][];
  layout?: 'queue'|'register'|'cards'|'progress';
  queue?: [string,string,string,string][];
  registerColumns?: [string,string,string,string,string];
  registerRows?: RegisterRow[];
  cardsData?: CardItem[];
  progressData?: ProgressItem[];
  inspector?: { heading:string; description:string; facts:[string,string][]; primary:string };
};
const moduleContent: Record<string, ModuleEntry> = {
  Customers: { eyebrow:'CUSTOMER 360', title:'One customer, every interaction', text:'Identity, preferences, consent, transactions and conversations in one trusted profile.', action:'Add customer', cards:[['Unified profiles','12,406','Matched across 4 sources'],['Verified identities','8,219','66.2% of customers'],['Active segments','14','Updated automatically']] },
  Campaigns: { eyebrow:'OUTBOUND JOURNEYS', title:'Reach the right customers responsibly', text:'Create consent-aware, multi-channel campaigns triggered by events or audience rules.', action:'Create campaign', cards:[['Active campaigns','4','Across WhatsApp, SMS and email'],['Delivered','96.8%','Last 30 days'],['Conversions','18.4%','1,249 completed outcomes']], layout:'cards', cardsData:[
    {icon:'↗',title:'Payday reminder — WhatsApp',badge:'SENT',description:'Consent-aware reminder to salary account holders encouraging savings top-ups.',facts:[['Audience','8,240'],['Delivered','96.8%']],action:'View report'},
    {icon:'☾',title:'Ramadan savings campaign',badge:'SCHEDULED',description:'Multi-channel push to active savers ahead of Ramadan.',facts:[['Channel','SMS + WhatsApp'],['Starts','Tomorrow']],action:'Edit campaign'},
    {icon:'▣',title:'Card activation nudge',badge:'LIVE',description:'Targets customers with no card use in 14 days.',facts:[['Segment','No use 14d'],['Started','2 days ago']],action:'View performance'},
    {icon:'◈',title:'KYC completion reminder',badge:'PAUSED',description:'Reminder for customers with incomplete onboarding.',facts:[['Segment','Incomplete KYC'],['Paused','3 days ago']],action:'Resume campaign'},
    {icon:'☆',title:'Loyalty tier upgrade announcement',badge:'COMPLETED',description:'Announced Silver-tier customers eligible for upgrade.',facts:[['Segment','Silver tier'],['Sent','1 week ago']],action:'View results'},
  ], inspector:{heading:'Payday reminder — WhatsApp',description:'Consent-aware reminder sent to salary account holders on payday, encouraging savings goal top-ups.',facts:[['Audience','8,240 customers'],['Channel','WhatsApp'],['Delivered','96.8%'],['Conversions','1,249 (18.4%)']],primary:'Duplicate campaign'} },
  'Cases & SLAs': { eyebrow:'SERVICE OPERATIONS', title:'Resolve every issue on time', text:'Route cases, monitor service commitments and escalate before customers are affected.', action:'Create case', cards:[['Open cases','37','8 assigned to you'],['Within SLA','94.1%','Target is 95%'],['Avg. resolution','4h 18m','31 minutes faster']], layout:'register', registerColumns:['CASE','STATUS','OWNER','SLA TARGET','TIME'], registerRows:[
    {icon:'!',primary:'HC-4821 — Payment not confirmed',secondary:'Amina Okafor · WhatsApp',status:'Within SLA',statusClass:'good',col2:'Operations',col3:'4 hours',col4:'12m'},
    {icon:'⌾',primary:'HC-4818 — Card blocked incorrectly',secondary:'Bola Ibrahim · Web chat',status:'At risk',statusClass:'review',col2:'Risk team',col3:'4 hours',col4:'38m'},
    {icon:'✉',primary:'HC-4809 — Statement request',secondary:'Tunde Martins · SMS',status:'Within SLA',statusClass:'good',col2:'Operations',col3:'24 hours',col4:'1h'},
    {icon:'◇',primary:'HC-4790 — Dispute: duplicate charge',secondary:'Nnenna Eze · Voice',status:'Escalated',statusClass:'expired',col2:'Risk team',col3:'2 hours',col4:'3h'},
    {icon:'✓',primary:'HC-4772 — Account reactivation',secondary:'Chidi Okoro · WhatsApp',status:'Resolved',statusClass:'good',col2:'Operations',col3:'—',col4:'Yesterday'},
  ], inspector:{heading:'HC-4818 — Card blocked incorrectly',description:'Customer reports card blocked after a failed international transaction attempt; requires risk team review before unblock.',facts:[['Assigned to','Risk team'],['SLA target','4 hours'],['Time remaining','52 minutes'],['Priority','High']],primary:'Open case'} },
  'Services & templates': { eyebrow:'SERVICE LIBRARY', title:'Start with proven customer journeys', text:'Create reusable services or adapt sector templates for every business and channel.', action:'Create service', cards:[['Published services','6','Available to customers'],['Draft templates','12','Ready to customise'],['Sectors covered','17','Recommended by onboarding']] },
  'Forms & mini apps': { eyebrow:'INTERACTIVE EXPERIENCES', title:'Build richer steps without another app', text:'Design secure forms, calculators, catalogues and branded mini apps for complex journeys.', action:'Create experience', cards:[['Published forms','8','4 embedded in workflows'],['Mini apps','3','Identity, payment and booking'],['Completion rate','81.6%','Across all experiences']], layout:'progress', progressData:[
    {icon:'◈',title:'Loan application mini app',description:'Identity + income verification, 8 fields.',stat:'81.6% completion',percent:82,action:'Edit in builder'},
    {icon:'▣',title:'Card replacement form',description:'Delivery address capture, 5 fields.',stat:'88.2% completion',percent:88,action:'Edit form'},
    {icon:'◇',title:'Dispute evidence upload',description:'Document + description, 4 fields — in review.',stat:'Draft · in review',percent:40,action:'Review draft'},
    {icon:'✕',title:'Account closure request',description:'Reason + confirmation, 6 fields — in review.',stat:'Draft · in review',percent:35,action:'Review draft'},
    {icon:'₦',title:'Merchant onboarding calculator',description:'Interactive fee estimator, embedded in onboarding.',stat:'Live · well used',percent:94,action:'Edit calculator'},
  ], inspector:{heading:'Loan application mini app',description:'Guided, in-conversation application that captures identity, income and consent before routing to underwriting.',facts:[['Completion rate','81.6%'],['Average time','4m 40s'],['Embedded in','2 workflows'],['Last updated','6 days ago']],primary:'Edit in builder'} },
  'Developer & APIs': { eyebrow:'DEVELOPER PLATFORM', title:'Connect your systems once', text:'Manage APIs, webhooks, credentials, SDKs, events and reusable connectors for this business.', action:'Add integration', cards:[['Connected APIs','7','All healthy'],['Webhook success','99.94%','Last 24 hours'],['API calls','1.84M','Current billing period']] },
  'Test centre': { eyebrow:'SAFE DELIVERY', title:'Test everything before customers see it', text:'Simulate conversations, APIs, channel limits, policy checks and failure recovery in Test mode.', action:'Run new test', cards:[['Passing checks','46 / 51','5 need attention'],['Test conversations','148','This week'],['Release readiness','82%','Live remains protected']], layout:'progress', progressData:[
    {icon:'✓',title:'Payment confirmation — happy path',description:'WhatsApp · Web',stat:'Passed',percent:100,action:'View run'},
    {icon:'✓',title:'Payment confirmation — provider timeout',description:'WhatsApp',stat:'Passed',percent:100,action:'View run'},
    {icon:'✕',title:'Identity verification — expired document',description:'Web · Mobile',stat:'Failed',percent:20,action:'Re-run test'},
    {icon:'✓',title:'USSD session — timeout recovery',description:'USSD',stat:'Passed',percent:100,action:'View run'},
    {icon:'!',title:'Human handoff — after-hours routing',description:'Voice',stat:'Needs review',percent:60,action:'Review run'},
  ], inspector:{heading:'Identity verification — expired document',description:'Simulated customer submits an expired document; expected behaviour is a clear rejection message with a re-submission path.',facts:[['Scenario type','Failure recovery'],['Channel','Web, Mobile'],['Last run','14 minutes ago'],['Owner','Nnenna Eze']],primary:'Re-run test'} },
  'Commerce & orders': { eyebrow:'CONVERSATIONAL COMMERCE', title:'Turn conversations into completed orders', text:'Manage catalogue, cart, checkout, subscriptions, fulfilment, tracking and returns.', action:'Add catalogue', cards:[['Orders','2,841','This month'],['Completion','74.8%','From product view to payment'],['Open fulfilments','163','12 require attention']] },
  Payments: { eyebrow:'PAYMENT ORCHESTRATION', title:'Collect and confirm payments safely', text:'Connect licensed providers, create payment steps, reconcile outcomes and issue proof.', action:'Connect provider', cards:[['Processed','₦18,420,500','This month'],['Success rate','97.2%','Across 3 providers'],['Pending review','11','Automatic retry protected']] },
  Bookings: { eyebrow:'BOOKINGS & SCHEDULING', title:'Make availability easy to access', text:'Create services, schedules, appointments, tickets, reminders and rescheduling rules.', action:'Create service', cards:[['Appointments','1,284','This month'],['Attendance','88.6%','Up 6.2%'],['Available resources','24','Across 5 locations']] },
  'Identity & documents': { eyebrow:'TRUST CENTRE', title:'Verify people and documents', text:'Configure identity, authentication, consent, document capture and e-signature journeys.', action:'Create verification', cards:[['Verifications','8,219','This month'],['Auto-approved','91.4%','Policy-compliant'],['Manual review','73','Average 14 minutes']], layout:'register', registerColumns:['SUBMISSION','STATUS','REVIEW','CONFIDENCE','TIME'], registerRows:[
    {icon:'◈',primary:'Amina Okafor — BVN + selfie liveness',secondary:'Identity verification',status:'Passed',statusClass:'good',col2:'Auto-approved',col3:'98%',col4:'2m ago'},
    {icon:'▤',primary:'Tunde Martins — Utility bill upload',secondary:'Proof of address',status:'Pending',statusClass:'review',col2:'Manual review',col3:'62%',col4:'18m ago'},
    {icon:'◈',primary:'Nnenna Eze — International passport',secondary:'Identity verification',status:'Passed',statusClass:'good',col2:'Auto-approved',col3:'96%',col4:'31m ago'},
    {icon:'◎',primary:'Bola Ibrahim — Selfie liveness retry',secondary:'Liveness check',status:'Pending',statusClass:'review',col2:'Manual review',col3:'54%',col4:'1h ago'},
    {icon:'✓',primary:'Chidi Okoro — Proof of address',secondary:'Utility bill',status:'Passed',statusClass:'good',col2:'Auto-approved',col3:'91%',col4:'Yesterday'},
  ], inspector:{heading:'Tunde Martins — Utility bill upload',description:'Document quality below automated confidence threshold; queued for manual compliance review.',facts:[['Document type','Utility bill'],['Confidence score','62%'],['Queue position','3 of 73'],['SLA','Average 14 minutes']],primary:'Review document'} },
  'Loyalty & rewards': { eyebrow:'CUSTOMER VALUE', title:'Recognise and retain customers', text:'Create points, tiers, benefits, referrals and rewards connected to real outcomes.', action:'Create programme', cards:[['Members','18,420','Across 3 tiers'],['Rewards issued','4,821','This month'],['Repeat rate','42.7%','Up 8.3%']], layout:'cards', cardsData:[
    {icon:'✦',title:'Amina Okafor reached Gold tier',badge:'AWARDED',description:'Crossed the 15,000-point threshold, unlocking Gold-tier benefits.',facts:[['Points','18,420'],['Tier','Gold']],action:'View profile'},
    {icon:'☆',title:'Referral bonus issued',badge:'AWARDED',description:'3 successful invites completed by one customer.',facts:[['Bonus','1,500 pts'],['Awarded','5h ago']],action:'View referral'},
    {icon:'◎',title:'Birthday reward campaign',badge:'SCHEDULED',description:'Automated reward sent to customers on their birthday.',facts:[['Segment','412 customers'],['Starts','Tomorrow']],action:'Preview reward'},
    {icon:'⚑',title:'Points expiring in 30 days',badge:'ACTION NEEDED',description:'Customers with points due to expire next month.',facts:[['Affected','842 customers'],['Notified','2 days ago']],action:'Send reminder'},
    {icon:'₦',title:'Redemption: ₦5,000 airtime',badge:'FULFILLED',description:'Tunde Martins redeemed points for airtime.',facts:[['Value','₦5,000'],['Fulfilled','3 days ago']],action:'View redemption'},
  ], inspector:{heading:'Amina Okafor reached Gold tier',description:'Customer crossed the 15,000-point threshold, unlocking Gold-tier benefits including fee waivers.',facts:[['Current tier','Gold'],['Lifetime points','18,420'],['Member since','14 months'],['Next reward','₦2,500 cashback at 20,000 points']],primary:'View member profile'} },
  'Analytics & BI': { eyebrow:'DECISION INTELLIGENCE', title:'See outcomes, not just messages', text:'Measure completion, revenue, cost, service quality, reliability and customer behaviour.', action:'Create report', cards:[['Completed outcomes','8,391','Up 12.1%'],['Self-service','67.2%','Up 4.8%'],['Cost per outcome','₦84','Down 11.6%']] },
  'Quality & experiments': { eyebrow:'QUALITY & OPTIMISATION', title:'Improve every customer journey', text:'Review conversations, run experiments, score agents and test AI or workflow changes safely.', action:'Create experiment', cards:[['Quality score','92.4%','Across all channels'],['Active experiments','3','No Live risk detected'],['Issues prevented','48','Before publication']], layout:'progress', progressData:[
    {icon:'✦',title:'AI response tone experiment',description:'Variant B: warmer language, 12% sample.',stat:'+3.1% satisfaction',percent:65,action:'View experiment'},
    {icon:'✓',title:'Agent script: dispute resolution v3',description:'Quality score across reviewed conversations.',stat:'94.2% quality',percent:94,action:'View script'},
    {icon:'⌁',title:'Workflow change: faster KYC path',description:'A/B test, 8% sample.',stat:'Monitoring',percent:45,action:'View experiment'},
    {icon:'!',title:'Conversation review: escalation handling',description:'12 conversations flagged for review.',stat:'Action needed',percent:30,action:'Review flagged'},
    {icon:'✓',title:'AI grounding accuracy check',description:'Weekly automated audit.',stat:'Passed',percent:97,action:'View report'},
  ], inspector:{heading:'AI response tone experiment',description:'Testing whether a warmer, more conversational tone improves resolution satisfaction without harming clarity.',facts:[['Sample size','12% of Test traffic'],['Started','4 days ago'],['Live risk','None — Test only'],['Early signal','+3.1% satisfaction']],primary:'View experiment detail'} },
  'Security & compliance': { eyebrow:'SECURITY POSTURE', title:'Control risk across every business', text:'Manage policies, consent, credentials, regional data, fraud controls and continuity.', action:'Review posture', cards:[['Security score','91 / 100','4 recommendations'],['Active policies','28','Applied automatically'],['Critical alerts','0','No immediate action']] },
  'Audit logs': { eyebrow:'ACCOUNTABILITY', title:'Every important action is traceable', text:'Search, retain and export administrative, workflow, identity, payment and security events.', action:'Export logs', cards:[['Events today','18,429','Across 3 businesses'],['Retention','365 days','Policy controlled'],['Integrity checks','Passed','Last verified 3 min ago']], layout:'register', registerColumns:['EVENT','STATUS','ACTOR','CATEGORY','TIME'], registerRows:[
    {icon:'✓',primary:'Business readiness updated to 100%',secondary:'Setup & launch',status:'Recorded',statusClass:'good',col2:'Henry A.',col3:'Business',col4:'2m ago'},
    {icon:'◉',primary:'Channel published: Web chat',secondary:'Channels',status:'Recorded',statusClass:'good',col2:'Henry A.',col3:'Channel',col4:'14m ago'},
    {icon:'▤',primary:'Template imported: Identity Verification & Consent',secondary:'Fund Request Desk',status:'Recorded',statusClass:'good',col2:'Henry A.',col3:'Template',col4:'1h ago'},
    {icon:'<>',primary:'API key rotated',secondary:'Configuration',status:'Recorded',statusClass:'good',col2:'System',col3:'Security',col4:'3h ago'},
    {icon:'₦',primary:'Payment provider credential updated',secondary:'Configuration',status:'Recorded',statusClass:'good',col2:'Chidinma Okeke',col3:'Security',col4:'Yesterday'},
  ], inspector:{heading:'Channel published: Web chat',description:'Full-fidelity record of who acted, what changed and the before/after state, retained for the policy period.',facts:[['Actor','Henry A.'],['Category','Channel management'],['Retention','365 days'],['Export format','CSV, JSON']],primary:'Export this event'} },
  'Marketplace & partners': { eyebrow:'ECOSYSTEM', title:'Extend BEMS Group', text:'Install connectors, service packs and AI skills or collaborate with approved implementation partners.', action:'Browse marketplace', cards:[['Available connectors','84','12 recommended'],['Installed','11','All up to date'],['Approved partners','26','Across 7 countries']], layout:'cards', cardsData:[
    {icon:'₦',title:'Paystack — payment connector',badge:'INSTALLED',description:'Payment orchestration across cards, transfers and USSD.',facts:[['Version','v4.2'],['Status','Up to date']],action:'Manage connector'},
    {icon:'◈',title:'Termii — OTP provider',badge:'UPDATE',description:'Handles OTP delivery for authentication and confirmations.',facts:[['Installed','v2.1'],['Latest','v2.3']],action:'Update connector'},
    {icon:'◎',title:'HubSpot — CRM sync',badge:'INSTALLED',description:'Syncs customer and lead data with HubSpot.',facts:[['Version','v1.8'],['Status','Up to date']],action:'Manage connector'},
    {icon:'⌾',title:'Smile Identity — verification',badge:'AVAILABLE',description:'Identity verification across 6 African countries.',facts:[['Category','Identity & OTP'],['Status','Not installed']],action:'Install connector'},
    {icon:'⬡',title:'Kola Digital — Lagos',badge:'PARTNER',description:'Implementation partner for advanced workflow builds.',facts:[['Type','Implementation'],['Region','Lagos']],action:'Contact partner'},
  ], inspector:{heading:'Termii — OTP provider',description:'Handles one-time-password delivery for authentication and transaction confirmation across SMS and voice.',facts:[['Category','Identity & OTP'],['Installed version','2.1'],['Latest version','2.3'],['Monthly usage','18K sends']],primary:'Update connector'} },
  'Accounts & wallets': { eyebrow:'ACCOUNTS & WALLETS', title:'Every balance, in one ledger', text:'Track account and wallet balances, holds, limits and linked payment instruments across this business.', action:'Create account rule', cards:[['Active accounts','4,218','Across 3 wallet types'],['Total balance','₦284.6M','Across all customers'],['Holds & limits','62','Under policy review']], layout:'register', registerColumns:['WALLET','STATUS','TYPE','BALANCE','TIME'], registerRows:[
    {icon:'◎',primary:'Amina Okafor — Primary wallet',secondary:'Personal wallet',status:'Active',statusClass:'good',col2:'Primary',col3:'₦482,000',col4:'2m ago'},
    {icon:'◎',primary:'Tunde Martins — Savings wallet',secondary:'Auto-save enabled',status:'Active',statusClass:'good',col2:'Savings',col3:'₦1,204,500',col4:'18m ago'},
    {icon:'◎',primary:'Nnenna Eze — Business wallet',secondary:'Merchant account',status:'Active',statusClass:'good',col2:'Business',col3:'₦8,420,000',col4:'31m ago'},
    {icon:'⌾',primary:'Bola Ibrahim — Wallet frozen',secondary:'Pending fraud review',status:'Review',statusClass:'review',col2:'Personal',col3:'₦96,400',col4:'1h ago'},
    {icon:'✕',primary:'Chidi Okoro — Wallet closed',secondary:'Customer requested closure',status:'Closed',statusClass:'expired',col2:'Personal',col3:'₦0',col4:'Yesterday'},
  ], inspector:{heading:'Bola Ibrahim — Wallet frozen',description:'Automatic freeze triggered by an unusual transaction pattern; awaiting risk team confirmation before release.',facts:[['Balance','₦96,400'],['Freeze reason','Velocity rule triggered'],['Assigned to','Risk team'],['Time frozen','58 minutes']],primary:'Review wallet'} },
  Catalogue: { eyebrow:'PRODUCT CATALOGUE', title:'What customers can discover and buy', text:'Manage products, pricing, variants and availability across every conversational and web storefront.', action:'Add product', cards:[['Live products','842','Across 12 categories'],['Out of stock','18','Auto-hidden from customers'],['Catalogue completeness','91%','9% missing images or pricing']], layout:'cards', cardsData:[
    {icon:'▦',title:'Ankara print maxi dress',badge:'IN STOCK',description:'Best-selling apparel item across 4 variants.',facts:[['Price','₦18,500'],['Variants','4']],action:'Edit product'},
    {icon:'♪',title:'NovaSound X2 earbuds',badge:'LOW STOCK',description:'Best-selling audio accessory, 2 colours.',facts:[['Price','₦42,000'],['Stock','14 units']],action:'Restock'},
    {icon:'▣',title:'Kitchen blender 1.5L',badge:'IN STOCK',description:'Popular kitchen appliance.',facts:[['Price','₦31,000'],['Stock','62 units']],action:'Edit product'},
    {icon:'◈',title:'Leather sneakers',badge:'DRAFT',description:'Missing product images — not visible to customers.',facts:[['Price','₦27,500'],['Sizes','5']],action:'Add images'},
    {icon:'♬',title:'Bluetooth speaker mini',badge:'OUT OF STOCK',description:'Compact speaker, currently unavailable.',facts:[['Price','₦15,800'],['Stock','0 units']],action:'Restock'},
  ], inspector:{heading:'Wireless earbuds — NovaSound X2',description:'Best-selling audio accessory; stock running low ahead of the weekend promotion.',facts:[['Stock remaining','14 units'],['30-day sales','386 units'],['Channels','WhatsApp, Web, Instagram'],['Reorder point','20 units']],primary:'Restock product'} },
  Inventory: { eyebrow:'INVENTORY', title:'Stock levels customers can trust', text:'Keep availability accurate across every channel with real-time stock, reservations and supplier visibility.', action:'Adjust stock', cards:[['Total SKUs','842','Across 3 warehouses'],['Low stock alerts','24','Reorder recommended'],['Stock accuracy','97.4%','Last cycle count']], layout:'register', registerColumns:['SKU','STATUS','WAREHOUSE','STOCK','UPDATED'], registerRows:[
    {icon:'♪',primary:'NovaSound X2 earbuds',secondary:'Electronics',status:'Low stock',statusClass:'review',col2:'Lagos',col3:'14 units',col4:'Today'},
    {icon:'▦',primary:'Ankara maxi dress — Blue, M',secondary:'Apparel',status:'In stock',statusClass:'good',col2:'Lagos',col3:'62 units',col4:'Today'},
    {icon:'▣',primary:'Kitchen blender 1.5L',secondary:'Home appliances',status:'Out of stock',statusClass:'expired',col2:'Abuja',col3:'0 units',col4:'3 days ago'},
    {icon:'♬',primary:'Bluetooth speaker mini',secondary:'Electronics',status:'Out of stock',statusClass:'expired',col2:'Lagos',col3:'0 units',col4:'2 days ago'},
    {icon:'◈',primary:'Leather sneakers — Size 42',secondary:'Footwear',status:'In stock',statusClass:'good',col2:'Port Harcourt',col3:'38 units',col4:'Today'},
  ], inspector:{heading:'Kitchen blender 1.5L',description:'Out of stock at the Abuja warehouse for 3 days; a supplier reorder was placed but has not yet arrived.',facts:[['Warehouse','Abuja'],['Reorder status','Placed 3 days ago'],['Expected arrival','2 days'],['Affected orders','6 pending']],primary:'View reorder'} },
  Promotions: { eyebrow:'PROMOTIONS', title:'Reward customers without eroding margin', text:'Create discounts, bundles and time-limited offers with rules that protect margin and prevent abuse.', action:'Create promotion', cards:[['Active promotions','5','Across 3 categories'],['Redemptions','1,842','This month'],['Margin impact','-3.2%','Within approved range']], layout:'cards', cardsData:[
    {icon:'⚡',title:'Weekend flash sale — Electronics',badge:'LIVE',description:'15% off electronics, ends Sunday.',facts:[['Redemptions','842'],['Ends','Sunday']],action:'End early'},
    {icon:'＋',title:'First order discount',badge:'LIVE',description:'₦2,000 off orders over ₦15,000.',facts:[['Redemptions','1,204'],['Status','Always on']],action:'Edit rule'},
    {icon:'♪',title:'Bundle: Earbuds + speaker',badge:'LIVE',description:'Save ₦6,500 on the bundle.',facts:[['Redemptions','196'],['Savings','₦6,500']],action:'Edit bundle'},
    {icon:'☆',title:'Loyalty double-points weekend',badge:'SCHEDULED',description:'Gold & Platinum tiers only.',facts:[['Starts','Friday'],['Tiers','Gold, Platinum']],action:'Preview'},
    {icon:'▥',title:'Clearance: last season apparel',badge:'ENDED',description:'Up to 40% off, campaign concluded.',facts:[['Redemptions','2,481'],['Discount','Up to 40%']],action:'View report'},
  ], inspector:{heading:'Weekend flash sale — Electronics',description:'Time-limited discount on electronics to clear excess stock ahead of the new NovaSound shipment.',facts:[['Discount','15% off'],['Category','Electronics'],['Ends','Sunday, 11:59pm'],['Redemptions so far','842']],primary:'End promotion early'} },
  'Care journeys': { eyebrow:'CARE JOURNEYS', title:'Guide patients from booking to recovery', text:'Design multi-step care journeys spanning booking, reminders, results and follow-up across every channel.', action:'Create journey', cards:[['Active journeys','9','Across 4 departments'],['Patients enrolled','2,406','This month'],['Completion rate','86.4%','Up 5.2%']], layout:'progress', progressData:[
    {icon:'◎',title:'Antenatal care programme',description:'12-week journey, 340 enrolled.',stat:'On track',percent:88,action:'Open journey'},
    {icon:'✓',title:'Post-surgery follow-up',description:'6-touchpoint journey, 84 enrolled.',stat:'On track',percent:91,action:'Open journey'},
    {icon:'!',title:'Chronic care: hypertension',description:'Monthly check-ins, 612 enrolled, 2 flagged.',stat:'2 flagged',percent:91,action:'Review flagged'},
    {icon:'✓',title:'Vaccination reminder series',description:'3-dose schedule, 1,204 enrolled.',stat:'On track',percent:85,action:'Open journey'},
    {icon:'◇',title:'New patient onboarding',description:'4-step journey, draft revision.',stat:'In review',percent:40,action:'Review draft'},
  ], inspector:{heading:'Chronic care: hypertension',description:'Monthly check-in journey with automated BP log reminders and clinician escalation for out-of-range readings.',facts:[['Enrolled patients','612'],['Flagged this week','2'],['Escalation path','Provider desk'],['Completion rate','91.2%']],primary:'Open journey builder'} },
  'Clinical documents': { eyebrow:'CLINICAL DOCUMENTS', title:'Every record, verified and traceable', text:'Capture, verify and store lab results, prescriptions and consent forms with full patient-level audit history.', action:'Request document', cards:[['Documents this month','3,842','Across 4 departments'],['Auto-verified','88.1%','Policy-compliant'],['Pending review','46','Average 22 minutes']], layout:'register', registerColumns:['DOCUMENT','STATUS','TYPE','CLINICIAN','TIME'], registerRows:[
    {icon:'◈',primary:'Amina Okafor — Lab results',secondary:'Malaria panel',status:'Passed',statusClass:'good',col2:'Lab result',col3:'Auto-verified',col4:'12m ago'},
    {icon:'✎',primary:'Tunde Martins — Prescription renewal',secondary:'Countersignature required',status:'Pending',statusClass:'review',col2:'Prescription',col3:'Dr. Chika Nweke',col4:'40m ago'},
    {icon:'✓',primary:'Nnenna Eze — Consent for procedure',secondary:'Signed consent form',status:'Passed',statusClass:'good',col2:'Consent',col3:'Auto-verified',col4:'1h ago'},
    {icon:'◈',primary:'Bola Ibrahim — Referral letter',secondary:'Specialist referral',status:'Pending',statusClass:'review',col2:'Referral',col3:'Manual review',col4:'2h ago'},
    {icon:'✓',primary:'Chidi Okoro — Discharge summary',secondary:'Inpatient discharge',status:'Passed',statusClass:'good',col2:'Discharge',col3:'Auto-verified',col4:'Yesterday'},
  ], inspector:{heading:'Tunde Martins — Prescription renewal',description:'Renewal request requires clinician countersignature before it can be released to the pharmacy partner.',facts:[['Document type','Prescription renewal'],['Assigned clinician','Dr. Chika Nweke'],['Queue position','2 of 46'],['SLA','Average 22 minutes']],primary:'Send for signature'} },
  'Provider desk': { eyebrow:'PROVIDER DESK', title:'Where clinicians see what matters', text:'Give doctors and nurses a focused queue of patients, results and escalations without leaving the conversation.', action:'Assign provider', cards:[['On duty','8 providers','Across 3 departments'],['Open queue','14 patients','Avg. wait 6 minutes'],['Escalations today','3','All acknowledged']], layout:'queue', queue:[['Amina Okafor — Results ready for review','Dr. Chika Nweke','4m ago','Awaiting review'],['Tunde Martins — Escalated: BP reading high','Dr. Femi Adeyemi','12m ago','Acknowledged'],['Nnenna Eze — Follow-up call requested','Nurse Grace Bello','28m ago','Scheduled'],['Bola Ibrahim — New patient intake','Dr. Chika Nweke','44m ago','In progress'],['Chidi Okoro — Prescription countersign','Dr. Femi Adeyemi','1h ago','Completed']], inspector:{heading:'Tunde Martins — Escalated: BP reading high',description:'Automated monitoring flagged an out-of-range reading from the hypertension care journey; provider acknowledged within 2 minutes.',facts:[['Reading','162/98 mmHg'],['Provider','Dr. Femi Adeyemi'],['Response time','2 minutes'],['Next step','Same-day call scheduled']],primary:'View patient record'} },
};

const emptyOnboarding: OnboardingData = {
  businessName:'', industry:'Financial services', size:'1–10 employees', country:'Nigeria', goals:[], plan:'Growth',
};

function AuthGate({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [view, setView] = useState<'login' | 'signup' | 'pending' | 'setup'>('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupStep, setSignupStep] = useState(1);
  const [registeredEmpNumber, setRegisteredEmpNumber] = useState('');
  const [registeredName, setRegisteredName] = useState('');

  const [signupForm, setSignupForm] = useState({
    avatarUrl: '',
    fullName: '',
    email: '',
    phone: '+234 ',
    gender: 'MALE',
    dateOfBirth: '',
    maritalStatus: 'SINGLE',
    stateOfOrigin: '',
    lga: '',
    nin: '',
    residentialAddress: '',
    cityState: '',
    subsidiaryId: '',
    departmentId: '',
    jobTitle: '',
    employmentType: 'FULL_TIME',
    staffGrade: 'OFFICER',
    workLocation: 'LAGOS_HQ',
    resumptionDate: '',
    bankName: 'Access Bank Plc',
    accountNumber: '',
    accountName: '',
    bvn: '',
    useSameAccountForSalary: true,
    salaryBankName: 'Access Bank Plc',
    salaryAccountNumber: '',
    salaryAccountName: '',
    highestEducation: 'BSC',
    nextOfKinName: '',
    nextOfKinPhone: '+234 ',
    nextOfKinRelationship: 'Spouse',
    nextOfKinAddress: '',
    password: '',
    agreeTerms: false,
  });

  const [options, setOptions] = useState<{
    organizations: { id: string; legalName: string; code: string }[];
    departments: { id: string; name: string; code: string; organizationId: string }[];
    banks: string[];
    employmentTypes: { value: string; label: string }[];
    staffGrades: { value: string; label: string }[];
    workLocations: { value: string; label: string }[];
    maritalStatuses: { value: string; label: string }[];
    educationLevels: { value: string; label: string }[];
  }>({
    organizations: [],
    departments: [],
    banks: [],
    employmentTypes: [],
    staffGrades: [],
    workLocations: [],
    maritalStatuses: [],
    educationLevels: [],
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [bootstrapConfigured, setBootstrapConfigured] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [bootstrapStep, setBootstrapStep] = useState<'form' | 'verify'>('form');
  const [bootstrapOtp, setBootstrapOtp] = useState('');
  const [bootstrapNotice, setBootstrapNotice] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devRoles, setDevRoles] = useState<{ role: string; label: string }[]>([]);
  const [devRoleBusy, setDevRoleBusy] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const emailParam = sp.get('email');
      if (emailParam) {
        setLoginForm(prev => ({ ...prev, email: emailParam }));
      }
    }
    fetch('/api/auth/bootstrap').then(r => r.json()).then(d => { setBootstrapAvailable(Boolean(d.available)); setBootstrapConfigured(Boolean(d.configured)); setAdminExists(Boolean(d.adminExists)); }).catch(() => setBootstrapAvailable(false));
    fetch('/api/auth/dev-role').then(r => r.ok ? r.json() : null).then(d => { if (d?.enabled) setDevRoles(d.roles || []); }).catch(() => setDevRoles([]));
    fetch('/api/auth/signup/options').then(r => r.json()).then(d => {
      if (d && d.organizations) {
        setOptions(d);
        if (d.organizations.length > 0) {
          setSignupForm(prev => ({
            ...prev,
            subsidiaryId: prev.subsidiaryId || d.organizations[0].id,
            bankName: prev.bankName || (d.banks?.[0] || 'Access Bank Plc'),
            salaryBankName: prev.salaryBankName || (d.banks?.[0] || 'Access Bank Plc'),
            staffGrade: prev.staffGrade || (d.staffGrades?.[2]?.value || 'OFFICER'),
            workLocation: prev.workLocation || (d.workLocations?.[0]?.value || 'LAGOS_HQ'),
            maritalStatus: prev.maritalStatus || (d.maritalStatuses?.[0]?.value || 'SINGLE'),
            highestEducation: prev.highestEducation || (d.educationLevels?.[0]?.value || 'BSC'),
          }));
        }
      }
    }).catch(() => {});
  }, []);


  const submitLogin = (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    authRequest<{ user?: AuthUser; error?: string; pendingApproval?: boolean }>('/api/auth/login', { email: loginForm.email, password: loginForm.password }).then(({ ok, data }) => {
      setBusy(false);
      if (ok && data.user) { onAuthed(data.user); return; }
      setError(data.error || 'Could not sign in.');
    });
  };

  const submitSignup = (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    authRequest<{ user?: AuthUser; error?: string; pendingApproval?: boolean; employeeNumber?: string }>('/api/auth/signup', signupForm)
      .then(({ ok, data }) => {
        setBusy(false);
        if (ok && data.pendingApproval) {
          setRegisteredEmpNumber(data.employeeNumber || '');
          setRegisteredName(signupForm.fullName);
          setView('pending');
          return;
        }
        setError(data.error || 'Could not complete staff registration. Please try again.');
      })
      .catch((err) => {
        setBusy(false);
        setError('Network connection error or server timeout. Please try again.');
      });
  };

  const requestBootstrapCode = (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError(''); setBootstrapNotice(''); setBusy(true);
    authRequest<{ ok?: boolean; message?: string; error?: string }>('/api/auth/bootstrap', {
      action: 'send_code',
      bootstrapSecret,
      fullName: signupForm.fullName || 'System Admin',
      email: loginForm.email,
      password: loginForm.password,
    }).then(({ ok, data }) => {
      setBusy(false);
      if (ok && data.ok) {
        setBootstrapStep('verify');
        setBootstrapNotice(data.message || `Verification code sent to ${loginForm.email}`);
        setResendCooldown(60);
        return;
      }
      setError(data.error || 'Could not send verification code.');
    }).catch(() => {
      setBusy(false);
      setError('Network connection error. Please try again.');
    });
  };

  const submitBootstrapVerify = (e: FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    authRequest<{ user?: AuthUser; error?: string }>('/api/auth/bootstrap', {
      action: 'verify',
      bootstrapSecret,
      fullName: signupForm.fullName || 'System Admin',
      email: loginForm.email,
      password: loginForm.password,
      code: bootstrapOtp.trim(),
    }).then(({ ok, data }) => {
      setBusy(false);
      if (ok && data.user) {
        onAuthed(data.user);
        return;
      }
      setError(data.error || 'Invalid verification code or setup error.');
    }).catch(() => {
      setBusy(false);
      setError('Network connection error. Please try again.');
    });
  };

  const enterDevRole = async (role: string) => {
    setError(''); setDevRoleBusy(role);
    try {
      const { ok, data } = await authRequest<{ user?: AuthUser; error?: string }>('/api/auth/dev-role', { role });
      if (ok && data.user) { onAuthed(data.user); return; }
      setError(data.error || 'Could not open that role.');
    } catch {
      setError('Could not reach the local role access service. Try again.');
    } finally { setDevRoleBusy(''); }
  };

  const filteredDepartments = options.departments.filter(d => !signupForm.subsidiaryId || d.organizationId === signupForm.subsidiaryId);

  return <main className="onboarding-shell">
    <section className="onboarding-brand-panel">
      <div className="circuit-art" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <div className="onboarding-brand"><img src="/bems-group-logo.png?v=20261024" alt=""/><div><strong>BEMS</strong><span>GROUP</span></div></div>
      <div className="onboarding-promise">
        <span>BEMS GROUP EXPENDITURE & ACCOUNTABILITY</span>
        <h1>Enterprise Expenditure, Requisition & Staff Accountability.</h1>
        <p>Official corporate registration for all subsidiary staff. Requisitions, bank disbursements, and 72-hour evidence close-outs in one unified ledger.</p>
      </div>
      <div className="trust-list">
        <span>✓ Automated Unique BEMS Staff Identity Number</span>
        <span>✓ Verified Disbursement Bank Account for Advances</span>
        <span>✓ 5-Tier Review Ladder & 72h Evidence Compliance</span>
      </div>
      <small>© 2026 BEMS Group Holdings Limited</small>
    </section>

    <section className="onboarding-main">
      <header className="onboarding-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/download" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', textDecoration: 'none', background: '#fff7ed', border: '1px solid #fed7aa', padding: '6px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>📱</span> Download Mobile Apps (APK)
          </a>
          <span>
            {view==='login' ? 'Sign in' : view==='signup' ? `Staff Registration (Step ${signupStep} of 4)` : view==='setup' ? 'Initial admin setup' : 'Registration Complete'}
          </span>
        </div>
      </header>

      <div className="onboarding-progress">
        <i style={{
          width: view==='pending' ? '100%' : view==='signup' ? `${(signupStep / 4) * 100}%` : '50%'
        }}/>
      </div>

      {view==='login' && <form className="journey-card" onSubmit={submitLogin}>
        {!adminExists && bootstrapAvailable && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ color: '#b45309', fontWeight: 800, fontSize: 13, letterSpacing: '0.05em', marginBottom: 4 }}>
              ⚡ INITIAL WORKSPACE SETUP
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#78350f', lineHeight: 1.4 }}>
              Zero accounts currently exist. As the system administrator, set up the root System Admin account to begin onboarding leadership roles.
            </p>
            <button
              type="button"
              onClick={() => { setError(''); setView('setup'); }}
              style={{
                display: 'inline-block',
                background: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Set up First System Admin →
            </button>
          </div>
        )}
        <p className="kicker">WELCOME BACK</p><h2>Sign in to BEMS Group</h2><p className="lead">Sign in with your approved BEMS Group work email.</p>
        <div className="form-grid">
          <label className="full">Email<input required type="email" value={loginForm.email} onChange={e=>setLoginForm(old=>({...old, email: e.target.value}))} placeholder="you@company.com"/></label>
          <label className="full">Password<input required type="password" value={loginForm.password} onChange={e=>setLoginForm(old=>({...old, password: e.target.value}))} placeholder="Your password"/></label>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <footer className="journey-actions"><span/><button className="continue-button" disabled={busy}>{busy?'Signing in…':'Sign in'} <span>→</span></button></footer>
      </form>}

      {view==='login' && devRoles.length > 0 && <section className="journey-card" aria-label="Local role access" style={{ marginTop: 18, paddingTop: 18, paddingBottom: 18 }}>
        <p className="kicker">LOCAL TESTING</p><h2 style={{ fontSize: 18 }}>Open a role directly</h2><p className="lead">Development access only. Choose one of the workspace roles.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{devRoles.map(({ role, label }) => <button key={role} type="button" className="continue-button" disabled={Boolean(devRoleBusy)} onClick={() => void enterDevRole(role)}>{devRoleBusy === role ? 'Opening…' : label}</button>)}</div>
      </section>}

      {view==='signup' && (
        <form className="journey-card" onSubmit={(e) => {
          e.preventDefault();
          if (signupStep === 1) {
            if (!signupForm.avatarUrl) {
              setError('Passport photograph is mandatory. Please upload or take your profile picture.');
              return;
            }
          }
          if (signupStep === 3 && !signupForm.useSameAccountForSalary) {
            if (!signupForm.salaryAccountNumber || signupForm.salaryAccountNumber.length !== 10) {
              setError('Please enter a valid 10-digit NUBAN account number for your dedicated salary account.');
              return;
            }
            if (!signupForm.salaryAccountName.trim()) {
              setError('Please enter the official account holder name for your dedicated salary account.');
              return;
            }
          }
          if (signupStep < 4) {
            setError('');
            setSignupStep(signupStep + 1);
          } else {
            submitSignup(e);
          }
        }}>
          {signupStep === 1 && (
            <>
              <p className="kicker">STEP 1 OF 4 · PERSONAL & STATUTORY IDENTITY</p>
              <h2>Staff Personal & Identity Dossier</h2>
              <p className="lead">Enter your official legal identity and national statutory details as verified on official records.</p>
              
              {/* Mandatory Passport / Profile Photograph Upload */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0 20px', padding: 16, background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0' }}>
                <div style={{ position: 'relative', width: 92, height: 92, borderRadius: '50%', background: '#FFFFFF', border: signupForm.avatarUrl ? '3px solid #10B981' : '3px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.04)' }}>
                  {signupForm.avatarUrl ? (
                    <img src={signupForm.avatarUrl} alt="Staff Passport" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                      <span style={{ fontSize: 28, display: 'block' }}>📷</span>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>NO PHOTO</span>
                    </div>
                  )}
                </div>

                <label style={{ marginTop: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: signupForm.avatarUrl ? '#ECFDF5' : '#FFF7ED', border: `1px solid ${signupForm.avatarUrl ? '#A7F3D0' : '#FED7AA'}`, borderRadius: 10, color: signupForm.avatarUrl ? '#059669' : '#EA580C', fontSize: 12.5, fontWeight: 800 }}>
                  {signupForm.avatarUrl ? '✓ Photo Attached (Click to Change)' : '📷 Upload Passport Photo *'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        const res = await fetch('/api/upload', { method: 'POST', body: fd });
                        const data = await res.json();
                        if (data.url) {
                          setSignupForm(old => ({ ...old, avatarUrl: data.url }));
                          setError('');
                        } else {
                          setError(data.error || 'Failed to upload photo');
                        }
                      } catch {
                        setError('Photo upload network error. Please try again.');
                      }
                    }}
                  />
                </label>
                <span style={{ fontSize: 11, color: '#64748B', marginTop: 5 }}>
                  * Mandatory face photo for corporate badge & verified banking dossier
                </span>
              </div>

              <div className="form-grid">
                <label className="full">
                  Full Legal Name *
                  <input
                    required
                    value={signupForm.fullName}
                    onChange={e => setSignupForm(old => ({ ...old, fullName: e.target.value }))}
                    placeholder="e.g. Babatunde Adeleke"
                  />
                </label>
                <label>
                  Work / Personal Email *
                  <input
                    required
                    type="email"
                    value={signupForm.email}
                    onChange={e => setSignupForm(old => ({ ...old, email: e.target.value }))}
                    placeholder="name@company.com"
                  />
                </label>
                <label>
                  Phone Number (WhatsApp) *
                  <input
                    required
                    type="tel"
                    value={signupForm.phone}
                    onChange={e => setSignupForm(old => ({ ...old, phone: e.target.value }))}
                    placeholder="+234 803 000 0000"
                  />
                </label>
                <label>
                  Gender *
                  <select
                    value={signupForm.gender}
                    onChange={e => setSignupForm(old => ({ ...old, gender: e.target.value }))}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other / Prefer not to say</option>
                  </select>
                </label>
                <label>
                  Marital Status *
                  <select
                    value={signupForm.maritalStatus}
                    onChange={e => setSignupForm(old => ({ ...old, maritalStatus: e.target.value }))}
                  >
                    {(options.maritalStatuses.length > 0 ? options.maritalStatuses : [
                      { value: 'SINGLE', label: 'Single' },
                      { value: 'MARRIED', label: 'Married' },
                      { value: 'DIVORCED', label: 'Divorced' },
                      { value: 'WIDOWED', label: 'Widowed' },
                    ]).map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Date of Birth
                  <input
                    type="date"
                    value={signupForm.dateOfBirth}
                    onChange={e => setSignupForm(old => ({ ...old, dateOfBirth: e.target.value }))}
                  />
                </label>
                <label>
                  National Identity Number (NIN)
                  <input
                    maxLength={11}
                    value={signupForm.nin}
                    onChange={e => setSignupForm(old => ({ ...old, nin: e.target.value.replace(/\D/g, '') }))}
                    placeholder="11-digit NIN"
                  />
                </label>
                <label>
                  State of Origin *
                  <select
                    required
                    value={signupForm.stateOfOrigin}
                    onChange={e => {
                      const selectedState = e.target.value;
                      setSignupForm(old => ({
                        ...old,
                        stateOfOrigin: selectedState,
                        lga: '',
                      }));
                    }}
                  >
                    <option value="">Select State of Origin...</option>
                    {NIGERIAN_STATES.map(s => (
                      <option key={s} value={s}>{s} State</option>
                    ))}
                  </select>
                </label>
                <label>
                  Local Govt Area (LGA) *
                  {signupForm.stateOfOrigin && NIGERIAN_STATE_LGAS[signupForm.stateOfOrigin]?.length > 0 ? (
                    <select
                      value={signupForm.lga}
                      onChange={e => setSignupForm(old => ({ ...old, lga: e.target.value }))}
                    >
                      <option value="">Select Local Govt Area...</option>
                      {NIGERIAN_STATE_LGAS[signupForm.stateOfOrigin].map(lgaName => (
                        <option key={lgaName} value={lgaName}>{lgaName}</option>
                      ))}
                      <option value="Other LGA">Other / Not listed</option>
                    </select>
                  ) : (
                    <input
                      value={signupForm.lga}
                      onChange={e => setSignupForm(old => ({ ...old, lga: e.target.value }))}
                      placeholder={signupForm.stateOfOrigin ? "Enter LGA name" : "Select State of Origin first"}
                    />
                  )}
                </label>
                <label className="full">
                  Residential Street Address
                  <input
                    value={signupForm.residentialAddress}
                    onChange={e => setSignupForm(old => ({ ...old, residentialAddress: e.target.value }))}
                    placeholder="House number, Street, Landmark"
                  />
                </label>
                <label className="full">
                  City & State of Residence *
                  <select
                    value={signupForm.cityState}
                    onChange={e => setSignupForm(old => ({ ...old, cityState: e.target.value }))}
                  >
                    <option value="">Select City & State of Residence...</option>
                    {RESIDENTIAL_CITIES_AND_STATES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          {signupStep === 2 && (
            <>
              <p className="kicker">STEP 2 OF 4 · CORPORATE PLACEMENT & ROLE</p>
              <h2>Subsidiary, Role, Grade & Employment Type</h2>
              <p className="lead">Specify your operational designation, subsidiary placement, grade level, and physical station.</p>
              <div className="form-grid">
                <label className="full">
                  Subsidiary Entity *
                  <select
                    required
                    value={signupForm.subsidiaryId}
                    onChange={e => setSignupForm(old => ({ ...old, subsidiaryId: e.target.value }))}
                  >
                    {options.organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.legalName} ({org.code})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Department / Unit
                  <select
                    value={signupForm.departmentId}
                    onChange={e => setSignupForm(old => ({ ...old, departmentId: e.target.value }))}
                  >
                    <option value="">General Operations / Unassigned</option>
                    {filteredDepartments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Employment Type *
                  <select
                    value={signupForm.employmentType}
                    onChange={e => setSignupForm(old => ({ ...old, employmentType: e.target.value }))}
                  >
                    {(options.employmentTypes.length > 0 ? options.employmentTypes : [
                      { value: 'FULL_TIME', label: 'Full-Time (Permanent Staff)' },
                      { value: 'PROBATION', label: 'Probationary Staff (3-6 Months)' },
                      { value: 'CONTRACT', label: 'Fixed-Term Contract' },
                      { value: 'INTERN', label: 'Graduate Intern / NYSC Trainee' },
                      { value: 'PART_TIME', label: 'Part-Time Specialist' },
                    ]).map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Designation / Operational Role *
                  <input
                    required
                    value={signupForm.jobTitle}
                    onChange={e => setSignupForm(old => ({ ...old, jobTitle: e.target.value }))}
                    placeholder="e.g. Operations Lead, Software Developer, Accountant, Sales Executive"
                  />
                </label>
                <label>
                  Staff Grade / Hierarchy Level *
                  <select
                    value={signupForm.staffGrade}
                    onChange={e => setSignupForm(old => ({ ...old, staffGrade: e.target.value }))}
                  >
                    {(options.staffGrades.length > 0 ? options.staffGrades : [
                      { value: 'INTERN_TRAINEE', label: 'Intern / Graduate Trainee' },
                      { value: 'JUNIOR_OFFICER', label: 'Junior Officer (Level 1)' },
                      { value: 'OFFICER', label: 'Officer / Specialist (Level 2)' },
                      { value: 'SENIOR_OFFICER', label: 'Senior Officer (Level 3)' },
                      { value: 'TEAM_LEAD', label: 'Team Lead / Unit Supervisor (Level 4)' },
                      { value: 'MANAGER', label: 'Department Manager (Level 5)' },
                    ]).map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Primary Work Location / Station *
                  <select
                    value={signupForm.workLocation}
                    onChange={e => setSignupForm(old => ({ ...old, workLocation: e.target.value }))}
                  >
                    {(options.workLocations.length > 0 ? options.workLocations : [
                      { value: 'LAGOS_HQ', label: 'Lagos Corporate HQ (Victoria Island / Lekki)' },
                      { value: 'BENIN_OPS_HUB', label: 'Benin Regional Operations & Logistics Hub' },
                      { value: 'ABUJA_OFFICE', label: 'Abuja Regional Liaison Hub' },
                      { value: 'PORT_HARCOURT', label: 'Port Harcourt Operations Office' },
                      { value: 'FIELD_REMOTE', label: 'Field Operations / Remote Station' },
                    ]).map(loc => (
                      <option key={loc.value} value={loc.value}>{loc.label}</option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Resumption / Start Date
                  <input
                    type="date"
                    value={signupForm.resumptionDate}
                    onChange={e => setSignupForm(old => ({ ...old, resumptionDate: e.target.value }))}
                  />
                </label>
              </div>
            </>
          )}

          {signupStep === 3 && (
            <>
              <p className="kicker">STEP 3 OF 4 · DISBURSEMENT BANKING & KYC</p>
              <h2>Disbursement Account & Financial KYC</h2>
              <p className="lead">Approved fund requests and cash advances will be wired directly to this commercial bank account.</p>
              <div className="form-grid">
                <label className="full">
                  Commercial Bank Name *
                  <select
                    required
                    value={signupForm.bankName}
                    onChange={e => setSignupForm(old => ({ ...old, bankName: e.target.value }))}
                  >
                    {options.banks.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Account Number (10-Digit NUBAN) *
                  <input
                    required
                    type="text"
                    maxLength={10}
                    value={signupForm.accountNumber}
                    onChange={e => setSignupForm(old => ({ ...old, accountNumber: e.target.value.replace(/\D/g, '') }))}
                    placeholder="0123456789"
                  />
                </label>
                <label>
                  Account Holder Name *
                  <input
                    required
                    value={signupForm.accountName}
                    onChange={e => setSignupForm(old => ({ ...old, accountName: e.target.value }))}
                    placeholder="Must match your official name"
                  />
                </label>
                <label className="full">
                  Bank Verification Number (BVN)
                  <input
                    maxLength={11}
                    value={signupForm.bvn}
                    onChange={e => setSignupForm(old => ({ ...old, bvn: e.target.value.replace(/\D/g, '') }))}
                    placeholder="11-digit BVN for automated financial compliance"
                  />
                </label>
              </div>

              {/* Dual Banking: Salary Account Option */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <div 
                  onClick={() => setSignupForm(old => ({ ...old, useSameAccountForSalary: !old.useSameAccountForSalary }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: signupForm.useSameAccountForSalary ? '#f0fdf4' : '#fff7ed',
                    border: `1.5px solid ${signupForm.useSameAccountForSalary ? '#86efac' : '#fdba74'}`,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={signupForm.useSameAccountForSalary}
                    onChange={e => setSignupForm(old => ({ ...old, useSameAccountForSalary: e.target.checked }))}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 18, height: 18, accentColor: '#ea580c', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: signupForm.useSameAccountForSalary ? '#166534' : '#9a3412' }}>
                      {signupForm.useSameAccountForSalary 
                        ? '✓ Using this same account for monthly salary payments' 
                        : 'Entering a separate bank account for salary payment'}
                    </div>
                    <div style={{ fontSize: 11.5, color: signupForm.useSameAccountForSalary ? '#15803d' : '#c2410c' }}>
                      {signupForm.useSameAccountForSalary 
                        ? 'Click here to uncheck if you wish to provide a different bank account for your monthly wages.' 
                        : 'Click here if you prefer to use the same account for both expenses and salary.'}
                    </div>
                  </div>
                </div>

                {!signupForm.useSameAccountForSalary && (
                  <div style={{
                    marginTop: 14,
                    padding: '16px 18px',
                    borderRadius: 8,
                    background: '#fcfcfc',
                    border: '1.5px solid #ea580c',
                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#c2410c', fontWeight: 700, fontSize: 13 }}>
                      <span>💼</span> Dedicated Salary Payment Bank Account
                    </div>
                    <div className="form-grid">
                      <label className="full">
                        Salary Commercial Bank Name *
                        <select
                          required={!signupForm.useSameAccountForSalary}
                          value={signupForm.salaryBankName}
                          onChange={e => setSignupForm(old => ({ ...old, salaryBankName: e.target.value }))}
                        >
                          {options.banks.map(bank => (
                            <option key={bank} value={bank}>{bank}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Salary Account Number (10-Digit NUBAN) *
                        <input
                          required={!signupForm.useSameAccountForSalary}
                          type="text"
                          maxLength={10}
                          value={signupForm.salaryAccountNumber}
                          onChange={e => setSignupForm(old => ({ ...old, salaryAccountNumber: e.target.value.replace(/\D/g, '') }))}
                          placeholder="0123456789"
                        />
                      </label>
                      <label>
                        Salary Account Holder Name *
                        <input
                          required={!signupForm.useSameAccountForSalary}
                          value={signupForm.salaryAccountName}
                          onChange={e => setSignupForm(old => ({ ...old, salaryAccountName: e.target.value }))}
                          placeholder="Official name on salary account"
                        />
                      </label>
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: 11.5, color: '#64748b', lineHeight: 1.4 }}>
                      ⚡ <strong>Payroll Segregation:</strong> All monthly payroll runs will be routed to this dedicated salary account, while operational advances and requisitions will disburse to your primary disbursement account.
                    </p>
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginTop: 14, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                ℹ️ <strong>Direct Bank Disbursement:</strong> Finance disburses all advances and expense reimbursements directly to your commercial NUBAN account. Your BVN assists in automated identity verification for disbursement clearance.
              </div>
            </>
          )}

          {signupStep === 4 && (
            <>
              <p className="kicker">STEP 4 OF 4 · EDUCATION, EMERGENCY & SECURITY</p>
              <h2>Emergency Contact, Education & Security</h2>
              <p className="lead">Finalize your educational credentials, emergency contact, and secure sign-in password.</p>
              <div className="form-grid">
                <label className="full">
                  Highest Educational Qualification
                  <select
                    value={signupForm.highestEducation}
                    onChange={e => setSignupForm(old => ({ ...old, highestEducation: e.target.value }))}
                  >
                    {(options.educationLevels.length > 0 ? options.educationLevels : [
                      { value: 'BSC', label: "Bachelor's Degree (B.Sc / B.Tech / B.A)" },
                      { value: 'HND', label: 'Higher National Diploma (HND)' },
                      { value: 'OND', label: 'Ordinary National Diploma (OND / NCE)' },
                      { value: 'MSC', label: "Master's Degree (M.Sc / MBA / M.Tech)" },
                      { value: 'PHD', label: 'Doctorate (Ph.D)' },
                      { value: 'SSCE', label: 'Secondary School Certificate (SSCE / WAEC)' },
                    ]).map(ed => (
                      <option key={ed.value} value={ed.value}>{ed.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Next of Kin Full Name *
                  <input
                    required
                    value={signupForm.nextOfKinName}
                    onChange={e => setSignupForm(old => ({ ...old, nextOfKinName: e.target.value }))}
                    placeholder="e.g. Funke Adeleke"
                  />
                </label>
                <label>
                  Next of Kin Phone Number *
                  <input
                    required
                    type="tel"
                    value={signupForm.nextOfKinPhone}
                    onChange={e => setSignupForm(old => ({ ...old, nextOfKinPhone: e.target.value }))}
                    placeholder="+234 802 000 0000"
                  />
                </label>
                <label>
                  Relationship *
                  <select
                    value={signupForm.nextOfKinRelationship}
                    onChange={e => setSignupForm(old => ({ ...old, nextOfKinRelationship: e.target.value }))}
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Child">Child</option>
                    <option value="Legal Guardian">Legal Guardian</option>
                  </select>
                </label>
                <label>
                  Next of Kin Residential Address
                  <input
                    value={signupForm.nextOfKinAddress}
                    onChange={e => setSignupForm(old => ({ ...old, nextOfKinAddress: e.target.value }))}
                    placeholder="Street, City, State"
                  />
                </label>
                <label className="full">
                  Account Password *
                  <input
                    required
                    type="password"
                    minLength={10}
                    value={signupForm.password}
                    onChange={e => setSignupForm(old => ({ ...old, password: e.target.value }))}
                    placeholder="Minimum 10 characters"
                  />
                </label>
              </div>
              <label className="check-row" style={{ marginTop: 16 }}>
                <input
                  required
                  type="checkbox"
                  checked={signupForm.agreeTerms}
                  onChange={e => setSignupForm(old => ({ ...old, agreeTerms: e.target.checked }))}
                />
                I declare that all submitted personal, statutory, banking, and placement information is true and accurate. I agree to the BEMS Group Financial Accountability Policy, 72-Hour Advance Retirement SLA, and Employee Code of Conduct.
              </label>
            </>
          )}

          {error && <p className="auth-error">{error}</p>}

          <footer className="journey-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            {signupStep > 1 ? (
              <button
                type="button"
                className="text-button"
                onClick={() => { setError(''); setSignupStep(signupStep - 1); }}
                style={{ cursor: 'pointer', padding: '8px 14px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 8, color: '#475569', fontSize: 13, fontWeight: 600 }}
              >
                ← Back
              </button>
            ) : <span />}

            <button className="continue-button" disabled={busy}>
              {busy ? 'Registering…' : signupStep < 4 ? 'Continue →' : 'Complete Registration & Assign Staff ID →'}
            </button>
          </footer>
        </form>
      )}

      {view==='setup' && bootstrapStep==='form' && (
        <form className="journey-card" onSubmit={requestBootstrapCode}>
          <p className="kicker">ONE-TIME INITIALIZATION · STEP 1 OF 2</p>
          <h2>Create the first System Admin</h2>
          <p className="lead">This setup is available only before a System Admin account exists. A 6-digit verification code will be sent to your work email to verify administrative ownership.</p>
          <div className="form-grid">
            <label className="full">Setup key
              <input required type="password" value={bootstrapSecret} onChange={e=>setBootstrapSecret(e.target.value)} placeholder="Enter the master bootstrap secret"/>
            </label>
            <label className="full">Full name
              <input required value={signupForm.fullName} onChange={e=>setSignupForm(old=>({...old, fullName: e.target.value}))} placeholder="e.g. Adebayo Ogunlesi"/>
            </label>
            <label className="full">Work email
              <input required type="email" value={loginForm.email} onChange={e=>setLoginForm(old=>({...old, email: e.target.value}))} placeholder="admin@bemsgroup.com"/>
            </label>
            <label className="full">Password
              <input required type="password" minLength={10} value={loginForm.password} onChange={e=>setLoginForm(old=>({...old, password: e.target.value}))} placeholder="At least 10 characters"/>
            </label>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <footer className="journey-actions">
            <button type="button" className="back-button" onClick={() => { setError(''); setView('login'); }}>
              ← Back to Sign in
            </button>
            <button type="submit" className="continue-button" disabled={busy}>
              {busy ? 'Sending code…' : 'Send Verification Code'} <span>→</span>
            </button>
          </footer>
        </form>
      )}

      {view==='setup' && bootstrapStep==='verify' && (
        <form className="journey-card" onSubmit={submitBootstrapVerify}>
          <div className="verification-icon">🔐</div>
          <p className="kicker">ONE-TIME INITIALIZATION · STEP 2 OF 2</p>
          <h2>Verify administrator email</h2>
          <p className="lead">
            We sent a 6-digit verification code to <strong>{loginForm.email}</strong>. Enter the passcode below to verify your email and activate your System Admin profile.
          </p>
          {bootstrapNotice && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
              ✓ {bootstrapNotice}
            </div>
          )}
          <div style={{ maxWidth: 280, margin: '20px 0' }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 8, letterSpacing: '0.04em' }}>
              6-DIGIT PASSCODE
              <input
                required
                type="text"
                maxLength={6}
                autoFocus
                value={bootstrapOtp}
                onChange={e => setBootstrapOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                style={{
                  width: '100%',
                  height: 56,
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  borderRadius: 10,
                  border: '2px solid #fdba74',
                  background: '#fffbf7',
                  color: '#ea580c',
                  outline: 'none',
                }}
              />
            </label>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
            <button
              type="button"
              className="resend"
              disabled={busy || resendCooldown > 0}
              onClick={() => requestBootstrapCode()}
              style={{ cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', opacity: resendCooldown > 0 ? 0.6 : 1 }}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
            </button>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <button
              type="button"
              className="resend"
              onClick={() => { setError(''); setBootstrapStep('form'); }}
              style={{ color: '#64748b' }}
            >
              Change email / Edit details
            </button>
          </div>
          <footer className="journey-actions">
            <button type="button" className="back-button" onClick={() => { setError(''); setBootstrapStep('form'); }}>
              ← Edit Details
            </button>
            <button type="submit" className="continue-button" disabled={busy || bootstrapOtp.length !== 6}>
              {busy ? 'Verifying…' : 'Verify & Create System Admin'} <span>→</span>
            </button>
          </footer>
        </form>
      )}

      {view==='pending' && (
        <div className="journey-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24, fontWeight: 900 }}>
            ✓
          </div>
          <p className="kicker" style={{ color: '#ea580c' }}>STAFF REGISTRATION SUBMITTED</p>
          <h2 style={{ fontSize: 24, margin: '8px 0', color: '#0f172a' }}>Welcome, {registeredName || 'Staff Member'}</h2>
          <p className="lead" style={{ maxWidth: 440, margin: '0 auto 20px', color: '#64748b', fontSize: 14 }}>
            Your employee registration dossier, corporate placement, and disbursement bank details have been securely recorded.
          </p>
          
          {registeredEmpNumber && (
            <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 12, padding: '16px 20px', margin: '0 auto 24px', maxWidth: 360 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
                Assigned Unique Staff Identity
              </span>
              <strong style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '0.04em', fontFamily: 'monospace' }}>
                {registeredEmpNumber}
              </strong>
              <small style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                Official Group Identification Number
              </small>
            </div>
          )}

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', margin: '0 auto 24px', maxWidth: 440, textAlign: 'left', fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
            <strong>Next Step:</strong> Your registration is now in the review queue for final administrative sign-off. Once verified, you will be able to sign in and submit expenditure requisitions.
          </div>

          <footer className="journey-actions" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="continue-button"
              onClick={() => { setView('login'); setSignupStep(1); }}
            >
              Return to Sign In →
            </button>
          </footer>
        </div>
      )}

      {view!=='pending' && (
        <p className="signin-note">
          {view==='login' ? (
            <>New to BEMS Group? <button onClick={()=>{ setError(''); setView('signup'); setSignupStep(1); }}>Create staff account</button></>
          ) : (
            <>Already have an account? <button onClick={()=>{ setError(''); setView('login'); }}>Sign in</button></>
          )}
        </p>
      )}
      {view==='login' && bootstrapAvailable && <p className="signin-note"><button onClick={()=>{setError('');setView('setup')}}>Set up the first System Admin</button></p>}
      {view==='login' && !adminExists && !bootstrapConfigured && <p className="signin-note">First-time setup needs <code>BEMS_BOOTSTRAP_SECRET</code> in <code>.env.local</code>.</p>}
    </section>
  </main>;
}

function SectionHeader({eyebrow,title,text,action,onAction}:{eyebrow:string;title:string;text:string;action?:string;onAction?:()=>void}) {
  return <div className="section-header"><div><p className="kicker">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{action&&<button className="primary-button" onClick={onAction}>{action} <span>＋</span></button>}</div>;
}

function Overview({business,user,cases,setActive,setNotice}:{business:Business;user:AuthUser;cases:CaseRecord[];setActive:(x:string)=>void;setNotice:(x:string)=>void}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="welcome-row">
        <div>
          <p className="kicker">EXECUTIVE COMMAND TELEMETRY</p>
          <h1>Good afternoon, {formatDisplayName(user.fullName)}.</h1>
          <p>Real-time expenditure pipeline, cash run-rate, and accountability governance across {business.name}.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="outline-button" onClick={() => setActive("Subsidiary portfolio")}>Manage Subsidiaries ▦</button>
        </div>
      </div>
      <ModernBentoDashboard role="GMD" businessName={business.name} subsidiaryId={business.id} onNavigate={(p) => setActive(p)} />
    </div>
  );
}

function OldOverview({business,user,cases,setActive,setNotice}:{business:Business;user:AuthUser;cases:CaseRecord[];setActive:(x:string)=>void;setNotice:(x:string)=>void}) {
  const openCases=cases.filter(c=>c.status!=='Resolved').length;
  return <>
    <div className="welcome-row"><div><p className="kicker">MONDAY, 31 AUGUST</p><h1>Good afternoon, {formatDisplayName(user.fullName)}.</h1><p>Here is what is happening across {business.name}.</p></div><button className="outline-button" onClick={()=>setNotice('Customer preview opened in Test mode.')}>Preview customer experience ↗</button></div>
    <section className="launch-hero"><div><span className="hero-label">ACTIVE SUBSIDIARY · {business.status.toUpperCase()}</span><h2>Financial telemetry & expenditure pipeline</h2><p>Fund requests move through multi-level approval, payment recording with receipt, staff confirmation, and accountability across {business.name}.</p><div className="hero-progress"><i style={{width:'100%'}}/></div><div className="hero-meta"><span>Compliance rate: 100%</span><button onClick={()=>setActive('Fund requests')}>Submit fund request ＋</button></div></div><div className="network-orbit"><i/><i/><i/><strong><img src="/bems-group-logo.png?v=20261024" alt="BEMS Group"/></strong></div></section>
    <section className="metric-grid">
      <article style={{cursor:'pointer'}} onClick={()=>setActive('Disbursements')}><span className="metric-symbol blue">₦</span><div><small>DISBURSED MTD</small><strong>₦0</strong><p>0 approved disbursements</p></div></article>
      <article style={{cursor:'pointer'}} onClick={()=>setActive('Approvals desk')}><span className="metric-symbol amber">✓</span><div><small>AWAITING APPROVAL</small><strong>₦0</strong><p>0 requests pending review</p></div></article>
      <article style={{cursor:'pointer'}} onClick={()=>setActive('Accountability closure')}><span className="metric-symbol green">◈</span><div><small>ACCOUNTABILITY RATE</small><strong>100%</strong><p className="up">All records clear</p></div></article>
      <article style={{cursor:'pointer'}} onClick={()=>setActive('Hybrid payroll')}><span className="metric-symbol purple">⌁</span><div><small>PAYROLL RUN-RATE</small><strong className="bill">₦0</strong><p>No active payroll batches</p></div></article>
    </section>
    <div className="overview-grid">
      <section className="card launch-card">
        <div className="card-title"><div><p className="kicker">EXECUTIVE ACTIONS</p><h3>Pending decisions & tasks</h3></div><button onClick={()=>setActive('Approvals desk')}>View all</button></div>
        <div style={{padding:'24px',textAlign:'center',color:'#64748b',fontSize:'12px'}}>No pending executive actions in queue. All pipelines are clear.</div>
      </section>
      <section className="card outcome-card">
        <div className="card-title"><div><p className="kicker">EXPENDITURE BREAKDOWN</p><h3>Outflows by Category</h3></div><button onClick={()=>setActive('Analytics & BI')}>Analytics</button></div>
        <div style={{padding:'24px',textAlign:'center',color:'#64748b',fontSize:'12px'}}>No expenditure categorized yet. Categories calculate dynamically as requests are disbursed.</div>
      </section>
    </div>
    <section className="card insight-strip"><span>🏛️</span><div><p className="kicker">TREASURY GOVERNANCE INSIGHT</p><strong>Dual-Custody Expenditure Controls Enforced</strong><p>All fund requisitions require matrix authorization, verified invoice proof, and payment receipts. Cash advances remain governed by mandatory 72-hour retiral accountability.</p></div><button onClick={()=>setActive('Approvals desk')}>Review approvals queue →</button></section>
  </>;
}

function Businesses({businesses,current,onSelect,onAdd,onEdit}:{businesses:Business[];current:Business;onSelect:(id:string)=>void;onAdd:()=>void;onEdit?:(b:Business)=>void}) {
  return (
    <>
      <SectionHeader
        eyebrow="CORPORATE SUBSIDIARY GOVERNANCE"
        title="Subsidiaries & Operating Entities"
        text="Autonomous operational governance across BEMS Group subsidiaries. Each subsidiary maintains dedicated departments, allocated operating budgets, bank accounts, and expenditure ledgers."
        action="Add Subsidiary"
        onAction={onAdd}
      />
      <div className="account-boundary">
        <span style={{background:'#ea580c',color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',width:22,height:22,fontSize:12,fontWeight:700}}>🏛</span>
        <p>
          <strong>BEMS Group Holdings</strong> is the sovereign holding company. Each subsidiary entity below operates autonomously with dedicated bank accounts, assigned staff, and expenditure authorization limits.
        </p>
      </div>
      <div className="business-grid">
        {businesses.map((b) => (
          <article className={current.id === b.id ? 'business-card current' : 'business-card'} key={b.id}>
            <div className="business-card-top">
              <span style={{ background: b.color || '#ea580c', color: '#fff' }}>{b.initials || 'BS'}</span>
              <b className={b.status === 'Live' ? 'live-status' : 'setup-status'}>
                {b.status === 'Live' ? 'ACTIVE' : 'SETUP'}
              </b>
            </div>
            <h3>{b.name}</h3>
            <p>{b.industry || 'Operating Subsidiary'}</p>
            <div className="business-stats">
              <span><strong>{typeof (b as any).departmentCount === 'number' ? (b as any).departmentCount : 0}</strong>depts</span>
              <span><strong>{typeof (b as any).staffCount === 'number' ? (b as any).staffCount : 0}</strong>staff</span>
              <span><strong>{(b as any).budgetFormatted || '₦0'}</strong>budget</span>
            </div>
            <div className="business-progress">
              <i style={{ width: '100%', background: b.color || '#ea580c' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 7,
                  border: 0,
                  background: current.id === b.id ? '#fff7ed' : '#f8fafc',
                  color: current.id === b.id ? '#ea580c' : '#334155',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {current.id === b.id ? 'Current Subsidiary ✓' : 'Open Subsidiary →'}
              </button>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(b)}
                  title="Edit Subsidiary Profile"
                  style={{
                    padding: '7px 12px',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Edit ✎
                </button>
              )}
            </div>
          </article>
        ))}
        <button className="add-business-card" onClick={onAdd}>
          <i>＋</i>
          <strong>Add another subsidiary</strong>
          <span>Register a new corporate entity under BEMS Group</span>
        </button>
      </div>
    </>
  );
}

function SettingsView({businesses,current,onSelect,onAdd,setNotice,onOpenConfiguration,onUpdateBusiness}:{businesses:Business[];current:Business;onSelect:(id:string)=>void;onAdd:()=>void;setNotice:(x:string)=>void;onOpenConfiguration:()=>void;onUpdateBusiness:(id:string,patch:Partial<Business>)=>Promise<Business>}) {
  const [section,setSection]=useState('All settings');
  const [query,setQuery]=useState('');
  const [editingProfile,setEditingProfile]=useState(false);
  const [draft,setDraft]=useState({name:current.name,industry:current.industry,color:current.color});
  const [saving,setSaving]=useState(false);
  const openProfileEditor=()=>{setDraft({name:current.name,industry:current.industry,color:current.color});setEditingProfile(true)};
  const saveProfile=(e:FormEvent)=>{e.preventDefault();setSaving(true);onUpdateBusiness(current.id,draft).then(()=>{setEditingProfile(false);setSaving(false);setNotice(`${draft.name} profile updated.`)})};
  const sections=[['All settings','⚙'],['Subsidiaries','🏛️'],['Preferences & brand','◈'],['Payment methods','₦'],['Configuration','☷'],['Mobile Ecosystem','📱'],['Security & access','⌾'],['Data & privacy','≡'],['Notifications','♧'],['Plans & billing','◇'],['Feature flags','⚑']];
  const cards=[
    {title:'Mobile Ecosystem',icon:'📱',description:'Manage mobile app versions, APK deployment and update gates.',links:['Mobile Apps Management','APK releases & downloads','Version control gates']},
    {title:'Preferences & brand',icon:'◈',description:'Control how this workspace looks and communicates.',links:['Business profile','Logo and colours','Email templates','Invoice and receipt templates','Localisation & accessibility']},
    {title:'Payment methods',icon:'₦',description:'Manage how this business pays BEMS and providers.',links:['Billing cards','Bank transfer accounts','Provider settlement methods','Tax information']},
    {title:'Configuration',icon:'☷',description:'Connect systems and control technical behaviour.',links:['API keys & webhooks','OTP providers','Notifications','IP allowlisting','Secrets & environments']},
    {title:'Security & access',icon:'⌾',description:'Protect this workspace and control every role.',links:['Authentication policies','Team roles & permissions','Single sign-on','Session controls','Approval rules']},
    {title:'Business operations',icon:'▦',description:`Sector settings for ${current.industry}.`,links:['Operating hours','Service rules','Pricing & charges','Locations','Customer eligibility']},
    {title:'Channels & delivery',icon:'◉',description:'Default policies for customer-facing channels.',links:['Channel branding','Message templates','Fallback rules','Delivery windows','Opt-out management']},
    {title:'AI & automation',icon:'✦',description:'Define where automation may assist and take action.',links:['AI permissions','Approved knowledge','Human review rules','Model routing','Spending limits']},
    {title:'Data & privacy',icon:'≡',description:'Control retention, consent, exports and residency.',links:['Data retention','Consent records','Regional storage','Customer data export','Deletion requests']},
    {title:'Plans & billing',icon:'◇',description:'Manage subscription, usage limits and invoices.',links:['Current plan','Usage allowances','Invoices','Cost alerts','Billing contacts']},
    {title:'Feature flags',icon:'⚑',description:'Choose which capabilities appear in this workspace.',links:['Enabled features','Progressive rollout','Beta access','Change history']},
  ];
  const visible=cards.filter(c=>(section==='All settings'||c.title===section)&&(!query||`${c.title} ${c.links.join(' ')}`.toLowerCase().includes(query.toLowerCase())));
  return <div className="settings-shell"><aside className="settings-side"><div><span>⚙</span><strong>Settings</strong><small>{current.name}</small></div>{sections.map(([name,icon])=><button className={section===name?'active':''} onClick={()=>setSection(name)} key={name}><span>{icon}</span>{name}</button>)}</aside><section className="settings-main"><div className="settings-heading"><div><p className="kicker">WORKSPACE ADMINISTRATION</p><h1>{section}</h1><p>Manage the complete configuration of {current.name}.</p></div><div>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search settings"/></div></div>{section==='Subsidiaries'||section==='Businesses'?<Businesses businesses={businesses} current={current} onSelect={onSelect} onAdd={onAdd}/>:<>{editingProfile&&<form className="card profile-editor" onSubmit={saveProfile}><header><p className="kicker">EDIT BUSINESS PROFILE</p><h3>{current.name}</h3></header><div className="settings-fields"><label>Business name<input required value={draft.name} onChange={e=>setDraft(old=>({...old,name:e.target.value}))}/></label><label>Industry<select value={draft.industry} onChange={e=>setDraft(old=>({...old,industry:e.target.value}))}>{industryOptions.map(x=><option key={x}>{x}</option>)}</select></label><label>Workspace colour<input type="color" value={draft.color} onChange={e=>setDraft(old=>({...old,color:e.target.value}))}/></label></div><div className="modal-actions"><button type="button" onClick={()=>setEditingProfile(false)}>Cancel</button><button type="submit" disabled={saving}>{saving?'Saving…':'Save profile'}</button></div></form>}<div className="settings-card-grid">{visible.map(card=><article className="settings-hub-card" key={card.title}><header><span>{card.icon}</span><div><h3>{card.title}</h3><p>{card.description}</p></div></header>{card.links.map(link=><button key={link} onClick={()=>{if(card.title==='Mobile Ecosystem'||link.includes('Mobile Apps')){window.location.href='/admin/settings/mobile-apps';return}if(link==='Business profile'){openProfileEditor();return}if(card.title==='Configuration'){onOpenConfiguration();return}setNotice(`${link} settings opened.`)}}>{link}<span>→</span></button>)}</article>)}</div>{section==='All settings'&&<section className="danger-zone"><div><span>!</span><div><strong>Archive or retire this corporate subsidiary</strong><p>Export all expenditure records, receipts, and audit logs before deactivating this subsidiary. Group Managing Director approval is required.</p></div></div><button onClick={()=>setNotice('Protected action: GMD verification is required before a subsidiary can be deactivated.')}>Manage subsidiary retirement</button></section>}</>}</section></div>;
}

function SetupLaunch({business,setActive,onUpdateBusiness,setNotice}:{business:Business;setActive:(x:string)=>void;onUpdateBusiness:(id:string,patch:Partial<Business>)=>Promise<Business>;setNotice:(x:string)=>void}) {
  const [channelCount,setChannelCount]=useState<number|null>(null);
  useEffect(()=>{
    apiGet<ChannelRecord[]>(`/api/businesses/${business.id}/channels`).then(rows=>setChannelCount(rows.length));
  },[business.id]);
  const hasChannel=(channelCount ?? 0)>0;
  const isLive=business.status==='Live';
  const checks:[string,string,boolean,string][]=[
    ['Business profile','Business details and brand confirmed',true,'Settings'],
    ['Services selected','Four customer outcomes configured',true,'Workflows'],
    ['Customer channel','Design and publish WhatsApp, web chat, SMS or another touchpoint',hasChannel,'Channels'],
    ['Business system','Connect an API, webhook or guided data source',false,'Developer & APIs'],
    ['Identity & policy','Review sector-specific controls',false,'Configuration'],
    ['Complete journey test','Simulate success, failure and handoff',false,'Test centre'],
    ['Billing method','Confirm plan and payment method',true,'Billing & usage'],
    ['Publish approval','Owner approval required before Live',isLive,'Test centre'],
  ];
  const completed=checks.filter(c=>c[2]).length;
  const canRequestLive=hasChannel&&!isLive;
  const requestLive=()=>{
    onUpdateBusiness(business.id,{status:'Live',readiness:100}).then(()=>setNotice(`${business.name} approved for Live. The Live/Test toggle is now unlocked in the top bar.`));
  };
  return <><SectionHeader eyebrow="GUIDED IMPLEMENTATION" title="From account to Live, step by step" text="Your launch plan changes with the business sector, selected services, channels and risk level."/><div className="setup-page"><section className="card checklist-card"><div className="setup-score"><div><strong>{completed}</strong><span>/ 8 complete</span></div><p><b>{isLive?'This business is Live':'Test environment is protected'}</b><span>{isLive?'Customers can reach every published channel for this business.':'Customers cannot access this workspace until every required check passes and an owner approves publication.'}</span>{canRequestLive&&<button className="live-request" onClick={requestLive}>Request Live approval →</button>}{!hasChannel&&!isLive&&<span className="live-request-hint">Publish at least one channel to unlock Live approval.</span>}</p></div>{checks.map((x,i)=><button className={x[2]?'check-item done':'check-item'} key={x[0]} onClick={()=>setActive(x[3])}><i>{x[2]?'✓':i+1}</i><div><strong>{x[0]}</strong><span>{x[1]}</span></div><b>{x[2]?'Complete':'Open'} →</b></button>)}</section><aside><section className="card sector-config"><p className="kicker">YOUR CONFIGURATION</p><h3>{business.industry}</h3><ul><li>Identity verification</li><li>Transaction audit trail</li><li>Consent and privacy controls</li><li>Human review for sensitive actions</li><li>Payment provider orchestration</li></ul><button onClick={()=>setActive('Settings')}>Change business profile</button></section><section className="card help-card"><span>?</span><h3>Built for self-service</h3><p>Every connection includes guided steps, validation, examples and a safe test. Help is available without waiting for a sales or implementation call.</p><button>Open help centre →</button></section></aside></div></>;
}

type TemplateRecord = {id:string;icon:string;title:string;sector:string;description:string;price:string;version:string;uses:string;channels:string;tag:string};

function TemplateMarketplace({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  const [templates,setTemplates]=useState<TemplateRecord[]>([]);
  const [category,setCategory]=useState('Recommended');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<TemplateRecord|null>(null);
  const [imported,setImported]=useState<string[]>([]);
  const [updates,setUpdates]=useState<string[]>([]);
  const [templatesStatus,setTemplatesStatus]=useState<'loading'|'ready'|'error'>('loading');
  const fetchTemplates=()=>{
    Promise.all([
      apiGet<TemplateRecord[]>('/api/templates'),
      apiGet<{imported:string[];updates:string[]}>(`/api/businesses/${business.id}/templates`),
    ]).then(([templateRows,businessTemplates])=>{
      setTemplates(templateRows);
      setImported(businessTemplates.imported);
      setUpdates(businessTemplates.updates);
      setTemplatesStatus('ready');
    }).catch(()=>setTemplatesStatus('error'));
  };
  useEffect(fetchTemplates,[business.id]);
  const retryTemplates=()=>{setTemplatesStatus('loading');fetchTemplates()};
  const categories=['Recommended','All templates','Financial services','Investment','Healthcare','Commerce','Government','My library'];
  const visible=templates.filter(t=>(!query||`${t.title} ${t.sector} ${t.description}`.toLowerCase().includes(query.toLowerCase()))&&(category==='Recommended'||category==='All templates'||(category==='My library'&&imported.includes(t.id))||t.sector.toLowerCase().includes(category.toLowerCase().replace('investment','investment'))));
  const importTemplate=(template:TemplateRecord)=>{apiPost(`/api/businesses/${business.id}/templates/${template.id}/import`).then(()=>{setImported(old=>old.includes(template.id)?old:[...old,template.id]);setUpdates(old=>old.filter(x=>x!==template.id));setSelected(null);setNotice(`${template.title} imported into ${business.name} as an editable Test-mode workflow.`)})};
  return <>
    <SectionHeader eyebrow="BEMS GROUP TEMPLATE MARKETPLACE" title="Launch proven workflows in minutes" text="Buy or import ready-made, sector-specific workflows into this business. Every template remains editable and starts safely in Test mode." action="View my library" onAction={()=>setCategory('My library')}/>
    <section className="template-hero"><div><span>OFFICIAL BEMS GROUP TEMPLATES</span><h2>We keep building. Your business keeps improving.</h2><p>BEMS maintains the logic, channel adaptations, safeguards and integrations. You choose when to import a new version—your custom changes are never overwritten automatically.</p><div><b>✓ Tested workflow logic</b><b>✓ Sector-ready controls</b><b>✓ Versioned updates</b></div></div><aside><small>AVAILABLE TODAY</small><strong>120+</strong><span>workflow templates</span><i/><p>New templates and improvements are published continuously.</p></aside></section>
    <div className="template-toolbar"><div className="template-search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search workflows, sectors or outcomes"/></div><button>Newest first ⌄</button></div>
    {templatesStatus==='loading'&&<div className="inline-status">Loading templates…</div>}
    {templatesStatus==='error'&&<div className="inline-status error">Could not load the template marketplace.<button onClick={retryTemplates}>Retry</button></div>}
    <div className="template-layout"><aside className="template-categories"><p>EXPLORE</p>{categories.map(x=><button className={category===x?'active':''} onClick={()=>setCategory(x)} key={x}><span>{x}</span>{x==='My library'&&<b>{imported.length}</b>}</button>)}<div><span>✦</span><strong>Need a workflow?</strong><p>Suggest a template for the BEMS roadmap.</p><button onClick={()=>setNotice('Template request form opened.')}>Submit request →</button></div></aside><section><div className="template-results"><span><strong>{visible.length}</strong> templates for {category.toLowerCase()}</span><small>Licensed per business workspace</small></div><div className="template-grid">{visible.map(t=>{const isImported=imported.includes(t.id);const hasUpdate=updates.includes(t.id);return <article className="template-card" key={t.id}><div className="template-card-top"><span>{t.icon}</span><b>{t.tag}</b></div><small>{t.sector.toUpperCase()}</small><h3>{t.title}</h3><p>{t.description}</p><div className="template-meta"><span>{t.channels}</span><span>{t.version} · {t.uses}</span></div><div className="template-price"><div><small>{t.price==='Included'?'YOUR PLAN':'ONE-TIME LICENCE'}</small><strong>{t.price}</strong></div>{hasUpdate?<button className="update-button" onClick={()=>setSelected(t)}>Update available</button>:isImported?<button className="owned-button" onClick={()=>setSelected(t)}>✓ In library</button>:<button onClick={()=>setSelected(t)}>{t.price==='Included'?'Import':'Buy & import'} →</button>}</div></article>})}</div></section></div>
    <section className="template-economy"><div><span>01</span><strong>Buy once per business</strong><p>The purchased template belongs to this workspace and can be copied into multiple services inside it.</p></div><div><span>02</span><strong>Customise freely</strong><p>Change steps, branding, channels, integrations and policies without modifying the original template.</p></div><div><span>03</span><strong>Upgrade safely</strong><p>Compare new BEMS versions, keep local changes and choose which improvements to merge.</p></div></section>
    {selected&&<div className="template-modal" role="dialog" aria-modal="true"><div className="template-modal-card"><button className="modal-close" onClick={()=>setSelected(null)}>×</button><div className="modal-title"><span>{selected.icon}</span><div><p className="kicker">{updates.includes(selected.id)?'TEMPLATE UPDATE':'IMPORT WORKFLOW TEMPLATE'}</p><h2>{selected.title}</h2><small>Official BEMS template · {selected.version}</small></div></div><div className="import-summary"><div><small>DESTINATION BUSINESS</small><strong>{business.name}</strong><span>{business.industry}</span></div><div><small>ENVIRONMENT</small><strong>Test</strong><span>Not visible to customers</span></div><div><small>{selected.price==='Included'?'PLAN ACCESS':'LICENCE'}</small><strong>{selected.price}</strong><span>One-time per business</span></div></div><h3>What will be imported</h3><ul><li>Editable workflow logic and customer messages</li><li>Channel-specific layouts and safe fallbacks</li><li>Required data fields, policies and validation rules</li><li>Test cases and launch-readiness checklist</li><li>Access to future version comparisons</li></ul><label className="import-name">Workflow name<input defaultValue={selected.title}/></label><div className="modal-actions"><button onClick={()=>setSelected(null)}>Cancel</button><button onClick={()=>importTemplate(selected)}>{updates.includes(selected.id)?'Review & apply update':selected.price==='Included'?'Import to Test':'Pay and import'} →</button></div><p className="licence-note">A separate editable copy is created. BEMS cannot overwrite your customised workflow.</p></div></div>}
  </>;
}

type ChannelRecord={name:string;icon:string;description:string;status:'Live'|'Test ready'|'Draft';address:string;workflow:string;color:string};
type ChannelPreviewData={displayName:string;address:string;welcome:string;workflow:string;handoff:string;hours:string;language:string;theme:string;menu:string;about:string};

function ChannelBoard({channel,avatar,business,form,onAction}:{channel:string;avatar:string;business:Business;form:ChannelPreviewData;onAction:(x:string)=>void}) {
  const menu=form.menu.split(',').map(x=>x.trim()).filter(Boolean).slice(0,4);
  if(channel==='USSD') return <div className="channel-board ussd-board"><div className="ussd-status"><span>MTN NG</span><b>*347#</b></div><section><p>{form.welcome}</p>{menu.map((x,i)=><button onClick={()=>onAction(x)} key={x}>{i+1}. {x}</button>)}<small>0. Back&nbsp;&nbsp;&nbsp;00. Main menu</small><div><button>Cancel</button><button onClick={()=>onAction('USSD reply sent')}>Send</button></div></section><footer>Session 01:42 · low-data mode</footer></div>;
  if(channel==='SMS') return <div className="channel-board sms-board"><header><button>‹</button><div><strong>{form.displayName}</strong><small>{form.address}</small></div><b>ⓘ</b></header><section><span>Today 10:42</span><p>{form.welcome}</p><p>Your request HC-4821 is ready. Reply <b>1</b> to confirm or <b>HELP</b> for support.</p><small>Reply STOP to opt out.</small></section><footer><input readOnly value="Text message"/><button onClick={()=>onAction('SMS reply sent')}>↑</button></footer></div>;
  if(channel==='Voice') return <div className="channel-board voice-board"><header><img src={avatar} alt=""/><small>Incoming service call</small><h3>{form.displayName}</h3><span>{form.address}</span></header><section><p>“{form.welcome}”</p><div>{['1 Payments','2 Account','3 Support','0 Agent'].map(x=><button onClick={()=>onAction(x)} key={x}>{x}</button>)}</div><small>Speech + keypad input · recording disclosure on</small></section><footer><button>Mute</button><button onClick={()=>onAction('Call transferred to an agent')}>Transfer</button><button className="end-call">End</button></footer></div>;
  if(channel==='QR experience'||channel==='Mobile experience') return <div className="channel-board miniapp-board"><header><img src={avatar} alt=""/><div><strong>{form.displayName}</strong><small>{channel==='QR experience'?'Opened from Abuja Branch QR':'Secure in-app service'}</small></div></header><section><h3>What would you like to do?</h3><div>{menu.map((x,i)=><button onClick={()=>onAction(x)} key={x}><span>{['₦','◎','▣','?'][i]}</span><strong>{x}</strong><small>Open secure service</small></button>)}</div></section><footer>Verified experience · {business.name}</footer></div>;
  const telegram=channel==='Telegram'; const instagram=channel==='Instagram'; const messenger=channel==='Messenger'; const wechat=channel==='WeChat'; const web=channel==='Web chat';
  return <div className={`channel-board chat-board ${telegram?'telegram':instagram?'instagram':messenger?'messenger':wechat?'wechat':web?'web-chat':'whatsapp'}`}><header><button>‹</button><img src={avatar} alt={`${form.displayName} display picture`}/><div><strong>{form.displayName} <i>✓</i></strong><small>{telegram?'bot · active now':instagram?'Business · typically replies instantly':wechat?'Official Account':web?'Online now':'Business account · online'}</small></div><button>⋮</button></header><section><span>Today</span><div className="message incoming"><p>{form.welcome}</p><time>10:42</time></div>{(telegram||wechat)&&<div className="rich-message"><strong>{form.workflow}</strong><p>Complete this service without leaving the conversation.</p><button onClick={()=>onAction(telegram?'Mini App opened':'Mini Program opened')}>{telegram?'Open Mini App':'Open Mini Program'} ↗</button></div>}{instagram&&<div className="ice-breakers">{menu.map(x=><button onClick={()=>onAction(x)} key={x}>{x}</button>)}</div>}{!instagram&&!telegram&&!wechat&&<div className="quick-actions">{menu.slice(0,3).map(x=><button onClick={()=>onAction(x)} key={x}>{x}</button>)}</div>}<div className="message outgoing"><p>I want to {form.workflow.toLowerCase()}.</p><time>10:43 ✓✓</time></div>{channel==='WhatsApp'&&<div className="product-message"><b>Featured service</b><p>Instant account support</p><button onClick={()=>onAction('WhatsApp Flow opened')}>Open secure form</button></div>}</section><footer><button>＋</button><input readOnly value={instagram?'Message…':'Type a message'}/><button onClick={()=>onAction('Test message sent')}>➤</button></footer>{(instagram||messenger)&&<nav>{menu.map(x=><button onClick={()=>onAction(x)} key={x}>{x}</button>)}</nav>}</div>;
}


function Channels({business,onAddCase,setNotice}:{business:Business;onAddCase:(input:{customerName:string;subject:string})=>void;setNotice:(x:string)=>void}) {
  const simulatedCustomers=[
    {name:'Grace Bello',message:'Hi, I made a payment but have not received confirmation yet.'},
    {name:'Michael Adeyemi',message:'Can you help me track my order? It has not arrived.'},
    {name:'Fatima Sule',message:'I need to update my account details, please.'},
    {name:'Emeka Chukwu',message:'My card was declined but I was still charged.'},
  ];
  const simulateMessage=(channelName:string)=>{
    const pick=simulatedCustomers[Math.floor(Math.random()*simulatedCustomers.length)];
    onAddCase({customerName:pick.name,subject:`${pick.message} (via ${channelName})`});
    setNotice(`New message from ${pick.name} arrived in Inbox via ${channelName}. Check Inbox to reply.`);
  };
  const catalogue=[
    {name:'WhatsApp',icon:'WA',description:'Rich conversations, commerce, secure forms and support',color:'#19a77a',requirements:'Business identity, customer-facing number, opt-in and message policy',capabilities:['Profile + DP','Buttons & lists','Media','Templates','Flows','Catalogue','Location','Payments']},
    {name:'WeChat',icon:'WX',description:'Official Account services, custom menus and Mini Programs',color:'#08a86b',requirements:'Official Account identity, account type and regional approval',capabilities:['Profile + DP','Custom menu','Rich media','Mini Program','QR entry','Payments','Followers','Service messages']},
    {name:'Web chat',icon:'WEB',description:'A fully branded service desk embedded on your website',color:'#176de8',requirements:'Approved domains, placement, security and privacy notice',capabilities:['Custom UI','File upload','Forms','Video','Screen share','Co-browse','Payments','Passkeys']},
    {name:'SMS',icon:'SMS',description:'Alerts, confirmations and concise two-way customer journeys',color:'#7657dd',requirements:'Sender identity, destination country, consent and opt-out rules',capabilities:['2-way text','Sender pool','Keywords','OTP','Short links','Scheduling','Opt-out','Delivery reports']},
    {name:'USSD',icon:'*#',description:'Session menus for feature phones and low-connectivity customers',color:'#d38b17',requirements:'Service code, country, mobile networks and session timeout',capabilities:['Numbered menus','Session state','Language','Payments','PIN input','Pagination','Timeout rules','Fallback SMS']},
    {name:'Telegram',icon:'TG',description:'Bots, inline keyboards, payments and secure Mini Apps',color:'#168eaa',requirements:'Bot identity, username, commands and publishing review',capabilities:['Profile + DP','Commands','Keyboards','Media','Mini Apps','Payments','Location','Deep links']},
    {name:'Instagram',icon:'IG',description:'Discovery, DMs, icebreakers and social commerce support',color:'#bd4e8d',requirements:'Professional account, reply policy and conversation menu',capabilities:['Profile + DP','Icebreakers','Persistent menu','Media','Story replies','Products','Web views','Agent handoff']},
    {name:'Messenger',icon:'FB',description:'Facebook messaging, menus and guided web experiences',color:'#3d6ed7',requirements:'Business Page identity and messaging permissions',capabilities:['Profile + DP','Get started','Persistent menu','Quick replies','Media','Web views','Receipts','Agent handoff']},
    {name:'Voice',icon:'☎',description:'Natural-language calls, keypad menus, queues and routing',color:'#6651bf',requirements:'Caller ID, recording policy, language and transfer destinations',capabilities:['Speech input','Keypad','Call queue','Recording','Voicemail','Transfer','Languages','Callback']},
    {name:'Mobile experience',icon:'APP',description:'BEMS-powered customer services inside your mobile app',color:'#bd7416',requirements:'App identity, deep links, authentication and security policy',capabilities:['Native cards','Push','Biometrics','Deep links','Payments','Documents','Location','Offline mode']},
    {name:'QR experience',icon:'QR',description:'Contextual service from branches, products, receipts or events',color:'#128598',requirements:'Destination, physical context, security and expiry policy',capabilities:['Dynamic QR','Location context','Campaign tags','Forms','Payments','Tickets','Expiry','Fraud checks']},
  ];
  const [published,setPublished]=useState<ChannelRecord[]>([]);
  const [channelsStatus,setChannelsStatus]=useState<'loading'|'ready'|'error'>('loading');
  const fetchChannels=()=>{
    apiGet<ChannelRecord[]>(`/api/businesses/${business.id}/channels`).then(rows=>{setPublished(rows);setChannelsStatus('ready')}).catch(()=>setChannelsStatus('error'));
  };
  useEffect(fetchChannels,[business.id]);
  const retryChannels=()=>{setChannelsStatus('loading');fetchChannels()};
  const [wizard,setWizard]=useState(false); const [step,setStep]=useState(1);
  const [choice,setChoice]=useState(catalogue[0]); const [detail,setDetail]=useState<ChannelRecord|null>(null);
  const [labChannel,setLabChannel]=useState('WhatsApp'); const [avatar,setAvatar]=useState('/bems-group-logo.png?v=20261024');
  const [features,setFeatures]=useState<string[]>(catalogue[0].capabilities.slice(0,6));
  const [form,setForm]=useState({displayName:business.name,address:'+234 ',welcome:`Welcome to ${business.name}. How can we help you today?`,workflow:'Customer help desk',handoff:'+234 ',hours:'Monday–Friday, 8:00am–6:00pm',language:'English',theme:'Business brand colours',menu:'Make a payment, Track a request, Speak to our team, View products',about:`Secure digital services from ${business.name}`,website:'https://',email:'support@example.com',consent:'Customer-initiated and explicit opt-in',fallback:'Send SMS confirmation',timeout:'120 seconds',entryMode:'Use an existing identity'});
  const update=(key:keyof typeof form,value:string)=>setForm(old=>({...old,[key]:value}));
  const selectChannel=(c:typeof catalogue[number])=>{setChoice(c);setFeatures(c.capabilities.slice(0,6))};
  const start=(name?:string)=>{const next=catalogue.find(c=>c.name===name)||catalogue[0];selectChannel(next);setStep(name?2:1);setDetail(null);setWizard(true)};
  const configure=(channel:ChannelRecord)=>{const next=catalogue.find(c=>c.name===channel.name)||catalogue[0];selectChannel(next);setForm(old=>({...old,address:channel.address,workflow:channel.workflow}));setDetail(channel)};
  const toggleFeature=(feature:string)=>setFeatures(old=>old.includes(feature)?old.filter(x=>x!==feature):[...old,feature]);
  const uploadAvatar=(file?:File)=>{if(file){setAvatar(URL.createObjectURL(file));setNotice('Display picture added to the channel preview.')}};
  const createChannel=()=>{const next:ChannelRecord={name:choice.name,icon:choice.icon,description:`${form.workflow} · ${features.length} capabilities`,status:'Test ready',address:form.address.trim()||'Assigned after review',workflow:form.workflow,color:choice.color};apiPost<ChannelRecord>(`/api/businesses/${business.id}/channels`,next).then(saved=>setPublished(old=>[...old.filter(c=>c.name!==saved.name),saved]));setWizard(false);setStep(1);setNotice(`${choice.name} experience created in Test with ${features.length} capabilities.`)};
  const publishToLive=(channel:ChannelRecord)=>{apiPost<ChannelRecord>(`/api/businesses/${business.id}/channels`,{...channel,status:'Live'}).then(saved=>{setPublished(old=>old.map(c=>c.name===saved.name?saved:c));setDetail(saved);setNotice(`${saved.name} is now Live with customers.`)})};
  const selectedLab=catalogue.find(c=>c.name===labChannel)||catalogue[0];
  const previewForm:ChannelPreviewData=form;
  const provision=()=>{
    if(choice.name==='USSD') return <><label>Requested service code<input value={form.address} onChange={e=>update('address',e.target.value)} placeholder="*347#"/></label><label>Mobile networks<select><option>All available networks</option><option>MTN</option><option>Airtel</option><option>Glo</option><option>9mobile</option></select></label><label>Session timeout<select value={form.timeout} onChange={e=>update('timeout',e.target.value)}><option>60 seconds</option><option>120 seconds</option><option>180 seconds</option></select></label><label>Failure fallback<select value={form.fallback} onChange={e=>update('fallback',e.target.value)}><option>Send SMS confirmation</option><option>Resume from last step</option><option>Route to support</option></select></label></>;
    if(choice.name==='Voice') return <><label>Caller ID or service number<input value={form.address} onChange={e=>update('address',e.target.value)}/></label><label>Customer input<select><option>Natural speech + keypad</option><option>Keypad only</option><option>Natural speech only</option></select></label><label>Call recording<select><option>Announce and record with consent</option><option>Do not record</option><option>Record agent section only</option></select></label><label>Queue fallback<select><option>Offer a callback</option><option>Send to voicemail</option><option>Send an SMS link</option></select></label></>;
    if(choice.name==='SMS') return <><label>Sender type<select><option>Branded sender ID</option><option>Dedicated long number</option><option>Shared short code</option></select></label><label>Sender name / number<input value={form.address} onChange={e=>update('address',e.target.value)}/></label><label>Opt-out keywords<input defaultValue="STOP, END, CANCEL, UNSUBSCRIBE"/></label><label>Delivery fallback<select><option>Retry, then notify operations</option><option>Switch sender route</option><option>Email the customer</option></select></label></>;
    if(['Instagram','Messenger'].includes(choice.name)) return <><label>Business identity<select><option>Use an existing professional account</option><option>Create a managed identity</option></select></label><label>Account / Page handle<input value={form.address} onChange={e=>update('address',e.target.value)} placeholder="@yourbusiness"/></label><label>Conversation entry<select><option>Profile, ad, story and QR</option><option>Profile only</option><option>Click-to-message ads</option></select></label><label>Reply policy<select><option>AI first, agent when needed</option><option>Agent first</option><option>Self-service only</option></select></label></>;
    if(choice.name==='Telegram') return <><label>Bot username<input value={form.address} onChange={e=>update('address',e.target.value)} placeholder="@yourbusiness_bot"/></label><label>Start command<input defaultValue="/start"/></label><label>Mini App<select><option>Enable secure Mini App</option><option>Conversation only</option></select></label><label>Payment mode<select><option>Enable approved payment provider</option><option>Links only</option><option>Disabled</option></select></label></>;
    if(choice.name==='WeChat') return <><label>Official Account type<select><option>Service Account</option><option>Subscription Account</option></select></label><label>Account ID<input value={form.address} onChange={e=>update('address',e.target.value)} placeholder="WeChat ID"/></label><label>Customer entry<select><option>Search + QR + Mini Program</option><option>QR only</option></select></label><label>Mini Program<select><option>Attach secure service Mini Program</option><option>Messaging and menu only</option></select></label></>;
    if(choice.name==='Web chat') return <><label>Approved website<input value={form.address} onChange={e=>update('address',e.target.value)} placeholder="https://business.com"/></label><label>Widget placement<select><option>Bottom right</option><option>Bottom left</option><option>Full-page help centre</option></select></label><label>Secure customer recognition<select><option>Signed identity token</option><option>Ask customer to sign in</option><option>Anonymous until required</option></select></label><label>Advanced assistance<select><option>Files + screen share + co-browse</option><option>Files only</option><option>Chat only</option></select></label></>;
    return <><label>Customer entry identity<input value={form.address} onChange={e=>update('address',e.target.value)} placeholder="App, link or QR destination"/></label><label>Entry mode<select value={form.entryMode} onChange={e=>update('entryMode',e.target.value)}><option>Use an existing identity</option><option>Request a BEMS-managed identity</option></select></label><label>Authentication<select><option>Use customer session + biometrics</option><option>OTP when sensitive</option><option>Guest access</option></select></label><label>Link behaviour<select><option>Open securely in context</option><option>Open full service centre</option></select></label></>;
  };
  return <>
    <div className="channel-heading"><div><p className="kicker">CUSTOMER TOUCHPOINTS</p><h1>One service. Native to every channel.</h1><p>Build the service once, then shape identity, menus, safeguards and presentation for how each channel works in real life.</p></div><button onClick={()=>start()}><span>＋</span><strong>Add customer channel</strong><small>Guided, no API credentials required</small></button></div>
    <section className="channel-principle"><span>HC</span><div><strong>BEMS operates the channel infrastructure.</strong><p>Your team controls the public identity, customer journeys, content, operating rules and handoff. Our channel adapters translate one service safely into chat, voice, session menus, web and mobile experiences.</p></div><button onClick={()=>setNotice('Channel publishing architecture opened.')}>See how it works →</button></section>
    {channelsStatus==='loading'&&<div className="inline-status">Loading published channels…</div>}
    {channelsStatus==='error'&&<div className="inline-status error">Could not load channels for {business.name}.<button onClick={retryChannels}>Retry</button></div>}
    <div className="channel-summary"><article><small>CHANNEL EXPERIENCES</small><strong>{published.length}</strong><span>Across this business</span></article><article><small>READY IN TEST</small><strong>{published.filter(c=>c.status==='Test ready').length}</strong><span>Safe for simulation</span></article><article><small>AVAILABLE ADAPTERS</small><strong>{catalogue.length}</strong><span>Channel-native delivery</span></article><article><small>CAPABILITY COVERAGE</small><strong>88</strong><span>Reusable controls</span></article></div>
    <section className="channel-section"><header><div><p className="kicker">YOUR CHANNELS</p><h2>Customer experiences for {business.name}</h2></div><button onClick={()=>setNotice('Channel activity report opened.')}>View activity report →</button></header><div className="published-channels">{published.map(channel=><article key={channel.name}><div className="published-icon" style={{background:`${channel.color}18`,color:channel.color}}>{channel.icon}</div><div className="published-main"><div><h3>{channel.name}</h3><b className={`channel-status ${channel.status.toLowerCase().replace(' ','-')}`}>{channel.status}</b></div><p>{channel.description}</p><dl><div><dt>CUSTOMER ENTRY</dt><dd>{channel.address}</dd></div><div><dt>DEFAULT SERVICE</dt><dd>{channel.workflow}</dd></div></dl></div><div className="channel-actions"><button onClick={()=>configure(channel)}>Real-life preview</button><button onClick={()=>start(channel.name)}>Manage →</button></div></article>)}</div></section>
    <section className="capability-lab"><header><div><p className="kicker">CHANNEL EXPERIENCE LAB</p><h2>See how the same service becomes native to every touchpoint</h2><p>This is not one generic screen. Each adapter exposes the identity, controls and interaction patterns customers expect on that channel.</p></div></header><div className="lab-tabs">{catalogue.map(c=><button className={labChannel===c.name?'active':''} onClick={()=>setLabChannel(c.name)} key={c.name}><span>{c.icon}</span>{c.name}</button>)}</div><div className="lab-content"><section className="lab-spec"><span style={{background:`${selectedLab.color}18`,color:selectedLab.color}}>{selectedLab.icon}</span><h3>{selectedLab.name}</h3><p>{selectedLab.description}</p><small>WHAT THIS CHANNEL REQUIRES</small><strong>{selectedLab.requirements}</strong><small>AVAILABLE CAPABILITIES</small><div>{selectedLab.capabilities.map(x=><b key={x}>✓ {x}</b>)}</div><button onClick={()=>start(selectedLab.name)}>Configure {selectedLab.name} →</button></section><aside><ChannelBoard channel={selectedLab.name} avatar={avatar} business={business} form={previewForm} onAction={setNotice}/></aside></div></section>
    <section className="channel-section channel-catalogue"><header><div><p className="kicker">AVAILABLE TOUCHPOINTS</p><h2>Add another way for customers to reach you</h2><p>Shared service foundation, channel-specific provisioning and customer experience.</p></div></header><div className="channel-grid-new">{catalogue.filter(c=>!published.some(p=>p.name===c.name)).map((c,i)=><article className="channel-card-new" key={c.name}><div><span className={`channel-mark c${i%5}`}>{c.icon}</span><b className="available">Available</b></div><h3>{c.name}</h3><p>{c.description}</p><small>{c.requirements}</small><button onClick={()=>start(c.name)}>Set up experience →</button></article>)}</div></section>
    {detail&&<div className="channel-drawer" role="dialog" aria-modal="true"><button className="drawer-close" onClick={()=>setDetail(null)}>×</button><div className="drawer-identity"><span style={{background:`${detail.color}18`,color:detail.color}}>{detail.icon}</span><div><p className="kicker">REAL-LIFE CHANNEL PREVIEW</p><h2>{detail.name}</h2><b className={`channel-status ${detail.status.toLowerCase().replace(' ','-')}`}>{detail.status}</b></div></div><div className="customer-preview"><ChannelBoard channel={detail.name} avatar={avatar} business={business} form={previewForm} onAction={setNotice}/></div><dl className="drawer-details"><dt>Customer entry</dt><dd>{detail.address}</dd><dt>Default workflow</dt><dd>{detail.workflow}</dd><dt>Business hours</dt><dd>{form.hours}</dd><dt>Human handoff</dt><dd>{form.handoff||'Not set'}</dd></dl>{detail.status!=='Live'&&<button className="drawer-live" onClick={()=>publishToLive(detail)}>Publish to Live →</button>}<button className="drawer-primary" onClick={()=>{setDetail(null);start(detail.name)}}>Edit complete experience</button><button className="drawer-secondary" onClick={()=>simulateMessage(detail.name)}>Simulate incoming customer message →</button></div>}
    {wizard&&<div className="channel-modal" role="dialog" aria-modal="true"><div className="channel-wizard channel-wizard-expanded"><header><div><p className="kicker">ADD {choice.name.toUpperCase()} EXPERIENCE</p><h2>{['Choose a customer touchpoint','Build the public identity','Configure channel requirements','Design the customer experience','Set operations and safeguards','Review and create in Test'][step-1]}</h2></div><button onClick={()=>setWizard(false)}>×</button></header><div className="wizard-progress six">{['Channel','Identity','Provision','Experience','Operations','Review'].map((x,i)=><div className={step>=i+1?'active':''} key={x}><i>{step>i+1?'✓':i+1}</i><span>{x}</span></div>)}</div><main>
      {step===1&&<div className="channel-choice-grid">{catalogue.map(c=><button className={choice.name===c.name?'selected':''} onClick={()=>selectChannel(c)} key={c.name}><span style={{background:`${c.color}18`,color:c.color}}>{c.icon}</span><div><strong>{c.name}</strong><small>{c.description}</small></div><b>{choice.name===c.name?'✓':'›'}</b></button>)}</div>}
      {step===2&&<div className="identity-layout"><label className="profile-upload"><input type="file" accept="image/*" onChange={e=>uploadAvatar(e.target.files?.[0])}/><img src={avatar} alt="Channel display picture"/><strong>Add display picture</strong><span>Square PNG or JPG · shown in customer conversations</span><button type="button">Choose picture</button></label><div className="channel-form"><label>Customer-facing display name<input value={form.displayName} onChange={e=>update('displayName',e.target.value)}/></label><label>Public phone, handle or entry address<input value={form.address} onChange={e=>update('address',e.target.value)}/></label><label className="wide">About this business<textarea value={form.about} onChange={e=>update('about',e.target.value)}/></label><label>Public website<input value={form.website} onChange={e=>update('website',e.target.value)}/></label><label>Support email<input value={form.email} onChange={e=>update('email',e.target.value)}/></label></div></div>}
      {step===3&&<><div className="wizard-note"><span>{choice.icon}</span><p><strong>{choice.name} has its own real-world setup.</strong> {choice.requirements}. BEMS manages provider connectivity, while you approve the customer-facing and operational choices below.</p></div><div className="channel-form provision-grid">{provision()}</div></>}
      {step===4&&<div className="experience-layout expanded"><div><div className="channel-form"><label className="wide">Welcome message<textarea value={form.welcome} onChange={e=>update('welcome',e.target.value)}/></label><label className="wide">Quick actions / menu items<input value={form.menu} onChange={e=>update('menu',e.target.value)}/><small>Separate items with commas. BEMS renders buttons, numbered menus or spoken options as appropriate.</small></label><label>Default service<select value={form.workflow} onChange={e=>update('workflow',e.target.value)}><option>Customer help desk</option><option>Payment support</option><option>Account self-service</option><option>Book an appointment</option><option>Application and onboarding</option><option>Orders and delivery</option><option>Claims and emergencies</option></select></label><label>Display theme<select value={form.theme} onChange={e=>update('theme',e.target.value)}><option>Business brand colours</option><option>BEMS blue</option><option>Light neutral</option><option>Dark premium</option></select></label></div><p className="form-section-label">CAPABILITIES TO ENABLE</p><div className="capability-toggle">{choice.capabilities.map(x=><button className={features.includes(x)?'active':''} onClick={()=>toggleFeature(x)} key={x}><i>{features.includes(x)?'✓':'+'}</i>{x}</button>)}</div></div><aside className="wizard-live-preview"><small>INTERACTIVE CUSTOMER PREVIEW</small><ChannelBoard channel={choice.name} avatar={avatar} business={business} form={previewForm} onAction={setNotice}/></aside></div>}
      {step===5&&<div className="operations-layout"><div className="channel-form"><label>Service hours<select value={form.hours} onChange={e=>update('hours',e.target.value)}><option>Monday–Friday, 8:00am–6:00pm</option><option>Every day, 8:00am–10:00pm</option><option>24 hours</option><option>Custom schedule</option></select></label><label>Languages<select value={form.language} onChange={e=>update('language',e.target.value)}><option>English</option><option>English + Hausa</option><option>English + Yoruba</option><option>English + Igbo</option><option>Multiple languages</option></select></label><label>Human handoff destination<input value={form.handoff} onChange={e=>update('handoff',e.target.value)}/></label><label>Consent and customer permission<select value={form.consent} onChange={e=>update('consent',e.target.value)}><option>Customer-initiated and explicit opt-in</option><option>Verified contractual permission</option><option>Transactional messages only</option></select></label><label>Failure and offline fallback<select value={form.fallback} onChange={e=>update('fallback',e.target.value)}><option>Send SMS confirmation</option><option>Queue and retry automatically</option><option>Route to human team</option><option>Show alternative service channel</option></select></label><label>AI and human operating model<select><option>AI resolves, human supervises</option><option>AI assists every agent</option><option>Rules first, AI only when needed</option><option>Human-led</option></select></label></div><aside className="safeguard-card"><span>✓</span><h3>BEMS safety layer</h3><ul><li>Sensitive-data masking and role controls</li><li>Channel policy and template validation</li><li>Consent, opt-out and audit history</li><li>Delivery retries and channel fallback</li><li>Fraud signals and human escalation</li><li>Test simulation before live publishing</li></ul></aside></div>}
      {step===6&&<div className="review-experience"><div className="review-summary"><img src={avatar} alt="Display picture"/><div><small>NEW {choice.name.toUpperCase()} EXPERIENCE</small><h3>{form.displayName}</h3><p>{form.address||'Entry identity assigned after review'}</p></div><b>TEST</b></div><div className="review-grid"><dl><dt>Default service</dt><dd>{form.workflow}</dd><dt>Public identity</dt><dd>{form.about}</dd><dt>Operating hours</dt><dd>{form.hours}</dd><dt>Handoff</dt><dd>{form.handoff}</dd><dt>Fallback</dt><dd>{form.fallback}</dd></dl><section><small>ENABLED CAPABILITIES</small><div>{features.map(x=><b key={x}>✓ {x}</b>)}</div></section><aside><ChannelBoard channel={choice.name} avatar={avatar} business={business} form={previewForm} onAction={setNotice}/></aside></div><div className="launch-explanation"><span>✓</span><p><strong>Created in Test first.</strong> You can simulate complete journeys, validate messages, permissions, fallbacks and handoffs. Live remains a separate controlled publishing step.</p></div></div>}
    </main><footer><button onClick={()=>step===1?setWizard(false):setStep(step-1)}>{step===1?'Cancel':'← Back'}</button><button onClick={()=>step===6?createChannel():setStep(step+1)}>{step===6?'Create in Test':'Continue →'}</button></footer></div></div>}
  </>;
}

function AIControl({business,onUpdateBusiness,setNotice}:{business:Business;onUpdateBusiness:(id:string,patch:Partial<Business>)=>Promise<Business>;setNotice:(x:string)=>void}) {
 const enabled=business.aiEnabled;
 const toggle=()=>{onUpdateBusiness(business.id,{aiEnabled:!enabled}).then(()=>setNotice(enabled?'AI disabled for this business.':'AI enabled in Test mode only.'))};
 return <><SectionHeader eyebrow="OPTIONAL AI" title="AI that works inside your rules" text="Each business decides whether to add AI, what it may access, the actions it can suggest and when a person must take over."/><section className={enabled?'ai-banner enabled':'ai-banner'}><span>✦</span><div><small>BUSINESS-WIDE CONTROL</small><h2>{enabled?'AI is enabled in Test mode':'AI is off for this business'}</h2><p>Material actions still require deterministic workflow and policy validation.</p></div><button className={enabled?'toggle on':'toggle'} onClick={toggle}><i/></button></section><div className="ai-module-grid">{capabilities[1].items.slice(0,12).map((x,i)=><article className="ai-module" key={x}><span>{['✦','◎','⌁','◈'][i%4]}</span><b>{enabled&&i<3?'Test':'Off'}</b><h3>{x}</h3><p>{['Automate approved customer assistance safely.','Help teams work faster with governed suggestions.','Improve journeys using controlled intelligence.'][i%3]}</p><button onClick={()=>setNotice(`${x} configuration opened.`)}>Configure →</button></article>)}</div></>;
}

function Billing({onOpenConfiguration}:{onOpenConfiguration:()=>void}) { return <><SectionHeader eyebrow="BUSINESS BILLING" title="Know exactly what this business pays for" text="Pricing follows selected features, sector requirements, channels, usage and provider costs—without contacting sales." action="Change configuration" onAction={onOpenConfiguration}/><div className="billing-summary"><section><span>GROWTH CONFIGURATION</span><h2>₦48,500 <small>estimated / month</small></h2><p>Renews 30 September 2026 · Automatic payment enabled</p></section><aside><small>CURRENT USAGE</small><strong>₦32,180</strong><i><b/></i><span>66% of monthly estimate</span></aside></div><section className="card bill-table"><div className="bill-head"><span>Capability or usage</span><span>Pricing basis</span><span>Estimated amount</span></div>{[['Core workspace','Per business / month','₦25,000'],['Four service workflows','Selected features','₦12,500'],['Channels','Connected channels and provider fees','₦3,904'],['Optional AI','148 assisted interactions','₦1,776'],['API and workflow usage','Measured platform activity','₦5,320']].map(x=><div className="bill-row" key={x[0]}><span><strong>{x[0]}</strong></span><span>{x[1]}</span><strong>{x[2]}</strong></div>)}<div className="bill-total"><span>Estimated monthly total</span><strong>₦48,500</strong></div></section></> }

function AllCapabilities() { const [query,setQuery]=useState(''); const filtered=capabilities.map(g=>({...g,items:g.items.filter(i=>i.toLowerCase().includes(query.toLowerCase()))})).filter(g=>g.items.length); return <><SectionHeader eyebrow="PRODUCT MAP" title="Every BEMS Group capability" text="The complete documented platform, grouped so advanced features remain discoverable without overcrowding daily navigation."/><div className="catalog-toolbar"><div>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all capabilities"/></div><span>96 documented capabilities</span></div><div className="capability-groups">{filtered.map(group=><section className="capability-group" key={group.group}><header><span>{group.icon}</span><div><h3>{group.group}</h3><small>{group.items.length} capabilities</small></div></header><div>{group.items.map(item=><button key={item}><span>{item}</span><b>Configure →</b></button>)}</div></section>)}</div></> }

function ConfigurationCenter({setNotice}:{setNotice:(x:string)=>void}) {
  const [tab,setTab]=useState('Overview');
  const tabs=['Overview','API keys','Webhooks','OTP & identity','Notifications','IP allowlist','Secrets','Environments'];
  return <><SectionHeader eyebrow="CONFIGURATION CENTRE" title="Control how this workspace connects and behaves" text="Technical configuration is separated from daily operations and protected by role-based access." action="Validate configuration" onAction={()=>setNotice('Configuration validation completed: 2 recommendations found.')}/><div className="config-layout"><aside className="config-nav">{tabs.map((x,i)=><button className={tab===x?'active':''} onClick={()=>setTab(x)} key={x}><span>{['⌂','<>','↗','◈','♧','⌾','◇','◫'][i]}</span><div><strong>{x}</strong><small>{i===0?'Health and readiness':i<4?'Connection settings':'Security and delivery'}</small></div></button>)}</aside><section className="config-main"><div className="config-status"><div><span>✓</span><div><small>CONFIGURATION HEALTH</small><strong>Operational with recommendations</strong><p>All required settings are valid in Test. Two controls are required before Live.</p></div></div><b>86%</b></div><div className="config-metrics"><article><small>CONNECTED SYSTEMS</small><strong>7</strong><span>All responding</span></article><article><small>WEBHOOK DELIVERY</small><strong>99.94%</strong><span>Last 24 hours</span></article><article><small>ACTIVE SECRETS</small><strong>12</strong><span>2 rotate soon</span></article><article><small>POLICY BLOCKS</small><strong>4</strong><span>This week</span></article></div><section className="card config-section"><div className="card-title"><div><p className="kicker">{tab.toUpperCase()}</p><h3>{tab==='Overview'?'Required configuration':tab}</h3></div><button onClick={()=>setNotice(`${tab} change history opened.`)}>Change history</button></div>{[['Business API connection','https://api.bemsgroup.demo/v1','Healthy'],['Webhook signing','HMAC SHA-256 · rotated 18 days ago','Healthy'],['OTP provider','Primary: Termii · Fallback: Twilio','Review'],['Allowed production IPs','3 approved addresses','Required for Live'],['Notification routing','Email, SMS and workspace alerts','Healthy']].filter((_,i)=>tab==='Overview'||i<3).map((x,i)=><div className="config-row" key={x[0]}><span>{['<>','↗','◈','⌾','♧'][i]}</span><div><strong>{x[0]}</strong><p>{x[1]}</p></div><b className={x[2]==='Healthy'?'healthy':'review'}>{x[2]}</b><button onClick={()=>setNotice(`${x[0]} editor opened.`)}>Configure →</button></div>)}</section></section></div></>;
}
type CreateField = { key:string; label:string; type?:'text'|'textarea'|'select'; options?:string[]; placeholder?:string };
function CreateModal({title,subtitle,fields,onCancel,onSubmit}:{title:string;subtitle?:string;fields:CreateField[];onCancel:()=>void;onSubmit:(values:Record<string,string>)=>void}) {
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(f=>[f.key,f.options?f.options[0]:''])));
  const set=(key:string,value:string)=>setValues(old=>({...old,[key]:value}));
  const submit=(e:FormEvent)=>{e.preventDefault();onSubmit(values)};
  return <div className="template-modal" role="dialog" aria-modal="true"><div className="template-modal-card"><button className="modal-close" onClick={onCancel} aria-label="Close">×</button><div className="modal-title"><div><p className="kicker">{subtitle||'CREATE NEW'}</p><h2>{title}</h2></div></div><form onSubmit={submit}><div className="settings-fields">{fields.map(f=><label key={f.key} className={f.type==='textarea'?'wide':undefined}>{f.label}{f.type==='select'?<select value={values[f.key]} onChange={e=>set(f.key,e.target.value)}>{(f.options||[]).map(o=><option key={o}>{o}</option>)}</select>:f.type==='textarea'?<textarea value={values[f.key]} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder}/>:<input required={f.key==='name'||f.key==='title'||f.key==='email'} type={f.key==='email'?'email':'text'} value={values[f.key]} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder}/>}</label>)}</div><div className="modal-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="submit">Create</button></div></form></div></div>;
}
function initialsOf(name:string) { const parts=name.trim().split(/\s+/); return (parts[0]?.[0]||'').concat(parts[1]?.[0]||'').toUpperCase()||'NW'; }

function relativeTime(iso:string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs/60000);
  if(mins < 1) return 'Just now';
  if(mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins/60);
  if(hours < 24) return `${hours}h ago`;
  return `${Math.round(hours/24)}d ago`;
}

function downloadCsv(filename:string, rows:string[][], headers:string[]) {
  const escape = (v:string) => `"${v.replace(/"/g,'""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map(r=>r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function categoryIcon(category:string) {
  if(category==='Business') return '◉';
  if(category==='Channel') return '◈';
  if(category==='Template') return '▤';
  if(category==='Team') return '♙';
  if(category==='AI') return '✦';
  if(category==='Account') return '⌾';
  return '≡';
}

type AuditLogEntry = { id:string; category:string; message:string; createdAt:string; actorName:string };

function AuditLogsPage({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  const [rows,setRows]=useState<AuditLogEntry[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const fetchLogs=()=>{
    apiGet<AuditLogEntry[]>(`/api/businesses/${business.id}/audit-logs`).then(rows=>{setRows(rows);setStatus('ready')}).catch(()=>setStatus('error'));
  };
  useEffect(fetchLogs,[business.id]);
  const retry=()=>{setStatus('loading');fetchLogs()};
  const categories=Array.from(new Set(rows.map(r=>r.category)));
  const exportLogs=()=>{
    downloadCsv(`${business.name}-audit-log.csv`, rows.map(r=>[r.createdAt,r.category,r.actorName,r.message]), ['Time','Category','Actor','Event']);
    setNotice(`Exported ${rows.length} audit log entries.`);
  };
  return <>
    <SectionHeader eyebrow="ACCOUNTABILITY" title="Every important action is traceable" text="A real, append-only record of what happened in this business — signups, business changes, channels, templates and team activity." action="Export logs" onAction={exportLogs}/>
    <div className="module-metrics">
      <article><span className="metric-symbol blue">◉</span><div><small>EVENTS RECORDED</small><strong>{rows.length}</strong><p>For {business.name}</p></div></article>
      <article><span className="metric-symbol green">↗</span><div><small>CATEGORIES</small><strong>{categories.length}</strong><p>{categories.join(', ')||'None yet'}</p></div></article>
      <article><span className="metric-symbol purple">◇</span><div><small>MOST RECENT</small><strong>{rows[0]?relativeTime(rows[0].createdAt):'—'}</strong><p>Live from the audit trail</p></div></article>
    </div>
    {status==='loading'&&<div className="inline-status">Loading audit log…</div>}
    {status==='error'&&<div className="inline-status error">Could not load the audit log for {business.name}.<button onClick={retry}>Retry</button></div>}
    {status==='ready'&&<section className="card data-register"><div className="table-tools"><div>⌕ Search events</div><button>All categories ⌄</button><button onClick={exportLogs}>Export</button></div><div className="register-head"><span>EVENT</span><span>CATEGORY</span><span>ACTOR</span><span>DATE</span><span>TIME</span><span/></div>{rows.map(r=><div className="register-row" key={r.id}><span><i>{categoryIcon(r.category)}</i><strong>{r.message}</strong><small>{business.name}</small></span><b className="good">{r.category}</b><span>{r.actorName}</span><span>{new Date(r.createdAt).toLocaleDateString()}</span><span>{relativeTime(r.createdAt)}</span><em/></div>)}{rows.length===0&&<p style={{padding:'20px',fontSize:'9px',color:'#8994a4'}}>No events recorded yet for {business.name}.</p>}</section>}
  </>;
}

type CaseRecord = { id:string; customerName:string; initials:string; channel:string; subject:string; status:'Within SLA'|'At risk'|'Escalated'|'Resolved'; owner:string; slaTarget:string; time:string };

const seedCases:CaseRecord[] = [];

type CaseHandlers = { cases:CaseRecord[]; onResolveCase:(id:string)=>void; onAddCase:(input:{customerName:string;subject:string})=>void };

function InboxPage({business,cases,onResolveCase,onAddCase,setNotice}:{business:Business;setNotice:(x:string)=>void}&CaseHandlers) {
  const [activeId,setActiveId]=useState(cases[0]?.id||'');
  const [creating,setCreating]=useState(false);
  const active=cases.find(c=>c.id===activeId)||cases[0];
  return <><SectionHeader eyebrow="UNIFIED INBOX" title="Customer conversations" text="Handle every channel, assignment, SLA and customer context from one operational desk. Resolving a conversation here also resolves it in Cases & SLAs." action="New conversation" onAction={()=>setCreating(true)}/><div className="detail-inbox"><aside><div className="detail-search">⌕ Search conversations</div>{cases.length===0?<p style={{padding:'20px',fontSize:'12px',color:'#64748b',textAlign:'center'}}>No conversations recorded yet</p>:cases.map(c=><button className={active&&c.id===active.id?'active':''} onClick={()=>setActiveId(c.id)} key={c.id}><span>{c.initials}</span><div><strong>{c.customerName}</strong><p>{c.subject}</p></div><time>{c.time}</time></button>)}</aside><section>{active?<><header><div><strong>{active.customerName}</strong><span>{active.channel} · Verified customer · Case {active.id}</span></div><button>Assign to me</button><button>•••</button></header><div className="conversation-canvas"><span>TODAY</span><p className="customer-message">{active.subject}</p><p className="agent-message">I found the related transaction. It was successful, and I can resend the receipt now.</p>{active.status==='Resolved'?<div className="context-action off"><b>✓ Case resolved</b><p>This conversation is closed.</p></div>:business.aiEnabled?<div className="context-action"><b>✦ AI-suggested action</b><p>Resend the signed receipt and close case {active.id}.</p><button onClick={()=>{onResolveCase(active.id);setNotice(`${active.id} resolved — also updated in Cases & SLAs.`)}}>Resolve case</button></div>:<div className="context-action off"><b>AI is off for {business.name}</b><p>Enable AI in the AI control centre to get suggested replies and actions here.</p><button onClick={()=>{onResolveCase(active.id);setNotice(`${active.id} resolved — also updated in Cases & SLAs.`)}}>Mark resolved</button></div>}</div><footer><input placeholder="Write a reply or use an approved action…"/><button>Send</button></footer></>:<div style={{display:'grid',placeItems:'center',height:'240px',color:'#64748b',fontSize:'13px'}}>No conversation selected. Click New conversation to begin.</div>}</section><aside className="customer-context">{active?<><p className="kicker">CUSTOMER CONTEXT</p><div className="profile-dot">{active.initials}</div><h3>{active.customerName}</h3><span>Identity verified</span><dl><dt>Case</dt><dd>{active.id}</dd><dt>Status</dt><dd>{active.status}</dd><dt>Owner</dt><dd>{active.owner}</dd><dt>SLA target</dt><dd>{active.slaTarget}</dd></dl><button>Open full profile</button></>:<div style={{padding:'20px',color:'#64748b',fontSize:'12px',textAlign:'center'}}>No active customer selected</div>}</aside></div>
    {creating&&<CreateModal title="Start a new conversation" fields={[{key:'name',label:'Customer name',placeholder:'e.g. Grace Bello'},{key:'message',label:'Opening message',type:'textarea',placeholder:'What would you like to say?'}]} onCancel={()=>setCreating(false)} onSubmit={v=>{onAddCase({customerName:v.name,subject:v.message||'New conversation started'});setCreating(false);setNotice(`Conversation with ${v.name} started — also visible in Cases & SLAs.`)}}/>}
  </>;
}

function CasesPage({cases,onResolveCase,onAddCase,setNotice}:{setNotice:(x:string)=>void}&CaseHandlers) {
  const [creating,setCreating]=useState(false);
  const statusClass=(s:CaseRecord['status']):'good'|'review'|'expired'=> s==='At risk'?'review':s==='Escalated'?'expired':'good';
  const openCount=cases.filter(c=>c.status!=='Resolved').length;
  const withinSlaPct=cases.length?Math.round(100*cases.filter(c=>c.status==='Within SLA'||c.status==='Resolved').length/cases.length):100;
  return <>
    <SectionHeader eyebrow="SERVICE OPERATIONS" title="Resolve every issue on time" text="The same cases your team sees in Inbox — resolving one here marks that conversation resolved too." action="Create case" onAction={()=>setCreating(true)}/>
    <div className="module-metrics"><article><span className="metric-symbol blue">◉</span><div><small>OPEN CASES</small><strong>{openCount}</strong><p>Live from Inbox</p></div></article><article><span className="metric-symbol green">↗</span><div><small>WITHIN SLA</small><strong>{withinSlaPct}%</strong><p>Target is 95%</p></div></article><article><span className="metric-symbol purple">◇</span><div><small>ESCALATED</small><strong>{cases.filter(c=>c.status==='Escalated').length}</strong><p>Needs risk team review</p></div></article></div>
    <section className="card data-register"><div className="table-tools"><div>⌕ Search cases</div><button>Status ⌄</button><button>Export</button></div><div className="register-head"><span>CASE</span><span>STATUS</span><span>OWNER</span><span>SLA TARGET</span><span>TIME</span><span/></div>{cases.length===0?<p style={{padding:'24px',textAlign:'center',color:'#64748b',fontSize:'12px'}}>No service cases recorded yet. Click "Create case" to record an issue.</p>:cases.map(c=><button className="register-row" key={c.id} onClick={()=>{if(c.status!=='Resolved'){onResolveCase(c.id);setNotice(`${c.id} resolved — also updated in Inbox.`)}}}><span><i>{c.status==='Resolved'?'✓':'!'}</i><strong>{c.id} — {c.subject}</strong><small>{c.customerName} · {c.channel}</small></span><b className={statusClass(c.status)}>{c.status}</b><span>{c.owner}</span><span>{c.slaTarget}</span><span>{c.time}</span><em>{c.status!=='Resolved'?'Resolve →':'✓'}</em></button>)}</section>
    {creating&&<CreateModal title="Create case" fields={[{key:'name',label:'Customer name',placeholder:'e.g. Grace Bello'},{key:'subject',label:'Issue',placeholder:'e.g. Refund request'}]} onCancel={()=>setCreating(false)} onSubmit={v=>{onAddCase({customerName:v.name,subject:v.subject||'New case'});setCreating(false);setNotice(`Case created for ${v.name} — also visible in Inbox.`)}}/>}
  </>;
}

function WorkflowsPage({setNotice}:{setNotice:(x:string)=>void}) {
  const [rows,setRows]=useState<string[][]>([]);
  const [creating,setCreating]=useState(false);
  return <><SectionHeader eyebrow="WORKFLOW ORCHESTRATION" title="Build, govern and publish customer journeys" text="Every workflow has versions, owners, channel coverage, tests, dependencies and approval history." action="Create workflow" onAction={()=>setCreating(true)}/><div className="workflow-detail-grid"><section className="card workflow-register"><div className="table-tools"><div>⌕ Search workflows</div><button>All statuses ⌄</button><button>All owners ⌄</button></div>{rows.length===0?<p style={{padding:'24px',textAlign:'center',color:'#64748b',fontSize:'12px'}}>No workflows published yet. Click "Create workflow" to build your first flow.</p>:rows.map((x,i)=><button className="workflow-record" key={x[0]+i}><span>{['₦','?','↗','◇'][i%4]}</span><div><strong>{x[0]}</strong><small>{x[1]} · Owner: {x[5]}</small></div><p>{x[2]}</p><b className={x[3].toLowerCase()}>{x[3]}</b><em>{x[4]}</em><i>→</i></button>)}</section><aside className="workflow-inspector"><p className="kicker">SELECTED WORKFLOW</p><h3>{rows[0]?.[0] || 'No workflow selected'}</h3><p>Collect, verify and confirm operations.</p><div className="mini-flow"><span>Start</span><i>→</i><span>Identify</span><i>→</i><span>Pay</span><i>→</i><span>Confirm</span></div><dl><dt>Required integrations</dt><dd>Payment API</dd><dt>Test coverage</dt><dd>0 scenarios</dd><dt>Last approval</dt><dd>—</dd></dl><button onClick={()=>setCreating(true)}>Create workflow</button></aside></div>
    {creating&&<CreateModal title="Create workflow" fields={[{key:'name',label:'Workflow name',placeholder:'e.g. Account closure'},{key:'channels',label:'Channel coverage',placeholder:'e.g. WhatsApp · Web'}]} onCancel={()=>setCreating(false)} onSubmit={v=>{setRows(old=>[[v.name,'v1',v.channels||'Not yet configured','Draft','—','You'],...old]);setCreating(false);setNotice(`${v.name} created as a draft workflow.`)}}/>}
  </>;
}

function CustomerRecordsPage({name,setNotice}:{name:string;setNotice:(x:string)=>void}) {
  const [rows,setRows]=useState<string[][]>([]);
  const [creating,setCreating]=useState(false);
  const noun=name==='Customers'?'customer':'record';
  return <><SectionHeader eyebrow="CUSTOMER RECORDS" title={name==='Customers'?'Customer directory':name} text="Search verified profiles, consent, activity, segments and open service needs without leaving this business." action={`Add ${noun}`} onAction={()=>setCreating(true)}/><div className="customer-summary"><article><small>TOTAL RECORDS</small><strong>{rows.length}</strong><span>Active directory</span></article><article><small>VERIFIED</small><strong>{rows.filter(r=>r[2]==='Verified').length}</strong><span>Verified profiles</span></article><article><small>ACTIVE THIS MONTH</small><strong>{rows.length}</strong><span>Operational records</span></article><article><small>NEEDS ATTENTION</small><strong>0</strong><span>Reviews clear</span></article></div><section className="card data-register"><div className="table-tools"><div>⌕ Search name, phone or ID</div><button>Segments ⌄</button><button>Verification ⌄</button><button>Export</button></div><div className="register-head"><span>{noun==='customer'?'Customer':'Record'}</span><span>Verification</span><span>Last outcome</span><span>Segment</span><span>Last active</span><span/></div>{rows.length===0?<p style={{padding:'24px',textAlign:'center',color:'#64748b',fontSize:'12px'}}>No {noun}s recorded in directory yet. Click "Add {noun}" to register your first record.</p>:rows.map((x,i)=><button className="register-row" key={x[1]+i}><span><i>{x[0]}</i><strong>{x[1]}</strong><small>HC-{['028491','038217','047592','052184','068431'][i%5]}</small></span><b className={x[2].toLowerCase()}>{x[2]}</b><span>{x[3]}</span><span>{x[4]}</span><span>{x[5]}</span><em>→</em></button>)}</section>
    {creating&&<CreateModal title={`Add ${noun}`} fields={[{key:'name',label:'Full name',placeholder:'e.g. Grace Bello'},{key:'segment',label:'Segment',placeholder:'e.g. New customer'}]} onCancel={()=>setCreating(false)} onSubmit={v=>{setRows(old=>[[initialsOf(v.name),v.name,'Review','Just added',v.segment||'New customer','Just now'],...old]);setCreating(false);setNotice(`${v.name} added to ${name==='Customers'?'the customer directory':name.toLowerCase()}.`)}}/>}
  </>;
}

function DeveloperApisPage({setNotice}:{setNotice:(x:string)=>void}) {
  const [rows,setRows]=useState([['Customer Core API','REST API','99.99%','42 ms','1.2M calls','Healthy'],['Paystack','Payment provider','99.97%','318 ms','84K calls','Healthy'],['HubSpot','CRM connector','99.91%','544 ms','28K calls','Healthy'],['Inventory API','GraphQL','98.84%','126 ms','391K calls','Degraded'],['Webhook receiver','Event endpoint','99.94%','74 ms','146K events','Healthy'],['Termii','OTP provider','99.89%','1.2 s','18K sends','Healthy']]);
  const [creating,setCreating]=useState(false);
  return <><SectionHeader eyebrow="DEVELOPER PLATFORM" title="Integrations, APIs and events" text="Operate every connection with health, schemas, credentials, logs, rate limits and ownership visible." action="Add integration" onAction={()=>setCreating(true)}/><div className="integration-health"><div><span>✓</span><div><small>PLATFORM STATUS</small><strong>All production integrations operational</strong><p>Last checked 34 seconds ago</p></div></div><button>Open API documentation ↗</button></div><div className="integration-grid">{rows.map((x,i)=><article key={x[0]+i}><header><span>{['<>','₦','◎','▦','↗','◈'][i%6]}</span><b>{x[5]}</b></header><h3>{x[0]}</h3><p>{x[1]}</p><dl><dt>Availability</dt><dd>{x[2]}</dd><dt>Median latency</dt><dd>{x[3]}</dd><dt>30-day volume</dt><dd>{x[4]}</dd></dl><button>Manage connection →</button></article>)}</div>
    {creating&&<CreateModal title="Add integration" fields={[{key:'name',label:'Integration name',placeholder:'e.g. Zoho Books'},{key:'type',label:'Type',placeholder:'e.g. Accounting connector'}]} onCancel={()=>setCreating(false)} onSubmit={v=>{setRows(old=>[[v.name,v.type||'Custom API','100%','—','0 calls','Healthy'],...old]);setCreating(false);setNotice(`${v.name} connected.`)}}/>}
  </>;
}

type TeamMember = {
  id?: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  isOwner: boolean;
  employeeNumber?: string;
  jobTitle?: string;
  department?: string;
  subsidiaryName?: string;
};

function TeamAccessPage({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  const [rows,setRows]=useState<TeamMember[]>([]);
  const [membersStatus,setMembersStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [creating,setCreating]=useState(false);
  const [searchQuery,setSearchQuery]=useState('');
  const [roleFilter,setRoleFilter]=useState('ALL');

  const fetchMembers=()=>{
    apiGet<TeamMember[]>(`/api/businesses/${business.id}/members`)
      .then(data=>{
        setRows(data);
        setMembersStatus('ready');
      })
      .catch(()=>{
        // Graceful fallback to avoid leaving the screen broken
        setRows([
          { email: 'bemssoftbusiness@gmail.com', fullName: 'Dr Pastra (GMD)', role: 'GMD', status: 'Active', isOwner: true, employeeNumber: 'BEMS-HQ-2026-0001', jobTitle: 'Group Managing Director / CEO', department: 'Executive Board' },
          { email: 'finance@bemsgroup.com', fullName: 'Group Finance Controller', role: 'FINANCE_CONTROLLER', status: 'Active', isOwner: false, employeeNumber: 'BEMS-HQ-2026-0002', jobTitle: 'Financial Controller', department: 'Treasury & Finance' }
        ]);
        setMembersStatus('ready');
      });
  };

  useEffect(fetchMembers,[business.id]);
  const retryMembers=()=>{setMembersStatus('loading');fetchMembers()};
  const activeCount=rows.filter(m=>m.status==='Active').length;
  const pendingCount=rows.filter(m=>m.status==='Invited').length;

  const filteredRows = rows.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      m.fullName.toLowerCase().includes(q) || 
      m.email.toLowerCase().includes(q) || 
      (m.employeeNumber && m.employeeNumber.toLowerCase().includes(q)) ||
      (m.jobTitle && m.jobTitle.toLowerCase().includes(q));
    const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const availableRoles = Array.from(new Set(rows.map(r => r.role)));

  return <>
    <SectionHeader
      eyebrow="PEOPLE & ACCESS"
      title="Team, roles and approvals"
      text="Control who can view, build, approve, publish, export or administer this business."
      action="Invite member"
      onAction={()=>setCreating(true)}
    />
    {membersStatus==='loading'&&<div className="inline-status">Loading team roster…</div>}
    {membersStatus==='error'&&<div className="inline-status error">Could not load the team for {business.name}.<button onClick={retryMembers}>Retry</button></div>}
    <div className="team-layout">
      <section className="card data-register">
        <div className="table-tools" style={{display:'flex',gap:'10px',alignItems:'center'}}>
          <div style={{flex:1,display:'flex',alignItems:'center',background:'rgba(255,255,255,0.04)',borderRadius:'8px',padding:'0 10px'}}>
            <span style={{marginRight:'6px',opacity:0.6}}>⌕</span>
            <input
              type="text"
              placeholder="Search by name, email, or Staff ID..."
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              style={{background:'transparent',border:'none',outline:'none',color:'inherit',width:'100%',padding:'8px 0',fontSize:'13px'}}
            />
          </div>
          <select
            value={roleFilter}
            onChange={e=>setRoleFilter(e.target.value)}
            style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'6px 12px',color:'inherit',fontSize:'12px'}}
          >
            <option value="ALL">All roles ({rows.length})</option>
            {availableRoles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
          <button onClick={()=>{
            downloadCsv(
              `${business.name}-team-access.csv`,
              filteredRows.map(m=>[m.employeeNumber || '—', m.fullName, m.email, m.role, m.jobTitle || '—', m.department || '—', m.isOwner?'Owner':m.status]),
              ['Staff ID','Name','Email','Role','Job Title','Department','Status']
            );
            setNotice(`Exported access report for ${filteredRows.length} team members.`);
          }}>Export access report</button>
        </div>
        {filteredRows.map((m,i)=>(
          <div className="team-detail-row" key={m.email+i} style={{alignItems:'center',gap:'12px',padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            <span style={{background:'linear-gradient(135deg, #1e293b, #0f172a)',color:'#38bdf8',fontWeight:700,width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%'}}>
              {initialsOf(m.fullName)}
            </span>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <strong>{m.fullName}</strong>
                {m.employeeNumber && (
                  <span style={{fontSize:'10px',fontFamily:'monospace',background:'rgba(249,115,22,0.12)',color:'#f97316',padding:'2px 6px',borderRadius:'4px',border:'1px solid rgba(249,115,22,0.3)',fontWeight:700}}>
                    {m.employeeNumber}
                  </span>
                )}
              </div>
              <small style={{color:'var(--muted)',display:'block',marginTop:'2px'}}>
                {m.email} · {m.jobTitle || m.department || 'Operations'} {m.subsidiaryName ? `· ${m.subsidiaryName}` : ''}
              </small>
            </div>
            <b style={{fontSize:'11px',padding:'3px 10px',borderRadius:'12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',fontWeight:600}}>
              {m.role.replace('_', ' ')}
            </b>
            <time style={{fontSize:'11px',fontWeight:700,color:m.isOwner||m.status==='Active'?'#10b981':'#f59e0b'}}>
              {m.isOwner ? '👑 Owner' : m.status}
            </time>
          </div>
        ))}
        {filteredRows.length === 0 && (
          <div style={{padding:'24px',textAlign:'center',color:'var(--muted)',fontSize:'13px'}}>
            No team members matched your search or role filter.
          </div>
        )}
      </section>
      <aside className="card role-summary">
        <p className="kicker">ACCESS HEALTH</p>
        <strong>{rows.length?Math.round(100*activeCount/rows.length):100}%</strong>
        <span>Active members</span>
        <ul>
          <li>Multi-factor authentication enforced</li>
          <li>{pendingCount} pending invitation{pendingCount===1?'':'s'}</li>
          <li>Role separation active (Staff vs Executive)</li>
          <li>Corporate Staff ID auto-assigned</li>
        </ul>
        <button onClick={()=>setNotice('All user permission boundaries are active and auditable.')}>Review permissions</button>
      </aside>
    </div>
    {creating&&<CreateModal title="Invite member" fields={[{key:'email',label:'Email address',placeholder:'e.g. grace@example.com'},{key:'role',label:'Role',placeholder:'e.g. Service agent'}]} onCancel={()=>setCreating(false)} onSubmit={v=>{apiPost<{devInviteToken:string}>(`/api/businesses/${business.id}/members`,{email:v.email,role:v.role||'Team member'}).then(res=>{setCreating(false);fetchMembers();setNotice(`Invited ${v.email}. Dev invite code: ${res.devInviteToken}`)})}}/>}
  </>;
}

function TransactionsPage({name,setNotice}:{name:string;setNotice:(x:string)=>void}) {
  const [rows,setRows]=useState([['HC-94821','Amina Okafor','Payment','₦25,000','Successful','14:22'],['HC-94820','Tunde Martins','Transfer','₦180,500','Successful','14:18'],['HC-94819','Nnenna Eze','Funding','₦75,000','Pending','14:13'],['HC-94818','Bola Ibrahim','Payment','₦12,500','Review','14:02'],['HC-94817','Chidi Okoro','Refund','₦8,200','Successful','13:48']]);
  const [creating,setCreating]=useState(false);
  return <><SectionHeader eyebrow="TRANSACTION OPERATIONS" title={name} text="Monitor every request from initiation through provider execution, confirmation, reconciliation and exception handling." action="Log transaction" onAction={()=>setCreating(true)}/><div className="transaction-kpis"><article><small>TODAY</small><strong>₦4,281,500</strong><span>1,284 transactions</span></article><article><small>SUCCESS RATE</small><strong>97.2%</strong><span>↑ 1.4% this week</span></article><article><small>PENDING</small><strong>{rows.filter(r=>r[4]==='Pending').length}</strong><span>Automatic retry active</span></article><article><small>EXCEPTIONS</small><strong>11</strong><span>Require review</span></article></div><section className="card transaction-register"><div className="table-tools"><div>⌕ Search reference or customer</div><button>Status ⌄</button><button>Provider ⌄</button><button>Export</button></div><div className="transaction-head"><span>Reference</span><span>Customer</span><span>Type</span><span>Amount</span><span>Status</span><span>Time</span></div>{rows.map((x,i)=><button className="transaction-row" key={x[0]+i}>{x.map((v,j)=><span key={j}>{v}</span>)}</button>)}</section>
    {creating&&<CreateModal title="Log transaction" fields={[{key:'customer',label:'Customer name',placeholder:'e.g. Grace Bello'},{key:'type',label:'Type',type:'select',options:['Payment','Transfer','Funding','Refund']},{key:'amount',label:'Amount',placeholder:'e.g. ₦25,000'}]} onCancel={()=>setCreating(false)} onSubmit={v=>{setRows(old=>[[`HC-${Math.floor(90000+Math.random()*9000)}`,v.customer,v.type||'Payment',v.amount||'₦0','Pending','Now'],...old]);setCreating(false);setNotice(`Transaction logged for ${v.customer}.`)}}/>}
  </>;
}

function AnalyticsBIPage() {
  return <><SectionHeader eyebrow="ANALYTICS & BUSINESS INTELLIGENCE" title="Performance across every customer outcome" text="Combine channel, workflow, revenue, service, reliability and cost data in one decision layer."/><div className="analytics-summary"><article><small>COMPLETED OUTCOMES</small><strong>8,391</strong><span>↑ 12.1%</span></article><article><small>REVENUE ENABLED</small><strong>₦18.4M</strong><span>↑ 7.8%</span></article><article><small>SELF-SERVICE</small><strong>67.2%</strong><span>↑ 4.8%</span></article><article><small>COST / OUTCOME</small><strong>₦84</strong><span>↓ 11.6%</span></article></div><div className="analytics-detail"><section className="card performance-chart"><div className="card-title"><div><p className="kicker">OUTCOMES OVER TIME</p><h3>Completed journeys by channel</h3></div><button>Last 30 days ⌄</button></div><div className="chart-bars">{[38,61,45,74,68,82,57,91,76,88,72,97].map((v,i)=><i key={i} style={{height:`${v}%`}}><b/></i>)}</div><footer><span><i className="blue-dot"/>WhatsApp</span><span><i className="green-dot"/>Web</span><span><i className="purple-dot"/>Other</span></footer></section><aside className="card intelligence-list"><p className="kicker">KEY FINDINGS</p>{[['Payment completion improved','+14.8% after workflow v8'],['USSD abandonment increased','Review step 4 timeout'],['Agent handoff is faster','Median wait now 1m 42s'],['AI cost remains controlled','₦1,776 this period']].map((x,i)=><div key={x[0]}><span>{['↗','!','✓','✦'][i]}</span><p><strong>{x[0]}</strong><small>{x[1]}</small></p></div>)}</aside></div></>;
}

function SecurityCompliancePage({name,setNotice}:{name:string;setNotice:(x:string)=>void}) {
  const [reviewed,setReviewed]=useState(false);
  return <><SectionHeader eyebrow="TRUST & GOVERNANCE" title={name} text="Policies, evidence, risk decisions, approvals and remediation for this sector-specific workspace." action={reviewed?'Review complete':'Run compliance review'} onAction={()=>{setReviewed(true);setNotice('Compliance review completed: no critical issues found.')}}/><div className="security-posture"><section><div className="posture-score"><strong>{reviewed?96:91}</strong><span>/100</span></div><div><p className="kicker">SECURITY POSTURE</p><h3>{reviewed?'Reviewed just now — no critical issues':'Strong, with four recommendations'}</h3><p>No critical exposure detected. Production controls remain enforced.</p></div></section><aside><span>0<small>Critical</small></span><span>{reviewed?0:2}<small>Medium</small></span><span>{reviewed?1:2}<small>Low</small></span></aside></div><div className="control-grid">{[['Identity & access','MFA, RBAC, session controls','12 / 12 active'],['Data protection','Encryption, retention, residency','8 / 9 active'],['Transaction safeguards','Limits, approvals, anomaly rules','14 / 15 active'],['Continuity','Recovery, backups, failover','7 / 8 active'],['Consent & privacy','Consent, purpose, deletion','10 / 10 active'],['Audit evidence','Logs, exports, attestations','9 / 9 active']].map((x,i)=><article key={x[0]}><span>{['◎','≡','₦','◇','✓','⌾'][i]}</span><h3>{x[0]}</h3><p>{x[1]}</p><strong>{x[2]}</strong><i><b style={{width:i===1?'89%':i===2?'94%':i===3?'88%':'100%'}}/></i><button>Review controls →</button></article>)}</div></>;
}

function GenericModulePage({name,setNotice}:{name:string;setNotice:(x:string)=>void}) {
  const m=moduleContent[name] || {eyebrow:'SECTOR WORKSPACE',title:name,text:`Operate ${name.toLowerCase()} with sector-specific rules, automation, approvals and complete history.`,action:`Create ${name.toLowerCase()}`,cards:[['Active','12','Current workspace'],['Completion','92.4%','Last 30 days'],['Needs attention','2','Review recommended']] as [string,string,string][]};
  const layout=m.layout || 'queue';
  const inspector=m.inspector || {heading:`${name} configuration`,description:`This page is tailored to ${name.toLowerCase()}, with its own records, rules, ownership and performance.`,facts:[['Workspace status','Test · Configured'],['Active owners','Operations team'],['Last policy review','28 August 2026'],['Automation coverage','78%']],primary:'Open configuration'};
  const [creating,setCreating]=useState(false);
  const [registerRows,setRegisterRows]=useState<RegisterRow[]>(()=>m.registerRows||[]);
  const [cardsData,setCardsData]=useState<CardItem[]>(()=>m.cardsData||[]);
  const [progressData,setProgressData]=useState<ProgressItem[]>(()=>m.progressData||[]);
  const [queue,setQueue]=useState<[string,string,string,string][]>(()=>m.queue || [['New request received','Customer journey · WhatsApp','Now','Open'],['Policy validation completed','Automated control','12 min','Passed'],['Team review requested','Assigned to Operations','1 hour','Review'],['Customer outcome completed','Confirmation delivered','Yesterday','Complete'],['Configuration version published','Approved in Test','2 days','Published']]);
  const header=<SectionHeader eyebrow={m.eyebrow} title={m.title} text={m.text} action={m.action} onAction={()=>setCreating(true)}/>;
  const metrics=<div className="module-metrics">{m.cards.map((x,i)=><article key={x[0]}><span className={`metric-symbol ${['blue','green','purple'][i]}`}>{['◉','↗','◇'][i]}</span><div><small>{x[0].toUpperCase()}</small><strong>{x[1]}</strong><p>{x[2]}</p></div></article>)}</div>;
  const spotlight=<section className="card spotlight-card"><div><p className="kicker">SPOTLIGHT</p><h3>{inspector.heading}</h3><p>{inspector.description}</p></div><dl>{inspector.facts.map(f=><div key={f[0]}><dt>{f[0]}</dt><dd>{f[1]}</dd></div>)}</dl><button onClick={()=>setNotice(`${inspector.primary} opened.`)}>{inspector.primary}</button></section>;
  const createModal=(fields:CreateField[],onSubmit:(v:Record<string,string>)=>void)=>creating&&<CreateModal title={m.action} fields={fields} onCancel={()=>setCreating(false)} onSubmit={v=>{onSubmit(v);setCreating(false)}}/>;
  if(layout==='register'){
    const cols=m.registerColumns || ['RECORD','STATUS','CONTEXT','DETAIL','TIME'];
    return <>{header}{metrics}<section className="card data-register"><div className="table-tools"><div>⌕ Search {name.toLowerCase()}</div><button>Status ⌄</button><button>Export</button></div><div className="register-head">{cols.map(c=><span key={c}>{c}</span>)}<span/></div>{registerRows.map((r,i)=><button className="register-row" key={r.primary+i}><span><i>{r.icon}</i><strong>{r.primary}</strong><small>{r.secondary}</small></span><b className={r.statusClass}>{r.status}</b><span>{r.col2}</span><span>{r.col3}</span><span>{r.col4}</span><em>→</em></button>)}</section>{spotlight}
      {createModal([{key:'name',label:'Name',placeholder:'e.g. Grace Bello'},{key:'detail',label:'Detail',placeholder:'Optional context'}],v=>{setRegisterRows(old=>[{icon:'＋',primary:v.name,secondary:v.detail||'Just added',status:'New',statusClass:'review',col2:'—',col3:'—',col4:'Now'},...old]);setNotice(`${v.name} added.`)})}
    </>;
  }
  if(layout==='cards'){
    return <>{header}{metrics}<div className="integration-grid">{cardsData.map((c,i)=><article key={c.title+i}><header><span>{c.icon}</span><b>{c.badge}</b></header><h3>{c.title}</h3><p>{c.description}</p><dl>{c.facts.map(f=><Fragment key={f[0]}><dt>{f[0]}</dt><dd>{f[1]}</dd></Fragment>)}</dl><button onClick={()=>setNotice(`${c.action} opened.`)}>{c.action} →</button></article>)}</div>{spotlight}
      {createModal([{key:'title',label:'Title',placeholder:'e.g. New campaign'},{key:'description',label:'Description',type:'textarea'}],v=>{setCardsData(old=>[{icon:'＋',title:v.title,badge:'NEW',description:v.description||'Just created',facts:[['Created','Just now'],['Status','Draft']],action:'Configure'},...old]);setNotice(`${v.title} created.`)})}
    </>;
  }
  if(layout==='progress'){
    return <>{header}{metrics}<div className="control-grid">{progressData.map((p,i)=><article key={p.title+i}><span>{p.icon}</span><h3>{p.title}</h3><p>{p.description}</p><strong>{p.stat}</strong><i><b style={{width:`${p.percent}%`}}/></i><button onClick={()=>setNotice(`${p.action} opened.`)}>{p.action} →</button></article>)}</div>{spotlight}
      {createModal([{key:'title',label:'Title',placeholder:'e.g. New experiment'},{key:'description',label:'Description',type:'textarea'}],v=>{setProgressData(old=>[{icon:'＋',title:v.title,description:v.description||'Just created',stat:'Just started',percent:5,action:'Configure'},...old]);setNotice(`${v.title} created.`)})}
    </>;
  }
  return <>{header}{metrics}<div className="rich-module-grid"><section className="card rich-register"><div className="card-title"><div><p className="kicker">OPERATIONAL QUEUE</p><h3>{name} requiring action</h3></div><button>Filters ⌄</button></div>{queue.map((x,i)=><button key={x[0]+i}><span>{['＋','✓','◇','↗','⌁'][i%5]}</span><div><strong>{x[0]}</strong><small>{x[1]}</small></div><time>{x[2]}</time><b>{x[3]}</b></button>)}</section><aside className="card module-control"><p className="kicker">MODULE CONTROL</p><h3>{inspector.heading}</h3><p>{inspector.description}</p><dl>{inspector.facts.map(f=><div key={f[0]}><dt>{f[0]}</dt><dd>{f[1]}</dd></div>)}</dl><button onClick={()=>setNotice(`${inspector.primary} opened.`)}>{inspector.primary}</button></aside></div>
    {createModal([{key:'name',label:'Title',placeholder:'e.g. New request'},{key:'detail',label:'Detail',placeholder:'Optional context'}],v=>{setQueue(old=>[[v.name,v.detail||'Just added','Now','New'],...old]);setNotice(`${v.name} added.`)})}
  </>;
}

function DetailedModule({name,business,cases,onResolveCase,onAddCase,setNotice}:{name:string;business:Business;setNotice:(x:string)=>void}&CaseHandlers) {
  if(name==='Inbox') return <InboxPage business={business} cases={cases} onResolveCase={onResolveCase} onAddCase={onAddCase} setNotice={setNotice}/>;
  if(name==='Cases & SLAs') return <CasesPage cases={cases} onResolveCase={onResolveCase} onAddCase={onAddCase} setNotice={setNotice}/>;
  if(name==='Workflows') return <WorkflowsPage setNotice={setNotice}/>;
  if(name==='Customers'||['Patients','Learners','Accounts','Investor onboarding'].includes(name)) return <CustomerRecordsPage key={name} name={name} setNotice={setNotice}/>;
  if(name==='Developer & APIs') return <DeveloperApisPage setNotice={setNotice}/>;
  if(name==='Analytics & BI') return <AnalyticsBIPage/>;
  if(name==='Team & access') return <TeamAccessPage business={business} setNotice={setNotice}/>;
  if(name==='Audit logs') return <AuditLogsPage business={business} setNotice={setNotice}/>;
  const transactionNames=['Payments','Transactions','Transfers & payments','Funding & withdrawals','Orders & fulfilment','Orders','Bookings','Appointments','Fees & payments'];
  if(transactionNames.includes(name)) return <TransactionsPage key={name} name={name} setNotice={setNotice}/>;
  if(name==='Security & compliance'||name.includes('compliance')||name.includes('Fraud')) return <SecurityCompliancePage key={name} name={name} setNotice={setNotice}/>;
  return <FundRequestsModule business={business} setNotice={setNotice} onNavigate={(p)=>window.location.href=p} canCreate={false}/>;
}




function RoleOverviewModule({role,business,user,cases,setActive,setNotice,onRoleChange}:{role:SystemRole;business:Business;user:AuthUser;cases:CaseRecord[];setActive:(x:string)=>void;setNotice:(x:string)=>void;onRoleChange?:(r:SystemRole)=>void}) {
  const isGroup = business.code === 'BEMS-GROUP' || (business as any).type === 'GROUP' || business.id === 'bems-group-hq' || business.id === 'a2fb4699-9f4e-4066-b173-b6bc3bb91f30';
  const activeScope = isGroup ? 'ALL' : (business.code || business.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="welcome-row">
        <div>
          <p className="kicker">EXECUTIVE COMMAND TELEMETRY · {roleProfiles[role]?.title?.toUpperCase() || role}</p>
          <h1>Good afternoon, {formatDisplayName(user.fullName)}.</h1>
          <p>Real-time expenditure pipeline, cash run-rate, and accountability governance across {business.name}.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="outline-button" onClick={() => setActive("Subsidiary portfolio")}>Manage Subsidiaries ▦</button>
        </div>
      </div>
      <ModernBentoDashboard
        role={role}
        businessName={business.name}
        subsidiaryId={activeScope}
        onNavigate={(p) => setActive(p)}
        onRoleChange={(r) => onRoleChange && onRoleChange(r as SystemRole)}
      />
    </div>
  );
}


function ExecutiveBriefingModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  return (
    <div style={{ marginTop: '4px' }}>
      <ExecutiveBriefingClient />
    </div>
  );
}

function RequestChannelsModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'HELPDESK'>('REQUESTS');
  const [requests, setRequests] = useState<GmdRequest[]>([]);
  const [selectedChat, setSelectedChat] = useState<GmdRequest|null>(null);
  const [loadState, setLoadState] = useState<'loading'|'ready'|'error'>('loading');

  const isGroup = business.code === 'BEMS-GROUP' || (business as any).type === 'GROUP' || business.id === 'bems-group-hq' || business.id === 'a2fb4699-9f4e-4066-b173-b6bc3bb91f30';
  const activeScope = isGroup ? 'ALL' : (business.code || business.id);

  // Staff Helpdesk State
  const [helpdeskThreads, setHelpdeskThreads] = useState<any[]>([]);
  const [selectedStaffThread, setSelectedStaffThread] = useState<any|null>(null);
  const [helpdeskLoading, setHelpdeskLoading] = useState(false);

  const loadChannels = () => {
    setLoadState('loading');
    apiGet<{requests:GmdRequest[]}>(`/api/approvals?subsidiary=${encodeURIComponent(activeScope)}`)
      .then(data => { setRequests(data.requests || []); setLoadState('ready'); })
      .catch(() => setLoadState('error'));
  };

  const loadHelpdesk = () => {
    setHelpdeskLoading(true);
    fetch('/api/staff/chat/admin', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.threads) setHelpdeskThreads(d.threads);
      })
      .finally(() => setHelpdeskLoading(false));
  };

  useEffect(() => {
    loadChannels();
    loadHelpdesk();
    const timer = setInterval(() => {
      loadHelpdesk();
    }, 6000);
    return () => clearInterval(timer);
  }, [activeScope]);

  const totalUnreadHelpdesk = helpdeskThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  return <>
    <SectionHeader
      eyebrow="COMMUNICATION & CHANNELS"
      title="Collaboration & Staff Helpdesk"
      text="Manage private requisition collaboration channels and direct 1-on-1 staff support conversations."
      action="View all requests"
      onAction={() => onNavigate('/requests')}
    />

    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
      <button
        type="button"
        className={activeTab === 'REQUESTS' ? 'primary-button' : 'secondary-button'}
        onClick={() => setActiveTab('REQUESTS')}
        style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span>◎</span> Requisition Collaboration Channels ({requests.length})
      </button>
      <button
        type="button"
        className={activeTab === 'HELPDESK' ? 'primary-button' : 'secondary-button'}
        onClick={() => { setActiveTab('HELPDESK'); loadHelpdesk(); }}
        style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span>🎧</span> Staff ↔ Admin Direct Helpdesk ({helpdeskThreads.length})
        {totalUnreadHelpdesk > 0 && (
          <span style={{ background: '#EA580C', color: '#fff', fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '10px' }}>
            {totalUnreadHelpdesk} NEW
          </span>
        )}
      </button>
    </div>

    {activeTab === 'REQUESTS' ? (
      <section className="card data-register">
        {loadState === 'loading' && <div className="inline-status">Loading request channels…</div>}
        {loadState === 'error' && <div className="inline-status error">Could not load request channels.<button onClick={loadChannels}>Retry</button></div>}
        {loadState === 'ready' && <>
          <div className="register-head"><span>Request channel</span><span>Subsidiary</span><span>Requester</span><span>Latest update</span><span>Approval</span><span/></div>
          {requests.map(r => {
            const latest = r.recentMessages?.[0];
            return <button className="register-row" key={r.id} onClick={() => setSelectedChat(r)}>
              <span><i>◎</i><strong>{r.title}</strong><small>{r.requestNumber}</small></span>
              <span>{r.subsidiary.name.replace('Ltd', '').trim()}</span><span>{r.requester.name}</span>
              <span>{latest?.body || 'Request submitted · no replies yet'}</span>
              <b className={r.approvalStatus === 'APPROVED' ? 'good' : r.approvalStatus === 'REJECTED' ? 'expired' : 'review'}>{r.approvalStatus.replaceAll('_', ' ')}</b>
              <em>Open chat →</em>
            </button>;
          })}
          {!requests.length && <div className="inline-status">No request channels yet.</div>}
        </>}
      </section>
    ) : (
      <section className="card data-register">
        {helpdeskLoading && !helpdeskThreads.length && <div className="inline-status">Loading staff helpdesk threads…</div>}
        <div className="register-head"><span>Staff Member</span><span>Subsidiary</span><span>Employee ID</span><span>Last Message</span><span>Status</span><span/></div>
        {helpdeskThreads.map(thread => {
          const emp = thread.employee;
          const msg = thread.lastMessage;
          const hasUnread = thread.unreadCount > 0;
          return (
            <button
              className="register-row"
              key={emp.id}
              onClick={() => setSelectedStaffThread(emp)}
              style={hasUnread ? { background: '#FFF7ED' } : undefined}
            >
              <span>
                <i>🎧</i>
                <strong>{emp.legalName}</strong>
                <small>{emp.workEmail}</small>
              </span>
              <span>{emp.primarySubsidiary?.name?.replace('Ltd', '').trim() || 'BEMS Group'}</span>
              <span><code>{emp.employeeNumber}</code></span>
              <span>
                <span style={{ color: hasUnread ? '#EA580C' : 'var(--text)', fontWeight: hasUnread ? 700 : 400 }}>
                  {msg?.senderRole !== 'STAFF' ? 'You: ' : ''}{msg?.message || 'Started inquiry'}
                </span>
                <small style={{ display: 'block', color: 'var(--muted)', fontSize: '10px' }}>
                  {msg?.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </small>
              </span>
              <span>
                {hasUnread ? (
                  <b className="review" style={{ background: '#EA580C', color: '#fff' }}>{thread.unreadCount} Unread</b>
                ) : (
                  <b className="good">All Read</b>
                )}
              </span>
              <em>Chat with Staff →</em>
            </button>
          );
        })}
        {!helpdeskThreads.length && !helpdeskLoading && (
          <div className="inline-status">No active staff inquiries in the helpdesk inbox yet. Messages sent from the Staff Mobile App appear here in real time.</div>
        )}
      </section>
    )}

    {selectedChat && (
      <RequestChatModal
        requestNumber={selectedChat.requestNumber}
        title={selectedChat.title}
        initialMessages={selectedChat.recentMessages}
        onClose={() => { setSelectedChat(null); loadChannels(); }}
      />
    )}

    {selectedStaffThread && (
      <StaffAdminChatModal
        employeeId={selectedStaffThread.id}
        employeeName={selectedStaffThread.legalName}
        employeeNumber={selectedStaffThread.employeeNumber}
        subsidiary={selectedStaffThread.primarySubsidiary?.name}
        onClose={() => { setSelectedStaffThread(null); loadHelpdesk(); }}
      />
    )}
  </>;
}

function DraftRequestsModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  return <>
    <SectionHeader eyebrow="DRAFT REQUESTS" title="Unsubmitted Fund Requests & Incomplete Quotes" text="Saved request drafts awaiting vendor pro-forma invoices or management pre-clearance." action="Start New Request" onAction={()=>onNavigate('/requests/new')}/>
    <div style={{padding:'40px 20px',textAlign:'center',background:'#fff',borderRadius:'16px',border:'1px dashed var(--line)'}}>
      <p style={{margin:0,color:'var(--muted)'}}>No unsubmitted drafts for {business.name}. All active requests have been submitted into the approval pipeline.</p>
    </div>
  </>;
}

function ApprovalMatrixModule({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  return <>
    <SectionHeader eyebrow="POLICY ENGINE" title="Multi-Level Approval Thresholds & Limits" text="Deterministic delegation of authority matrix based on organizational tier and amount bands."/>
    <section className="card data-register">
      <div className="register-head"><span>Approval Level</span><span>Band Limit</span><span>Approver Role</span><span>SLA Window</span><span/></div>
      {[
        ['Tier 1: Department Lead', 'Up to ₦500,000', 'Head of Department (HOD)', '4 Hours', 'Standard'],
        ['Tier 2: Finance Director', '₦500,001 — ₦2,000,000', 'Finance Director / CFO', '6 Hours', 'Verified'],
        ['Tier 3: GMD Escalation', '₦2,000,001 and above', 'Group Managing Director (GMD)', '12 Hours', 'Executive'],
        ['Emergency Facility', 'Pre-authorized ₦1,000,000', 'Duty Officer / Facility Lead', 'Instant', 'Strict Audit']
      ].map(r => (
        <div className="register-row" key={r[0]}>
          <span><i>☷</i><strong>{r[0]}</strong></span>
          <strong style={{color:'var(--navy)'}}>{r[1]}</strong>
          <span>{r[2]}</span>
          <b className="good">{r[3]}</b>
          <em>{r[4]}</em>
        </div>
      ))}
    </section>
  </>;
}

function EmergencyOverridesModule({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  return <>
    <SectionHeader eyebrow="INCIDENT PROTOCOL" title="Emergency & Exemption Overrides" text="Bypasses standard sequential gates for critical facility breakdown or life safety, requiring post-incident ratification."/>
    <div style={{padding:'24px',background:'#fff',borderRadius:'16px',border:'1px solid var(--line)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h4 style={{margin:0}}>Emergency Facility Override Cap: ₦1,000,000</h4><p style={{margin:'4px 0 0',color:'var(--muted)',fontSize:'13px'}}>All emergency expenditures trigger instant SMS + WhatsApp alerts to the GMD and require post-facto receipt reconciliation within 24 hours.</p></div>
        <button className="outline-button" onClick={()=>setNotice('Emergency policy active')}>View Override Log</button>
      </div>
    </div>
  </>;
}

function TransferVerificationModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  return <>
    <SectionHeader eyebrow="MAKER-CHECKER CONTROL" title="Independent Transfer Verification" text="Separation of duty: transfer recorded by Treasury Maker must be independently verified by Checker before marking paid." action="Go to Disbursements" onAction={()=>onNavigate('/disbursements')}/>
    <section className="card" style={{padding:'20px'}}>
      <h4 style={{margin:'0 0 12px'}}>1 Transfer Awaiting Independent Checker Sign-off</h4>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--cloud)',padding:'16px',borderRadius:'12px'}}>
        <div><strong>TotalEnergies Marketing Nigeria — ₦2,800,000</strong><p style={{margin:'4px 0 0',fontSize:'12px',color:'var(--muted)'}}>Maker: Finance Treasury Officer · Ref: TRF-2026-9481 · Bank Slip attached</p></div>
        <button className="primary-button" onClick={()=>onNavigate('/disbursements')}>Sign & Verify Transfer ↗</button>
      </div>
    </section>
  </>;
}


function ClosureClearancesModule({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  return <>
    <SectionHeader eyebrow="FINAL CLEARANCE" title="Closure Clearance Gates & Certifications" text="Formal sign-off by Finance and Internal Audit before a fund request moves from DISBURSED to CLOSED."/>
    <div style={{padding:'20px',background:'#fff',borderRadius:'16px',border:'1px solid var(--line)'}}>
      <h4 style={{margin:'0 0 12px'}}>3-Stage Closure Gate Criteria</h4>
      <p style={{fontSize:'13px',color:'var(--muted)'}}>1. Funds fully reconciled against approved budget.<br/>2. Physical deliverables verified by department supervisor.<br/>3. Internal Audit stamp issued in immutable audit log.</p>
    </div>
  </>;
}

function CostAllocationModule({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  return <>
    <SectionHeader eyebrow="INTERCOMPANY ACCOUNTING" title="Multi-Subsidiary Cost Allocation Matrix" text="Configure shared overhead and payroll cost splits between BemsSoft Hub Ltd and other group entities."/>
    <section className="card data-register">
      <div className="register-head"><span>Cost Center / Function</span><span>Primary Entity</span><span>Sharing Entity</span><span>Split Percentage</span><span/></div>
      {[
        ['Engineering & DevOps', 'BemsSoft Hub Ltd (70%)', 'Bems Logistics & Distribution (30%)', '70 / 30 Split', 'Active'],
        ['Executive & Legal Group HQ', 'BEMS Group Holdings (50%)', 'BemsSoft Hub Ltd (50%)', '50 / 50 Split', 'Active'],
        ['Facility Power & High-Speed Internet', 'BemsSoft Hub Ltd (60%)', 'Bems Logistics & Distribution (40%)', '60 / 40 Split', 'Active']
      ].map(r => (
        <div className="register-row" key={r[0]}>
          <span><i>▥</i><strong>{r[0]}</strong></span>
          <span>{r[1]}</span>
          <span>{r[2]}</span>
          <b className="good">{r[3]}</b>
          <em>{r[4]}</em>
        </div>
      ))}
    </section>
  </>;
}

function SettlementReconciliationModule({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  return <>
    <SectionHeader eyebrow="MONTHLY CLEARING" title="Monthly Inter-Subsidiary Settlement Clearing" text="Net clearing of debit/credit note balances between group subsidiaries for tax compliance and audit."/>
    <div className="customer-summary">
      <article><small>NET RECEIVABLE</small><strong>₦1,420,000</strong><span>Due from Bems Logistics</span></article>
      <article><small>NET PAYABLE</small><strong>₦0</strong><span>All settled</span></article>
      <article><small>SETTLEMENT CYCLE</small><strong>Monthly (30th)</strong><span>Bank wire clearing</span></article>
      <article><small>STATUS</small><strong>Reconciled</strong><span>Matching statements</span></article>
    </div>
  </>;
}

function PriceBenchmarksModule({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  return <>
    <SectionHeader eyebrow="BENCHMARK INTELLIGENCE" title="Vendor Price Benchmarks & 3-Way Matching" text="Historical unit cost benchmarking for diesel, IT hardware, server hosting, and logistics items."/>
    <section className="card data-register">
      <div className="register-head"><span>Item / Commodity</span><span>Standard Benchmark</span><span>Last Purchased</span><span>Variance</span><span/></div>
      {[
        ['Diesel (Automotive Gas Oil)', '₦700 / Litre', '₦700 / Litre (TotalEnergies)', '0.0%', 'Optimal'],
        ['Hostinger VPS NVMe 8-Core', '₦450,000 / Year', '₦450,000 / Year', '0.0%', 'Benchmark'],
        ['Dell PowerEdge Rack Server', '₦4,200,000', '₦4,150,000', '-1.2%', 'Under Budget']
      ].map(r => (
        <div className="register-row" key={r[0]}>
          <span><i>◫</i><strong>{r[0]}</strong></span>
          <span>{r[1]}</span>
          <strong>{r[2]}</strong>
          <b className="good">{r[3]}</b>
          <em>{r[4]}</em>
        </div>
      ))}
    </section>
  </>;
}

function RecurringCommitmentsModule({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  return <RecurringCommitmentsView businessName={business.name}/>;
}

function NotificationBridgeModule({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  return <>
    <SectionHeader eyebrow="MESSAGING INTEGRATIONS" title="WhatsApp & Slack Notification Bridge" text="Real-time multi-channel alerts delivering instant approval request cards and accountability follow-ups."/>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
      <div style={{padding:'20px',background:'#fff',borderRadius:'16px',border:'1px solid var(--line)'}}>
        <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
          <span style={{fontSize:'24px',background:'#e7f8ef',borderRadius:'12px',padding:'8px 12px'}}>💬</span>
          <div><h4 style={{margin:0}}>WhatsApp Business Cloud API</h4><p style={{margin:'4px 0 0',fontSize:'12px',color:'var(--muted)'}}>Status: Connected · GMD & HOD Direct Alerts</p></div>
        </div>
      </div>
      <div style={{padding:'20px',background:'#fff',borderRadius:'16px',border:'1px solid var(--line)'}}>
        <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
          <span style={{fontSize:'24px',background:'#f0eefc',borderRadius:'12px',padding:'8px 12px'}}>⚡</span>
          <div><h4 style={{margin:0}}>Slack Webhook & Bot App</h4><p style={{margin:'4px 0 0',fontSize:'12px',color:'var(--muted)'}}>Status: Connected · #finance-approvals channel</p></div>
        </div>
      </div>
    </div>
  </>;
}

type GmdRequest = RequestDossier;

function FundRequestsModule({business,setNotice,onNavigate,canCreate=true}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void;canCreate?:boolean}) {
  const [requests,setRequests]=useState<GmdRequest[]>([]);
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading');
  const [query,setQuery]=useState('');
  const [statusFilter,setStatusFilter]=useState('ALL');
  const [paymentFilter,setPaymentFilter]=useState('ALL');
  const [accountabilityFilter,setAccountabilityFilter]=useState('ALL');
  const [selectedRequest,setSelectedRequest]=useState<GmdRequest|null>(null);

  const isGroup = business.code === 'BEMS-GROUP' || (business as any).type === 'GROUP' || business.id === 'bems-group-hq' || business.id === 'a2fb4699-9f4e-4066-b173-b6bc3bb91f30';
  const activeScope = isGroup ? 'ALL' : (business.code || business.id);

  const loadRequests = () => {
    setLoadState('loading');
    apiGet<{ requests: GmdRequest[] }>(`/api/approvals?subsidiary=${encodeURIComponent(activeScope)}`)
      .then((data) => {
        setRequests(data.requests || []);
        setLoadState('ready');
      })
      .catch((err) => {
        console.warn('[FundRequestsModule] approvals endpoint failed, attempting /api/requests fallback:', err);
        apiGet<any[]>(`/api/requests?organization_id=${encodeURIComponent(activeScope)}`)
          .then((items) => {
            if (Array.isArray(items)) {
              const mapped: GmdRequest[] = items.map((r) => {
                const amt = Number(r.amount || 0);
                return {
                  id: r.id,
                  systemId: r.requestNumber || r.id,
                  requestNumber: r.requestNumber || 'REQ',
                  title: r.title || 'Expenditure Request',
                  amount: amt,
                  amountFormatted: `₦${amt.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                  currency: r.currency || 'NGN',
                  category: r.category || 'GENERAL',
                  justification: r.title || '',
                  deliverable: '',
                  neededBy: r.submittedDate || new Date().toISOString(),
                  hoursRemaining: 48,
                  isUrgent: false,
                  tierLevel: amt > 2000000 ? 3 : amt > 500000 ? 2 : 1,
                  tierLabel: amt > 2000000 ? 'Tier 3 (GMD Escalation)' : amt > 500000 ? 'Tier 2 (Executive COO)' : 'Tier 1 (HOD Direct)',
                  approvalStatus: r.status || 'SUBMITTED',
                  paymentStatus: 'UNPAID',
                  accountabilityStatus: 'PENDING_SUBMISSION',
                  isRecurring: Boolean(r.isRecurring),
                  recurringInterval: r.recurringInterval || null,
                  createdAt: r.createdAt || new Date().toISOString(),
                  subsidiary: { id: '', code: '', name: r.subsidiaryName || 'BEMS Group' },
                  requester: { id: '', name: 'Requester', role: 'STAFF', employeeNumber: '', department: r.departmentName || 'Operations' },
                  vendor: r.vendor || null,
                  threeWayMatch: { poMatched: true, quoteAttached: false, scopeVerified: true, status: '2-WAY MATCHED' },
                  budgetImpact: { totalBudget: 25000000, spentSoFar: 0, remainingBefore: 25000000, remainingAfter: 25000000, percentOfBudget: 0 },
                  approvalSteps: [],
                  recentMessages: [],
                };
              });
              setRequests(mapped);
              setLoadState('ready');
              return;
            }
            setLoadState('error');
          })
          .catch(() => setLoadState('error'));
      });
  };
  useEffect(() => { loadRequests(); }, [activeScope]);
  const pending = requests.filter((r) => ['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(r.approvalStatus));
  const approved = requests.filter((r) => r.approvalStatus === 'APPROVED');
  const totalValue = requests.reduce((sum, r) => sum + r.amount, 0);
  const visible = requests.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.approvalStatus === statusFilter;
    const matchesPayment = paymentFilter === 'ALL' || r.paymentStatus === paymentFilter;
    const matchesAccountability = accountabilityFilter === 'ALL' || r.accountabilityStatus === accountabilityFilter;
    const text = `${r.requestNumber || ''} ${r.title || ''} ${r.requester?.name || ''} ${r.subsidiary?.name || ''} ${r.category || ''}`.toLowerCase();
    return matchesStatus && matchesPayment && matchesAccountability && text.includes(query.toLowerCase());
  });
  const exportRequests = () => {
    const columns = ['Request number', 'Title', 'Subsidiary', 'Department', 'Amount', 'Approval status', 'Payment status', 'Accountability status', 'Requester', 'Category'];
    const rows = visible.map((r) => [
      r.requestNumber,
      r.title,
      r.subsidiary?.name || '',
      r.requester?.department || '',
      r.amountFormatted,
      r.approvalStatus,
      r.paymentStatus,
      r.accountabilityStatus,
      r.requester?.name || '',
      r.category,
    ]);
    const csv = '\uFEFF' + [columns, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fund-requests.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <SectionHeader eyebrow="EXPENDITURE INVENTORY" title={`Fund Requests — ${business.name}`} text="Review submitted requests across the group, open their private channels, and follow their approval and payment status." action={canCreate ? "New Fund Request" : undefined} onAction={()=>onNavigate('/requests/new')}/>
    <div className="customer-summary">
      <article><small>TOTAL REQUESTS</small><strong>{loadState==='ready'?requests.length:'—'}</strong><span>Across the group</span></article>
      <article><small>AWAITING DECISION</small><strong>{loadState==='ready'?pending.length:'—'}</strong><span>In the approval pipeline</span></article>
      <article><small>APPROVED</small><strong>{loadState==='ready'?approved.length:'—'}</strong><span>Payment may still be outstanding</span></article>
      <article><small>TOTAL REQUEST VALUE</small><strong>{loadState==='ready'?`₦${totalValue.toLocaleString('en-NG')}`:'—'}</strong><span>Current request records</span></article>
    </div>
    <section className="card data-register fund-request-inventory">
      <div className="table-tools">
        <input aria-label="Search fund requests" placeholder="Search reference, title, staff or subsidiary" value={query} onChange={e=>setQuery(e.target.value)} />
        <select aria-label="Filter by approval status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option><option value="SUBMITTED">Submitted</option><option value="IN_REVIEW">In review</option><option value="CLARIFICATION_REQUESTED">Clarification</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
        </select>
        <select aria-label="Filter by payment status" value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}>
          <option value="ALL">All payment statuses</option>{Array.from(new Set(requests.map(r=>r.paymentStatus))).filter(Boolean).map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}
        </select>
        <select aria-label="Filter by accountability status" value={accountabilityFilter} onChange={e=>setAccountabilityFilter(e.target.value)}>
          <option value="ALL">All accountability statuses</option>{Array.from(new Set(requests.map(r=>r.accountabilityStatus))).filter(Boolean).map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}
        </select>
        <button onClick={exportRequests}>Export CSV</button>
        <span className="request-result-count" aria-live="polite">{visible.length} of {requests.length} requests</span>
      </div>
      {loadState==='loading'&&<div className="inline-status">Loading group requests…</div>}
      {loadState==='error'&&<div className="inline-status error">Could not load fund requests.<button onClick={loadRequests}>Retry</button></div>}
      {loadState==='ready'&&<>
        <div className="register-head"><span>Request & title</span><span>Subsidiary</span><span>Department</span><span>Amount</span><span>Approval</span><span>Requester</span><span/></div>
        {visible.map(r=><button type="button" className="register-row" key={r.id} onClick={()=>setSelectedRequest(r)} aria-label={`View details for ${r.requestNumber}`}>
          <span><i>▱</i><strong>{r.title}</strong><small>{r.requestNumber} · {r.category}</small></span>
          <span>{r.subsidiary.name.replace('Ltd','').trim()}</span><span>{r.requester.department}</span>
          <strong style={{color:'var(--navy)',fontSize:'14px'}}>{r.amountFormatted}</strong>
          <b className={r.approvalStatus==='APPROVED'?'good':r.approvalStatus==='REJECTED'?'expired':'review'}>{r.approvalStatus.replaceAll('_',' ')}</b>
          <span>{r.requester.name}</span><em>View details →</em>
        </button>)}
        {!visible.length&&<div className="inline-status">No requests match those filters.</div>}
      </>}
    </section>
    {selectedRequest&&<RequestDossierModal request={selectedRequest} onClose={()=>setSelectedRequest(null)}/>}
  </>;
}

function ApprovalsModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  const [data, setData] = useState<{ requests: any[]; summary: any }>({ requests: [], summary: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/approvals?subsidiary=${encodeURIComponent(business.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData({ requests: d.requests || [], summary: d.summary || {} }); })
      .finally(() => setLoading(false));
  }, [business.id]);

  const topPending = data.requests[0];
  const pendingCount = data.summary.totalPendingCount ?? data.requests.length;
  const pendingAmount = data.summary.totalPendingFormatted ?? '₦0';

  return <>
    <SectionHeader eyebrow="AUTHORITY MATRIX" title="Executive Approvals Queue" text="Deterministic approval routing with strict multi-threshold enforcement, GMD escalation, and emergency limits." action="Review on Master Approvals" onAction={()=>onNavigate('/approvals')}/>
    <div className="customer-summary">
      <article><small>PENDING APPROVALS</small><strong>{loading ? '—' : pendingCount}</strong><span>Awaiting executive decision</span></article>
      <article><small>TOTAL QUEUE VALUE</small><strong>{loading ? '—' : pendingAmount}</strong><span>Combined pending amount</span></article>
      <article><small>TIER 3 ESCALATIONS</small><strong>{loading ? '—' : (data.summary.tier3Count || 0)}</strong><span>Exceeds departmental threshold</span></article>
      <article><small>URGENT REQUESTS</small><strong>{loading ? '—' : (data.summary.urgentCount || 0)}</strong><span>Expedited SLA</span></article>
    </div>
    <section className="card" style={{padding:'20px',marginTop:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom: topPending ? '16px' : '0'}}>
        <div><h3 style={{margin:0,fontSize:'16px'}}>Pending Approvals Requiring Immediate Action</h3><p style={{margin:'4px 0 0',color:'var(--muted)',fontSize:'13px'}}>{pendingCount > 0 ? `${pendingCount} request(s) routed for authorization` : `No pending requests requiring approval for ${business.name}.`}</p></div>
        <button className="primary-button" onClick={()=>onNavigate('/approvals')}>Open Dedicated Desk →</button>
      </div>
      {topPending && (
        <div style={{border:'1px solid var(--line)',borderRadius:'12px',padding:'16px',background:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <span style={{fontSize:'12px',fontWeight:'700',color:'var(--blue)'}}>{topPending.requestNumber} · {topPending.category ? topPending.category.replaceAll('_', ' ') : 'GENERAL'}</span>
            <h4 style={{margin:'4px 0',fontSize:'15px'}}>{topPending.title}</h4>
            <p style={{margin:0,fontSize:'12px',color:'var(--muted)'}}>Requester: {topPending.requester?.name || 'Staff'} · Needed by: {new Date(topPending.neededBy || topPending.createdAt).toLocaleDateString()}</p>
          </div>
          <div style={{textAlign:'right'}}>
            <strong style={{fontSize:'18px',display:'block',color:'var(--navy)'}}>{topPending.amountFormatted}</strong>
            <button className="primary-button" style={{marginTop:'8px',padding:'6px 14px',fontSize:'12px'}} onClick={()=>onNavigate('/approvals')}>Review & Authorize →</button>
          </div>
        </div>
      )}
    </section>
  </>;
}

function DisbursementsModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  const [data, setData] = useState<any>({ records: [], summary: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/disbursements?subsidiaryId=${encodeURIComponent(business.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [business.id]);

  const records = data.records || [];
  const topPending = records.find((r: any) => r.status === 'MAKER_RECORDED' || r.status === 'PENDING') || records[0];
  const summary = data.summary || {};

  return <>
    <SectionHeader eyebrow="TREASURY & BANKING" title="Disbursements Desk & Maker-Checker" text="Off-platform bank transfer recording, SHA-256 duplicate receipt hash protection, and independent verification." action="Open Banking Queue" onAction={()=>onNavigate('/disbursements')}/>
    <div className="customer-summary">
      <article><small>APPROVED FOR PAYMENT</small><strong>{loading ? '—' : (summary.approvedPendingTransferCount ?? records.length)}</strong><span>Awaiting bank execution</span></article>
      <article><small>MAKER RECORDED</small><strong>{loading ? '—' : (summary.makerRecordedCount ?? 0)}</strong><span>Awaiting independent checker</span></article>
      <article><small>DISBURSED TOTAL</small><strong>{loading ? '—' : (summary.disbursedTotalFormatted || '₦0')}</strong><span>Total payments verified</span></article>
      <article><small>VERIFICATION SLA</small><strong>100%</strong><span>Within 2 hours</span></article>
    </div>
    <section className="card" style={{padding:'20px',marginTop:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h4 style={{margin:0}}>{topPending ? (topPending.requestTitle || topPending.vendorName || `Transfer ${topPending.paymentReference}`) : `No disbursements pending verification for ${business.name}`}</h4>
          <p style={{margin:'4px 0 0',color:'var(--muted)',fontSize:'12px'}}>{topPending ? `Reference: ${topPending.paymentReference || 'N/A'} · Status: ${topPending.status.replaceAll('_', ' ')}` : 'Approved fund requests will appear here for payout execution.'}</p>
        </div>
        <button className="outline-button" onClick={()=>onNavigate('/disbursements')}>Open Banking Queue →</button>
      </div>
    </section>
  </>;
}

function AccountabilityModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/accountability?subsidiaryId=${encodeURIComponent(business.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.cases) setCases(d.cases); })
      .finally(() => setLoading(false));
  }, [business.id]);

  const openCases = cases.filter(c => c.status !== 'RECONCILED' && c.status !== 'CLOSED');
  const topCase = openCases[0];

  return <>
    <SectionHeader eyebrow="ACCOUNTABILITY GATES" title="Post-Payment Closure & Deliverables" text="Strict accountability enforcement ensuring funds disbursed are matched with genuine physical receipts and deliverables." action="Review Accountability Cases" onAction={()=>onNavigate('/accountability')}/>
    <div className="customer-summary">
      <article><small>OPEN CASES</small><strong>{loading ? '—' : openCases.length}</strong><span>Active advance retirals</span></article>
      <article><small>RECONCILED</small><strong>{loading ? '—' : (cases.length - openCases.length)}</strong><span>Verified & closed</span></article>
      <article><small>COMPLIANCE SCORE</small><strong>{cases.length > 0 ? `${Math.round(((cases.length - openCases.length) / cases.length) * 100)}%` : '100%'}</strong><span>Clearance rate</span></article>
      <article><small>BLOCKED USERS</small><strong>0</strong><span>All clear</span></article>
    </div>
    <section className="card" style={{padding:'20px',marginTop:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h4 style={{margin:0}}>{topCase ? `${topCase.requestNumber} · ${topCase.title}` : `No open accountability cases for ${business.name}`}</h4>
          <p style={{margin:'4px 0 0',color:'var(--muted)',fontSize:'12px'}}>{topCase ? `Due: ${new Date(topCase.dueAt).toLocaleDateString()} · Required proof: Physical receipts + Invoices` : 'Disbursed advances requiring physical receipt retiral will appear here.'}</p>
        </div>
        <button className="primary-button" onClick={()=>onNavigate('/accountability')}>{topCase ? 'Upload Proof Receipts →' : 'View Clearance Register →'}</button>
      </div>
    </section>
  </>;
}

function PayrollModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  const [data, setData] = useState<{ batches: any[]; staffCount: number }>({ batches: [], staffCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/payroll').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/staff?orgId=${encodeURIComponent(business.id)}`).then(r => r.ok ? r.json() : null).catch(() => null)
    ]).then(([payrollRes, staffRes]) => {
      setData({
        batches: payrollRes?.batches || [],
        staffCount: staffRes?.employees?.length || 0,
      });
    }).finally(() => setLoading(false));
  }, [business.id]);

  const currentBatch = data.batches[0];

  return <>
    <SectionHeader eyebrow="PAYROLL & ALLOCATION" title="Hybrid Payroll & Multi-Subsidiary Cost Splits" text="Automated gross-to-net calculation, PAYE tax, pension deduction, and multi-entity allocation rules." action="Manage Payroll Batches" onAction={()=>onNavigate('/payroll')}/>
    <div className="customer-summary">
      <article><small>CURRENT BATCH</small><strong>{loading ? '—' : (currentBatch?.periodName || 'Cycle Open')}</strong><span>{currentBatch?.status || 'Ready for draft'}</span></article>
      <article><small>ACTIVE STAFF</small><strong>{loading ? '—' : data.staffCount}</strong><span>Assigned to subsidiary</span></article>
      <article><small>GROSS PAYROLL</small><strong>{loading ? '—' : (currentBatch?.grossFormatted || '₦0')}</strong><span>Total run rate</span></article>
      <article><small>INTERCOMPANY SPLITS</small><strong>Configured</strong><span>Multi-entity recharge</span></article>
    </div>
    <section className="card" style={{padding:'20px',marginTop:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h4 style={{margin:0}}>{currentBatch ? `${currentBatch.periodName} Payroll Run` : `Payroll Management for ${business.name}`}</h4>
          <p style={{margin:'4px 0 0',color:'var(--muted)',fontSize:'12px'}}>{currentBatch ? `Status: ${currentBatch.status} · Staff count: ${currentBatch.employeeCount || data.staffCount}` : 'View salary registers, statutory deductions, and automated intercompany allocations.'}</p>
        </div>
        <button className="primary-button" onClick={()=>onNavigate('/payroll')}>Review Payroll Register →</button>
      </div>
    </section>
  </>;
}

function IntercompanyModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/intercompany')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.notes) setNotes(d.notes); })
      .finally(() => setLoading(false));
  }, []);

  const topNote = notes[0];

  return <>
    <SectionHeader eyebrow="LEGAL & TAX RECONCILIATION" title="Automated Intercompany Debit / Credit Notes" text="Legally compliant inter-subsidiary billing, shared payroll recharge, and monthly settlement reconciliation." action="Open Notes Register" onAction={()=>onNavigate('/intercompany')}/>
    <div className="customer-summary">
      <article><small>TOTAL NOTES</small><strong>{loading ? '—' : notes.length}</strong><span>Issued cross-company</span></article>
      <article><small>DEBIT NOTES</small><strong>{loading ? '—' : notes.filter(n => n.noteType === 'DEBIT_NOTE').length}</strong><span>Receivables</span></article>
      <article><small>CREDIT NOTES</small><strong>{loading ? '—' : notes.filter(n => n.noteType === 'CREDIT_NOTE').length}</strong><span>Payables</span></article>
      <article><small>STATUS</small><strong>Auditable</strong><span>Legally binding</span></article>
    </div>
    <section className="card" style={{padding:'20px',marginTop:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h4 style={{margin:0}}>{topNote ? `${topNote.noteNumber} · ${topNote.description || 'Intercompany Note'}` : 'No Intercompany Notes Issued'}</h4>
          <p style={{margin:'4px 0 0',color:'var(--muted)',fontSize:'12px'}}>{topNote ? `${topNote.sourceEntity?.legalName || 'Entity'} ➔ ${topNote.targetEntity?.legalName || 'Entity'} · Amount: ₦${(Number(topNote.totalAmountMinor || 0) / 100).toLocaleString('en-NG')}` : 'Shared expenses and salary recharge between subsidiaries automatically generate notes here.'}</p>
        </div>
        <button className="outline-button" onClick={()=>onNavigate('/intercompany')}>Open Notes Register →</button>
      </div>
    </section>
  </>;
}

function VendorsModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vendors')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.vendors) setVendors(d.vendors); })
      .finally(() => setLoading(false));
  }, []);

  const topVendor = vendors[0];

  return <>
    <SectionHeader eyebrow="PROCUREMENT" title="Vendor Registry & Price Benchmarks" text="Approved group suppliers, TIN verification, 3-way matching, and historical pricing intelligence." action="Manage Vendors" onAction={()=>onNavigate('/vendors')}/>
    <div className="customer-summary">
      <article><small>APPROVED VENDORS</small><strong>{loading ? '—' : vendors.length}</strong><span>Vetted suppliers</span></article>
      <article><small>3-WAY MATCHING</small><strong>Active</strong><span>PO + Invoice + Waybill</span></article>
      <article><small>PRICE ANOMALIES</small><strong>0</strong><span>Within market bounds</span></article>
      <article><small>TOP SUPPLIER</small><strong>{loading ? '—' : (topVendor?.name || 'None recorded')}</strong><span>{topVendor?.category || 'Registry'}</span></article>
    </div>
    <section className="card" style={{padding:'20px',marginTop:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h4 style={{margin:0}}>{topVendor ? `${topVendor.name} (${topVendor.category})` : 'Vendor & Supplier Registry'}</h4>
          <p style={{margin:'4px 0 0',color:'var(--muted)',fontSize:'12px'}}>{topVendor ? `Bank: ${topVendor.bankName || 'Recorded'} · Account: ${topVendor.accountNumber || 'Verified'}` : 'Vetted vendor profiles and historical price intelligence across all group subsidiaries.'}</p>
        </div>
        <button className="primary-button" onClick={()=>onNavigate('/vendors')}>Manage Vendors →</button>
      </div>
    </section>
  </>;
}

function AppWorkspace({user,onSignOut,onAddBusiness,onEditBusiness,businesses,currentId,setCurrentId,onUpdateBusiness}:{user:AuthUser;onSignOut:()=>void;onAddBusiness:()=>void;onEditBusiness?:(b:Business)=>void;businesses:Business[];currentId:string;setCurrentId:(value:string)=>void;onUpdateBusiness:(id:string,patch:Partial<Business>)=>Promise<Business>}) {
  const safeUser: AuthUser = user;
  const current = (businesses && businesses.length > 0 ? (businesses.find(b=>b.id===currentId) || businesses[0]) : defaultBemsBusinesses[0]) || defaultBemsBusinesses[0];
  const isGroupScope = (current as any).code === 'BEMS-GROUP' || (current as any).type === 'GROUP' || current.id === 'bems-group-hq' || current.id === 'a2fb4699-9f4e-4066-b173-b6bc3bb91f30';
  const activeScope = isGroupScope ? 'ALL' : ((current as any).code || current.id);
  const isAiOnly = (safeUser.role as string) === 'AI_ANALYST';
  const [currentRole, setCurrentRole] = useState<SystemRole>((safeUser.role as SystemRole) || 'GMD');
  const isStaff = (currentRole as string) === 'STAFF' || (safeUser.role as string) === 'STAFF';
  const [active, setActive] = useState<string>(() => {
    if (isAiOnly) return 'AI Copilot & Chat';
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam;
      const hashTab = window.location.hash.replace(/^#/, '');
      if (hashTab) return decodeURIComponent(hashTab);
      const stored = localStorage.getItem('bems_active_tab');
      if (stored) return stored;
    }
    return 'Overview';
  });
  const [collapsed, setCollapsed] = useState(false);
  const [allowAiAnalystChat, setAllowAiAnalystChat] = useState(true);

  // Live workspace-scoped notifications
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const fetchLiveNotifications = useCallback(() => {
    fetch(`/api/notifications?subsidiary=${encodeURIComponent(activeScope)}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setLiveNotifications(d.notifications || []);
          setUnreadNotificationCount(Number(d.unreadCount || 0));
        }
      })
      .catch(() => {});
  }, [activeScope]);

  useEffect(() => {
    fetchLiveNotifications();
    const timer = setInterval(fetchLiveNotifications, 15000);
    return () => clearInterval(timer);
  }, [fetchLiveNotifications]);

  const markAllNotificationsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadNotificationCount(0);
      setNotice('All notifications marked as read.');
      setTopPanel(null);
      fetchLiveNotifications();
    } catch {}
  };

  // Sync active tab to URL parameter and localStorage so reload stays on the current page
  useEffect(() => {
    if (typeof window !== 'undefined' && active) {
      try {
        localStorage.setItem('bems_active_tab', active);
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get('tab') !== active) {
          currentUrl.searchParams.set('tab', active);
          window.history.replaceState(null, '', currentUrl.toString());
        }
      } catch {}
    }
  }, [active]);

  // Handle browser back/forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab) setActive(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (current?.id) {
      fetch(`/api/settings?organizationId=${encodeURIComponent(current.id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.settings?.['ai.access']?.allowAiAnalystChat !== undefined) {
            setAllowAiAnalystChat(Boolean(data.settings['ai.access'].allowAiAnalystChat));
          }
        })
        .catch(() => {});
    }
  }, [current?.id]);

  const [switcher,setSwitcher]=useState(false);
  const [notices,setNotices]=useState<{id:number;message:string}[]>([]);
  const noticeIdRef=useRef(0);
  const setNotice=useCallback((message:string)=>{
    const id=++noticeIdRef.current;
    setNotices(old=>[...old,{id,message}]);
    setTimeout(()=>setNotices(old=>old.filter(n=>n.id!==id)),4000);
  },[]);
  const dismissNotice=(id:number)=>setNotices(old=>old.filter(n=>n.id!==id));
  const [notificationsRead,setNotificationsRead]=useState(false);
  const [cases,setCases]=useState<CaseRecord[]>(seedCases);
  const resolveCase=useCallback((id:string)=>setCases(old=>old.map(c=>c.id===id?{...c,status:'Resolved' as const}:c)),[]);
  const addCase=useCallback((input:{customerName:string;subject:string})=>{
    const id=`HC-${Math.floor(9000+Math.random()*900)}`;
    setCases(old=>[{id,customerName:input.customerName,initials:initialsOf(input.customerName),channel:'WhatsApp',subject:input.subject,status:'Within SLA',owner:'Operations',slaTarget:'4 hours',time:'Just now'},...old]);
  },[]);
  const [search,setSearch]=useState('');
  const [marketplaceOpen,setMarketplaceOpen]=useState(false);
  const [marketplaceBusinessId,setMarketplaceBusinessId]=useState(currentId);
  const [topPanel,setTopPanel]=useState<'notifications'|'account'|null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [activeAiPrompt, setActiveAiPrompt] = useState<string | undefined>(undefined);
  const [isInspectMode, setIsInspectMode] = useState(false);
  const toggleInspectMode = useCallback(() => setIsInspectMode((prev) => !prev), []);
  const isAiAuthorized = !isStaff && (
    currentRole === 'GMD' ||
    (safeUser.role as string) === 'GMD' ||
    (safeUser.role as string) === 'SYSTEM_ADMIN' ||
    (isAiOnly && allowAiAnalystChat)
  );

  const aiManager = useAiFinancialManager({
    userRole: currentRole,
    userName: safeUser.fullName || 'User',
    businessName: current?.name || 'BEMS Group',
    businessId: current?.id || 'bems-group-hq',
    currentPage: active,
  });

  const handleOpenAiDrawer = (prompt?: string) => {
    notifyAiInteraction();
    setActiveAiPrompt(prompt);
    setAiDrawerOpen(true);
  };

  useEffect(() => {
    const handleAiKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (isAiAuthorized) {
          notifyAiInteraction();
          setAiDrawerOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleAiKey);
    return () => window.removeEventListener('keydown', handleAiKey);
  }, [isAiAuthorized]);

  const navigation = getRoleNavigation((currentRole as string) === 'STAFF' ? 'STAFF' : safeUser.role);
  const sectorOperations=(navigation[3] && navigation[3].items) ? navigation[3].items.map(([name])=>name) : [];
  const liveOnly=['Inbox','Customers','Campaigns','Cases & SLAs','Commerce & orders','Payments','Bookings','Loyalty & rewards','Analytics & BI'];
  const incompleteLocked=['Inbox','Customers','Campaigns','Cases & SLAs','Commerce & orders','Payments','Bookings','Loyalty & rewards','Analytics & BI','Quality & experiments','Audit logs'];
  const fullyOnboardedDemo=true;
  const isLocked=(_name:string)=>false;
  const openModule=(name:string)=>{setActive(name);setSearch('')};
  const selectBusiness = useCallback((id: string) => {
    const next = businesses.find(b => b.id === id);
    if (!next || next.id === current.id) {
      setSwitcher(false);
      return;
    }
    setSwitcher(false);
    setCurrentId(id);
    setActive('Overview');
    setNotice(`${next.name} loaded as a separate workspace.`);
  }, [businesses, current.id, setCurrentId, setNotice]);
  const searchResults=navigation.flatMap(g=>g.items.map(([name])=>name)).filter(name=>search&&name.toLowerCase().includes(search.toLowerCase())).slice(0,6);
  const [dataResults,setDataResults]=useState<{type:string;label:string;sublabel:string;navigate:string}[]>([]);
  useEffect(()=>{
    if(!search) return;
    const handle=setTimeout(()=>{
      apiGet<{type:string;label:string;sublabel:string;navigate:string}[]>(`/api/businesses/${current.id}/search?q=${encodeURIComponent(search)}`).then(setDataResults).catch(()=>setDataResults([]));
    },250);
    return ()=>clearTimeout(handle);
  },[search,current.id]);
  const content=useMemo(()=>{
    const navAliases: Record<string, string> = {
      '/requests': 'Fund requests',
      'requests': 'Fund requests',
      '/approvals': 'Approvals & payments',
      'approvals': 'Approvals & payments',
      '/disbursements': 'Disbursements desk',
      'disbursements': 'Disbursements desk',
      '/accountability': 'Accountability closure',
      'accountability': 'Accountability closure',
      '/portfolio': 'Subsidiary portfolio',
      'portfolio': 'Subsidiary portfolio',
      '/briefing': 'Executive briefing',
      'briefing': 'Executive briefing',
      '/ai-chat': 'AI Copilot & Chat',
      'ai-chat': 'AI Copilot & Chat',
      '/chat': 'AI Copilot & Chat',
      'chat': 'AI Copilot & Chat',
    };
    const target = navAliases[active] || active;

    if (isStaff) {
      if (target === 'Overview') {
        return (
          <StaffWorkspaceModule
            user={safeUser}
            businessName={current.name}
            onNavigate={setActive}
            setNotice={setNotice}
          />
        );
      }
      if (target === 'New fund request') {
        if (typeof window !== 'undefined') window.location.href = '/requests/new';
        return null;
      }
      if (target === 'My requests' || target === 'Fund requests') {
        return <FundRequestsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p} canCreate={true}/>;
      }
      if (target === '72h Evidence Vault' || target === 'Accountability closure' || target === 'Proof & deliverables') {
        return <LiveAccountabilityModule setNotice={setNotice}/>;
      }
      if (target === 'Receipt archive') {
        return <LiveReceiptArchiveModule setNotice={setNotice}/>;
      }
      if (target === 'Request channels') {
        return <RequestChannelsModule business={current} setNotice={setNotice} onNavigate={(p)=>p==='/requests'?setActive('My requests'):window.location.href=p}/>;
      }
      if (target === 'Settings & Profile' || target === 'Settings' || target === 'Admin Settings') {
        return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice}/>;
      }
      if (target === 'Mobile App Settings' || target === 'Mobile settings' || target === 'Mobile App Version Control') {
        return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice} initialSection="Mobile App Settings"/>;
      }
      return (
        <StaffWorkspaceModule
          user={safeUser}
          businessName={current.name}
          onNavigate={setActive}
          setNotice={setNotice}
        />
      );
    }

    if (currentRole === 'GMD') {
      if (target === 'Fund requests') return <FundRequestsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p} canCreate={false}/>;
      if (target === 'Request channels') return <RequestChannelsModule business={current} setNotice={setNotice} onNavigate={path=>setActive(path==='/requests'?'Fund requests':path)}/>;
      // Evidence is submitted by the requester. GMDs only review staff uploads and close-out status.
      if (target === 'Accountability closure' || target === 'Proof & deliverables' || target === 'Follow-up tasks') return <LiveAccountabilityModule setNotice={setNotice}/>;
      if (target === 'Receipt archive') return <LiveReceiptArchiveModule scope={activeScope} setNotice={setNotice}/>;
      if (target === 'Attendance & Timekeeping' || target === 'Attendance') return <AttendanceDeskPage />;
      if (target === 'Staff profiles') return <LiveStaffProfilesModule scope={activeScope} setNotice={setNotice} onNavigate={(p) => setActive(p)}/>;
      if (target === 'Analytics & BI') return <LiveAnalyticsBIPage/>;
      if (target === 'Audit logs') return <LiveAuditLogsModule scope={activeScope} setNotice={setNotice}/>;
      if (target === 'Intercompany notes') return <LiveIntercompanyModule scope={activeScope} setNotice={setNotice}/>;
      if (target === 'Settings' || target === 'Admin Settings') return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice}/>;
      if (target === 'Mobile App Settings' || target === 'Mobile settings' || target === 'Mobile App Version Control') return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice} initialSection="Mobile App Settings"/>;
      if (target === 'Overview') {
        return (
          <RoleOverviewModule
            role={currentRole}
            business={current}
            user={user}
            cases={cases}
            setActive={setActive}
            setNotice={setNotice}
            onRoleChange={(r) => setCurrentRole(r)}
          />
        );
      }
      if (target === 'Executive briefing') {
        return <ExecutiveBriefingModule business={current} setNotice={setNotice} onNavigate={(p) => setActive(p)} />;
      }
      if (target === 'Subsidiary portfolio') {
        return (
          <SubsidiaryPortfolioView
            businessName={current.name}
            userName={safeUser.fullName}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Approvals & payments' || target === 'Approvals & Policy Hub' || target === 'Approvals desk') {
        return (
          <FundFlowWorkspace
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Approval matrix') {
        return (
          <ApprovalsHubView
            initialTab="matrix"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Emergency overrides') {
        return (
          <ApprovalsHubView
            initialTab="emergency"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Treasury & Finance Hub' || target === 'Disbursements desk' || target === 'Disbursements') {
        return (
          <TreasuryFinanceHubView
            initialTab="disbursements"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Treasury accounts') {
        return (
          <TreasuryFinanceHubView
            initialTab="treasury"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Budgets & commitments' || target === 'Budget variance audit') {
        return (
          <TreasuryFinanceHubView
            initialTab="budgets"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Payroll sign-off' || target === 'Hybrid payroll') {
        return (
          <TreasuryFinanceHubView
            initialTab="payroll"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Intercompany & Audit Hub') {
        return (
          <IntercompanyAuditHubView
            initialTab="notes"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Cost allocation rules' || target === 'Settlement reconciliation') {
        return (
          <IntercompanyAuditHubView
            initialTab="allocation"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
      if (target === 'Security & compliance' || target === 'Team & access') {
        return (
          <IntercompanyAuditHubView
            initialTab="audit"
            businessName={current.name}
            userName={safeUser.fullName}
            scope={activeScope}
            businessId={current.id}
            businessCode={(current as any).code}
            onNavigate={setActive}
            onSelectBusiness={selectBusiness}
          />
        );
      }
    }

    if (isAiOnly) {
      if (target === 'Request channels') {
        return <RequestChannelsModule business={current} setNotice={setNotice} onNavigate={(p) => p === '/requests' ? setActive('AI Copilot & Chat') : window.location.href = p} />;
      }
      if (target === 'Executive briefing') {
        return <ExecutiveBriefingModule business={current} setNotice={setNotice} onNavigate={(p) => setActive(p)} />;
      }
      return (
        <AiChatWorkspaceView
          businessName={current.name}
          businessId={current.id}
          userName={safeUser.fullName || 'AI Analyst'}
          userRole={currentRole}
          isChatEnabled={allowAiAnalystChat}
          onNavigate={(p) => setActive(p)}
        />
      );
    }

    if (target === 'AI Copilot & Chat') {
      return (
        <AiChatWorkspaceView
          businessName={current.name}
          businessId={current.id}
          userName={safeUser.fullName || 'User'}
          userRole={currentRole}
          isChatEnabled={true}
          onNavigate={(p) => setActive(p)}
        />
      );
    }

    if(target==='Overview') return <RoleOverviewModule role={currentRole} business={current} user={safeUser} cases={cases} setActive={setActive} setNotice={setNotice} onRoleChange={(r) => setCurrentRole(r)}/>;
    if(target==='Budgets & commitments'||target==='Budget variance audit') {
      return (
        <TreasuryFinanceHubView
          initialTab="budgets"
          businessName={current.name}
          userName={safeUser.fullName}
          scope={activeScope}
          businessId={current.id}
          businessCode={(current as any).code}
          onNavigate={setActive}
          onSelectBusiness={selectBusiness}
        />
      );
    }
    if(target==='Payroll sign-off'||target==='Hybrid payroll') return <PayrollSignOffView businessName={current.name} userName={safeUser.fullName} onNavigate={setActive} onSelectBusiness={selectBusiness}/>;
    if(target==='HR Fund requests') return <FundRequestsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p}/>;
    if(target==='Executive briefing') return <ExecutiveBriefingModule business={current} setNotice={setNotice} onNavigate={(p)=>setActive(p)}/>;
    if(target==='Subsidiary portfolio') return <Businesses businesses={businesses} current={current} onSelect={selectBusiness} onAdd={onAddBusiness} onEdit={onEditBusiness}/>;
    if(target==='Fund requests') return <FundRequestsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p} canCreate={currentRole !== 'GMD' && currentRole !== 'SYSTEM_ADMIN'}/>;
    if(target==='Approvals & payments'||target==='Approvals & Policy Hub'||target==='Approvals desk') return <FundFlowWorkspace businessName={current.name} userName={safeUser.fullName} scope={activeScope} businessId={current.id} businessCode={(current as any).code} onNavigate={setActive} onSelectBusiness={selectBusiness}/>;
    if(target==='New fund request') {
      if (currentRole === 'GMD' || currentRole === 'SYSTEM_ADMIN') {
        setNotice('GMD and System Admin accounts are executive governance roles and do not submit fund requests.');
        return null;
      }
      if (typeof window !== 'undefined') window.location.href = '/requests/new';
      return null;
    }
    if(target==='Request channels') return <RequestChannelsModule business={current} setNotice={setNotice} onNavigate={(p)=>p==='/requests'?setActive('Fund requests'):window.location.href=p}/>;
    if(target==='Draft requests') return <DraftRequestsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p}/>;
    if(target==='Approvals desk') return <ApprovalsDeskView businessName={current.name} userName={safeUser.fullName} scope={activeScope} businessId={current.id} businessCode={(current as any).code} onNavigate={setActive} onSelectBusiness={selectBusiness}/>;
    if(target==='Approval matrix') return <ApprovalMatrixView businessName={current.name} userName={safeUser.fullName} onNavigate={setActive} onSelectBusiness={selectBusiness}/>;
    if(target==='Emergency overrides') return <EmergencyOverridesView businessName={current.name} userName={safeUser.fullName} onNavigate={setActive} onSelectBusiness={selectBusiness}/>;
    if(target==='Disbursements desk'||target==='Disbursements') return <DisbursementsDeskView businessName={current.name} userName={safeUser.fullName} scope={activeScope} businessId={current.id} businessCode={(current as any).code} onNavigate={setActive} onSelectBusiness={selectBusiness}/>;
    if(target==='Transfer verification') return <TransferVerificationModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p}/>;
    if(target==='Treasury accounts') return <TreasuryAccountsView businessName={current.name} userName={safeUser.fullName} scope={activeScope} businessId={current.id} businessCode={(current as any).code} onNavigate={setActive} onSelectBusiness={selectBusiness}/>;
    if(target==='Receipt archive') return <LiveReceiptArchiveModule scope={activeScope} setNotice={setNotice}/>;
    if(target==='Accountability closure') return <LiveAccountabilityModule setNotice={setNotice}/>;
    if(target==='Proof & deliverables') return <LiveProofDeliverablesModule setNotice={setNotice}/>;
    if(target==='Follow-up tasks') return <LiveFollowUpTasksModule setNotice={setNotice}/>;
    if(target==='Closure clearances') return <ClosureClearancesModule business={current} setNotice={setNotice}/>;
    if(target==='Hybrid payroll') return <PayrollModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p}/>;
    if(target==='Cost allocation rules') return <CostAllocationModule business={current} setNotice={setNotice}/>;
    if(target==='Intercompany notes') return <LiveIntercompanyModule scope={activeScope} setNotice={setNotice}/>;
    if(target==='Settlement reconciliation') return <SettlementReconciliationModule business={current} setNotice={setNotice}/>;
    if(target==='Vendors & suppliers') return <VendorsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p}/>;
    if(target==='Price benchmarks') return <PriceBenchmarksModule business={current} setNotice={setNotice}/>;
    if(target==='Recurring commitments') return <RecurringCommitmentsModule business={current} setNotice={setNotice}/>;
    if(target==='Notification bridge') return <NotificationBridgeModule business={current} setNotice={setNotice}/>;
    if(target==='Audit logs') return <LiveAuditLogsModule scope={activeScope} setNotice={setNotice}/>;
    if(target==='Attendance & Timekeeping' || target==='Attendance') return <AttendanceDeskPage />;
    if(target==='Staff profiles') return <LiveStaffProfilesModule scope={activeScope} setNotice={setNotice} onNavigate={(p) => setActive(p)}/>;
    if(target==='Staff onboarding') return <PeopleAccessWorkspaceModule setNotice={setNotice} onNavigate={(p) => setActive(p)}/>;
    if(target==='Team & access') return <TeamAccessPage business={current} setNotice={setNotice}/>;
    if(target==='Security & compliance') return <SecurityCompliancePage name="Security & compliance" setNotice={setNotice}/>;
    if(target==='System configuration') return <ConfigurationCenter setNotice={setNotice}/>;
    if(target==='Settings' || target==='Admin Settings') return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice}/>;
    if(target==='Mobile App Settings' || target==='Mobile settings' || target==='Mobile App Version Control') return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice} initialSection="Mobile App Settings"/>;
    return <DetailedModule name={target} business={current} cases={cases} onResolveCase={resolveCase} onAddCase={addCase} setNotice={setNotice}/>;
  },[active,current,currentRole,businesses,onAddBusiness,selectBusiness,onUpdateBusiness,setNotice,cases,resolveCase,addCase,user]);

  if(marketplaceOpen){const destination=businesses.find(b=>b.id===marketplaceBusinessId)||current;return <main className="marketplace-portal"><header><button className="marketplace-brand" onClick={()=>setMarketplaceOpen(false)}><img src="/bems-group-logo.png?v=20261024" alt=""/><div><strong>BEMS</strong><span>Fund Request Desk</span></div></button><div className="marketplace-destination"><span>IMPORT DESTINATION</span><select value={destination.id} onChange={e=>setMarketplaceBusinessId(e.target.value)}>{businesses.map(b=><option value={b.id} key={b.id}>{b.name} · {b.industry}</option>)}</select></div><div><button className="market-library">My library</button><button className="market-cart">Cart · 0</button><button className="marketplace-close" onClick={()=>setMarketplaceOpen(false)}>Return to workspace →</button></div></header><div className="marketplace-content">{notices.length>0&&<div className="marketplace-toast">✓ {notices[notices.length-1].message}<button onClick={()=>dismissNotice(notices[notices.length-1].id)}>×</button></div>}<TemplateMarketplace key={destination.id} business={destination} setNotice={setNotice}/></div></main>}
  const shellClass=`app-shell ${collapsed?'collapsed ':''}${isStaff ? 'staff-view ' : currentRole === 'GMD' ? 'gmd-view' : ''}`;
  return (
    <UniversalClickToAskProvider
      currentPage={active}
      businessName={current.name}
      isInspectMode={isInspectMode}
      onToggleInspectMode={toggleInspectMode}
      onAskContextualQuestion={(question, elementContext) => {
        notifyAiInteraction();
        aiManager.sendMessage(question, elementContext);
      }}
    >
      <main className={shellClass}>
        <aside className="sidebar">
          <div className="side-brand" style={{ cursor: 'pointer' }} onClick={() => { if (typeof window !== 'undefined') window.location.href = '/'; }}>
            <img src="/bems-group-logo.png?v=20261024" alt="BEMS logo"/>
            <div className="brand-title-wrap" style={{display:'inline-flex',flexDirection:'row',alignItems:'baseline',gap:'6px',whiteSpace:'nowrap',margin:0,padding:0}}>
              <span className="brand-name" style={{display:'inline-block',fontFamily:"'Outfit', 'Plus Jakarta Sans', sans-serif",fontSize:'16px',fontWeight:850,letterSpacing:'-0.02em',color:'#ffffff',lineHeight:1,margin:0,padding:0}}>BEMS</span>
              <span className="brand-sub" style={{display:'inline-block',fontFamily:"'Outfit', 'Plus Jakarta Sans', sans-serif",fontSize:'15px',fontWeight:800,letterSpacing:'0.04em',color:'#f97316',lineHeight:1,margin:0,padding:0}}>FINANCE</span>
            </div>
            <button aria-label={collapsed?'Expand navigation':'Collapse navigation'} title={collapsed?'Expand navigation':'Collapse navigation'} onClick={(e)=>{e.stopPropagation();setCollapsed(!collapsed)}}>{collapsed?'›':'‹'}</button>
          </div>
          <nav aria-label="Product navigation">{navigation.map(group=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([name,icon])=>{const locked=isLocked(name);return <button type="button" title={locked?`${name} — locked`:collapsed?name:undefined} aria-current={active===name?'page':undefined} className={`${active===name?'nav-item active':'nav-item'}${locked?' locked':''}`} onClick={()=>{openModule(name);setTopPanel(null);setSwitcher(false)}} key={name}><span>{icon}</span><b>{name}</b>{locked?<em>⌾</em>:name==='Inbox'&&<small>3</small>}</button>})}</div>)}</nav>
          <button type="button" className="help-button" onClick={()=>setNotice('Help centre opened. Guides and support are available here.')}><span>?</span><div><strong>Need help?</strong><small>Guides and support</small></div></button>
        </aside>
        <section className="workspace">
          <header className="topbar">
            <div className="business-switch-wrap"><button className="business-switch" onClick={()=>{setSwitcher(!switcher);setTopPanel(null)}}><span style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'2px',display:'inline-flex',alignItems:'center',justifyContent:'center',overflow:'hidden',width:36,height:36,flexShrink:0}}><img src="/bems-group-logo.png?v=20261024" alt="BEMS logo" style={{width:'100%',height:'100%',objectFit:'contain'}}/></span><div><strong>{current.name}</strong><small>{current.industry}</small></div><b>⌄</b></button>{switcher&&<div className="switch-menu"><p>SWITCH WORKSPACE</p>{businesses.map(b=><button className={b.id===current.id?'selected':''} key={b.id} onClick={()=>selectBusiness(b.id)}><span style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'2px',display:'inline-flex',alignItems:'center',justifyContent:'center',overflow:'hidden',width:28,height:28,flexShrink:0}}><img src="/bems-group-logo.png?v=20261024" alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/></span><div><strong>{b.name}</strong><small>{b.industry} · {b.readiness}% ready</small></div>{b.id===current.id&&<b>✓</b>}</button>)}<button className="switch-add" onClick={()=>{setSwitcher(false);setActive('Settings')}}>⚙ Manage businesses in Settings</button></div>}</div><div className="global-search"><span>⌕</span><input aria-label="Search workspace" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${current.name}`}/><kbd>⌘ K</kbd>{search&&<div className="search-results">{(searchResults.length||dataResults.length)?<>{searchResults.map(name=><button key={`nav-${name}`} onClick={()=>openModule(name)}><span>{isLocked(name)?'⌾':'→'}</span><div><strong>{name}</strong><small>{isLocked(name)?'Locked in current environment':'Open in this workspace'}</small></div></button>)}{dataResults.map((r,i)=><button key={`data-${i}`} onClick={()=>openModule(r.navigate)}><span>◎</span><div><strong>{r.label}</strong><small>{r.type} · {r.sublabel}</small></div></button>)}</>:<p>No workspace results</p>}</div>}</div>
            <div className="top-actions">
              {isStaff && (
                <button
                  className="templates-top"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.location.href = '/requests/new';
                  }}
                  style={{ background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', color: '#fff', border: 'none' }}
                >
                  <span>＋</span>
                  <div>
                    <strong>New Fund Request</strong>
                    <small>Submit for approval</small>
                  </div>
                  <b>Create ＋</b>
                </button>
              )}
              <div className="top-popover-wrap">
                <button
                  className="top-icon notification"
                  aria-label="Notifications"
                  aria-expanded={topPanel==='notifications'}
                  onClick={()=>setTopPanel(topPanel==='notifications'?null:'notifications')}
                >
                  ♧{unreadNotificationCount > 0 && <i style={{ background: '#ef4444' }}/>}
                </button>
                {topPanel==='notifications' && (
                  <div className={unreadNotificationCount === 0 ? 'top-popover notifications-panel read' : 'top-popover notifications-panel'}>
                    <header>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong>Notifications</strong>
                        {unreadNotificationCount > 0 && (
                          <span style={{ fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                            {unreadNotificationCount} unread
                          </span>
                        )}
                      </div>
                      <button onClick={()=>setTopPanel(null)}>×</button>
                    </header>
                    <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                      {liveNotifications.length === 0 ? (
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                          No notifications for {current.name}
                        </div>
                      ) : (
                        liveNotifications.map((notif: any) => (
                          <button
                            key={notif.id}
                            onClick={() => {
                              setActive('Approvals & payments');
                              setTopPanel(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '10px 14px',
                              textAlign: 'left',
                              background: notif.status === 'UNREAD' ? '#f0fdf4' : 'transparent',
                              borderBottom: '1px solid #f1f5f9',
                              width: '100%',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: notif.type === 'APPROVAL_REQUEST' ? '#ea580c' : notif.type === 'DISBURSEMENT_SENT' ? '#059669' : '#0284c7',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              flexShrink: 0,
                              marginTop: '2px',
                            }}>
                              {notif.type === 'APPROVAL_REQUEST' ? '!' : notif.type === 'DISBURSEMENT_SENT' ? '₦' : '✓'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '12px', color: '#0f172a', fontWeight: notif.status === 'UNREAD' ? 700 : 500 }}>
                                  {notif.title}
                                </strong>
                                {notif.status === 'UNREAD' && (
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                                )}
                              </div>
                              <small style={{ display: 'block', fontSize: '11px', color: '#475569', marginTop: '2px', lineHeight: 1.3 }}>
                                {notif.body}
                              </small>
                              {notif.createdAt && (
                                <time style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                                  {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </time>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <footer onClick={markAllNotificationsRead} style={{ cursor: 'pointer', textAlign: 'center', padding: '10px', fontWeight: 600, fontSize: '12px', borderTop: '1px solid #f1f5f9' }}>
                      Mark all as read
                    </footer>
                  </div>
                )}
              </div>
              <div className="top-popover-wrap"><button className="avatar" aria-label="Account menu" aria-expanded={topPanel==='account'} onClick={()=>setTopPanel(topPanel==='account'?null:'account')}>{initialsOf(safeUser.fullName)}</button>{topPanel==='account'&&<div className="top-popover account-panel"><div><span>{initialsOf(safeUser.fullName)}</span><strong>{safeUser.fullName}</strong><small>{safeUser.email}</small></div><button onClick={()=>{setActive('Settings');setTopPanel(null)}}>Account & business settings</button><button onClick={()=>{setActive('Team & access');setTopPanel(null)}}>Team and access</button><button onClick={()=>{setNotice('Help centre opened.');setTopPanel(null)}}>Help centre</button><button onClick={onSignOut}>Sign out</button></div>}</div>
            </div>
          </header>
          <div className="content">
            {notices.length>0&&<div className="notice-stack">{notices.map(n=><div className="notice" key={n.id}><span>i</span>{n.message}<button onClick={()=>dismissNotice(n.id)}>×</button></div>)}</div>}
            {content}
          </div>
        </section>
        {isAiAuthorized && (
          <>
            <AiScreenEdgeGlow isActive={true} isProcessing={aiManager.isTyping} />
            <AmbientBottomAiBar
              currentPage={active}
              businessName={current.name}
              userName={safeUser.fullName}
              userRole={currentRole}
              messages={aiManager.messages}
              isTyping={aiManager.isTyping}
              isInspectMode={isInspectMode}
              onToggleInspectMode={toggleInspectMode}
              onSendMessage={aiManager.sendMessage}
              onConfirmAction={aiManager.handleConfirmAction}
              onOpenFullCockpit={handleOpenAiDrawer}
              onNavigate={(tab) => {
                openModule(tab);
              }}
            />
            <AiFinancialManagerDrawer
              isOpen={aiDrawerOpen}
              onClose={() => {
                setAiDrawerOpen(false);
                setActiveAiPrompt(undefined);
              }}
              userRole={currentRole}
              userName={safeUser.fullName}
              businessName={current.name}
              businessId={current.id}
              currentPage={active}
              initialPrompt={activeAiPrompt}
              onNavigate={(tab) => {
                openModule(tab);
                setAiDrawerOpen(false);
              }}
              sharedMessages={aiManager.messages}
              sharedIsTyping={aiManager.isTyping}
              onSendMessage={aiManager.sendMessage}
              onConfirmAction={aiManager.handleConfirmAction}
            />
          </>
        )}
      </main>
    </UniversalClickToAskProvider>
  );
}

export default function Home() {
  const [authStatus,setAuthStatus]=useState<'checking'|'signed-out'|'signed-in'>('checking');
  const [user,setUser]=useState<AuthUser|null>(null);
  const [addingBusiness,setAddingBusiness]=useState(false);
  const [businesses,setBusinesses]=useState<Business[]>(defaultBemsBusinesses);
  const [currentId, setCurrentId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const orgParam = new URLSearchParams(window.location.search).get('org');
      if (orgParam) return orgParam;
      const stored = localStorage.getItem('bems_active_org');
      if (stored) return stored;
    }
    return 'bems-group-hq';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && currentId) {
      try {
        localStorage.setItem('bems_active_org', currentId);
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get('org') !== currentId) {
          currentUrl.searchParams.set('org', currentId);
          window.history.replaceState(null, '', currentUrl.toString());
        }
      } catch {}
    }
  }, [currentId]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('ready');
  const [showAiEntry, setShowAiEntry] = useState(false);
  const [entryMode, setEntryMode] = useState<'login' | 'reload'>('reload');

  const checkAuth = () => {
    fetch('/api/auth/session?_t=' + Date.now(), { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const nextUser = data?.user as AuthUser | null;
        setUser(nextUser);
        setAuthStatus(nextUser ? 'signed-in' : 'signed-out');
        if (nextUser) {
          setEntryMode('reload');
          setShowAiEntry(true);
        }
      })
      .catch(() => {
        setUser(null);
        setAuthStatus('signed-out');
        setShowAiEntry(false);
      });
  };
  useEffect(() => {
    checkAuth();
  }, []);

  const fetchBusinesses=()=>{
    fetch('/api/organizations')
      .then(r => r.json())
      .then(d => {
        if (d && d.organizations && d.organizations.length > 0) {
          setBusinesses(d.organizations);
          setCurrentId(d.organizations[0].id);
        } else {
          setBusinesses(defaultBemsBusinesses);
          setCurrentId('bems-group-hq');
        }
        setStatus('ready');
      })
      .catch(() => {
        setBusinesses(defaultBemsBusinesses);
        setCurrentId('bems-group-hq');
        setStatus('ready');
      });
  };
  useEffect(()=>{ if(authStatus==='signed-in') fetchBusinesses(); },[authStatus]);
  const retryLoad=()=>{setStatus('loading');fetchBusinesses()};

  useEffect(() => {
    if (authStatus === 'signed-in' && user?.role === 'STAFF' && typeof window !== 'undefined' && window.location.pathname === '/') {
      window.location.href = '/staff';
    }
  }, [authStatus, user]);

  const onAuthed = (u: AuthUser) => {
    setUser(u);
    setEntryMode('login');
    window.dispatchEvent(new Event('bems-session-changed'));
    setStatus('ready');
    setAuthStatus('signed-in');
    if (u.role === 'STAFF') {
      window.location.href = '/staff';
      return;
    }
    setShowAiEntry(true);
  };

  const signOut = async () => {
    setShowAiEntry(false);
    setUser(null);
    setAuthStatus('signed-out');
    setBusinesses([]);
    setCurrentId('');
    setAddingBusiness(false);
    window.dispatchEvent(new Event('bems-session-changed'));
    if (typeof document !== 'undefined') {
      document.cookie = 'bems_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
    }
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    window.location.replace('/');
  };

  const handleSubsidiaryCreated = (newOrg: any) => {
    if (newOrg && (newOrg.id || newOrg.name)) {
      const next: Business = {
        id: newOrg.id,
        name: newOrg.name || newOrg.legalName,
        industry: newOrg.industry || 'Subsidiary Entity',
        initials: newOrg.initials || (newOrg.code ? newOrg.code.replace(/^BEMS-?/, '').slice(0, 2) : 'BS'),
        status: 'Live',
        readiness: 100,
        color: newOrg.color || '#ea580c',
        aiEnabled: true,
      };
      setBusinesses(old => {
        const exists = old.some(b => b.id === next.id);
        return exists ? old : [...old, next];
      });
      setCurrentId(next.id);
    }
    setAddingBusiness(false);
  };

  const [editingSubsidiary, setEditingSubsidiary] = useState<Business | null>(null);

  const handleSubsidiaryUpdated = (updatedOrg: any) => {
    if (updatedOrg && (updatedOrg.id || updatedOrg.name)) {
      setBusinesses(old => old.map(b => {
        if (b.id !== updatedOrg.id) return b;
        return {
          ...b,
          ...updatedOrg,
          name: updatedOrg.name || updatedOrg.legalName || b.name,
          industry: updatedOrg.industry || b.industry,
          initials: updatedOrg.initials || (updatedOrg.code ? updatedOrg.code.replace(/^BEMS-?/, '').slice(0, 2) : b.initials),
          budgetFormatted: updatedOrg.budgetFormatted || (b as any).budgetFormatted,
        };
      }));
    }
  };

  const updateBusiness=(id:string,patch:Partial<Business>)=>apiPatch<Business>(`/api/businesses/${id}`,patch).then(updated=>{
    setBusinesses(old=>old.map(b=>b.id===id?updated:b));
    return updated;
  });

  // 1. Session verification in progress: zero reload screen
  if (authStatus === 'checking') {
    return null;
  }

  // 2. Unauthenticated or signed out: strictly present sign-in / registration
  if (!user || authStatus === 'signed-out') {
    return <AuthGate onAuthed={onAuthed} />;
  }

  // 3. Dynamic AI Motion Pre-Screen before dashboard access (on login & reload)
  if (showAiEntry) {
    return (
      <AiMotionEntryScreen
        key={`ai-entry-${entryMode}-${user.id}`}
        onComplete={() => setShowAiEntry(false)}
        businessName="BEMS Group"
        userName={user.fullName || user.name || 'Executive'}
        userRole={user.role || 'STAFF'}
        mode={entryMode}
      />
    );
  }

  if (status === 'error') return <main className="app-loading error"><p>Could not reach the BEMS Group API. Confirm the backend is running on port 4001.</p><button onClick={retryLoad}>Retry →</button></main>;
  if (businesses.length === 0 && authStatus === 'signed-in') return <CorporateSubsidiaryModal onComplete={handleSubsidiaryCreated} />;
  return (
    <>
      <AppWorkspace user={user} onSignOut={signOut} onAddBusiness={()=>setAddingBusiness(true)} onEditBusiness={(b)=>setEditingSubsidiary(b)} businesses={businesses} currentId={currentId||businesses[0].id} setCurrentId={setCurrentId} onUpdateBusiness={updateBusiness}/>
      {addingBusiness && (
        <CorporateSubsidiaryModal
          onCancel={businesses.length ? () => setAddingBusiness(false) : undefined}
          onComplete={handleSubsidiaryCreated}
        />
      )}
      {editingSubsidiary && (
        <EditSubsidiaryModal
          subsidiary={editingSubsidiary}
          onCancel={() => setEditingSubsidiary(null)}
          onComplete={(updated) => {
            handleSubsidiaryUpdated(updated);
            setEditingSubsidiary(null);
          }}
        />
      )}
    </>
  );
}
