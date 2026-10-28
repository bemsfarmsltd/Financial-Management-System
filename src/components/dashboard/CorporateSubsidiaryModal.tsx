'use client';

import React, { useState, FormEvent } from 'react';

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

  // Auto-generate a clean uppercase code if user hasn't typed their own
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
    <main
      style={{
        minHeight: '100vh',
        background: '#0b1329',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 880,
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '24px 32px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f97316', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Corporate Entity Registry
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#f8fafc' }}>
              Register Subsidiary Company
            </h1>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                color: '#94a3b8',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Back to workspace
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
          {error && (
            <div
              style={{
                marginBottom: 24,
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: 8,
                color: '#fca5a5',
                fontSize: 14,
              }}
            >
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Legal Name */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Subsidiary Legal Name <span style={{ color: '#f97316' }}>*</span>
              </label>
              <input
                required
                type="text"
                value={legalName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Bems Farms Limited"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f8fafc',
                  fontSize: 15,
                  outline: 'none',
                }}
              />
            </div>

            {/* Entity Code */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Entity Code (Prefix for REQ numbers) <span style={{ color: '#f97316' }}>*</span>
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
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f8fafc',
                  fontSize: 15,
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Subsidiary Classification
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f8fafc',
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                CAC / RC Registration Number <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                value={rcNumber}
                onChange={(e) => setRcNumber(e.target.value)}
                placeholder="e.g. RC-1849204"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f8fafc',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {/* Operating Currency */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Default Ledger Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f8fafc',
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Operating Location / Farm Site
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f8fafc',
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
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    color: '#f8fafc',
                    fontSize: 14,
                  }}
                />
              )}
            </div>

            {/* Initial Operating Budget Allocation */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
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
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#f8fafc',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
                Establishes the initial monthly expenditure envelope for requisitions.
              </small>
            </div>

            {/* Core Operating Departments */}
            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
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
                        background: selected ? 'rgba(249, 115, 22, 0.15)' : '#1e293b',
                        border: `1px solid ${selected ? '#f97316' : '#334155'}`,
                        color: selected ? '#fed7aa' : '#94a3b8',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 600,
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
              marginTop: 32,
              paddingTop: 24,
              borderTop: '1px solid #1e293b',
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
                  padding: '12px 20px',
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: 8,
                  fontSize: 14,
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
                padding: '12px 28px',
                background: submitting ? '#9a3412' : '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
              }}
            >
              {submitting ? 'Registering Subsidiary…' : 'Register Subsidiary Entity →'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
