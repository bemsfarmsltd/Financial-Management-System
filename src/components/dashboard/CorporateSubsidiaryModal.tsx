'use client';

import React, { useState, useEffect, FormEvent } from 'react';

export interface CorporateSubsidiaryModalProps {
  onCancel?: () => void;
  onComplete: (org: any) => void;
}

const DEFAULT_DEPARTMENTS = [
  'General Operations',
  'Finance & Administration',
  'Procurement & Supply Chain',
  'Field Production & Processing',
  'Sales & Distribution',
];

export function CorporateSubsidiaryModal({ onCancel, onComplete }: CorporateSubsidiaryModalProps) {
  const [legalName, setLegalName] = useState('');
  const [code, setCode] = useState('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [entityType, setEntityType] = useState('OPERATING_SUBSIDIARY');
  const [rcNumber, setRcNumber] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [location, setLocation] = useState('Benin Farm Hub, Edo State');
  const [customLocation, setCustomLocation] = useState('');
  const [initialBudget, setInitialBudget] = useState('25000000');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([
    'General Operations',
    'Finance & Administration',
    'Procurement & Supply Chain',
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  // Auto-generate uppercase entity code if user hasn't typed a custom one
  const handleNameChange = (val: string) => {
    setLegalName(val);
    if (!codeManuallyEdited) {
      const cleaned = val
        .replace(/^(Bems\s+)/i, '')
        .replace(/\s+(Limited|Ltd|Plc|Group|Holdings)$/i, '')
        .trim();
      const words = cleaned.split(/\s+/).filter(Boolean);
      let generated = 'BEMS';
      if (words.length === 1) {
        generated = `B${words[0].slice(0, 4).toUpperCase()}`;
      } else if (words.length > 1) {
        generated = `B${words.map((w) => w[0]).join('').slice(0, 4).toUpperCase()}`;
      }
      setCode(generated || 'BFARM');
    }
  };

  const toggleDept = (dept: string) => {
    if (selectedDepts.includes(dept)) {
      if (selectedDepts.length === 1) return; // Keep at least one
      setSelectedDepts(selectedDepts.filter((d) => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) {
      setError('Enter the full legal name of the subsidiary.');
      return;
    }
    setError('');
    setSubmitting(true);

    const effectiveLocation = location === 'OTHER' ? customLocation.trim() || 'Field Operations' : location;

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: legalName.trim(),
          code: (code.trim() || 'BSUB').toUpperCase(),
          type: entityType,
          currency,
          rcNumber: rcNumber.trim() || undefined,
          headquarters: effectiveLocation,
          initialBudget: Number(initialBudget) || 0,
          departments: selectedDepts,
          industry: entityType === 'AGRICULTURAL_HUB' ? 'Agriculture & Agro-Processing' : 'Enterprise Operations',
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
          maxWidth: 820,
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          color: '#0f172a',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
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
              Corporate Entity Registry
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
              Register Subsidiary Company
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
            {/* Legal Name */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Subsidiary Legal Name <span style={{ color: '#ea580c' }}>*</span>
              </label>
              <input
                required
                type="text"
                value={legalName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Bems Farms Limited"
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
                placeholder="e.g. BFARM"
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
                Used in voucher numbers, e.g. REQ-{code || 'BFARM'}-2026-001
              </small>
            </div>

            {/* Classification */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Subsidiary Classification
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
                <option value="OPERATING_SUBSIDIARY">Operating Subsidiary (Active P&L)</option>
                <option value="AGRICULTURAL_HUB">Agricultural Hub & Processing Site</option>
                <option value="SPECIAL_PURPOSE_VEHICLE">Special Purpose Vehicle (Asset / Project SPV)</option>
                <option value="REGIONAL_OFFICE">Regional Liaison / Branch Office</option>
              </select>
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

            {/* Location */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Operating Location / Farm Site
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
                <option value="Benin Farm Hub, Edo State">Benin Farm Hub, Edo State</option>
                <option value="Lagos HQ, Lagos State">Lagos Holding HQ, Lagos State</option>
                <option value="Abuja Liaison Office, FCT">Abuja Liaison Office, FCT</option>
                <option value="Asaba Facility, Delta State">Asaba Facility, Delta State</option>
                <option value="OTHER">Other Custom Location...</option>
              </select>
              {location === 'OTHER' && (
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Enter site location"
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
                step="500000"
                value={initialBudget}
                onChange={(e) => setInitialBudget(e.target.value)}
                placeholder="25000000"
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
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                Initial Core Departments
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {DEFAULT_DEPARTMENTS.map((dept) => {
                  const selected = selectedDepts.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleDept(dept)}
                      style={{
                        padding: '8px 14px',
                        background: selected ? '#fff7ed' : '#f1f5f9',
                        border: `1px solid ${selected ? '#ea580c' : '#cbd5e1'}`,
                        color: selected ? '#c2410c' : '#475569',
                        borderRadius: 20,
                        fontSize: 13,
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
