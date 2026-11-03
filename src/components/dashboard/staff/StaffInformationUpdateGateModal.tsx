'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  User,
  CreditCard,
  Building,
  Users,
  MapPin,
  GraduationCap,
} from 'lucide-react';

export interface PendingUpdateInfo {
  id: string;
  instructions: string | null;
  requestedFields: string[];
  requestedBy: string;
  createdAt: string;
}

export interface CurrentEmployeeData {
  id: string;
  legalName: string;
  avatarUrl: string | null;
  phone: string | null;
  nin: string | null;
  bvn?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  salaryBankName?: string | null;
  salaryAccountNumber?: string | null;
  salaryAccountName?: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelationship: string | null;
  nextOfKinAddress: string | null;
  residentialAddress: string | null;
  cityState: string | null;
  maritalStatus: string | null;
  highestEducation: string | null;
  stateOfOrigin: string | null;
  lga: string | null;
  hasPinSet?: boolean;
}

interface Props {
  isOpen: boolean;
  request: PendingUpdateInfo;
  currentData: CurrentEmployeeData | null;
  onSuccess: (updatedEmployee: any) => void;
}

export function StaffInformationUpdateGateModal({
  isOpen,
  request,
  currentData,
  onSuccess,
}: Props) {
  const [avatarUrl, setAvatarUrl] = useState(currentData?.avatarUrl || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [nin, setNin] = useState(currentData?.nin || '');
  const [bvn, setBvn] = useState(currentData?.bvn || '');
  const [phone, setPhone] = useState(currentData?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(currentData?.dateOfBirth || '');
  const [gender, setGender] = useState(currentData?.gender || 'MALE');

  const [bankName, setBankName] = useState(currentData?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(currentData?.accountNumber || '');
  const [accountName, setAccountName] = useState(currentData?.accountName || '');
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [bankVerifyMsg, setBankVerifyMsg] = useState<string | null>(null);

  const [salaryBankName, setSalaryBankName] = useState(currentData?.salaryBankName || '');
  const [salaryAccountNumber, setSalaryAccountNumber] = useState(currentData?.salaryAccountNumber || '');
  const [salaryAccountName, setSalaryAccountName] = useState(currentData?.salaryAccountName || '');

  const [nextOfKinName, setNextOfKinName] = useState(currentData?.nextOfKinName || '');
  const [nextOfKinPhone, setNextOfKinPhone] = useState(currentData?.nextOfKinPhone || '');
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState(currentData?.nextOfKinRelationship || 'SPOUSE');
  const [nextOfKinAddress, setNextOfKinAddress] = useState(currentData?.nextOfKinAddress || '');

  const [residentialAddress, setResidentialAddress] = useState(currentData?.residentialAddress || '');
  const [cityState, setCityState] = useState(currentData?.cityState || '');

  const [maritalStatus, setMaritalStatus] = useState(currentData?.maritalStatus || 'SINGLE');
  const [highestEducation, setHighestEducation] = useState(currentData?.highestEducation || 'BACHELORS');
  const [stateOfOrigin, setStateOfOrigin] = useState(currentData?.stateOfOrigin || '');
  const [lga, setLga] = useState(currentData?.lga || '');

  const [securityPin, setSecurityPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = request.requestedFields || [];

  // Bank Auto-Verification
  useEffect(() => {
    const clean = accountNumber.replace(/\D/g, '');
    if (fields.includes('bankDetails') && clean.length === 10 && bankName.trim()) {
      setVerifyingBank(true);
      setBankVerifyMsg(null);
      fetch('/api/banking/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: clean, bankName }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.isValid && d.accountName) {
            setAccountName(d.accountName);
            setBankVerifyMsg(`✓ Verified: ${d.accountName}`);
          } else {
            setBankVerifyMsg('Could not verify account name. You may input it manually.');
          }
        })
        .catch(() => {
          setBankVerifyMsg(null);
        })
        .finally(() => setVerifyingBank(false));
    }
  }, [accountNumber, bankName, fields]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setAvatarUrl(data.url);
    } catch (err: any) {
      setError(err.message || 'Could not upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations based on requested fields
    if (fields.includes('avatarUrl') && (!avatarUrl || (!avatarUrl.startsWith('http') && !avatarUrl.startsWith('/')))) {
      setError('Please upload your official passport photograph before proceeding.');
      return;
    }

    if (fields.includes('nin')) {
      const cleanNin = nin.replace(/\D/g, '');
      if (cleanNin.length !== 11) {
        setError('National Identity Number (NIN) must be exactly 11 digits.');
        return;
      }
    }

    if (fields.includes('bvn')) {
      const cleanBvn = bvn.replace(/\D/g, '');
      if (cleanBvn.length !== 11) {
        setError('Bank Verification Number (BVN) must be exactly 11 digits.');
        return;
      }
    }

    if ((fields.includes('bankName') || fields.includes('bankDetails')) && !bankName.trim()) {
      setError('Please provide your disbursement bank name.');
      return;
    }

    if ((fields.includes('accountNumber') || fields.includes('bankDetails'))) {
      const cleanAcc = accountNumber.replace(/\D/g, '');
      if (cleanAcc.length !== 10) {
        setError('Disbursement bank account number must be 10 digits.');
        return;
      }
    }

    if ((fields.includes('accountName') || fields.includes('bankDetails')) && !accountName.trim()) {
      setError('Please provide the disbursement account holder name.');
      return;
    }

    if (fields.includes('salaryAccountNumber')) {
      const cleanAcc = salaryAccountNumber.replace(/\D/g, '');
      if (cleanAcc.length !== 10) {
        setError('Dedicated salary account number must be 10 digits.');
        return;
      }
    }

    if ((fields.includes('nextOfKin') || fields.includes('nextOfKinName')) && !nextOfKinName.trim()) {
      setError('Please provide Next of Kin legal name.');
      return;
    }

    if ((fields.includes('nextOfKin') || fields.includes('nextOfKinPhone')) && !nextOfKinPhone.trim()) {
      setError('Please provide Next of Kin phone number.');
      return;
    }

    if (fields.includes('securityPin')) {
      if (!/^\d{4}$/.test(securityPin)) {
        setError('Security PIN must be exactly 4 numeric digits.');
        return;
      }
      if (securityPin !== confirmPin) {
        setError('Security PIN and Confirm PIN do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const updates: any = {};
      if (fields.includes('avatarUrl')) updates.avatarUrl = avatarUrl;
      if (fields.includes('nin')) updates.nin = nin.replace(/\D/g, '');
      if (fields.includes('bvn')) updates.bvn = bvn.replace(/\D/g, '');
      if (fields.includes('phone')) updates.phone = phone.trim();

      if (fields.includes('bankName') || fields.includes('bankDetails')) updates.bankName = bankName.trim();
      if (fields.includes('accountNumber') || fields.includes('bankDetails')) updates.accountNumber = accountNumber.replace(/\D/g, '');
      if (fields.includes('accountName') || fields.includes('bankDetails')) updates.accountName = accountName.trim();

      if (fields.includes('salaryBankName')) updates.salaryBankName = salaryBankName.trim();
      if (fields.includes('salaryAccountNumber')) updates.salaryAccountNumber = salaryAccountNumber.replace(/\D/g, '');
      if (fields.includes('salaryAccountName')) updates.salaryAccountName = salaryAccountName.trim();

      if (fields.includes('nextOfKinName') || fields.includes('nextOfKin')) updates.nextOfKinName = nextOfKinName.trim();
      if (fields.includes('nextOfKinPhone') || fields.includes('nextOfKin')) updates.nextOfKinPhone = nextOfKinPhone.trim();
      if (fields.includes('nextOfKinRelationship') || fields.includes('nextOfKin')) updates.nextOfKinRelationship = nextOfKinRelationship;
      if (fields.includes('nextOfKinAddress') || fields.includes('nextOfKin')) updates.nextOfKinAddress = nextOfKinAddress.trim();

      if (fields.includes('residentialAddress')) updates.residentialAddress = residentialAddress.trim();
      if (fields.includes('cityState')) updates.cityState = cityState.trim();

      if (fields.includes('maritalStatus') || fields.includes('demographics')) updates.maritalStatus = maritalStatus;
      if (fields.includes('highestEducation') || fields.includes('demographics')) updates.highestEducation = highestEducation;
      if (fields.includes('stateOfOrigin') || fields.includes('demographics')) updates.stateOfOrigin = stateOfOrigin.trim();
      if (fields.includes('lga') || fields.includes('demographics')) updates.lga = lga.trim();
      if (fields.includes('dateOfBirth')) updates.dateOfBirth = dateOfBirth;
      if (fields.includes('gender')) updates.gender = gender;

      if (fields.includes('securityPin')) updates.securityPin = securityPin;

      const res = await fetch('/api/staff/profile/submit-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          updates,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit updates.');

      onSuccess(data.employee);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving your updates.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          maxWidth: 620,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
            padding: '20px 24px',
            color: '#ffffff',
            position: 'relative',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            <ShieldCheck size={14} /> Action Required · Compliance Gate
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Update Your Staff Profile Records
          </h2>
          <p style={{ fontSize: 13, opacity: 0.9, margin: 0, lineHeight: 1.4 }}>
            Administrator <strong>{request.requestedBy}</strong> has requested that you verify and update the records below before continuing to your workspace.
          </p>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Admin Instructions Banner */}
          {request.instructions && (
            <div
              style={{
                background: '#fff7ed',
                border: '1.5px solid #fed7aa',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={18} color="#ea580c" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Administrator Note:
                </div>
                <div style={{ fontSize: 13, color: '#9a3412', marginTop: 2, lineHeight: 1.45 }}>
                  {request.instructions}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* 1. Passport Photograph */}
          {fields.includes('avatarUrl') && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Camera size={16} color="#ea580c" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Official Passport Photograph
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 16,
                    background: '#e2e8f0',
                    border: '2px solid #cbd5e1',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Passport preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={36} color="#94a3b8" />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#ea580c',
                      color: '#ffffff',
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Upload size={14} />
                    <span>{uploadingAvatar ? 'Uploading...' : 'Upload Passport Photo'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      disabled={uploadingAvatar}
                      onChange={handleAvatarUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <p style={{ fontSize: 11.5, color: '#64748b', margin: '6px 0 0' }}>
                    Square portrait photograph with white or light neutral background (JPG, PNG, WebP).
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 2. National Identity Number (NIN) */}
          {fields.includes('nin') && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ShieldCheck size={16} color="#2563eb" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  National Identity Number (NIN)
                </h4>
              </div>
              <input
                type="text"
                maxLength={11}
                value={nin}
                onChange={(e) => setNin(e.target.value.replace(/\D/g, ''))}
                placeholder="11-digit national identity number"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                }}
              />
              <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, display: 'block' }}>
                Enter your 11-digit NIN as issued by NIMC.
              </span>
            </section>
          )}

          {/* BVN */}
          {fields.includes('bvn') && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ShieldCheck size={16} color="#0284c7" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Bank Verification Number (BVN)
                </h4>
              </div>
              <input
                type="text"
                maxLength={11}
                value={bvn}
                onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))}
                placeholder="11-digit bank verification number"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                }}
              />
              <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, display: 'block' }}>
                Enter your 11-digit BVN linked to your Nigerian banking records.
              </span>
            </section>
          )}

          {/* Personal Mobile Phone Number */}
          {fields.includes('phone') && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <User size={16} color="#0284c7" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Personal Mobile Phone Number
                </h4>
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08012345678 or +234..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
              />
            </section>
          )}

          {/* Disbursement Banking */}
          {(fields.includes('bankDetails') || fields.includes('bankName') || fields.includes('accountNumber') || fields.includes('accountName')) && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CreditCard size={16} color="#059669" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Disbursement Bank Account (Expenses & Advances)
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(fields.includes('bankDetails') || fields.includes('bankName')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Access Bank, GTBank, Zenith"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                )}
                {(fields.includes('bankDetails') || fields.includes('accountNumber')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Account Number (10 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="0123456789"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                    />
                  </div>
                )}
              </div>
              {(fields.includes('bankDetails') || fields.includes('accountName')) && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Official registered name on bank account"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#ffffff' }}
                  />
                  {verifyingBank && <span style={{ fontSize: 11, color: '#2563eb', display: 'block', marginTop: 4 }}>Verifying account with NIBSS...</span>}
                  {bankVerifyMsg && <span style={{ fontSize: 11, color: bankVerifyMsg.startsWith('✓') ? '#16a34a' : '#d97706', display: 'block', marginTop: 4, fontWeight: 600 }}>{bankVerifyMsg}</span>}
                </div>
              )}
            </section>
          )}

          {/* Salary Banking */}
          {(fields.includes('salaryBankName') || fields.includes('salaryAccountNumber') || fields.includes('salaryAccountName')) && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Building size={16} color="#059669" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Dedicated Salary Bank Account (Payroll)
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {fields.includes('salaryBankName') && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Salary Bank Name
                    </label>
                    <input
                      type="text"
                      value={salaryBankName}
                      onChange={(e) => setSalaryBankName(e.target.value)}
                      placeholder="e.g. Stanbic IBTC, First Bank"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                )}
                {fields.includes('salaryAccountNumber') && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Salary Account Number (10 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={salaryAccountNumber}
                      onChange={(e) => setSalaryAccountNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="0123456789"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                    />
                  </div>
                )}
              </div>
              {fields.includes('salaryAccountName') && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Salary Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={salaryAccountName}
                    onChange={(e) => setSalaryAccountName(e.target.value)}
                    placeholder="Official registered name on salary account"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#ffffff' }}
                  />
                </div>
              )}
            </section>
          )}

          {/* Next of Kin Records */}
          {(fields.includes('nextOfKin') || fields.includes('nextOfKinName') || fields.includes('nextOfKinPhone') || fields.includes('nextOfKinRelationship') || fields.includes('nextOfKinAddress')) && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Users size={16} color="#7c3aed" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Next of Kin Emergency Records
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                {(fields.includes('nextOfKin') || fields.includes('nextOfKinName')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      value={nextOfKinName}
                      onChange={(e) => setNextOfKinName(e.target.value)}
                      placeholder="Next of Kin Full Name"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                )}
                {(fields.includes('nextOfKin') || fields.includes('nextOfKinPhone')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Telephone Number
                    </label>
                    <input
                      type="text"
                      value={nextOfKinPhone}
                      onChange={(e) => setNextOfKinPhone(e.target.value)}
                      placeholder="08012345678"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12, marginTop: 10 }}>
                {(fields.includes('nextOfKin') || fields.includes('nextOfKinRelationship')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Relationship
                    </label>
                    <select
                      value={nextOfKinRelationship}
                      onChange={(e) => setNextOfKinRelationship(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff' }}
                    >
                      <option value="SPOUSE">Spouse</option>
                      <option value="PARENT">Parent</option>
                      <option value="SIBLING">Sibling</option>
                      <option value="CHILD">Child</option>
                      <option value="NEXT_OF_KIN">Next of Kin / Relative</option>
                    </select>
                  </div>
                )}
                {(fields.includes('nextOfKin') || fields.includes('nextOfKinAddress')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Residential Address
                    </label>
                    <input
                      type="text"
                      value={nextOfKinAddress}
                      onChange={(e) => setNextOfKinAddress(e.target.value)}
                      placeholder="Next of kin residential address"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Residential Address */}
          {(fields.includes('residentialAddress') || fields.includes('cityState')) && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <MapPin size={16} color="#d97706" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Physical Residential Address
                </h4>
              </div>
              {fields.includes('residentialAddress') && (
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    placeholder="e.g. 14 Admiralty Way, Lekki Phase 1"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              )}
              {fields.includes('cityState') && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    City & State
                  </label>
                  <input
                    type="text"
                    value={cityState}
                    onChange={(e) => setCityState(e.target.value)}
                    placeholder="e.g. Lagos, Lagos State"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              )}
            </section>
          )}

          {/* Statutory Demographics */}
          {(fields.includes('demographics') || fields.includes('maritalStatus') || fields.includes('highestEducation') || fields.includes('stateOfOrigin') || fields.includes('lga') || fields.includes('dateOfBirth') || fields.includes('gender')) && (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <GraduationCap size={16} color="#0284c7" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Statutory Demographics & Records
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(fields.includes('demographics') || fields.includes('maritalStatus')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Marital Status
                    </label>
                    <select
                      value={maritalStatus}
                      onChange={(e) => setMaritalStatus(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff' }}
                    >
                      <option value="SINGLE">Single</option>
                      <option value="MARRIED">Married</option>
                      <option value="DIVORCED">Divorced</option>
                      <option value="WIDOWED">Widowed</option>
                    </select>
                  </div>
                )}
                {(fields.includes('demographics') || fields.includes('highestEducation')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Highest Education
                    </label>
                    <select
                      value={highestEducation}
                      onChange={(e) => setHighestEducation(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff' }}
                    >
                      <option value="SSCE">SSCE / High School</option>
                      <option value="OND">OND (Ordinary National Diploma)</option>
                      <option value="HND">HND (Higher National Diploma)</option>
                      <option value="BACHELORS">Bachelor's Degree (B.Sc / B.A)</option>
                      <option value="MASTERS">Master's Degree (M.Sc / M.A / MBA)</option>
                      <option value="DOCTORATE">Doctorate (Ph.D)</option>
                    </select>
                  </div>
                )}
                {fields.includes('dateOfBirth') && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff' }}
                    />
                  </div>
                )}
                {fields.includes('gender') && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff' }}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                )}
                {(fields.includes('demographics') || fields.includes('stateOfOrigin')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      State of Origin
                    </label>
                    <input
                      type="text"
                      value={stateOfOrigin}
                      onChange={(e) => setStateOfOrigin(e.target.value)}
                      placeholder="e.g. Edo, Delta, Lagos"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                )}
                {(fields.includes('demographics') || fields.includes('lga')) && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Local Government Area (LGA)
                    </label>
                    <input
                      type="text"
                      value={lga}
                      onChange={(e) => setLga(e.target.value)}
                      placeholder="e.g. Ikeja, Eti-Osa"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 7. Security Quick-Unlock PIN */}
          {fields.includes('securityPin') && (
            <section style={{ border: '1.5px solid #fed7aa', borderRadius: 14, padding: 16, background: '#fffbeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Lock size={16} color="#d97706" />
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#92400e', margin: 0 }}>
                  4-Digit Quick Unlock Security PIN
                </h4>
              </div>
              <p style={{ fontSize: 12, color: '#b45309', margin: '0 0 12px' }}>
                Set a 4-digit numeric code to unlock your workspace quickly without typing your corporate password.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Enter 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={securityPin}
                    onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 18, fontWeight: 800, textAlign: 'center', letterSpacing: '0.4em' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Confirm 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 18, fontWeight: 800, textAlign: 'center', letterSpacing: '0.4em' }}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Action Button */}
          <div style={{ marginTop: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: 12,
                border: 'none',
                background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 800,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
              }}
            >
              {submitting ? 'Saving & Verifying Records...' : 'Save & Continue to Dashboard →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
