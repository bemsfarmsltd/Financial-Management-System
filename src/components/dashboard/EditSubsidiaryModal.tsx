'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { CONGLOMERATE_SECTORS, CONGLOMERATE_LOCATIONS } from './CorporateSubsidiaryModal';

export interface EditSubsidiaryModalProps {
  subsidiary: any;
  onCancel: () => void;
  onComplete: (updatedOrg: any) => void;
}

export function EditSubsidiaryModal({ subsidiary, onCancel, onComplete }: EditSubsidiaryModalProps) {
  const [legalName, setLegalName] = useState(subsidiary.name || subsidiary.legalName || '');
  const [code, setCode] = useState(subsidiary.code || '');
  const [entityType, setEntityType] = useState(subsidiary.type || 'OPERATING_SUBSIDIARY');
  
  // Find matching sector ID or default
  const matchedSector = CONGLOMERATE_SECTORS.find(
    (s) => s.label === subsidiary.industry || s.id === subsidiary.industry
  );
  const [sector, setSector] = useState(matchedSector?.id || 'TECHNOLOGY');
  
  const [rcNumber, setRcNumber] = useState(subsidiary.rcNumber || '');
  const [currency, setCurrency] = useState(subsidiary.currency || subsidiary.defaultCurrency || 'NGN');
  
  const initialHq = subsidiary.headquarters || 'Lagos Headquarters — Victoria Island / Ikoyi';
  const isPresetLoc = CONGLOMERATE_LOCATIONS.includes(initialHq);
  const [location, setLocation] = useState(isPresetLoc ? initialHq : 'OTHER');
  const [customLocation, setCustomLocation] = useState(isPresetLoc ? '' : initialHq);
  
  const [monthlyBudget, setMonthlyBudget] = useState(
    subsidiary.budget !== undefined ? String(subsidiary.budget) : '50000000'
  );
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Close modal when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) {
      setError('Legal name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Entity code is required.');
      return;
    }
    setError('');
    setSubmitting(true);

    const effectiveLocation = location === 'OTHER' ? customLocation.trim() || 'Head Office Operations' : location;
    const sectorObj = CONGLOMERATE_SECTORS.find((s) => s.id === sector);
    const sectorLabel = sectorObj?.label || 'General Enterprise Operations';

    try {
      const res = await fetch(`/api/organizations/${subsidiary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalName: legalName.trim(),
          code: code.trim().toUpperCase(),
          type: entityType,
          industry: sectorLabel,
          defaultCurrency: currency,
          rcNumber: rcNumber.trim() || undefined,
          headquarters: effectiveLocation,
          monthlyBudget: Number(monthlyBudget) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update subsidiary');
      }

      onComplete(data.organization || data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating subsidiary.');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
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
        aria-labelledby="edit-subsidiary-title"
        style={{
          width: '100%',
          maxWidth: 820,
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
              Subsidiary Profile Management
            </div>
            <h1
              id="edit-subsidiary-title"
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Edit {subsidiary.name || subsidiary.legalName}
            </h1>
          </div>
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
            ✕ Close
          </button>
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
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. BemsSoft Hub Ltd"
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
                Entity Code (REQ Prefix) <span style={{ color: '#ea580c' }}>*</span>
              </label>
              <input
                required
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. BBH, BTECH"
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
            </div>

            {/* Industry Sector Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Industry Sector
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
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
                {CONGLOMERATE_SECTORS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
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

            {/* CAC RC Number */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                CAC / RC Registration Number
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

            {/* Currency */}
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
                Operating Hub / Location
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
                  placeholder="Enter custom location"
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

            {/* Monthly Budget Ceiling */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Monthly Budget Ceiling (₦)
              </label>
              <input
                type="number"
                min="0"
                step="1000000"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="50000000"
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
                Updates the expenditure approval ceiling for requisitions across this subsidiary.
              </small>
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
              {submitting ? 'Saving Changes…' : 'Save Changes →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
