'use client';

import React, { useState, useEffect, useRef, FormEvent } from 'react';

export interface CorporateSubsidiaryModalProps {
  onCancel?: () => void;
  onComplete: (org: any) => void;
}

export const CONGLOMERATE_SECTORS = [
  { id: 'TECHNOLOGY', label: 'Technology & Digital Platforms', defaultPrefix: 'BTECH' },
  { id: 'REAL_ESTATE', label: 'Real Estate, Construction & Infrastructure', defaultPrefix: 'BPROP' },
  { id: 'OIL_AND_GAS', label: 'Oil, Gas & Energy Operations', defaultPrefix: 'BENRG' },
  { id: 'AGRO_ALLIED', label: 'Agro-Allied, Food Processing & Commodities', defaultPrefix: 'BAGRO' },
  { id: 'LOGISTICS', label: 'Logistics, Haulage & Supply Chain', defaultPrefix: 'BLOGS' },
  { id: 'FINANCIAL_SERVICES', label: 'Financial Services & Investment Holdings', defaultPrefix: 'BCAP' },
  { id: 'HEALTHCARE', label: 'Healthcare & Life Sciences', defaultPrefix: 'BHLTH' },
  { id: 'HOSPITALITY', label: 'Hospitality, Tourism & Media', defaultPrefix: 'BHOSP' },
  { id: 'GENERAL', label: 'General Enterprise & Holding Operations', defaultPrefix: 'BCORP' },
];

export const DEPARTMENTS_BY_SECTOR: Record<string, string[]> = {
  TECHNOLOGY: [
    'Software Engineering & DevOps',
    'Product Management & UI/UX',
    'QA & Systems Security',
    'Commercial Growth & Sales',
    'Finance & Administration',
    'Customer Success & Technical Support',
  ],
  REAL_ESTATE: [
    'Project Development & Construction',
    'Architecture & Quantity Surveying',
    'Estate & Facility Management',
    'Legal & Land Title Compliance',
    'Commercial Sales & Client Relations',
    'Finance & Accounting',
  ],
  OIL_AND_GAS: [
    'Health, Safety & Environment (HSE)',
    'Terminal & Field Operations',
    'Petroleum Products Trading',
    'Haulage & Fleet Distribution',
    'Metering, Quality & Compliance',
    'Finance & Treasury',
  ],
  AGRO_ALLIED: [
    'Commodity Sourcing & Operations',
    'Processing Plant & Milling',
    'Quality Control & Silo Storage',
    'Procurement & Supply Chain',
    'Regional Distribution',
    'Finance & Administration',
  ],
  LOGISTICS: [
    'Fleet Management & Workshop',
    'Dispatch & Haulage Operations',
    'Warehousing & Inventory Control',
    'Safety, Transit & Tracking',
    'Corporate Accounts & Billing',
    'Finance & Administration',
  ],
  FINANCIAL_SERVICES: [
    'Investment & Portfolio Management',
    'Risk, Audit & Regulatory Compliance',
    'Treasury & Liquidity Operations',
    'Credit Appraisal & Underwriting',
    'Legal & Corporate Governance',
    'Finance & Financial Reporting',
  ],
  HEALTHCARE: [
    'Clinical Operations & Pharmacy',
    'Medical Quality & Regulatory Compliance',
    'Procurement & Cold Chain Supply',
    'Patient Relations & Care',
    'Finance & Administration',
  ],
  HOSPITALITY: [
    'Guest Experience & Front Office',
    'Food & Beverage / Catering',
    'Facility Management & Engineering',
    'Brand Marketing & Events',
    'Finance & Accounting',
  ],
  GENERAL: [
    'General Corporate Operations',
    'Finance & Administration',
    'Procurement & Supply Chain',
    'Human Capital & Talent',
    'Legal & Statutory Compliance',
    'Business Strategy & Expansion',
  ],
};

export const CONGLOMERATE_LOCATIONS = [
  'Lagos — Victoria Island / Ikoyi',
  'Lagos Innovation Hub — Yaba / Lekki',
  'Abuja Corporate Center — Central Business District, FCT',
  'Port Harcourt Energy & Petroleum Corridor — Rivers State',
  'Benin Agro-Industrial Hub — Edo State',
  'Warri Marine & Energy Terminal — Delta State',
  'Kano Regional Distribution Center — Kano State',
  'Ibadan Operations Hub — Oyo State',
  'Asaba Commercial Facility — Delta State',
  'London / International Liaison Office',
  'OTHER',
];

export const BRAND_COLOR_PRESETS = [
  { name: 'Agri Emerald', hex: '#0d8a70' },
  { name: 'BEMS Orange', hex: '#ea580c' },
  { name: 'Tech Sapphire', hex: '#2563eb' },
  { name: 'Violet Digital', hex: '#7c3aed' },
  { name: 'Energy Crimson', hex: '#dc2626' },
  { name: 'Commodities Amber', hex: '#d97706' },
  { name: 'Corporate Obsidian', hex: '#0f172a' },
  { name: 'Logistics Mahogany', hex: '#9a3412' },
  { name: 'Teal Fleet', hex: '#0891b2' },
  { name: 'Rose Luxury', hex: '#e11d48' },
];

export function CorporateSubsidiaryModal({ onCancel, onComplete }: CorporateSubsidiaryModalProps) {
  const [sector, setSector] = useState('TECHNOLOGY');
  const [legalName, setLegalName] = useState('');
  const [code, setCode] = useState('BTECH');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [entityType, setEntityType] = useState('OPERATING_SUBSIDIARY');
  const [rcNumber, setRcNumber] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [location, setLocation] = useState('Lagos — Victoria Island / Ikoyi');
  const [customLocation, setCustomLocation] = useState('');
  const [initialBudget, setInitialBudget] = useState('0');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(DEPARTMENTS_BY_SECTOR.TECHNOLOGY.slice(0, 4));
  const [customDeptInput, setCustomDeptInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Branding & Workspace Theme States
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [brandColor, setBrandColor] = useState('#0d8a70');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Logo image must be smaller than 8MB.');
      return;
    }
    setUploadingLogo(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload logo');
      setLogoUrl(data.url);
    } catch (err: any) {
      setError(err.message || 'Error uploading logo image.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Close modal when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Handle Sector Change -> Update recommended department presets and code prefix
  const handleSectorChange = (newSector: string) => {
    setSector(newSector);
    const presets = DEPARTMENTS_BY_SECTOR[newSector] || DEPARTMENTS_BY_SECTOR.GENERAL;
    setSelectedDepts(presets.slice(0, 4));

    if (!codeManuallyEdited && !legalName.trim()) {
      const sObj = CONGLOMERATE_SECTORS.find((s) => s.id === newSector);
      if (sObj) setCode(sObj.defaultPrefix);
    }
  };

  // Smart multi-sector entity code generator based on subsidiary name
  const handleNameChange = (val: string) => {
    setLegalName(val);
    if (!codeManuallyEdited) {
      const lower = val.toLowerCase();
      let gen = '';
      if (lower.includes('tech') || lower.includes('software') || lower.includes('digital') || lower.includes('cloud')) {
        gen = 'BTECH';
      } else if (lower.includes('energy') || lower.includes('power') || lower.includes('renew')) {
        gen = 'BENRG';
      } else if (lower.includes('oil') || lower.includes('petro') || lower.includes('gas') || lower.includes('fuel')) {
        gen = 'BOIL';
      } else if (lower.includes('prop') || lower.includes('estate') || lower.includes('realt') || lower.includes('build') || lower.includes('land')) {
        gen = 'BPROP';
      } else if (lower.includes('farm') || lower.includes('agro') || lower.includes('grain') || lower.includes('feed')) {
        gen = 'BAGRO';
      } else if (lower.includes('logist') || lower.includes('haul') || lower.includes('freight') || lower.includes('cargo')) {
        gen = 'BLOGS';
      } else if (lower.includes('cap') || lower.includes('invest') || lower.includes('fund') || lower.includes('asset') || lower.includes('fin')) {
        gen = 'BCAP';
      } else if (lower.includes('health') || lower.includes('care') || lower.includes('pharma') || lower.includes('med')) {
        gen = 'BHLTH';
      } else {
        const cleaned = val
          .replace(/^(Bems\s+)/i, '')
          .replace(/\s+(Limited|Ltd|Plc|Group|Holdings|Solutions|Services)$/i, '')
          .trim();
        const words = cleaned.split(/\s+/).filter(Boolean);
        if (words.length === 1) {
          gen = `B${words[0].slice(0, 4).toUpperCase()}`;
        } else if (words.length > 1) {
          gen = `B${words.map((w) => w[0]).join('').slice(0, 4).toUpperCase()}`;
        } else {
          const sObj = CONGLOMERATE_SECTORS.find((s) => s.id === sector);
          gen = sObj?.defaultPrefix || 'BCORP';
        }
      }
      setCode(gen || 'BCORP');
    }
  };

  const toggleDept = (dept: string) => {
    if (selectedDepts.includes(dept)) {
      if (selectedDepts.length === 1) return; // Retain at least one department
      setSelectedDepts(selectedDepts.filter((d) => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  const addCustomDept = () => {
    const trimmed = customDeptInput.trim();
    if (!trimmed) return;
    if (!selectedDepts.includes(trimmed)) {
      setSelectedDepts([...selectedDepts, trimmed]);
    }
    setCustomDeptInput('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) {
      setError('Enter the full legal registered name of the subsidiary.');
      return;
    }
    setError('');
    setSubmitting(true);

    const effectiveLocation = location === 'OTHER' ? customLocation.trim() || 'Head Office Operations' : location;
    const sectorObj = CONGLOMERATE_SECTORS.find((s) => s.id === sector);
    const sectorLabel = sectorObj?.label || 'General Enterprise Operations';

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: legalName.trim(),
          code: (code.trim() || 'BSUB').toUpperCase(),
          type: entityType,
          industry: sectorLabel,
          currency,
          rcNumber: rcNumber.trim() || undefined,
          headquarters: effectiveLocation,
          initialBudget: Number(initialBudget) || 0,
          departments: selectedDepts,
          brandColor,
          color: brandColor,
          logoUrl: logoUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create subsidiary');
      }

      onComplete(data.organization || data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the subsidiary.');
      setSubmitting(false);
    }
  };

  const availableSectorDepts = DEPARTMENTS_BY_SECTOR[sector] || DEPARTMENTS_BY_SECTOR.GENERAL;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel) {
          onCancel();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'rgba(9, 24, 52, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="corporate-subsidiary-title"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          overflowY: 'auto',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          color: '#0f172a',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: '20px 28px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#ea580c',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'inline-block',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                padding: '3px 8px',
                borderRadius: 4,
                marginBottom: 6,
              }}
            >
              BEMS Group Conglomerate Registry
            </div>
            <h1
              id="corporate-subsidiary-title"
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Register Conglomerate Subsidiary Company
            </h1>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#475569',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              ← Back to workspace
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '28px' }}>
          {error && (
            <div
              style={{
                marginBottom: 20,
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                color: '#991b1b',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Industry Sector Dropdown */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Industry Sector / Business Domain <span style={{ color: '#ea580c' }}>*</span>
              </label>
              <select
                value={sector}
                onChange={(e) => handleSectorChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#fff7ed',
                  border: '1.5px solid #fdba74',
                  borderRadius: 8,
                  color: '#9a3412',
                  fontSize: 14,
                  fontWeight: 700,
                  outline: 'none',
                }}
              >
                {CONGLOMERATE_SECTORS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
                Selecting a sector automatically tailors the entity prefix and core operational department recommendations.
              </small>
            </div>

            {/* Legal Registered Name */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Subsidiary Legal Name <span style={{ color: '#ea580c' }}>*</span>
              </label>
              <input
                required
                type="text"
                value={legalName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. BEMS Technologies Ltd, BEMS Energy Ltd, BEMS Properties Ltd"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {/* Entity Code */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Entity Code (Prefix for REQ numbers) <span style={{ color: '#ea580c' }}>*</span>
              </label>
              <input
                required
                type="text"
                value={code}
                onChange={(e) => {
                  setCodeManuallyEdited(true);
                  setCode(e.target.value.toUpperCase());
                }}
                placeholder="e.g. BTECH, BENRG, BPROP, BLOGS, BCORP"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 14,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  outline: 'none',
                }}
              />
              <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
                Voucher prefix, e.g. REQ-{code || 'BTECH'}-2026-001
              </small>
            </div>

            {/* Entity Classification */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Entity Classification
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                <option value="OPERATING_SUBSIDIARY">Operating Commercial Subsidiary (Active P&L)</option>
                <option value="TECH_IP_ENTITY">Technology & IP Holding Entity</option>
                <option value="SPECIAL_PURPOSE_VEHICLE">Special Purpose Vehicle (Asset / Project SPV)</option>
                <option value="INFRASTRUCTURE_SITE">Infrastructure, Plant or Terminal Site</option>
                <option value="REGIONAL_OFFICE">Regional Liaison or Branch Office</option>
              </select>
            </div>

            {/* BRAND IDENTITY & WORKSPACE THEME */}
            <div
              style={{
                gridColumn: 'span 2',
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 14,
                padding: '20px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 6, background: `${brandColor}18`, color: brandColor, alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✦</span>
                    Subsidiary Brand Identity & Workspace Theme
                  </h4>
                  <small style={{ color: '#64748b', fontSize: 11, display: 'block', marginTop: 2 }}>
                    Upload official corporate logo and select workspace theme color (updates whole dashboard interface)
                  </small>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: `${brandColor}12`,
                    border: `1px solid ${brandColor}40`,
                    color: brandColor,
                    fontSize: 11,
                    fontWeight: 750,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: brandColor }} />
                  {brandColor.toUpperCase()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 20, alignItems: 'start' }}>
                {/* Logo Uploader Column */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    Official Logo / Crest
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed #cbd5e1',
                      borderRadius: 12,
                      padding: 16,
                      background: '#f8fafc',
                      minHeight: 120,
                      textAlign: 'center',
                      position: 'relative',
                      transition: 'all 0.2s',
                    }}
                  >
                    {logoUrl ? (
                      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 12,
                            background: '#ffffff',
                            border: `2px solid ${brandColor}`,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          <img src={logoUrl} alt="Subsidiary logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              padding: '3px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #fecaca',
                              borderRadius: 6,
                              padding: '3px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#991b1b',
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 18,
                            color: '#94a3b8',
                          }}
                        >
                          🏛
                        </div>
                        <button
                          type="button"
                          disabled={uploadingLogo}
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#0f172a',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          {uploadingLogo ? 'Uploading...' : 'Upload Logo image'}
                        </button>
                        <small style={{ fontSize: 9, color: '#94a3b8' }}>PNG, JPG, SVG up to 8MB</small>
                      </div>
                    )}
                  </div>
                </div>

                {/* Brand Color Picker Column */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    Workspace Accent Color
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {BRAND_COLOR_PRESETS.map((p) => {
                      const isSelected = brandColor.toLowerCase() === p.hex.toLowerCase();
                      return (
                        <button
                          key={p.hex}
                          type="button"
                          title={`${p.name} (${p.hex})`}
                          onClick={() => setBrandColor(p.hex)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: p.hex,
                            border: isSelected ? '3px solid #ffffff' : '2px solid transparent',
                            boxShadow: isSelected ? `0 0 0 2px ${p.hex}, 0 4px 10px rgba(0,0,0,0.2)` : '0 1px 3px rgba(0,0,0,0.1)',
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#ffffff',
                            fontSize: 12,
                            fontWeight: 900,
                            transition: 'transform 0.15s ease',
                            transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                          }}
                        >
                          {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          padding: 2,
                          cursor: 'pointer',
                          background: '#ffffff',
                        }}
                      />
                    </div>
                    <input
                      type="text"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      placeholder="#0d8a70"
                      style={{
                        width: 110,
                        padding: '8px 10px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        textTransform: 'uppercase',
                      }}
                    />
                    <small style={{ fontSize: 10, color: '#64748b' }}>Custom hex code</small>
                  </div>

                  {/* Live Mini Preview Bar */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #0a101d, #141c2c)',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: `1px solid ${brandColor}40`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          border: `1.5px solid ${brandColor}`,
                        }}
                      >
                        {logoUrl ? (
                          <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 900, color: brandColor }}>
                            {code ? code.slice(0, 2) : 'BS'}
                          </span>
                        )}
                      </div>
                      <div>
                        <strong style={{ fontSize: 11, color: '#ffffff', display: 'block', lineHeight: 1.2 }}>
                          {legalName || 'Subsidiary Legal Name'}
                        </strong>
                        <span style={{ fontSize: 9, color: brandColor, fontWeight: 700 }}>
                          Workspace Preview
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: brandColor,
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.02em',
                      }}
                    >
                      Active Theme
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CAC RC Number */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                CAC / RC Registration Number <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                value={rcNumber}
                onChange={(e) => setRcNumber(e.target.value)}
                placeholder="e.g. RC-1849204"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {/* Operating Currency */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Default Ledger Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                <option value="NGN">NGN — Nigerian Naira (₦)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="EUR">EUR — Euro (€)</option>
              </select>
            </div>

            {/* Operating Location */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Operating Location
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                {CONGLOMERATE_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {location === 'OTHER' && (
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Enter custom facility or site location"
                  style={{
                    width: '100%',
                    marginTop: 8,
                    padding: '10px 14px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    color: '#0f172a',
                    fontSize: 14,
                  }}
                />
              )}
            </div>

            {/* Initial Operating Budget Allocation */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Initial Monthly Budget Ceiling (₦)
              </label>
              <input
                type="number"
                min="0"
                step="1000000"
                value={initialBudget}
                onChange={(e) => setInitialBudget(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
                Establishes the initial monthly expenditure envelope for requisitions.
              </small>
            </div>

            {/* Core Operating Departments */}
            <div style={{ gridColumn: 'span 2', marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', margin: 0 }}>
                  Core Operating Departments ({selectedDepts.length} selected)
                </label>
                <small style={{ color: '#ea580c', fontWeight: 600, fontSize: 11 }}>
                  Click chips to select/deselect or add custom
                </small>
              </div>

              {/* Recommended chips based on sector */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                {availableSectorDepts.map((dept) => {
                  const selected = selectedDepts.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleDept(dept)}
                      style={{
                        padding: '8px 14px',
                        background: selected ? '#fff7ed' : '#f1f5f9',
                        border: `1.5px solid ${selected ? '#ea580c' : '#cbd5e1'}`,
                        color: selected ? '#c2410c' : '#475569',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: selected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {selected ? '✓ ' : '+ '}
                      {dept}
                    </button>
                  );
                })}
              </div>

              {/* Custom department adder */}
              <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
                <input
                  type="text"
                  value={customDeptInput}
                  onChange={(e) => setCustomDeptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomDept();
                    }
                  }}
                  placeholder="Add custom department..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={addCustomDept}
                  style={{
                    padding: '8px 14px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '11px 20px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '11px 26px',
                background: submitting ? '#9a3412' : 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)',
              }}
            >
              {submitting ? 'Registering Subsidiary…' : 'Register Subsidiary Entity →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
