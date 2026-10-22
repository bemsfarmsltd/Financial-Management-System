'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  Plus,
  ArrowDownToLine,
  Search,
  RefreshCw,
  Building2,
  Clock,
  Layers,
  Zap,
  Sliders,
  AlertTriangle,
  FileCheck,
  Lock,
  ArrowRight,
  Info,
  ChevronRight,
  BadgeCheck,
  RotateCcw,
} from 'lucide-react';

interface PolicyItem {
  id: string;
  bandCode: string;
  bandName: string;
  priority: number;
  category: string;
  minAmount: number;
  maxAmount: number | null;
  rangeLabel: string;
  requiredRole: string;
  approverTitle: string;
  minSignatures: number;
  slaHours: number;
  slaWindow: string;
  reviewTier: string;
  scope: string;
  scopeCode: string;
  scopeSubsidiaryId: string | null;
  active: boolean;
}

interface SummaryData {
  totalRules: number;
  globalRulesCount: number;
  subsidiaryOverridesCount: number;
  tier1LimitFormatted: string;
  tier2LimitFormatted: string;
  emergencyCapFormatted: string;
}

interface ApprovalMatrixProps {
  businessName: string;
  userName: string;
  onNavigate?: (view: string) => void;
  onSelectBusiness?: (id: string) => void;
}

export function ApprovalMatrixView({
  businessName,
  userName,
  onNavigate,
  onSelectBusiness,
}: ApprovalMatrixProps) {
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalRules: 0,
    globalRulesCount: 0,
    subsidiaryOverridesCount: 0,
    tier1LimitFormatted: '₦500,000',
    tier2LimitFormatted: '₦2,000,000',
    emergencyCapFormatted: '₦1,000,000',
  });
  const [organizations, setOrganizations] = useState<{ id: string; code: string; legalName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'OPEX' | 'OVERRIDES' | 'EMERGENCY'>('ALL');
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Routing Simulator State
  const [simAmount, setSimAmount] = useState<number>(1450000);
  const [simSub, setSimSub] = useState<string>('BEMS-SOFT');
  const [simCategory, setSimCategory] = useState<string>('IT_SOFTWARE');

  // Edit / Add Rule Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyItem | null>(null);
  const [ruleScopeOrgId, setRuleScopeOrgId] = useState<string>('');
  const [ruleCategory, setRuleCategory] = useState<string>('GENERAL_OPEX');
  const [ruleMinAmount, setRuleMinAmount] = useState<string>('0');
  const [ruleMaxAmount, setRuleMaxAmount] = useState<string>('500000');
  const [ruleRole, setRuleRole] = useState<string>('HEAD_OF_ADMIN');
  const [rulePriority, setRulePriority] = useState<string>('1');
  const [submitting, setSubmitting] = useState(false);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const url = `/api/policies?subsidiary=${encodeURIComponent(selectedSubsidiary)}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load approval policies');
      const data = await res.json();
      setPolicies(data.policies || []);
      setSummary(data.summary || {});
      setOrganizations(data.organizations || []);
    } catch (err: any) {
      console.error(err);
      setNotice('Could not load authority policies: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [selectedSubsidiary]);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  // Filtered policies
  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      if (activeTab === 'OPEX') {
        if (p.category !== 'GENERAL_OPEX' && p.category !== 'IT_SOFTWARE') return false;
      } else if (activeTab === 'OVERRIDES') {
        if (p.scopeCode === 'GLOBAL') return false;
      } else if (activeTab === 'EMERGENCY') {
        if (p.category !== 'EMERGENCY') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = p.bandCode.toLowerCase().includes(q);
        const matchesName = p.bandName.toLowerCase().includes(q);
        const matchesApprover = p.approverTitle.toLowerCase().includes(q);
        const matchesScope = p.scope.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesApprover && !matchesScope && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [policies, activeTab, searchQuery]);

  // Live Simulator Path Calculation
  const simulationResult = useMemo(() => {
    const amount = Number(simAmount) || 0;
    const isEmergency = simCategory === 'EMERGENCY';

    if (isEmergency) {
      return {
        tier: 'Emergency Exemption Override',
        tierLevel: 0,
        color: '#be123c',
        badgeBg: '#ffe4e6',
        sla: 'Instant (< 15 mins)',
        requiredSteps: [
          { role: 'Facility Officer / Duty Lead', action: 'Pre-authorized Instant Execution', sla: 'Instant' },
          { role: 'Automated Bridge', action: 'SMS & WhatsApp Broadcast to GMD / COO', sla: 'Instant' },
          { role: 'Compliance Checker', action: '24-Hour Post-Facto Receipt Ratification', sla: '24 Hours' },
        ],
        escalationNote: 'Permitted up to ₦1,000,000 cap for critical life safety or refrigerated asset breakdown.',
      };
    }

    if (amount > 2000000) {
      return {
        tier: 'Tier 3 (GMD Final Sign-Off)',
        tierLevel: 3,
        color: '#b45309',
        badgeBg: '#fef3c7',
        sla: '12 Hours Maximum',
        requiredSteps: [
          { role: 'Head of Department (HOD)', action: 'Operational Need & Scope Verification', sla: '4 Hours' },
          { role: 'Chief Operating Officer (COO)', action: 'Budget Line Allocation & Vendor Vetting', sla: '6 Hours' },
          { role: 'Group Managing Director (GMD)', action: 'Executive Authorisation & Treasury Release', sla: '12 Hours' },
        ],
        escalationNote: 'Exceeds standard ₦2,000,000 threshold. Full 3-way vendor match required prior to sign-off.',
      };
    }

    if (amount > 500000 || (simCategory === 'IT_SOFTWARE' && amount > 1500000)) {
      return {
        tier: 'Tier 2 (Executive COO / Finance)',
        tierLevel: 2,
        color: '#0369a1',
        badgeBg: '#e0f2fe',
        sla: '6 Hours',
        requiredSteps: [
          { role: 'Head of Department (HOD)', action: 'Department Operational Endorsement', sla: '4 Hours' },
          { role: 'Chief Operating Officer (COO)', action: 'Executive Sign-Off & Maker-Checker Dispatch', sla: '6 Hours' },
        ],
        escalationNote: 'Between ₦500,001 and ₦2,000,000. Autonomous release without GMD escalation.',
      };
    }

    return {
      tier: 'Tier 1 (Autonomous Department Lead)',
      tierLevel: 1,
      color: '#047857',
      badgeBg: '#ecfdf5',
      sla: '4 Hours',
      requiredSteps: [
        { role: 'Head of Department (HOD)', action: 'Autonomous Direct Sign-Off', sla: '4 Hours' },
      ],
      escalationNote: 'Under ₦500,000 threshold. Fast-track approval with standard audit logging.',
    };
  }, [simAmount, simSub, simCategory]);

  // Export CSV
  const exportCsv = () => {
    const headers = ['Band Code', 'Policy Name', 'Scope', 'Category', 'Min (NGN)', 'Max (NGN)', 'Required Role', 'SLA Window', 'Review Tier'];
    const rows = filteredPolicies.map((p) => [
      p.bandCode,
      `"${p.bandName}"`,
      `"${p.scope}"`,
      p.category,
      p.minAmount,
      p.maxAmount !== null ? p.maxAmount : 'Unlimited',
      p.requiredRole,
      p.slaWindow,
      p.reviewTier,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bems-approval-matrix-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice(`Exported ${filteredPolicies.length} policy bands.`);
  };

  // Open modal for new or edit
  const handleOpenEdit = (policy: PolicyItem | null) => {
    if (policy) {
      setEditingPolicy(policy);
      setRuleScopeOrgId(policy.scopeSubsidiaryId || '');
      setRuleCategory(policy.category);
      setRuleMinAmount(String(policy.minAmount));
      setRuleMaxAmount(policy.maxAmount !== null ? String(policy.maxAmount) : '');
      setRuleRole(policy.requiredRole);
      setRulePriority(String(policy.priority));
    } else {
      setEditingPolicy(null);
      setRuleScopeOrgId('');
      setRuleCategory('GENERAL_OPEX');
      setRuleMinAmount('0');
      setRuleMaxAmount('500000');
      setRuleRole('HEAD_OF_ADMIN');
      setRulePriority(String(policies.length + 1));
    }
    setModalOpen(true);
  };

  // Save policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        id: editingPolicy?.id,
        scopeSubsidiaryId: ruleScopeOrgId || null,
        category: ruleCategory,
        minAmount: parseFloat(ruleMinAmount) || 0,
        maxAmount: ruleMaxAmount ? parseFloat(ruleMaxAmount) : null,
        requiredRole: ruleRole,
        priority: parseInt(rulePriority) || 1,
      };

      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save authority policy');

      setNotice(editingPolicy ? 'Policy rule updated successfully.' : 'New threshold band created.');
      setModalOpen(false);
      await fetchPolicies();
    } catch (err: any) {
      alert('Error saving policy: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, paddingBottom: '24px' }}>
      {/* Toast Notice */}
      {notice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#e9f7f1',
            color: '#137b62',
            border: '1px solid #c2ebd9',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(19, 123, 98, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={14} />
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 0, color: '#137b62', cursor: 'pointer', padding: '2px' }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Executive Header (Compact 18px Leftbar Scale) */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#7d8ba1', textTransform: 'uppercase' }}>
            POLICY ENGINE / DELEGATION OF AUTHORITY
          </span>
          <h1 style={{ fontSize: '18px', letterSpacing: '-0.3px', fontWeight: 700, margin: '4px 0 2px', color: '#17253d' }}>
            Approval matrix & authority limits
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
            Deterministic delegation of authority matrix based on organizational tier, amount bands, and SLA windows.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={exportCsv}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '10px',
              fontWeight: 650,
              background: '#fff',
              color: '#263c60',
              border: '1px solid #dce4ef',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}
          >
            <ArrowDownToLine size={12} />
            Export matrix
          </button>

          <button
            onClick={() => handleOpenEdit(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '7px',
              fontSize: '10px',
              fontWeight: 650,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff',
              border: '1px solid #ea580c',
              boxShadow: '0 3px 10px rgba(234, 88, 12, 0.25)',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            Add threshold rule
          </button>
        </div>
      </header>

      {/* Top Metric Strip (4 Sleek ~75px Cards Matching Leftbar Density) */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
        {/* Metric 1: Tier 1 Limit */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: '#047857', textTransform: 'uppercase' }}>
              Tier 1: Department Autonomous
            </span>
            <BadgeCheck size={13} color="#059669" />
          </div>
          <div>
            <strong style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, color: '#0f172a', display: 'block' }}>
              {summary.tier1LimitFormatted}
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>
              Head of Department sign-off · 4 Hours SLA
            </p>
          </div>
        </div>

        {/* Metric 2: Tier 2 Limit */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: '#0369a1', textTransform: 'uppercase' }}>
              Tier 2: Executive COO / Finance
            </span>
            <ShieldCheck size={13} color="#0284c7" />
          </div>
          <div>
            <strong style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, color: '#0f172a', display: 'block' }}>
              {summary.tier2LimitFormatted}
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>
              ₦500,001 — ₦2M band · 6 Hours SLA
            </p>
          </div>
        </div>

        {/* Metric 3: Tier 3 Escalation */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: '#fff',
            border: '1px solid #ea580c',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 8px 20px rgba(234, 88, 12, 0.22)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: '#fed7aa', textTransform: 'uppercase' }}>
              Tier 3: GMD Mandatory Escalation
            </span>
            <Lock size={13} color="#fed7aa" />
          </div>
          <div>
            <strong style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, display: 'block' }}>
              &gt; ₦2,000,000
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#ffedd5' }}>
              Group Managing Director final sign-off · 12 Hours SLA
            </p>
          </div>
        </div>

        {/* Metric 4: Emergency Override */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: '#be123c', textTransform: 'uppercase' }}>
              Emergency Facility Limit
            </span>
            <Zap size={13} color="#e11d48" />
          </div>
          <div>
            <strong style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, color: '#be123c', display: 'block' }}>
              {summary.emergencyCapFormatted}
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>
              Instant pre-auth · 24h Mandatory Audit Gate
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid: Policy Table on Left + Live Routing Simulator on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>
        {/* Left Column: Authority Matrix Table Card */}
        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 18px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              paddingBottom: '10px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.5px', color: '#64748b', textTransform: 'uppercase' }}>
                Entity Policy Scope
                <select
                  aria-label="Filter scope"
                  value={selectedSubsidiary}
                  onChange={(e) => setSelectedSubsidiary(e.target.value)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#1e293b',
                    minWidth: '180px',
                  }}
                >
                  <option value="ALL">All Policies (Global & Entity)</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.code}>
                      {org.legalName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Search Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                width: 'min(240px, 100%)',
              }}
            >
              <Search size={12} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search threshold, role, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 0,
                  outline: 'none',
                  fontSize: '10px',
                  color: '#1e293b',
                  width: '100%',
                  background: 'transparent',
                }}
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              borderBottom: '1px solid #f1f5f9',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Policy Bands', count: summary.totalRules },
                { id: 'OPEX', label: 'Operational (OPEX)', count: summary.globalRulesCount },
                { id: 'OVERRIDES', label: 'Entity Overrides', count: summary.subsidiaryOverridesCount },
                { id: 'EMERGENCY', label: 'Emergency Protocol', count: 1 },
              ].map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: isSelected ? '2px solid #ea580c' : '2px solid transparent',
                      color: isSelected ? '#ea580c' : '#64748b',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '10px',
                      padding: '6px 10px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        background: isSelected ? '#fff7ed' : '#f1f5f9',
                        color: isSelected ? '#ea580c' : '#64748b',
                        fontSize: '8px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '8px',
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={fetchPolicies}
              title="Refresh matrix"
              style={{
                background: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: '5px',
                padding: '4px 6px',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '9px',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={11} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Matrix Rules List */}
          {loading ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 600 }}>Loading policy engine…</p>
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>No policies match this filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredPolicies.map((p) => {
                const tierColor =
                  p.category === 'EMERGENCY'
                    ? { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' }
                    : p.requiredRole === 'GMD'
                    ? { bg: '#fef3c7', text: '#b45309', border: '#fde68a' }
                    : p.requiredRole === 'COO'
                    ? { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' }
                    : { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };

                return (
                  <article
                    key={p.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {p.bandCode}
                        </span>

                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: tierColor.bg,
                            color: tierColor.text,
                            border: `1px solid ${tierColor.border}`,
                          }}
                        >
                          {p.requiredRole.replace(/_/g, ' ')}
                        </span>

                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {p.scope}
                        </span>

                        {p.category !== 'GENERAL_OPEX' && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: '#f3e8ff',
                              color: '#7e22ce',
                              border: '1px solid #e9d5ff',
                            }}
                          >
                            {p.category.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                        {p.bandName}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: '#64748b', flexWrap: 'wrap' }}>
                        <span>
                          Approver: <strong>{p.approverTitle}</strong>
                        </span>
                        <span>· Signatures: <strong>{p.minSignatures} Required</strong></span>
                        <span>· SLA: <strong>{p.slaWindow}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.2 }}>
                          {p.rangeLabel}
                        </strong>
                        <small style={{ fontSize: '9px', color: '#64748b' }}>
                          {p.reviewTier}
                        </small>
                      </div>

                      <button
                        onClick={() => handleOpenEdit(p)}
                        title="Configure rule"
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '5px',
                          padding: '4px 8px',
                          fontSize: '10px',
                          fontWeight: 650,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Interactive Routing Simulator Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Simulator Box */}
          <section
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 18px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div>
              <span style={{ fontSize: '8px', letterSpacing: '0.8px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>
                LIVE POLICY ENGINE
              </span>
              <h3 style={{ margin: '2px 0 2px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                Routing Path Simulator
              </h3>
              <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>
                Test any expenditure figure to visualize the deterministic approval chain generated.
              </p>
            </div>

            {/* Simulator Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#334155' }}>
                Expenditure Amount (₦)
                <input
                  type="number"
                  step="50000"
                  value={simAmount}
                  onChange={(e) => setSimAmount(parseFloat(e.target.value) || 0)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '5px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#fff',
                  }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9px', fontWeight: 600, color: '#334155' }}>
                  Target Subsidiary
                  <select
                    value={simSub}
                    onChange={(e) => setSimSub(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '10px', background: '#fff' }}
                  >
                    <option value="BEMS-SOFT">BemsSoft Hub</option>
                    <option value="BEMS-LOG">Bems Logistics</option>
                    <option value="BEMS-GROUP">Group HQ</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9px', fontWeight: 600, color: '#334155' }}>
                  Category
                  <select
                    value={simCategory}
                    onChange={(e) => setSimCategory(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '10px', background: '#fff' }}
                  >
                    <option value="GENERAL_OPEX">General OPEX</option>
                    <option value="IT_SOFTWARE">IT Software & Cloud</option>
                    <option value="LOGISTICS">Fleet & Fuel Logistics</option>
                    <option value="FACILITIES">Facilities & Overhaul</option>
                    <option value="EMERGENCY">Emergency Exemption</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Simulator Output Result */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: simulationResult.badgeBg,
                    color: simulationResult.color,
                  }}
                >
                  {simulationResult.tier}
                </span>

                <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>
                  SLA: {simulationResult.sla}
                </span>
              </div>

              {/* Stepper Display */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0' }}>
                {simulationResult.requiredSteps.map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '10px' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: '#fff7ed',
                        color: '#ea580c',
                        fontWeight: 700,
                        fontSize: '9px',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        border: '1px solid #fed7aa',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#0f172a', display: 'block' }}>{step.role}</strong>
                      <span style={{ color: '#64748b' }}>{step.action}</span>
                    </div>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: '#ea580c', background: '#fff7ed', padding: '1px 5px', borderRadius: '3px', border: '1px solid #fed7aa' }}>
                      {step.sla}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ margin: '8px 0 0', fontSize: '9px', color: '#64748b', lineHeight: 1.4, borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                <Info size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                {simulationResult.escalationNote}
              </p>
            </div>
          </section>

          {/* Emergency Protocol Box */}
          <section
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 18px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="#e11d48" />
              <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                Emergency Exemption Protocol
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
              Pre-authorized limit up to <strong>₦1,000,000</strong> for critical infrastructure or life safety. Triggers immediate WhatsApp notification to GMD with mandatory 24-hour verification.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: '#be123c', background: '#fff1f2', padding: '6px 8px', borderRadius: '5px' }}>
              <AlertTriangle size={11} />
              <span>Strict maker-checker audit ratification enforced.</span>
            </div>
          </section>
        </div>
      </div>

      {/* ADD / EDIT POLICY MODAL */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 24, 52, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: 'min(480px, 94vw)',
              padding: '18px 20px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {editingPolicy ? `Configure Threshold Band (${editingPolicy.bandCode})` : 'Add Threshold Policy Rule'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: '#64748b' }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#334155' }}>
                Policy Scope
                <select
                  value={ruleScopeOrgId}
                  onChange={(e) => setRuleScopeOrgId(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                >
                  <option value="">Global Group Policy (All Subsidiaries)</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.legalName}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#334155' }}>
                  Category
                  <select
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  >
                    <option value="GENERAL_OPEX">General OPEX</option>
                    <option value="IT_SOFTWARE">IT Software & Cloud</option>
                    <option value="LOGISTICS">Fleet & Fuel Logistics</option>
                    <option value="FACILITIES">Facilities & Overhaul</option>
                    <option value="EMERGENCY">Emergency Override</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#334155' }}>
                  Required Signer Role
                  <select
                    value={ruleRole}
                    onChange={(e) => setRuleRole(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  >
                    <option value="HEAD_OF_ADMIN">Head of Department (HOD)</option>
                    <option value="COO">Chief Operating Officer (COO)</option>
                    <option value="GMD">Group Managing Director (GMD)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#334155' }}>
                  Minimum Amount (₦)
                  <input
                    type="number"
                    value={ruleMinAmount}
                    onChange={(e) => setRuleMinAmount(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#334155' }}>
                  Maximum Amount (₦) - Blank for unlimited
                  <input
                    type="number"
                    placeholder="e.g. 2000000"
                    value={ruleMaxAmount}
                    onChange={(e) => setRuleMaxAmount(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 0,
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px rgba(234, 88, 12, 0.25)',
                  }}
                >
                  {submitting ? 'Saving…' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
