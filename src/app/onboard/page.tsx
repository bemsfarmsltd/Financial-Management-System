'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Building2,
  Lock,
  User,
  Phone,
  CreditCard,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';

interface InvitationDetails {
  id: string;
  workEmail: string;
  role: string;
  subsidiaryId: string;
  subsidiaryName: string;
  departmentId?: string;
  departmentName?: string;
  positionName?: string;
  expiresAt: string;
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

  // Form State
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('MALE');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [cityState, setCityState] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate invitation token on mount
  useEffect(() => {
    if (!token) {
      setError('An invitation token is required. Please check the link in your invitation email.');
      setIsLoading(false);
      return;
    }

    fetch(`/api/staff/invite?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid) {
          setError(data.error || 'This invitation is invalid or has expired.');
        } else {
          setInvitation(data.invitation);
        }
      })
      .catch((err) => {
        console.error('Failed to validate token:', err);
        setError('Could not verify your invitation link. Please check your internet connection and try again.');
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 10) {
      setSubmitError('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/staff/onboard/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          legalName: legalName.trim(),
          phone: phone.trim(),
          gender,
          residentialAddress: residentialAddress.trim(),
          cityState: cityState.trim(),
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim() || legalName.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Failed to complete onboarding. Please try again.');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1800);
    } catch (err) {
      console.error('Submission error:', err);
      setSubmitError('An unexpected network error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #fed7aa', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Verifying Corporate Invitation...</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Connecting to BEMS Group Governance Portal</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20 }}>
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #fee2e2', padding: '36px 32px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#dc2626' }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>Invalid Invitation Link</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5, margin: '0 0 24px' }}>{error}</p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              background: '#0f172a',
              color: '#ffffff',
              padding: '11px 24px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Go to Sign-in Portal →
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20 }}>
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #bbf7d0', padding: '40px 32px', maxWidth: 500, width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: '#16a34a' }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Welcome, {legalName}!</h2>
          <p style={{ fontSize: 14.5, color: '#166534', fontWeight: 600, margin: '0 0 16px' }}>
            Your executive account is active and provisioned as {invitation.role}.
          </p>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Redirecting you directly to the Executive Command Cockpit...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 680 }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <img src="/bems-group-logo.png?v=20261024" alt="BEMS Group" width={42} height={42} style={{ borderRadius: 8 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase', color: '#0f172a' }}>
              BEMS GROUP
            </h1>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>
              FINANCIAL MANAGEMENT &amp; GOVERNANCE PORTAL
            </p>
          </div>
        </div>

        {/* Invitation Summary Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            border: '1px solid #fed7aa',
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 24,
            boxShadow: '0 4px 15px rgba(234, 88, 12, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            <ShieldCheck size={14} />
            <span>EXECUTIVE &amp; GOVERNANCE ROLE PROVISIONING</span>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 800, color: '#0f172a' }}>
            Activate Your Executive Profile
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#475569', marginTop: 10 }}>
            <div>
              <span style={{ color: '#94a3b8' }}>Work Email: </span>
              <strong style={{ color: '#0f172a' }}>{invitation.workEmail}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Assigned Role: </span>
              <span style={{ background: '#ea580c', color: '#ffffff', padding: '1px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11.5 }}>
                {invitation.role}
              </span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Entity: </span>
              <strong style={{ color: '#0f172a' }}>{invitation.subsidiaryName}</strong>
            </div>
            {invitation.departmentName && (
              <div>
                <span style={{ color: '#94a3b8' }}>Department: </span>
                <strong style={{ color: '#0f172a' }}>{invitation.departmentName}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Main Onboarding Form */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '32px 36px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Complete Your Dossier</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              Please enter your personal contact and banking credentials. You will use the password you set below to sign in.
            </p>
          </div>

          {submitError && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 20, fontSize: 13 }}>
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Full Legal Name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                Full Legal Name *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  required
                  type="text"
                  placeholder="e.g. Dr. Pastra Adeleke"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                />
                <User size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
              </div>
            </div>

            {/* Phone & Gender */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                  Phone Number *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    required
                    type="tel"
                    placeholder="+234 803 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#ffffff', boxSizing: 'border-box' }}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Residential Location */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                  Residential Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Street address"
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <MapPin size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                  City &amp; State
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lagos State"
                  value={cityState}
                  onChange={(e) => setCityState(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Banking Details (For Compensation / Requisitions) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                <CreditCard size={15} color="#ea580c" />
                <span>DISBURSEMENT &amp; SALARY SETTLEMENT BANK ACCOUNT</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Access Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box', background: '#ffffff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    Account Number (10 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="0123456789"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box', background: '#ffffff', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Account Holder Name
                </label>
                <input
                  type="text"
                  placeholder="As verified on your bank record"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box', background: '#ffffff' }}
                />
              </div>
            </div>

            {/* Create Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                  Create Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    minLength={10}
                    placeholder="Min 10 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 40px 10px 38px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                  Confirm Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    minLength={10}
                    placeholder="Re-type password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ marginTop: 10 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '13px 24px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: submitting ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 8px 20px rgba(234, 88, 12, 0.35)',
                  opacity: submitting ? 0.75 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{submitting ? 'Creating Account & Setting Session...' : 'Complete Onboarding & Enter Portal'}</span>
                {!submitting && <ArrowRight size={16} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <p style={{ color: '#64748b', fontSize: 14 }}>Loading BEMS Onboarding...</p>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
