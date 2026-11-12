'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { NIGERIAN_STATES, NIGERIAN_STATE_LGAS, RESIDENTIAL_CITIES_AND_STATES } from '@/lib/nigeriaGeoData';

const API_BASE = '';

async function authRequest<T>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(path, {
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

export type AuthUser = { id: string; email: string; fullName: string; phone: string; emailVerified: boolean; role: string; name?: string; avatarUrl?: string };

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
        setOptions(prev => ({
          ...prev,
          organizations: d.organizations || prev.organizations || [],
          departments: d.departments || prev.departments || [],
          banks: (d.banks && d.banks.length > 0) ? d.banks : prev.banks,
          maritalStatuses: (d.maritalStatuses && d.maritalStatuses.length > 0) ? d.maritalStatuses : prev.maritalStatuses,
          educationLevels: (d.educationLevels && d.educationLevels.length > 0) ? d.educationLevels : prev.educationLevels,
          workLocations: (d.workLocations && d.workLocations.length > 0) ? d.workLocations : prev.workLocations,
          staffGrades: (d.staffGrades && d.staffGrades.length > 0) ? d.staffGrades : prev.staffGrades,
          employmentTypes: (d.employmentTypes && d.employmentTypes.length > 0) ? d.employmentTypes : prev.employmentTypes,
        }));
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

  const filteredDepartments = (options?.departments || []).filter(d => !signupForm.subsidiaryId || d.organizationId === signupForm.subsidiaryId);

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

      {view==='login' && (
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <a
            href="/download"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: '#ea580c',
              textDecoration: 'none',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              padding: '6px 14px',
              borderRadius: 8,
            }}
          >
            <span>📱 Download BEMS Mobile App (Android APK) →</span>
          </a>
        </div>
      )}
      {view==='login' && bootstrapAvailable && <p className="signin-note"><button onClick={()=>{setError('');setView('setup')}}>Set up the first System Admin</button></p>}
      {view==='login' && !adminExists && !bootstrapConfigured && <p className="signin-note">First-time setup needs <code>BEMS_BOOTSTRAP_SECRET</code> in <code>.env.local</code>.</p>}
    </section>
  </main>;
}


export function UnifiedAuthScreen({ redirectUrl, onAuthed }: { redirectUrl?: string; onAuthed?: (user: AuthUser) => void }) {
  const handleAuthed = (user: AuthUser) => {
    try {
      sessionStorage.setItem('bems_show_welcome', '1');
      sessionStorage.setItem('bems_entry_mode', 'login');
      sessionStorage.removeItem('bems_welcome_shown_session');
    } catch {}
    if (onAuthed) {
      onAuthed(user);
      return;
    }
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const target = redirectUrl || sp.get('redirect') || '/';
      window.location.href = target;
    }
  };

  return <AuthGate onAuthed={handleAuthed} />;
}
