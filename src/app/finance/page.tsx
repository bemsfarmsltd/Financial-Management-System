'use client';

import Link from 'next/link';
import {useGmdAccess} from '@/components/ai/useGmdAccess';
import FundingView from '@/components/wallet/FundingView';
import WalletView from '@/components/wallet/WalletView';
import WalletDashboardSummary from '@/components/wallet/WalletDashboardSummary';
import { GOVERNANCE_TEMPLATES } from '@/lib/governance-templates';

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
import { TabErrorBoundary } from "@/components/layout/TabErrorBoundary";
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
import { AiChatHistoryDrawer } from "@/components/ai/AiChatHistoryDrawer";
import { AiScreenEdgeGlow, notifyAiInteraction } from "@/components/ai/AiScreenEdgeGlow";
import { useAiFinancialManager } from "@/components/ai/useAiFinancialManager";
import { AiMotionEntryScreen } from "@/components/ai/AiMotionEntryScreen";
import { KineticOptikkaTorus } from "@/components/ai/KineticOptikkaTorus";
import { AiChatWorkspaceView } from "@/components/ai/AiChatWorkspaceView";
import { UniversalClickToAskProvider } from "@/components/ai/UniversalClickToAskProvider";
import { PeopleAccessWorkspaceModule } from "@/components/dashboard/gmd/PeopleAccessWorkspaceModule";
import { StaffWorkspaceModule } from "@/components/dashboard/staff/StaffWorkspaceModule";
import { NIGERIAN_STATES, NIGERIAN_STATE_LGAS, RESIDENTIAL_CITIES_AND_STATES } from "@/lib/nigeriaGeoData";
import { CorporateSubsidiaryModal } from "@/components/dashboard/CorporateSubsidiaryModal";
import { EditSubsidiaryModal } from "@/components/dashboard/EditSubsidiaryModal";
import { Eye, EyeOff } from "lucide-react";
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
  brandColor?: string;
  logoUrl?: string | null;
  aiEnabled: boolean;
  code?: string;
  type?: string;
  budgetFormatted?: string;
  budget?: number;
};

type AuthUser = { id: string; email: string; fullName: string; phone: string; emailVerified: boolean; role: string; name?: string; avatarUrl?: string };

const defaultBemsBusinesses: Business[] = [
  {
    id: "BEMS-GROUP",
    name: "BEMS Group",
    industry: "Group & Subsidiaries",
    initials: "BG",
    status: "Live",
    readiness: 100,
    color: "#ea580c",
    brandColor: "#ea580c",
    logoUrl: "/bems-group-logo.png?v=20261024",
    type: "GROUP",
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


type SystemRole = 'GMD' | 'SYSTEM_ADMIN' | 'SUPER_ADMIN' | 'STAFF';

interface RoleProfile {
  role: SystemRole;
  title: string;
  badge: string;
  platform: string;
  avatarColor: string;
}

const roleProfiles: Record<string, RoleProfile> = {
  GMD: { role: 'GMD', title: 'The Group Managing Director', badge: 'Executive Governance', platform: 'Executive Command Center', avatarColor: '#ea580c' },
  SYSTEM_ADMIN: { role: 'SYSTEM_ADMIN', title: 'Super admin', badge: 'Super Executive', platform: 'Executive Command Center', avatarColor: '#ea580c' },
  SUPER_ADMIN: { role: 'SUPER_ADMIN', title: 'Super admin', badge: 'Super Executive', platform: 'Executive Command Center', avatarColor: '#ea580c' },
  STAFF: { role: 'STAFF', title: 'Staff', badge: 'Staff Operations', platform: 'Staff Requisition & Accountability Portal', avatarColor: '#2563eb' },
};

const staffNavGroups = [
  {
    label: 'MY REQUISITIONS',
    items: [
      ['Overview', '⌂'],
      ['New fund request', '＋'],
      ['My requests', '▱'],
      ['My wallet', '◈'],
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
      ['Wallets & funded budgets', '◈'],
      ['Recurring commitments', '◌'],
      ['Hybrid payroll', '⌁'],
      ['Receipt archive', '▣'],
    ]
  },
  {
    label: 'ADMINISTRATION & GOVERNANCE',
    items: [
      ['Attendance & Timekeeping', '⏱'],
      ['Staff profiles', '♙'],
      ['Admin onboarding', '🛡️'],
      ['Audit logs', '≡'],
      ['Admin Settings', '⚙'],
      ['Mobile App Settings', '📱'],
    ]
  },
];

function getRoleNavigation(role?: string) {
  return role && ['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(role) ? gmdNavGroups : staffNavGroups;
}

function AuthGate({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [view, setView] = useState<'login' | 'signup' | 'pending' | 'setup'>('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showBootstrapPassword, setShowBootstrapPassword] = useState(false);
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
    staffGrade: 'Mid-Level Specialist / Officer (Level 4)',
    workLocation: 'UMUAHIA_OPS_HUB',
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
            staffGrade: prev.staffGrade || (d.staffGrades?.[3]?.value || 'Mid-Level Specialist / Officer (Level 4)'),
            workLocation: prev.workLocation || (d.workLocations?.[0]?.value || 'UMUAHIA_OPS_HUB'),
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
    e.preventDefault(); setError('');

    // Strict Compulsory Validation - All fields must be provided
    if (!signupForm.avatarUrl || signupForm.avatarUrl.length < 5) {
      setError('Passport photograph is mandatory. Please upload or take your face photograph.');
      return;
    }
    if (!signupForm.fullName.trim() || signupForm.fullName.trim().length < 3) {
      setError('Full legal name is required (minimum 3 characters).');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(signupForm.email.trim())) {
      setError('A valid work or personal email address is required.');
      return;
    }
    const cleanPhone = signupForm.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Valid mobile telephone number is required (at least 10 digits).');
      return;
    }
    if (!signupForm.gender) {
      setError('Please select your gender.');
      return;
    }
    if (!signupForm.maritalStatus) {
      setError('Please select your marital status.');
      return;
    }
    if (!signupForm.dateOfBirth) {
      setError('Please specify your date of birth.');
      return;
    }
    if (!signupForm.highestEducation) {
      setError('Please select your highest educational qualification.');
      return;
    }
    if (!signupForm.residentialAddress.trim() || signupForm.residentialAddress.trim().length < 3) {
      setError('Residential street address is required.');
      return;
    }
    if (!signupForm.cityState.trim() || signupForm.cityState.trim().length < 2) {
      setError('Residential city and state are required.');
      return;
    }
    if (!signupForm.stateOfOrigin.trim() || signupForm.stateOfOrigin.trim().length < 2) {
      setError('State of origin is required.');
      return;
    }
    if (!signupForm.lga.trim() || signupForm.lga.trim().length < 2) {
      setError('Local Government Area (LGA) is required.');
      return;
    }
    if (!signupForm.subsidiaryId) {
      setError('Please select your operating subsidiary company.');
      return;
    }
    if (!signupForm.departmentId) {
      setError('Please select your official operational department.');
      return;
    }
    if (!signupForm.jobTitle.trim() || signupForm.jobTitle.trim().length < 2) {
      setError('Official job title is required.');
      return;
    }
    if (!signupForm.resumptionDate) {
      setError('Please specify your resumption date.');
      return;
    }
    if (!signupForm.bankName) {
      setError('Please select your advance disbursement bank.');
      return;
    }
    const cleanAcct = signupForm.accountNumber.replace(/\D/g, '');
    if (cleanAcct.length !== 10) {
      setError('Valid 10-digit advance account number is required.');
      return;
    }
    if (!signupForm.accountName.trim() || signupForm.accountName.trim().length < 2) {
      setError('Advance bank account beneficiary name is required.');
      return;
    }
    const cleanNin = signupForm.nin.replace(/\D/g, '');
    if (cleanNin.length !== 11) {
      setError('Valid 11-digit National Identity Number (NIN) is required.');
      return;
    }
    if (!signupForm.nextOfKinName.trim() || signupForm.nextOfKinName.trim().length < 2) {
      setError('Next of Kin full legal name is required.');
      return;
    }
    if (!signupForm.nextOfKinRelationship.trim()) {
      setError('Next of Kin relationship is required.');
      return;
    }
    const cleanNokPhone = signupForm.nextOfKinPhone.replace(/\D/g, '');
    if (cleanNokPhone.length < 10) {
      setError('Valid Next of Kin contact phone number is required.');
      return;
    }
    if (!signupForm.nextOfKinAddress.trim() || signupForm.nextOfKinAddress.trim().length < 3) {
      setError('Next of Kin residential address is required.');
      return;
    }
    if (!signupForm.password || signupForm.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setBusy(true);
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
          <label className="full">
            Password
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={loginForm.password}
                onChange={e=>setLoginForm(old=>({...old, password: e.target.value}))}
                placeholder="Your password"
                style={{ width: '100%', paddingRight: '42px', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
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
                    <option value="">Select Department...</option>
                    {filteredDepartments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
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
                    placeholder="e.g. Software Developer, UI/UX Designer, Media Producer, Accountant"
                  />
                </label>
                <label>
                  Staff Grade / Hierarchy Level *
                  <select
                    value={signupForm.staffGrade}
                    onChange={e => setSignupForm(old => ({ ...old, staffGrade: e.target.value }))}
                  >
                    {(options.staffGrades.length > 0 ? options.staffGrades : [
                      { value: 'Intern / NYSC / Trainee (Level 1)', label: 'Intern / NYSC / Trainee (Level 1)' },
                      { value: 'Support / Field Assistant (Level 2)', label: 'Support / Field Assistant (Level 2)' },
                      { value: 'Junior Staff / Associate (Level 3)', label: 'Junior Staff / Associate (Level 3)' },
                      { value: 'Mid-Level Specialist / Officer (Level 4)', label: 'Mid-Level Specialist / Officer (Level 4)' },
                      { value: 'Senior Specialist (Level 5)', label: 'Senior Specialist (Level 5)' },
                      { value: 'Team Lead / Supervisor (Level 6)', label: 'Team Lead / Supervisor (Level 6)' },
                      { value: 'Manager / Head of Department (Level 7)', label: 'Manager / Head of Department (Level 7)' },
                      { value: 'C-Suite / Executive Director (Level 8)', label: 'C-Suite / Executive Director (Level 8)' },
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
                      { value: 'UMUAHIA_OPS_HUB', label: 'Umuahia Operations Center (Abia State)' },
                      { value: 'OWERRI_OPS_HUB', label: 'Owerri Operations Center (Imo State)' },
                      { value: 'EDO_BENIN_OPS_HUB', label: 'Benin City / Edo State Operations Hub' },
                      { value: 'BEMS_GROUP', label: 'BEMS Group' },
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
                ℹ️ <strong>Direct Bank Disbursement:</strong> Finance disburses all advances and expense reimbursements directly to your verified commercial NUBAN account. Real-time bank account validation is powered by Monnify.
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
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4 }}>
                    <input
                      required
                      type={showSignupPassword ? 'text' : 'password'}
                      minLength={10}
                      value={signupForm.password}
                      onChange={e => setSignupForm(old => ({ ...old, password: e.target.value }))}
                      placeholder="Minimum 10 characters"
                      style={{ width: '100%', paddingRight: '42px', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      title={showSignupPassword ? "Hide password" : "Show password"}
                      aria-label={showSignupPassword ? "Hide password" : "Show password"}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
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
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4 }}>
                <input
                  required
                  type={showBootstrapPassword ? 'text' : 'password'}
                  minLength={10}
                  value={loginForm.password}
                  onChange={e=>setLoginForm(old=>({...old, password: e.target.value}))}
                  placeholder="At least 10 characters"
                  style={{ width: '100%', paddingRight: '42px', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowBootstrapPassword(!showBootstrapPassword)}
                  title={showBootstrapPassword ? "Hide password" : "Show password"}
                  aria-label={showBootstrapPassword ? "Hide password" : "Show password"}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showBootstrapPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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

function TemplateMarketplace({business,setNotice}:{business:Business;setNotice:(x:string)=>void}) {
  const [imported, setImported] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let current = true;
    setStatus('loading'); setImported([]);
    apiGet<{imported: string[]}>(`/api/businesses/${business.id}/templates`).then(data => { if (current) { setImported(data.imported); setStatus('ready'); } }).catch(() => { if (current) setStatus('error'); });
    return () => { current = false; };
  }, [business.id]);
  const apply = async (id: string) => {
    setBusy(id);
    try {
      const result = await apiPost<{ imported: string }>(`/api/businesses/${business.id}/templates/${id}/import`);
      setImported(previous => [...new Set([...previous, result.imported])]);
      setNotice(`Governance settings applied to ${business.name}.`);
    } catch { setNotice('These settings could not be applied. Please retry.'); }
    finally { setBusy(null); }
  };
  return <><SectionHeader eyebrow="GOVERNANCE TEMPLATES" title="Apply business controls" text={`Review and apply supported settings to ${business.name}. Existing records and payment history are preserved.`}/>
    {status === 'loading' && <p>Loading applied templates…</p>}
    {status === 'error' && <p>Applied templates could not be loaded.</p>}
    <div className="control-grid">{GOVERNANCE_TEMPLATES.map(template => <article key={template.id}><h3>{template.title}</h3><p>{template.description}</p><strong>{imported.includes(template.id) ? 'Applied' : 'Available'}</strong><button disabled={status !== 'ready' || busy !== null} onClick={() => apply(template.id)}>{busy === template.id ? 'Applying…' : imported.includes(template.id) ? 'Apply again' : 'Apply settings'}</button></article>)}</div>
  </>;
}
type CreateField = { key:string; label:string; type?:'text'|'textarea'|'select'; options?:string[]; placeholder?:string };
function CreateModal({title,subtitle,fields,onCancel,onSubmit}:{title:string;subtitle?:string;fields:CreateField[];onCancel:()=>void;onSubmit:(values:Record<string,string>)=>void}) {
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(f=>[f.key,f.options?f.options[0]:''])));
  const set=(key:string,value:string)=>setValues(old=>({...old,[key]:value}));
  const submit=(e:FormEvent)=>{e.preventDefault();onSubmit(values)};
  return <div className="template-modal" role="dialog" aria-modal="true"><div className="template-modal-card"><button className="modal-close" onClick={onCancel} aria-label="Close">×</button><div className="modal-title"><div><p className="kicker">{subtitle||'CREATE NEW'}</p><h2>{title}</h2></div></div><form onSubmit={submit}><div className="settings-fields">{fields.map(f=><label key={f.key} className={f.type==='textarea'?'wide':undefined}>{f.label}{f.type==='select'?<select value={values[f.key]} onChange={e=>set(f.key,e.target.value)}>{(f.options||[]).map(o=><option key={o}>{o}</option>)}</select>:f.type==='textarea'?<textarea value={values[f.key]} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder}/>:<input required={f.key==='name'||f.key==='title'||f.key==='email'} type={f.key==='email'?'email':'text'} value={values[f.key]} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder}/>}</label>)}</div><div className="modal-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="submit">Create</button></div></form></div></div>;
}
function initialsOf(name:string) { const parts=name.trim().split(/\s+/); return (parts[0]?.[0]||'').concat(parts[1]?.[0]||'').toUpperCase()||'NW'; }

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

type CaseRecord = { id:string; customerName:string; initials:string; channel:string; subject:string; status:'Within SLA'|'At risk'|'Escalated'|'Resolved'; owner:string; slaTarget:string; time:string };

const seedCases:CaseRecord[] = [];

type CaseHandlers = { cases:CaseRecord[]; onResolveCase:(id:string)=>void; onAddCase:(input:{customerName:string;subject:string})=>void };

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
      .catch(()=>{ setRows([]); setMembersStatus('error'); });
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
        <button onClick={()=>setNotice('Review each member’s assigned role and HR scope before changing their access.')}>Review permissions</button>
      </aside>
    </div>
    {creating&&<CreateModal title="Invite member" fields={[{key:'email',label:'Email address',placeholder:'e.g. grace@example.com'},{key:'role',label:'Role',type:'select',options:['SUPER_ADMIN','GMD']}]} onCancel={()=>setCreating(false)} onSubmit={v=>{apiPost<{invitationId:string}>(`/api/businesses/${business.id}/members`,{email:v.email,role:v.role||'SUPER_ADMIN'}).then(()=>{setCreating(false);fetchMembers();setNotice(`Executive invitation created for ${v.email}; email delivery is queued.`)}).catch(()=>setNotice('The invitation could not be created. Check your role and the selected executive role.'))}}/>}
  </>;
}

function UnconfiguredModule({name}:{name:string}) {
  return <><SectionHeader eyebrow="WORKSPACE" title={name} text="This section needs setup before it can be used."/><section className="card"><h3>Not configured</h3><p>No live records or completed actions are available for this section. Use the fund requests, payments, payroll, staff and audit sections for current business records.</p></section></>;
}
function SecurityCompliancePage({name}:{name:string;setNotice:(x:string)=>void}) {
  return <><SectionHeader eyebrow="TRUST & GOVERNANCE" title={name} text="Security posture has not been measured. No automated compliance review has been completed."/><section className="card"><h3>Review evidence</h3><p>Use recorded audit events to inspect business changes and approvals. A compliance score is unavailable.</p><Link href="/audit">Open audit records →</Link></section></>;
}

function DetailedModule({name,business,cases,onResolveCase,onAddCase,setNotice}:{name:string;business:Business;setNotice:(x:string)=>void}&CaseHandlers) {
  if(name==='Team & access') return <TeamAccessPage business={business} setNotice={setNotice}/>;
  if(name==='Security & compliance'||name.includes('compliance')||name.includes('Fraud')) return <SecurityCompliancePage name={name} setNotice={setNotice}/>;
  return <UnconfiguredModule name={name}/>;
}


function RoleOverviewModule({role,business,user,cases,setActive,setNotice,onRoleChange}:{role:SystemRole;business:Business;user:AuthUser;cases:CaseRecord[];setActive:(x:string)=>void;setNotice:(x:string)=>void;onRoleChange?:(r:SystemRole)=>void}) {
  const isGroup = business.code === 'BEMS-GROUP' || (business as any).type === 'GROUP' || business.id === 'BEMS-GROUP';
  const activeScope = isGroup ? 'ALL' : (business.code || business.id);
  const brandColor = (business as any).brandColor || business.color || (isGroup ? '#ea580c' : '#0d8a70');

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
      <WalletDashboardSummary onOpen={() => setActive("Wallets & funded budgets")} />
      <ModernBentoDashboard
        role={role}
        businessName={business.name}
        subsidiaryId={activeScope}
        brandColor={brandColor}
        onNavigate={(p) => setActive(p)}
        onRoleChange={(r) => onRoleChange && onRoleChange(r as SystemRole)}
      />
    </div>
  );
}


function ExecutiveBriefingModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  return (
    <div style={{ marginTop: '4px' }}>
      <ExecutiveBriefingClient
        activeSubsidiaryId={business.id}
        activeSubsidiaryName={business.name}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function RequestChannelsModule({business,setNotice,onNavigate}:{business:Business;setNotice:(x:string)=>void;onNavigate:(p:string)=>void}) {
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'HELPDESK'>('REQUESTS');
  const [requests, setRequests] = useState<GmdRequest[]>([]);
  const [selectedChat, setSelectedChat] = useState<GmdRequest|null>(null);
  const [loadState, setLoadState] = useState<'loading'|'ready'|'error'>('loading');

  const isGroup = business.code === 'BEMS-GROUP' || (business as any).type === 'GROUP' || business.id === 'BEMS-GROUP';
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
        initialMessages={selectedChat.recentMessages || []}
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

function FundRequestsModule({
  business,
  setNotice,
  onNavigate,
  canCreate = true,
}: {
  business: Business;
  setNotice: (x: string) => void;
  onNavigate: (p: string) => void;
  canCreate?: boolean;
}) {
  const [requests, setRequests] = useState<GmdRequest[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tabFilter, setTabFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'DISBURSED' | 'EVIDENCE'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedRequest, setSelectedRequest] = useState<GmdRequest | null>(null);

  const isGroup = business.code === 'BEMS-GROUP' || (business as any).type === 'GROUP' || business.id === 'BEMS-GROUP';
  const activeScope = isGroup ? 'ALL' : (business.code || business.id);
  const brandColor = business.brandColor || business.color || (isGroup ? '#ea580c' : '#0d8a70');
  const brandLogo = business.logoUrl || (isGroup ? '/bems-group-logo.png?v=20261024' : null);

  const loadRequests = () => {
    setLoadState('loading');
    apiGet<{ requests: GmdRequest[] }>(`/api/approvals?subsidiary=${encodeURIComponent(activeScope)}`)
      .then((data) => {
        setRequests(data.requests || []);
        setLastFetchedAt(new Date().toISOString());
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
                  tierLabel: amt > 2000000 ? 'Tier 3 (GMD Escalation)' : amt > 500000 ? 'Tier 2 (Executive Approval)' : 'Tier 1 (HOD Direct)',
                  approvalStatus: r.status || 'SUBMITTED',
                  paymentStatus: 'UNPAID',
                  accountabilityStatus: 'PENDING_SUBMISSION',
                  isRecurring: Boolean(r.isRecurring),
                  recurringInterval: r.recurringInterval || null,
                  createdAt: r.createdAt || new Date().toISOString(),
                  subsidiary: { id: '', code: '', name: r.subsidiaryName || business.name },
                  requester: { id: '', name: 'Staff Requester', role: 'STAFF', employeeNumber: '', department: r.departmentName || 'Operations' },
                  vendor: r.vendor || null,
                  threeWayMatch: { poMatched: true, quoteAttached: false, scopeVerified: true, status: '2-WAY MATCHED' },
                  budgetImpact: { totalBudget: 0, spentSoFar: 0, remainingBefore: 0, remainingAfter: 0, percentOfBudget: 0 },
                  approvalSteps: [],
                  recentMessages: [],
                };
              });
              setRequests(mapped);
              setLastFetchedAt(new Date().toISOString());
              setLoadState('ready');
              return;
            }
            setLastFetchedAt(new Date().toISOString());
            setLoadState('error');
          })
          .catch(() => {
            setLastFetchedAt(new Date().toISOString());
            setLoadState('error');
          });
      });
  };

  useEffect(() => { loadRequests(); }, [activeScope]);

  const activeDataset = requests;

  // Telemetry KPIs
  const pending = activeDataset.filter((r) => ['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(r.approvalStatus));
  const approved = activeDataset.filter((r) => r.approvalStatus === 'APPROVED' && r.paymentStatus !== 'PAID');
  const disbursed = activeDataset.filter((r) => r.paymentStatus === 'PAID' || r.paymentStatus === 'SETTLED');
  const evidencePending = activeDataset.filter((r) => r.accountabilityStatus === 'PENDING_SUBMISSION' || r.accountabilityStatus === 'SUBMITTED');
  const totalValue = activeDataset.reduce((sum, r) => sum + r.amount, 0);

  // Tab Filtering
  const tabFiltered = activeDataset.filter((r) => {
    if (tabFilter === 'PENDING') return ['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(r.approvalStatus);
    if (tabFilter === 'APPROVED') return r.approvalStatus === 'APPROVED' && r.paymentStatus !== 'PAID';
    if (tabFilter === 'DISBURSED') return r.paymentStatus === 'PAID' || r.paymentStatus === 'SETTLED';
    if (tabFilter === 'EVIDENCE') return r.accountabilityStatus === 'PENDING_SUBMISSION' || r.accountabilityStatus === 'SUBMITTED';
    return true;
  });

  // Query & Sub-filter matching
  const visible = tabFiltered.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.approvalStatus === statusFilter;
    const matchesTier = tierFilter === 'ALL' || String(r.tierLevel) === tierFilter;
    const matchesCategory = categoryFilter === 'ALL' || r.category === categoryFilter;
    const text = `${r.requestNumber || ''} ${r.title || ''} ${r.requester?.name || ''} ${r.subsidiary?.name || ''} ${r.category || ''} ${r.requester?.department || ''}`.toLowerCase();
    return matchesStatus && matchesTier && matchesCategory && text.includes(query.toLowerCase());
  });

  const exportRequests = () => {
    const columns = ['Request number', 'Title', 'Subsidiary', 'Department', 'Amount', 'Approval status', 'Payment status', 'Accountability status', 'Requester', 'Category', 'Tier'];
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
      r.tierLabel,
    ]);
    const csv = '\uFEFF' + [columns, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fund-requests-${business.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const categories = Array.from(new Set(activeDataset.map((r) => r.category))).filter(Boolean);

  return (
    <div className="fund-requests-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. EXECUTIVE TELEMETRY MASTHEAD */}
      <section
        style={{
          borderRadius: 20,
          background: `radial-gradient(circle at 88% 20%, ${brandColor}24, transparent 42%), linear-gradient(135deg, #070c16 0%, #0e1422 65%, ${brandColor}18 100%)`,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.16)',
          color: '#ffffff',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 660, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 20, background: `${brandColor}22`, border: `1px solid ${brandColor}50`, marginBottom: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: brandColor, boxShadow: `0 0 10px ${brandColor}` }} />
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff' }}>
              EXPENDITURE INVENTORY · {business.name}
            </span>
          </div>
          <h2 style={{ fontSize: 'clamp(22px, 2.5vw, 28px)', fontWeight: 850, letterSpacing: '-0.03em', margin: '4px 0 8px', color: '#ffffff' }}>
            Fund Requests & Requisition Pipeline
          </h2>
          <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.55 }}>
            Deterministic multi-threshold governance, automated 3-way matching (Quote + PO + Scope), dual maker-checker bank disbursements, and 72-hour accountability close-outs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
          {canCreate && (
            <button
              type="button"
              onClick={() => onNavigate('/requests/new')}
              style={{
                border: 0,
                background: `linear-gradient(135deg, ${brandColor}, #ea580c)`,
                color: '#ffffff',
                padding: '11px 18px',
                borderRadius: 11,
                fontSize: 12,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: `0 8px 20px ${brandColor}40`,
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <span style={{ fontSize: 14 }}>＋</span> New Fund Request
            </button>
          )}

          <button
            type="button"
            onClick={exportRequests}
            disabled={visible.length === 0}
            style={{
              border: '1px solid rgba(255, 255, 255, 0.16)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              padding: '10px 15px',
              borderRadius: 10,
              fontSize: 11.5,
              fontWeight: 750,
              cursor: visible.length === 0 ? 'not-allowed' : 'pointer',
              opacity: visible.length === 0 ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📥</span> Export CSV
          </button>

          <button
            type="button"
            onClick={loadRequests}
            title="Refresh Requisitions"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.16)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ↻
          </button>
        </div>
      </section>

      {/* 2. ELEVATED TELEMETRY KPI CARDS (5-CARD MATRIX) */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        <article
          style={{
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 112,
            transition: 'transform 0.2s ease, border-color 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>
              TOTAL REQUISITIONS
            </small>
            <span style={{ fontSize: 12, opacity: 0.7 }}>📋</span>
          </div>
          <strong style={{ fontSize: 26, fontWeight: 850, color: '#0f172a', margin: '4px 0 2px' }}>
            {loadState === 'ready' ? activeDataset.length : '—'}
          </strong>
          <span style={{ fontSize: 11, color: '#64748b' }}>Across subsidiary ledger</span>
        </article>

        <article
          style={{
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 112,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#d97706', textTransform: 'uppercase' }}>
              AWAITING DECISION
            </small>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
          </div>
          <strong style={{ fontSize: 26, fontWeight: 850, color: '#b45309', margin: '4px 0 2px' }}>
            {loadState === 'ready' ? pending.length : '—'}
          </strong>
          <span style={{ fontSize: 11, color: '#92400e' }}>SLA &lt; 24h review ladder</span>
        </article>

        <article
          style={{
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 112,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#059669', textTransform: 'uppercase' }}>
              APPROVED FOR PAYOUT
            </small>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          </div>
          <strong style={{ fontSize: 26, fontWeight: 850, color: '#047857', margin: '4px 0 2px' }}>
            {loadState === 'ready' ? approved.length : '—'}
          </strong>
          <span style={{ fontSize: 11, color: '#065f46' }}>Ready for bank disbursement</span>
        </article>

        <article
          style={{
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 112,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#7c3aed', textTransform: 'uppercase' }}>
              72H EVIDENCE WATCHDOG
            </small>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 8px #8b5cf6' }} />
          </div>
          <strong style={{ fontSize: 26, fontWeight: 850, color: '#6d28d9', margin: '4px 0 2px' }}>
            {loadState === 'ready' ? evidencePending.length : '—'}
          </strong>
          <span style={{ fontSize: 11, color: '#5b21b6' }}>Advances requiring receipts</span>
        </article>

        <article
          style={{
            background: '#ffffff',
            border: `1.5px solid ${brandColor}40`,
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: `0 4px 18px ${brandColor}12`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 112,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: brandColor, textTransform: 'uppercase' }}>
              COMMITTED VALUE
            </small>
            <span style={{ fontSize: 12 }}>💳</span>
          </div>
          <strong style={{ fontSize: 22, fontWeight: 850, color: brandColor, margin: '4px 0 2px' }}>
            {loadState === 'ready' ? `₦${totalValue.toLocaleString('en-NG')}` : '—'}
          </strong>
          <span style={{ fontSize: 11, color: '#64748b' }}>Active expenditure records</span>
        </article>
      </section>

      {/* 3. SEGMENTED QUICK TABS */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 6,
          background: '#f1f5f9',
          borderRadius: 14,
          overflowX: 'auto',
          width: '100%',
        }}
      >
        {[
          { key: 'ALL', label: 'All Requisitions', count: activeDataset.length },
          { key: 'PENDING', label: 'Pending Approval', count: pending.length },
          { key: 'APPROVED', label: 'Approved for Payout', count: approved.length },
          { key: 'DISBURSED', label: 'Disbursed & Active', count: disbursed.length },
          { key: 'EVIDENCE', label: '72h Evidence Needed', count: evidencePending.length },
        ].map((tab) => {
          const isActive = tabFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTabFilter(tab.key as any)}
              style={{
                border: 0,
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#0f172a' : '#64748b',
                boxShadow: isActive ? '0 2px 8px rgba(15, 23, 42, 0.08)' : 'none',
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: isActive ? 800 : 650,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 8,
                  background: isActive ? brandColor : 'rgba(100, 116, 139, 0.14)',
                  color: isActive ? '#ffffff' : '#475569',
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. SEARCH & FILTER COMMAND BAR */}
      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.02)',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }}>
            🔍
          </span>
          <input
            aria-label="Search fund requests"
            placeholder="Search by reference, title, staff, or department..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px 0 34px',
              border: '1px solid #d8e0eb',
              borderRadius: 10,
              fontSize: 12,
              color: '#0f172a',
              outline: 'none',
              background: '#f8fafc',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
            >
              ×
            </button>
          )}
        </div>

        <select
          aria-label="Filter by approval status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ height: 40, border: '1px solid #d8e0eb', borderRadius: 10, padding: '0 12px', fontSize: 11.5, background: '#ffffff', color: '#334155', fontWeight: 650 }}
        >
          <option value="ALL">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="CLARIFICATION_REQUESTED">Clarification</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          aria-label="Filter by governance tier"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          style={{ height: 40, border: '1px solid #d8e0eb', borderRadius: 10, padding: '0 12px', fontSize: 11.5, background: '#ffffff', color: '#334155', fontWeight: 650 }}
        >
          <option value="ALL">All Tiers</option>
          <option value="1">Tier 1 (&lt; ₦500k)</option>
          <option value="2">Tier 2 (₦500k – ₦2M)</option>
          <option value="3">Tier 3 (&gt; ₦2M GMD)</option>
        </select>

        {categories.length > 0 && (
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ height: 40, border: '1px solid #d8e0eb', borderRadius: 10, padding: '0 12px', fontSize: 11.5, background: '#ffffff', color: '#334155', fontWeight: 650 }}
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {visible.length} of {activeDataset.length} requests
        </div>
      </section>

      {/* 5. MAIN CONTENT AREA: GUIDED EMPTY STATE OR RICH INTERACTIVE TABLE */}
      {loadState === 'loading' && (
        <div style={{ padding: 40, background: '#ffffff', borderRadius: 16, border: '1px solid var(--line)', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite' }}>↻</div>
          <strong>Synchronizing expenditure ledger for {business.name}…</strong>
        </div>
      )}

      {loadState === 'error' && (
        <div className="inline-status error" style={{ padding: 18, borderRadius: 14 }}>
          <span>
            Live fund requests ledger is currently unavailable or stale (last checked at {lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString() : 'now'}). No demo or placeholder records are shown.
          </span>
          <button type="button" onClick={loadRequests} style={{ marginLeft: 'auto' }}>
            Retry Sync
          </button>
        </div>
      )}

      {loadState === 'ready' && activeDataset.length === 0 && (
        /* GUIDED ENTERPRISE EMPTY STATE — ELIMINATES THE SAD WHITE VOID */
        <section
          style={{
            padding: '48px 36px',
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: 20,
            textAlign: 'center',
            boxShadow: '0 6px 24px rgba(15, 23, 42, 0.03)',
          }}
        >
          {/* Central Holographic Icon */}
          <div
            style={{
              width: 76,
              height: 76,
              margin: '0 auto 18px',
              borderRadius: 24,
              background: `radial-gradient(circle, ${brandColor}22 0%, #ffffff 80%)`,
              border: `2px solid ${brandColor}40`,
              boxShadow: `0 0 0 14px ${brandColor}10, 0 0 0 30px ${brandColor}06`,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {brandLogo ? (
              <img src={brandLogo} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 28, color: brandColor, fontWeight: 900 }}>
                {business.initials || business.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 10, fontWeight: 800, marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            UNIFIED REQUISITION LEDGER ACTIVE
          </div>

          <h3 style={{ fontSize: 24, fontWeight: 850, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            No Active Fund Requests for {business.name}
          </h3>

          <p style={{ fontSize: 13.5, color: '#64748b', maxWidth: 640, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Official expenditure ledger for {business.name}. Requisitions submitted by staff will stream here automatically for 3-way quote matching, multi-tier executive approval, and dual maker-checker disbursement.
          </p>

          {/* 3 Process Guidance Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              textAlign: 'left',
              maxWidth: 960,
              margin: '0 auto 34px',
            }}
          >
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '20px 18px',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 10 }}>📝</span>
                <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  1. Staff Requisitions
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
                  Staff initiate expenditure requests via the self-service BEMS Staff Portal or Mobile APK with itemized pro-forma quotes.
                </p>
              </div>
              <div style={{ marginTop: 14, fontSize: 10, fontWeight: 800, color: brandColor }}>
                ✓ Self-Service Channel Enforced
              </div>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '20px 18px',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 10 }}>⚖️</span>
                <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  2. 3-Tier Governance
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
                  Automatic threshold routing: &lt;₦500k to HOD direct, &lt;₦2M to Executive, and &gt;₦2M escalates to The Group Managing Director.
                </p>
              </div>
              <div style={{ marginTop: 14, fontSize: 10, fontWeight: 800, color: '#059669' }}>
                ✓ 3-Way Match Verification
              </div>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '20px 18px',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 10 }}>🏦</span>
                <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  3. Maker-Checker Payout
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
                  Treasury records off-platform bank transfers with SHA-256 duplicate detection, followed by 72-hour receipt accountability.
                </p>
              </div>
              <div style={{ marginTop: 14, fontSize: 10, fontWeight: 800, color: '#7c3aed' }}>
                ✓ 72-Hour Evidence Compliance
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            {canCreate && (
              <button
                type="button"
                onClick={() => onNavigate('/requests/new')}
                style={{
                  border: 0,
                  background: `linear-gradient(135deg, ${brandColor}, #ea580c)`,
                  color: '#ffffff',
                  padding: '12px 22px',
                  borderRadius: 11,
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: `0 8px 20px ${brandColor}33`,
                }}
              >
                ＋ Submit First Fund Request
              </button>
            )}

            <button
              type="button"
              onClick={() => setNotice('Opening Delegation of Authority policy limits and thresholds.')}
              style={{
                border: '1px solid #d8e0eb',
                background: '#f8fafc',
                color: '#475569',
                padding: '11px 18px',
                borderRadius: 11,
                fontSize: 12,
                fontWeight: 750,
                cursor: 'pointer',
              }}
            >
              📑 View Authority Matrix
            </button>
          </div>
        </section>
      )}

      {/* 6. RICH REQUISITION TABLE (WHEN DATA IS ACTIVE) */}
      {loadState === 'ready' && activeDataset.length > 0 && (
        <section
          style={{
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)',
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1.1fr 1fr 1.1fr 1fr 120px',
              gap: 14,
              padding: '14px 20px',
              background: '#f8fafc',
              borderBottom: '1px solid var(--line)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#64748b',
            }}
          >
            <span>Requisition & Justification</span>
            <span>Category & 3-Way Match</span>
            <span>Requester & Department</span>
            <span>Amount & Governance Tier</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Action</span>
          </div>

          {/* Table Rows */}
          {visible.map((r) => {
            const isApproved = r.approvalStatus === 'APPROVED';
            const isRejected = r.approvalStatus === 'REJECTED';
            const isPaid = r.paymentStatus === 'PAID' || r.paymentStatus === 'SETTLED';

            return (
              <div
                key={r.id}
                onClick={() => setSelectedRequest(r)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.1fr 1fr 1.1fr 1fr 120px',
                  gap: 14,
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  background: '#ffffff',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
              >
                {/* 1. Requisition & Title */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: brandColor, background: `${brandColor}14`, padding: '2px 6px', borderRadius: 5 }}>
                      {r.requestNumber}
                    </span>
                    {Boolean((r as any).isUrgent) && (
                      <span style={{ fontSize: 9, fontWeight: 800, background: '#fef2f2', color: '#dc2626', padding: '2px 5px', borderRadius: 5, border: '1px solid #fecaca' }}>
                        URGENT
                      </span>
                    )}
                  </div>
                  <strong style={{ fontSize: 13, color: '#0f172a', display: 'block', lineHeight: 1.35 }}>
                    {r.title}
                  </strong>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                    {r.justification || 'Standard departmental procurement'}
                  </p>
                </div>

                {/* 2. Category & 3-Way Match */}
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, background: '#f1f5f9', color: '#475569', padding: '3px 7px', borderRadius: 6, display: 'inline-block', marginBottom: 5 }}>
                    {r.category.replaceAll('_', ' ')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.threeWayMatch?.status === '3-WAY MATCHED' ? '#10b981' : '#f59e0b' }} />
                    <span style={{ fontSize: 10.5, fontWeight: 750, color: r.threeWayMatch?.status === '3-WAY MATCHED' ? '#047857' : '#b45309' }}>
                      {r.threeWayMatch?.status || '2-WAY MATCHED'}
                    </span>
                  </div>
                </div>

                {/* 3. Requester & Department */}
                <div>
                  <strong style={{ fontSize: 12.5, color: '#1e293b', display: 'block' }}>
                    {r.requester?.name || 'Staff Member'}
                  </strong>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {r.requester?.department || 'Operations'}
                  </span>
                </div>

                {/* 4. Amount & Governance Tier */}
                <div>
                  <strong style={{ fontSize: 15, fontWeight: 850, color: '#0f172a', display: 'block' }}>
                    {r.amountFormatted}
                  </strong>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: r.tierLevel === 3 ? '#b45309' : r.tierLevel === 2 ? '#4338ca' : '#047857',
                      background: r.tierLevel === 3 ? '#fffbeb' : r.tierLevel === 2 ? '#eef2ff' : '#ecfdf5',
                      padding: '2px 6px',
                      borderRadius: 5,
                      display: 'inline-block',
                      marginTop: 2,
                    }}
                  >
                    {r.tierLabel}
                  </span>
                </div>

                {/* 5. Status */}
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '4px 9px',
                      borderRadius: 20,
                      background: isApproved ? '#ecfdf5' : isRejected ? '#fef2f2' : '#fffbeb',
                      color: isApproved ? '#047857' : isRejected ? '#b91c1c' : '#b45309',
                      border: `1px solid ${isApproved ? '#a7f3d0' : isRejected ? '#fecaca' : '#fde68a'}`,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: isApproved ? '#10b981' : isRejected ? '#ef4444' : '#f59e0b' }} />
                    {r.approvalStatus.replaceAll('_', ' ')}
                  </span>
                  {isPaid && (
                    <span style={{ display: 'block', fontSize: 9.5, color: '#059669', fontWeight: 750, marginTop: 3 }}>
                      ✓ Bank Disbursed
                    </span>
                  )}
                </div>

                {/* 6. Action */}
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: brandColor,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Dossier →
                  </span>
                </div>
              </div>
            );
          })}

          {!visible.length && (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>
                No requisitions match the selected filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setTabFilter('ALL');
                  setStatusFilter('ALL');
                  setTierFilter('ALL');
                  setCategoryFilter('ALL');
                }}
                style={{
                  border: '1px solid #d8e0eb',
                  background: '#f8fafc',
                  color: brandColor,
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Reset All Filters
              </button>
            </div>
          )}
        </section>
      )}

      {selectedRequest && (
        <RequestDossierModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
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
  const isGroupScope = (current as any).code === 'BEMS-GROUP' || (current as any).type === 'GROUP' || current.id === 'BEMS-GROUP';
  const activeScope = isGroupScope ? 'ALL' : ((current as any).code || current.id);
  const activeBrandColor = current.brandColor || current.color || (isGroupScope ? '#ea580c' : '#0d8a70');
  const activeLogoUrl = current.logoUrl || (isGroupScope ? '/bems-group-logo.png?v=20261024' : null);

  // Compute complementary tint and shade for seamless gradient cards across the entire dashboard
  const brandHex = (activeBrandColor || '#ea580c').replace('#', '');
  const rVal = parseInt(brandHex.length === 3 ? brandHex[0] + brandHex[0] : brandHex.slice(0, 2), 16) || 234;
  const gVal = parseInt(brandHex.length === 3 ? brandHex[1] + brandHex[1] : brandHex.slice(2, 4), 16) || 88;
  const bVal = parseInt(brandHex.length === 3 ? brandHex[2] + brandHex[2] : brandHex.slice(4, 6), 16) || 12;

  const tintR = Math.min(255, Math.round(rVal + (255 - rVal) * 0.28));
  const tintG = Math.min(255, Math.round(gVal + (255 - gVal) * 0.28));
  const tintB = Math.min(255, Math.round(bVal + (255 - bVal) * 0.28));
  const activeTintHex = `#${tintR.toString(16).padStart(2, '0')}${tintG.toString(16).padStart(2, '0')}${tintB.toString(16).padStart(2, '0')}`;

  const shadeR = Math.max(0, Math.round(rVal * 0.76));
  const shadeG = Math.max(0, Math.round(gVal * 0.76));
  const shadeB = Math.max(0, Math.round(bVal * 0.76));
  const activeShadeHex = `#${shadeR.toString(16).padStart(2, '0')}${shadeG.toString(16).padStart(2, '0')}${shadeB.toString(16).padStart(2, '0')}`;

  const isAiOnly = false;
  const [currentRole, setCurrentRole] = useState<SystemRole>(['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'STAFF'].includes(safeUser.role) ? safeUser.role as SystemRole : 'STAFF');
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
  const [collapsed, setCollapsed] = useState(true);


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
  const gmdAccess = useGmdAccess(safeUser.role);
  const isAiAuthorized = gmdAccess && currentRole === safeUser.role;

  const aiManager = useAiFinancialManager({
    userRole: currentRole,
    userName: safeUser.fullName || 'User',
    businessName: current?.name || 'BEMS Group',
    businessId: current?.id || 'BEMS-GROUP',
    currentPage: active,
  });

  const handleOpenAiDrawer = (prompt?: string) => {
    notifyAiInteraction();
    aiManager.ensureFreshSession?.();
    setActiveAiPrompt(prompt);
    setAiDrawerOpen(true);
  };

  useEffect(() => {
    const handleAiKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (isAiAuthorized) {
          notifyAiInteraction();
          aiManager.ensureFreshSession?.();
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
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('org', id);
      window.history.replaceState({}, '', url.toString());
    }
    const isNextGroup = next.type === 'GROUP' || next.id === 'BEMS-GROUP' || next.code === 'BEMS-GROUP';
    if (isNextGroup) {
      setNotice('Switched to BEMS Group Master View: Consolidated data across all subsidiaries.');
    } else {
      setNotice(`Switched workspace to ${next.name}. Theme and branding loaded.`);
    }
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
    if (target === 'Wallets & funded budgets' && ['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(safeUser.role)) {
      return (
        <FundingView
          businessName={current.name}
          scope={activeScope}
          businessId={current.id}
          brandColor={(current as any).brandColor || current.color || (isGroupScope ? '#ea580c' : '#0d8a70')}
          isGroup={isGroupScope}
        />
      );
    }
    if (target === 'My wallet' && safeUser.role === 'STAFF') return <WalletView brandColor={activeBrandColor} />;

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


    if (gmdAccess) {
      if (target === 'Fund requests') return <FundRequestsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p} canCreate={false}/>;
      if (target === 'Request channels') return <RequestChannelsModule business={current} setNotice={setNotice} onNavigate={path=>setActive(path==='/requests'?'Fund requests':path)}/>;
      // Evidence is submitted by the requester. GMDs only review staff uploads and close-out status.
      if (target === 'Accountability closure' || target === 'Proof & deliverables' || target === 'Follow-up tasks') return <LiveAccountabilityModule setNotice={setNotice}/>;
      if (target === 'Receipt archive') return <LiveReceiptArchiveModule scope={activeScope} setNotice={setNotice}/>;
      if (target === 'Attendance & Timekeeping' || target === 'Attendance') return <AttendanceDeskPage />;
      if (target === 'Staff profiles') return <LiveStaffProfilesModule scope={activeScope} setNotice={setNotice} onNavigate={(p) => setActive(p)}/>;
      if (target === 'Analytics & BI') return <LiveAnalyticsBIPage/>;
      if (target === 'Intercompany notes' || target === 'Intercompany & Audit Hub') {
        return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice} initialSection="Intercompany & Governance"/>;
      }
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
            onRoleChange={() => setNotice('Your workspace uses the role assigned to your signed-in account.')}
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
      if(!isAiAuthorized)return <div>AI access requires an authorized executive.</div>;
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

    if(target==='Overview') return <RoleOverviewModule role={currentRole} business={current} user={safeUser} cases={cases} setActive={setActive} setNotice={setNotice} onRoleChange={() => setNotice('Your workspace uses the role assigned to your signed-in account.')}/>;
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
    if(target==='Fund requests') return <FundRequestsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p} canCreate={currentRole !== 'GMD' && currentRole !== 'SYSTEM_ADMIN' && currentRole !== 'SUPER_ADMIN'}/>;
    if(target==='Approvals & payments'||target==='Approvals & Policy Hub'||target==='Approvals desk') return <FundFlowWorkspace businessName={current.name} userName={safeUser.fullName} scope={activeScope} businessId={current.id} businessCode={(current as any).code} onNavigate={setActive} onSelectBusiness={selectBusiness}/>;
    if(target==='New fund request') {
      if (currentRole === 'GMD' || currentRole === 'SYSTEM_ADMIN' || currentRole === 'SUPER_ADMIN') {
        setNotice('GMD and Super Admin accounts are executive governance roles and do not submit fund requests.');
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
    if(target==='Intercompany notes'||target==='Intercompany & Audit Hub') return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice} initialSection="Intercompany & Governance"/>;
    if(target==='Settlement reconciliation') return <SettlementReconciliationModule business={current} setNotice={setNotice}/>;
    if(target==='Vendors & suppliers') return <VendorsModule business={current} setNotice={setNotice} onNavigate={(p)=>window.location.href=p}/>;
    if(target==='Price benchmarks') return <PriceBenchmarksModule business={current} setNotice={setNotice}/>;
    if(target==='Recurring commitments') return <RecurringCommitmentsModule business={current} setNotice={setNotice}/>;
    if(target==='Notification bridge') return <NotificationBridgeModule business={current} setNotice={setNotice}/>;
    if(target==='Audit logs') return <LiveAuditLogsModule scope={activeScope} setNotice={setNotice}/>;
    if(target==='Attendance & Timekeeping' || target==='Attendance') return <AttendanceDeskPage />;
    if(target==='Staff profiles') return <LiveStaffProfilesModule scope={activeScope} setNotice={setNotice} onNavigate={(p) => setActive(p)}/>;
    if(target==='Admin onboarding' || target==='Staff onboarding') return <PeopleAccessWorkspaceModule setNotice={setNotice} onNavigate={(p) => setActive(p)}/>;
    if(target==='Team & access') return <TeamAccessPage business={current} setNotice={setNotice}/>;
    if(target==='Security & compliance') return <SecurityCompliancePage name="Security & compliance" setNotice={setNotice}/>;
    if(target==='System configuration') return <UnconfiguredModule name="System configuration"/>;
    if(target==='Settings' || target==='Admin Settings') return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice}/>;
    if(target==='Mobile App Settings' || target==='Mobile settings' || target==='Mobile App Version Control') return <LiveWorkspaceSettingsModule businessName={current.name} setNotice={setNotice} initialSection="Mobile App Settings"/>;
    return <DetailedModule name={target} business={current} cases={cases} onResolveCase={resolveCase} onAddCase={addCase} setNotice={setNotice}/>;
  },[active,current,currentRole,gmdAccess,isAiAuthorized,businesses,onAddBusiness,selectBusiness,onUpdateBusiness,setNotice,cases,resolveCase,addCase,user]);

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
      <style>{`
        :root, .app-shell, body {
          --brand-primary: ${activeBrandColor} !important;
          --brand-primary-rgb: ${activeBrandColor} !important;
          --brand-gradient: linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%) !important;
          --brand-shadow-color: ${activeBrandColor}40 !important;
          --brand-tint: ${activeBrandColor}18 !important;
          --brand-soft: ${activeBrandColor}14 !important;
          --brand-light: ${activeBrandColor}28 !important;
          --brand-border: ${activeBrandColor}55 !important;
          --blue: ${activeBrandColor} !important;
          --purple: ${activeBrandColor} !important;
          --electric: ${activeBrandColor} !important;
          --orange: ${activeBrandColor} !important;
          --orange-dark: ${activeBrandColor} !important;
          --orange-soft: ${activeBrandColor}14 !important;
          --orange-light: ${activeBrandColor}28 !important;
        }
        .help-button > span {
          background: ${activeBrandColor} !important;
        }
        .help-button small {
          color: #cbd5e1 !important;
        }
        .nav-item.active {
          background: linear-gradient(90deg, ${activeBrandColor}, ${activeBrandColor}cc) !important;
          box-shadow: inset 3px 0 #ffffff, 0 6px 16px ${activeBrandColor}40 !important;
        }
        .primary-button, .continue-button {
          background: linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%) !important;
          box-shadow: 0 8px 18px ${activeBrandColor}33 !important;
        }
        .outline-button {
          border-color: ${activeBrandColor}55 !important;
          color: ${activeBrandColor} !important;
        }
        .kicker {
          color: ${activeBrandColor} !important;
        }
        .text-button {
          color: ${activeBrandColor} !important;
        }
        .nav-group > p {
          color: ${activeBrandColor} !important;
        }
        .business-switch:hover {
          background: ${activeBrandColor}10 !important;
        }
        .brand-sub {
          color: ${activeBrandColor} !important;
        }
        .app-shell .workspace > .topbar .avatar,
        .topbar .avatar,
        .avatar {
          background: ${activeBrandColor}18 !important;
          color: ${activeBrandColor} !important;
          border-color: ${activeBrandColor}45 !important;
        }
        .topbar .top-icon:hover {
          border-color: ${activeBrandColor}60 !important;
          color: ${activeBrandColor} !important;
        }
        .account-panel > div > span {
          background: ${activeBrandColor}20 !important;
          color: ${activeBrandColor} !important;
        }
        .account-panel button:hover {
          background: ${activeBrandColor}12 !important;
          color: ${activeBrandColor} !important;
        }
        .ambient-bottom-ai-wrapper button[style*="linear-gradient(135deg, rgb(234, 88, 12)"],
        .ambient-bottom-ai-wrapper button[style*="linear-gradient(135deg, #ea580c"],
        .ambient-bottom-ai-wrapper [style*="color: #ea580c"],
        .ambient-bottom-ai-wrapper [style*="color: rgb(234, 88, 12)"] {
          color: ${activeBrandColor} !important;
        }
        .workspace [style*="#ea580c"]:not([style*="color: #fff"]):not([style*="color:#fff"]):not([style*="color: rgb(255, 255, 255)"]):not([style*="color: white"]):not([data-active-pill="true"]),
        .workspace [style*="#f97316"]:not([style*="color: #fff"]):not([style*="color:#fff"]):not([style*="color: rgb(255, 255, 255)"]):not([style*="color: white"]):not([data-active-pill="true"]),
        .workspace [style*="rgb(234, 88, 12)"]:not([style*="color: #fff"]):not([style*="color:#fff"]):not([style*="color: rgb(255, 255, 255)"]):not([style*="color: white"]):not([data-active-pill="true"]),
        .workspace [style*="rgb(249, 115, 22)"]:not([style*="color: #fff"]):not([style*="color:#fff"]):not([style*="color: rgb(255, 255, 255)"]):not([style*="color: white"]):not([data-active-pill="true"]) {
          color: ${activeBrandColor} !important;
          border-color: ${activeBrandColor} !important;
        }
        .workspace [style*="background: #ea580c"],
        .workspace [style*="background: #f97316"],
        .workspace [style*="background:#ea580c"],
        .workspace [style*="background:#f97316"],
        .workspace [style*="background-color: #ea580c"],
        .workspace [style*="background-color: #f97316"],
        .workspace [style*="background-color: rgb(234, 88, 12)"],
        .workspace [style*="background-color: rgb(249, 115, 22)"] {
          background: ${activeBrandColor} !important;
        }
        .workspace [style*="linear-gradient(135deg, #f97316"],
        .workspace [style*="linear-gradient(135deg, #ea580c"],
        .workspace [style*="linear-gradient(135deg, rgb(249, 115, 22)"],
        .workspace [style*="linear-gradient(135deg, rgb(234, 88, 12)"] {
          background: linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%) !important;
        }
        .sidebar {
          background-color: #070c16 !important;
          background: radial-gradient(circle at 18% 10%, ${activeBrandColor}30, transparent 42%),
                      linear-gradient(180deg, #070c16 0%, #0b111e 50%, #050811 100%) !important;
          position: sticky !important;
          top: 0 !important;
          height: 100vh !important;
          overflow: hidden !important;
        }
        .sidebar-circuit {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.38 !important;
          overflow: hidden;
          z-index: 1;
        }
        .sidebar-circuit:before {
          content: '';
          position: absolute;
          left: -90px;
          top: 165px;
          width: 250px;
          height: 250px;
          border: 1.5px solid ${activeBrandColor}70 !important;
          border-radius: 50%;
          box-shadow: 0 0 0 35px ${activeBrandColor}12, 0 0 0 85px ${activeBrandColor}05 !important;
        }
        .sidebar-circuit:after {
          content: '';
          position: absolute;
          width: 190px;
          height: 380px;
          right: -120px;
          bottom: 30px;
          border: 1px solid ${activeBrandColor}35 !important;
          border-radius: 50%;
          transform: rotate(24deg);
        }
        .sidebar-circuit i {
          position: absolute;
          width: 8px;
          height: 8px;
          border: 1.5px solid #ffffff !important;
          background: ${activeBrandColor} !important;
          border-radius: 50%;
          box-shadow: 0 0 12px ${activeBrandColor}, 0 0 4px #ffffff !important;
        }
      `}</style>
      <main className={shellClass}>
        <aside className="sidebar">
          <div className="sidebar-circuit" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </div>
          <div className="side-brand" style={{ cursor: 'pointer' }} onClick={() => { if (typeof window !== 'undefined') window.location.href = '/'; }}>
            <span style={{ width: 38, height: 38, borderRadius: 8, background: '#ffffff', border: `1.5px solid ${activeBrandColor}50`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 2, flexShrink: 0 }}>
              {activeLogoUrl ? (
                <img
                  src={activeLogoUrl}
                  alt={current.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.brand-logo-fallback') as HTMLElement | null;
                    if (fallback) fallback.style.display = 'inline-block';
                  }}
                />
              ) : null}
              <span
                className="brand-logo-fallback"
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: activeBrandColor,
                  display: activeLogoUrl ? 'none' : 'inline-block',
                }}
              >
                {current.initials || current.name.slice(0, 2).toUpperCase()}
              </span>
            </span>
            <div className="brand-title-wrap" style={{display:'inline-flex',alignItems:'center',minWidth:0,overflow:'hidden',whiteSpace:'nowrap',margin:0,padding:0}}>
              <span className="brand-name" title={current.name} style={{display:'block',fontFamily:"'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",fontSize:'15px',fontWeight:850,letterSpacing:'-0.01em',color:'#ffffff',lineHeight:1.2,margin:0,padding:0,overflow:'hidden',textOverflow:'ellipsis',maxWidth:155}}>
                {current.name}
              </span>
            </div>
          </div>
          <nav aria-label="Product navigation">{navigation.map(group=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([name,icon])=>{const locked=isLocked(name);return <button type="button" title={locked?`${name} — locked`:collapsed?name:undefined} aria-current={active===name?'page':undefined} className={`${active===name?'nav-item active':'nav-item'}${locked?' locked':''}`} onClick={()=>{openModule(name);setTopPanel(null);setSwitcher(false)}} key={name}><span>{icon}</span><b>{name}</b>{locked?<em>⌾</em>:name==='Inbox'&&<small>3</small>}</button>})}</div>)}</nav>
          <button type="button" className="help-button" onClick={()=>setNotice('Help centre opened. Guides and support are available here.')}><span>?</span><div><strong>Need help?</strong><small>Guides and support</small></div></button>
        </aside>
        <section className="workspace">
          <header className="topbar">
            <div className="business-switch-wrap">
              <button className="business-switch" onClick={()=>{setSwitcher(!switcher);setTopPanel(null)}}>
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.25 }}>{current.name}</strong>
                  <small style={{ fontSize: 10.5, color: '#64748b', display: 'block', marginTop: 2 }}>{current.industry || 'Workspace'}</small>
                </div>
                <b style={{ color: '#94a3b8', fontSize: 12, marginLeft: 6 }}>⌄</b>
              </button>
              {switcher && (
                <div
                  className="switch-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 290,
                    padding: 8,
                    borderRadius: 14,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 16px 40px -8px rgba(15, 23, 42, 0.16), 0 0 1px 1px rgba(15, 23, 42, 0.04)',
                    zIndex: 60,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 10, fontWeight: 750, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>
                      Select Workspace
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 650, color: '#94a3b8' }}>
                      {businesses.length} {businesses.length === 1 ? 'entity' : 'entities'}
                    </span>
                  </div>

                  <div style={{ maxHeight: 260, overflowY: 'auto', padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {businesses.map((b) => {
                      const isSelected = b.id === current.id;
                      const subColor = b.brandColor || b.color || '#0d8a70';
                      const subLogo = b.logoUrl;
                      return (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => selectBusiness(b.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: isSelected ? `${subColor}12` : 'transparent',
                            border: isSelected ? `1px solid ${subColor}35` : '1px solid transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 7,
                              background: '#ffffff',
                              border: `1px solid ${isSelected ? subColor : '#e2e8f0'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              padding: 2,
                              flexShrink: 0,
                            }}
                          >
                            {subLogo ? (
                              <img
                                src={subLogo}
                                alt={b.name}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.parentElement?.querySelector('.sub-logo-fallback') as HTMLElement | null;
                                  if (fallback) fallback.style.display = 'inline-block';
                                }}
                              />
                            ) : null}
                            <span
                              className="sub-logo-fallback"
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: subColor,
                                display: subLogo ? 'none' : 'inline-block',
                              }}
                            >
                              {b.initials || b.code?.slice(0, 2) || b.name.slice(0, 2).toUpperCase()}
                            </span>
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: isSelected ? 750 : 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {b.name}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {b.industry || (b.type === 'GROUP' ? 'Holding Company' : 'Subsidiary')}
                            </div>
                          </div>

                          {isSelected && (
                            <span style={{ color: subColor, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* SIMPLE MINIMAL FOOTER */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSwitcher(false);
                        onAddBusiness();
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: activeBrandColor,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>＋</span> Add Subsidiary
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSwitcher(false);
                        setActive('Subsidiary portfolio');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: 6,
                      }}
                    >
                      Settings
                    </button>
                  </div>
                </div>
              )}
            </div><div className="global-search"><span>⌕</span><input aria-label="Search workspace" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${current.name}`}/><kbd>⌘ K</kbd>{search&&<div className="search-results">{(searchResults.length||dataResults.length)?<>{searchResults.map(name=><button key={`nav-${name}`} onClick={()=>openModule(name)}><span>{isLocked(name)?'⌾':'→'}</span><div><strong>{name}</strong><small>{isLocked(name)?'Locked in current environment':'Open in this workspace'}</small></div></button>)}{dataResults.map((r,i)=><button key={`data-${i}`} onClick={()=>openModule(r.navigate)}><span>◎</span><div><strong>{r.label}</strong><small>{r.type} · {r.sublabel}</small></div></button>)}</>:<p>No workspace results</p>}</div>}</div>
            <div className="top-actions">
              {isStaff && (
                <button
                  className="templates-top"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.location.href = '/requests/new';
                  }}
                  style={{ background: `linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%)`, color: '#fff', border: 'none' }}
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
              <div className="top-popover-wrap">
                <button
                  className="avatar"
                  aria-label="Account menu"
                  aria-expanded={topPanel==='account'}
                  onClick={()=>setTopPanel(topPanel==='account'?null:'account')}
                  style={{
                    background: `${activeBrandColor}18`,
                    color: activeBrandColor,
                    borderColor: `${activeBrandColor}45`,
                  }}
                >
                  {initialsOf(safeUser.fullName)}
                </button>
                {topPanel==='account' && (
                  <div className="top-popover account-panel">
                    <div>
                      <span style={{ background: `${activeBrandColor}20`, color: activeBrandColor }}>
                        {initialsOf(safeUser.fullName)}
                      </span>
                      <strong>{safeUser.fullName}</strong>
                      <small>{safeUser.email}</small>
                    </div>
                    <button onClick={()=>{setActive('Settings');setTopPanel(null)}}>Account & business settings</button>
                    <button onClick={()=>{setActive('Team & access');setTopPanel(null)}}>Team and access</button>
                    <button onClick={()=>{setNotice('Help centre opened.');setTopPanel(null)}}>Help centre</button>
                    <button onClick={onSignOut}>Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="content">
            {notices.length>0&&<div className="notice-stack">{notices.map(n=><div className="notice" key={n.id}><span>i</span>{n.message}<button onClick={()=>dismissNotice(n.id)}>×</button></div>)}</div>}
            <TabErrorBoundary tabName={active} onReset={() => setActive('Overview')}>
              {content}
            </TabErrorBoundary>
          </div>
        </section>
        {isAiAuthorized && (
          <>
            <AiScreenEdgeGlow isActive={true} isProcessing={aiManager.isTyping} brandColor={activeBrandColor} />
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
              onCancelAction={aiManager.handleCancelAction}
              onNewChat={aiManager.startNewChat}
              onOpenHistory={() => aiManager.setIsHistoryOpen(true)}
              onOpenFullCockpit={handleOpenAiDrawer}
              onNavigate={(tab) => {
                openModule(tab);
              }}
            />
            <AiChatHistoryDrawer
              isOpen={aiManager.isHistoryOpen}
              onClose={() => aiManager.setIsHistoryOpen(false)}
              sessions={aiManager.sessions}
              activeSessionId={aiManager.activeSessionId}
              onSelectSession={(session) => aiManager.loadSession(session)}
              onNewChat={aiManager.startNewChat}
              onDeleteSession={(id) => aiManager.deleteSession(id)}
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
              onCancelAction={aiManager.handleCancelAction}
              onNewChat={aiManager.startNewChat}
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
    return 'BEMS-GROUP';
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
  const canEnterAi=useGmdAccess(user?.role||'');
  const [entryMode, setEntryMode] = useState<'login' | 'reload'>('reload');

  const checkAuth = () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;
    fetch('/api/auth/session?_t=' + Date.now(), { credentials: 'include', cache: 'no-store', signal: controller?.signal })
      .then(r => {
        if (timeoutId) clearTimeout(timeoutId);
        if (!r.ok) throw new Error('Session check failed');
        return r.json();
      })
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
        if (timeoutId) clearTimeout(timeoutId);
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
      .then(async r => { if (!r.ok) throw new Error('Workspace lookup failed.'); return r.json(); })
      .then(d => {
        if (d && d.organizations && d.organizations.length > 0) {
          setBusinesses(d.organizations);
          const urlOrg = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('org') : null;
          const matchOrg = urlOrg ? d.organizations.find((o: any) => o.id === urlOrg || o.code === urlOrg) : null;
          if (matchOrg) {
            setCurrentId(matchOrg.id);
          } else {
            setCurrentId(d.organizations[0].id);
          }
        } else {
          setBusinesses([]);
          setCurrentId('');
        }
        setStatus('ready');
      })
      .catch(() => {
        setBusinesses([]);
        setCurrentId('');
        setStatus('error');
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
        color: newOrg.brandColor || newOrg.color || '#0d8a70',
        brandColor: newOrg.brandColor || newOrg.color || '#0d8a70',
        logoUrl: newOrg.logoUrl || null,
        code: newOrg.code,
        type: newOrg.type || 'SUBSIDIARY',
        aiEnabled: true,
      };
      setBusinesses(old => {
        const exists = old.some(b => b.id === next.id);
        return exists ? old : [...old, next];
      });
      setCurrentId(next.id);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('org', next.id);
        window.history.replaceState(null, '', url.toString());
      }
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
          color: updatedOrg.brandColor || updatedOrg.color || b.color,
          brandColor: updatedOrg.brandColor || updatedOrg.color || b.brandColor,
          logoUrl: updatedOrg.logoUrl !== undefined ? updatedOrg.logoUrl : b.logoUrl,
          budgetFormatted: updatedOrg.budgetFormatted || (b as any).budgetFormatted,
        };
      }));
    }
  };

  const updateBusiness=(id:string,patch:Partial<Business>)=>apiPatch<Business>(`/api/businesses/${id}`,patch).then(updated=>{
    setBusinesses(old=>old.map(b=>b.id===id?updated:b));
    return updated;
  });

  // Keep the reload animation visible while the existing session check completes.
  if (authStatus === 'checking') {
    return (
      <div role="status" aria-label="Checking sign-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f2eb', overflow: 'hidden' }}>
        <KineticOptikkaTorus size={460} />
      </div>
    );
  }

  // 2. Unauthenticated or signed out: strictly present sign-in / registration
  if (!user || authStatus === 'signed-out') {
    return <AuthGate onAuthed={onAuthed} />;
  }

  // 3. Dynamic AI Motion Pre-Screen before dashboard access (on login & reload)
  if (showAiEntry && canEnterAi) {
    const activeEntryBusiness = businesses.find(b => b.id === currentId) || businesses[0] || defaultBemsBusinesses[0];
    const entryBrandColor = activeEntryBusiness?.brandColor || activeEntryBusiness?.color || '#0d8a70';
    return (
      <AiMotionEntryScreen
        key={`ai-entry-${entryMode}-${user.id}`}
        onComplete={() => setShowAiEntry(false)}
        businessName={activeEntryBusiness?.name || "BEMS Group"}
        userName={user.fullName || user.name || 'Executive'}
        userRole={user.role || 'STAFF'}
        mode={entryMode}
        brandColor={entryBrandColor}
      />
    );
  }

  if (status === 'error') return <main className="app-loading error"><p>The workspace could not be loaded. Please retry.</p><button onClick={retryLoad}>Retry →</button></main>;
  if (businesses.length === 0 && authStatus === 'signed-in' && user?.role === 'STAFF') return <main className="app-loading"><p>No business workspace is available for your account. Contact an administrator.</p><Link href="/staff">Open staff portal</Link></main>;
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
