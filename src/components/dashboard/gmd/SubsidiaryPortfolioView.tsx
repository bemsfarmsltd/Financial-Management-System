'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  Wallet,
  ArrowUpRight,
  Plus,
  ArrowDownToLine,
  Clock,
  Repeat,
  ChevronRight,
  X,
  Check,
  ShieldCheck,
  FileText,
  Briefcase,
  MapPin,
  Mail,
  ExternalLink,
  Search,
  Landmark,
  Phone,
  BadgeCheck,
} from 'lucide-react';

interface DepartmentItem {
  id: string;
  name: string;
  code: string;
}

interface StaffMemberItem {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  positionName: string;
  departmentName: string;
  departmentCode: string;
  status: string;
  employmentType: string;
  grossMonthlySalary: number;
  intercompanySplit?: string;
}

interface BankAccountItem {
  bankName: string;
  accountNumber: string;
  accountType: string;
  balanceNaira: number;
}

interface RecentRequestItem {
  id: string;
  requestNumber: string;
  title: string;
  category: string;
  amountNaira: number;
  currency: string;
  approvalStatus: string;
  paymentStatus: string;
  requesterName: string;
  createdAt: string;
}

interface SubsidiaryItem {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  industry: string;
  initials: string;
  color: string;
  rcNumber?: string;
  headquarters?: string;
  lead?: {
    name: string;
    role: string;
    email: string;
  };
  headcount: number;
  budget: number;
  spent: number;
  approvedUnpaid: number;
  moneyLeft: number;
  utilisationPct: number;
  activeRequestsCount: number;
  pendingApprovalsCount: number;
  receiptsScore: number;
  outgoingNotesCount: number;
  incomingNotesCount: number;
  netIntercompanyAmount: number;
  departments?: DepartmentItem[];
  staff?: StaffMemberItem[];
  bankAccounts?: BankAccountItem[];
  recentRequests?: RecentRequestItem[];
}

interface IntercompanyNoteItem {
  id: string;
  noteNumber: string;
  noteType: string;
  amountNaira: number;
  currency: string;
  description: string;
  status: string;
  generatedAt: string;
  sourceEntity: {
    id: string;
    name: string;
    code: string;
  };
  targetEntity: {
    id: string;
    name: string;
    code: string;
  };
}

interface PortfolioData {
  summary: {
    totalCompanies: number;
    totalGroupHeadcount: number;
    totalGroupBudget: number;
    totalGroupSpent: number;
    totalIntercompanyVolume: number;
    activeNotesCount: number;
  };
  portfolio: SubsidiaryItem[];
  intercompanyNotes: IntercompanyNoteItem[];
}

interface Props {
  businessName: string;
  userName: string;
  onNavigate: (view: string) => void;
  onSelectBusiness?: (businessId: string) => void;
}

const COLOR_PALETTE = [
  { label: 'BEMS Orange', hex: '#ea580c' },
  { label: 'Emerald Green', hex: '#0d8a70' },
  { label: 'Deep Slate', hex: '#0b1220' },
  { label: 'Royal Purple', hex: '#7158de' },
  { label: 'Warm Amber', hex: '#d97706' },
  { label: 'Crimson Red', hex: '#be123c' },
];

const INDUSTRY_PRESETS = [
  'Software & Cloud Services',
  'Logistics & Agribusiness',
  'Energy & Infrastructure',
  'Financial Services & Fintech',
  'Real Estate & Facility Management',
  'Healthcare & Pharmaceuticals',
  'General Procurement & Trading',
];

const DEPARTMENT_PRESETS = [
  'General Operations',
  'Finance & Accounting',
  'Engineering & Technology',
  'Logistics & Fleet Operations',
  'Legal & Governance',
  'Sales & Business Growth',
];

export function SubsidiaryPortfolioView({
  businessName,
  userName,
  onNavigate,
  onSelectBusiness,
}: Props) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<string>('ALL');
  const [notice, setNotice] = useState<string | null>(null);

  // In-Depth Dossier Modal State
  const [dossierSub, setDossierSub] = useState<SubsidiaryItem | null>(null);
  const [dossierTab, setDossierTab] = useState<'financials' | 'staff' | 'treasury' | 'notes' | 'governance' | 'requests'>('financials');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffDeptFilter, setStaffDeptFilter] = useState('ALL');

  // Expanded Add Subsidiary Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubIndustry, setNewSubIndustry] = useState('Software & Cloud Services');
  const [newSubRc, setNewSubRc] = useState('');
  const [newSubLocation, setNewSubLocation] = useState('Victoria Island, Lagos');
  const [newSubLeadName, setNewSubLeadName] = useState('');
  const [newSubLeadEmail, setNewSubLeadEmail] = useState('');
  const [newSubBudget, setNewSubBudget] = useState('20000000');
  const [newSubColor, setNewSubColor] = useState('#ea580c');
  const [newSubDepts, setNewSubDepts] = useState<string[]>(['General Operations', 'Finance & Accounting']);
  const [creatingSub, setCreatingSub] = useState(false);

  const loadData = () => {
    fetch('/api/portfolio', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.portfolio) {
          setData(json);
          // If a dossier is currently open, keep it in sync with fresh data
          if (dossierSub) {
            const updated = json.portfolio.find((p: SubsidiaryItem) => p.id === dossierSub.id);
            if (updated) setDossierSub(updated);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load portfolio:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Auto-generate code when legal name changes if not manually set
  const handleNameChange = (val: string) => {
    setNewSubName(val);
    const words = val.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const codeSuggestion = 'BEMS-' + words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
      setNewSubCode(codeSuggestion);
    }
  };

  const toggleDept = (deptName: string) => {
    setNewSubDepts((prev) =>
      prev.includes(deptName) ? prev.filter((d) => d !== deptName) : [...prev, deptName]
    );
  };

  const handleCreateSubsidiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    setCreatingSub(true);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubName.trim(),
          code: newSubCode.trim() || undefined,
          industry: newSubIndustry.trim() || 'General Business',
          color: newSubColor,
          rcNumber: newSubRc.trim() || undefined,
          headquarters: newSubLocation.trim() || undefined,
          leadName: newSubLeadName.trim() || undefined,
          leadEmail: newSubLeadEmail.trim() || undefined,
          initialBudget: Number(newSubBudget) || 0,
          departments: newSubDepts,
        }),
      });
      if (res.ok) {
        setNotice(`Subsidiary "${newSubName}" created and added to Group portfolio!`);
        setAddModalOpen(false);
        // Reset form
        setNewSubName('');
        setNewSubCode('');
        setNewSubRc('');
        setNewSubLeadName('');
        setNewSubLeadEmail('');
        setNewSubBudget('20000000');
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create subsidiary');
      }
    } catch {
      alert('Network error creating subsidiary');
    } finally {
      setCreatingSub(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Company', 'Industry', 'Staff Headcount', 'Budget (NGN)', 'Spent (NGN)', 'Approved Unpaid (NGN)', 'Money Left (NGN)', 'Budget Used %', 'Active Notes'];
    const rows = data.portfolio.map((p) => [
      `"${p.name}"`,
      `"${p.industry}"`,
      p.headcount,
      p.budget,
      p.spent,
      p.approvedUnpaid,
      p.moneyLeft,
      `"${p.utilisationPct}%"`,
      p.outgoingNotesCount + p.incomingNotesCount,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bems_subsidiary_portfolio_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice('Portfolio report exported as CSV.');
  };

  const handleExportStaffCSV = (sub: SubsidiaryItem) => {
    if (!sub.staff || sub.staff.length === 0) return;
    const headers = ['Employee ID', 'Full Name', 'Position / Role', 'Department', 'Email', 'Phone', 'Employment Status', 'Monthly Salary (NGN)', 'Cost Allocation'];
    const rows = sub.staff.map((s) => [
      `"${s.employeeNumber}"`,
      `"${s.name}"`,
      `"${s.positionName}"`,
      `"${s.departmentName}"`,
      `"${s.email}"`,
      `"${s.phone}"`,
      `"${s.status}"`,
      s.grossMonthlySalary,
      `"${s.intercompanySplit || 'Primary'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${sub.code.toLowerCase()}_staff_roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice(`Staff roster for ${sub.name} exported as CSV.`);
  };

  const filteredPortfolio = useMemo(() => {
    if (!data) return [];
    if (selectedSub === 'ALL') return data.portfolio;
    return data.portfolio.filter((p) => p.id === selectedSub || p.name.includes(selectedSub));
  }, [data, selectedSub]);

  const filteredNotes = useMemo(() => {
    if (!data) return [];
    if (selectedSub === 'ALL') return data.intercompanyNotes;
    return data.intercompanyNotes.filter(
      (n) => n.sourceEntity.id === selectedSub || n.targetEntity.id === selectedSub
    );
  }, [data, selectedSub]);

  // Intercompany notes relevant to the currently inspected dossier subsidiary
  const dossierNotes = useMemo(() => {
    if (!data || !dossierSub) return [];
    return data.intercompanyNotes.filter(
      (n) => n.sourceEntity.id === dossierSub.id || n.targetEntity.id === dossierSub.id
    );
  }, [data, dossierSub]);

  // Filtered staff list inside the dossier modal
  const filteredDossierStaff = useMemo(() => {
    if (!dossierSub || !dossierSub.staff) return [];
    return dossierSub.staff.filter((s) => {
      const q = staffSearch.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        s.name.toLowerCase().includes(q) ||
        s.positionName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.employeeNumber.toLowerCase().includes(q);
      const matchesDept =
        staffDeptFilter === 'ALL' || s.departmentName === staffDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [dossierSub, staffSearch, staffDeptFilter]);

  // Unique departments for filter dropdown in staff roster
  const staffDeptOptions = useMemo(() => {
    if (!dossierSub || !dossierSub.staff) return [];
    const set = new Set<string>();
    dossierSub.staff.forEach((s) => {
      if (s.departmentName) set.add(s.departmentName);
    });
    return Array.from(set);
  }, [dossierSub]);

  // Total monthly payroll exposure for this subsidiary
  const totalMonthlyPayroll = useMemo(() => {
    if (!dossierSub || !dossierSub.staff) return 0;
    return dossierSub.staff.reduce((acc, s) => acc + (s.grossMonthlySalary || 0), 0);
  }, [dossierSub]);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '11px' }}>
        <p>Loading subsidiary portfolio and business units...</p>
      </div>
    );
  }

  const summary = data?.summary || {
    totalCompanies: 3,
    totalGroupHeadcount: 52,
    totalGroupBudget: 88000000,
    totalGroupSpent: 26600000,
    totalIntercompanyVolume: 5450000,
    activeNotesCount: 3,
  };

  return (
    <div style={{ width: '100%', paddingBottom: '40px' }}>
      {/* NOTICE TOAST */}
      {notice && (
        <div
          style={{
            background: '#04241e',
            color: '#10b981',
            border: '1px solid #0d8a70',
            padding: '8px 14px',
            borderRadius: '8px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: '600',
          }}
        >
          <span>✓ {notice}</span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '14px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* COMPACT HEADER & FILTERS */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '9px',
              fontWeight: '800',
              letterSpacing: '0.1em',
              color: '#105ee8',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '3px',
            }}
          >
            EXECUTIVE COMMAND · SUBSIDIARY PORTFOLIO
          </span>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              color: '#0f172a',
              margin: '0 0 3px 0',
            }}
          >
            Subsidiary Portfolio & Business Units
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
            Company performance, budgets, staff directory, and intercompany notes across BEMS Group. Click any company to inspect its full dossier.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={selectedSub}
            onChange={(e) => setSelectedSub(e.target.value)}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '11px',
              fontWeight: '600',
              color: '#334155',
            }}
          >
            <option value="ALL">All Companies ({data?.portfolio?.length || 0} Entities)</option>
            {data?.portfolio.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 11px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <ArrowDownToLine size={13} /> Export CSV
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 13px',
              borderRadius: '7px',
              border: 'none',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(234,88,12,0.25)',
            }}
          >
            <Plus size={13} /> Add Subsidiary
          </button>
        </div>
      </div>

      {/* COMPACT TOP 4 GROUP KPI CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* CARD 1: COMPANIES */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '11px',
            border: '1px solid #e2e8f0',
            padding: '13px 15px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.08em', color: '#64748b' }}>
              COMPANIES IN PORTFOLIO
            </span>
            <Building2 size={14} style={{ color: '#ea580c' }} />
          </div>
          <div style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a', marginBottom: '2px', letterSpacing: '-0.02em' }}>
            {summary.totalCompanies} Active
          </div>
          <div style={{ fontSize: '10px', color: summary.totalCompanies > 0 ? '#10b981' : '#64748b', fontWeight: '600' }}>
            ● {summary.totalCompanies > 0 ? '100% Operations Live' : 'No subsidiaries added'}
          </div>
        </div>

        {/* CARD 2: HEADCOUNT */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '11px',
            border: '1px solid #e2e8f0',
            padding: '13px 15px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.08em', color: '#64748b' }}>
              TOTAL GROUP STAFF
            </span>
            <Users size={14} style={{ color: '#7158de' }} />
          </div>
          <div style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a', marginBottom: '2px', letterSpacing: '-0.02em' }}>
            {summary.totalGroupHeadcount} Employees
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>
            {summary.totalGroupHeadcount > 0 ? `${summary.totalGroupHeadcount} Registered Staff` : 'No staff profiles registered yet'}
          </div>
        </div>

        {/* CARD 3: TOTAL GROUP BUDGET */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: '#ffffff',
            borderRadius: '11px',
            padding: '13px 15px',
            boxShadow: '0 3px 12px rgba(234,88,12,0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.08em', color: '#ffedd5' }}>
              TOTAL GROUP BUDGET
            </span>
            <Wallet size={14} style={{ color: '#fed7aa' }} />
          </div>
          <div style={{ fontSize: '19px', fontWeight: '800', color: '#ffffff', marginBottom: '2px', letterSpacing: '-0.02em' }}>
            {formatNaira(summary.totalGroupBudget)}
          </div>
          <div style={{ fontSize: '10px', color: '#ffedd5', fontWeight: '500' }}>
            {formatNaira(summary.totalGroupSpent)} spent this period
          </div>
        </div>

        {/* CARD 4: INTERCOMPANY NOTES */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '11px',
            border: '1px solid #e2e8f0',
            padding: '13px 15px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.08em', color: '#64748b' }}>
              INTERCOMPANY NOTES
            </span>
            <Repeat size={14} style={{ color: '#0d8a70' }} />
          </div>
          <div style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a', marginBottom: '2px', letterSpacing: '-0.02em' }}>
            {summary.activeNotesCount} Notes · {formatNaira(summary.totalIntercompanyVolume)}
          </div>
          <div style={{ fontSize: '10px', color: '#0d8a70', fontWeight: '600' }}>
            Cross-charges & shared services
          </div>
        </div>
      </div>

      {/* COMPACT SUBSIDIARY CARDS GRID */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: '750', color: '#0f172a', margin: '0 0 2px 0' }}>
              Subsidiary Business Units
            </h2>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
              Click any card to inspect the in-depth corporate dossier, staff directory roster, bank accounts, and intercompany ledger.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: filteredPortfolio.length > 0 ? 'repeat(auto-fit, minmax(310px, 1fr))' : '1fr',
            gap: '14px',
          }}
        >
          {filteredPortfolio.length === 0 && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '2px dashed #cbd5e1',
                padding: '48px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#fff7ed',
                  color: '#ea580c',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '22px',
                }}
              >
                ▦
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                No Subsidiaries in Portfolio Yet
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '420px', lineHeight: 1.5 }}>
                Register your first company or upload your entity records to start managing budgets, fund requests, and intercompany notes.
              </p>
              <button
                onClick={() => setAddModalOpen(true)}
                style={{
                  marginTop: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(234,88,12,0.3)',
                }}
              >
                <Plus size={14} /> Add First Subsidiary
              </button>
            </div>
          )}
          {filteredPortfolio.map((sub) => {
            return (
              <div
                key={sub.id}
                onClick={() => {
                  setDossierSub(sub);
                  setDossierTab('financials');
                  setStaffSearch('');
                  setStaffDeptFilter('ALL');
                }}
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {/* COMPACT TOP COLOR ACCENT */}
                <div style={{ height: '3px', background: sub.color }} />

                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* TITLE & BADGES */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '7px',
                          background: sub.color,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '11px',
                        }}
                      >
                        {sub.initials}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '13px', fontWeight: '750', color: '#0f172a', margin: '0 0 1px 0' }}>
                          {sub.name}
                        </h3>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '500',
                            color: '#64748b',
                          }}
                        >
                          {sub.industry}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        background: '#ecfdf5',
                        color: '#059669',
                        padding: '2px 7px',
                        borderRadius: '12px',
                        fontSize: '9px',
                        fontWeight: '700',
                      }}
                    >
                      ● {sub.status}
                    </span>
                  </div>

                  {/* QUICK STAT BADGES: HEADCOUNT & INTERCOMPANY */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '3px 7px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        color: '#334155',
                        fontWeight: '600',
                      }}
                    >
                      <Users size={11} style={{ color: '#64748b' }} />
                      <span>{sub.headcount} Staff</span>
                    </div>

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '3px 7px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        color: '#334155',
                        fontWeight: '600',
                      }}
                    >
                      <Repeat size={11} style={{ color: '#0d8a70' }} />
                      <span>{sub.outgoingNotesCount + sub.incomingNotesCount} Notes</span>
                    </div>

                    {sub.pendingApprovalsCount > 0 && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#fffbeb',
                          border: '1px solid #fef3c7',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          color: '#b45309',
                          fontWeight: '700',
                        }}
                      >
                        <Clock size={11} />
                        <span>{sub.pendingApprovalsCount} Needs Approval</span>
                      </div>
                    )}
                  </div>

                  {/* COMPACT PROGRESS BAR */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Budget Used</span>
                      <span style={{ color: '#0f172a', fontWeight: '750' }}>{sub.utilisationPct}%</span>
                    </div>
                    <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(sub.utilisationPct, 100)}%`,
                          background: sub.utilisationPct >= 80 ? '#d97706' : sub.color,
                          borderRadius: '2px',
                        }}
                      />
                    </div>
                  </div>

                  {/* FINANCIAL NUMBERS ROW */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '6px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '12px',
                    }}
                  >
                    <div>
                      <small style={{ fontSize: '8px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
                        Budget
                      </small>
                      <strong style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a' }}>
                        {formatNaira(sub.budget)}
                      </strong>
                    </div>

                    <div>
                      <small style={{ fontSize: '8px', fontWeight: '700', color: '#059669', textTransform: 'uppercase', display: 'block' }}>
                        Spent
                      </small>
                      <strong style={{ fontSize: '11px', fontWeight: '800', color: '#059669' }}>
                        {formatNaira(sub.spent)}
                      </strong>
                    </div>

                    <div>
                      <small style={{ fontSize: '8px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
                        Money Left
                      </small>
                      <strong style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a' }}>
                        {formatNaira(sub.moneyLeft)}
                      </strong>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    {onSelectBusiness && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBusiness(sub.id);
                          setNotice(`Switched active workspace to ${sub.name}.`);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#1e293b',
                          fontSize: '10px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        Set Active Company
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDossierSub(sub);
                        setDossierTab('financials');
                        setStaffSearch('');
                        setStaffDeptFilter('ALL');
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#fff7ed',
                        color: '#ea580c',
                        fontSize: '10px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      View Dossier <ArrowUpRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPACT COMPARATIVE BUDGET TABLE */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          marginBottom: '20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: '750', color: '#0f172a', margin: '0 0 2px 0' }}>
              Company Budgets & Spending Comparison
            </h2>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
              Direct comparison of budgets, actual money spent, and remaining funds across all companies. Click any row for in-depth breakdown.
            </p>
          </div>
          <button
            onClick={() => onNavigate('Budgets & commitments')}
            style={{
              background: 'none',
              border: 'none',
              color: '#ea580c',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            All Budgets <ChevronRight size={13} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Company</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Staff</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Budget</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Money Spent</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Approved (Unpaid)</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Money Left</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Budget Used</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPortfolio.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    No companies in portfolio yet. Click "Add Subsidiary" to begin.
                  </td>
                </tr>
              )}
              {filteredPortfolio.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    setDossierSub(p);
                    setDossierTab('financials');
                    setStaffSearch('');
                    setStaffDeptFilter('ALL');
                  }}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '5px',
                          background: p.color,
                          color: '#fff',
                          fontSize: '9px',
                          fontWeight: '800',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {p.initials}
                      </span>
                      <div>
                        <strong style={{ color: '#0f172a', display: 'block', fontSize: '11px' }}>{p.name}</strong>
                        <small style={{ color: '#64748b', fontSize: '9px' }}>{p.industry}</small>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: '600', color: '#334155' }}>
                    👥 {p.headcount}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>
                    {formatNaira(p.budget)}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: '700', color: '#059669' }}>
                    {formatNaira(p.spent)}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: '600', color: '#d97706' }}>
                    {formatNaira(p.approvedUnpaid)}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>
                    {formatNaira(p.moneyLeft)}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#0f172a', minWidth: '28px' }}>
                        {p.utilisationPct}%
                      </span>
                      <div style={{ width: '70px', height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(p.utilisationPct, 100)}%`,
                            background: p.utilisationPct >= 80 ? '#d97706' : p.color,
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDossierSub(p);
                        setDossierTab('financials');
                        setStaffSearch('');
                        setStaffDeptFilter('ALL');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ea580c',
                        fontWeight: '700',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      Dossier <ChevronRight size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPACT ACTIVE INTERCOMPANY NOTES & RECHARGES */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <Repeat size={14} style={{ color: '#0d8a70' }} />
              <h2 style={{ fontSize: '13px', fontWeight: '750', color: '#0f172a', margin: 0 }}>
                Active Intercompany Notes & Recharges
              </h2>
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
              Automatic debit and credit notes between subsidiaries for shared technology, logistics, and management fees.
            </p>
          </div>
          <button
            onClick={() => onNavigate('Intercompany notes')}
            style={{
              background: 'none',
              border: 'none',
              color: '#105ee8',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            All Intercompany Notes <ChevronRight size={13} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Note Number</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>From (Issuer)</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>To (Charged)</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Amount</th>
                <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.map((note) => {
                const isDebit = note.noteType === 'DEBIT_NOTE';
                const isReconciled = note.status === 'RECONCILED';
                return (
                  <tr key={note.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: '750', color: '#105ee8', fontFamily: 'monospace', fontSize: '11px' }}>
                      {note.noteNumber}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isDebit ? '#e0f2fe' : '#fef3c7',
                          color: isDebit ? '#0369a1' : '#b45309',
                        }}
                      >
                        {isDebit ? 'DEBIT NOTE' : 'CREDIT NOTE'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a' }}>
                      {note.sourceEntity.name}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a' }}>
                      {note.targetEntity.name}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#475569', maxWidth: '300px' }}>
                      {note.description}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0f172a' }}>
                      {formatNaira(note.amountNaira)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          padding: '2px 7px',
                          borderRadius: '12px',
                          background: isReconciled ? '#ecfdf5' : '#fffbeb',
                          color: isReconciled ? '#059669' : '#b45309',
                        }}
                      >
                        ● {isReconciled ? 'Reconciled' : 'Pending Settlement'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. EXPANDED ENTERPRISE "ADD NEW SUBSIDIARY" MODAL (~740px)                */}
      {/* ========================================================================= */}
      {addModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '820px',
              width: 'min(820px, 94vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(15,23,42,0.25)',
              border: '1px solid #e2e8f0',
            }}
          >
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.12em', color: '#105ee8', textTransform: 'uppercase' }}>
                  BEMS GROUP HOLDINGS · ONBOARDING DESK
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '3px 0 0 0', letterSpacing: '-0.02em' }}>
                  Register New Subsidiary Entity
                </h2>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '3px 0 0 0' }}>
                  Create an independent corporate workspace with budget allocations, department nodes, and intercompany routing.
                </p>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '18px',
                  color: '#64748b',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubsidiary}>
              {/* LIVE PREVIEW BADGE */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: newSubColor,
                      color: '#ffffff',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: '800',
                      fontSize: '13px',
                    }}
                  >
                    {newSubCode ? newSubCode.replace('BEMS-', '').slice(0, 2) || 'BS' : 'BS'}
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                      {newSubName.trim() || 'Subsidiary Entity Preview'}
                    </strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      Code: <code style={{ fontWeight: '700', color: '#105ee8' }}>{newSubCode || 'BEMS-NEW'}</code> · {newSubIndustry}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '9px', fontWeight: '700', background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '10px' }}>
                  ● Active Workspace
                </span>
              </div>

              {/* 2-COLUMN FORM GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                {/* 1. LEGAL NAME */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Subsidiary Legal Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    required
                    placeholder="e.g. Bems Energy & Infrastructure Ltd"
                    value={newSubName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a',
                    }}
                  />
                </div>

                {/* 2. COMPANY CODE */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Entity Code / Prefix
                  </label>
                  <input
                    placeholder="e.g. BEMS-ENERGY"
                    value={newSubCode}
                    onChange={(e) => setNewSubCode(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      fontWeight: '700',
                      color: '#0f172a',
                    }}
                  />
                  <small style={{ fontSize: '9px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    Used for request prefixes & intercompany note routing.
                  </small>
                </div>

                {/* 3. CORPORATE RC NUMBER */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Corporate RC Number
                  </label>
                  <input
                    placeholder="e.g. RC-1849201"
                    value={newSubRc}
                    onChange={(e) => setNewSubRc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a',
                    }}
                  />
                  <small style={{ fontSize: '9px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    CAC Registered enterprise identity.
                  </small>
                </div>

                {/* 4. INDUSTRY SECTOR */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Industry / Business Line
                  </label>
                  <select
                    value={newSubIndustry}
                    onChange={(e) => setNewSubIndustry(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      background: '#fff',
                      color: '#0f172a',
                    }}
                  >
                    {INDUSTRY_PRESETS.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. HEADQUARTERS LOCATION */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Operating City / Headquarters
                  </label>
                  <input
                    placeholder="e.g. Victoria Island, Lagos"
                    value={newSubLocation}
                    onChange={(e) => setNewSubLocation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a',
                    }}
                  />
                </div>

                {/* 6. MANAGING DIRECTOR / LEAD */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Managing Director / Executive Lead
                  </label>
                  <input
                    placeholder="e.g. Engr. Tunde Adeleke"
                    value={newSubLeadName}
                    onChange={(e) => setNewSubLeadName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a',
                    }}
                  />
                </div>

                {/* 7. LEAD EMAIL */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Executive Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. executive@bemsgroup.com"
                    value={newSubLeadEmail}
                    onChange={(e) => setNewSubLeadEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a',
                    }}
                  />
                </div>

                {/* 8. INITIAL MONTHLY BUDGET ALLOCATION */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Initial Monthly Budget (NGN ₦)
                  </label>
                  <input
                    type="number"
                    placeholder="20000000"
                    value={newSubBudget}
                    onChange={(e) => setNewSubBudget(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a',
                      fontWeight: '700',
                    }}
                  />
                  <small style={{ fontSize: '9px', color: '#059669', display: 'block', marginTop: '2px', fontWeight: '600' }}>
                    {formatNaira(Number(newSubBudget) || 0)} allocated for Q4.
                  </small>
                </div>

                {/* 9. BRAND COLOR */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                    Entity Brand Color Accent
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setNewSubColor(c.hex)}
                        title={c.label}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: c.hex,
                          border: newSubColor === c.hex ? '3px solid #0f172a' : '1px solid transparent',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      >
                        {newSubColor === c.hex && '✓'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 10. INITIAL DEPARTMENTS */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11px', fontWeight: '750', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                    Core Initial Departments
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {DEPARTMENT_PRESETS.map((dept) => {
                      const selected = newSubDepts.includes(dept);
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => toggleDept(dept)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${selected ? '#ea580c' : '#cbd5e1'}`,
                            background: selected ? '#fff7ed' : '#ffffff',
                            color: selected ? '#ea580c' : '#475569',
                            fontSize: '10px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {selected ? '✓' : '＋'} {dept}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSub}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 3px 8px rgba(234,88,12,0.25)',
                  }}
                >
                  {creatingSub ? 'Creating Workspace...' : 'Create Subsidiary Workspace →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. IN-DEPTH SUBSIDIARY DOSSIER MODAL (~980px)                              */}
      {/* ========================================================================= */}
      {dossierSub && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDossierSub(null);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '1440px',
              width: 'min(1440px, 96vw)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 70px -15px rgba(15,23,42,0.35)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {/* DOSSIER HEADER */}
            <div
              style={{
                background: '#0b1220',
                color: '#ffffff',
                padding: '22px 26px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '11px',
                    background: dossierSub.color,
                    color: '#ffffff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: '800',
                    fontSize: '17px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}
                >
                  {dossierSub.initials}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.12em', color: '#93c5fd', textTransform: 'uppercase' }}>
                      SUBSIDIARY CORPORATE DOSSIER
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: '750', background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {dossierSub.code}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: '700', background: '#059669', color: '#fff', padding: '2px 7px', borderRadius: '10px' }}>
                      ● {dossierSub.status}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '19px', fontWeight: '800', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
                    {dossierSub.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: '#cbd5e1' }}>
                    <span>{dossierSub.industry}</span>
                    <span>•</span>
                    <span>{dossierSub.rcNumber || 'RC-1849201'}</span>
                    <span>•</span>
                    <span>{dossierSub.headquarters || 'Lagos, Nigeria'}</span>
                  </div>
                </div>
              </div>

              {/* HEADER ACTIONS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onSelectBusiness && (
                  <button
                    onClick={() => {
                      onSelectBusiness(dossierSub.id);
                      setNotice(`Switched active workspace to ${dossierSub.name}.`);
                    }}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '7px',
                      border: '1px solid rgba(255,255,255,0.25)',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    Set Active Workspace
                  </button>
                )}
                <button
                  onClick={() => setDossierSub(null)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    fontSize: '18px',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* 4 HIGHLIGHT METRICS STRIP */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ padding: '12px 18px', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Staff Headcount
                </span>
                <strong style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {dossierSub.headcount} Employees
                </strong>
                <small style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                  {dossierSub.departments?.length || 2} Active Departments
                </small>
              </div>

              <div style={{ padding: '12px 18px', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Monthly Budget
                </span>
                <strong style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {formatNaira(dossierSub.budget)}
                </strong>
                <small style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                  Approved Q4 allocation
                </small>
              </div>

              <div style={{ padding: '12px 18px', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#059669', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Cash Spent & Committed
                </span>
                <strong style={{ fontSize: '15px', fontWeight: '800', color: '#059669' }}>
                  {formatNaira(dossierSub.spent + dossierSub.approvedUnpaid)}
                </strong>
                <small style={{ fontSize: '10px', color: '#0f172a', fontWeight: '700', display: 'block' }}>
                  {dossierSub.utilisationPct}% utilised
                </small>
              </div>

              <div style={{ padding: '12px 18px' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#0d8a70', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Intercompany Notes
                </span>
                <strong style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {dossierNotes.length} Notes
                </strong>
                <small style={{ fontSize: '10px', color: '#0d8a70', fontWeight: '600', display: 'block' }}>
                  {dossierSub.netIntercompanyAmount >= 0 ? '+' : ''}{formatNaira(dossierSub.netIntercompanyAmount)} Net
                </small>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '10px 24px 0 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
                overflowX: 'auto',
              }}
            >
              {[
                { key: 'financials', label: 'Financial Health & Budget' },
                { key: 'staff', label: `Staff & Team Roster (${dossierSub.staff?.length || dossierSub.headcount})` },
                { key: 'treasury', label: `Bank Accounts & Treasury (${dossierSub.bankAccounts?.length || 0})` },
                { key: 'notes', label: `Intercompany Ledger (${dossierNotes.length})` },
                { key: 'governance', label: 'Governance & Departments' },
                { key: 'requests', label: `Recent Fund Requests (${dossierSub.recentRequests?.length || 0})` },
              ].map((tab) => {
                const active = dossierTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setDossierTab(tab.key as any);
                      setStaffSearch('');
                      setStaffDeptFilter('ALL');
                    }}
                    style={{
                      padding: '8px 14px',
                      background: 'none',
                      border: 'none',
                      borderBottom: active ? '2px solid #ea580c' : '2px solid transparent',
                      color: active ? '#ea580c' : '#64748b',
                      fontSize: '11px',
                      fontWeight: active ? '750' : '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENTS (SCROLLABLE BODY) */}
            <div style={{ padding: '22px 26px', overflowY: 'auto', flex: 1 }}>
              {/* TAB 1: FINANCIALS */}
              {dossierTab === 'financials' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '9px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase' }}>Monthly Allocation</span>
                      <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block', margin: '4px 0' }}>{formatNaira(dossierSub.budget)}</strong>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>Base: NGN</span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '9px', fontWeight: '750', color: '#059669', textTransform: 'uppercase' }}>Verified Cash Paid</span>
                      <strong style={{ fontSize: '15px', color: '#059669', display: 'block', margin: '4px 0' }}>{formatNaira(dossierSub.spent)}</strong>
                      <span style={{ fontSize: '10px', color: '#059669', fontWeight: '600' }}>Settled payments</span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '9px', fontWeight: '750', color: '#d97706', textTransform: 'uppercase' }}>Approved Unpaid</span>
                      <strong style={{ fontSize: '15px', color: '#d97706', display: 'block', margin: '4px 0' }}>{formatNaira(dossierSub.approvedUnpaid)}</strong>
                      <span style={{ fontSize: '10px', color: '#d97706' }}>Committed obligations</span>
                    </div>

                    <div style={{ background: '#fff7ed', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
                      <span style={{ fontSize: '9px', fontWeight: '750', color: '#c2410c', textTransform: 'uppercase' }}>Remaining Liquidity</span>
                      <strong style={{ fontSize: '15px', color: '#ea580c', display: 'block', margin: '4px 0' }}>{formatNaira(dossierSub.moneyLeft)}</strong>
                      <span style={{ fontSize: '10px', color: '#9a3412', fontWeight: '600' }}>Uncommitted cushion</span>
                    </div>
                  </div>

                  {/* UTILISATION METER */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>Budget Utilisation & Burn Velocity</strong>
                        <p style={{ fontSize: '10px', color: '#64748b', margin: '2px 0 0 0' }}>Combined realized expenditures and approved payment commitments.</p>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: dossierSub.utilisationPct >= 80 ? '#d97706' : '#ea580c' }}>
                        {dossierSub.utilisationPct}%
                      </span>
                    </div>
                    <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(dossierSub.utilisationPct, 100)}%`,
                          background: dossierSub.utilisationPct >= 80 ? '#d97706' : '#ea580c',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                  </div>

                  {/* GOVERNANCE & COMPLIANCE METRICS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Executive Approval Queue</span>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '4px 0 2px 0' }}>
                        {dossierSub.pendingApprovalsCount} Requests Awaiting GMD
                      </h4>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
                        {dossierSub.pendingApprovalsCount === 0 ? 'All submissions currently authorized.' : 'Requires executive review on Approvals Desk.'}
                      </p>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: '#059669', textTransform: 'uppercase' }}>Delivery Accountability Score</span>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#059669', margin: '4px 0 2px 0' }}>
                        {dossierSub.receiptsScore}% Proof Compliance
                      </h4>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
                        {dossierSub.activeRequestsCount} total expenditure operations tracked in current cycle.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: STAFF & TEAM ROSTER */}
              {dossierTab === 'staff' && (
                <div>
                  {/* STAFF HEADER METRICS & SEARCH TOOLBAR */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      background: '#f8fafc',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
                        {dossierSub.name} · Staff Directory
                      </span>
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                        {dossierSub.staff?.length || dossierSub.headcount} Team Members
                      </strong>
                      <span style={{ fontSize: '10px', color: '#059669', marginLeft: '8px', fontWeight: '600' }}>
                        Est. Monthly Payroll: {formatNaira(totalMonthlyPayroll)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* SEARCH INPUT */}
                      <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }} />
                        <input
                          placeholder="Filter by name, role, email..."
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          style={{
                            padding: '6px 10px 6px 28px',
                            borderRadius: '7px',
                            border: '1px solid #cbd5e1',
                            fontSize: '11px',
                            width: '210px',
                            background: '#fff',
                            color: '#0f172a',
                          }}
                        />
                      </div>

                      {/* DEPARTMENT FILTER */}
                      {staffDeptOptions.length > 0 && (
                        <select
                          value={staffDeptFilter}
                          onChange={(e) => setStaffDeptFilter(e.target.value)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '7px',
                            border: '1px solid #cbd5e1',
                            fontSize: '11px',
                            background: '#fff',
                            color: '#334155',
                            fontWeight: '600',
                          }}
                        >
                          <option value="ALL">All Departments ({staffDeptOptions.length})</option>
                          {staffDeptOptions.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* EXPORT ROSTER BUTTON */}
                      <button
                        onClick={() => handleExportStaffCSV(dossierSub)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 11px',
                          borderRadius: '7px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f172a',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        <ArrowDownToLine size={12} /> Export Roster
                      </button>
                    </div>
                  </div>

                  {/* STAFF TABLE */}
                  {filteredDossierStaff.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '10px', fontSize: '11px' }}>
                      <Users size={24} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                      <p style={{ margin: 0, fontWeight: '600' }}>No staff members match the specified search or filter.</p>
                      <button
                        onClick={() => {
                          setStaffSearch('');
                          setStaffDeptFilter('ALL');
                        }}
                        style={{ marginTop: '8px', background: 'none', border: 'none', color: '#105ee8', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
                      >
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                            <th style={{ padding: '9px 12px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Employee</th>
                            <th style={{ padding: '9px 12px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Position & Title</th>
                            <th style={{ padding: '9px 12px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Department</th>
                            <th style={{ padding: '9px 12px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Contact</th>
                            <th style={{ padding: '9px 12px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Monthly Salary</th>
                            <th style={{ padding: '9px 12px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Cost Split</th>
                            <th style={{ padding: '9px 12px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDossierStaff.map((emp) => {
                            const initials = emp.name
                              .split(' ')
                              .map((w) => w[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase();
                            return (
                              <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                {/* EMPLOYEE NAME & ID */}
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div
                                      style={{
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '50%',
                                        background: dossierSub.color,
                                        color: '#ffffff',
                                        display: 'grid',
                                        placeItems: 'center',
                                        fontWeight: '800',
                                        fontSize: '10px',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {initials}
                                    </div>
                                    <div>
                                      <strong style={{ fontSize: '11px', color: '#0f172a', display: 'block' }}>{emp.name}</strong>
                                      <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>{emp.employeeNumber}</span>
                                    </div>
                                  </div>
                                </td>

                                {/* POSITION & ROLE */}
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#1e293b', display: 'block' }}>
                                    {emp.positionName}
                                  </span>
                                  <span style={{ fontSize: '8px', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase' }}>
                                    {emp.role}
                                  </span>
                                </td>

                                {/* DEPARTMENT */}
                                <td style={{ padding: '10px 12px' }}>
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: '700',
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      background: '#f1f5f9',
                                      color: '#334155',
                                    }}
                                  >
                                    {emp.departmentName}
                                  </span>
                                </td>

                                {/* CONTACT */}
                                <td style={{ padding: '10px 12px' }}>
                                  <a
                                    href={`mailto:${emp.email}`}
                                    style={{ fontSize: '11px', color: '#ea580c', textDecoration: 'none', display: 'block', fontWeight: '500' }}
                                  >
                                    {emp.email}
                                  </a>
                                  <span style={{ fontSize: '9px', color: '#64748b' }}>{emp.phone}</span>
                                </td>

                                {/* MONTHLY SALARY */}
                                <td style={{ padding: '10px 12px', fontWeight: '750', color: '#0f172a' }}>
                                  {formatNaira(emp.grossMonthlySalary)}
                                  <small style={{ fontSize: '8px', color: '#64748b', display: 'block', fontWeight: '500' }}>/ month</small>
                                </td>

                                {/* COST SPLIT */}
                                <td style={{ padding: '10px 12px' }}>
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: '600',
                                      color: emp.intercompanySplit?.includes('Secondary') ? '#b45309' : '#059669',
                                    }}
                                  >
                                    {emp.intercompanySplit || 'Primary'}
                                  </span>
                                </td>

                                {/* STATUS */}
                                <td style={{ padding: '10px 12px' }}>
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: '700',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      background: '#ecfdf5',
                                      color: '#059669',
                                    }}
                                  >
                                    ● Active
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BANK ACCOUNTS & TREASURY */}
              {dossierTab === 'treasury' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '750', color: '#0f172a', margin: '0 0 2px 0' }}>
                        Operational Treasury & Settlement Accounts
                      </h4>
                      <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
                        Designated commercial bank accounts authorized for dual-signoff expenditure disbursements by Group Treasury.
                      </p>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '800', background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '10px' }}>
                      ✓ CBN / NIBSS Verified
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                    {(dossierSub.bankAccounts || []).map((acc, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '16px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff7ed', color: '#ea580c', display: 'grid', placeItems: 'center', border: '1px solid #fed7aa' }}>
                              <Landmark size={16} />
                            </div>
                            <div>
                              <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>{acc.bankName}</strong>
                              <span style={{ fontSize: '9px', color: '#64748b' }}>{acc.accountType}</span>
                            </div>
                          </div>
                          <BadgeCheck size={16} style={{ color: '#059669' }} />
                        </div>

                        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', marginBottom: '10px' }}>
                          <span style={{ fontSize: '8px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
                            Account Number (NUBAN)
                          </span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                            <code style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '1px', color: '#0f172a' }}>
                              {acc.accountNumber}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(acc.accountNumber);
                                setNotice(`Copied account number ${acc.accountNumber} to clipboard.`);
                              }}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '5px',
                                padding: '3px 7px',
                                fontSize: '9px',
                                fontWeight: '700',
                                color: '#ea580c',
                                cursor: 'pointer',
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '4px' }}>
                          <div>
                            <span style={{ fontSize: '8px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                              Available Ledger Liquidity
                            </span>
                            <strong style={{ fontSize: '14px', fontWeight: '800', color: '#059669', display: 'block' }}>
                              {formatNaira(acc.balanceNaira)}
                            </strong>
                          </div>
                          <span style={{ fontSize: '8px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            Dual Approval Required
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: INTERCOMPANY NOTES */}
              {dossierTab === 'notes' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                      Intercompany debit & credit notes involving <strong>{dossierSub.name}</strong> as an issuer or charged counterparty.
                    </p>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0d8a70' }}>
                      Net Position: {dossierSub.netIntercompanyAmount >= 0 ? '+' : ''}{formatNaira(dossierSub.netIntercompanyAmount)}
                    </span>
                  </div>

                  {dossierNotes.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '10px', fontSize: '11px' }}>
                      No intercompany debit or credit notes recorded for this subsidiary yet.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Note Number</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Direction</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Counterparty</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Purpose</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Amount</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dossierNotes.map((note) => {
                          const isSource = note.sourceEntity.id === dossierSub.id;
                          const counterparty = isSource ? note.targetEntity.name : note.sourceEntity.name;
                          const isReconciled = note.status === 'RECONCILED';
                          return (
                            <tr key={note.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '750', color: '#ea580c', fontFamily: 'monospace' }}>
                                {note.noteNumber}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: '800',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: isSource ? '#e0f2fe' : '#fef3c7',
                                    color: isSource ? '#0369a1' : '#b45309',
                                  }}
                                >
                                  {isSource ? 'OUTGOING (DEBIT)' : 'INCOMING (CREDIT)'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a' }}>
                                {counterparty}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#475569' }}>
                                {note.description}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0f172a' }}>
                                {formatNaira(note.amountNaira)}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    padding: '2px 7px',
                                    borderRadius: '12px',
                                    background: isReconciled ? '#ecfdf5' : '#fffbeb',
                                    color: isReconciled ? '#059669' : '#b45309',
                                  }}
                                >
                                  ● {isReconciled ? 'Reconciled' : 'Pending Settlement'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB 5: GOVERNANCE & DEPARTMENTS */}
              {dossierTab === 'governance' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '16px' }}>
                    {/* LEADERSHIP PROFILE */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                        EXECUTIVE LEADERSHIP
                      </span>
                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px 0' }}>
                        {dossierSub.lead?.name || 'Managing Director'}
                      </h4>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 10px 0' }}>
                        {dossierSub.lead?.role || 'Chief Operating Officer'}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={12} style={{ color: '#64748b' }} />
                          <span>{dossierSub.lead?.email || `executive@${dossierSub.code.toLowerCase()}.bemsgroup.com`}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={12} style={{ color: '#64748b' }} />
                          <span>{dossierSub.headquarters || 'Lagos, Nigeria'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Briefcase size={12} style={{ color: '#64748b' }} />
                          <span>Registration: {dossierSub.rcNumber || 'RC-1849201'}</span>
                        </div>
                      </div>
                    </div>

                    {/* DEPARTMENTS LIST */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                          Registered Departments ({dossierSub.departments?.length || 2})
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          Total Staff: <strong>{dossierSub.headcount}</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(dossierSub.departments || []).map((dept) => (
                          <div
                            key={dept.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #f1f5f9',
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '11px', color: '#0f172a' }}>{dept.name}</strong>
                              <span style={{ fontSize: '9px', color: '#64748b', display: 'block' }}>Code: {dept.code}</span>
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: '700', background: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                              Active Unit
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: RECENT REQUESTS */}
              {dossierTab === 'requests' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                      Recent expenditure and fund requests originating from <strong>{dossierSub.name}</strong>.
                    </p>
                    <button
                      onClick={() => onNavigate('Fund requests')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ea580c',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      View All Desk Requests <ArrowUpRight size={12} />
                    </button>
                  </div>

                  {!dossierSub.recentRequests || dossierSub.recentRequests.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '10px', fontSize: '11px' }}>
                      No expenditure requests recorded for this subsidiary yet.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Reference</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Title / Purpose</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Requester</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Category</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Amount</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Approval</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dossierSub.recentRequests.map((req) => (
                          <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: '750', color: '#ea580c', fontFamily: 'monospace' }}>
                              {req.requestNumber}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a' }}>
                              {req.title}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {req.requesterName}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>
                              {req.category}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0f172a' }}>
                              {formatNaira(req.amountNaira)}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: '750',
                                  padding: '2px 7px',
                                  borderRadius: '10px',
                                  background: req.approvalStatus === 'APPROVED' ? '#ecfdf5' : '#fffbeb',
                                  color: req.approvalStatus === 'APPROVED' ? '#059669' : '#b45309',
                                }}
                              >
                                {req.approvalStatus}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: '750',
                                  padding: '2px 7px',
                                  borderRadius: '10px',
                                  background: req.paymentStatus === 'VERIFIED_PAID' ? '#ecfdf5' : '#f1f5f9',
                                  color: req.paymentStatus === 'VERIFIED_PAID' ? '#059669' : '#475569',
                                }}
                              >
                                {req.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* DOSSIER FOOTER */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 26px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b' }}>
                <ShieldCheck size={14} style={{ color: '#059669' }} />
                <span>Independently verified corporate records · BEMS Group Multi-Entity Architecture</span>
              </div>
              <button
                onClick={() => setDossierSub(null)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubsidiaryPortfolioView;
